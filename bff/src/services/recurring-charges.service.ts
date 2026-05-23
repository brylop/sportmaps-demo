/**
 * recurring-charges.service — Runner que ejecuta cobros recurrentes.
 *
 * Lo dispara la Edge Function `run-recurring-charges` (que a su vez la
 * dispara pg_cron). Tambien se puede invocar manualmente desde el endpoint
 * POST /api/v1/recurring/run (protegido por cron secret).
 *
 * Flujo por cada sub vencida:
 *   1. claim_due_recurring_subscriptions(limit)  — FOR UPDATE SKIP LOCKED
 *   2. resolver credenciales del provider de la escuela
 *   3. cobrar con tarjeta guardada (MP: chargeMpSavedCard, Wompi: createTransactionWithToken)
 *   4. insertar payment (status='paid' o 'failed')
 *   5. record_recurring_attempt — avanza next_charge_at o programa retry
 *
 * Idempotencia: cada intento usa una idempotency_key derivada de
 *   subscription_id + next_charge_at, de modo que un re-run no cobra dos veces.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase';
import {
    chargeMpSavedCard,
    generateMpReference,
} from './mercadopago.service';
import {
    createTransactionWithPaymentSource,
    copToCents,
} from './wompi.service';
import type { PaymentProvider } from './payment-provider.resolver';

const MP_NOTIFICATION_URL = process.env.MP_NOTIFICATION_URL
    ?? `${process.env.BFF_PUBLIC_URL ?? ''}/api/v1/webhooks/mercadopago`;

interface DueSubscription {
    subscription_id: string;
    school_id: string;
    user_id: string;
    child_id: string | null;
    amount: number;
    currency: string;
    concept: string;
    payment_token_id: string;
    payment_provider: PaymentProvider;
    provider_token: string | null;
    provider_customer_id: string | null;
    provider_card_id: string | null;
    provider_payment_source_id: number | null;
    user_email: string | null;
}

export interface RunResult {
    processed: number;
    success: number;
    failed: number;
    errors: Array<{ subscriptionId: string; error: string }>;
}

/**
 * Carga el access_token y demas credenciales del provider para una escuela.
 * Si la escuela ya no tiene ese provider habilitado, retorna null.
 */
async function loadSchoolProviderCreds(schoolId: string, provider: PaymentProvider): Promise<{
    accessToken: string;
    publicKey: string;
} | null> {
    const { data, error } = await supabase
        .from('school_payment_providers')
        .select('access_token, public_key, enabled')
        .eq('school_id', schoolId)
        .eq('provider', provider)
        .eq('enabled', true)
        .maybeSingle();

    if (error || !data?.access_token) return null;
    return { accessToken: data.access_token, publicKey: data.public_key };
}

/**
 * Inserta un payment registrando el resultado del cobro recurrente.
 * Devuelve el id del payment para vincularlo al attempt.
 */
async function insertRecurringPayment(args: {
    sub: DueSubscription;
    status: 'paid' | 'failed';
    providerPaymentId: string | null;
    providerReference: string;
}): Promise<string | null> {
    const { sub, status, providerPaymentId, providerReference } = args;

    const { data, error } = await supabase
        .from('payments')
        .insert({
            school_id: sub.school_id,
            parent_id: sub.user_id,
            child_id: sub.child_id,
            concept: sub.concept,
            amount: sub.amount,
            amount_paid: status === 'paid' ? sub.amount : null,
            due_date: new Date().toISOString().slice(0, 10),
            payment_date: status === 'paid' ? new Date().toISOString().slice(0, 10) : null,
            status,
            payment_type: 'subscription',
            payment_method: 'card',
            payment_provider: sub.payment_provider,
            provider_reference: providerReference,
            provider_transaction_id: providerPaymentId,
            // wompi_id se mantiene por compat: solo si es wompi
            wompi_id: sub.payment_provider === 'wompi' ? providerPaymentId : null,
        })
        .select('id')
        .single();

    if (error) {
        console.error('[recurring-charges] insert payment failed:', error.message);
        return null;
    }
    return data?.id ?? null;
}

/**
 * Cobra una sola sub. Aislada para que un fallo no tumbe al resto del batch.
 */
async function chargeOne(sub: DueSubscription): Promise<{ ok: boolean; error?: string }> {
    // Idempotency key estable por (sub, periodo): si Edge Function se re-dispara, MP/Wompi
    // ignoran el segundo intento.
    const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${sub.subscription_id}:${new Date().toISOString().slice(0, 7)}`)
        .digest('hex');

    const creds = await loadSchoolProviderCreds(sub.school_id, sub.payment_provider);
    if (!creds) {
        await supabase.rpc('record_recurring_attempt', {
            p_subscription_id: sub.subscription_id,
            p_status: 'failed',
            p_amount: sub.amount,
            p_payment_provider: sub.payment_provider,
            p_error_code: 'school_provider_disabled',
            p_error_message: `Escuela ya no tiene ${sub.payment_provider} habilitado`,
            p_idempotency_key: idempotencyKey,
        });
        return { ok: false, error: 'school_provider_disabled' };
    }

    let providerPaymentId: string | null = null;
    let chargeOk = false;
    let errorMsg: string | null = null;
    let rawResponse: any = null;
    let providerReference: string;

    if (sub.payment_provider === 'mercadopago') {
        providerReference = generateMpReference('subscription');
        if (!sub.provider_customer_id || !sub.provider_card_id) {
            errorMsg = 'mp_token_missing_customer_or_card';
        } else if (!sub.user_email) {
            errorMsg = 'user_email_missing';
        } else {
            const res = await chargeMpSavedCard({
                accessToken: creds.accessToken,
                customerId: sub.provider_customer_id,
                cardId: sub.provider_card_id,
                transactionAmount: Number(sub.amount),
                description: sub.concept,
                payerEmail: sub.user_email,
                externalReference: providerReference,
                notificationUrl: MP_NOTIFICATION_URL,
                idempotencyKey,
            });
            rawResponse = res;
            if (res.ok) {
                providerPaymentId = String(res.payment.id);
                chargeOk = res.payment.status === 'approved';
                if (!chargeOk) errorMsg = `mp_status_${res.payment.status}`;
            } else {
                errorMsg = res.error;
            }
        }
    } else {
        // Wompi autopay via payment_source_id (POST /v1/payment_sources).
        // Reference deterministica por (sub, mes): si el cron se re-dispara
        // a mitad de proceso, Wompi devuelve 422 "duplicate reference" y la
        // funcion del service captura ese caso buscando la tx original.
        // Eso garantiza idempotencia real (no solo idempotency_key del
        // record_recurring_attempt, sino TAMBIEN en Wompi).
        const periodKey = new Date().toISOString().slice(0, 7); // YYYY-MM
        const subShort = sub.subscription_id.slice(0, 8);
        providerReference = `SUB-${subShort}-${periodKey}`;

        if (!sub.provider_payment_source_id) {
            errorMsg = 'wompi_payment_source_missing';
        } else if (!sub.user_email) {
            errorMsg = 'user_email_missing';
        } else {
            const res = await createTransactionWithPaymentSource({
                paymentSourceId: sub.provider_payment_source_id,
                amountInCents: copToCents(Number(sub.amount)),
                reference: providerReference,
                customerEmail: sub.user_email,
                installments: 1,
            });
            rawResponse = res;
            if (res.ok) {
                providerPaymentId = res.transactionId;
                chargeOk = res.status === 'APPROVED';
                if (!chargeOk) errorMsg = `wompi_status_${res.status}`;
            } else {
                errorMsg = res.error;
            }
        }
    }

    const paymentId = await insertRecurringPayment({
        sub,
        status: chargeOk ? 'paid' : 'failed',
        providerPaymentId,
        providerReference,
    });

    await supabase.rpc('record_recurring_attempt', {
        p_subscription_id: sub.subscription_id,
        p_status: chargeOk ? 'success' : 'failed',
        p_amount: sub.amount,
        p_payment_provider: sub.payment_provider,
        p_provider_payment_id: providerPaymentId,
        p_error_code: chargeOk ? null : 'charge_failed',
        p_error_message: errorMsg,
        p_idempotency_key: idempotencyKey,
        p_raw_response: rawResponse,
        p_payment_id: paymentId,
    });

    return chargeOk ? { ok: true } : { ok: false, error: errorMsg ?? 'unknown' };
}

/**
 * Procesa hasta `limit` subscripciones vencidas. Se llama desde el endpoint
 * POST /api/v1/recurring/run (que dispara la Edge Function `run-recurring-charges`).
 */
export async function runDueRecurringCharges(limit = 50): Promise<RunResult> {
    const { data, error } = await supabase.rpc('claim_due_recurring_subscriptions', { p_limit: limit });
    if (error) {
        throw new Error(`claim_due_recurring_subscriptions failed: ${error.message}`);
    }

    const subs = (data ?? []) as DueSubscription[];
    const result: RunResult = { processed: subs.length, success: 0, failed: 0, errors: [] };

    for (const sub of subs) {
        try {
            const res = await chargeOne(sub);
            if (res.ok) result.success += 1;
            else {
                result.failed += 1;
                result.errors.push({ subscriptionId: sub.subscription_id, error: res.error ?? 'unknown' });
            }
        } catch (err: any) {
            result.failed += 1;
            result.errors.push({ subscriptionId: sub.subscription_id, error: err?.message ?? 'exception' });
            console.error('[recurring-charges] chargeOne threw', err);
        }
    }

    return result;
}
