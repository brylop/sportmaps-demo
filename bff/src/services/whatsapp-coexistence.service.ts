/**
 * Coexistence: el número vive a la vez en el celular de la escuela y en la API.
 *
 * Tres webhooks alimentan esto, y los tres llegan solo si están suscritos:
 *
 *  - `smb_message_echoes` — lo que la escuela escribe DESDE su celular. Sin
 *    esto el buzón mostraría conversaciones a medias: se vería la pregunta de
 *    la familia y la respuesta del bot, pero no lo que contestó la dueña desde
 *    su teléfono. Peor: el bot creería que nadie respondió.
 *  - `history` — hasta 6 meses de conversaciones anteriores, en trozos.
 *  - `smb_app_state_sync` — los contactos. Ver el comentario al final.
 *
 * Formas verificadas contra la documentación de Meta el 2026-09-14:
 *   entry[].changes[].value.message_echoes[]
 *   entry[].changes[].value.history[].threads[].messages[]
 */

import type { Logger } from 'pino';
import { supabase } from '../config/supabase';
import { resolveIntegration, type WhatsAppIntegration } from './whatsapp.service';
import {
    ECHO_AUTOMATICO_MIN_LARGO, ECHO_AUTOMATICO_VENTANA_MS,
    esSalienteAutomatico, esTextoAutomatico, normalizarTextoEcho,
} from './whatsapp-buzon';

/** Texto legible de un mensaje, sea del tipo que sea. */
function textoDe(m: any): string | null {
    if (m?.text?.body) return String(m.text.body);
    if (m?.caption) return String(m.caption);
    for (const t of ['image', 'video', 'document', 'audio', 'sticker']) {
        if (m?.[t]?.caption) return String(m[t].caption);
    }
    return null;
}

// ─── Privacidad: contactos marcados 'personal' ───────────────────────────────
//
// Auditoría 2026-10-06 (P0-3): el bot ya no les habla, pero el texto completo
// de las conversaciones personales de la dueña (entrantes y ecos, con
// adjuntos) quedaba guardado en whatsapp_messages. De un contacto 'personal'
// ahora se guardan SOLO metadatos: dirección, tipo y hora. `text_body` va null
// y el payload pierde texto, caption y media. Lo ya guardado NO se borra acá
// (lo decide el usuario: docs/migraciones-para-aplicar-2026-10-07/).

/**
 * El payload de Meta sin contenido: id, tipo, hora y los números (que ya están
 * en la conversación). Pura.
 */
export function payloadSinContenido(m: any): Record<string, unknown> {
    const out: Record<string, unknown> = { privacidad: 'personal_sin_contenido' };
    for (const k of ['id', 'type', 'timestamp', 'from', 'to']) {
        if (m?.[k] !== undefined && m?.[k] !== null) out[k] = m[k];
    }
    return out;
}

/** ¿La conversación de este contacto está marcada 'personal'? Ante un error, no. Nunca lanza. */
export async function esContactoPersonal(integrationId: string, contactWaId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('contact_kind')
            .eq('integration_id', integrationId)
            .eq('contact_wa_id', contactWaId)
            .maybeSingle();
        if (error) return false;
        return (data as any)?.contact_kind === 'personal';
    } catch {
        return false;
    }
}

/** La conversación de ese contacto (creándola si no existía) y si está marcada 'personal'. */
async function conversacionConTipo(
    integration: WhatsAppIntegration,
    contactWaId: string,
): Promise<{ id: string; personal: boolean } | null> {
    const { data: existente } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_kind')
        .eq('integration_id', integration.id)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();
    if (existente) return { id: (existente as any).id, personal: (existente as any).contact_kind === 'personal' };

    // `uq_wa_conversation` cubre (integration_id, contact_wa_id): si dos trozos
    // del historial llegan a la vez, el segundo choca en vez de duplicar.
    //
    // status 'closed', no 'active': el CHECK de la tabla solo admite
    // open|snoozed|closed (verificado en la base el 2026-10-03). Con 'active'
    // el upsert fallaba y el echo o el trozo de historial de un contacto NUEVO
    // se perdía en silencio. 'closed' porque lo que crea esta función no espera
    // respuesta: o lo escribió la escuela (echo) o es historia. Si la familia
    // escribe, wa_ingest_inbound_message la reabre a 'open'.
    const { data: creada, error } = await supabase
        .from('whatsapp_conversations')
        .upsert({
            integration_id: integration.id,
            school_id: integration.school_id,
            contact_wa_id: contactWaId,
            status: 'closed',
        }, { onConflict: 'integration_id,contact_wa_id' })
        .select('id')
        .maybeSingle();
    if (error) console.warn('[wa-coexistence] no se pudo crear la conversación', { err: error.message });
    const id = (creada as any)?.id ?? null;
    // Recién creada: nadie la marcó todavía como personal.
    return id ? { id, personal: false } : null;
}

/**
 * Guarda un mensaje sin duplicarlo.
 *
 * Se apoya en el índice único `uq_wa_message_wamid`: Meta reenvía trozos del
 * historial y repite echos, así que la idempotencia no es un lujo.
 */
async function guardarMensaje(params: {
    conversationId: string;
    integrationId: string;
    waMessageId: string;
    direction: 'inbound' | 'outbound';
    type: string;
    textBody: string | null;
    payload: any;
    waTimestamp: string | null;
    status?: string | null;
}): Promise<void> {
    await supabase.from('whatsapp_messages').upsert({
        conversation_id: params.conversationId,
        integration_id: params.integrationId,
        wa_message_id: params.waMessageId,
        direction: params.direction,
        type: params.type,
        text_body: params.textBody,
        payload: params.payload,
        wa_timestamp: params.waTimestamp,
        status: params.status ?? null,
        // Lo escribió una persona desde el celular, no el modelo. Que el hilo
        // lo distinga es lo que permite saber qué prometió quién.
        ai_generated: false,
    }, { onConflict: 'wa_message_id', ignoreDuplicates: true });
}

const tsDe = (t: any): string | null =>
    t ? new Date(Number(t) * 1000).toISOString() : null;

type EchoGuardado = {
    id: string; wa_message_id: string | null; conversation_id: string;
    text_body: string | null; payload: any;
};

/**
 * ¿Este echo lo mandó sola la app WhatsApp Business (saludo, ausencia)?
 *
 * La regla vive en whatsapp-buzon.ts (`esTextoAutomatico`); acá se buscan los
 * echos de la misma integración en los 7 días anteriores con el mismo texto
 * normalizado. Devuelve también los echos IGUALES que todavía no tienen la
 * marca: el 1.º y el 2.º saludo se guardaron como humanos porque aún no se
 * llegaba al umbral, y hay que corregirlos cuando llega el 3.º.
 *
 * Si la consulta falla se responde "humano": es el comportamiento de antes y
 * no marca de golpe todo como automático por un error de red.
 */
export async function esEchoAutomatico(params: {
    integrationId: string;
    conversationId: string;
    waMessageId: string;
    texto: string | null;
    waTimestamp: string | null;
}, log?: Logger): Promise<{ automatico: boolean; previosSinMarca: EchoGuardado[] }> {
    const normalizado = normalizarTextoEcho(params.texto);
    if (normalizado.length < ECHO_AUTOMATICO_MIN_LARGO) return { automatico: false, previosSinMarca: [] };

    const hasta = params.waTimestamp ? new Date(params.waTimestamp).getTime() : Date.now();
    // Echo = saliente con ai_generated=false y `to` en el payload. Los del bot
    // no traen `to` (64 filas el 2026-10-03, ninguna con él).
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, wa_message_id, conversation_id, text_body, payload')
        .eq('integration_id', params.integrationId)
        .eq('direction', 'outbound')
        .eq('ai_generated', false)
        .not('payload->to', 'is', null)
        .not('text_body', 'is', null)
        .gte('wa_timestamp', new Date(hasta - ECHO_AUTOMATICO_VENTANA_MS).toISOString())
        .lte('wa_timestamp', new Date(hasta).toISOString())
        .limit(5000);
    if (error) {
        log?.warn({ err: error.message }, 'WhatsApp: no se pudo evaluar si el echo es automático');
        return { automatico: false, previosSinMarca: [] };
    }

    // Meta repite echos: el mismo wa_message_id no es otro contacto.
    const iguales = ((data ?? []) as EchoGuardado[]).filter((r) =>
        r.wa_message_id !== params.waMessageId && normalizarTextoEcho(r.text_body) === normalizado);
    const contactos = new Set([params.conversationId, ...iguales.map((r) => r.conversation_id)]);
    const automatico = esTextoAutomatico(normalizado, contactos.size);
    return { automatico, previosSinMarca: automatico ? iguales.filter((r) => !esSalienteAutomatico(r)) : [] };
}

/** Agrega `automatico: true` al payload de echos ya guardados. */
export async function marcarEchosAutomaticos(echos: { id: string; payload: any }[]): Promise<number> {
    let marcados = 0;
    for (const e of echos) {
        const { error } = await supabase.from('whatsapp_messages')
            .update({ payload: { ...(e.payload ?? {}), automatico: true } })
            .eq('id', e.id);
        if (!error) marcados++;
    }
    return marcados;
}

/**
 * Regla de `reabrirSiSoloRespondioLaApp` sobre los mensajes del hilo: lo
 * ÚLTIMO es un saliente automático y hay un entrante posterior a la última
 * respuesta de una persona (o ninguna persona respondió nunca).
 *
 * Una conversación cerrada a mano tras un "ok, gracias" no se reabre: ahí lo
 * último es el entrante, no el automático.
 */
export function necesitaReabrir(
    msgs: { direction: string; wa_timestamp?: string | null; created_at?: string | null; payload?: any }[],
): boolean {
    const t = (m: { wa_timestamp?: string | null; created_at?: string | null }) =>
        new Date(m.wa_timestamp ?? m.created_at ?? 0).getTime();
    const orden = [...msgs].sort((a, b) => t(b) - t(a));
    const ultimo = orden[0];
    if (!ultimo || ultimo.direction !== 'outbound' || !esSalienteAutomatico(ultimo)) return false;
    const entrante = orden.find((m) => m.direction === 'inbound');
    if (!entrante) return false;
    const humano = orden.find((m) => m.direction === 'outbound' && !esSalienteAutomatico(m));
    return !humano || t(entrante) > t(humano);
}

/**
 * Reabre las conversaciones 'closed' que cerró un echo automático tomado por
 * humano (los dos primeros saludos, antes de llegar al umbral). Devuelve las
 * que reabrió.
 */
export async function reabrirSiSoloRespondioLaApp(conversationIds: string[]): Promise<string[]> {
    const reabiertas: string[] = [];
    for (const id of [...new Set(conversationIds)]) {
        const { data: conv } = await supabase.from('whatsapp_conversations')
            .select('id, status').eq('id', id).maybeSingle();
        if ((conv as any)?.status !== 'closed') continue;

        // wa_timestamp está en las 682 filas (2026-10-03), bot incluido.
        const { data: msgs } = await supabase.from('whatsapp_messages')
            .select('direction, wa_timestamp, created_at, payload')
            .eq('conversation_id', id)
            .order('wa_timestamp', { ascending: false, nullsFirst: false })
            .limit(50);
        if (!necesitaReabrir((msgs ?? []) as any[])) continue;

        const { error } = await supabase.from('whatsapp_conversations')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', id).eq('status', 'closed');
        if (!error) reabiertas.push(id);
    }
    return reabiertas;
}

/**
 * `smb_message_echoes`: la escuela escribió desde su celular.
 */
export async function procesarEchos(body: any, log?: Logger): Promise<void> {
    for (const entry of body?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
            if (change?.field !== 'smb_message_echoes') continue;
            const v = change.value ?? {};
            const echos = Array.isArray(v.message_echoes) ? v.message_echoes : [];
            if (!echos.length) continue;

            const integration = await resolveIntegration(v?.metadata?.phone_number_id);
            if (!integration) continue;

            for (const e of echos) {
                // `to` es la familia; `from` es el número de la escuela.
                const contacto = String(e?.to ?? '');
                if (!contacto || !e?.id) continue;

                const conv = await conversacionConTipo(integration, contacto);
                if (!conv) continue;
                const convId = conv.id;

                // Contacto personal: solo metadatos (ver arriba). Sin texto no
                // hay saludo automático que detectar.
                const texto = conv.personal ? null : textoDe(e);
                const waTimestamp = tsDe(e?.timestamp);
                // Saludo / ausencia de la app del negocio: se guarda igual (es
                // parte del hilo) pero marcado, y NO cierra la conversación.
                const { automatico, previosSinMarca } = conv.personal
                    ? { automatico: false, previosSinMarca: [] as EchoGuardado[] }
                    : await esEchoAutomatico({
                        integrationId: integration.id, conversationId: convId,
                        waMessageId: String(e.id), texto, waTimestamp,
                    }, log);

                await guardarMensaje({
                    conversationId: convId,
                    integrationId: integration.id,
                    waMessageId: String(e.id),
                    direction: 'outbound',
                    type: String(e?.type ?? 'text'),
                    textBody: texto,
                    // `to` se conserva: es lo que distingue un eco de un saliente del bot.
                    payload: conv.personal ? payloadSinContenido(e) : (automatico ? { ...e, automatico: true } : e),
                    waTimestamp,
                    status: 'sent',
                });

                if (automatico) {
                    // El 3.er contacto destapa que el texto era plantilla: los
                    // anteriores se guardaron como humanos y cerraron su hilo.
                    if (previosSinMarca.length) {
                        await marcarEchosAutomaticos(previosSinMarca);
                        const reabiertas = await reabrirSiSoloRespondioLaApp(
                            previosSinMarca.map((p) => p.conversation_id));
                        log?.info({ integrationId: integration.id, marcados: previosSinMarca.length,
                                    reabiertas: reabiertas.length },
                                  'WhatsApp: echos anteriores marcados como automáticos');
                    }
                    continue;
                }

                // Una persona ya respondió desde el celular: la conversación
                // queda atendida. Sin esto, el buzón seguiría marcándola como
                // pendiente aunque la dueña la haya atendido, y le llegarían
                // avisos por algo que ya resolvió.
                //
                // Antes se escribía status='active', que el CHECK de la tabla no
                // admite (open|snoozed|closed): el UPDATE fallaba en silencio y
                // por eso el 2026-10-03 las 55 conversaciones de Dynasty
                // seguían 'open' con 193 echos guardados. Ahora 'closed'; si la
                // familia vuelve a escribir, wa_ingest_inbound_message la reabre.
                const { error: errCierre } = await supabase.from('whatsapp_conversations')
                    .update({ status: 'closed', unread_count: 0, updated_at: new Date().toISOString() })
                    .eq('id', convId)
                    .eq('status', 'open');
                if (errCierre) {
                    log?.warn({ convId, err: errCierre.message }, 'WhatsApp: no se pudo cerrar tras el echo');
                }
            }

            log?.info({ integrationId: integration.id, echos: echos.length },
                      'WhatsApp: echos de la app del negocio');
        }
    }
}

/**
 * `history`: hasta 6 meses de conversaciones anteriores, en trozos.
 *
 * Meta da **24 horas** desde el alta para sincronizarlo; pasadas, hay que
 * desconectar a la escuela y repetir. Por eso esto entra por el webhook y se
 * procesa al vuelo, sin diferirlo a un cron.
 */
export async function procesarHistorial(body: any, log?: Logger): Promise<void> {
    for (const entry of body?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
            if (change?.field !== 'history') continue;
            const v = change.value ?? {};
            const bloques = Array.isArray(v.history) ? v.history : [];
            if (!bloques.length) continue;

            const integration = await resolveIntegration(v?.metadata?.phone_number_id);
            if (!integration) continue;

            // El numero de la escuela, para saber quien escribio cada mensaje.
            const propio = String(v?.metadata?.display_phone_number ?? '').replace(/\D/g, '');

            let guardados = 0;
            for (const bloque of bloques) {
                for (const hilo of bloque?.threads ?? []) {
                    const contacto = String(hilo?.id ?? '');
                    if (!contacto) continue;
                    const conv = await conversacionConTipo(integration, contacto);
                    if (!conv) continue;
                    const convId = conv.id;

                    for (const m of hilo?.messages ?? []) {
                        if (!m?.id) continue;
                        // La documentacion lo dice asi: si `from` es el numero
                        // del negocio, lo mando el negocio; si no, la familia.
                        const de = String(m?.from ?? '').replace(/\D/g, '');
                        const saliente = propio !== '' && de === propio;

                        await guardarMensaje({
                            conversationId: convId,
                            integrationId: integration.id,
                            waMessageId: String(m.id),
                            direction: saliente ? 'outbound' : 'inbound',
                            type: String(m?.type ?? 'text'),
                            textBody: conv.personal ? null : textoDe(m),
                            payload: conv.personal ? payloadSinContenido(m) : m,
                            waTimestamp: tsDe(m?.timestamp),
                            status: m?.history_context?.status ?? null,
                        });
                        guardados++;
                    }
                }

                const meta = bloque?.metadata ?? {};
                log?.info({
                    integrationId: integration.id,
                    fase: meta.phase, trozo: meta.chunk_order, avance: meta.progress,
                }, 'WhatsApp: trozo de historial');

                // `progress: 100` es la senial de que termino. Se registra para
                // poder responder "¿ya sincronizo?" sin adivinar.
                if (Number(meta.progress) === 100) {
                    log?.info({ integrationId: integration.id },
                              'WhatsApp: historial sincronizado por completo');
                }
            }

            log?.info({ integrationId: integration.id, mensajes: guardados },
                      'WhatsApp: historial procesado');
        }
    }
}

/**
 * `smb_app_state_sync`: los contactos de la agenda del negocio.
 *
 * NO se procesa todavia, a proposito. Serviria para mostrar "Carolina" en vez
 * del telefono en el buzon, pero no verifique la forma del payload contra la
 * documentacion y no voy a adivinarla: un parseo equivocado guarda basura en
 * silencio, que es peor que no guardar nada.
 *
 * Se registra que llego, para saber si Meta los esta mandando.
 */
export function registrarAppState(body: any, log?: Logger): void {
    for (const entry of body?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
            if (change?.field !== 'smb_app_state_sync') continue;
            log?.info({ claves: Object.keys(change?.value ?? {}) },
                      'WhatsApp: smb_app_state_sync recibido (sin procesar todavia)');
        }
    }
}
