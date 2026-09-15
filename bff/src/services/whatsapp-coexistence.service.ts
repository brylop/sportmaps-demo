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

/** Texto legible de un mensaje, sea del tipo que sea. */
function textoDe(m: any): string | null {
    if (m?.text?.body) return String(m.text.body);
    if (m?.caption) return String(m.caption);
    for (const t of ['image', 'video', 'document', 'audio', 'sticker']) {
        if (m?.[t]?.caption) return String(m[t].caption);
    }
    return null;
}

/** La conversación de ese contacto, creándola si no existía. */
async function conversacionDe(
    integration: WhatsAppIntegration,
    contactWaId: string,
): Promise<string | null> {
    const { data: existente } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('integration_id', integration.id)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();
    if (existente) return (existente as any).id;

    // `uq_wa_conversation` cubre (integration_id, contact_wa_id): si dos trozos
    // del historial llegan a la vez, el segundo choca en vez de duplicar.
    const { data: creada } = await supabase
        .from('whatsapp_conversations')
        .upsert({
            integration_id: integration.id,
            school_id: integration.school_id,
            contact_wa_id: contactWaId,
            status: 'active',
        }, { onConflict: 'integration_id,contact_wa_id' })
        .select('id')
        .maybeSingle();
    return (creada as any)?.id ?? null;
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

                const convId = await conversacionDe(integration, contacto);
                if (!convId) continue;

                await guardarMensaje({
                    conversationId: convId,
                    integrationId: integration.id,
                    waMessageId: String(e.id),
                    direction: 'outbound',
                    type: String(e?.type ?? 'text'),
                    textBody: textoDe(e),
                    payload: e,
                    waTimestamp: tsDe(e?.timestamp),
                    status: 'sent',
                });

                // Una persona ya respondió: la conversación deja de estar
                // esperando. Sin esto, el buzón seguiría marcándola como
                // pendiente aunque la dueña la haya atendido desde su celular,
                // y le llegarían avisos por algo que ya resolvió.
                await supabase.from('whatsapp_conversations')
                    .update({ status: 'active', unread_count: 0, updated_at: new Date().toISOString() })
                    .eq('id', convId)
                    .eq('status', 'open');
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
                    const convId = await conversacionDe(integration, contacto);
                    if (!convId) continue;

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
                            textBody: textoDe(m),
                            payload: m,
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
