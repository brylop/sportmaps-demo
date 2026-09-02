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
import { resolveProvider, type PaymentProvider } from './payment-provider.resolver';
import { todayInZone } from '../utils/businessDate';

const MP_NOTIFICATION_URL = process.env.MP_NOTIFICATION_URL
    ?? `${process.env.BFF_PUBLIC_URL ?? ''}/api/v1/webhooks/mercadopago`;

interface DueSubscription {
    subscription_id: string;
    school_id: string | null;
    vendor_profile_id: string | null;
    subscription_plan_id: string | null;
    user_id: string;
    child_id: string | null;
    amount: number;
    currency: string;
    concept: string;
    billing_period: string | null;
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

interface ProviderCreds {
    accessToken: string;
    publicKey: string;
}

/**
 * Carga el access_token del provider para una escuela. Si la escuela ya no
 * tiene ese provider habilitado, retorna null y el cobro falla con
 * 'school_provider_disabled'.
 */
async function loadSchoolProviderCreds(schoolId: string, provider: PaymentProvider): Promise<ProviderCreds | null> {
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
 * Carga el access_token del provider para un vendor del marketplace.
 *
 * `vendor_payment_providers.vendor_id` apunta a `auth.users(id)` (el dueno
 * del vendor_profile), no al vendor_profile.id. Resolvemos el user_id antes
 * de consultar el resolver para que el lookup acierte.
 *
 * Si el vendor no tiene config propia, el resolver cae al marketplace
 * global (Wompi/MP de SportMaps) y la plata entra a la cuenta SportMaps
 * — luego se distribuye al vendor via vendor_payouts.
 */
async function loadVendorProviderCreds(vendorProfileId: string, provider: PaymentProvider): Promise<ProviderCreds | null> {
    const { data: vp } = await supabase
        .from('vendor_profiles')
        .select('user_id')
        .eq('id', vendorProfileId)
        .maybeSingle();

    const ownerUserId = (vp as any)?.user_id as string | undefined;
    if (!ownerUserId) return null;

    const resolved = await resolveProvider({ vendorId: ownerUserId, preferredProvider: provider });
    if (!resolved?.accessToken) return null;
    if (resolved.provider !== provider) return null;
    return { accessToken: resolved.accessToken, publicKey: resolved.publicKey };
}

/**
 * Inserta el registro contable del cobro recurrente.
 *
 * - School mode (sub.school_id no nulo): fila en `payments`, vinculada a
 *   parent/child/school. Es la tabla que ven los staff de la escuela.
 * - Vendor mode (sub.vendor_profile_id no nulo): fila en
 *   `marketplace_transactions` con checkout_type='subscription', que es
 *   el ledger unificado que alimenta vendor_payouts.
 *
 * Devuelve el id de la fila creada (payment_id o marketplace_transaction_id
 * segun el caso) para vincularlo al recurring_charge_attempts. En vendor
 * mode `payment_id` en attempts queda NULL (esa columna apunta a payments).
 */
async function insertRecurringLedgerRow(args: {
    sub: DueSubscription;
    status: 'paid' | 'failed';
    providerPaymentId: string | null;
    providerReference: string;
}): Promise<{ paymentId: string | null; marketplaceTxId: string | null }> {
    const { sub, status, providerPaymentId, providerReference } = args;

    // ─── School mode ─────────────────────────────────────────────────
    if (sub.school_id) {
        // Bloqueador B (docs/specs/vigencia-cobranza-y-sesiones-unificado.md
        // §3.2): este INSERT crea la fila ya en 'paid' — sin offering_plan_id,
        // trg_extend_enrollment_on_payment_paid nunca extiende expires_at.
        // Solo aplica si cobró; un intento fallido no debería consultar nada.
        let offeringPlanId: string | null = null;
        if (status === 'paid') {
            const athleteMatch = sub.child_id ? { child_id: sub.child_id } : { user_id: sub.user_id };
            const { data: enr } = await supabase
                .from('enrollments')
                .select('offering_plan_id')
                .eq('school_id', sub.school_id)
                .eq('status', 'active')
                .match(athleteMatch)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            offeringPlanId = (enr as any)?.offering_plan_id ?? null;
        }

        const { data, error } = await supabase
            .from('payments')
            .insert({
                school_id: sub.school_id,
                parent_id: sub.user_id,
                child_id: sub.child_id,
                offering_plan_id: offeringPlanId,
                concept: sub.concept,
                amount: sub.amount,
                amount_paid: status === 'paid' ? sub.amount : null,
                // Hora Colombia, no UTC: el cron de autopay corre en Render con el
                // reloj en UTC, así que un cobro después de las 7 p.m. quedaba
                // fechado MAÑANA. Ver utils/businessDate.
                due_date: todayInZone(),
                payment_date: status === 'paid' ? todayInZone() : null,
                status,
                payment_type: 'subscription',
                payment_method: 'card',
                payment_provider: sub.payment_provider,
                provider_reference: providerReference,
                provider_transaction_id: providerPaymentId,
                wompi_id: sub.payment_provider === 'wompi' ? providerPaymentId : null,
            })
            .select('id')
            .single();

        if (error) {
            console.error('[recurring-charges] insert payment failed:', error.message);
            return { paymentId: null, marketplaceTxId: null };
        }
        return { paymentId: data?.id ?? null, marketplaceTxId: null };
    }

    // ─── Vendor mode ─────────────────────────────────────────────────
    const grossAmount = Number(sub.amount);
    const { data, error } = await supabase
        .from('marketplace_transactions')
        .insert({
            checkout_type: 'subscription',
            user_id: sub.user_id,
            vendor_profile_id: sub.vendor_profile_id,
            // gross = monto cobrado. platform_fee / take_rate se calcula en
            // otra tanda — por ahora net = gross y los payouts pueden
            // descontar comision via reglas separadas.
            gross_amount: grossAmount,
            platform_fee: 0,
            gateway_fee: 0,
            tax_amount: 0,
            net_amount: grossAmount,
            currency: sub.currency,
            payment_provider: sub.payment_provider,
            provider_reference: providerReference,
            provider_transaction_id: providerPaymentId,
            wompi_reference: sub.payment_provider === 'wompi' ? providerReference : null,
            wompi_transaction_id: sub.payment_provider === 'wompi' ? providerPaymentId : null,
            payment_method: 'card',
            status: status === 'paid' ? 'paid' : 'failed',
            paid_at: status === 'paid' ? new Date().toISOString() : null,
            description: sub.concept,
            metadata: {
                source: 'recurring_subscription',
                subscription_id: sub.subscription_id,
                subscription_plan_id: sub.subscription_plan_id,
                billing_period: sub.billing_period,
            },
        })
        .select('id')
        .single();

    if (error) {
        console.error('[recurring-charges] insert marketplace_transaction failed:', error.message);
        return { paymentId: null, marketplaceTxId: null };
    }
    return { paymentId: null, marketplaceTxId: data?.id ?? null };
}

/**
 * Cobra una sola sub. Aislada para que un fallo no tumbe al resto del batch.
 *
 * Bifurcacion school vs vendor:
 *   - school mode: credenciales de school_payment_providers; ledger -> payments.
 *   - vendor mode: credenciales de vendor_payment_providers (o marketplace
 *     global como fallback); ledger -> marketplace_transactions.
 *
 * Idempotency key depende del billing_period (semanal usa la semana ISO,
 * mensual el YYYY-MM, etc) para que un re-run dentro del mismo ciclo no
 * cobre dos veces.
 */
async function chargeOne(sub: DueSubscription): Promise<{ ok: boolean; error?: string }> {
    const isVendorMode = !!sub.vendor_profile_id;

    // Periodo para idempotencia: el slice depende del billing_period para
    // que weekly y monthly no compartan la misma key dentro del mismo mes.
    const now = new Date();
    let periodKey: string;
    switch (sub.billing_period) {
        case 'weekly':
        case 'biweekly': {
            // ISO week number — simple aproximacion suficiente para idempotencia
            const start = new Date(now.getFullYear(), 0, 1).getTime();
            const days = Math.floor((now.getTime() - start) / (24 * 60 * 60 * 1000));
            const week = Math.floor(days / 7);
            periodKey = `${now.getFullYear()}-W${week}`;
            break;
        }
        case 'quarterly': {
            const quarter = Math.floor(now.getMonth() / 3) + 1;
            periodKey = `${now.getFullYear()}-Q${quarter}`;
            break;
        }
        case 'yearly':
            periodKey = `${now.getFullYear()}`;
            break;
        default:
            periodKey = now.toISOString().slice(0, 7); // YYYY-MM
    }

    // Numero de intento actual. Incluirlo en la key hace que un REINTENTO del
    // mismo mes sea una operacion nueva ante el proveedor: sin esto, MP/Wompi
    // replayan el resultado del 1er intento (misma key/reference) y el reintento
    // no vuelve a cobrar aunque la tarjeta ya tenga fondos. A la vez, un doble
    // disparo del cron el MISMO dia comparte failed_attempts -> misma key ->
    // sigue deduplicado (no doble cobro). Ver auditoria H-07.
    const { data: subRow } = await supabase
        .from('recurring_subscriptions')
        .select('failed_attempts')
        .eq('id', sub.subscription_id)
        .maybeSingle();
    const attemptNo = (subRow as any)?.failed_attempts ?? 0;

    const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${sub.subscription_id}:${periodKey}:a${attemptNo}`)
        .digest('hex');

    // Cargar credenciales segun el modo de la sub.
    const creds = isVendorMode
        ? await loadVendorProviderCreds(sub.vendor_profile_id as string, sub.payment_provider)
        : await loadSchoolProviderCreds(sub.school_id as string, sub.payment_provider);

    if (!creds) {
        const errCode = isVendorMode ? 'vendor_provider_disabled' : 'school_provider_disabled';
        const errMsg = isVendorMode
            ? `Vendor no tiene ${sub.payment_provider} habilitado ni marketplace global configurado`
            : `Escuela ya no tiene ${sub.payment_provider} habilitado`;
        await supabase.rpc('record_recurring_attempt', {
            p_subscription_id: sub.subscription_id,
            p_status: 'failed',
            p_amount: sub.amount,
            p_payment_provider: sub.payment_provider,
            p_error_code: errCode,
            p_error_message: errMsg,
            p_idempotency_key: idempotencyKey,
        });
        return { ok: false, error: errCode };
    }

    let providerPaymentId: string | null = null;
    let chargeOk = false;
    let errorMsg: string | null = null;
    let rawResponse: any = null;
    let providerReference: string;

    if (sub.payment_provider === 'mercadopago') {
        providerReference = generateMpReference(isVendorMode ? 'vendor_sub' : 'subscription');
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
        // Reference deterministica por (sub, periodo): si el cron se re-dispara
        // a mitad de proceso, Wompi devuelve 422 "duplicate reference" y la
        // funcion del service captura ese caso buscando la tx original.
        // Eso garantiza idempotencia real (no solo via idempotency_key, sino
        // TAMBIEN en Wompi). El periodKey ya esta calculado arriba segun
        // billing_period (weekly/monthly/etc).
        const subShort = sub.subscription_id.slice(0, 8);
        // Incluir attemptNo: un reintento necesita reference nueva o Wompi
        // devuelve 422 duplicate y recupera la tx fallida (no re-cobra). El
        // prefijo (1er segmento) sigue siendo SUB/VSUB para el routing del webhook.
        providerReference = `${isVendorMode ? 'VSUB' : 'SUB'}-${subShort}-${periodKey}-a${attemptNo}`;

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

    const ledger = await insertRecurringLedgerRow({
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
        // payment_id apunta a payments — solo poblado en school mode.
        // Para vendor mode el ledger es marketplace_transactions; se rastrea
        // via attempts.raw_response y los logs del runner.
        p_payment_id: ledger.paymentId,
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

/**
 * Cobra UNA sub especifica si esta vencida. La usa el endpoint
 * POST /recurring/subscriptions para disparar el primer cobro sincronamente
 * justo despues de crear una sub en vendor mode (next_charge_at = now()).
 *
 * Si la sub no esta vencida o ya fue tomada por el cron (SKIP LOCKED),
 * devuelve `{ ok: true, skipped: true }` y el cron la procesara en el
 * siguiente tick. No es un error.
 */
export async function chargeRecurringSubscriptionById(subId: string): Promise<{
    ok: boolean;
    skipped?: boolean;
    error?: string;
}> {
    const { data, error } = await supabase.rpc('claim_single_due_recurring_subscription', { p_sub_id: subId });
    if (error) {
        throw new Error(`claim_single_due_recurring_subscription failed: ${error.message}`);
    }

    const subs = (data ?? []) as DueSubscription[];
    if (subs.length === 0) {
        return { ok: true, skipped: true };
    }

    try {
        const res = await chargeOne(subs[0]);
        return res;
    } catch (err: any) {
        console.error('[recurring-charges] chargeRecurringSubscriptionById threw', err);
        return { ok: false, error: err?.message ?? 'exception' };
    }
}
