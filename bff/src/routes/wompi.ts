/**
 * wompi — Webhook unificado de Wompi (Colombia).
 *
 * Endpoint: POST /api/v1/webhooks/wompi/webhook
 *   (montado en /api/v1/webhooks/wompi + router.post('/webhook'). El sufijo /webhook NO
 *   es opcional: sin él, el catch-all de auth responde 401 "Token de autorización
 *   requerido" — no 404 —, así que una URL mal configurada en el dashboard de Wompi falla
 *   de forma silenciosa y los eventos nunca se reconcilian.)
 *
 * Wompi envia evento `transaction.updated` cuando una transaccion cambia de estado.
 * Este webhook reconcilia segun el prefijo de la `reference`:
 *   SCH-*   → payment de escuela (paga payments + payment_links + crea split)
 *   SVC-*   → cita de servicio   (RPC confirm_marketplace_payment)
 *   EVT-*   → inscripcion evento (idem)
 *   SUB-*   → suscripcion        (idem)
 *   MKT-*   → marketplace_pay    (idem)
 *   CART-*  → orden del shop     (descuenta stock atomico + cambia status)
 *
 * Seguridad:
 *  - Valida checksum SHA256 con el events_secret del comercio dueño de la referencia
 *    (multi-tenant): se resuelve la escuela por payment_links y se usan SUS credenciales.
 *    Si la referencia no es de una escuela, cae a WOMPI_EVENTS_SECRET (legacy).
 *  - Idempotencia por wompi_transaction_id (insercion unica).
 *  - Re-consulta el estado a Wompi para evitar webhook spoofing.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';
import {
    validateWebhookChecksum,
    fetchTransaction,
    mapWompiStatus,
    centsToCop,
    createPaymentSource,
    wompiCredsFrom,
    type WompiCreds,
} from '../services/wompi.service';
import { resolveProvider } from '../services/payment-provider.resolver';
import {
    recordWebhookEvent,
    markWebhookProcessed,
    markWebhookOrphan,
    markWebhookFailed,
    markWebhookIgnored,
} from '../services/webhook-events.service';

const router = Router();

/** Formato de las referencias que emitimos: PREFIJO-BASE36-HEX. Nada más entra a la query. */
const SAFE_REFERENCE = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/;

/**
 * Motivo del intento fallido, en formato legible por `parsePaymentFailure` del
 * frontend: `<proveedor>_<estado> · <medio> · <mensaje del banco> (tx=…)`.
 *
 * El mensaje del banco es lo unico que hace util el chip: sin el, la escuela
 * lee "rechazado" y sigue sin saber si la familia tiene que llamar al banco o
 * cambiar de medio. Wompi lo manda en `status_message` (p.ej. "La transaccion
 * fue rechazada (Rechazo General)" o el texto del reto 3DS).
 */
export function buildFailureReason(
    provider: 'wompi' | 'mp',
    internalStatus: string,
    paymentMethodType?: string | null,
    rawTransaction?: any,
    txId?: string,
): string {
    const partes = [`${provider}_${internalStatus}`];

    if (paymentMethodType) partes.push(String(paymentMethodType));

    // Se recorta: last_failure_reason no es un log, es el texto de un chip.
    const mensaje = rawTransaction?.status_message ?? rawTransaction?.status_detail ?? null;
    if (mensaje) partes.push(String(mensaje).slice(0, 160));

    return `${partes.join(' · ')}${txId ? ` (tx=${txId})` : ''}`;
}

/**
 * Resuelve las credenciales Wompi del comercio dueño de una referencia.
 *
 * Necesario para escuelas con cuenta propia (payment_mode='direct'): cada una tiene su
 * events_secret, así que el checksum del webhook debe validarse con el de ESA escuela.
 * Para la escuela en 'aggregator' el resolver devuelve las llaves de ENV, o sea el mismo
 * comportamiento de antes sin ramas especiales.
 *
 * Devuelve null si la referencia no es de una escuela (marketplace) o no se encuentra;
 * el caller cae entonces a las llaves globales, que es el comportamiento legacy.
 */
async function credsForReference(reference: string): Promise<WompiCreds | null> {
    // La referencia viene del body sin validar todavía, así que se filtra por formato
    // antes de usarla en una query (PostgREST interpola los filtros como texto).
    if (!reference || !SAFE_REFERENCE.test(reference)) return null;

    let schoolId: string | null = null;
    for (const col of ['provider_reference', 'wompi_reference'] as const) {
        const { data } = await supabase
            .from('payment_links')
            .select('school_id')
            .eq(col, reference)
            .maybeSingle();
        if ((data as any)?.school_id) {
            schoolId = (data as any).school_id;
            break;
        }
    }
    if (!schoolId) return null;

    const resolved = await resolveProvider({ schoolId, preferredProvider: 'wompi' });
    return wompiCredsFrom(resolved);
}

router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const { event } = body;

        req.log?.info({ event }, 'Wompi webhook received');

        // 1. Validar checksum con el events_secret del comercio dueño de la referencia.
        //
        //    La referencia se lee del body ANTES de validar la firma, para saber con qué
        //    secreto validar. Es seguro: elegir el secreto no concede nada — quien manda el
        //    evento igual tiene que producir un checksum válido para ESE secreto, y más
        //    abajo la referencia se vuelve a atar a su escuela y se re-consulta la
        //    transacción contra la API de Wompi.
        const refFromBody: string = body?.data?.transaction?.reference || '';
        const creds = await credsForReference(refFromBody);

        if (!validateWebhookChecksum(body, creds ?? undefined)) {
            req.log?.warn(
                { reference: refFromBody, perSchoolCreds: !!creds },
                'Wompi webhook checksum mismatch',
            );
            return res.status(401).json({ error: 'Invalid checksum' });
        }

        if (event !== 'transaction.updated') {
            return res.status(200).json({ status: 'ignored', event });
        }

        const transaction = body?.data?.transaction || {};
        const txId: string = transaction.id || '';
        const txStatus: string = transaction.status || '';
        const txReference: string = transaction.reference || '';
        const txAmountCents: number = Number(transaction.amount_in_cents || 0);

        if (!txId || !txReference) {
            req.log?.warn('Wompi webhook missing transaction id or reference');
            return res.status(400).json({ error: 'Invalid payload' });
        }

        // 2. Re-consultar a Wompi (defensa anti-spoofing). Con las credenciales del mismo
        //    comercio: define sandbox vs producción, que puede diferir por escuela.
        const realTx = await fetchTransaction(txId, creds ?? undefined);
        if (!realTx) {
            req.log?.warn({ txId }, 'Wompi webhook: cannot fetch transaction from Wompi');
            return res.status(400).json({ error: 'Cannot verify transaction' });
        }

        if (realTx.status !== txStatus || realTx.reference !== txReference) {
            req.log?.warn(
                { webhook: { txStatus, txReference }, real: { status: realTx.status, reference: realTx.reference } },
                'Wompi webhook: data mismatch with Wompi API',
            );
            return res.status(400).json({ error: 'Webhook data mismatch' });
        }

        // Solo COP soportado. Cualquier otra moneda indica config errada o spoofing.
        if (realTx.currency !== 'COP') {
            req.log?.error({ currency: realTx.currency, txReference }, 'Wompi webhook: unsupported currency');
            return res.status(400).json({ error: 'Unsupported currency' });
        }

        const internalStatus = mapWompiStatus(realTx.status);

        // 2.b Dedup + log persistente del evento (H-03/H-04). event_id estable
        // por (txId, status): deduplica el mismo update y a la vez permite
        // registrar transiciones de estado distintas de la misma tx.
        const { firstSeen, id: eventLogId } = await recordWebhookEvent({
            provider: 'wompi',
            eventId: `${txId}:${realTx.status}`,
            reference: txReference,
            eventType: event,
            payload: body,
        });
        if (!firstSeen) {
            return res.status(200).json({ status: 'already_processed', dedup: 'webhook_events' });
        }

        // 3. Rutear al handler segun prefijo (logica compartida con el reproceso).
        const routed = await routeWompiTransaction({ realTx, body, log: req.log });

        // Estado del evento segun el resultado:
        //  - prefijo desconocido -> ignored.
        //  - entidad local aun inexistente (*_not_found) -> orphan (reprocesar,
        //    NO perder el evento; antes se respondia 200 ignored sin retry).
        //  - fallo del handler (>=500) -> failed (reintento).
        //  - resto -> processed.
        if (!routed.handled) {
            req.log?.warn({ txReference }, 'Wompi webhook: unknown reference prefix');
            await markWebhookIgnored(eventLogId, String(routed.body?.reason ?? 'unknown_prefix'));
        } else {
            const reason = typeof routed.body?.reason === 'string' ? routed.body.reason : '';
            if (reason.endsWith('_not_found')) {
                await markWebhookOrphan(eventLogId, reason);
            } else if (routed.status >= 500) {
                await markWebhookFailed(eventLogId, `handler_status_${routed.status}`);
            } else {
                await markWebhookProcessed(eventLogId);
            }
        }

        // Captura de token: si la tx fue APPROVED y Wompi devolvio un token reusable,
        // intentar persistirlo si el user existe.
        if (internalStatus === 'paid') {
            await maybeCaptureToken(req, realTx, txReference, creds ?? undefined);
        }

        return res.status(routed.status).json(routed.body);
    } catch (err: any) {
        req.log?.error({ err: err?.message || err }, 'Unexpected error in Wompi webhook');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Handlers por tipo de transaccion ──────────────────────────────────────

interface HandlerArgs {
    req: Request;
    txId: string;
    txReference: string;
    txStatus: string;
    internalStatus: ReturnType<typeof mapWompiStatus>;
    txAmountCop: number;
    paymentMethodType: string;
    rawTransaction: any;        // tx completo de Wompi (incluye payment_method.token)
}

interface HandlerResult {
    status: number;
    body: Record<string, unknown>;
}

const HANDLERS: Record<string, (args: HandlerArgs) => Promise<HandlerResult>> = {
    SCH: handleSchoolPayment,
    SVC: handleMarketplaceTransaction,
    EVT: handleMarketplaceTransaction,
    SUB: handleMarketplaceTransaction,
    MKT: handleMarketplaceTransaction,
    CART: handleCartOrder,
    BKG: handleSessionBooking,
};

/**
 * Rutea una transaccion Wompi (ya validada/refetcheada) al handler que
 * corresponde por prefijo de reference. Compartido por el webhook en vivo y
 * por el cron de reproceso de huerfanos (webhook-reprocess.service).
 *
 * `handled=false` => prefijo desconocido (no hay entidad que tocar).
 * No hace dedup ni token-capture: eso es responsabilidad del caller.
 */
export interface WompiRouteInput {
    realTx: any;
    body?: any;
    log?: Request['log'];
}

export async function routeWompiTransaction(
    input: WompiRouteInput,
): Promise<{ status: number; body: Record<string, unknown>; handled: boolean }> {
    const { realTx } = input;
    const txId: string = realTx?.id || '';
    const txReference: string = realTx?.reference || '';
    const internalStatus = mapWompiStatus(realTx.status);
    const txAmountCop = centsToCop(realTx.amount_in_cents);

    const prefix = txReference.split('-')[0];
    const handler = HANDLERS[prefix];
    if (!handler) {
        return { status: 200, body: { status: 'ignored', reason: 'unknown_prefix', prefix }, handled: false };
    }

    // Los handlers solo usan req.log?.*, asi que basta un shim con el logger.
    const req = { log: input.log } as unknown as Request;
    const result = await handler({
        req,
        txId,
        txReference,
        txStatus: realTx.status,
        internalStatus,
        txAmountCop,
        paymentMethodType: realTx.payment_method_type,
        rawTransaction: realTx,
    });
    return { status: result.status, body: result.body, handled: true };
}

// ─── SCH: pagos de escuela ─────────────────────────────────────────────────

// Wompi entrega el tipo de instrumento (CARD/PSE/NEQUI/…). La constraint
// payments_payment_method_check solo admite pse|card|transfer|cash|other, así
// que 'wompi' NO es válido (rompía el UPDATE en silencio). Mapeamos al enum.
const WOMPI_METHOD_MAP: Record<string, string> = {
    CARD: 'card',
    PSE: 'pse',
    NEQUI: 'transfer',
    DAVIPLATA: 'transfer',
    BANCOLOMBIA_TRANSFER: 'transfer',
    BANCOLOMBIA_QR: 'transfer',
    BANCOLOMBIA_COLLECT: 'transfer',
};

async function handleSchoolPayment({
    req, txId, txReference, internalStatus, txAmountCop, paymentMethodType, rawTransaction,
}: HandlerArgs): Promise<HandlerResult> {
    // 1. Buscar payment_link por referencia
    const { data: link, error: linkErr } = await supabase
        .from('payment_links')
        .select('id, payment_id, school_id, gross_amount, base_amount, sportmaps_fee, status, expires_at, failed_attempts')
        .eq('wompi_reference', txReference)
        .maybeSingle();

    if (linkErr || !link) {
        req.log?.warn({ txReference }, 'School payment: payment_link not found');
        return { status: 200, body: { status: 'ignored', reason: 'link_not_found' } };
    }

    // 2. Idempotencia
    const { data: existingSplit } = await supabase
        .from('payment_splits')
        .select('id')
        .eq('wompi_transaction_id', txId)
        .maybeSingle();

    if (existingSplit) {
        return { status: 200, body: { status: 'already_processed' } };
    }

    if (internalStatus === 'paid') {
        // 3. Verificar monto
        if (Math.abs(txAmountCop - Number(link.gross_amount)) > 1) {
            req.log?.error(
                { expected: link.gross_amount, received: txAmountCop, txReference },
                'School payment: amount mismatch',
            );
            return { status: 400, body: { error: 'Amount mismatch' } };
        }

        const today = todayInZone();

        // 4. Marcar payment como pagado.
        //    payment_method DEBE ser un valor de payments_payment_method_check
        //    (pse|card|transfer|cash|other); 'wompi' lo violaba y el UPDATE
        //    fallaba en silencio (el pago quedaba pending pese al webhook OK).
        const payMethod = WOMPI_METHOD_MAP[String(paymentMethodType || '').toUpperCase()] ?? 'other';
        const { error: payUpdErr } = await supabase
            .from('payments')
            .update({
                status: 'paid',
                payment_channel: 'online',
                payment_method: payMethod,
                payment_date: today,
                approved_at: new Date().toISOString(),
                wompi_reference: txReference,
                wompi_transaction_id: txId,
                gross_amount: txAmountCop,
                sportmaps_fee: link.sportmaps_fee,
                updated_at: new Date().toISOString(),
            })
            .eq('id', link.payment_id);

        // Si el UPDATE del pago falla, NO seguimos marcando link/split como si
        // todo hubiera ido bien. Devolvemos 500 → el webhook se marca 'failed'
        // (reintentable) en vez de un falso 'processed'.
        if (payUpdErr) {
            req.log?.error(
                { err: payUpdErr, paymentId: link.payment_id, txReference },
                'School payment: FALLÓ marcar payment como paid',
            );
            return { status: 500, body: { error: 'payment_update_failed', detail: payUpdErr.message } };
        }

        // 5. Marcar payment_link
        await supabase
            .from('payment_links')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', link.id);

        // 6. Crear split
        await supabase
            .from('payment_splits')
            .insert({
                payment_id: link.payment_id,
                payment_link_id: link.id,
                wompi_reference: txReference,
                wompi_transaction_id: txId,
                gross_amount: txAmountCop,
                // MODELO VIGENTE: el recargo por pago online es de la ESCUELA. Existe para
                // cubrirle la comisión que la pasarela le descuenta, y el dinero ya entra
                // completo a su cuenta (el Widget de Wompi no hace split). SportMaps no
                // participa de la transacción: su ingreso es el addon de integración, que
                // se cobra por fuera del flujo de pago.
                //
                // Antes esto anotaba el recargo en `sportmaps_receives`, lo que iba dejando
                // una cuenta por cobrar contra la escuela que nadie liquidaba nunca
                // (`transfer_status` no sale de 'pending' en ningún punto del sistema).
                school_receives: txAmountCop,
                sportmaps_receives: 0,
                // La comisión real de la pasarela no la expone la API de transacciones: se
                // descuenta al liquidar y solo se ve en el dashboard del comercio.
                wompi_fee: 0,
                transfer_status: 'pending',
                webhook_signature_valid: true,
            });

        // 7. Notificar al staff de la escuela (dispara Modo Recepción + outbox).
        //    No-bloqueante: si falla, el pago ya quedó paid igual.
        const { error: notifErr } = await supabase.rpc('notify_school_payment_paid', {
            p_payment_id: link.payment_id,
        });
        if (notifErr) {
            req.log?.warn({ err: notifErr, paymentId: link.payment_id }, 'notify_school_payment_paid falló (no-bloqueante)');
        }

        req.log?.info({ paymentId: link.payment_id, txReference }, 'School payment confirmed');
        return { status: 200, body: { status: 'ok', kind: 'school_payment' } };
    }

    // No-paid (declined/voided/error) → dejar rastro del intento.
    //
    // El error de este UPDATE se lee. Durante meses no se leyó: el CHECK de
    // payment_links no admitía 'declined'/'failed'/'refunded', Postgres tiraba
    // 23514 y los 10 rechazos de Dynasty quedaron con el link en 'pending' y
    // failed_attempts en 0, como si nadie hubiera intentado pagar.
    const { error: linkUpdErr } = await supabase
        .from('payment_links')
        .update({
            status: internalStatus === 'rejected' ? 'declined' : internalStatus,
            // Contador, no bandera: tres intentos tienen que leerse como tres.
            failed_attempts: ((link as any).failed_attempts ?? 0) + 1,
            updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);

    if (linkUpdErr) {
        req.log?.error(
            { err: linkUpdErr, linkId: link.id, internalStatus },
            'No se pudo marcar el payment_link como fallido — el intento queda sin rastro',
        );
    }

    // Solo lo AMBIGUO bloquea. Una declinación ordinaria (el banco dijo que no,
    // o el padre abandonó el PSE) no deja plata en el aire: no hay nada que
    // revisar, hay que reintentar. ERROR y VOIDED sí: ahí no sabemos si el
    // dinero se movió, y la fila para hasta que alguien mire.
    const isAmbiguous = internalStatus === 'failed' || internalStatus === 'refunded';
    const reason = buildFailureReason('wompi', internalStatus, paymentMethodType, rawTransaction, txId);

    const { error: trailErr } = await supabase.rpc(
        isAmbiguous ? 'flag_payment_for_review' : 'record_payment_failure',
        { p_kind: 'payment', p_id: link.payment_id, p_reason: reason },
    );
    if (trailErr) {
        req.log?.error({ err: trailErr, paymentId: link.payment_id }, 'No se pudo registrar el fallo del cobro');
    }

    req.log?.warn(
        { paymentId: link.payment_id, internalStatus, blocked: isAmbiguous },
        isAmbiguous ? 'School payment flagged for review' : 'School payment declined (reintento habilitado)',
    );
    return {
        status: 200,
        body: { status: 'ok', kind: 'school_payment', internalStatus, flagged_for_review: isAmbiguous },
    };
}

// ─── SVC/EVT/SUB/MKT: marketplace_transactions ─────────────────────────────

async function handleMarketplaceTransaction({
    req, txId, txReference, internalStatus, txAmountCop,
}: HandlerArgs): Promise<HandlerResult> {
    // 1. Buscar transaction
    const { data: tx, error: txErr } = await supabase
        .from('marketplace_transactions')
        .select('id, gross_amount, status, wompi_transaction_id')
        .eq('wompi_reference', txReference)
        .maybeSingle();

    if (txErr || !tx) {
        req.log?.warn({ txReference }, 'Marketplace tx not found');
        return { status: 200, body: { status: 'ignored', reason: 'tx_not_found' } };
    }

    // 2. Idempotencia
    if (tx.wompi_transaction_id === txId && tx.status !== 'pending') {
        return { status: 200, body: { status: 'already_processed' } };
    }

    if (internalStatus === 'paid') {
        // 3. Verificar monto
        if (Math.abs(txAmountCop - Number(tx.gross_amount)) > 1) {
            req.log?.error(
                { expected: tx.gross_amount, received: txAmountCop, txReference },
                'Marketplace tx: amount mismatch',
            );
            return { status: 400, body: { error: 'Amount mismatch' } };
        }

        // 4. Confirmar via RPC unificada
        const { data: result, error } = await supabase.rpc('confirm_marketplace_payment', {
            p_transaction_id: tx.id,
            p_wompi_reference: txReference,
            p_wompi_transaction_id: txId,
            p_payment_method: 'wompi',
        });

        if (error) {
            req.log?.error({ err: error, txReference }, 'confirm_marketplace_payment failed');
            return { status: 500, body: { error: 'Confirm RPC failed' } };
        }

        req.log?.info({ txId: tx.id, txReference }, 'Marketplace tx confirmed');
        return { status: 200, body: { status: 'ok', kind: 'marketplace', result } };
    }

    // Failed/declined → flag para review
    await supabase
        .from('marketplace_transactions')
        .update({
            status: internalStatus === 'rejected' ? 'declined' : internalStatus,
            wompi_transaction_id: txId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

    await supabase.rpc('flag_payment_for_review', {
        p_kind: 'marketplace_transaction',
        p_id: tx.id,
        p_reason: `wompi_${internalStatus} (tx=${txId})`,
    });

    req.log?.warn({ marketplaceTxId: tx.id, internalStatus }, 'Marketplace tx flagged for review');
    return { status: 200, body: { status: 'ok', kind: 'marketplace', internalStatus, flagged_for_review: true } };
}

// ─── CART: ordenes del shop ────────────────────────────────────────────────

async function handleCartOrder({
    req, txId, txReference, internalStatus, txAmountCop, paymentMethodType,
}: HandlerArgs): Promise<HandlerResult> {
    // 1. Buscar order
    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, total_amount, status, wompi_transaction_id')
        .eq('wompi_reference', txReference)
        .maybeSingle();

    if (orderErr || !order) {
        req.log?.warn({ txReference }, 'Cart order not found');
        return { status: 200, body: { status: 'ignored', reason: 'order_not_found' } };
    }

    // 2. Idempotencia
    if (order.wompi_transaction_id === txId && order.status !== 'pending') {
        return { status: 200, body: { status: 'already_processed' } };
    }

    if (internalStatus === 'paid') {
        // 3. Verificar monto
        if (Math.abs(txAmountCop - Number(order.total_amount)) > 1) {
            req.log?.error(
                { expected: order.total_amount, received: txAmountCop, txReference },
                'Cart order: amount mismatch',
            );
            return { status: 400, body: { error: 'Amount mismatch' } };
        }

        // 4. Descuento de stock atomico via RPC (incluye order_status update)
        const { data: stockResult, error: stockErr } = await supabase.rpc(
            'confirm_order_payment',
            {
                p_order_id: order.id,
                p_wompi_reference: txReference,
                p_wompi_transaction_id: txId,
                p_payment_method_type: paymentMethodType,
            },
        );

        if (stockErr) {
            req.log?.error({ err: stockErr, orderId: order.id }, 'confirm_order_payment failed');
            // Marcar para revision manual sin fallar el webhook
            await supabase
                .from('orders')
                .update({
                    status: 'payment_review',
                    wompi_transaction_id: txId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);
            return { status: 200, body: { status: 'review', error: stockErr.message } };
        }

        // 5. Multi-vendor split — crea vendor_payouts (idempotente)
        const { error: splitErr } = await supabase.rpc('split_order_payment', {
            p_order_id: order.id,
        });
        if (splitErr) {
            req.log?.warn({ err: splitErr, orderId: order.id }, 'split_order_payment failed (non-blocking)');
        }

        // 6. Settlements R5 — crea settlements y acredita pending_balance (idempotente)
        const { data: settleResult, error: settleErr } = await supabase.rpc(
            'compute_settlements_for_order',
            { p_order_id: order.id },
        );
        if (settleErr) {
            req.log?.warn({ err: settleErr, orderId: order.id }, 'compute_settlements_for_order failed (non-blocking)');
        } else {
            req.log?.info({ orderId: order.id, settleResult }, 'Settlements computed');
        }

        req.log?.info({ orderId: order.id, txReference }, 'Cart order paid + stock decremented + payouts split + settlements');
        return { status: 200, body: { status: 'ok', kind: 'cart', result: stockResult } };
    }

    // Failed/declined → flag para review
    await supabase
        .from('orders')
        .update({
            status: internalStatus === 'rejected' ? 'declined' : internalStatus,
            wompi_transaction_id: txId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

    await supabase.rpc('flag_payment_for_review', {
        p_kind: 'order',
        p_id: order.id,
        p_reason: `wompi_${internalStatus} (tx=${txId})`,
    });

    req.log?.warn({ orderId: order.id, internalStatus }, 'Cart order flagged for review');
    return { status: 200, body: { status: 'ok', kind: 'cart', internalStatus, flagged_for_review: true } };
}

// ─── BKG: reservas de cancha/sesion ─────────────────────────────────────────

async function handleSessionBooking({
    req, txId, txReference, internalStatus, txAmountCop,
}: HandlerArgs): Promise<HandlerResult> {
    const { data: booking, error: bookingErr } = await supabase
        .from('session_bookings')
        .select('id, user_id, price, payment_status, wompi_transaction_id')
        .eq('wompi_reference', txReference)
        .maybeSingle();

    if (bookingErr || !booking) {
        req.log?.warn({ txReference }, 'Session booking not found');
        return { status: 200, body: { status: 'ignored', reason: 'booking_not_found' } };
    }

    if (booking.wompi_transaction_id === txId && booking.payment_status === 'paid') {
        return { status: 200, body: { status: 'already_processed' } };
    }

    if (internalStatus === 'paid') {
        if (Math.abs(txAmountCop - Number(booking.price)) > 1) {
            req.log?.error({ expected: booking.price, received: txAmountCop, txReference }, 'Booking amount mismatch');
            return { status: 400, body: { error: 'Amount mismatch' } };
        }

        const { data: result, error } = await supabase.rpc('confirm_session_booking_payment', {
            p_booking_id: booking.id,
            p_wompi_reference: txReference,
            p_wompi_transaction_id: txId,
        });

        if (error) {
            req.log?.error({ err: error }, 'confirm_session_booking_payment failed');
            return { status: 500, body: { error: 'Confirm RPC failed' } };
        }

        return { status: 200, body: { status: 'ok', kind: 'session_booking', result } };
    }

    // Failed/declined → flag for review
    await supabase
        .from('session_bookings')
        .update({
            payment_status: internalStatus === 'rejected' ? 'failed' : internalStatus,
            wompi_transaction_id: txId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

    await supabase.rpc('flag_payment_for_review', {
        p_kind: 'session_booking',
        p_id: booking.id,
        p_reason: `wompi_${internalStatus} (tx=${txId})`,
    });

    return { status: 200, body: { status: 'ok', kind: 'session_booking', internalStatus, flagged_for_review: true } };
}

// ─── Captura de token reutilizable tras APPROVED ─────────────────────────
//
// Solo guardamos tarjeta si el padre opto explicitamente en el modal de
// checkout (POST /payment-tokens/save-intent crea una fila en
// pending_card_saves con los acceptance tokens que el usuario acepto).
// Sin esa fila, NO guardamos — respeta opt-in del usuario y deja prueba
// legal de aceptacion (Habeas Data).
//
// Si hay consent y la tarjeta es CARD, convertimos el token efimero del
// Widget (~15 min TTL) en un payment_source permanente via POST /v1/
// payment_sources y lo guardamos como provider_payment_source_id.
async function maybeCaptureToken(
    req: Request,
    realTx: any,
    txReference: string,
    creds?: WompiCreds,
): Promise<void> {
    try {
        const pm = realTx?.payment_method;
        const ephemeralToken: string | undefined = pm?.token || pm?.extra?.token;
        if (!ephemeralToken) return;

        // 1. Buscar consent del padre. Sin consent no guardamos.
        const { data: consentRows, error: consentErr } = await supabase
            .rpc('consume_card_save_intent', { p_reference: txReference });

        if (consentErr) {
            req.log?.warn({ err: consentErr, txReference }, 'consume_card_save_intent failed');
            return;
        }
        const consent = Array.isArray(consentRows) ? consentRows[0] : consentRows;
        if (!consent?.user_id) {
            // No hay consent → el padre NO opto por guardar. Respetamos.
            req.log?.info({ txReference }, 'no card save consent for this reference; skipping tokenization');
            return;
        }

        const customerEmail: string = realTx?.customer_email || '';
        if (!customerEmail) {
            req.log?.warn({ txReference }, 'no customer_email in tx; cannot create payment_source');
            return;
        }

        // 2. Crear payment_source permanente en Wompi.
        const paymentMethodType = (pm?.type || 'CARD') as 'CARD' | 'NEQUI' | 'DAVIPLATA' | 'BANCOLOMBIA_TRANSFER';
        // Mismo comercio que cobró: el payment_source queda ligado a esa cuenta Wompi.
        const psRes = await createPaymentSource({
            cardToken: ephemeralToken,
            customerEmail,
            acceptanceToken: consent.acceptance_token,
            personalDataAuthToken: consent.personal_data_auth_token,
            type: paymentMethodType,
        }, creds);

        if (!psRes.ok) {
            req.log?.warn({ err: psRes.error, txReference, userId: consent.user_id }, 'createPaymentSource failed');
            return;
        }

        // 3. Guardar payment_token con provider_payment_source_id + auditar consent.
        const { data: saveRes, error: saveErr } = await supabase.rpc('save_payment_token', {
            p_user_id: consent.user_id,
            p_payment_provider: 'wompi',
            p_provider_token: ephemeralToken,                 // efimero, para debug
            p_provider_customer_id: null,
            p_provider_card_id: null,
            p_provider_payment_source_id: psRes.paymentSourceId,
            p_payment_method_type: paymentMethodType,
            p_last_four: pm?.extra?.last_four || null,
            p_brand: pm?.extra?.brand || null,
            p_holder_name: pm?.extra?.card_holder || null,
            p_expires_at: null,
            p_set_default: false,
        });

        if (saveErr || !saveRes?.ok) {
            req.log?.warn({ err: saveErr || saveRes, txReference }, 'save_payment_token failed');
            return;
        }

        // 4. Insertar prueba durable en payment_consents (auditoria inalterable).
        await supabase.from('payment_consents').insert({
            user_id: consent.user_id,
            payment_provider: 'wompi',
            acceptance_token: consent.acceptance_token,
            personal_data_auth_token: consent.personal_data_auth_token,
            acceptance_permalink: consent.acceptance_permalink,
            personal_data_permalink: consent.personal_data_permalink,
            accepted_at: consent.accepted_at,
            ip_address: consent.ip_address,
            user_agent: consent.user_agent,
            payment_token_id: saveRes.token_id,
            metadata: {
                tx_reference: txReference,
                payment_source_id: psRes.paymentSourceId,
                payment_source_status: psRes.status,
            },
        });

        req.log?.info(
            { userId: consent.user_id, txReference, paymentSourceId: psRes.paymentSourceId },
            'Wompi payment_source created + consent recorded',
        );
    } catch (err: any) {
        req.log?.warn({ err: err?.message || err }, 'maybeCaptureToken failed (non-blocking)');
    }
}

export default router;
