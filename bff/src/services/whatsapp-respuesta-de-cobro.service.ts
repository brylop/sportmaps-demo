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
import { interpretarEleccion, loQueQueda } from './whatsapp-eleccion-de-pago.service';
import { describirPago, mensajeElegirPago, type PagoPendiente } from './whatsapp-receipt-matching.service';
import type { WhatsAppIntegration } from './whatsapp.service';

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

interface FilaEsperando {
    id: string;
    pregunta_opciones: PagoPendiente[] | null;
    pregunta_ocr: {
        ocr: any;
        sha: string;
        storagePath: string | null;
        parentId: string;
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
    responder: (texto: string, paso: string) => Promise<unknown>,
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

    const eleccion = interpretarEleccion(texto, opciones);

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
        await responder(mensajeElegirPago(opciones), 'ask_cual_pago_reintento');
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

    return true;
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
