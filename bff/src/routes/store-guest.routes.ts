/**
 * store-guest — compra SIN cuenta en la tienda (D-13, mig. 20261013170553).
 * Montado en /api/v1/public/tienda (SIN login; requireOperationalSchool lo deja
 * pasar por /api/v1/public). Va ANTES del reviewsRouter de /api/v1, que le
 * exige sesión a todo lo que pasa por él.
 *
 *   GET  /medios/:vendorProfileId → store_payment_methods (sin secretos)
 *   POST /checkout                → create_guest_cart_order + correo con el enlace
 * Por token (header X-Pedido-Token; nunca en la URL del BFF → no queda en los logs):
 *   GET  /pedido                  → guest_order_view (estado, ítems, cuentas, sede)
 *   POST /pedido/receipt-url      → URL firmada (bucket privado order-receipts)
 *   POST /pedido/receipt          → guest_order_submit_receipt → awaiting_approval
 *   POST /pedido/pickup-code      → guest_order_regenerate_pickup_code (pagado, máx. 3)
 *   POST /pedido/cancel           → guest_order_cancel (libera la reserva)
 *   POST /pedido/pay              → reabrir el widget Wompi con las llaves DEL VENDEDOR
 *
 * La base decide todo (límites por correo/IP/hora, pedidos abiertos, monto,
 * school_only). Acá: validación del body, IP real (CF-Connecting-IP) y un
 * rate limit propio por IP, más estricto que el de la tienda con cuenta.
 * Token inexistente, mal formado o vencido → 404 NOT_FOUND (indistinguibles).
 */

import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { supabase } from '../config/supabase';
import { mapStoreRpcError } from '../services/store-rpc-errors';
import { requireStoreEnabled } from '../services/store-flag.service';
import { storeClientIp } from '../middlewares/storeRateLimit';
import { gatewayPayloadForOrder, findStoreOrderById, SellerGatewayError, type GatewayPayload } from '../services/store-checkout';
import { receiptObjectPath, ORDER_RECEIPTS_BUCKET } from './store-orders.routes';
import {
    GuestCheckoutSchema, toCreateGuestCartOrderArgs, guestTokenFrom, enviarCorreoPedidoInvitado,
    enlaceDePedido, baseEnlacePedido, type ResultadoCorreo,
} from '../services/store-guest';

const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function limiter(name: string, windowMs: number, max: number) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `tienda-invitado-${name}-${ipKeyGenerator(storeClientIp(req))}`,
        handler: (_req, res) => {
            res.status(429).json({ ok: false, error: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta en un minuto.' });
        },
    });
}

/** Crear pedidos: 10 por IP cada 10 min (la base además cuenta por correo/IP por hora). */
export const guestCheckoutLimiter = limiter('checkout', 10 * 60 * 1000, 10);
/** Leer el pedido / medios: 60 por minuto por IP. */
export const guestReadLimiter = limiter('leer', 60 * 1000, 60);
/** Acciones por token (comprobante, código, cancelar, pagar): 20 por IP cada 10 min. */
export const guestActionLimiter = limiter('accion', 10 * 60 * 1000, 20);

function sendRpcError(res: Response, error: any) {
    const mapped = mapStoreRpcError(error);
    return res.status(mapped.status).json({
        ok: false, error: mapped.code, message: mapped.message,
        ...(mapped.details !== undefined ? { details: mapped.details } : {}),
    });
}

function tokenOr404(req: Request, res: Response): string | null {
    const token = guestTokenFrom(req.headers as Record<string, unknown>);
    if (!token) {
        res.status(404).json({ ok: false, error: 'NOT_FOUND', message: 'Este enlace no existe o ya venció.' });
        return null;
    }
    return token;
}

async function viewByToken(token: string): Promise<{ data: any; error: any }> {
    return supabase.rpc('guest_order_view', { p_token: token });
}

// ─── Público ────────────────────────────────────────────────────────────────
router.get('/medios/:vendorProfileId', guestReadLimiter, async (req: Request, res: Response) => {
    const { vendorProfileId } = req.params as { vendorProfileId: string };
    if (!UUID.test(vendorProfileId)) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const { data, error } = await supabase.rpc('store_payment_methods', { p_vendor_profile_id: vendorProfileId });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.post('/checkout', guestCheckoutLimiter, requireStoreEnabled, async (req: Request, res: Response) => {
    try {
        const parsed = GuestCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            const campos = parsed.error.issues.map((i) => i.path.join('.'));
            const code = campos.includes('buyer.email') ? 'GUEST_EMAIL_REQUIRED'
                : campos.includes('buyer.name') ? 'GUEST_NAME_REQUIRED'
                    : campos.includes('buyer.phone') ? 'INVALID_PHONE'
                        : campos.includes('paymentMethod') ? 'GUEST_METHOD_NOT_AVAILABLE'
                            : 'INVALID_PARAMETER';
            const mapped = mapStoreRpcError({ message: code });
            return res.status(code === 'INVALID_PARAMETER' ? 400 : mapped.status).json({
                ok: false, error: code, message: code === 'INVALID_PARAMETER' ? 'Datos inválidos.' : mapped.message, details: campos,
            });
        }
        // Trampa para bots: el campo oculto vino lleno.
        if (parsed.data.website) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER', message: 'Datos inválidos.' });

        const ip = storeClientIp(req) || null;
        const args = toCreateGuestCartOrderArgs(parsed.data, ip);
        const { data: order, error } = await supabase.rpc('create_guest_cart_order', args);
        if (error) {
            const mapped = mapStoreRpcError(error);
            if (mapped.status >= 500) req.log?.error({ err: error }, 'create_guest_cart_order failed');
            return res.status(mapped.status).json({
                ok: false, error: mapped.code, message: mapped.message,
                ...(mapped.details !== undefined ? { details: mapped.details } : {}),
            });
        }

        const summary = order as Record<string, any>;
        const token: string | null = summary.access_token ?? null;

        // Reintento del mismo clic: misma orden, sin token nuevo (ya salió por correo).
        if (summary.idempotent || !token) {
            return res.status(200).json({
                ok: true,
                data: {
                    orderId: summary.order_id, reference: summary.reference, status: summary.status,
                    paymentMethod: summary.payment_method, grossAmount: Number(summary.total),
                    idempotent: true, accessToken: null, orderPath: null, emailSent: null,
                },
            });
        }

        let gateway: GatewayPayload | null = null;
        if (summary.payment_method === 'wompi') {
            try {
                gateway = await gatewayPayloadForOrder({
                    id: summary.order_id, reference: summary.reference, total_amount: summary.total,
                    payment_method: summary.payment_method, seller_gateway_id: summary.seller_gateway_id,
                    seller_gateway_kind: summary.seller_gateway_kind,
                });
            } catch (gwErr: any) {
                req.log?.warn({ orderId: summary.order_id, err: gwErr?.message }, 'seller gateway not usable (guest)');
                gateway = null; // el pedido queda reservado; se paga/cancela desde el enlace
            }
        }

        const { data: view } = await viewByToken(token);
        const tienda = view?.store?.display_name ?? 'la tienda';
        const correo: ResultadoCorreo = await enviarCorreoPedidoInvitado({
            to: String(summary.guest_email ?? parsed.data.buyer.email).toLowerCase(),
            nombre: parsed.data.buyer.name.trim(),
            tienda,
            referencia: summary.reference,
            total: Number(summary.total),
            medio: summary.payment_method,
            retiro: summary.fulfillment === 'pickup',
            sede: view?.pickup_branch?.name ?? null,
            codigoRetiro: summary.pickup_code ?? null,
            enlace: enlaceDePedido(baseEnlacePedido(), token),
        }, { log: (msg, extra) => req.log?.info(extra, msg) });

        return res.status(201).json({
            ok: true,
            data: {
                orderId: summary.order_id,
                reference: summary.reference,
                status: summary.status,
                paymentMethod: summary.payment_method,
                provider: gateway?.provider ?? summary.payment_method,
                publicKey: gateway?.publicKey ?? null,
                sandbox: gateway?.sandbox ?? null,
                signature: gateway?.signature ?? null,
                amountInCents: Number(summary.amount_in_cents),
                grossAmount: Number(summary.total),
                subtotal: Number(summary.subtotal),
                taxTotal: Number(summary.tax_total),
                shippingCost: Number(summary.shipping),
                expiresAt: summary.expires_at,
                pickupCode: summary.pickup_code ?? null,
                transfer: view?.transfer ?? null,
                items: summary.items,
                idempotent: false,
                // El enlace mágico: el front navega a /pedido/:token. Se entrega UNA vez.
                accessToken: token,
                orderPath: `/pedido/${token}`,
                emailSent: correo,
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in guest checkout');
        return res.status(500).json({ ok: false, error: 'INTERNAL', message: 'Error interno.' });
    }
});

// ─── Por token ──────────────────────────────────────────────────────────────
router.get('/pedido', guestReadLimiter, async (req: Request, res: Response) => {
    const token = tokenOr404(req, res);
    if (!token) return;
    const { data, error } = await viewByToken(token);
    if (error) return sendRpcError(res, error);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, data });
});

router.post('/pedido/receipt-url', guestActionLimiter, async (req: Request, res: Response) => {
    const token = tokenOr404(req, res);
    if (!token) return;
    try {
        const { data: view, error } = await viewByToken(token);
        if (error) return sendRpcError(res, error);
        const o = view?.order;
        if (!o || o.payment_method !== 'transfer' || !['pending_payment', 'awaiting_approval'].includes(o.status)) {
            return res.status(409).json({ ok: false, error: 'INVALID_STATE', status: o?.status ?? null });
        }
        const path = receiptObjectPath(o.id, req.body?.fileName);
        if (!path) return res.status(400).json({ ok: false, error: 'INVALID_FILE', message: 'Formatos: jpg, png, webp, heic o pdf.' });
        const { data, error: upErr } = await supabase.storage.from(ORDER_RECEIPTS_BUCKET).createSignedUploadUrl(path);
        if (upErr || !data) return res.status(500).json({ ok: false, error: 'UPLOAD_URL_FAILED' });
        return res.json({ ok: true, data: { bucket: ORDER_RECEIPTS_BUCKET, path, signedUrl: data.signedUrl, token: data.token } });
    } catch {
        return res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
});

router.post('/pedido/receipt', guestActionLimiter, async (req: Request, res: Response) => {
    const token = tokenOr404(req, res);
    if (!token) return;
    const path = typeof req.body?.path === 'string' ? req.body.path : '';
    if (path.length < 10 || path.length > 200) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const { data, error } = await supabase.rpc('guest_order_submit_receipt', { p_token: token, p_receipt_path: path });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.post('/pedido/pickup-code', guestActionLimiter, async (req: Request, res: Response) => {
    const token = tokenOr404(req, res);
    if (!token) return;
    const { data, error } = await supabase.rpc('guest_order_regenerate_pickup_code', { p_token: token });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.post('/pedido/cancel', guestActionLimiter, async (req: Request, res: Response) => {
    const token = tokenOr404(req, res);
    if (!token) return;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;
    const { data, error } = await supabase.rpc('guest_order_cancel', { p_token: token, p_reason: reason });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.post('/pedido/pay', guestActionLimiter, async (req: Request, res: Response) => {
    const token = tokenOr404(req, res);
    if (!token) return;
    try {
        const { data: view, error } = await viewByToken(token);
        if (error) return sendRpcError(res, error);
        const order = await findStoreOrderById(view.order.id);
        if (!order || order.status !== 'pending_payment') {
            return res.status(409).json({ ok: false, error: 'INVALID_STATE', status: order?.status ?? null });
        }
        if (order.payment_method !== 'wompi') {
            return res.json({ ok: true, data: { paymentMethod: order.payment_method } });
        }
        const gateway = await gatewayPayloadForOrder(order);
        return res.json({ ok: true, data: { paymentMethod: order.payment_method, ...gateway } });
    } catch (err: any) {
        if (err instanceof SellerGatewayError) return res.status(409).json({ ok: false, error: err.code, message: err.message });
        return res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
});

export default router;
