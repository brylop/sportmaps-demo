/**
 * webhook-events.service — Log persistente + dedup de eventos de webhook.
 *
 * Fix H-03/H-04 (auditoria de duplicacion). Cada handler de webhook:
 *   1. recordWebhookEvent(...) ANTES de procesar. Si !firstSeen -> ya visto,
 *      responder already_processed (dedup por (provider, event_id)).
 *   2. Al terminar: markWebhookProcessed / markWebhookOrphan / markWebhookFailed.
 *
 * 'orphan' = el evento llego pero la entidad local aun no existe; NO se pierde,
 * un cron de reproceso lo reintenta (en vez del viejo 200 "ignored" que la
 * pasarela no reintentaba).
 *
 * Corre siempre con service_role (RLS bypass); nunca en contexto de usuario.
 */

import { supabase } from '../config/supabase';

export type WebhookProvider = 'wompi' | 'mercadopago' | 'epayco';

const DEFAULT_RETRY_SECONDS = 5 * 60; // 5 min

export interface RecordWebhookArgs {
    provider: WebhookProvider;
    eventId: string;           // id estable del evento (ej: `${txId}:${status}`)
    reference?: string | null;
    eventType?: string | null;
    payload?: unknown;
}

/**
 * Registra el evento de forma idempotente. Devuelve firstSeen=false si ya
 * existia (mismo provider+event_id) -> el caller debe cortar sin reprocesar.
 */
export async function recordWebhookEvent(
    args: RecordWebhookArgs,
): Promise<{ firstSeen: boolean; id: string | null }> {
    const { provider, eventId, reference = null, eventType = null, payload = null } = args;

    const { data, error } = await supabase
        .from('webhook_events')
        .upsert(
            {
                provider,
                event_id: eventId,
                reference,
                event_type: eventType,
                payload,
                status: 'received',
            },
            { onConflict: 'provider,event_id', ignoreDuplicates: true },
        )
        .select('id')
        .maybeSingle();

    if (error) {
        // No bloquear el flujo de pago por un fallo de logging; tratar como
        // "first seen" para que el procesamiento siga (el dedup real de fondo
        // sigue estando en los UNIQUE de payment_splits / provider_reference).
        console.error('[webhook-events] recordWebhookEvent failed:', error.message);
        return { firstSeen: true, id: null };
    }

    // Con ignoreDuplicates, un evento repetido devuelve data=null.
    return { firstSeen: !!data, id: data?.id ?? null };
}

export async function markWebhookProcessed(id: string | null): Promise<void> {
    if (!id) return;
    await supabase
        .from('webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null, next_retry_at: null })
        .eq('id', id);
}

export async function markWebhookIgnored(id: string | null, reason?: string): Promise<void> {
    if (!id) return;
    await supabase
        .from('webhook_events')
        .update({ status: 'ignored', last_error: reason ?? null, next_retry_at: null })
        .eq('id', id);
}

/**
 * El evento llego pero la entidad local aun no existe. Marcar para reproceso
 * (no perder el evento). retryInSeconds define cuando vuelve a ser elegible.
 */
export async function markWebhookOrphan(
    id: string | null,
    error?: string,
    retryInSeconds = DEFAULT_RETRY_SECONDS,
): Promise<void> {
    if (!id) return;
    await supabase
        .from('webhook_events')
        .update({
            status: 'orphan',
            last_error: error ?? 'entity_not_found',
            next_retry_at: new Date(Date.now() + retryInSeconds * 1000).toISOString(),
        })
        .eq('id', id);
}

export async function markWebhookFailed(
    id: string | null,
    error?: string,
    retryInSeconds = DEFAULT_RETRY_SECONDS,
): Promise<void> {
    if (!id) return;
    await supabase
        .from('webhook_events')
        .update({
            status: 'failed',
            last_error: error ?? 'processing_failed',
            next_retry_at: new Date(Date.now() + retryInSeconds * 1000).toISOString(),
        })
        .eq('id', id);
}
