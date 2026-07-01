/**
 * webhook-reprocess.service — Reintenta eventos de webhook 'orphan'/'failed'.
 *
 * Fix H-03: cierra el ciclo del log de webhook_events. Un evento cuya entidad
 * local aun no existia quedo 'orphan' (con payload + next_retry_at). Este
 * runner lo re-rutea por la misma logica del webhook en vivo
 * (routeWompiTransaction), sin perder la confirmacion de pago.
 *
 * Seguro entre replicas: cada evento se "reclama" con un UPDATE condicional
 * (status sigue orphan/failed) -> solo una instancia lo toma. El reproceso es
 * idempotente (dedup de fondo por payment_splits.wompi_transaction_id y los
 * guards de estado de los confirm_* RPC).
 */

import { supabase } from '../config/supabase';
import { fetchTransaction } from './wompi.service';
import { routeWompiTransaction } from '../routes/wompi';

const MAX_ATTEMPTS = 6;            // tras esto, se marca 'failed' definitivo (alerta)
const RETRY_BACKOFF_SECONDS = 10 * 60;

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

        // Solo Wompi por ahora; MP reproceso pendiente.
        if (ev.provider !== 'wompi') {
            await supabase.from('webhook_events')
                .update({ status: 'orphan', last_error: 'reprocess_provider_unsupported', next_retry_at: backoffIso() })
                .eq('id', ev.id);
            result.stillOrphan += 1;
            continue;
        }

        // event_id = `${txId}:${status}` -> extraer txId y re-consultar a Wompi.
        const txId = String(ev.event_id).split(':')[0];
        const realTx = await fetchTransaction(txId).catch(() => null);

        const giveUp = nextAttempt >= MAX_ATTEMPTS;

        if (!realTx) {
            await supabase.from('webhook_events')
                .update({
                    status: giveUp ? 'failed' : 'orphan',
                    last_error: 'refetch_failed',
                    next_retry_at: giveUp ? null : backoffIso(),
                })
                .eq('id', ev.id);
            giveUp ? (result.gaveUp += 1) : (result.stillOrphan += 1);
            continue;
        }

        try {
            const routed = await routeWompiTransaction({ realTx, body: ev.payload });
            const reason = typeof routed.body?.reason === 'string' ? routed.body.reason : '';

            if (!routed.handled) {
                await supabase.from('webhook_events')
                    .update({ status: 'ignored', last_error: String(routed.body?.reason ?? 'unknown_prefix'), next_retry_at: null })
                    .eq('id', ev.id);
            } else if (reason.endsWith('_not_found')) {
                // Entidad AUN no existe: seguir esperando o rendirse.
                await supabase.from('webhook_events')
                    .update({
                        status: giveUp ? 'failed' : 'orphan',
                        last_error: reason,
                        next_retry_at: giveUp ? null : backoffIso(),
                    })
                    .eq('id', ev.id);
                giveUp ? (result.gaveUp += 1) : (result.stillOrphan += 1);
            } else if (routed.status >= 500) {
                await supabase.from('webhook_events')
                    .update({
                        status: 'failed',
                        last_error: `handler_status_${routed.status}`,
                        next_retry_at: giveUp ? null : backoffIso(),
                    })
                    .eq('id', ev.id);
                result.failed += 1;
            } else {
                await supabase.from('webhook_events')
                    .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null, next_retry_at: null })
                    .eq('id', ev.id);
                result.processed += 1;
            }
        } catch (err: any) {
            await supabase.from('webhook_events')
                .update({
                    status: 'failed',
                    last_error: `exception:${err?.message ?? 'unknown'}`,
                    next_retry_at: giveUp ? null : backoffIso(),
                })
                .eq('id', ev.id);
            result.failed += 1;
        }
    }

    return result;
}
