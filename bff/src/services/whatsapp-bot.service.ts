/**
 * whatsapp-bot.service — Orquestador del bot de WhatsApp (WA2).
 *
 * Flujo por cada mensaje entrante ya guardado (llamado desde el webhook):
 *
 *  1. IDENTIFICACIÓN (determinista, sin LLM — más seguro, decisión #4 / R17):
 *     - Si la conversación NO está identificada:
 *         · el mensaje parece email  → arranca OTP (envía código al correo)
 *         · el mensaje parece código  → verifica OTP → vincula parent_id
 *         · si no                    → pide el email registrado
 *     - Sin identificar, el bot NO consulta datos sensibles.
 *
 *  2. CONSENTIMIENTO (opt-in explícito, una sola vez, tras identificarse):
 *     - Escribir NO es consentir: abrir la ventana de 24h y aceptar plantillas
 *       son permisos distintos (política de Meta). Solo un sí afirmativo estampa
 *       el opt-in, con el wa_message_id de ESA confirmación como prueba.
 *     - STOP lo registra la ingesta; ACTIVAR lo revierte.
 *
 *  3. INTENTS (con Gemini + tool-calling), solo si está identificada:
 *     - get_payment_status → wa_get_payment_status (pagos de ESTA escuela)
 *     - escalate_to_human  → marca la conversación para atención humana
 *     - El LLM decide la tool; el BFF la ejecuta; el LLM redacta con el resultado.
 *
 *  4. ENTREGA según modo (whatsapp_settings.mode):
 *     - assisted → crea draft (NO envía; el admin aprueba)
 *     - auto     → envía por Graph API + registra outbound
 *
 * Cero respuestas sin tool exitoso (decisión #6): si una tool falla, el bot
 * responde neutro y escala; jamás inventa datos de menores.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { chatWithTools, type LlmTool, type LlmMessage } from './llm.service';
import {
    sendTextMessage, sendInteractiveButtons, aFormatoWhatsApp, markAsRead,
    type WhatsAppIntegration, type BotonInteractivo,
} from './whatsapp.service';
import { esSalienteAutomatico } from './whatsapp-buzon';
import { avisarEscalamientoPorCorreo } from './avisos-correo.service';
import { estaDadoDeBaja, AVISO_DADO_DE_BAJA } from './whatsapp-optin.service';
import { estadoDeHorario, mensajeDeEscalamiento } from './whatsapp-horario.service';
import { sendToUser } from './push.service';
import { mediosDePago } from './whatsapp-medios-de-pago.service';
import { infoDeEscuela, fallbackInfoEscuela } from './whatsapp-info-escuela.service';
import { resolverRespuestaDeCobro } from './whatsapp-respuesta-de-cobro.service';
import {
    botEncendido, debeAtender, temaEscolar, preguntaPrecioComoProspecto,
} from './whatsapp-atencion.service';
import { conMarca, sufijoMarcaEscuela } from '../utils/tenantLink';
import { atenderTurnoFactura, enlaceFormularioFactura } from './whatsapp-factura.service';
import { celular10, type DuenoFactura } from './factura-pagador.service';
import {
    atenderTurnoCortesia, iniciarCortesia, pideClaseDeCortesia, franjasDeSupabase, filtrarVigentes,
    FLUJO_CORTESIA, type CtxCortesia,
} from './whatsapp-clase-cortesia.service';

const OTP_TTL_MIN = 10;

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function runBotTurn(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    inboundText: string | null,
    waMessageId: string,
    optedOut = false,
    botonId: string | null = null,
): Promise<void> {
    const text = (inboundText || '').trim();

    // -1. Apagado = apagado. El webhook ya filtra con `debeAtender` antes de
    //     llegar acá; esto es la defensa para cualquier otro que llame a
    //     `runBotTurn` directo. Va ANTES de todo porque lo caro no es lo que se
    //     envía sino el modelo: el 2026-10-03, con `ai_enabled=false`, Dynasty
    //     corrió el LLM en cada mensaje y juntó 316 borradores que nadie pidió.
    //     `deliver` también se niega, pero para entonces el modelo ya se pagó.
    if (!(await botEncendido(integration.id))) {
        console.info('[whatsapp-bot] bot apagado: runBotTurn no hace nada', { conversationId });
        return;
    }

    // 0. Pidió la baja (la ingesta ya la registró) → confirmar y parar.
    //    A quien pide que no le escriban no se le sigue preguntando nada.
    if (optedOut) {
        await deliver(integration, conversationId, contactWaId,
            'Listo, no volverás a recibir mensajes automáticos de la escuela por este medio. ' +
            'Si cambias de opinión, escríbeme *ACTIVAR* y los reactivo. 👋',
            { step: 'opt_out_confirmado' });
        return;
    }

    // Cargar estado de la conversación.
    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, parent_id, identified')
        .eq('id', conversationId)
        .maybeSingle();

    if (!conv) return;

    // 1. No identificado → flujo OTP determinista.
    if (!conv.identified) {
        await handleIdentification(integration, conversationId, contactWaId, text, botonId);
        return;
    }

    // 1b. Ya identificada: verificar que el vinculo siga siendo el correcto.
    //
    //     Una identificacion vieja NO caduca. Encontrado el 2026-09-16 en la
    //     prueba: la conversacion seguia vinculada a la persona que verifico
    //     por correo el 12 de septiembre, aunque el numero hoy sea de otra.
    //     Quien escribiera desde ese telefono veria los pagos de la primera.
    //
    //     Es el caso del numero que cambia de dueno —linea reciclada, celular
    //     que pasa de un papa a otro, el telefono familiar que queda con el
    //     hijo mayor— y no es raro: las companias reasignan numeros a los
    //     pocos meses.
    //
    //     El numero manda sobre el vinculo guardado: el `from` de WhatsApp lo
    //     autentica Meta en CADA mensaje, mientras que el vinculo viejo es una
    //     afirmacion de hace semanas que nadie volvio a comprobar.
    const revision = await revisarVinculoPorTelefono(
        integration, conversationId, contactWaId, conv.parent_id);
    if (revision === 'corto') return;
    if (revision !== 'sin_cambio') conv.parent_id = revision;

    // 1c. Clase de cortesía EN CURSO (flujo abierto, botón del flujo o
    //     «cancelar mi clase» con reserva). Va ANTES del consentimiento: con el
    //     resumen en pantalla, el «sí» del papá es «confirmo la reserva», y
    //     `handleConsent` lo estaría leyendo como «acepto recordatorios».
    if (await atenderCortesiaEnBot(integration, conversationId, contactWaId, text, botonId,
        conv.parent_id, { iniciar: false })) {
        return;
    }

    // 2. Consentimiento: se pide UNA vez, después de identificarse.
    //    Si este turno lo resolvió (preguntó, o registró el sí/no), termina acá.
    if (await handleConsent(integration, conversationId, contactWaId, conv.parent_id, text, waMessageId, botonId)) {
        return;
    }

    // 2.3. Factura electrónica: flujo determinista (sin modelo) que pide los
    //      datos uno por uno. Va ANTES de los botones porque, con un flujo
    //      abierto, «CC» o un número de cédula son la respuesta a la pregunta
    //      que se le hizo; el módulo suelta el turno (false) si no es suyo.
    if (conv.parent_id && await atenderFacturaEnBot(
        integration, conversationId, contactWaId,
        { tipo: 'perfil', profileId: conv.parent_id }, true, text, botonId)) {
        return;
    }

    // 2.35. «Clase de cortesía tienen», «¿puedo ir a probar?»: flujo
    //       determinista sin pasar por el modelo. El 2026-10-06 el modelo le
    //       contestó a una familia de Dynasty «no tengo esa información». La
    //       regla solo mira el texto (gratis); si no dispara, el modelo aún
    //       puede llegar por la tool `get_trial_class_info`.
    if (pideClaseDeCortesia(text) && await atenderCortesiaEnBot(
        integration, conversationId, contactWaId, text, botonId, conv.parent_id)) {
        return;
    }

    // 2.4. ¿Tocó un botón (o escribió su título tal cual)? Acción determinista,
    //      SIN modelo. Va antes de la pregunta de comprobante: tocar un botón es
    //      una elección explícita, y leerlo como respuesta a «¿cuál de los dos
    //      pagos?» sería no escucharla.
    const accion = accionDeBoton(botonId, text);
    if (accion) {
        await ejecutarAccionDeBoton(integration, conversationId, contactWaId, conv.parent_id, accion);
        return;
    }

    // 2.5. ¿Hay una pregunta de comprobante abierta? Va ANTES del LLM.
    //
    //      «2», «los dos», «el de Sharik» o «al pendiente» solo significan algo
    //      contra las opciones que se le ofrecieron; para el modelo son ruido y
    //      terminaba contestando cualquier cosa mientras el comprobante seguia
    //      colgado en 'waiting_user'.
    const respondio = await resolverRespuestaDeCobro(
        integration, contactWaId, text,
        (texto, paso) => deliver(integration, conversationId, contactWaId, texto, { step: paso }),
    );
    if (respondio) return;

    // 3. Identificado → intents con LLM.
    await handleIntent(integration, conversationId, contactWaId, conv.parent_id, text, waMessageId);
}

// ─── Botones de respuesta rápida ─────────────────────────────────────────────
//
// Los ids son el contrato con el webhook: Meta devuelve el id del botón que se
// tocó (`interactive.button_reply.id`). Se decide con el id y no con el título
// porque el título es texto para personas y se puede reescribir mañana.
//
// Un botón NO pasa por el modelo. Quien toca «Ver mis pagos» ya dijo qué
// quiere; pagar una llamada al LLM para que lo adivine es plata y latencia
// tirada, y una puerta más para que conteste otra cosa.

export const BOTON = {
    VER_PAGOS: 'sm_ver_pagos',
    COMO_PAGAR: 'sm_como_pagar',
    HABLAR_CON_ESCUELA: 'sm_hablar_escuela',
    CONSENTIR_SI: 'sm_consentir_si',
    CONSENTIR_NO: 'sm_consentir_no',
} as const;

/** Tras «eso no lo tengo a la mano»: las tres cosas que SÍ sabe hacer. */
export const BOTONES_SIN_DATO: BotonInteractivo[] = [
    { id: BOTON.VER_PAGOS, title: 'Ver mis pagos' },
    { id: BOTON.COMO_PAGAR, title: 'Cómo pagar' },
    // «Hablar con la escuela» tiene 21 caracteres y Meta corta en 20: el
    // título se recortaría a «Hablar con la escuel». Va «Hablar con alguien».
    { id: BOTON.HABLAR_CON_ESCUELA, title: 'Hablar con alguien' },
];
const SIN_DATO_EN_TEXTO =
    'Puedes escribirme *Ver mis pagos*, *Cómo pagar* o *Hablar con alguien*.';

export const BOTONES_CONSENTIMIENTO: BotonInteractivo[] = [
    { id: BOTON.CONSENTIR_SI, title: 'Sí, acepto' },
    { id: BOTON.CONSENTIR_NO, title: 'No, gracias' },
];

export type AccionDeBoton = 'get_payment_status' | 'get_payment_methods' | 'escalate';

const ACCION_POR_BOTON: Record<string, AccionDeBoton> = {
    [BOTON.VER_PAGOS]: 'get_payment_status',
    [BOTON.COMO_PAGAR]: 'get_payment_methods',
    [BOTON.HABLAR_CON_ESCUELA]: 'escalate',
};

/**
 * ¿Este turno es un botón de acción? Por id, o por el TÍTULO escrito tal cual.
 *
 * Lo segundo es por el modo asistido: el buzón aprueba el borrador como texto
 * (`sendTextMessage` en whatsapp-admin.routes), así que la familia no ve
 * botones sino «Puedes escribirme *Ver mis pagos*…». Si lo escribe, tiene que
 * pasar lo mismo que si lo hubiera tocado. Comparación contra el mensaje
 * COMPLETO, nunca por subcadena: «no quiero ver mis pagos todavía» no es un
 * botón.
 */
export function accionDeBoton(botonId: string | null | undefined, texto: string): AccionDeBoton | null {
    if (botonId && ACCION_POR_BOTON[botonId]) return ACCION_POR_BOTON[botonId];
    const norm = normalizar(texto || '');
    if (!norm) return null;
    const porTitulo = BOTONES_SIN_DATO.find((b) => normalizar(b.title) === norm);
    if (porTitulo) return ACCION_POR_BOTON[porTitulo.id];
    return norm === 'hablar con la escuela' ? 'escalate' : null;
}

async function ejecutarAccionDeBoton(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
    accion: AccionDeBoton,
): Promise<void> {
    if (accion === 'escalate') {
        await escalate(integration, conversationId, contactWaId, 'boton_hablar_con_la_escuela');
        return;
    }

    if (accion === 'get_payment_methods') {
        const medios = await mediosDePago(integration.school_id);
        await deliver(integration, conversationId, contactWaId,
            fallbackMediosDePago(medios), { step: 'get_payment_methods', via: 'boton' });
        return;
    }

    // get_payment_status. Mismo contrato que con el modelo: si la consulta
    // falla no se inventa nada, se escala.
    const { data: payments, error } = await supabase.rpc('wa_get_payment_status', {
        p_parent_id: parentId,
        p_school_id: integration.school_id,
    });
    if (error) {
        console.error('[whatsapp-bot] wa_get_payment_status error (boton):', error);
        await escalate(integration, conversationId, contactWaId, 'tool_error');
        return;
    }
    await deliver(integration, conversationId, contactWaId,
        fallbackPaymentText(payments), { step: 'get_payment_status', via: 'boton', tool_result: payments });
}

/**
 * ¿La respuesta del modelo es un «no lo tengo»? Es lo que el prompt le pide
 * decir ante lo que no sabe. Ahí la conversación se muere si no se le ofrece
 * a dónde ir, y los botones le muestran las tres cosas que sí se pueden hacer.
 */
const NO_LO_TENGO = /\bno (lo|la|los|las) tengo a la mano\b|\bno tengo (ese|esa|esos|esas|el|la) (dato|datos|informacion)\b/;
export function respondioQueNoLoTiene(texto: string | null | undefined): boolean {
    return NO_LO_TENGO.test(normalizar(texto || ''));
}

// ─── Memoria: los últimos mensajes de la conversación ────────────────────────
//
// Hasta el 2026-10-04 el modelo veía SOLO el mensaje actual. «¿Y el de mi otra
// hija?», «sí, ese», «¿y a qué cuenta?» llegaban sin nada atrás y el bot
// contestaba otra cosa o preguntaba de nuevo lo que ya le habían dicho.
//
// Lo que entra:
//   - los últimos HISTORIAL_MAX_MENSAJES de las últimas 24 h (la misma ventana
//     de servicio de Meta: pasada, la conversación ya es otra);
//   - entrantes como `user`, salientes del bot como `assistant`;
//   - lo que la escuela escribió desde su celular (echo de Coexistence, o una
//     respuesta del buzón: `ai_generated=false`) como `assistant` con el prefijo
//     «(la escuela escribió)». Se INCLUYE: si la dueña ya le contestó «el
//     sábado no hay entreno», el bot no puede ofrecer otra cosa ni volver a
//     preguntar lo que ella ya resolvió. El prefijo es para que el modelo no lo
//     tome como dicho por él (no puede firmar ni hacerse pasar por ella) y el
//     SYSTEM_PROMPT dice qué hacer con eso;
//   - NO entran los automáticos de la app (`payload.automatico`: saludo y
//     ausencia de WhatsApp Business): son la misma frase a todo el mundo y
//     confunden al modelo, que cree que ya saludó o que la escuela está cerrada.
//
// Cada texto se recorta: un mensaje con la lista de cuentas o un estado de
// pagos largo se come los tokens y no aporta más que su comienzo.

export const HISTORIAL_MAX_MENSAJES = 8;
const HISTORIAL_VENTANA_HORAS = 24;
export const HISTORIAL_MAX_CARACTERES = 400;
export const PREFIJO_ESCUELA = '(la escuela escribió) ';

const TIPOS_CON_ARCHIVO: Record<string, string> = {
    image: '[envió una imagen]',
    document: '[envió un documento]',
    audio: '[envió una nota de voz]',
    video: '[envió un video]',
};

export interface FilaDeHistorial {
    wa_message_id?: string | null;
    direction: string;
    type?: string | null;
    text_body?: string | null;
    payload?: any;
    ai_generated?: boolean | null;
    wa_timestamp?: string | null;
    created_at?: string | null;
}

function recortar(t: string): string {
    const limpio = t.trim();
    return limpio.length > HISTORIAL_MAX_CARACTERES
        ? limpio.slice(0, HISTORIAL_MAX_CARACTERES).trimEnd() + '…'
        : limpio;
}

/**
 * Filas de `whatsapp_messages` (en cualquier orden) → turnos para el modelo,
 * del más viejo al más nuevo. Pura, para probarla sin base.
 */
export function historialDesdeFilas(
    filas: FilaDeHistorial[],
    excluirWaMessageId: string | null,
    ahora = Date.now(),
): LlmMessage[] {
    const desde = ahora - HISTORIAL_VENTANA_HORAS * 3600_000;
    const momento = (f: FilaDeHistorial) =>
        new Date(f.wa_timestamp || f.created_at || 0).getTime();

    const turnos: { t: number; m: LlmMessage }[] = [];
    for (const f of filas) {
        if (excluirWaMessageId && f.wa_message_id === excluirWaMessageId) continue;
        // El historial que Meta sincroniza al conectar llega con `created_at` de
        // hoy pero `wa_timestamp` de hace meses: manda la fecha del mensaje.
        const t = momento(f);
        if (!t || t < desde) continue;

        const texto = f.text_body?.trim()
            || (f.type ? TIPOS_CON_ARCHIVO[f.type] : undefined)
            || '';
        if (!texto) continue;   // stickers, reacciones, ubicaciones: nada que leer

        if (f.direction === 'inbound') {
            turnos.push({ t, m: { role: 'user', content: recortar(texto) } });
        } else if (f.direction === 'outbound') {
            if (esSalienteAutomatico(f)) continue;
            const escuela = f.ai_generated === false;
            turnos.push({ t, m: {
                role: 'assistant',
                content: (escuela ? PREFIJO_ESCUELA : '') + recortar(texto),
            } });
        }
    }
    turnos.sort((a, b) => a.t - b.t);
    return turnos.slice(-HISTORIAL_MAX_MENSAJES).map((x) => x.m);
}

/**
 * Historial + mensaje actual, en una forma que aceptan los tres proveedores.
 *
 * Gemini exige que los turnos alternen user/model y que el primero sea del
 * usuario: dos `user` seguidos (el papá manda «hola», «una pregunta», «cuánto
 * debo» en tres mensajes) es un 400. Así que:
 *   - los consecutivos del mismo rol se FUSIONAN en uno (separados por salto
 *     de línea), y
 *   - se descartan los `assistant` del principio (la ventana cortó justo
 *     después de un mensaje del papá).
 * Groq (OpenAI-compatible) acepta cualquier orden, así que lo mismo le sirve.
 */
export function armarTurnos(historial: LlmMessage[], textoActual: string): LlmMessage[] {
    const todos: LlmMessage[] = [...historial, { role: 'user', content: textoActual }];
    const out: LlmMessage[] = [];
    for (const m of todos) {
        if (m.role === 'tool') continue;
        if (!out.length && m.role !== 'user') continue;
        const ultimo = out[out.length - 1];
        if (ultimo && ultimo.role === m.role) {
            ultimo.content = `${ultimo.content}\n${m.content}`;
        } else {
            out.push({ role: m.role, content: m.content });
        }
    }
    return out;
}

/** Lee el historial. Nunca lanza: sin historial, el bot sigue como antes. */
async function historialDeConversacion(
    conversationId: string,
    excluirWaMessageId: string | null,
): Promise<LlmMessage[]> {
    try {
        const desde = new Date(Date.now() - HISTORIAL_VENTANA_HORAS * 3600_000).toISOString();
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('wa_message_id, direction, type, text_body, payload, ai_generated, wa_timestamp, created_at')
            .eq('conversation_id', conversationId)
            .gte('created_at', desde)
            .order('created_at', { ascending: false })
            // Holgura sobre el máximo: el actual, los automáticos y los
            // stickers se descartan después.
            .limit(HISTORIAL_MAX_MENSAJES + 8);
        if (error || !Array.isArray(data)) return [];
        return historialDesdeFilas(data as FilaDeHistorial[], excluirWaMessageId);
    } catch {
        return [];
    }
}

// ─── 1. Identificación (OTP por email) ────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

/**
 * Identificacion por el NUMERO desde el que escribe. Va antes que el correo.
 *
 * Medido en Dynasty el 2026-09-16: de 502 atletas activos, 156 no tienen
 * ninguna cuenta de acudiente. Para esas familias el camino del correo NO
 * EXISTE — escriben un correo que no esta en la base, el codigo nunca sale, y
 * el bot igual contesta «te envie un codigo» (a proposito, para no revelar
 * quien esta registrado). La conversacion se muere ahi.
 *
 * Por telefono el 100% es alcanzable: 346 entran directo y 156 quedan
 * reconocidos como familia y se les pide crear la cuenta. Quien no la tenga
 * NO recibe informacion de ningun tipo — ni el nombre del atleta, que seria
 * decirle a quien hoy tenga ese numero de quien es familia.
 *
 * Devuelve true si resolvio el turno.
 */
/**
 * ¿El telefono sigue apuntando al mismo acudiente al que quedo vinculada la
 * conversacion?
 *
 * Devuelve el parent_id vigente, 'sin_cambio' si no hay nada que hacer, o
 * 'corto' si el turno ya quedo resuelto y quien llama debe parar.
 *
 * Solo actua cuando el telefono dice algo DISTINTO y confiable. Si el numero
 * no resuelve a nadie —un acudiente que se identifico por correo desde el
 * celular de un vecino, o cuyo telefono nunca se cargo en la ficha— NO se le
 * quita el acceso: seria romperle el canal a quien lo tenia bien.
 */
async function revisarVinculoPorTelefono(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentActual: string | null,
): Promise<string | 'sin_cambio' | 'corto'> {
    const { data, error } = await supabase.rpc('wa_identify_by_phone', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
    });
    if (error) return 'sin_cambio';

    const estado = (data as any)?.estado;
    const porTelefono = (data as any)?.parent_id as string | undefined;

    // El telefono confirma lo que ya teniamos, o no sabe: nada que hacer.
    if (estado !== 'identificado' || !porTelefono) return 'sin_cambio';
    if (porTelefono === parentActual) return 'sin_cambio';

    // Dice otra cosa. La RPC ya reescribio el vinculo; solo queda avisar, para
    // que el nuevo dueno del numero entienda por que el bot le habla distinto.
    console.warn('[whatsapp-bot] el telefono apunta a otro acudiente; se revinculo',
        { conversationId, antes: parentActual, ahora: porTelefono });

    await deliver(integration, conversationId, contactWaId,
        'Actualicé tus datos: este número quedó asociado a tu cuenta. 👍',
        { step: 'revinculado_por_telefono' });

    return porTelefono;
}

/**
 * Turno de factura electrónica (whatsapp-factura.service). Solo lo llaman los
 * dos caminos de FAMILIA: conversación identificada (dueño = su perfil) y
 * acudiente sin cuenta reconocido por el número (dueño = escuela + celular).
 */
async function atenderFacturaEnBot(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    dueno: DuenoFactura,
    conCuenta: boolean,
    text: string,
    botonId: string | null,
): Promise<boolean> {
    try {
        return await atenderTurnoFactura({
            conversationId,
            schoolId: integration.school_id,
            dueno,
            conCuenta,
            enviar: (texto, paso, botones) => deliver(integration, conversationId, contactWaId, texto,
                { step: paso, flujo: 'factura_electronica' },
                botones ? {
                    botones,
                    // Modo asistido: el buzón aprueba como texto y los botones
                    // no llegan. El flujo acepta el título escrito tal cual.
                    enTexto: `Responde ${botones.map((b) => `*${b.title}*`).join(' o ')}.`,
                } : undefined),
            enlaceFormulario: () => enlaceFormularioFactura(dueno, integration.school_id),
        }, text, botonId);
    } catch (e: any) {
        // Que una falla de este módulo no deje a la familia sin respuesta: se
        // suelta el turno y lo atiende el bot normal.
        console.warn('[whatsapp-bot] flujo de factura falló', { conversationId, err: e?.message });
        return false;
    }
}

/**
 * Contexto del flujo de clase de cortesía (whatsapp-clase-cortesia.service).
 *
 * El estado del paso a paso viaja en el payload de cada saliente
 * (`flujo`/`paso_cortesia`/`datos_cortesia`): la tabla de flujos de factura
 * no está aplicada y su CHECK solo admite ese flujo. Un mensaje terminal no
 * lleva `flujo` y con eso el flujo queda cerrado.
 */
function ctxCortesia(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
): CtxCortesia {
    return {
        conversationId,
        schoolId: integration.school_id,
        contactWaId,
        enviar: (texto, step, estado, botones, enTexto) => deliver(integration, conversationId, contactWaId, texto,
            estado
                ? { step, flujo: FLUJO_CORTESIA, paso_cortesia: estado.paso, datos_cortesia: estado.datos }
                : { step },
            botones?.length ? { botones, enTexto } : undefined),
        // Familia con cuenta: el acudiente es quien escribe; no se le pregunta
        // su propio nombre.
        nombreAcudiente: parentId
            ? async () => {
                const { data } = await supabase.from('profiles').select('full_name').eq('id', parentId).maybeSingle();
                return ((data as any)?.full_name as string | undefined)?.trim() || null;
            }
            : undefined,
    };
}

/** Turno de clase de cortesía. Nunca lanza: si falla, lo atiende el bot normal. */
async function atenderCortesiaEnBot(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    text: string,
    botonId: string | null,
    parentId: string | null,
    opciones: { iniciar?: boolean } = {},
): Promise<boolean> {
    try {
        return await atenderTurnoCortesia(
            ctxCortesia(integration, conversationId, contactWaId, parentId), text, botonId, opciones);
    } catch (e: any) {
        console.warn('[whatsapp-bot] flujo de clase de cortesía falló', { conversationId, err: e?.message });
        return false;
    }
}

/**
 * ¿Ya salió (o quedó en borrador) este paso en las últimas `horas`? Cuenta
 * borradores por lo mismo que `yaSePreguntoConsentimiento`: en modo asistido
 * cada mensaje dejaría un borrador nuevo pidiendo lo mismo.
 */
async function pasoReciente(conversationId: string, step: string, horas: number): Promise<boolean> {
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
    const { count: enviados } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .eq('payload->>step', step)
        .gte('created_at', desde);
    if ((enviados ?? 0) > 0) return true;
    const { count: borradores } = await supabase
        .from('whatsapp_message_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('tool_context->>step', step)
        .gte('created_at', desde);
    return (borradores ?? 0) > 0;
}

async function identificarPorTelefono(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    text = '',
    botonId: string | null = null,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('wa_identify_by_phone', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
    });
    if (error) {
        console.warn('[whatsapp-bot] wa_identify_by_phone fallo', { err: error.message });
        return false;   // se cae al camino del correo, que sigue existiendo
    }

    const estado = (data as any)?.estado;

    if (estado === 'identificado') {
        // La RPC ya dejo la conversacion vinculada. Se saluda y se pide el
        // consentimiento en el MISMO mensaje, igual que al verificar por OTP:
        // dos «responde SI» seguidos por motivos distintos es una experiencia
        // mala y una fuente de respuestas ambiguas.
        const escuela = await nombreDeEscuela(integration.school_id);
        await deliver(integration, conversationId, contactWaId,
            `¡Hola! Soy el *asistente automático* de ${escuela}. 🤖` + '\n\n' +
            `Te reconocí por tu número, así que no necesitas hacer nada más.` + '\n\n' +
            `¿Quieres que la escuela te envíe por aquí los recordatorios de pago ` +
            'y los avisos de tu atleta? Responde *SÍ* para activarlos — puedes darte ' +
            'de baja cuando quieras escribiendo *STOP*.',
            { step: 'ask_consent', identificado_por: 'telefono' },
            { botones: BOTONES_CONSENTIMIENTO });
        return true;
    }

    if (estado === 'debe_registrarse') {
        // Factura electrónica para la familia SIN cuenta: se guarda por escuela
        // + celular (payer_billing_profiles), así la emisión la alcanza por
        // children.parent_phone_temp. Va antes del aviso de registro porque si
        // está en medio del flujo, su mensaje es la respuesta a una pregunta.
        const tel = celular10(contactWaId);
        if (tel && await atenderFacturaEnBot(integration, conversationId, contactWaId,
            { tipo: 'telefono', schoolId: integration.school_id, phone10: tel }, false, text, botonId)) {
            return true;
        }

        // Clase de cortesía (un hermano, un amigo): no expone datos de nadie —
        // solo franjas públicas y lo que el mismo contacto escribe.
        if (await atenderCortesiaEnBot(integration, conversationId, contactWaId, text, botonId, null)) {
            return true;
        }

        // UNA VEZ POR DIA, no en cada mensaje.
        //
        // Esto corre mientras la conversacion siga sin identificar, que para
        // estas familias es SIEMPRE: sin el freno, cada mensaje que escriban
        // recibe el mismo aviso. Desde el lado del papa eso es spam, y en un
        // canal donde Meta mide la calidad del numero repetir lo mismo es justo
        // lo que penaliza — ya lo vimos el 2026-09-11 con 7 respuestas iguales.
        //
        // Se devuelve true igual cuando se calla: el turno SI esta resuelto.
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: yaAvisado } = await supabase
            .from('whatsapp_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)
            .eq('direction', 'outbound')
            .eq('payload->>step', 'debe_registrarse')
            .gte('created_at', desde);
        if ((yaAvisado ?? 0) > 0) return true;

        // EL ENLACE TIENE QUE SER EL DE LA INVITACION, no `/register?phone=`.
        //
        // El registro normal NO toca `children`: solo `accept_invitation_pro`
        // hace `UPDATE children SET parent_id = auth.uid()`. Sin eso el papa se
        // registra, se crea su perfil con el telefono, `children.parent_id`
        // sigue vacio, vuelve a escribir, `wa_identify_by_phone` exige ser
        // acudiente de un atleta activo, falla — y el bot le dice OTRA VEZ que
        // se registre. Hizo todo bien y el sistema le dice que no hizo nada.
        //
        // Medido el 2026-09-22: 148 de 157 de estas familias en Dynasty YA
        // tienen invitacion pendiente. No hay que crear nada, solo encontrarla.
        const { data: inv } = await supabase.rpc('wa_invitacion_pendiente_por_telefono', {
            p_integration_id: integration.id,
            p_contact_wa_id: contactWaId,
        });

        const invitacion = inv as { invite_id?: string; email?: string } | null;
        let enlace: string;
        if (invitacion?.invite_id) {
            // El correo viaja para que el formulario lo precargue:
            // `accept_invitation_pro` exige que la sesion sea de ESE correo, y
            // si el papa usa otro la aceptacion falla EN SILENCIO despues de
            // que ya lleno todo.
            const correo = invitacion.email ? `&email=${encodeURIComponent(invitacion.email)}` : '';
            enlace = `${FRONTEND_URL}/register?invite=${invitacion.invite_id}${correo}`;
        } else {
            // Sin invitacion (9 de 157 en Dynasty) queda el camino viejo. No
            // vincula solo, pero al menos la escuela lo ve en el buzon y lo
            // resuelve a mano. Crear invitaciones desde el bot es otra decision
            // —quien queda como invited_by, que rol, que plan— y no se toma de
            // contrabando dentro de un fix.
            enlace = `${FRONTEND_URL}/register?phone=${encodeURIComponent(contactWaId)}`;
        }

        await deliver(integration, conversationId, contactWaId,
            'Tu número está registrado en la escuela, pero todavía no tienes tu cuenta creada. 🙌' + '\n\n' +
            `Créala aquí, ya te dejé todo listo: ${enlace}` + '\n\n' +
            'Cuando la tengas, escríbeme por acá y podrás consultar tus pagos, mandar ' +
            'comprobantes y recibir los avisos de tu atleta.',
            { step: 'debe_registrarse', con_invitacion: Boolean(invitacion?.invite_id) });

        // Que quede en el buzon: son familias que hay que empujar a registrarse,
        // y eso lo trabaja la escuela, no el bot.
        await supabase.from('whatsapp_conversations')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        return true;
    }

    if (estado === 'ambiguo') {
        // Dos cuentas con el mismo numero. Elegir mal es mostrarle a alguien
        // los pagos de otra familia: lo resuelve un humano, no el bot.
        await deliver(integration, conversationId, contactWaId,
            'Encontré tu número en más de una cuenta y no quiero mostrarte información ' +
            'que no sea tuya. Ya le avisé a la escuela para que lo revisen contigo. 🙏',
            { step: 'identificacion_ambigua' });
        await escalate(integration, conversationId, contactWaId,
            'Dos cuentas comparten el mismo número de WhatsApp');
        return true;
    }

    return false;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CODE_RE = /\b(\d{6})\b/;

async function handleIdentification(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    text: string,
    botonId: string | null = null,
): Promise<void> {
    // El numero manda. Solo si no resuelve nada se cae al correo, que sigue
    // sirviendo para el acudiente que escribe desde OTRO telefono.
    if (await identificarPorTelefono(integration, conversationId, contactWaId, text, botonId)) return;

    // Desconocido con `responder_desconocidos=true` (los demás desconocidos
    // van por `atenderDesconocido`): si pregunta por la clase de cortesía o
    // está en medio de agendarla, se le atiende antes de pedirle el correo.
    if (await atenderCortesiaEnBot(integration, conversationId, contactWaId, text, botonId, null)) return;

    const emailMatch = text.match(EMAIL_RE);
    const codeMatch = text.match(CODE_RE);

    // (a) Mandó un código de 6 dígitos → verificar.
    if (codeMatch) {
        await verificarCodigo(integration, conversationId, contactWaId, codeMatch[1]);
        return;
    }

    // (b) Mandó un email → arrancar OTP.
    if (emailMatch) {
        await arrancarOtp(integration, conversationId, contactWaId, emailMatch[0]);
        return;
    }

    // (c) Ni email ni código.
    //
    // Antes esto exigia el correo de entrada: «Escríbeme el correo electrónico
    // con el que estás registrado en la escuela». Para un padre que escribe
    // desde otro telefono esta bien. Para quien NO es de la escuela —la mama de
    // la duenia, un proveedor, un numero equivocado— es una maquina pidiendole
    // credenciales, y el numero de la escuela suele ser tambien el personal de
    // quien la dirige.
    //
    // Ahora se presenta y ofrece las dos salidas sin exigir ninguna, y la
    // conversacion escala al buzon para que un humano la vea. Quien sea de la
    // escuela sigue teniendo su camino; quien no, deja de sentirse interrogado.
    //
    // Desde 2026-10-03 a este punto SOLO llega un desconocido cuando la escuela
    // activó `responder_desconocidos`: el webhook calla antes al resto (ver
    // `debeAtender`), y el desconocido con correo o tema escolar va por
    // `atenderDesconocido`, que no pasa por acá. Las familias no pasan por acá
    // —o el teléfono las resuelve arriba, o ya están identificadas por OTP—.
    // Antes de ese filtro este era el camino de 238 de los 316 borradores de
    // Dynasty: «escríbeme tu correo» a la mamá, a proveedores y a amigos de la
    // dueña.
    //
    // UNA VEZ CADA 24 H por conversación, igual que 'debe_registrarse'. Medido
    // el 2026-10-06 08:10–08:11: el mismo contacto recibió este saludo varias
    // veces seguidas, una por cada mensaje que escribió. Repetir lo mismo es
    // spam para quien lo recibe y es lo que Meta penaliza en la calidad del
    // número. Lo que escriba después ya lo ve la escuela en el buzón.
    if (await pasoReciente(conversationId, 'ask_email', 24)) return;

    const nombreEscuela = await nombreDeEscuela(integration.school_id);
    await deliver(integration, conversationId, contactWaId,
        `Hola 👋 Soy el *asistente automático* de *${nombreEscuela}*. 🤖` + '\n\n' +
        'Si eres familia de un atleta y quieres consultar pagos o inscripciones, ' +
        'escríbeme el *correo electrónico* con el que estás registrado y te ayudo enseguida.' + '\n\n' +
        'Si buscas otra cosa, cuéntame y alguien de la escuela te responde.',
        { step: 'ask_email' });

    // Escala, pero SIN el mensaje de escalamiento: `escalate` manda su propio
    // «en breve te contactan» y quedarian dos mensajes seguidos diciendo casi lo
    // mismo. Acá solo se marca para que aparezca en el buzón.
    await abrirEnBuzon(integration, conversationId, contactWaId);
}

/**
 * Deja la conversación 'open' en el buzón y avisa por push SOLO en la
 * transición (si ya estaba abierta, la escuela ya fue avisada).
 */
async function abrirEnBuzon(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    aviso?: AvisoDeEspera,
): Promise<void> {
    const { data: previa } = await supabase.from('whatsapp_conversations')
        .select('status, contact_name').eq('id', conversationId).maybeSingle();
    if ((previa as any)?.status !== 'open') {
        await supabase.from('whatsapp_conversations')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        // El prospecto sin enlace sí avisa por correo: es plata que se va.
        // El «ask_email» del desconocido (sin `aviso`) solo deja push.
        await avisarQueEsperan(integration, conversationId, contactWaId,
            (previa as any)?.contact_name ?? null, aviso,
            aviso?.motivo === 'prospecto' ? 'prospecto' : undefined);
    }
}

/** (a) del flujo OTP: verifica el código y, si pasa, pide el consentimiento. */
async function verificarCodigo(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    codigo: string,
): Promise<void> {
    const otpHash = hashOtp(codigo);
    const { data: res } = await supabase.rpc('wa_verify_otp', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
        p_otp_hash: otpHash,
    });
    const r = res as any;
    if (r?.ok) {
        // La pregunta de consentimiento va PEGADA a la verificación, no en un
        // turno aparte: dos "responde SÍ" seguidos por motivos distintos es
        // una experiencia mala y una fuente de respuestas ambiguas (§5 del
        // spec). El step 'ask_consent' es lo que hace que handleConsent sepa
        // que ya se preguntó y se limite a leer la respuesta.
        const escuela = await nombreDeEscuela(integration.school_id);
        await deliver(integration, conversationId, contactWaId,
            '✅ ¡Listo! Tu identidad quedó verificada. Te atiende el asistente automático de la escuela. 🤖\n\n' +
            `¿Quieres que *${escuela}* te envíe por aquí los recordatorios de pago y los avisos de tu atleta? ` +
            'Responde *SÍ* para activarlos — puedes darte de baja cuando quieras escribiendo *STOP*.',
            { step: 'ask_consent', otp_verified: true },
            { botones: BOTONES_CONSENTIMIENTO });
    } else {
        const reason = r?.reason;
        const msg = reason === 'expired'
            ? 'Ese código expiró. Escríbeme de nuevo tu email registrado y te envío uno nuevo.'
            : reason === 'too_many_attempts'
            ? 'Demasiados intentos. Escríbeme tu email registrado para reiniciar la verificación.'
            : reason === 'wrong_code'
            ? `Ese código no coincide. Te quedan ${r?.attempts_left ?? 0} intentos.`
            : 'No tengo una verificación pendiente. Escríbeme tu email registrado para empezar.';
        await deliver(integration, conversationId, contactWaId, msg, { step: 'otp_failed', reason });
    }
}

/**
 * (b) del flujo OTP: genera el código, lo manda al correo SOLO si el correo es
 * de un usuario real, y responde igual en ambos casos (no permite enumerar
 * quién está registrado).
 */
async function arrancarOtp(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    correo: string,
): Promise<void> {
    const email = correo.toLowerCase();
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const otpHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

    const { data: res } = await supabase.rpc('wa_start_identification', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
        p_email: email,
        p_otp_hash: otpHash,
        p_expires_at: expiresAt,
    });

    if ((res as any)?.email_matches_parent) {
        await emailClient.send({
            to: email,
            subject: 'Tu código de verificación de SportMaps',
            html: `<p>Tu código de verificación es:</p>
                   <h2 style="letter-spacing:3px">${code}</h2>
                   <p>Vence en ${OTP_TTL_MIN} minutos. Si no lo solicitaste, ignora este correo.</p>`,
            text: `Tu código de verificación de SportMaps es ${code} (vence en ${OTP_TTL_MIN} min).`,
        });
    }

    await deliver(integration, conversationId, contactWaId,
        `Te envié un código de 6 dígitos al correo *${maskEmail(email)}*. Escríbemelo aquí para verificar tu identidad. 🔒`,
        { step: 'otp_sent' });
}

// ─── 1c. El desconocido que es de la escuela (opción «1C») ───────────────────
//
// Con el bot prendido y `responder_desconocidos=false`, el webhook calla a todo
// número que no es familia (`debeAtender`). Medido en Dynasty el 2026-10-03: de
// 55 conversaciones 25 no eran familias —amigos, proveedores, la mamá de la
// dueña—, y callarse con ellas es lo correcto. Pero en esas 25 también estaban:
//
//   - familias escribiendo desde OTRO número, que antes se verificaban
//     mandando el correo (OTP) y con el filtro quedaron sin camino, y
//   - prospectos: «Quiero inscribir a mi hija a volleyball», «Me puedes
//     compartir más información (Horarios, cursos, lugar de práctica, valor)».
//
// Esta es la única puerta del desconocido, y es angosta a propósito:
//   1. trae un correo, o un código con un OTP VIGENTE → flujo OTP de siempre;
//   2. es de tema escolar (`temaEscolar`, reglas sin LLM) → UNA respuesta cada
//      30 días por conversación;
//   3. todo lo demás → silencio.
//
// NUNCA se llama al modelo desde acá. El desconocido es, en su mayoría, la
// vida privada de quien dirige la escuela: lo que se le diga tiene que salir de
// una plantilla que alguien leyó, no de una redacción del momento.

/** step del saliente que cuenta para el freno de 30 días. */
export const PASO_DESCONOCIDO_ESCOLAR = 'desconocido_tema_escolar';
const FRENO_DESCONOCIDO_DIAS = 30;

export type ResultadoDesconocido =
    | 'otp_codigo' | 'otp_correo' | 'inscripcion' | 'inscripcion_sin_enlace' | 'pagos'
    | 'pagos_y_precio' | 'pagos_y_precio_sin_enlace'
    | 'clase_cortesia' | 'clase_cortesia_en_curso'
    | 'frenado' | 'silencio';

export async function atenderDesconocido(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    inboundText: string | null,
    botonId: string | null = null,
): Promise<ResultadoDesconocido> {
    // Misma defensa que `runBotTurn`: si alguien llama directo con el bot
    // apagado, no se habla.
    if (!(await botEncendido(integration.id))) return 'silencio';

    const text = (inboundText || '').trim();
    if (!text && !botonId) return 'silencio';

    // 0. Clase de cortesía EN CURSO: «Juan Pérez», «12», «Confirmar» no son
    //    tema escolar y sin esto el filtro de abajo los callaría a mitad de
    //    la reserva. Solo continúa lo que el propio bot ya abrió (o un botón
    //    suyo, o «cancelar mi clase» con reserva de ESE número); empezar algo
    //    nuevo pasa por el filtro de tema y el freno de 30 días.
    if (await atenderCortesiaEnBot(integration, conversationId, contactWaId, text, botonId, null,
        { iniciar: false })) {
        return 'clase_cortesia_en_curso';
    }

    // 1a. Un código SOLO cuenta si hay un OTP vigente para este contacto. Seis
    //     dígitos seguidos también son un monto («son 170000») o un pedazo de
    //     teléfono; sin el filtro, a un amigo que manda una cifra el bot le
    //     contestaría «no tengo una verificación pendiente».
    const codeMatch = text.match(CODE_RE);
    if (codeMatch && await hayOtpVigente(integration.id, contactWaId)) {
        await verificarCodigo(integration, conversationId, contactWaId, codeMatch[1]);
        return 'otp_codigo';
    }

    // 1b. Un correo arranca el OTP. Es el camino que la familia que escribe
    //     desde otro celular ya conocía, y el que le pide el mensaje de pagos.
    const emailMatch = text.match(EMAIL_RE);
    if (emailMatch) {
        await arrancarOtp(integration, conversationId, contactWaId, emailMatch[0]);
        return 'otp_correo';
    }

    // 2. ¿Es de la escuela? Si no, silencio.
    const tema = temaEscolar(text);
    if (!tema) return 'silencio';

    // Una vez cada 30 días, no en cada mensaje. Un prospecto escribe tres
    // mensajes seguidos («Hola», «quiero inscribir a mi hija», «en qué grupo»)
    // y el enlace se manda una vez; lo que siga lo ve la escuela. Es el mismo
    // freno que el aviso de 'debe_registrarse', con ventana más larga: acá el
    // riesgo de equivocarse es hablarle a alguien que no es de la escuela.
    if (await yaSeLeContestoEscolar(conversationId)) return 'frenado';

    const escuela = await nombreDeEscuela(integration.school_id);
    const saludo = `Hola 👋 Soy el *asistente automático* de *${escuela}*. 🤖`;

    // Pagos Y precio: «¿qué precio tiene la mensualidad?». Puede ser una
    // familia desde otro celular o un prospecto, y no hay forma de saberlo sin
    // preguntar. En vez de adivinar, UN mensaje con las dos salidas: el correo
    // para quien ya es de la escuela, el enlace para quien no. Uno solo, no
    // dos: es el mismo freno de 30 días y dos mensajes seguidos a un número
    // desconocido ya parecen spam.
    if (tema === 'pagos' && preguntaPrecioComoProspecto(text)) {
        const enlaceCombinado = await enlaceDeInscripcion(integration.school_id);
        const paraFamilias =
            'Si ya eres familia de la escuela, escríbeme el *correo electrónico* con el que estás ' +
            'registrado y te envío un código para verificarte; así te digo el valor de tu mensualidad.';
        if (enlaceCombinado) {
            await deliver(integration, conversationId, contactWaId,
                saludo + '\n\n' + paraFamilias + '\n\n' +
                'Si todavía no estás inscrito, en este enlace ves los grupos y los valores, y puedes ' +
                `hacer la inscripción: ${enlaceCombinado}`,
                { step: PASO_DESCONOCIDO_ESCOLAR, intencion: 'pagos_y_precio', con_enlace: true });
            return 'pagos_y_precio';
        }
        // Sin enlace: mismo criterio que el prospecto de abajo, al buzón y push.
        await deliver(integration, conversationId, contactWaId,
            saludo + '\n\n' + paraFamilias + '\n\n' +
            'Si todavía no estás inscrito, ya le avisé a la escuela y alguien te responde por aquí ' +
            'con la información de inscripción y valores.',
            { step: PASO_DESCONOCIDO_ESCOLAR, intencion: 'pagos_y_precio', con_enlace: false });
        await abrirEnBuzon(integration, conversationId, contactWaId, { motivo: 'prospecto' });
        return 'pagos_y_precio_sin_enlace';
    }

    if (tema === 'pagos') {
        // El texto de 'ask_email' de base, más la frase que le quita el susto
        // al papá que escribe desde el celular del trabajo: «no te reconozco»
        // suena a que algo está mal, y no lo está.
        await deliver(integration, conversationId, contactWaId,
            saludo + '\n\n' +
            'No reconozco este número entre las familias de la escuela. Si nos escribes desde un ' +
            'celular distinto al que registraste, es normal. 🙌' + '\n\n' +
            'Escríbeme el *correo electrónico* con el que estás registrado y te envío un código ' +
            'para verificarte. Después te ayudo con tus pagos y comprobantes.',
            { step: PASO_DESCONOCIDO_ESCOLAR, intencion: 'pagos' });
        return 'pagos';
    }

    const enlace = await enlaceDeInscripcion(integration.school_id);

    // Clase de cortesía: si la escuela tiene franjas con cupo se OFRECEN
    // (además del enlace), y si preguntó por ella sin franjas cargadas se le
    // ofrece dejar los datos. Es el mismo freno de 30 días: el mensaje sale
    // con step PASO_DESCONOCIDO_ESCOLAR. Lo que siga (nombre, edad…) lo
    // atiende el paso 0 de arriba.
    const pideCortesia = pideClaseDeCortesia(text);
    const hayFranjas = filtrarVigentes(await franjasDeSupabase(integration.school_id), new Date()).length > 0;
    if (pideCortesia || hayFranjas) {
        const lineaEnlace = enlace
            ? `\n\nEn este enlace ves los grupos y los valores, y puedes hacer la inscripción: ${enlace}`
            : '';
        await iniciarCortesia(ctxCortesia(integration, conversationId, contactWaId, null), {
            encabezado: saludo + lineaEnlace,
            step: PASO_DESCONOCIDO_ESCOLAR,
            intro: pideCortesia
                ? undefined
                : 'Y si quieres conocer la escuela antes, puedes venir a una *clase de cortesía* gratis. ' +
                  'Estas son las próximas franjas:',
        });
        // Sin enlace, igual que el prospecto de abajo: que la escuela lo vea.
        if (!enlace) await abrirEnBuzon(integration, conversationId, contactWaId, { motivo: 'prospecto' });
        return 'clase_cortesia';
    }

    if (enlace) {
        await deliver(integration, conversationId, contactWaId,
            saludo + '\n\n' +
            '¡Gracias por tu interés! 🙌 En este enlace ves los grupos y los valores, y puedes ' +
            `hacer la inscripción: ${enlace}` + '\n\n' +
            'Si te queda alguna duda, escríbela por acá y la escuela te responde.',
            { step: PASO_DESCONOCIDO_ESCOLAR, intencion: 'inscripcion', con_enlace: true });
        return 'inscripcion';
    }

    // Sin enlace no hay a dónde mandarlo, y un prospecto que nadie contesta se
    // va a otra escuela. Va al buzón y suena el celular: es el único caso de un
    // desconocido que avisa por push, porque es plata que se está yendo.
    await deliver(integration, conversationId, contactWaId,
        saludo + '\n\n' +
        '¡Gracias por tu interés! 🙌 Ya le avisé a la escuela y alguien te responde por aquí ' +
        'con la información de inscripción.',
        { step: PASO_DESCONOCIDO_ESCOLAR, intencion: 'inscripcion', con_enlace: false });
    await abrirEnBuzon(integration, conversationId, contactWaId, { motivo: 'prospecto' });
    return 'inscripcion_sin_enlace';
}

/**
 * ¿Hay una verificación por correo en curso, sin vencer ni agotar, para este
 * contacto? Misma condición que `wa_verify_otp` usa para aceptar un código.
 */
async function hayOtpVigente(integrationId: string, contactWaId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('whatsapp_identifications')
        .select('otp_hash, otp_expires_at, attempts, verified_at')
        .eq('integration_id', integrationId)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();
    if (error || !data) return false;
    const d = data as any;
    return Boolean(d.otp_hash)
        && !d.verified_at
        && Number(d.attempts ?? 0) < 5
        && !!d.otp_expires_at && new Date(d.otp_expires_at).getTime() > Date.now();
}

/**
 * Freno de 30 días. Cuenta salientes Y borradores: en modo asistido la
 * respuesta queda como borrador, y si no contara cada mensaje del prospecto
 * dejaría uno nuevo (lo mismo que `yaSePreguntoConsentimiento`).
 */
async function yaSeLeContestoEscolar(conversationId: string): Promise<boolean> {
    const desde = new Date(Date.now() - FRENO_DESCONOCIDO_DIAS * 24 * 60 * 60 * 1000).toISOString();
    const { count: enviados } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .eq('payload->>step', PASO_DESCONOCIDO_ESCOLAR)
        .gte('created_at', desde);
    if ((enviados ?? 0) > 0) return true;

    const { count: borradores } = await supabase
        .from('whatsapp_message_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('tool_context->>step', PASO_DESCONOCIDO_ESCOLAR)
        .gte('created_at', desde);
    return (borradores ?? 0) > 0;
}

/**
 * El enlace público de inscripción de la escuela: su QR de inscripción
 * (`school_join_qr_codes` → `/join/<slug>`), el mismo link que imprime el
 * póster (`routes/join-qr.ts`) y con la misma marca (`conMarca`).
 *
 * Cuál, si hay varios: medido el 2026-10-03, 11 QR activos en 8 escuelas, y
 * Dynasty tiene DOS abiertos («INSCRIPCION DYNASTY (sin pago)», 121 altas, y
 * «PAGOS DYNASTY VOLLEY E INSCRIPCIONES», 66). Se elige:
 *   - activo y sin vencer (lo mismo que exige `get_join_qr_public`; un QR
 *     vencido abre una página de «expirado»);
 *   - 'open' antes que 'branch'. Los de 'team' y 'plan' NO se usan: meten al
 *     prospecto en un grupo o plan puntual que no eligió;
 *   - el que más altas tiene (`signup_count`): es el que la escuela usa de
 *     verdad. Empate → el más nuevo.
 *
 * No se usa el formulario de prospectos (`/inscripcion/<slug de escuela>`):
 * en toda la base tiene 4 registros, todos de Dynasty, y la escuela no lo
 * reparte; el QR es lo que ya conocen sus familias.
 *
 * Nunca lanza: sin enlace, quien llama manda el caso al buzón.
 */
async function enlaceDeInscripcion(schoolId: string): Promise<string | null> {
    try {
        const ahora = new Date().toISOString();
        const { data, error } = await supabase
            .from('school_join_qr_codes')
            .select('slug, target_type, signup_count, created_at')
            .eq('school_id', schoolId)
            .eq('active', true)
            .or(`expires_at.is.null,expires_at.gt.${ahora}`)
            .order('signup_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(20);
        if (error || !Array.isArray(data)) return null;

        const lista = data as { slug: string | null; target_type: string | null }[];
        const elegido = lista.find((q) => q.target_type === 'open' && q.slug)
            ?? lista.find((q) => q.target_type === 'branch' && q.slug);
        if (!elegido?.slug) return null;

        const marca = await sufijoMarcaEscuela(schoolId);
        return conMarca(`${FRONTEND_URL.replace(/\/$/, '')}/join/${elegido.slug}`, marca);
    } catch {
        return null;
    }
}

// ─── 2. Consentimiento explícito (opt-in) ─────────────────────────────────────
//
// Que el padre nos escriba abre la ventana de 24h; NO es consentimiento para
// mandarle plantillas después (política de Meta, §1.1 del spec). El opt-in se
// pide UNA vez, enganchado al final del flujo de identificación para no hacerle
// dos interrogatorios seguidos, y solo una confirmación afirmativa lo estampa.
//
// Devuelve true si este turno quedó resuelto acá (no debe seguir al LLM).
//
// Spec: docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md §5

const AFIRMATIVAS = new Set([
    'si', 'si acepto', 'acepto', 'si quiero', 'quiero', 'claro', 'claro que si',
    'dale', 'ok', 'okey', 'de acuerdo', 'esta bien', 'listo', 'activar',
]);
const NEGATIVAS = new Set(['no', 'no gracias', 'no quiero', 'ahora no', 'prefiero que no']);
const REACTIVAR = new Set(['activar', 'reactivar', 'si activar']);

/**
 * Misma normalización que la RPC wa_ingest_inbound_message usa para las palabras
 * de baja: minúsculas, sin tildes, sin puntuación, y comparación contra el
 * mensaje COMPLETO. Nunca por subcadena — "no quiero perderme la clase" no puede
 * leerse como un "no".
 */
function normalizar(t: string): string {
    return t
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')   // quita las tildes que NFD dejo sueltas
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function handleConsent(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
    text: string,
    waMessageId: string,
    botonId: string | null = null,
): Promise<boolean> {
    // El botón «Sí, acepto» vale lo mismo que escribir «sí»: se traduce acá y
    // el resto del flujo no se entera. El id manda sobre el título; el título
    // («si acepto», «no gracias») igual ya está en AFIRMATIVAS/NEGATIVAS, por
    // si el borrador salió como texto y lo escribió a mano.
    const norm = botonId === BOTON.CONSENTIR_SI ? 'si'
        : botonId === BOTON.CONSENTIR_NO ? 'no'
        : normalizar(text);

    const { data: optin } = await supabase
        .from('whatsapp_optins')
        .select('opted_in_at, opted_out_at')
        .eq('integration_id', integration.id)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();

    const yaConsintio = !!(optin as any)?.opted_in_at && !(optin as any)?.opted_out_at;
    const estaDeBaja = !!(optin as any)?.opted_out_at;

    // Se dio de baja: NO se le vuelve a pedir. Solo escuchamos que la reactive.
    if (estaDeBaja) {
        if (REACTIVAR.has(norm)) {
            await registrarOptIn(integration, contactWaId, parentId, waMessageId);
            await deliver(integration, conversationId, contactWaId,
                '✅ Listo, reactivé los recordatorios por WhatsApp. Puedes darte de baja cuando quieras con *STOP*.',
                { step: 'opt_in_reactivado' });
            return true;
        }
        return false;
    }

    if (yaConsintio) return false;

    // La pregunta se hace una sola vez por conversación.
    //
    // Este camino ahora es, para una familia NUEVA, el PRIMER mensaje que recibe
    // del bot. El webhook clasifica con `debeAtender` antes de correr el bot, y
    // esa clasificación usa `wa_identify_by_phone`, que deja la conversación
    // vinculada (identified=true) cuando reconoce al acudiente. Para cuando
    // `runBotTurn` mira, ya no entra a `identificarPorTelefono` —que era donde
    // se saludaba y se decía «soy el asistente automático»— y cae acá.
    //
    // Por eso el texto se presenta en vez de arrancar con «Una cosa más»: el
    // primer contacto de un número que hasta ayer contestaba una persona tiene
    // que decir que es un asistente (ver QUIEN ERES en SYSTEM_PROMPT). Para el
    // acudiente que ya venía hablando con el bot de antes de existir el
    // consentimiento, presentarse otra vez es redundante pero no falso.
    if (!(await yaSePreguntoConsentimiento(conversationId))) {
        const escuela = await nombreDeEscuela(integration.school_id);
        await deliver(integration, conversationId, contactWaId,
            `¡Hola! Soy el *asistente automático* de *${escuela}*. 🤖` + '\n\n' +
            `¿Quieres que la escuela te envíe por aquí los recordatorios de pago ` +
            `y los avisos de tu atleta?\n\n` +
            `Responde *SÍ* para activarlos. Puedes darte de baja cuando quieras escribiendo *STOP*.`,
            { step: 'ask_consent' },
            { botones: BOTONES_CONSENTIMIENTO });
        return true;
    }

    if (AFIRMATIVAS.has(norm)) {
        await registrarOptIn(integration, contactWaId, parentId, waMessageId);
        await deliver(integration, conversationId, contactWaId,
            '✅ Activado. Te avisaré por aquí de tus pagos y de tu atleta. Para darte de baja, escribe *STOP*.',
            { step: 'opt_in_registrado' });
        return true;
    }

    if (NEGATIVAS.has(norm)) {
        // No se registra nada: no hay consentimiento que guardar. Y como la
        // pregunta ya quedó hecha, no se vuelve a insistir.
        await deliver(integration, conversationId, contactWaId,
            'Sin problema, no te enviaré recordatorios automáticos. Igual puedes preguntarme lo que necesites por aquí. 🙌',
            { step: 'consent_rechazado' });
        return true;
    }

    // Ni sí ni no: el padre vino a otra cosa. No se insiste, sigue su camino.
    return false;
}

async function registrarOptIn(
    integration: WhatsAppIntegration,
    contactWaId: string,
    parentId: string | null,
    waMessageId: string,
): Promise<void> {
    // source_ref = el mensaje de la CONFIRMACIÓN, no el primero que escribió.
    // Es la prueba que se muestra si Meta audita el consentimiento.
    const { error } = await supabase.rpc('wa_register_optin', {
        p_integration_id: integration.id,
        p_school_id: integration.school_id,
        p_contact_wa_id: contactWaId,
        p_source: 'user_confirmed',
        p_source_ref: waMessageId,
        p_parent_id: parentId,
        p_opt_out: false,
    });
    if (error) console.error('[whatsapp-bot] wa_register_optin error:', error);
}

async function yaSePreguntoConsentimiento(conversationId: string): Promise<boolean> {
    const { count: enviados } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .eq('payload->>step', 'ask_consent');
    if ((enviados ?? 0) > 0) return true;

    // En modo asistido la pregunta queda como borrador hasta que un admin la
    // aprueba. Cuenta igual como preguntada: si no, cada mensaje del padre
    // generaría un borrador nuevo pidiendo lo mismo.
    const { count: borradores } = await supabase
        .from('whatsapp_message_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('tool_context->>step', 'ask_consent');
    return (borradores ?? 0) > 0;
}

async function nombreDeEscuela(schoolId: string): Promise<string> {
    const { data } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
    return (data as any)?.name || 'la escuela';
}

// ─── 3. Intents (LLM + tools) ──────────────────────────────────────────────────

export const SYSTEM_PROMPT = `Eres el asistente de una escuela deportiva en WhatsApp, hablando con el padre/acudiente (ya verificado).
Reglas estrictas:
- Responde SIEMPRE en español, cordial y breve (es WhatsApp).
- NUNCA inventes datos. Si necesitas información de pagos, USA la herramienta get_payment_status.
- Si no puedes ayudar o piden algo fuera de tu alcance, usa escalate_to_human.
- No pidas datos personales ni el email otra vez (ya está identificado).
- Formatea montos en pesos colombianos y fechas en formato legible.
- Formato de WhatsApp, NO Markdown: negrita con UN asterisco (*asi*), cursiva con _asi_.
  Nunca uses ** ni ## ni tablas ni enlaces [texto](url): WhatsApp los muestra literales.
- No ofrezcas nada que no puedas hacer. Sabes cuatro cosas: consultar los pagos del
  acudiente, decirle como pagar, agendar la CLASE DE CORTESIA (ver abajo) y pasar la
  conversacion a un humano. No ofrezcas inscribir, agendar otra cosa, enviar
  documentos ni cambiar nada en el sistema.
- Lo que NO sabes y te van a preguntar igual: edades de cada categoria, lista de
  precios de la escuela (mensualidad de otros planes, uniforme, inscripcion nueva),
  entrenadores, competencias, asistencia y rendimiento. No tienes esos datos. Dilo
  derecho —«eso no lo tengo a la mano»— y ofrece pasarlo con la escuela. NUNCA los
  deduzcas ni los inventes: suenan faciles de contestar y es justo ahi donde un
  asistente se inventa un horario o un precio que la familia despues reclama.
- Sedes, grupos y horarios de entrenamiento SI pueden estar: los trae
  get_school_info (ver SOBRE LA ESCUELA). Solo lo que ella traiga.
- Al listar pagos, mira SIEMPRE el campo debe_pagarse. Los que vienen en false YA
  ESTAN RESUELTOS: no los pongas bajo "pagos pendientes" ni menciones su saldo en $0.
  Si el acudiente pregunta por uno de esos, responde con su estado_legible
  ("ya esta pagado y confirmado por la escuela").
- Si NINGUNO tiene debe_pagarse en true, di que esta al dia; no inventes una lista.
- «Cuanto cuesta la mensualidad?» de alguien YA inscrito es una pregunta sobre SU
  cobro, no sobre la lista de precios: usa get_payment_status y dile su monto. Es la
  pregunta mas comun de todas y contestarle «no tengo ese dato» teniendolo delante es
  el peor no que puede dar. Solo si pregunta por precios de la escuela en general
  —otro plan, otra categoria, inscripcion nueva— no lo tienes.

CONVERSACION PREVIA:
- Antes del mensaje actual puede venir lo ultimo que se hablo (hasta 24 h). Usalo
  para entender a que se refiere («y el de mi otra hija?», «si, ese»), no para
  repetir lo que ya se dijo.
- Los mensajes que empiezan con «(la escuela escribió)» los escribio una persona de
  la escuela, no tu. No los contradigas ni los repitas como tuyos, y nunca firmes
  por ella. Si lo que dijo la escuela choca con lo que te devuelve una herramienta,
  no elijas tu: usa escalate_to_human.
- Los montos y estados de pago de mensajes anteriores pueden haber cambiado: para
  cualquier pregunta de pagos usa SIEMPRE get_payment_status de nuevo.

QUIEN ERES:
- Eres un asistente AUTOMATICO, y si te preguntan lo dices sin rodeos: «soy el
  asistente automatico de la escuela». No te hagas pasar por una persona ni dejes
  que lo crean — este numero es el MISMO que atendia un humano hasta ayer, y las
  familias estan acostumbradas a que les responda ella.
- Nunca firmes con el nombre de nadie de la escuela.
- Si el acudiente quiere hablar con una persona, no lo discutas: usa
  escalate_to_human de una.

FUERA DE TEMA:
- Eres el asistente de la escuela. NO respondas preguntas generales de cultura,
  tecnologia ni nada ajeno a la escuela y sus pagos, aunque sepas la respuesta.
  En el chat de prueba explicaste que es Claude y que es un JSON: eso convierte el
  WhatsApp de la escuela en un chatbot de uso general.
- NUNCA digas que modelo o que proveedor de IA eres. Si preguntan, di que eres el
  asistente de la escuela y ofrece ayudar con pagos o comunicar con el equipo.
- Ante algo fuera de tema, responde corto y amable, y vuelve a lo tuyo. No lo
  escales: escalar cada pregunta suelta le llena la bandeja a la escuela.

SOBRE LA ESCUELA:
- Para «donde queda», «que sedes tienen», «que deportes», «que categorias hay»,
  «en que grupo va mi hijo» o «a que hora entrena tal grupo» usa get_school_info.
- Esa herramienta devuelve 'no_disponible': TODO lo que aparezca ahi lo dices como
  que no lo tienes, y ofreces que la escuela lo confirme. No lo deduzcas de ningun
  otro campo.
- EN PARTICULAR, no traduzcas el nombre de un grupo a edades. «U15 FEMENINO» sugiere
  sub-15, pero la convencion cambia por federacion y por ano: una edad equivocada
  manda a una familia a la categoria que no es. Di el nombre tal cual.
- Cada grupo trae 'admite_nuevos'. Si viene en false, ESE GRUPO NO RECIBE ATLETAS
  NUEVOS: no lo ofrezcas ni sugieras inscribirse ahi. Dilo con la 'nota_admision'
  si la trae, que es lo que la escuela quiere que se responda.
- «No admite nuevos» NO es «esta lleno». No digas que se lleno ni que hay lista de
  espera si la escuela no lo dijo: quien oye «esta lleno» vuelve a preguntar en un
  mes, y eso le hace perder el tiempo a la familia y a la escuela.
- HORARIOS DE ENTRENAMIENTO: respondelos SOLO con el campo 'horario' del grupo por
  el que preguntan, tal como viene en get_school_info. Algunos grupos lo tienen
  cargado y otros no.
  · Si ese grupo trae 'horario', dalo tal cual, sin agregar ni redondear, con la
    cancha que trae cada franja entre parentesis. Si el texto trae subgrupos
    separados por « || » (p.ej. «Origen: … || Evolucion: …»), muestralos como
    lineas aparte y di el nombre de cada subgrupo.
  · Si 'horario_fuente' viene en 'inferido', NO lo des como fijo: dilo con cautela
    («segun las ultimas sesiones registradas, …») y ofrece que la escuela lo
    confirme. Si viene en 'cargado', es el horario que la escuela publico.
  · Si no lo trae, o aparece en 'no_disponible', di que ese horario no lo tienes a
    la mano y ofrece que la escuela lo confirme.
  · NUNCA uses el horario de otro grupo para completar, ni «suele ser por la
    tarde», ni lo deduzcas del nombre del grupo.
  · Si no sabes de que grupo habla, pregunta cual, o lista los que si tienen
    horario cargado.

CLASE DE CORTESIA (clase de prueba):
- Para «clase de cortesia», «clase de prueba», «clase gratis», «puedo ir a probar»,
  «quiero que mi hijo pruebe una clase», «agendar una clase» o «cancelar mi clase de
  prueba» usa SIEMPRE get_trial_class_info. Ella responde sola con las franjas reales
  y agenda paso a paso.
- NUNCA digas que no tienes esa informacion sin haber usado la herramienta, ni
  inventes fechas, horarios, precios o cupos de la clase de cortesia.

COMO PAGAR:
- Para «medios de pago», «como pago», «a que cuenta», «acepta Nequi» o «donde mando el
  soporte» usa get_payment_methods. Esas preguntas NO se escalan.
- Ofrece SIEMPRE las tres opciones que devuelva la herramienta, y menciona que puede
  mandar la foto del comprobante por este mismo chat: es la que nadie descubre solo.
- Da los numeros de cuenta COMPLETOS, tal como vienen. No los recortes.
- Si la escuela no tiene cuentas cargadas, no te las inventes: ofrece el enlace para
  pagar en linea y el envio del comprobante por aqui.`;

export const TOOLS: LlmTool[] = [
    {
        name: 'get_payment_status',
        description: 'Estado de los pagos del acudiente en esta escuela: lo que debe Y lo resuelto en los ultimos 60 dias. Cada pago trae `estado_legible` (pagado y confirmado, comprobante en revision, rechazado, pendiente) y `debe_pagarse`. Usala SIEMPRE que pregunte por pagos, mensualidades, inscripciones, saldos, vencimientos, o si un pago suyo ya quedo aprobado. Si un concepto no aparece en el resultado, di que no lo encuentras — NUNCA afirmes que un cobro no existe.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_school_info',
        description: 'Datos publicos de la escuela: donde queda, sus sedes, que deportes y que grupos o categorias tiene (con el horario de entrenamiento de cada grupo cuando esta cargado), y el horario de atencion. Usala cuando pregunten por la ubicacion, las sedes, los deportes, las categorias, los grupos o a que hora entrena un grupo. Devuelve tambien `no_disponible`: lo que la escuela NO tiene cargado, y eso se responde diciendo que no se tiene.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_payment_methods',
        description: 'Como puede pagar el acudiente: las cuentas de la escuela para transferir, el enlace para pagar en linea, y que puede mandar el comprobante por este mismo chat. Usala cuando pregunte como pagar, medios de pago, a que cuenta consignar, si acepta Nequi o transferencia, o donde manda el soporte. NO escales estas preguntas: se responden con esta herramienta.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_trial_class_info',
        description: 'Clase de cortesia / clase de prueba / clase gratis de la escuela: si la ofrece, las proximas franjas disponibles (fecha, hora, grupo, sede, cupos) y el agendamiento paso a paso con reserva del cupo; tambien cancela una clase ya reservada. Usala SIEMPRE que pregunten por clase de cortesia, clase de prueba, clase gratis, «puedo ir a probar», agendar o cancelar esa clase. Responde por si sola: no hace falta redactar despues.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'escalate_to_human',
        description: 'Escala la conversación a un humano de la escuela. Úsala cuando no puedas resolver o el padre lo pida.',
        parameters: {
            type: 'object',
            properties: { reason: { type: 'string', description: 'Motivo breve de la escalación' } },
            required: [],
        },
    },
];

async function handleIntent(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
    text: string,
    waMessageId: string | null = null,
): Promise<void> {
    if (!text) return;

    // Con memoria: los últimos mensajes de las 24 h + el actual (ver
    // `historialDeConversacion`). El actual ya quedó guardado por la ingesta;
    // se excluye por su wa_message_id y se agrega al final, para que sea
    // siempre el último turno aunque los relojes de Meta y de la base difieran.
    const historial = await historialDeConversacion(conversationId, waMessageId);
    const messages: LlmMessage[] = armarTurnos(historial, text);

    let first;
    try {
        first = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: TOOLS });
    } catch (err: any) {
        console.error('[whatsapp-bot] LLM error:', err?.message);
        await escalate(integration, conversationId, contactWaId, 'llm_error');
        return;
    }

    // Sin tool → responder texto directo (saludos, agradecimientos).
    if (!first.toolCalls?.length) {
        const respuesta = first.text || 'Puedo ayudarte con el estado de tus pagos. ¿Qué necesitas?';
        await deliver(integration, conversationId, contactWaId,
            respuesta,
            { step: 'llm_text', provider: first.provider },
            botonesSiNoLoTiene(respuesta));
        return;
    }

    const call = first.toolCalls[0];

    if (call.name === 'escalate_to_human') {
        await escalate(integration, conversationId, contactWaId, String((call.args as any)?.reason || 'user_request'));
        return;
    }

    if (call.name === 'get_trial_class_info') {
        // Sin segundo turno de redacción: el texto, las franjas y los botones
        // salen del flujo determinista. Un modelo redactando franjas es justo
        // donde se inventa un horario que la familia después reclama.
        const ctx = ctxCortesia(integration, conversationId, contactWaId, parentId);
        try {
            // «Cancelar mi clase» llega acá cuando la regla no lo atrapó: el
            // flujo lo atiende si hay reserva; si no, se informa la oferta.
            if (!(await atenderTurnoCortesia(ctx, text, null, { iniciar: false }))) {
                await iniciarCortesia(ctx);
            }
        } catch (e: any) {
            console.error('[whatsapp-bot] get_trial_class_info falló', { conversationId, err: e?.message });
            await escalate(integration, conversationId, contactWaId, 'tool_error');
        }
        return;
    }

    if (call.name === 'get_school_info') {
        const info = await infoDeEscuela(integration.school_id);

        messages.push({ role: 'assistant', content: `Llamando get_school_info` });
        messages.push({ role: 'tool', toolName: 'get_school_info', content: JSON.stringify(info) });
        let final;
        try {
            // SIN herramientas: este turno solo REDACTA. Ofrecerle TOOLS lo invita
            // a llamar otra, y cuando lo hace `text` vuelve vacio.
            final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: [] });
        } catch {
            await deliver(integration, conversationId, contactWaId,
                fallbackInfoEscuela(info), { step: 'info_escuela_fallback' });
            return;
        }
        if (!final.text) {
            console.warn('[whatsapp-bot] get_school_info: el modelo no devolvio texto',
                { proveedor: final.provider });
        }
        // «¿A qué hora entrena el sub 13?» con el horario sin cargar termina en
        // «eso no lo tengo a la mano»: ahí también van los botones.
        await deliver(integration, conversationId, contactWaId,
            final.text || fallbackInfoEscuela(info),
            { step: 'get_school_info', provider: final.provider },
            botonesSiNoLoTiene(final.text));
        return;
    }

    if (call.name === 'get_payment_methods') {
        const medios = await mediosDePago(integration.school_id);

        messages.push({ role: 'assistant', content: `Llamando get_payment_methods` });
        messages.push({ role: 'tool', toolName: 'get_payment_methods', content: JSON.stringify(medios) });
        let final;
        try {
            // SIN herramientas, a proposito. Este turno solo REDACTA con datos que
            // ya llegaron; ofrecerle TOOLS lo invita a llamar otra, y cuando lo
            // hace `text` vuelve vacio y caemos al texto plano.
            final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: [] });
        } catch {
            await deliver(integration, conversationId, contactWaId,
                fallbackMediosDePago(medios), { step: 'medios_fallback' });
            return;
        }
        // Un degradado al texto plano NO puede ser silencioso. El 2026-09-14
        // ocurrio cuatro veces sin dejar rastro en ningun lado, y buscar la
        // causa costo descartar saturacion, proveedor, configuracion de dev y
        // recursos de Render, uno por uno. La proxima vez lo dira.
        if (!final.text) {
            console.warn('[whatsapp-bot] medios_de_pago: el modelo no devolvio texto',
                { proveedor: final.provider, toolCalls: (final as any).toolCalls?.length ?? 0 });
        }
        await deliver(integration, conversationId, contactWaId,
            final.text || fallbackMediosDePago(medios),
            { step: 'get_payment_methods', provider: final.provider });
        return;
    }

    if (call.name === 'get_payment_status') {
        const { data: payments, error } = await supabase.rpc('wa_get_payment_status', {
            p_parent_id: parentId,
            p_school_id: integration.school_id,
        });

        // Tool falló → NO inventar. Escalar.
        if (error) {
            console.error('[whatsapp-bot] wa_get_payment_status error:', error);
            await escalate(integration, conversationId, contactWaId, 'tool_error');
            return;
        }

        // Redacción final con el resultado de la tool.
        messages.push({ role: 'assistant', content: `Llamando get_payment_status` });
        messages.push({ role: 'tool', toolName: 'get_payment_status', content: JSON.stringify(payments) });

        let final;
        try {
            // SIN herramientas, a proposito. Este turno solo REDACTA con datos que
            // ya llegaron; ofrecerle TOOLS lo invita a llamar otra, y cuando lo
            // hace `text` vuelve vacio y caemos al texto plano.
            final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: [] });
        } catch {
            // Si la 2a llamada falla, redactar un fallback determinista con los datos.
            await deliver(integration, conversationId, contactWaId,
                fallbackPaymentText(payments), { step: 'payment_fallback' });
            return;
        }

        // Un degradado al texto plano NO puede ser silencioso. El 2026-09-14
        // ocurrio cuatro veces sin dejar rastro en ningun lado, y buscar la
        // causa costo descartar saturacion, proveedor, configuracion de dev y
        // recursos de Render, uno por uno. La proxima vez lo dira.
        if (!final.text) {
            console.warn('[whatsapp-bot] estado_de_pagos: el modelo no devolvio texto',
                { proveedor: final.provider, toolCalls: (final as any).toolCalls?.length ?? 0 });
        }
        await deliver(integration, conversationId, contactWaId,
            final.text || fallbackPaymentText(payments),
            { step: 'get_payment_status', provider: final.provider, tool_result: payments });
        return;
    }

    // Tool desconocida → escalar.
    await escalate(integration, conversationId, contactWaId, 'unknown_tool');
}

/**
 * Texto de medios de pago sin pasar por el modelo.
 *
 * Si la segunda llamada al LLM falla, el acudiente igual se queda con las
 * cuentas y el enlace. Dejarlo sin respuesta seria peor que un texto plano.
 */
function fallbackMediosDePago(m: Awaited<ReturnType<typeof mediosDePago>>): string {
    const lineas: string[] = ['Puedes pagar de estas formas:', ''];
    if (m.cuentas.length) {
        lineas.push('*Transferencia*');
        for (const c of m.cuentas) {
            lineas.push(`• ${c.tipo}: ${c.numero}${c.titular ? ` (${c.titular})` : ''}`);
        }
        lineas.push('');
    }
    lineas.push(`*En línea:* ${m.enlace_para_pagar}`);
    lineas.push('');
    lineas.push('*Y si ya pagaste*, mándame la foto del comprobante por acá mismo y yo lo registro. 📄');
    return lineas.join('\n');
}

// ─── Entrega: modo asistido (draft) vs auto (envío) ────────────────────────────

/**
 * Embudo UNICO de todo lo que el bot le dice al acudiente: respeta el modo
 * (auto envia, asistido deja borrador), registra el saliente y agrega la
 * coletilla de baja cuando corresponde. Exportada para que el webhook pueda
 * responder a los tipos que el bot no procesa (audio, video) sin duplicar nada
 * de eso.
 */
/** Visto azul sobre el último mensaje de la familia. Best-effort, nunca lanza. */
async function marcarLeidoElUltimoEntrante(integration: WhatsAppIntegration, conversationId: string): Promise<void> {
    try {
        const { data } = await supabase.from('whatsapp_messages')
            .select('wa_message_id')
            .eq('conversation_id', conversationId).eq('direction', 'inbound')
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const id = (data as any)?.wa_message_id as string | undefined;
        if (id) await markAsRead(integration, id);
    } catch { /* best-effort */ }
}

export async function deliver(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    proposedText: string,
    context: Record<string, unknown>,
    conBotones?: ConBotones,
): Promise<void> {
    // ¿Modo auto vigente? (auto solo si mode='auto' y ya pasó assisted_until)
    const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('mode, assisted_until, ai_enabled')
        .eq('integration_id', integration.id)
        .maybeSingle();

    const s = settings as any;

    // Apagado = apagado: ni envío NI borrador.
    //
    // Antes el modo apagado solo bloqueaba el envío y caía al camino del
    // borrador. Medido en Dynasty el 2026-10-03, primer día por Coexistence con
    // `ai_enabled=false`: 316 borradores pendientes que nadie pidió, 238 de ellos
    // «escríbeme tu correo» a contactos personales de la dueña. Un borrador NO es
    // inocuo: llena el buzón y basta un «aprobar todo» para que salga.
    //
    // Estricto con `=== true`, igual que `ajustesDeAtencion`: sin fila de ajustes
    // la integración está a medio configurar, y ante la duda no se habla.
    //
    // Sirve como gate porque `deliver` solo lo usan caminos AUTOMÁTICOS (el bot,
    // el webhook para audio/video y la respuesta de cobro vía callback). Las
    // respuestas humanas del buzón no pasan por acá. Si algún día lo hacen, este
    // gate tiene que moverse a quien llama.
    if (s?.ai_enabled !== true) {
        console.info('[whatsapp-bot] bot apagado: no se envía ni se deja borrador',
            { conversationId, step: (context as any)?.step ?? null });
        return;
    }

    const now = Date.now();
    const autoAllowed =
        s?.mode === 'auto' &&
        (!s?.assisted_until || new Date(s.assisted_until).getTime() < now);

    // A quien pidió la baja y AUN ASÍ nos escribe se le responde —él inició el
    // contacto—, pero enterándose de que sigue con las notificaciones apagadas.
    // Va acá porque `deliver` es el embudo único de todo lo que sale del bot:
    // puesto en cada intent, el primero que se agregue mañana se olvida.
    //
    // Se exceptúan los pasos que HABLAN del consentimiento, o el mensaje queda
    // contradiciéndose («no volverás a recibir… tienes las notificaciones
    // apagadas»).
    const PASOS_DE_CONSENTIMIENTO = [
        'opt_out_confirmado', 'opt_in_confirmado', 'opt_in_reactivado', 'ask_consent',
    ];
    // WhatsApp usa UN asterisco para negrita; el modelo escribe Markdown estandar.
    let texto = aFormatoWhatsApp(proposedText);
    if (!PASOS_DE_CONSENTIMIENTO.includes(String((context as any)?.step ?? ''))
        && await estaDadoDeBaja(integration.id, contactWaId)) {
        texto += AVISO_DADO_DE_BAJA;
    }

    const botones = conBotones?.botones?.length ? conBotones.botones : null;
    // El mismo mensaje sin botones: lo que sale si Meta rechaza los botones, y
    // lo que queda en el borrador del modo asistido.
    const textoSinBotones = botones && conBotones?.enTexto
        ? `${texto}\n\n${conBotones.enTexto}`
        : texto;

    if (autoAllowed) {
        let tipo = 'text';
        let cuerpo = textoSinBotones;
        let sent = botones
            ? await sendInteractiveButtons(integration, contactWaId, texto, botones)
            : null;
        if (sent?.ok) {
            tipo = 'interactive';
            cuerpo = texto;
        } else {
            // Sin botones, o Meta los rechazó (cuerpo largo, error de red): el
            // texto plano SIEMPRE sale. Una respuesta sin botones es peor que
            // una con botones; ninguna respuesta es peor que las dos.
            if (sent) {
                console.warn('[whatsapp-bot] no salieron los botones; va como texto',
                    { conversationId, error: sent.error });
            }
            sent = await sendTextMessage(integration, contactWaId, textoSinBotones);
        }
        await supabase.rpc('wa_record_outbound_message', {
            p_conversation_id: conversationId,
            p_integration_id: integration.id,
            p_wa_message_id: sent.waMessageId || `local-${crypto.randomUUID()}`,
            p_type: tipo,
            p_text_body: cuerpo,
            p_payload: tipo === 'interactive' ? { ...context, botones } : context,
            p_ai_generated: true,
            p_to_wa_id: contactWaId,
        });
        // El visto va recién cuando hay respuesta. Marcar el último entrante
        // marca también los anteriores de ese chat.
        if (sent.ok) void marcarLeidoElUltimoEntrante(integration, conversationId);
        return;
    }

    // Modo asistido → draft para aprobación (NO se envía).
    // Tampoco se marca como leído: hasta que alguien apruebe, nadie respondió.
    //
    // El buzón aprueba el borrador como TEXTO (`sendTextMessage` en
    // whatsapp-admin.routes): no hay forma de mandar botones desde ahí. Por eso
    // el borrador lleva el texto que se entiende sin botones (`enTexto`), y los
    // botones quedan en `tool_context.botones` para que el buzón los muestre o,
    // el día que sepa, los mande. Lo que la familia escriba con esas palabras
    // se lee igual que el botón (`accionDeBoton` compara el título).
    await supabase.from('whatsapp_message_drafts').insert({
        conversation_id: conversationId,
        integration_id: integration.id,
        proposed_text: textoSinBotones,
        tool_context: botones ? { ...context, botones } : context,
        llm_provider: (context as any)?.provider ?? null,
        status: 'pending',
    });
}

/**
 * Botones para `deliver`. `enTexto` es la línea que los reemplaza cuando el
 * mensaje sale como texto (modo asistido, o Meta rechazó los botones). Si el
 * cuerpo ya dice qué responder («Responde *SÍ*…») no hace falta.
 */
export interface ConBotones {
    botones: BotonInteractivo[];
    enTexto?: string;
}

function botonesSiNoLoTiene(texto: string | null | undefined): ConBotones | undefined {
    return respondioQueNoLoTiene(texto)
        ? { botones: BOTONES_SIN_DATO, enTexto: SIN_DATO_EN_TEXTO }
        : undefined;
}

/**
 * Avisa a quien administra la escuela que hay alguien esperando.
 *
 * Sin esto el buzon existe pero no se usa: la escuela tendria que acordarse de
 * entrar a revisar, y en dos dias deja de hacerlo. El push ya existia para
 * otras cosas; aca solo se engancha a la escalacion.
 *
 * Nunca revienta el flujo del bot: si el aviso falla, el padre igual recibio su
 * respuesta y la conversacion igual quedo marcada como abierta. Un push caido
 * no puede dejar a la familia sin atencion.
 *
 * Solo se avisa por contactos que el asistente ATIENDE (`debeAtender`). Con
 * Coexistence cada conversación nueva de un desconocido —la mamá de la dueña,
 * un proveedor— quedaba 'open' y le sonaba el celular a la dueña por un
 * mensaje que ella misma ya estaba viendo en su WhatsApp. Sobre 55
 * conversaciones de Dynasty, 25 no eran familias. Se recalcula acá en vez de
 * recibir el tipo para no depender de que la columna `contact_kind` ya exista:
 * escalar es raro, el costo de tres consultas más no se nota.
 *
 * Única excepción: `motivo: 'prospecto'`. Es un desconocido por definición
 * (su número no está en ninguna ficha), preguntó por inscripción y la escuela
 * no tiene enlace activo para mandarle (ver `atenderDesconocido`). Ese sí
 * avisa: un prospecto sin respuesta es una inscripción perdida.
 */
type AvisoDeEspera = { motivo: 'prospecto' };

/*
 * Correo además del push (desde 2026-10-04). El push solo le llega a quien
 * instaló la app y aceptó notificaciones; el correo llega igual. Se manda en
 * los mismos casos que el push —transición a abierta, contacto que se
 * atiende o prospecto— y SOLO cuando quien llama pasa `motivoCorreo`
 * (escalamiento o prospecto sin enlace): el «ask_email» de `abrirEnBuzon` no
 * es un escalamiento y no merece un correo.
 *
 * No bloqueante a propósito: el cuerpo lo implementa avisos-correo.service y
 * un proveedor de correo lento o caído no puede demorar la respuesta a la
 * familia ni tumbar el push.
 */

async function avisarQueEsperan(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    nombreContacto: string | null,
    aviso?: AvisoDeEspera,
    motivoCorreo?: string,
): Promise<void> {
    try {
        const esProspecto = aviso?.motivo === 'prospecto';
        if (!esProspecto) {
            const { atender, tipo } = await debeAtender(integration, conversationId, contactWaId);
            if (!atender) {
                console.info('[whatsapp-bot] escalado sin push: contacto que no se atiende',
                    { conversationId, tipo });
                return;
            }
        }

        if (motivoCorreo) {
            void Promise.resolve()
                .then(() => avisarEscalamientoPorCorreo({
                    schoolId: integration.school_id,
                    conversationId,
                    contactName: nombreContacto,
                    contactWaId,
                    motivo: motivoCorreo,
                }))
                .catch(() => {});
        }

        const [{ data: escuela }, { data: miembros }] = await Promise.all([
            supabase.from('schools').select('name, owner_id').eq('id', integration.school_id).maybeSingle(),
            supabase.from('school_members').select('profile_id')
                .eq('school_id', integration.school_id).eq('status', 'active')
                .in('role', ['owner', 'admin', 'school_admin']),
        ]);

        // El dueno puede no tener fila en school_members: se suma aparte y se
        // deduplica, o recibiria dos avisos por el mismo mensaje.
        const destinos = new Set<string>();
        for (const m of (miembros ?? []) as any[]) if (m.profile_id) destinos.add(m.profile_id);
        if ((escuela as any)?.owner_id) destinos.add((escuela as any).owner_id);
        if (!destinos.size) return;

        const quien = nombreContacto?.trim() || (esProspecto ? 'Un prospecto' : 'Una familia');
        await Promise.allSettled([...destinos].map((uid) => sendToUser(uid, {
            title: esProspecto ? `${quien} pregunta por inscripciones` : `${quien} espera respuesta`,
            body: esProspecto
                ? 'No tienes un enlace de inscripción activo para mandarle. Abre WhatsApp en SportMaps para responder.'
                : 'El asistente no pudo resolverlo. Abre WhatsApp en SportMaps para responder.',
            data: { tipo: 'whatsapp_escalado', conversation_id: conversationId,
                    school_id: integration.school_id },
        })));
    } catch {
        // A proposito en silencio. Ver el comentario de arriba.
    }
}

async function escalate(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    reason: string,
): Promise<void> {
    // Solo se avisa en la TRANSICION a abierta. `escalate` puede correr varias
    // veces sobre la misma conversacion —el bot se atasca dos veces seguidas— y
    // sin esto la escuela recibiria un push por cada intento.
    const { data: previa } = await supabase.from('whatsapp_conversations')
        .select('status, contact_name').eq('id', conversationId).maybeSingle();

    await supabase.from('whatsapp_conversations')
        .update({ status: 'open', assigned_to: null, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    if ((previa as any)?.status !== 'open') {
        await avisarQueEsperan(integration, conversationId, contactWaId,
            (previa as any)?.contact_name ?? null, undefined, reason);
    }

    // El bot responde 24/7 — eso no cambia. Lo que cambia fuera de horario es lo
    // que PROMETE: decir "en breve te contactan" a las 11 de la noche, cuando en
    // la escuela no hay nadie hasta el otro dia, es prometer algo que no se
    // puede cumplir.
    const horario = await estadoDeHorario(integration.id);
    await deliver(integration, conversationId, contactWaId,
        mensajeDeEscalamiento(horario),
        { step: 'escalated', reason, fuera_de_horario: horario.fueraDeHorario });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

function maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const shown = user.slice(0, 2);
    return `${shown}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * El estado de pagos sin pasar por el modelo.
 *
 * FILTRA POR `debe_pagarse`. La consulta `wa_get_payment_status` se amplio para
 * devolver tambien lo RESUELTO de los ultimos 60 dias —para poder responder «ya
 * lo aprobaron?»— y este camino seguia listandolo todo bajo «pagos pendientes».
 * Resultado visible en el chat de prueba del 2026-09-14:
 *
 *     • Mensualidad Septiembre 2026: $0 — vence 2026-09-10
 *
 * Un pago confirmado, cobrado de nuevo, en $0. El mismo bug que ya se habia
 * corregido en el prompt del modelo, escondido en el respaldo que nadie volvio
 * a mirar cuando se amplio la consulta.
 */
function fallbackPaymentText(payments: any): string {
    const list = Array.isArray(payments) ? payments : [];
    const pendientes = list.filter((p: any) => p?.debe_pagarse === true);

    if (!pendientes.length) {
        return list.length
            ? 'No tienes pagos pendientes en este momento. ¡Estás al día! ✅'
            : 'No encuentro pagos a tu nombre en esta escuela.';
    }

    const lines = pendientes.slice(0, 5).map((p: any) => {
        const monto = Number(p.saldo || 0).toLocaleString('es-CO');
        const venc = p.vencido ? ' (vencida)' : '';
        return `• ${p.concept}: $${monto} — vence ${p.due_date}${venc}`;
    });
    return `Estos son tus pagos pendientes:\n${lines.join('\n')}`;
}
