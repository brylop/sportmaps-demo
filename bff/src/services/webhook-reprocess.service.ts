/**
 * webhook-reprocess.service — Reintenta eventos de webhook 'orphan'/'failed'.
 *
 * Fix H-03: cierra el ciclo del log de webhook_events. Un evento cuya entidad
 * local aun no existia quedo 'orphan' (con payload + next_retry_at). Este
 * runner lo re-rutea por la misma logica del webhook en vivo
 * (routeWompiTransaction / routeMercadoPagoTransaction), sin perder la
 * confirmacion de pago.
 *
 * Seguro entre replicas: cada evento se "reclama" con un UPDATE condicional
 * (status sigue orphan/failed) -> solo una instancia lo toma. El reproceso es
 * idempotente (dedup de fondo por payment_splits / provider_reference y los
 * guards de estado de los confirm_* RPC).
 */

import { supabase } from '../config/supabase';
import { fetchTransaction } from './wompi.service';
import { fetchMpPayment } from './mercadopago.service';
import { routeWompiTransaction } from '../routes/wompi';
import { routeMercadoPagoTransaction } from '../routes/mercadopago';

const MAX_ATTEMPTS = 6;            // tras esto, se marca 'failed' definitivo (alerta)
const RETRY_BACKOFF_SECONDS = 10 * 60;

type Routed = { status: number; body: Record<string, unknown>; handled: boolean };

export interface ReprocessResult {
    scanned: number;
    processed: number;
    stillOrphan: number;
    failed: number;
    gaveUp: number;
}

function backoffIso(): string {
    return new Date(Date.now() + RETRY_BACKOFF_SECONDS * 1000).toISOString();
}

/**
 * Re-rutea un evento segun su provider. Devuelve null si no se pudo re-consultar
 * la transaccion a la pasarela (se reintentara luego).
 */
async function routeStoredEvent(provider: string, eventId: string, payload: unknown): Promise<Routed | null> {
    const providerTxId = String(eventId).split(':')[0];

    if (provider === 'wompi') {
        const realTx = await fetchTransaction(providerTxId).catch(() => null);
        if (!realTx) return null;
        return routeWompiTransaction({ realTx, body: payload });
    }

    if (provider === 'mercadopago') {
        const token = process.env.MP_ACCESS_TOKEN_DEFAULT;
        if (!token) return null;
        const payment = await fetchMpPayment(providerTxId, token).catch(() => null);
        if (!payment) return null;
        return routeMercadoPagoTransaction({ payment });
    }

    // Provider no soportado por el reproceso.
    return null;
}

export async function reprocessOrphanWebhooks(limit = 50): Promise<ReprocessResult> {
    const result: ReprocessResult = { scanned: 0, processed: 0, stillOrphan: 0, failed: 0, gaveUp: 0 };
    const nowIso = new Date().toISOString();

    const { data: candidates, error } = await supabase
        .from('webhook_events')
        .select('id, provider, event_id, reference, payload, attempts')
        .in('status', ['orphan', 'failed'])
        .lte('next_retry_at', nowIso)
        .order('next_retry_at', { ascending: true })
        .limit(limit);

    if (error) {
        console.error('[webhook-reprocess] query failed:', error.message);
        return result;
    }

    for (const ev of candidates ?? []) {
        result.scanned += 1;

        // Claim atomico: solo procede si sigue orphan/failed (otra replica no lo tomo).
        const nextAttempt = (ev.attempts ?? 0) + 1;
        const { data: claimed } = await supabase
            .from('webhook_events')
            .update({ status: 'received', attempts: nextAttempt, updated_at: nowIso })
            .eq('id', ev.id)
            .in('status', ['orphan', 'failed'])
            .select('id')
            .maybeSingle();
        if (!claimed) continue;

        const giveUp = nextAttempt >= MAX_ATTEMPTS;

        let routed: Routed | null;
        try {
            routed = await routeStoredEvent(ev.provider, ev.event_id, ev.payload);
        } catch (err: any) {
            await supabase.from('webhook_events')
                .update({ status: 'failed', last_error: `exception:${err?.message ?? 'unknown'}`, next_retry_at: giveUp ? null : backoffIso() })
                .eq('id', ev.id);
            result.failed += 1;
            continue;
        }

        // No se pudo re-consultar la tx (o provider no soportado): reintentar luego.
        if (!routed) {
            await supabase.from('webhook_events')
                .update({ status: giveUp ? 'failed' : 'orphan', last_error: 'refetch_failed_or_unsupported', next_retry_at: giveUp ? null : backoffIso() })
                .eq('id', ev.id);
            giveUp ? (result.gaveUp += 1) : (result.stillOrphan += 1);
            continue;
        }

        const reason = typeof routed.body?.reason === 'string' ? routed.body.reason : '';

        if (!routed.handled) {
            await supabase.from('webhook_events')
                .update({ status: 'ignored', last_error: String(routed.body?.reason ?? 'unknown_prefix'), next_retry_at: null })
                .eq('id', ev.id);
        } else if (reason.endsWith('_not_found')) {
            // La entidad AUN no existe: seguir esperando o rendirse.
            await supabase.from('webhook_events')
                .update({ status: giveUp ? 'failed' : 'orphan', last_error: reason, next_retry_at: giveUp ? null : backoffIso() })
                .eq('id', ev.id);
            giveUp ? (result.gaveUp += 1) : (result.stillOrphan += 1);
        } else if (routed.status >= 500) {
            await supabase.from('webhook_events')
                .update({ status: 'failed', last_error: `handler_status_${routed.status}`, next_retry_at: giveUp ? null : backoffIso() })
                .eq('id', ev.id);
            result.failed += 1;
        } else {
            await supabase.from('webhook_events')
                .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null, next_retry_at: null })
                .eq('id', ev.id);
            result.processed += 1;
        }
    }

    return result;
}
