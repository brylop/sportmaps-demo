/**
 * marketplace-checkout — Checkouts del marketplace via Wompi.
 *
 * Endpoints:
 *  - POST /checkout/service       — Cita de servicio (fisio, coach, etc)
 *  - POST /checkout/event         — Inscripcion individual a evento
 *  - POST /checkout/subscription  — Suscripcion (plan)
 *  - POST /checkout/cart          — Compra de productos del shop (NUEVO)
 *  - POST /checkout/pay           — Pagar marketplace_transaction existente
 *  - POST /refund                 — Solicitar reembolso
 *  - GET  /transactions           — Mis transacciones
 *  - GET  /subscriptions          — Mis suscripciones
 *  - PATCH /subscriptions/:id/cancel
 *
 * Flujo Wompi:
 *  1. BFF crea la marketplace_transaction (o order para cart) con un wompi_reference unico
 *  2. BFF responde { reference, amountInCents }
 *  3. Frontend abre el Widget Wompi con esos datos + signature de Edge Function
 *  4. Wompi llama a /api/v1/webhooks/wompi cuando la tx cambia de estado
 *  5. Webhook reconcilia y descuenta stock / activa suscripcion / etc
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import { generateReference, copToCents, assertUserNotBlocked, UserPaymentBlockedError, voidTransaction } from '../services/wompi.service';
import { requireStoreEnabled } from '../services/store-flag.service';
import { refundErrorStatus, mapStoreRpcError } from '../services/store-rpc-errors';
import { StoreCheckoutSchema, toCreateCartOrderArgs, gatewayPayloadForOrder, sellerWompiCredsForOrder, type GatewayPayload } from '../services/store-checkout';

const router = Router();

router.use(requireMarketplaceAuth);

// Middleware comun para todos los endpoints de checkout: bloquea si el usuario
// tiene pagos pendientes de revision por el negocio.
async function ensureUserNotBlocked(req: Request, res: Response, next: () => void) {
    try {
        await assertUserNotBlocked(req.user.id);
        next();
    } catch (err) {
        if (err instanceof UserPaymentBlockedError) {
            return res.status(409).json({
                ok: false,
                error: err.message,
                code: err.code,
                details: err.details,
            });
        }
        return res.status(500).json({ ok: false, error: 'Error verificando estado de pagos.' });
    }
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const ServiceCheckoutSchema = z.object({
    appointmentId: z.string().uuid(),
    serviceListingId: z.string().uuid().optional(),
    serviceVariationId: z.string().uuid().optional(),
});

const EventCheckoutSchema = z.object({
    eventRegistrationId: z.string().uuid(),
});

const SubscriptionCheckoutSchema = z.object({
    planId: z.string().uuid(),
});

const GenericPaySchema = z.object({
    transactionId: z.string().uuid(),
});

const SessionBookingCheckoutSchema = z.object({
    bookingId: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/service
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/service', requireStoreEnabled, ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = ServiceCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { appointmentId, serviceListingId, serviceVariationId } = parsed.data;

        const { data: result, error } = await supabase.rpc('create_service_checkout', {
            p_appointment_id: appointmentId,
            p_service_listing_id: serviceListingId || null,
            p_service_variation_id: serviceVariationId || null,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_service_checkout RPC failed');
            return res.status(500).json({ ok: false, error: 'Error creando checkout.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        // Cortesia — sin cobro
        if (result.is_courtesy) {
            await auditLog(req, 'service_courtesy', 'marketplace_transactions', result.transaction_id);
            return res.status(200).json({ ok: true, data: result });
        }

        const reference = generateReference('service');
        await supabase
            .from('marketplace_transactions')
            .update({ wompi_reference: reference })
            .eq('id', result.transaction_id);

        await auditLog(req, 'service_checkout', 'marketplace_transactions', result.transaction_id, null, {
            amount: result.amount,
            reference,
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result,
                reference,
                amountInCents: copToCents(Number(result.amount)),
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in service checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/event
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/event', requireStoreEnabled, ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = EventCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { eventRegistrationId } = parsed.data;

        const { data: result, error } = await supabase.rpc('create_event_checkout', {
            p_event_registration_id: eventRegistrationId,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_event_checkout RPC failed');
            return res.status(500).json({ ok: false, error: 'Error creando checkout.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        if (result.is_free) {
            await auditLog(req, 'event_free_registration', 'marketplace_transactions', result.transaction_id);
            return res.status(200).json({ ok: true, data: result });
        }

        const reference = generateReference('event');
        await supabase
            .from('marketplace_transactions')
            .update({ wompi_reference: reference })
            .eq('id', result.transaction_id);

        await auditLog(req, 'event_checkout', 'marketplace_transactions', result.transaction_id, null, {
            amount: result.amount,
            reference,
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result,
                reference,
                amountInCents: copToCents(Number(result.amount)),
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in event checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/subscription
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/subscription', requireStoreEnabled, ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = SubscriptionCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { planId } = parsed.data;

        const { data: result, error } = await supabase.rpc('create_subscription', {
            p_plan_id: planId,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_subscription RPC failed');
            return res.status(500).json({ ok: false, error: 'Error creando suscripcion.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        // Trial — no cobrar
        if (result.is_trial) {
            await auditLog(req, 'subscription_trial', 'subscriptions', result.subscription_id);
            return res.status(200).json({ ok: true, data: result });
        }

        const reference = generateReference('subscription');
        await supabase
            .from('marketplace_transactions')
            .update({ wompi_reference: reference })
            .eq('id', result.transaction_id);

        await auditLog(req, 'subscription_checkout', 'marketplace_transactions', result.transaction_id, null, {
            amount: result.amount,
            subscription_id: result.subscription_id,
            reference,
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result,
                reference,
                amountInCents: copToCents(Number(result.amount)),
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in subscription checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/session-booking — Reserva de cancha/sesion con cobro
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/session-booking', ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = SessionBookingCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { bookingId } = parsed.data;

        // Booking debe existir, pertenecer al user y tener precio > 0
        const { data: booking, error: bookErr } = await supabase
            .from('session_bookings')
            .select('id, user_id, price, payment_status, requires_review')
            .eq('id', bookingId)
            .eq('user_id', req.user.id)
            .single();

        if (bookErr || !booking) {
            return res.status(404).json({ ok: false, error: 'Reserva no encontrada.' });
        }

        if ((booking as any).requires_review) {
            return res.status(409).json({ ok: false, error: 'Reserva bloqueada pendiente de revision.', code: 'BOOKING_REQUIRES_REVIEW' });
        }

        if (booking.payment_status === 'paid') {
            return res.status(400).json({ ok: false, error: 'Reserva ya pagada.' });
        }

        const price = Number(booking.price ?? 0);
        if (price <= 0) {
            // Reserva gratis: marcar como free y retornar
            await supabase.from('session_bookings').update({ payment_status: 'free' }).eq('id', booking.id);
            return res.json({ ok: true, data: { is_free: true, bookingId } });
        }

        const reference = generateReference('session_booking');
        await supabase
            .from('session_bookings')
            .update({ wompi_reference: reference, payment_status: 'pending' })
            .eq('id', booking.id);

        await auditLog(req, 'session_booking_checkout', 'session_bookings', booking.id, null, {
            amount: price,
            reference,
        });

        return res.status(201).json({
            ok: true,
            data: {
                bookingId,
                reference,
                amount: price,
                amountInCents: copToCents(price),
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in session-booking checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/cart — Carrito de la tienda (tienda v2 F0, M-F0-4)
// ─────────────────────────────────────────────────────────────────────────────
// La orden la crea la RPC create_cart_order en UNA transaccion: precio, IVA
// incluido (spec 6.3), envio por zona, reserva de stock (FOR UPDATE) e
// idempotency_key salen de la base. El BFF solo:
//   - pasa el comprador de la sesion (p_buyer_id; service role);
//   - para Wompi/MP arma el widget con las llaves PROPIAS del vendedor
//     (orders.seller_gateway_id). Nunca llaves de ENV (D-5 = A);
//   - para transferencia devuelve las cuentas reales del vendedor.
// Contrato: docs/specs/tienda-v2-contrato-checkout.md.
router.post('/checkout/cart', requireStoreEnabled, ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = StoreCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const args = toCreateCartOrderArgs(parsed.data, req.user.id);
        const { data: order, error } = await supabase.rpc('create_cart_order', args);
        if (error) {
            const mapped = mapStoreRpcError(error);
            if (mapped.status >= 500) req.log?.error({ err: error }, 'create_cart_order failed');
            return res.status(mapped.status).json({
                ok: false, error: mapped.code, message: mapped.message,
                ...(mapped.details !== undefined ? { details: mapped.details } : {}),
            });
        }

        const summary = order as Record<string, any>;
        let gateway: GatewayPayload | null = null;
        let transfer: unknown = null;

        if (summary.payment_method === 'wompi' || summary.payment_method === 'mercadopago') {
            try {
                gateway = await gatewayPayloadForOrder({
                    id: summary.order_id,
                    reference: summary.reference,
                    total_amount: summary.total,
                    payment_method: summary.payment_method,
                    seller_gateway_id: summary.seller_gateway_id,
                    seller_gateway_kind: summary.seller_gateway_kind,
                });
            } catch (gwErr: any) {
                // La base eligio la pasarela del vendedor pero sus secretos no se
                // pueden usar: no se cobra (y jamas con las llaves de ENV). La
                // reserva vence sola o el comprador cancela.
                req.log?.warn({ orderId: summary.order_id, err: gwErr?.message }, 'seller gateway not usable');
                return res.status(409).json({
                    ok: false,
                    error: 'SELLER_GATEWAY_NOT_CONFIGURED',
                    message: 'La tienda no tiene su pasarela lista. Elige otro medio de pago.',
                    orderId: summary.order_id,
                });
            }
        } else if (summary.payment_method === 'transfer') {
            const { data: accounts } = await supabase.rpc('store_transfer_accounts', {
                p_order_id: summary.order_id,
                p_actor: req.user.id,
            });
            transfer = accounts ?? null;
        }

        if (!summary.idempotent) {
            await auditLog(req, 'cart_checkout', 'orders', summary.order_id, null, {
                amount: summary.total,
                items: Array.isArray(summary.items) ? summary.items.length : 0,
                reference: summary.reference,
                payment_method: summary.payment_method,
            });
        }

        return res.status(summary.idempotent ? 200 : 201).json({
            ok: true,
            data: {
                // Compat con CartCheckoutModal / useWompiCheckout.startCartCheckout
                orderId: summary.order_id,
                reference: summary.reference,
                provider: gateway?.provider ?? summary.payment_method,
                publicKey: gateway?.publicKey ?? null,
                sandbox: gateway?.sandbox ?? null,
                signature: gateway?.signature ?? null,
                amountInCents: Number(summary.amount_in_cents),
                transactionAmount: Number(summary.total),
                grossAmount: Number(summary.total),
                subtotal: Number(summary.subtotal),
                taxTotal: Number(summary.tax_total),
                shippingCost: Number(summary.shipping),
                // Contrato nuevo
                status: summary.status,
                paymentMethod: summary.payment_method,
                expiresAt: summary.expires_at,
                pickupCode: summary.pickup_code ?? null,
                idempotent: !!summary.idempotent,
                transfer,
                items: summary.items,
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in cart checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

// POST /checkout/cart/quote — cotizacion de solo lectura (quote_cart).
router.post('/checkout/cart/quote', requireStoreEnabled, async (req: Request, res: Response) => {
    try {
        const parsed = StoreCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }
        const args = toCreateCartOrderArgs(parsed.data, req.user.id);
        // quote_cart decide school_only con auth.uid(): con service role es NULL
        // y un miembro de la escuela recibía PRODUCT_NOT_AVAILABLE. Se cotiza
        // con el JWT del comprador (la RPC es de solo lectura y está GRANT a authenticated).
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: req.headers.authorization ?? '' } },
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await userClient.rpc('quote_cart', {
            p_items: args.p_items,
            p_fulfillment: args.p_fulfillment,
            p_address: args.p_address,
            p_coupon_code: args.p_coupon_code,
        });
        if (error) {
            const mapped = mapStoreRpcError(error);
            return res.status(mapped.status).json({ ok: false, error: mapped.code, message: mapped.message });
        }
        return res.json({ ok: true, data });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/pay — Pagar marketplace_transaction existente
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/pay', requireStoreEnabled, ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = GenericPaySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos' });
        }

        const { transactionId } = parsed.data;

        const { data: tx, error: txErr } = await supabase
            .from('marketplace_transactions')
            .select('id, gross_amount, status, description, wompi_reference')
            .eq('id', transactionId)
            .eq('user_id', req.user.id)
            .eq('status', 'pending')
            .single();

        if (txErr || !tx) {
            return res.status(404).json({ ok: false, error: 'Transaccion no encontrada o ya procesada.' });
        }

        // Reusar reference si existe, generar uno nuevo si no
        let reference = tx.wompi_reference;
        if (!reference) {
            reference = generateReference('marketplace_pay');
            await supabase
                .from('marketplace_transactions')
                .update({ wompi_reference: reference })
                .eq('id', tx.id);
        }

        return res.status(201).json({
            ok: true,
            data: {
                transaction_id: tx.id,
                reference,
                amount: tx.gross_amount,
                amountInCents: copToCents(Number(tx.gross_amount)),
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in generic pay');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /refund — Cliente solicita reembolso (orden | tx | payment)
// ─────────────────────────────────────────────────────────────────────────────
const RefundRequestSchema = z.object({
    orderId: z.string().uuid().optional(),
    transactionId: z.string().uuid().optional(),
    paymentId: z.string().uuid().optional(),
    reason: z.string().min(5),
}).refine(
    (d) => [d.orderId, d.transactionId, d.paymentId].filter(Boolean).length === 1,
    { message: 'Debes especificar exactamente uno: orderId, transactionId o paymentId' },
);

router.post('/refund', requireStoreEnabled, async (req: Request, res: Response) => {
    try {
        const parsed = RefundRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { orderId, transactionId, paymentId, reason } = parsed.data;

        // Órdenes de la tienda: RPC propia con actor explícito (tienda v2 F0,
        // M-F0-6). El BFF usa service role → auth.uid() es NULL adentro.
        // request_refund queda para marketplace_transactions y payments.
        const { data: result, error } = orderId
            ? await supabase.rpc('request_order_refund', {
                p_order_id: orderId,
                p_reason: reason,
                p_actor: req.user.id,
            })
            : await supabase.rpc('request_refund', {
                p_order_id: null,
                p_transaction_id: transactionId || null,
                p_payment_id: paymentId || null,
                p_reason: reason,
            });

        if (error) {
            req.log?.error({ err: error, orderId }, 'refund request RPC failed');
            return res.status(500).json({ ok: false, error: 'Error solicitando reembolso.' });
        }

        if (!result?.ok) {
            const code = result?.error || 'Error desconocido';
            return res.status(orderId ? refundErrorStatus(code) : 400).json({ ok: false, error: code });
        }

        await auditLog(req, 'refund_request', 'refunds', result.refund_id, null, {
            amount: result.refund_amount,
            pct: result.refund_pct,
        });

        return res.json({ ok: true, data: result });
    } catch (err: any) {
        req.log?.error({ err }, 'Error requesting refund');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /refund/:id/process — Vendor/admin/owner aprueba y ejecuta void en Wompi
// ─────────────────────────────────────────────────────────────────────────────
// Flujo:
//  1. RPC approve_order_refund (orden, con p_actor) o approve_refund (tx/payment)
//     verifica permisos del actor
//  2. Buscar el wompi_transaction_id del origen (order/tx/payment)
//  3. Llamar voidTransaction(wompi_tx_id) en Wompi
//  4. RPC complete_refund marca refunded + restituye stock si era cart
router.post('/refund/:id/process', requireStoreEnabled, async (req: Request, res: Response) => {
    try {
        const refundId = req.params.id;

        // 1. Leer el reembolso: el origen decide qué RPC aprueba.
        const { data: refund } = await supabase
            .from('refunds')
            .select('id, order_id, transaction_id, payment_id')
            .eq('id', refundId)
            .maybeSingle();

        if (!refund) {
            return res.status(404).json({ ok: false, error: 'Reembolso no encontrado.' });
        }

        // 2. Aprobar. Orden de la tienda → approve_order_refund con actor
        //    explícito (M-F0-6; con service role auth.uid() es NULL). El resto
        //    (marketplace_transactions / payments) sigue con approve_refund.
        const { data: approval, error: approveErr } = refund.order_id
            ? await supabase.rpc('approve_order_refund', {
                p_refund_id: refundId,
                p_actor: req.user.id,
            })
            : await supabase.rpc('approve_refund', {
                p_refund_id: refundId,
            });

        if (approveErr) {
            req.log?.error({ err: approveErr, refundId }, 'approve refund RPC failed');
            return res.status(500).json({ ok: false, error: 'Error aprobando reembolso.' });
        }

        if (!approval?.ok) {
            const code = approval?.error || 'unknown';
            const status = refund.order_id
                ? refundErrorStatus(code)
                : code === 'forbidden' ? 403 : code === 'unauthenticated' ? 401 : 400;
            return res.status(status).json({ ok: false, error: code });
        }

        // 3. Órdenes de la tienda (tienda v2 F0, D-5 = A): el vendedor cobró con
        //    SUS llaves, así que el void va con SUS llaves (nunca ENV).
        //    Transferencia / efectivo: no hay pasarela; el vendedor devuelve la
        //    plata por fuera y acá solo se completa el reembolso (stock,
        //    settlements y evento contable los hace la base una sola vez).
        if (refund.order_id) {
            const { data: ord } = await supabase
                .from('orders')
                .select('id, reference, total_amount, payment_method, seller_gateway_id, seller_gateway_kind, wompi_transaction_id, provider_transaction_id')
                .eq('id', refund.order_id)
                .single();
            const o: any = ord;
            let voidId = 'manual';
            if (o?.payment_method === 'wompi') {
                const creds = o ? await sellerWompiCredsForOrder(o) : null;
                const txId = o?.wompi_transaction_id || o?.provider_transaction_id || null;
                if (!creds || !txId) {
                    await supabase.from('refunds').update({ status: 'failed', rejection_reason: 'seller_gateway_or_tx_missing' }).eq('id', refundId);
                    return res.status(409).json({ ok: false, error: 'SELLER_GATEWAY_NOT_CONFIGURED' });
                }
                const voidRes = await voidTransaction(txId, creds);
                if (!voidRes.ok) {
                    await supabase.from('refunds').update({ status: 'failed', rejection_reason: voidRes.error }).eq('id', refundId);
                    return res.status(502).json({ ok: false, error: voidRes.error });
                }
                voidId = txId;
            } else if (o?.payment_method === 'mercadopago') {
                // Reembolso MP con llaves del vendedor: pendiente (no hay void MP en el BFF).
                return res.status(501).json({ ok: false, error: 'MP_REFUND_NOT_IMPLEMENTED' });
            }
            const { data: completion, error: compErr } = await supabase.rpc('complete_refund', {
                p_refund_id: refundId,
                p_wompi_void_id: voidId,
                p_provider: o?.payment_method === 'wompi' ? 'wompi' : 'manual',
            });
            if (compErr) {
                req.log?.error({ err: compErr, refundId }, 'complete_refund RPC failed');
                return res.status(500).json({ ok: false, error: 'Error finalizando reembolso.' });
            }
            await auditLog(req, 'refund_processed', 'refunds', refundId as string, null, { void_id: voidId });
            return res.json({ ok: true, data: { refundId, completion } });
        }

        let wompiTxId: string | null = null;
        if (refund.transaction_id) {
            const { data } = await supabase
                .from('marketplace_transactions')
                .select('wompi_transaction_id')
                .eq('id', refund.transaction_id)
                .single();
            wompiTxId = data?.wompi_transaction_id || null;
        } else if (refund.payment_id) {
            const { data } = await supabase
                .from('payments')
                .select('wompi_transaction_id')
                .eq('id', refund.payment_id)
                .single();
            wompiTxId = data?.wompi_transaction_id || null;
        }

        if (!wompiTxId) {
            await supabase.from('refunds').update({ status: 'failed', rejection_reason: 'no_wompi_tx_id' }).eq('id', refundId);
            return res.status(400).json({ ok: false, error: 'No hay transaccion Wompi asociada para reembolsar.' });
        }

        // 4. Llamar void en Wompi
        const voidRes = await voidTransaction(wompiTxId);
        if (!voidRes.ok) {
            await supabase.from('refunds').update({ status: 'failed', rejection_reason: voidRes.error }).eq('id', refundId);
            req.log?.error({ refundId, err: voidRes.error }, 'voidTransaction failed');
            return res.status(502).json({ ok: false, error: voidRes.error });
        }

        // 5. Completar (restitucion de stock atomica si aplica)
        const { data: completion, error: compErr } = await supabase.rpc('complete_refund', {
            p_refund_id: refundId,
            p_wompi_void_id: wompiTxId,  // Wompi reusa el id en void
        });

        if (compErr) {
            req.log?.error({ err: compErr, refundId }, 'complete_refund RPC failed');
            return res.status(500).json({ ok: false, error: 'Error finalizando reembolso.' });
        }

        await auditLog(req, 'refund_processed', 'refunds', refundId as string, null, { wompi_void_id: wompiTxId });

        return res.json({ ok: true, data: { refundId, completion } });
    } catch (err: any) {
        req.log?.error({ err }, 'Error processing refund');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /transactions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        const { type, status, page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let query = supabase
            .from('marketplace_transactions')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (type) query = query.eq('checkout_type', type as string);
        if (status) query = query.eq('status', status as string);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo transacciones.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriptions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriptions', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select(`
                *,
                subscription_plans (id, name, description, plan_type, price, billing_period, features)
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo suscripciones.' });
        }

        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /subscriptions/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/subscriptions/:id/cancel', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason, cancelImmediately } = req.body;

        const { data: sub, error: subErr } = await supabase
            .from('subscriptions')
            .select('id, status')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (subErr || !sub) {
            return res.status(404).json({ ok: false, error: 'Suscripcion no encontrada.' });
        }

        if (sub.status === 'cancelled') {
            return res.status(400).json({ ok: false, error: 'Suscripcion ya esta cancelada.' });
        }

        const updates: Record<string, unknown> = {
            cancellation_reason: reason || null,
        };

        if (cancelImmediately) {
            updates.status = 'cancelled';
            updates.cancelled_at = new Date().toISOString();
        } else {
            updates.cancel_at_period_end = true;
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error cancelando suscripcion.' });
        }

        await auditLog(req, 'subscription_cancel', 'subscriptions', id as string, null, {
            immediate: !!cancelImmediately,
        });

        return res.json({
            ok: true,
            data,
            message: cancelImmediately
                ? 'Suscripcion cancelada inmediatamente.'
                : 'La suscripcion se cancelara al final del periodo actual.',
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
