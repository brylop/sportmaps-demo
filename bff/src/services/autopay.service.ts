/**
 * autopay.service — Motor del débito automático de mensualidades (F2).
 *
 * Spec: docs/specs/debito-automatico.md §7-§10. La base (F1, mig 20261005133733 +
 * F2 20261007134859) decide QUÉ se debita y garantiza la concurrencia (claim con
 * FOR UPDATE SKIP LOCKED + un intento vivo por cobro). Este módulo hace lo que la
 * base no puede: hablar con Wompi, avisar a las familias y alertar.
 *
 * Dos corridas, disparadas por pg_cron → POST /internal/autopay/{daily|sweep}:
 *   · runDaily  (12:00 UTC): planificar + avisar (§5.1 A-B), debitar (C), red
 *                diaria de cobro doble (§8.3) y vigilancia del barrido.
 *   · runSweep  (cada 15 min): reconsultar PENDING y leases vencidos (§7.5) y
 *                vigilar que la diaria haya corrido.
 *
 * Reglas que no se negocian:
 *   · Credenciales SOLO del resolver de la escuela (fail-closed). Nunca ENV directo.
 *   · La fuente es del comercio que la creó (D11): otro comercio → no se cobra.
 *   · El débito liquida el `payments` pendiente vía payment_links (origin='autopay',
 *     referencia SCH-) y se concilia por el MISMO handler del webhook
 *     (routeWompiTransaction → handleSchoolPayment). Nunca inserta un pago.
 *   · Sin respuesta de Wompi no se decide nada: el intento queda `processing` y el
 *     barrido consulta por referencia (un reintento a ciegas = cobro doble).
 *   · Logs solo con ids, estados y códigos (§7.6).
 *
 * Todo el I/O entra por `AutopayDeps` para poder probarlo sin red ni base.
 */

import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { supabase } from '../config/supabase';
import { resolveProvider } from './payment-provider.resolver';
import {
    wompiCredsFrom,
    fetchMerchantId,
    findTransactionsByReference,
    fetchTransaction,
    createTransactionWithPaymentSource,
    fetchAcceptanceTokens,
    generateReference,
    copToCents,
    type WompiCreds,
} from './wompi.service';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Fila de autopay_plan_cycles (§5.1 A-B). */
export interface PlanRow {
    cycle_id: string;
    subscription_id: string;
    payment_id: string;
    payer_user_id: string;
    school_id: string;
    action: 'notice' | 'over_max_amount' | 'token_not_available';
    total: number | string;
    first_attempt_on: string | null;
}

/** Fila de autopay_claim_due (§5.1 C). */
export interface ClaimRow {
    attempt_id: string;
    cycle_id: string;
    payment_id: string;
    subscription_id: string;
    school_id: string;
    payer_user_id: string;
    amount: number | string;
    attempt_no: number;
    payment_token_id: string;
    provider_payment_source_id: number | string | null;
    payment_method_type: string | null;
    provider_merchant_id: string | null;
    manual_link_id: string | null;
    manual_link_reference: string | null;
}

/** Fila de autopay_sweep_due (§7.5). */
export interface SweepRow {
    attempt_id: string;
    cycle_id: string;
    payment_id: string;
    school_id: string;
    subscription_id: string;
    status: 'processing' | 'pending_provider';
    provider_transaction_id: string | null;
    provider_reference: string | null;
    payment_link_id: string | null;
    created_at: string;
    lease_expired: boolean;
}

/** Lo que hace falta para escribir un aviso. */
export interface AvisoContexto {
    payerUserId: string;
    schoolId: string;
    schoolOwnerId: string | null;
    athleteName: string;
    periodLabel: string;          // "octubre"
    methodLabel: string;          // "Nequi •••• 5678"
    maxAmount: number;
    subscriptionStatus: string;
}

export interface Aviso {
    userId: string;
    schoolId: string;
    title: string;
    message: string;
    link: string;
    data: Record<string, unknown>;
}

export type WompiTx = { id: string; status: string; reference: string; amount_in_cents: number; currency: string; payment_method_type: string; created_at: string };

export interface AutopayStore {
    paymentForLink(paymentId: string): Promise<{ amount: number; feePct: number } | null>;
    payerEmail(userId: string): Promise<string | null>;
    insertAutopayLink(row: Record<string, unknown>): Promise<{ ok: true; id: string } | { ok: false; conflict: boolean; error?: string }>;
    setLinkStatus(linkId: string, status: 'expired' | 'failed', onlyIfPending: boolean): Promise<void>;
    contexto(paymentId: string, subscriptionId: string): Promise<AvisoContexto | null>;
    cycleState(cycleId: string): Promise<{ state: string; next_attempt_on: string | null } | null>;
    cycleForPayment(paymentId: string): Promise<{ cycle_id: string; subscription_id: string; school_id: string } | null>;
    /** Pagos de las últimas 72 h con más de una transacción APPROVED registrada. */
    duplicatesLast72h(): Promise<{ payment_id: string; school_id: string; winner_tx: string | null; tx: { id: string; amount: number }[] }[]>;
    heartbeat(): Promise<Record<string, { at?: string }>>;
    openIncidentSince(kind: string, sinceIso: string): Promise<boolean>;
}

export interface AutopayDeps {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    store: AutopayStore;
    credsForSchool: (schoolId: string) => Promise<WompiCreds | null>;
    wompi: {
        merchantId: (creds: WompiCreds) => Promise<string | null>;
        findByReference: typeof findTransactionsByReference;
        fetchTransaction: (id: string, creds: WompiCreds) => Promise<WompiTx | null>;
        charge: typeof createTransactionWithPaymentSource;
        acceptanceTokens: typeof fetchAcceptanceTokens;
    };
    /** Concilia una transacción por el mismo camino que el webhook. */
    route: (realTx: WompiTx) => Promise<{ status: number; body: any; handled: boolean }>;
    notify: (aviso: Aviso) => Promise<boolean>;
    alert: (kind: string, detail: Record<string, unknown>) => void;
    log: (msg: string, detail?: Record<string, unknown>) => void;
    now: () => Date;
    sleep: (ms: number) => Promise<void>;
    sendAcceptanceToken: boolean;
}

// ─── Formato de los avisos (español de Colombia, de tú) ─────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreMes(month: number | null | undefined): string {
    return month && month >= 1 && month <= 12 ? MESES[month - 1] : 'este mes';
}

export function pesos(n: number): string {
    return '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** 'YYYY-MM-DD' → "jueves 8 de octubre". La fecha es de calendario (Bogotá), no un instante. */
export function fechaLarga(isoDate: string): string {
    const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
}

const LINK_DEBITO = '/my-payments#debito';
const linkPagar = (paymentId: string) => `/my-payments?pay=${paymentId}`;

// ─── Utilidades internas ────────────────────────────────────────────────────

/** Backoff de la reconsulta de un PENDING según su edad (§7.5). */
export function proximaReconsulta(createdAt: string, now: Date): Date {
    const edadMin = (now.getTime() - new Date(createdAt).getTime()) / 60000;
    const espera = edadMin < 10 ? 2 : edadMin < 40 ? 10 : edadMin < 120 ? 30 : 60;
    return new Date(now.getTime() + espera * 60000);
}

const FINALES = new Set(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR']);

function elegirTx(txs: { id: string; status: string }[]) {
    return txs.find(t => t.status === 'APPROVED') ?? txs.find(t => t.status === 'PENDING') ?? txs[0] ?? null;
}

async function rpcOk(deps: AutopayDeps, fn: string, args: Record<string, unknown>): Promise<any> {
    const { data, error } = await deps.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message ?? error.code ?? 'error'}`);
    return data;
}

async function finish(
    deps: AutopayDeps,
    attemptId: string,
    status: 'pending_provider' | 'approved' | 'declined' | 'error',
    extra: { txId?: string | null; errorCode?: string | null; reference?: string | null; linkId?: string | null } = {},
) {
    return rpcOk(deps, 'autopay_finish_attempt', {
        p_attempt_id: attemptId,
        p_status: status,
        p_provider_tx_id: extra.txId ?? null,
        p_error_code: extra.errorCode ?? null,
        p_provider_reference: extra.reference ?? null,
        p_payment_link_id: extra.linkId ?? null,
    });
}

async function avisar(deps: AutopayDeps, aviso: Aviso): Promise<boolean> {
    try {
        return await deps.notify(aviso);
    } catch (e: any) {
        deps.log('autopay: aviso falló', { userId: aviso.userId, err: e?.message });
        return false;
    }
}

async function avisarSuspension(deps: AutopayDeps, ctx: AvisoContexto, paymentId: string) {
    if (ctx.subscriptionStatus !== 'suspended') return;
    await avisar(deps, {
        userId: ctx.payerUserId, schoolId: ctx.schoolId,
        title: 'Débito automático suspendido',
        message: `Suspendimos el débito automático de ${ctx.athleteName} porque dos meses seguidos no se pudo debitar. Revisa tu medio de pago o el tope en Mis Pagos.`,
        link: LINK_DEBITO, data: { kind: 'autopay_suspended', payment_id: paymentId },
    });
}

// ─── Avisos de la planificación (§5.1 B, §10.1) ─────────────────────────────

async function procesarPlan(deps: AutopayDeps, row: PlanRow): Promise<'noticed' | 'notice_failed' | 'skip_notified'> {
    const ctx = await deps.store.contexto(row.payment_id, row.subscription_id);
    const total = Number(row.total);

    if (row.action === 'notice') {
        if (!ctx || !row.first_attempt_on) return 'notice_failed';
        const enviado = await avisar(deps, {
            userId: ctx.payerUserId, schoolId: ctx.schoolId,
            title: 'Débito automático programado',
            message: `El ${fechaLarga(row.first_attempt_on)} debitaremos ${pesos(total)} de tu ${ctx.methodLabel} por la mensualidad de ${ctx.periodLabel} de ${ctx.athleteName}. Si ya la pagaste, avísanos en Mis Pagos con «Ya pagué este mes».`,
            // Un toque a «Ya pagué este mes» (lo abre Mis Pagos con este ciclo).
            link: `/my-payments?autopay_skip=${row.cycle_id}`,
            data: { kind: 'autopay_notice', cycle_id: row.cycle_id, payment_id: row.payment_id, total, first_attempt_on: row.first_attempt_on },
        });
        // D4: sin aviso entregado no existe notice_sent_at → no hay débito.
        if (!enviado) return 'notice_failed';
        await rpcOk(deps, 'autopay_mark_noticed', { p_cycle_id: row.cycle_id, p_announced_total: total });
        return 'noticed';
    }

    if (ctx) {
        const message = row.action === 'over_max_amount'
            ? `Este mes la mensualidad de ${ctx.athleteName} (${pesos(total)}) supera el tope que autorizaste (${pesos(ctx.maxAmount)}), así que no la debitaremos. Págala desde Mis Pagos o sube el tope.`
            : `No pudimos usar tu ${ctx.methodLabel} para la mensualidad de ${ctx.periodLabel} de ${ctx.athleteName}, así que no la debitaremos. Págala desde Mis Pagos o actualiza tu medio de pago.`;
        await avisar(deps, {
            userId: ctx.payerUserId, schoolId: ctx.schoolId,
            title: 'Este mes no habrá débito automático',
            message, link: linkPagar(row.payment_id),
            data: { kind: `autopay_${row.action}`, cycle_id: row.cycle_id, payment_id: row.payment_id },
        });
        await avisarSuspension(deps, ctx, row.payment_id);
    }
    return 'skip_notified';
}

// ─── Después de un intento fallido (§10.1) ──────────────────────────────────

/**
 * Aviso a la familia (y a la escuela si se agotó) tras un intento rechazado.
 * Lo llaman el motor (rechazo síncrono) y el webhook (rechazo asíncrono).
 */
export async function avisarIntentoFallido(
    deps: AutopayDeps,
    p: { cycleId: string; paymentId: string; subscriptionId: string | null },
): Promise<void> {
    const cyc = await deps.store.cycleState(p.cycleId);
    const subId = p.subscriptionId ?? (await deps.store.cycleForPayment(p.paymentId))?.subscription_id;
    if (!cyc || !subId) return;
    const ctx = await deps.store.contexto(p.paymentId, subId);
    if (!ctx) return;

    if (cyc.state === 'exhausted') {
        await avisar(deps, {
            userId: ctx.payerUserId, schoolId: ctx.schoolId,
            title: 'No pudimos debitar la mensualidad',
            message: `La mensualidad de ${ctx.periodLabel} de ${ctx.athleteName} quedó pendiente: no pudimos debitarla. Págala desde Mis Pagos.`,
            link: linkPagar(p.paymentId), data: { kind: 'autopay_exhausted', payment_id: p.paymentId },
        });
        if (ctx.schoolOwnerId) {
            await avisar(deps, {
                userId: ctx.schoolOwnerId, schoolId: ctx.schoolId,
                title: 'Débito automático sin éxito',
                message: `No se pudo debitar la mensualidad de ${ctx.periodLabel} de ${ctx.athleteName} después de 3 intentos. Quedó pendiente como cualquier cobro.`,
                link: '/school/payments', data: { kind: 'autopay_exhausted', payment_id: p.paymentId },
            });
        }
        await avisarSuspension(deps, ctx, p.paymentId);
        return;
    }

    const cuando = cyc.next_attempt_on ? ` Lo intentaremos otra vez el ${fechaLarga(cyc.next_attempt_on)}.` : '';
    await avisar(deps, {
        userId: ctx.payerUserId, schoolId: ctx.schoolId,
        title: 'No pudimos debitar la mensualidad',
        message: `No pudimos debitar la mensualidad de ${ctx.periodLabel} de ${ctx.athleteName} de tu ${ctx.methodLabel}.${cuando} Si prefieres, págala ahora desde Mis Pagos.`,
        link: linkPagar(p.paymentId), data: { kind: 'autopay_attempt_failed', payment_id: p.paymentId },
    });
}

// ─── Un intento reclamado (§7.2) ────────────────────────────────────────────

export type ResultadoIntento =
    | 'approved' | 'pending' | 'declined' | 'error' | 'unknown'
    | 'released_manual_checkout' | 'released_merchant_mismatch';

/**
 * Concilia una transacción ya creada: la relee de Wompi y, si es final, la pasa
 * por el handler del webhook (que cierra el intento). Si no se puede leer, queda
 * `pending_provider` y la toma el barrido.
 */
async function conciliar(deps: AutopayDeps, txId: string, creds: WompiCreds): Promise<string | null> {
    const real = await deps.wompi.fetchTransaction(txId, creds);
    if (!real || !FINALES.has(real.status)) return real?.status ?? null;
    await deps.route(real);
    return real.status;
}

export async function procesarIntento(deps: AutopayDeps, row: ClaimRow, merchantCache: Map<string, string | null>): Promise<ResultadoIntento> {
    const ids = { attemptId: row.attempt_id, paymentId: row.payment_id, schoolId: row.school_id };
    const fallo = async (code: string, extra: { reference?: string; linkId?: string } = {}) => {
        await finish(deps, row.attempt_id, 'error', { errorCode: code, ...extra });
        if (extra.linkId) await deps.store.setLinkStatus(extra.linkId, 'failed', true);
        await avisarIntentoFallido(deps, { cycleId: row.cycle_id, paymentId: row.payment_id, subscriptionId: row.subscription_id });
    };

    // 1. Credenciales del resolver de la escuela (fail-closed).
    const creds = await deps.credsForSchool(row.school_id);
    if (!creds) {
        deps.alert('no_credentials', ids);
        await fallo('no_credentials');
        return 'error';
    }

    // 2. D11: la fuente es del comercio que la creó.
    let merchantId = merchantCache.get(creds.publicKey);
    if (merchantId === undefined) {
        merchantId = await deps.wompi.merchantId(creds);
        merchantCache.set(creds.publicKey, merchantId);
    }
    if (!merchantId) {
        await fallo('merchant_info_unavailable');
        return 'error';
    }
    if (merchantId !== row.provider_merchant_id) {
        await rpcOk(deps, 'autopay_release_attempt', { p_attempt_id: row.attempt_id, p_reason: 'merchant_mismatch' });
        await rpcOk(deps, 'autopay_record_incident', {
            p_kind: 'merchant_mismatch', p_school_id: row.school_id, p_payment_id: row.payment_id,
            p_subscription_id: row.subscription_id, p_provider_transaction_id: null, p_amount: Number(row.amount),
        });
        deps.alert('merchant_mismatch', ids);
        const ctx = await deps.store.contexto(row.payment_id, row.subscription_id);
        if (ctx) {
            await avisar(deps, {
                userId: ctx.payerUserId, schoolId: ctx.schoolId,
                title: 'Débito automático cancelado',
                message: `Cancelamos el débito automático de ${ctx.athleteName} porque la escuela cambió su cuenta de pagos. Puedes activarlo de nuevo en Mis Pagos; este mes paga desde ahí.`,
                link: LINK_DEBITO, data: { kind: 'autopay_merchant_changed', payment_id: row.payment_id },
            });
        }
        return 'released_merchant_mismatch';
    }

    // 3. §7.3 Checkout manual pendiente de más de 2 h: ¿llegó a Wompi?
    if (row.manual_link_id) {
        if (row.manual_link_reference) {
            const r = await deps.wompi.findByReference(row.manual_link_reference, creds);
            if (!r.ok) {
                // Sin saber si la familia está pagando, no se debita. Mañana se reintenta.
                await rpcOk(deps, 'autopay_release_attempt', { p_attempt_id: row.attempt_id, p_reason: 'manual_checkout_open' });
                return 'released_manual_checkout';
            }
            const viva = r.transactions.find(t => t.status === 'APPROVED') ?? r.transactions.find(t => t.status === 'PENDING');
            if (viva) {
                // APPROVED = un webhook que se perdió: se concilia ahora.
                if (viva.status === 'APPROVED') await conciliar(deps, viva.id, creds);
                await rpcOk(deps, 'autopay_release_attempt', { p_attempt_id: row.attempt_id, p_reason: 'manual_checkout_open' });
                return 'released_manual_checkout';
            }
        }
        await deps.store.setLinkStatus(row.manual_link_id, 'expired', true);
    }

    // 4. Enlace del intento (origin='autopay', SCH-), con el monto del intento.
    const pay = await deps.store.paymentForLink(row.payment_id);
    if (!pay) {
        await fallo('payment_not_found');
        return 'error';
    }
    const amount = Number(row.amount);
    const base = Number(pay.amount);
    const reference = generateReference('school_payment');
    const ins = await deps.store.insertAutopayLink({
        payment_id: row.payment_id,
        school_id: row.school_id,
        token: crypto.randomBytes(32).toString('hex'),
        payment_provider: 'wompi',
        provider_reference: reference,
        wompi_reference: reference,
        gross_amount: amount,
        base_amount: base,
        sportmaps_fee: amount - base,
        fee_pct: amount > base ? pay.feePct : 0,
        status: 'pending',
        expires_at: new Date(deps.now().getTime() + 72 * 3600 * 1000).toISOString(),
        failed_attempts: 0,
        origin: 'autopay',
        recurring_attempt_id: row.attempt_id,
    });
    if (!ins.ok) {
        if (ins.conflict) {
            // Alguien abrió un checkout entre el claim y este insert: gana el manual.
            await rpcOk(deps, 'autopay_release_attempt', { p_attempt_id: row.attempt_id, p_reason: 'manual_checkout_open' });
            return 'released_manual_checkout';
        }
        await fallo('link_insert_failed');
        return 'error';
    }
    const linkId = ins.id;

    const email = await deps.store.payerEmail(row.payer_user_id);
    if (!email) {
        await fallo('payer_without_email', { reference, linkId });
        return 'error';
    }

    // 5. Tokens de aceptación solo si se decide mandarlos (pregunta 7 a Wompi).
    let acceptance: { acceptanceToken?: string; personalDataAuthToken?: string } = {};
    if (deps.sendAcceptanceToken) {
        const t = await deps.wompi.acceptanceTokens(creds);
        if (!t.ok) {
            await fallo('acceptance_unavailable', { reference, linkId });
            return 'error';
        }
        acceptance = { acceptanceToken: t.tokens.acceptanceToken, personalDataAuthToken: t.tokens.personalDataAuthToken };
    }

    // 6. Cobro con la fuente.
    const res = await deps.wompi.charge({
        paymentSourceId: Number(row.provider_payment_source_id),
        amountInCents: copToCents(amount),
        reference,
        customerEmail: email,
        paymentMethodType: row.payment_method_type ?? 'CARD',
        ...acceptance,
    }, creds);

    if (!res.ok) {
        if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500) {
            // Wompi rechazó la petición: no hay transacción.
            await fallo(`provider_${res.statusCode}`, { reference, linkId });
            return 'declined';
        }
        // Sin respuesta o 5xx: no se sabe si cobró. Queda `processing`; al vencer el
        // lease el barrido consulta por referencia antes de decidir (§7.2).
        deps.log('autopay: cobro sin respuesta, lo resuelve el barrido', { ...ids, statusCode: res.statusCode ?? null });
        return 'unknown';
    }

    await finish(deps, row.attempt_id, 'pending_provider', { txId: res.transactionId, reference, linkId });

    // Wompi responde PENDING siempre y resuelve en ~2 s (medido en sandbox el
    // 2026-10-07: tarjeta y Nequi, aprobado y rechazado). Se espera un poco para
    // conciliar en la misma corrida; lo que no alcance lo toman el webhook o el barrido.
    let final: string | null = FINALES.has(res.status) ? await conciliar(deps, res.transactionId, creds) : null;
    for (const espera of ESPERAS_PENDING_MS) {
        if (final && FINALES.has(final)) break;
        await deps.sleep(espera);
        final = await conciliar(deps, res.transactionId, creds);
    }
    if (final === 'APPROVED') return 'approved';
    if (final && FINALES.has(final)) return final === 'DECLINED' ? 'declined' : 'error';
    return 'pending';
}

/** Esperas tras un PENDING síncrono antes de dejárselo al barrido (total 7,5 s). */
const ESPERAS_PENDING_MS = [1500, 2000, 4000];

// ─── Corridas ───────────────────────────────────────────────────────────────

export interface ResumenDiario {
    avisos: number;
    avisos_fallidos: number;
    omitidos_avisados: number;
    intentos: Record<ResultadoIntento, number>;
    cobros_dobles: number;
}

const MAX_LOTES = 20;
const TAM_LOTE = 25;

export async function runDaily(deps: AutopayDeps): Promise<ResumenDiario> {
    const resumen: ResumenDiario = {
        avisos: 0, avisos_fallidos: 0, omitidos_avisados: 0, cobros_dobles: 0,
        intentos: { approved: 0, pending: 0, declined: 0, error: 0, unknown: 0, released_manual_checkout: 0, released_merchant_mismatch: 0 },
    };

    // A + B. Planificar y avisar.
    const plan: PlanRow[] = (await rpcOk(deps, 'autopay_plan_cycles', {})) ?? [];
    for (const row of plan) {
        try {
            const r = await procesarPlan(deps, row);
            if (r === 'noticed') resumen.avisos++;
            else if (r === 'notice_failed') resumen.avisos_fallidos++;
            else resumen.omitidos_avisados++;
        } catch (e: any) {
            resumen.avisos_fallidos++;
            deps.log('autopay: plan falló', { cycleId: row.cycle_id, err: e?.message });
        }
    }

    // C. Debitar, por lotes.
    const merchantCache = new Map<string, string | null>();
    for (let lote = 0; lote < MAX_LOTES; lote++) {
        const rows: ClaimRow[] = (await rpcOk(deps, 'autopay_claim_due', { p_limit: TAM_LOTE })) ?? [];
        if (rows.length === 0) break;
        for (const row of rows) {
            try {
                resumen.intentos[await procesarIntento(deps, row, merchantCache)]++;
            } catch (e: any) {
                // Lo que no se cerró queda `processing` y lo toma el barrido al vencer el lease.
                resumen.intentos.unknown++;
                deps.alert('attempt_exception', { attemptId: row.attempt_id, paymentId: row.payment_id, err: e?.message });
            }
        }
    }

    // Red diaria de cobro doble (§8.3).
    resumen.cobros_dobles = await redCobroDoble(deps);

    // ¿Corre el barrido? (§10.2 cron_missed)
    const hb = await deps.store.heartbeat();
    const sweepAt = hb.sweep?.at ? new Date(hb.sweep.at).getTime() : 0;
    if (deps.now().getTime() - sweepAt > 45 * 60000) {
        await registrarCronPerdido(deps, 'sweep');
    }

    await rpcOk(deps, 'autopay_heartbeat', { p_run: 'daily', p_detail: resumen });
    return resumen;
}

async function registrarCronPerdido(deps: AutopayDeps, run: 'daily' | 'sweep') {
    const desde = new Date(deps.now().getTime() - 20 * 3600 * 1000).toISOString();
    if (await deps.store.openIncidentSince('cron_missed', desde)) return;
    await rpcOk(deps, 'autopay_record_incident', { p_kind: 'cron_missed' });
    deps.alert('cron_missed', { run });
}

async function redCobroDoble(deps: AutopayDeps): Promise<number> {
    let n = 0;
    for (const d of await deps.store.duplicatesLast72h()) {
        const cyc = await deps.store.cycleForPayment(d.payment_id);
        if (!cyc) continue;   // fuera del débito: lo marca flag_payment_for_review del webhook
        for (const tx of d.tx) {
            if (tx.id === d.winner_tx) continue;
            const r = await rpcOk(deps, 'autopay_record_incident', {
                p_kind: 'duplicate_charge', p_school_id: d.school_id, p_payment_id: d.payment_id,
                p_subscription_id: cyc.subscription_id, p_provider_transaction_id: tx.id, p_amount: tx.amount,
            });
            if (r?.incident_id) {
                n++;
                deps.alert('duplicate_charge', { paymentId: d.payment_id, txId: tx.id, via: 'red_diaria' });
            }
        }
    }
    return n;
}

export interface ResumenBarrido { revisados: number; conciliados: number; reprogramados: number; vencidos: number; incidentes: number }

export async function runSweep(deps: AutopayDeps): Promise<ResumenBarrido> {
    const resumen: ResumenBarrido = { revisados: 0, conciliados: 0, reprogramados: 0, vencidos: 0, incidentes: 0 };
    const now = deps.now();
    const rows: SweepRow[] = (await rpcOk(deps, 'autopay_sweep_due', { p_limit: 100 })) ?? [];

    for (const row of rows) {
        resumen.revisados++;
        try {
            const creds = await deps.credsForSchool(row.school_id);
            if (!creds) {
                deps.alert('no_credentials', { attemptId: row.attempt_id, schoolId: row.school_id, via: 'sweep' });
                continue;
            }

            if (row.status === 'pending_provider') {
                if (now.getTime() - new Date(row.created_at).getTime() > 24 * 3600 * 1000) {
                    const r = await rpcOk(deps, 'autopay_record_incident', {
                        p_kind: 'stale_pending', p_school_id: row.school_id, p_payment_id: row.payment_id,
                        p_subscription_id: row.subscription_id,
                    });
                    if (r?.incident_id) { resumen.incidentes++; deps.alert('stale_pending', { attemptId: row.attempt_id }); }
                }
                const final = row.provider_transaction_id ? await conciliar(deps, row.provider_transaction_id, creds) : null;
                if (final && FINALES.has(final)) {
                    resumen.conciliados++;
                } else {
                    await rpcOk(deps, 'autopay_reschedule_check', {
                        p_attempt_id: row.attempt_id,
                        p_next_check_at: proximaReconsulta(row.created_at, now).toISOString(),
                    });
                    resumen.reprogramados++;
                }
                continue;
            }

            // `processing` con lease vencido: el BFF murió o Wompi no respondió.
            const inc = await rpcOk(deps, 'autopay_record_incident', {
                p_kind: 'stale_lease', p_school_id: row.school_id, p_payment_id: row.payment_id,
                p_subscription_id: row.subscription_id,
            });
            if (inc?.incident_id) { resumen.incidentes++; deps.alert('stale_lease', { attemptId: row.attempt_id }); }

            if (!row.provider_reference) {
                // Murió antes de crear el enlace: nunca llegó a Wompi.
                await finish(deps, row.attempt_id, 'error', { errorCode: 'lease_expired' });
                await avisarIntentoFallido(deps, { cycleId: row.cycle_id, paymentId: row.payment_id, subscriptionId: row.subscription_id });
                resumen.vencidos++;
                continue;
            }
            const r = await deps.wompi.findByReference(row.provider_reference, creds);
            if (!r.ok) continue;   // sin saber, no se decide: próximo barrido
            const tx = elegirTx(r.transactions);
            if (!tx) {
                await finish(deps, row.attempt_id, 'error', {
                    errorCode: 'lease_expired', reference: row.provider_reference, linkId: row.payment_link_id,
                });
                if (row.payment_link_id) await deps.store.setLinkStatus(row.payment_link_id, 'failed', true);
                await avisarIntentoFallido(deps, { cycleId: row.cycle_id, paymentId: row.payment_id, subscriptionId: row.subscription_id });
                resumen.vencidos++;
                continue;
            }
            await finish(deps, row.attempt_id, 'pending_provider', {
                txId: tx.id, reference: row.provider_reference, linkId: row.payment_link_id,
            });
            if (tx.status !== 'PENDING') {
                await conciliar(deps, tx.id, creds);
                resumen.conciliados++;
            }
        } catch (e: any) {
            deps.alert('sweep_exception', { attemptId: row.attempt_id, err: e?.message });
        }
    }

    // ¿Corrió la diaria? Después de las 12:30 UTC tiene que haber latido de hoy.
    const hb = await deps.store.heartbeat();
    const hoy = now.toISOString().slice(0, 10);
    const pasadasLas1230 = now.getUTCHours() > 12 || (now.getUTCHours() === 12 && now.getUTCMinutes() >= 30);
    if (pasadasLas1230 && (hb.daily?.at ?? '').slice(0, 10) !== hoy) {
        await registrarCronPerdido(deps, 'daily');
    }

    await rpcOk(deps, 'autopay_heartbeat', { p_run: 'sweep', p_detail: resumen });
    return resumen;
}

// ─── Ganchos del webhook (bff/src/routes/wompi.ts → handleSchoolPayment) ───

/**
 * Cierra el intento de un enlace `origin='autopay'` cuando Wompi da el estado final.
 * Idempotente (finish_attempt no reabre un intento cerrado).
 */
export async function autopayAlResultado(
    p: { attemptId: string; paymentId: string; txId: string; reference: string; linkId: string; internalStatus: string },
    deps: AutopayDeps = defaultDeps(),
): Promise<void> {
    if (p.internalStatus === 'paid') {
        await finish(deps, p.attemptId, 'approved', { txId: p.txId, reference: p.reference, linkId: p.linkId });
        return;
    }
    const status = p.internalStatus === 'rejected' ? 'declined' : 'error';
    const r = await finish(deps, p.attemptId, status, {
        txId: p.txId, reference: p.reference, linkId: p.linkId, errorCode: `wompi_${p.internalStatus}`,
    });
    if (r?.unchanged) return;
    const cyc = await deps.store.cycleForPayment(p.paymentId);
    if (cyc) await avisarIntentoFallido(deps, { cycleId: cyc.cycle_id, paymentId: p.paymentId, subscriptionId: cyc.subscription_id });
}

/**
 * Llegó un APPROVED para un cobro que ya estaba pagado con otra transacción
 * (§8.3). Si el cobro es del débito, queda el incidente, se suspende la suscripción
 * y se avisa. Si el sobrante es el propio débito, su intento se cierra como aprobado:
 * la plata entró.
 */
export async function autopayCobroDoble(
    p: { paymentId: string; schoolId: string; txId: string; amount: number; attemptId: string | null; reference: string; linkId: string },
    deps: AutopayDeps = defaultDeps(),
): Promise<void> {
    if (p.attemptId) {
        await finish(deps, p.attemptId, 'approved', { txId: p.txId, reference: p.reference, linkId: p.linkId });
    }
    const cyc = await deps.store.cycleForPayment(p.paymentId);
    if (!cyc) return;
    const r = await rpcOk(deps, 'autopay_record_incident', {
        p_kind: 'duplicate_charge', p_school_id: p.schoolId, p_payment_id: p.paymentId,
        p_subscription_id: cyc.subscription_id, p_provider_transaction_id: p.txId, p_amount: p.amount,
    });
    if (!r?.incident_id) return;
    deps.alert('duplicate_charge', { paymentId: p.paymentId, txId: p.txId, via: 'webhook' });

    const ctx = await deps.store.contexto(p.paymentId, cyc.subscription_id);
    if (!ctx) return;
    await avisar(deps, {
        userId: ctx.payerUserId, schoolId: ctx.schoolId,
        title: 'Detectamos un pago doble',
        message: `Detectamos dos pagos de la mensualidad de ${ctx.periodLabel} de ${ctx.athleteName}. La escuela va a gestionar la devolución de uno. Mientras tanto pausamos tu débito automático.`,
        link: LINK_DEBITO, data: { kind: 'autopay_duplicate', payment_id: p.paymentId },
    });
    if (ctx.schoolOwnerId) {
        await avisar(deps, {
            userId: ctx.schoolOwnerId, schoolId: ctx.schoolId,
            title: 'Cobro doble para devolver',
            message: `La mensualidad de ${ctx.periodLabel} de ${ctx.athleteName} se pagó dos veces (${pesos(p.amount)} de más). Hay que devolver uno de los pagos.`,
            link: '/school/payments', data: { kind: 'autopay_duplicate', payment_id: p.paymentId },
        });
    }
}

/**
 * ¿El cobro tiene un débito en vuelo? Lo consultan create-session y el link con
 * monto antes de abrir un checkout (§7.3): sin esto reusarían el enlace del débito
 * (es 'pending' del mismo cobro) o chocarían con el índice único.
 */
export async function debitoEnCurso(paymentId: string): Promise<boolean> {
    const [{ data: link }, { data: att }] = await Promise.all([
        supabase.from('payment_links').select('id').eq('payment_id', paymentId)
            .eq('origin', 'autopay').eq('status', 'pending').limit(1).maybeSingle(),
        supabase.from('recurring_charge_attempts').select('id').eq('payment_id', paymentId)
            .in('status', ['processing', 'pending_provider']).limit(1).maybeSingle(),
    ]);
    return !!(link || att);
}

export const MENSAJE_DEBITO_EN_CURSO =
    'Tu débito automático de este mes está en proceso. Si se rechaza te avisamos para que pagues por aquí.';

// ─── Dependencias reales ────────────────────────────────────────────────────

const supabaseStore: AutopayStore = {
    async paymentForLink(paymentId) {
        const { data: p } = await supabase.from('payments').select('amount, school_id').eq('id', paymentId).maybeSingle();
        if (!p) return null;
        const { data: ss } = await supabase.from('school_settings').select('online_fee_pct')
            .eq('school_id', (p as any).school_id).maybeSingle();
        return { amount: Number((p as any).amount), feePct: Number((ss as any)?.online_fee_pct ?? 3) };
    },
    async payerEmail(userId) {
        const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
        return (data as any)?.email ?? null;
    },
    async insertAutopayLink(row) {
        const { data, error } = await supabase.from('payment_links').insert(row).select('id').single();
        if (error) return { ok: false, conflict: (error as any).code === '23505', error: error.message };
        return { ok: true, id: (data as any).id };
    },
    async setLinkStatus(linkId, status, onlyIfPending) {
        let q = supabase.from('payment_links').update({ status, updated_at: new Date().toISOString() }).eq('id', linkId);
        if (onlyIfPending) q = q.eq('status', 'pending');
        await q;
    },
    async contexto(paymentId, subscriptionId) {
        const [{ data: p }, { data: s }] = await Promise.all([
            supabase.from('payments').select('school_id, child_id, user_id, period_month').eq('id', paymentId).maybeSingle(),
            supabase.from('recurring_subscriptions').select('payer_user_id, child_id, athlete_user_id, payment_token_id, max_amount, status')
                .eq('id', subscriptionId).maybeSingle(),
        ]);
        if (!p || !s) return null;
        const sub = s as any;
        const [{ data: school }, { data: tok }, atleta] = await Promise.all([
            supabase.from('schools').select('name, owner_id').eq('id', (p as any).school_id).maybeSingle(),
            supabase.from('payment_tokens').select('display_label, payment_method_type').eq('id', sub.payment_token_id).maybeSingle(),
            sub.child_id
                ? supabase.from('children').select('full_name').eq('id', sub.child_id).maybeSingle()
                : supabase.from('profiles').select('full_name').eq('id', sub.athlete_user_id).maybeSingle(),
        ]);
        const nombre = String((atleta.data as any)?.full_name ?? '').trim().split(/\s+/)[0] || 'tu deportista';
        const medio = (tok as any)?.display_label
            ?? ((tok as any)?.payment_method_type === 'NEQUI' ? 'Nequi' : 'medio de pago');
        return {
            payerUserId: sub.payer_user_id,
            schoolId: (p as any).school_id,
            schoolOwnerId: (school as any)?.owner_id ?? null,
            athleteName: nombre,
            periodLabel: nombreMes((p as any).period_month),
            methodLabel: medio,
            maxAmount: Number(sub.max_amount),
            subscriptionStatus: sub.status,
        };
    },
    async cycleState(cycleId) {
        const { data } = await supabase.from('autopay_cycles').select('state, next_attempt_on').eq('id', cycleId).maybeSingle();
        return (data as any) ?? null;
    },
    async cycleForPayment(paymentId) {
        const { data } = await supabase.from('autopay_cycles').select('id, subscription_id, school_id')
            .eq('payment_id', paymentId).maybeSingle();
        return data ? { cycle_id: (data as any).id, subscription_id: (data as any).subscription_id, school_id: (data as any).school_id } : null;
    },
    async duplicatesLast72h() {
        const desde = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
        const { data: splits } = await supabase.from('payment_splits')
            .select('payment_id, wompi_transaction_id, gross_amount')
            .gte('created_at', desde).not('wompi_transaction_id', 'is', null);
        const porPago = new Map<string, { id: string; amount: number }[]>();
        for (const s of (splits as any[]) ?? []) {
            const l = porPago.get(s.payment_id) ?? [];
            if (!l.some(t => t.id === s.wompi_transaction_id)) l.push({ id: s.wompi_transaction_id, amount: Number(s.gross_amount) });
            porPago.set(s.payment_id, l);
        }
        const dobles = [...porPago.entries()].filter(([, l]) => l.length > 1);
        if (dobles.length === 0) return [];
        const { data: pays } = await supabase.from('payments').select('id, school_id, wompi_transaction_id')
            .in('id', dobles.map(([id]) => id));
        const info = new Map(((pays as any[]) ?? []).map(p => [p.id, p]));
        return dobles.map(([id, tx]) => ({
            payment_id: id,
            school_id: info.get(id)?.school_id ?? null,
            winner_tx: info.get(id)?.wompi_transaction_id ?? null,
            tx,
        }));
    },
    async heartbeat() {
        const { data } = await supabase.from('platform_config').select('value').eq('key', 'autopay_heartbeat').maybeSingle();
        return ((data as any)?.value ?? {}) as Record<string, { at?: string }>;
    },
    async openIncidentSince(kind, sinceIso) {
        const { data } = await supabase.from('autopay_incidents').select('id')
            .eq('kind', kind).eq('state', 'open').gte('created_at', sinceIso).limit(1).maybeSingle();
        return !!data;
    },
};

export function defaultDeps(): AutopayDeps {
    return {
        rpc: async (fn, args) => {
            const { data, error } = await supabase.rpc(fn, args ?? {});
            return { data, error };
        },
        store: supabaseStore,
        credsForSchool: async (schoolId) => wompiCredsFrom(await resolveProvider({ schoolId, preferredProvider: 'wompi' })),
        wompi: {
            merchantId: fetchMerchantId,
            findByReference: findTransactionsByReference,
            fetchTransaction: (id, creds) => fetchTransaction(id, creds) as Promise<WompiTx | null>,
            charge: createTransactionWithPaymentSource,
            acceptanceTokens: fetchAcceptanceTokens,
        },
        // Import diferido: routes/wompi importa este módulo (ganchos del webhook).
        route: async (realTx) => (await import('../routes/wompi')).routeWompiTransaction({ realTx }),
        notify: async (a) => {
            const { error } = await supabase.from('notifications').insert({
                user_id: a.userId, school_id: a.schoolId, type: 'autopay', category: 'payment',
                title: a.title, message: a.message, link: a.link, data: a.data,
            });
            return !error;
        },
        alert: (kind, detail) => {
            console.error(`[autopay] ALERTA ${kind}`, detail);
            Sentry.captureMessage(`autopay:${kind}`, { level: 'error', tags: { autopay: kind }, extra: detail });
        },
        log: (msg, detail) => console.warn(`[autopay] ${msg}`, detail ?? {}),
        now: () => new Date(),
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        sendAcceptanceToken: process.env.AUTOPAY_SEND_ACCEPTANCE_TOKEN === 'true',
    };
}
