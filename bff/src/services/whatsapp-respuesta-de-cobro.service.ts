/**
 * La respuesta del acudiente a «¿a cuál de tus cobros lo aplico?».
 *
 * Es el otro extremo de `esperarAlUsuario`: el worker dejó la fila en
 * 'waiting_user' con las opciones congeladas, y este módulo es el único que las
 * vuelve a mirar. Corre ANTES del LLM en cada mensaje entrante, porque «2» o
 * «los dos» solo significan algo contra una pregunta abierta — para el modelo
 * son ruido.
 *
 * La regla de producto y el porqué de cada desempate están en
 * `whatsapp-eleccion-de-pago.service`.
 */

import { supabase } from '../config/supabase';
import { aplicarComprobante } from '../jobs/whatsapp-queue.job';
import {
    interpretarEleccion, loQueQueda, etiquetaDeCobro, resumenParaLaEscuela, TEXTO_REVISION_ESCUELA,
} from './whatsapp-eleccion-de-pago.service';
import { resolverRespuestaDeDeportista, botonesDeCobros } from './whatsapp-comprobante-de-ficha.service';
import { describirPago, type PagoPendiente } from './whatsapp-receipt-matching.service';
import { soloSaludoOCortesia } from './whatsapp-atencion.service';
import type { BotonInteractivo, WhatsAppIntegration } from './whatsapp.service';

/**
 * Cuánto vale una pregunta abierta.
 *
 * Pasadas 24h la ventana de servicio de Meta está cerrada y ya no se le puede
 * contestar en texto libre, así que una respuesta más tardía no tiene a dónde
 * ir. Y a esa altura el padre ya no recuerda qué se le ofreció.
 */
const VIGENCIA_H = 24;

/** Cuántas veces se le vuelve a preguntar antes de pasarlo a la escuela. */
const MAX_REPREGUNTAS = 2;

/**
 * Un saludo suelto («Buen día») que llega pegado a la pregunta no es una
 * respuesta: es lo que escribió junto con el comprobante. No se le repregunta
 * (Dynasty 2026-10-09: imagen + «Buen día» → la lista salió dos veces).
 */
const SALUDO_PEGADO_MIN = 5;

/** Responde a la familia. `botones`: las opciones como botones (si el canal los soporta). */
export type ResponderCobro = (texto: string, paso: string, botones?: BotonInteractivo[]) => Promise<unknown>;

/**
 * Pasa el caso a la escuela con `resumen`. `mensajeFamilia`: lo que se le
 * dice a la familia (UNA vez, lo dice quien escala); null = solo la escuela.
 */
export type PasarALaEscuela = (p: { resumen: string; mensajeFamilia: string | null }) => Promise<unknown>;

interface FilaEsperando {
    id: string;
    pregunta_opciones: PagoPendiente[] | null;
    pregunta_ocr: {
        ocr: any;
        sha: string;
        storagePath: string | null;
        /** null: familia sin cuenta (cobros por ficha). */
        parentId: string | null;
        /** 'deportista': se preguntó de qué deportista es (número sin ficha). */
        tipo?: 'deportista';
        /** Meses que la familia dijo que YA pagó en respuestas anteriores («agosto»). */
        dice_pagado?: string[];
    } | null;
    pregunta_at: string | null;
    retries: number;
    school_id: string;
}

/**
 * ¿Este mensaje es la respuesta a una pregunta abierta? Si lo es, la resuelve.
 *
 * Devuelve `true` cuando consumió el turno: quien llama NO debe seguir al LLM.
 *
 * `responder` lo inyecta el llamador en vez de importarlo, para no cerrar el
 * ciclo bot → respuesta → bot entre módulos.
 */
export async function resolverRespuestaDeCobro(
    integration: WhatsAppIntegration,
    contactWaId: string,
    texto: string,
    responder: ResponderCobro,
    pasarALaEscuela?: PasarALaEscuela,
): Promise<boolean> {
    const { data } = await supabase
        .from('whatsapp_inbound_queue')
        .select('id, pregunta_opciones, pregunta_ocr, pregunta_at, retries, school_id')
        .eq('integration_id', integration.id)
        .eq('wa_phone_number', contactWaId)
        .eq('status', 'waiting_user')
        .order('pregunta_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

    const fila = data as FilaEsperando | null;
    if (!fila) return false;

    // «¿De qué deportista es este pago?» (número sin ficha): la respuesta es un
    // nombre, no una opción. Vencida, sigue su curso (la vence el worker).
    if (fila.pregunta_ocr?.tipo === 'deportista') {
        const edad = fila.pregunta_at ? (Date.now() - new Date(fila.pregunta_at).getTime()) / 3_600_000 : Infinity;
        if (edad > VIGENCIA_H) return false;
        return resolverRespuestaDeDeportista(fila, texto, responder);
    }

    // Filas de antes de esta función, sin contexto congelado: no hay con qué
    // aplicarlas. Se cierran para que dejen de interceptar mensajes, y la
    // escuela las sigue viendo en el inbox.
    const opciones = fila.pregunta_opciones ?? [];
    const guardado = fila.pregunta_ocr;
    if (!opciones.length || !guardado) {
        await cerrarPregunta(fila.id, 'pregunta sin contexto congelado');
        return false;
    }

    // Vencida: se cierra y el mensaje sigue su curso normal. No se le contesta
    // nada sobre el comprobante viejo — sería confundirlo más.
    const edadH = fila.pregunta_at
        ? (Date.now() - new Date(fila.pregunta_at).getTime()) / 3_600_000
        : Infinity;
    if (edadH > VIGENCIA_H) {
        await cerrarPregunta(fila.id, 'la pregunta venció sin respuesta');
        return false;
    }

    // «Buen día» pegado a la pregunta (llegó con el comprobante): ni se
    // repregunta ni pasa al modelo. Más tarde, un saludo sí sigue su curso.
    const minutos = fila.pregunta_at ? (Date.now() - new Date(fila.pregunta_at).getTime()) / 60_000 : Infinity;
    if (soloSaludoOCortesia(texto) && minutos <= SALUDO_PEGADO_MIN) return true;

    const eleccion = interpretarEleccion(texto, opciones);
    const yaDichos = Array.isArray(guardado.dice_pagado) ? guardado.dice_pagado : [];

    // Discute el VALOR, o dice que ya está al día: no se aplica por inferencia.
    // A la escuela con un resumen, y a la familia UNA respuesta.
    if (eleccion.tipo === 'revision_escuela') {
        const resumen = resumenParaLaEscuela(eleccion, yaDichos);
        if (pasarALaEscuela) {
            await pasarALaEscuela({ resumen, mensajeFamilia: TEXTO_REVISION_ESCUELA });
        } else {
            await responder(TEXTO_REVISION_ESCUELA, 'cobro_a_revision_escuela');
        }
        await cerrarPregunta(fila.id, `revision_escuela: ${resumen}`, 'failed');
        return true;
    }

    // Descartó algunos («agosto ya lo pagué») o el mes lo tienen varios: se
    // pregunta SOLO entre lo que queda, con botones nuevos. Las opciones
    // congeladas se reemplazan: «sm_cobro_1» ahora señala la primera de ESTAS.
    if (eleccion.tipo === 'acotar') {
        const dicePagado = [...new Set([...yaDichos, ...eleccion.dicePagado.map(etiquetaDeCobro)])];
        await supabase.from('whatsapp_inbound_queue')
            .update({
                pregunta_opciones: eleccion.opciones,
                pregunta_ocr: { ...guardado, dice_pagado: dicePagado },
            })
            .eq('id', fila.id);
        await responder(mensajeAcotado(eleccion.opciones, eleccion.dicePagado, opciones, eleccion.motivo),
            'ask_cual_pago_acotado', botonesDeCobros(eleccion.opciones));
        return true;
    }

    if (eleccion.tipo === 'cancelar') {
        await responder(
            'Listo, no lo apliqué a ninguno. Cuando sepas a cuál va, mándame el ' +
            'comprobante de nuevo y lo registro. 👍',
            'eleccion_cancelada',
        );
        await cerrarPregunta(fila.id, 'el acudiente pidió no aplicarlo');
        return true;
    }

    if (eleccion.tipo === 'no_entendi') {
        // Se repregunta un par de veces y se para. Insistir una tercera vez le
        // traba el chat: cualquier cosa que escriba vuelve a caer acá.
        if (fila.retries >= MAX_REPREGUNTAS) {
            await responder(
                'No logro entender a cuál de tus cobros va el comprobante, así que se lo ' +
                'paso a la escuela para que lo apliquen ellos. Lo tienen guardado. 📄',
                'eleccion_a_la_escuela',
            );
            await cerrarPregunta(fila.id, 'no se entendió la elección; va al inbox', 'failed');
            return true;
        }
        await supabase.from('whatsapp_inbound_queue')
            .update({ retries: fila.retries + 1 })
            .eq('id', fila.id);
        // Nunca la misma lista otra vez: otro texto, y los botones.
        await responder(mensajeReintento(opciones, fila.retries), 'ask_cual_pago_reintento',
            botonesDeCobros(opciones));
        return true;
    }

    // ── Eligió ───────────────────────────────────────────────────────────────
    //
    // Un comprobante se estampa en UN pago: `uq_payments_school_ocr_reference`
    // impide vincular la misma operación bancaria a dos cobros, y es la defensa
    // contra reusar el mismo soporte. Así que aunque diga «los dos», la plata se
    // aplica al MÁS ANTIGUO —la regla de la escuela— y el resto se le nombra.
    //
    // `pregunta_opciones` viene ordenada del más viejo al más nuevo.
    const orden = new Map(opciones.map((p, i) => [p.id, i]));
    const elegidos = [...eleccion.pagos].sort(
        (a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0),
    );
    const pago = elegidos[0];
    const restantes = loQueQueda(opciones, [pago]);

    // Dijo «los dos» y solo se puede aplicar a uno: hay que decírselo ANTES de
    // aplicarlo, o va a leer «apliqué a X» creyendo que cubrimos los dos.
    if (elegidos.length > 1) {
        await responder(
            'Un comprobante solo lo puedo aplicar a un cobro, así que lo apliqué al más ' +
            `antiguo: *${describirPago(pago)}*.\n\n` +
            'Si tu transferencia cubría más de uno, escríbele a la escuela y ellos lo reparten.',
            'eleccion_multiple',
        );
    }

    await aplicarComprobante({
        queueId: fila.id,
        schoolId: fila.school_id,
        parentId: guardado.parentId,
        storagePath: guardado.storagePath,
        sha: guardado.sha,
        ocr: guardado.ocr,
        responder,
        // La respuesta del acudiente no se reintenta sola: no hay worker
        // mirándola. Si el estampado falla, se le dice y va al inbox.
        alFallar: async (motivo) => {
            await responder(
                'Tuve un problema al registrar tu pago. Ya le avisé a la escuela para que ' +
                'lo apliquen a mano — tu comprobante está guardado. 🙏',
                'aplicacion_fallo',
            );
            await cerrarPregunta(fila.id, motivo, 'failed');
        },
    }, pago, restantes);

    // Eligió, pero dijo que algo que figura pendiente ya lo pagó («agosto ya lo
    // pagué»): el comprobante se aplicó a lo que eligió, y la escuela tiene que
    // revisar ese otro cobro. Sin otro mensaje a la familia.
    const dichos = [...new Set([...yaDichos, ...(eleccion.dicePagado ?? []).map(etiquetaDeCobro)])];
    if (dichos.length && pasarALaEscuela) {
        const nota = `La familia dice que ${dichos.join(' y ')} ya ${dichos.length > 1 ? 'están pagados' : 'está pagado'}, ` +
            `pero figura pendiente. El comprobante se aplicó a ${describirPago(pago)}.`;
        await pasarALaEscuela({ resumen: nota, mensajeFamilia: null }).catch(() => undefined);
    }

    return true;
}

/**
 * La pregunta otra vez, solo con lo que sigue en pie. Pura.
 *
 * «Ya había pagado agosto» → «Entendido, agosto no. ¿Entonces a cuál…?» con
 * las dos que quedan; nunca la lista completa repetida.
 */
export function mensajeAcotado(
    quedan: PagoPendiente[],
    dicePagado: PagoPendiente[],
    antes: PagoPendiente[],
    motivo: 'descarte' | 'ambiguo',
): string {
    const fuera = antes.filter((p) => !quedan.includes(p));
    const lineas = quedan.map((p, i) => `${i + 1}. ${describirPago(p)}`).join('\n');
    const nombres = [...new Set(fuera.map(etiquetaDeCobro))].join(' y ');
    const cabeza = motivo === 'ambiguo'
        ? 'Hay más de un cobro de ese mes. ¿A cuál de estos aplico el comprobante?'
        : dicePagado.length
            ? `Entendido, *${nombres}* no. Le aviso a la escuela que ya lo pagaste para que lo revise. ` +
              '¿Entonces a cuál de estos aplico el comprobante?'
            : `Entendido, *${nombres}* no. ¿Entonces a cuál de estos aplico el comprobante?`;
    return `${cabeza}\n\n${lineas}\n\nToca el botón o respóndeme con el número.`;
}

/**
 * La repregunta cuando no se entendió. Distinta de la pregunta original y
 * distinta entre un intento y el siguiente: repetir el mismo texto le dice a
 * la familia que nadie la está leyendo. Pura.
 */
export function mensajeReintento(opciones: PagoPendiente[], intento: number): string {
    const lineas = opciones.map((p, i) => `${i + 1}. ${describirPago(p)}`).join('\n');
    const cabeza = intento <= 0
        ? 'Perdón, no te entendí a cuál cobro va el comprobante 🙏'
        : 'Sigo sin tener claro a cuál cobro va. Para no aplicarlo al que no es:';
    const pie = intento <= 0
        ? 'Toca el botón del cobro, o escríbeme el número o el mes (por ejemplo «el de ' +
          `${etiquetaDeCobro(opciones[opciones.length - 1])}»).`
        : 'Toca uno de los botones. Si no es ninguno, escribe *ninguno*.';
    return `${cabeza}\n\n${lineas}\n\n${pie}`;
}

async function cerrarPregunta(
    id: string,
    motivo: string,
    status: 'ignored' | 'failed' = 'ignored',
) {
    await supabase.from('whatsapp_inbound_queue')
        .update({
            status,
            processed_at: new Date().toISOString(),
            error_message: motivo,
        })
        .eq('id', id);
}
