/**
 * wompi — Webhook unificado de Wompi (Colombia).
 *
 * Endpoint: POST /api/v1/webhooks/wompi
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
 *  - Valida checksum SHA256 con WOMPI_EVENTS_SECRET (validateWebhookChecksum).
 *  - Idempotencia por wompi_transaction_id (insercion unica).
 *  - Re-consulta el estado a Wompi para evitar webhook spoofing.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
    validateWebhookChecksum,
    fetchTransaction,
    mapWompiStatus,
    centsToCop,
    createPaymentSource,
} from '../services/wompi.service';

const router = Router();

router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const { event } = body;

        req.log?.info({ event }, 'Wompi webhook received');

        // 1. Validar checksum
        if (!validateWebhookChecksum(body)) {
            req.log?.warn('Wompi webhook checksum mismatch');
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

        // 2. Re-consultar a Wompi (defensa anti-spoofing)
        const realTx = await fetchTransaction(txId);
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
        const txAmountCop = centsToCop(realTx.amount_in_cents);

        // 3. Routing por prefijo de reference
        const prefix = txReference.split('-')[0];
        const handler = HANDLERS[prefix];

        if (!handler) {
            req.log?.warn({ prefix, txReference }, 'Wompi webhook: unknown reference prefix');
            // Devolver 200 para que Wompi no reintente; estos son referencias huerfanas
            return res.status(200).json({ status: 'ignored', reason: 'unknown_prefix', prefix });
        }

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

        // Captura de token: si la tx fue APPROVED y Wompi devolvio un token reusable,
        // intentar persistirlo si el user existe.
        if (internalStatus === 'paid') {
            await maybeCaptureToken(req, realTx, txReference);
        }

        return res.status(result.status).json(result.body);
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

// ─── SCH: pagos de escuela ─────────────────────────────────────────────────

async function handleSchoolPayment({
    req, txId, txReference, internalStatus, txAmountCop,
}: HandlerArgs): Promise<HandlerResult> {
    // 1. Buscar payment_link por referencia
    const { data: link, error: linkErr } = await supabase
        .from('payment_links')
        .select('id, payment_id, school_id, gross_amount, base_amount, sportmaps_fee, status, expires_at')
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

        const today = new Date().toISOString().split('T')[0];

        // 4. Marcar payment como pagado
        await supabase
            .from('payments')
            .update({
                status: 'paid',
                payment_channel: 'online',
                payment_method: 'wompi',
                payment_date: today,
                approved_at: new Date().toISOString(),
                wompi_reference: txReference,
                wompi_transaction_id: txId,
                gross_amount: txAmountCop,
                sportmaps_fee: link.sportmaps_fee,
                updated_at: new Date().toISOString(),
            })
            .eq('id', link.payment_id);

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
                school_receives: link.base_amount,
                sportmaps_receives: link.sportmaps_fee,
                wompi_fee: 0,
                transfer_status: 'pending',
                webhook_signature_valid: true,
            });

        req.log?.info({ paymentId: link.payment_id, txReference }, 'School payment confirmed');
        return { status: 200, body: { status: 'ok', kind: 'school_payment' } };
    }

    // No-paid (declined/voided/error) → marcar payment para review del negocio
    await supabase
        .from('payment_links')
        .update({
            status: internalStatus === 'rejected' ? 'declined' : internalStatus,
            failed_attempts: 1,
            updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);

    await supabase.rpc('flag_payment_for_review', {
        p_kind: 'payment',
        p_id: link.payment_id,
        p_reason: `wompi_${internalStatus} (tx=${txId})`,
    });

    req.log?.warn({ paymentId: link.payment_id, internalStatus }, 'School payment flagged for review');
    return { status: 200, body: { status: 'ok', kind: 'school_payment', internalStatus, flagged_for_review: true } };
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
async function maybeCaptureToken(req: Request, realTx: any, txReference: string): Promise<void> {
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
        const psRes = await createPaymentSource({
            cardToken: ephemeralToken,
            customerEmail,
            acceptanceToken: consent.acceptance_token,
            personalDataAuthToken: consent.personal_data_auth_token,
            type: paymentMethodType,
        });

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
