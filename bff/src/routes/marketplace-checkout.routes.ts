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
import { supabase } from '../config/supabase';
import { generateReference, copToCents, assertUserNotBlocked, UserPaymentBlockedError, voidTransaction } from '../services/wompi.service';
import { generateMpReference } from '../services/mercadopago.service';
import { resolveProvider, type PaymentProvider } from '../services/payment-provider.resolver';

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

const CartCheckoutSchema = z.object({
    items: z.array(
        z.object({
            productId: z.string().uuid(),
            variantId: z.string().uuid().optional(),
            quantity: z.number().int().positive(),
        }),
    ).min(1),
    shippingAddress: z.object({
        line1: z.string().min(1),
        line2: z.string().optional(),
        city: z.string().min(1),
        department: z.string().min(1),
        postalCode: z.string().optional(),
    }),
    contactPhone: z.string().min(7),
    contactEmail: z.string().email(),
    customerName: z.string().min(2),
    customerDocument: z.string().optional(),
    notes: z.string().optional(),
    preferredProvider: z.enum(['wompi', 'mercadopago']).optional(),
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/service
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/service', ensureUserNotBlocked, async (req: Request, res: Response) => {
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
router.post('/checkout/event', ensureUserNotBlocked, async (req: Request, res: Response) => {
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
router.post('/checkout/subscription', ensureUserNotBlocked, async (req: Request, res: Response) => {
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
// POST /checkout/cart — Carrito de productos del shop
// ─────────────────────────────────────────────────────────────────────────────
// Crea la order + order_items, calcula totales en server (incluye envio e IVA),
// y devuelve la reference Wompi para abrir el Widget en el frontend.
router.post('/checkout/cart', ensureUserNotBlocked, async (req: Request, res: Response) => {
    try {
        const parsed = CartCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { items, shippingAddress, contactPhone, contactEmail, customerName, customerDocument, notes, preferredProvider } = parsed.data;

        // 1. Obtener productos (precio + stock + vendor_id) desde la BD — NUNCA confiar en el cliente
        const productIds = items.map(i => i.productId);
        const { data: products, error: productsErr } = await supabase
            .from('products')
            .select('id, name, price, stock, vendor_id, status, product_variants(id, sku, price_override, stock, is_active)')
            .in('id', productIds);

        if (productsErr || !products || products.length === 0) {
            return res.status(400).json({ ok: false, error: 'Productos no encontrados.' });
        }

        // 2. Validar disponibilidad y construir line items
        type LineItem = {
            productId: string;
            variantId: string | null;
            quantity: number;
            unitPrice: number;
            subtotal: number;
            taxAmount: number;
            vendorId: string | null;
            name: string;
        };
        const lineItems: LineItem[] = [];
        const TAX_RATE = 0.19; // IVA Colombia — calcular en server

        for (const requested of items) {
            const product: any = products.find(p => p.id === requested.productId);
            if (!product) {
                return res.status(400).json({ ok: false, error: `Producto ${requested.productId} no existe.` });
            }
            if (product.status && product.status !== 'active') {
                return res.status(400).json({ ok: false, error: `${product.name}: producto inactivo.` });
            }

            let unitPrice = Number(product.price);
            let availableStock = Number(product.stock);
            let variantId: string | null = null;

            if (requested.variantId) {
                const variant = product.product_variants?.find((v: any) => v.id === requested.variantId);
                if (!variant) {
                    return res.status(400).json({ ok: false, error: `${product.name}: variante no encontrada.` });
                }
                if (!variant.is_active) {
                    return res.status(400).json({ ok: false, error: `${product.name}: variante inactiva.` });
                }
                if (variant.price_override !== null && variant.price_override !== undefined) {
                    unitPrice = Number(variant.price_override);
                }
                availableStock = Number(variant.stock);
                variantId = variant.id;
            }

            if (availableStock < requested.quantity) {
                return res.status(400).json({
                    ok: false,
                    error: `${product.name}: solo quedan ${availableStock} unidades.`,
                });
            }

            const subtotal = unitPrice * requested.quantity;
            const taxAmount = Math.round(subtotal * TAX_RATE);

            lineItems.push({
                productId: product.id,
                variantId,
                quantity: requested.quantity,
                unitPrice,
                subtotal,
                taxAmount,
                vendorId: product.vendor_id || null,
                name: product.name,
            });
        }

        // 3. Calcular envio en server (tabla shipping_zones)
        const { data: zone } = await supabase
            .from('shipping_zones')
            .select('costo_base')
            .eq('departamento', shippingAddress.department)
            .maybeSingle();

        const shippingCost = zone?.costo_base ? Number(zone.costo_base) : 18000; // fallback regional

        // 4. Totales
        const subtotalSum = lineItems.reduce((a, l) => a + l.subtotal, 0);
        const taxTotal = lineItems.reduce((a, l) => a + l.taxAmount, 0);
        const grossAmount = subtotalSum + taxTotal + shippingCost;

        // 5. Resolver provider (per vendor); default marketplace global si no hay vendor.
        const primaryVendorId = lineItems[0]?.vendorId || null;
        const resolved = await resolveProvider({ vendorId: primaryVendorId, preferredProvider });
        const provider: PaymentProvider = resolved?.provider ?? 'wompi';

        // 6. Generar reference segun provider
        const reference = provider === 'mercadopago'
            ? generateMpReference('cart')
            : generateReference('cart');

        // 7. Crear order (vendor_id = primer vendor; multi-vendor split se hace en webhook)
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                user_id: req.user.id,
                vendor_id: primaryVendorId,
                total_amount: grossAmount,
                tax_total: taxTotal,
                shipping_cost: shippingCost,
                status: 'pending',
                payment_method: provider,
                payment_provider: provider,
                provider_reference: reference,
                wompi_reference: provider === 'wompi' ? reference : null,
                shipping_address: shippingAddress,
                contact_phone: contactPhone,
                contact_email: contactEmail,
                customer_name: customerName,
                customer_document: customerDocument || null,
                notes: notes || null,
            })
            .select('id')
            .single();

        if (orderErr || !order) {
            req.log?.error({ err: orderErr }, 'Error inserting order');
            return res.status(500).json({ ok: false, error: 'Error creando la orden.' });
        }

        // 7. Crear order_items
        const orderItems = lineItems.map(l => ({
            order_id: order.id,
            product_id: l.productId,
            variant_id: l.variantId,
            vendor_id: l.vendorId,
            quantity: l.quantity,
            unit_price: l.unitPrice,
            subtotal: l.subtotal,
            tax_amount: l.taxAmount,
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);

        if (itemsErr) {
            req.log?.error({ err: itemsErr }, 'Error inserting order_items');
            // Rollback de la orden para evitar zombies
            await supabase.from('orders').delete().eq('id', order.id);
            return res.status(500).json({ ok: false, error: 'Error guardando los productos.' });
        }

        await auditLog(req, 'cart_checkout', 'orders', order.id, null, {
            amount: grossAmount,
            items: lineItems.length,
            reference,
        });

        return res.status(201).json({
            ok: true,
            data: {
                orderId: order.id,
                provider,
                publicKey: resolved?.publicKey ?? null,
                sandbox: resolved?.sandbox ?? true,
                reference,
                amountInCents: copToCents(grossAmount),
                transactionAmount: grossAmount,
                grossAmount,
                subtotal: subtotalSum,
                taxTotal,
                shippingCost,
                items: lineItems.map(l => ({
                    productId: l.productId,
                    variantId: l.variantId,
                    name: l.name,
                    quantity: l.quantity,
                    unitPrice: l.unitPrice,
                    subtotal: l.subtotal,
                })),
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in cart checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/pay — Pagar marketplace_transaction existente
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/pay', ensureUserNotBlocked, async (req: Request, res: Response) => {
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

router.post('/refund', async (req: Request, res: Response) => {
    try {
        const parsed = RefundRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos', details: parsed.error.issues });
        }

        const { orderId, transactionId, paymentId, reason } = parsed.data;

        const { data: result, error } = await supabase.rpc('request_refund', {
            p_order_id: orderId || null,
            p_transaction_id: transactionId || null,
            p_payment_id: paymentId || null,
            p_reason: reason,
        });

        if (error) {
            req.log?.error({ err: error }, 'request_refund RPC failed');
            return res.status(500).json({ ok: false, error: 'Error solicitando reembolso.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
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
//  1. RPC approve_refund verifica permisos del actor
//  2. Buscar el wompi_transaction_id del origen (order/tx/payment)
//  3. Llamar voidTransaction(wompi_tx_id) en Wompi
//  4. RPC complete_refund marca refunded + restituye stock si era cart
router.post('/refund/:id/process', async (req: Request, res: Response) => {
    try {
        const refundId = req.params.id;

        // 1. Aprobar (verifica permisos via SECURITY DEFINER + auth.uid())
        const { data: approval, error: approveErr } = await supabase.rpc('approve_refund', {
            p_refund_id: refundId,
        });

        if (approveErr) {
            req.log?.error({ err: approveErr }, 'approve_refund RPC failed');
            return res.status(500).json({ ok: false, error: 'Error aprobando reembolso.' });
        }

        if (!approval?.ok) {
            const code = approval?.error || 'unknown';
            const status = code === 'forbidden' ? 403 : code === 'unauthenticated' ? 401 : 400;
            return res.status(status).json({ ok: false, error: code });
        }

        // 2. Resolver wompi_transaction_id
        const { data: refund } = await supabase
            .from('refunds')
            .select('id, order_id, transaction_id, payment_id')
            .eq('id', refundId)
            .single();

        if (!refund) {
            return res.status(404).json({ ok: false, error: 'Reembolso no encontrado.' });
        }

        let wompiTxId: string | null = null;
        if (refund.order_id) {
            const { data } = await supabase
                .from('orders')
                .select('wompi_transaction_id')
                .eq('id', refund.order_id)
                .single();
            wompiTxId = data?.wompi_transaction_id || null;
        } else if (refund.transaction_id) {
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

        // 3. Llamar void en Wompi
        const voidRes = await voidTransaction(wompiTxId);
        if (!voidRes.ok) {
            await supabase.from('refunds').update({ status: 'failed', rejection_reason: voidRes.error }).eq('id', refundId);
            req.log?.error({ refundId, err: voidRes.error }, 'voidTransaction failed');
            return res.status(502).json({ ok: false, error: voidRes.error });
        }

        // 4. Completar (restitucion de stock atomica si aplica)
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
