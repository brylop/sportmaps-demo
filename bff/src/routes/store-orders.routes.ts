/**
 * store-orders — acciones sobre órdenes de la tienda (tienda v2 F0, M-F0-4/M-F0-7).
 *
 * Todo cambio de estado va por RPC SECURITY DEFINER con el actor explícito
 * (p_actor = req.user.id): el BFF usa service role y adentro auth.uid() es
 * NULL. La base decide quién puede qué (comprador dueño, quien administra la
 * tienda por can_manage_store_as —owner/admin de la escuela, no coach—).
 *
 * Montado en /api/v1/store. Contrato: docs/specs/tienda-v2-contrato-checkout.md.
 *
 * Comprador:
 *   GET  /orders/:id/payment            → reabrir el pago (widget con llaves del vendedor / cuentas)
 *   GET  /orders/:id/transfer-accounts  → cuentas reales del vendedor (solo su orden)
 *   POST /orders/:id/receipt-url        → URL firmada para subir el comprobante (bucket privado)
 *   POST /orders/:id/receipt            → submit_order_receipt → awaiting_approval
 *   POST /orders/:id/cancel             → cancel_my_order
 *   POST /orders/:id/received           → order_transition(delivered) "Ya lo recibí"
 * Vendedor (quien administra la tienda):
 *   GET  /vendor/orders/:id/receipt-url → URL firmada de lectura del comprobante
 *   POST /vendor/orders/:id/approve-receipt
 *   POST /vendor/orders/:id/reject-receipt   {reason}
 *   POST /vendor/orders/:id/confirm-cash     {pickupCode}
 *   POST /vendor/orders/:id/transition       {to, note?, trackingNumber?, carrier?, pickupCode?}
 *   GET  /vendor/:vendorProfileId/payment-settings
 *   PUT  /vendor/:vendorProfileId/payment-settings
 * Público:
 *   GET  /payment-methods/:vendorProfileId → store_payment_methods (sin secretos)
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { mapStoreRpcError } from '../services/store-rpc-errors';
import { canManageStoreAs } from '../services/store-access';
import { findStoreOrderById, gatewayPayloadForOrder, SellerGatewayError } from '../services/store-checkout';

export const ORDER_RECEIPTS_BUCKET = 'order-receipts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECEIPT_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']);

const router = Router();

function sendRpcError(res: Response, error: any) {
    const mapped = mapStoreRpcError(error);
    return res.status(mapped.status).json({
        ok: false, error: mapped.code, message: mapped.message,
        ...(mapped.details !== undefined ? { details: mapped.details } : {}),
    });
}

/** Ruta del comprobante: {order_id}/{uuid}.{ext}. La base vuelve a validarla. */
export function receiptObjectPath(orderId: string, fileName: unknown): string | null {
    if (!UUID.test(orderId)) return null;
    const ext = String(fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
    if (!RECEIPT_EXT.has(ext)) return null;
    return `${orderId}/${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

// ─── Público ────────────────────────────────────────────────────────────────
router.get('/payment-methods/:vendorProfileId', async (req: Request, res: Response) => {
    const { vendorProfileId } = req.params as { vendorProfileId: string };
    if (!UUID.test(vendorProfileId)) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const { data, error } = await supabase.rpc('store_payment_methods', { p_vendor_profile_id: vendorProfileId });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.use(requireMarketplaceAuth);

router.param('id', (req, res, next, id) => {
    if (!UUID.test(String(id))) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    next();
});

// ─── Comprador ──────────────────────────────────────────────────────────────
router.get('/orders/:id/payment', async (req: Request, res: Response) => {
    try {
        const order = await findStoreOrderById(req.params.id as string);
        if (!order || order.user_id !== req.user.id) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
        if (order.status !== 'pending_payment') {
            return res.status(409).json({ ok: false, error: 'INVALID_STATE', status: order.status });
        }
        if (order.payment_method === 'transfer') {
            const { data, error } = await supabase.rpc('store_transfer_accounts', { p_order_id: order.id, p_actor: req.user.id });
            if (error) return sendRpcError(res, error);
            return res.json({ ok: true, data: { paymentMethod: 'transfer', transfer: data } });
        }
        if (order.payment_method === 'wompi' || order.payment_method === 'mercadopago') {
            const gateway = await gatewayPayloadForOrder(order);
            return res.json({ ok: true, data: { paymentMethod: order.payment_method, ...gateway } });
        }
        return res.json({ ok: true, data: { paymentMethod: order.payment_method } });
    } catch (err: any) {
        if (err instanceof SellerGatewayError) {
            return res.status(409).json({ ok: false, error: err.code, message: err.message });
        }
        return res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
});

router.get('/orders/:id/transfer-accounts', async (req: Request, res: Response) => {
    const { data, error } = await supabase.rpc('store_transfer_accounts', { p_order_id: req.params.id, p_actor: req.user.id });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.post('/orders/:id/receipt-url', async (req: Request, res: Response) => {
    try {
        const order = await findStoreOrderById(req.params.id as string);
        if (!order || order.user_id !== req.user.id) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
        if (order.payment_method !== 'transfer' || !['pending_payment', 'awaiting_approval'].includes(order.status)) {
            return res.status(409).json({ ok: false, error: 'INVALID_STATE', status: order.status });
        }
        const path = receiptObjectPath(order.id, req.body?.fileName);
        if (!path) return res.status(400).json({ ok: false, error: 'INVALID_FILE', message: 'Formatos: jpg, png, webp, heic o pdf.' });
        const { data, error } = await supabase.storage.from(ORDER_RECEIPTS_BUCKET).createSignedUploadUrl(path);
        if (error || !data) return res.status(500).json({ ok: false, error: 'UPLOAD_URL_FAILED' });
        return res.json({ ok: true, data: { bucket: ORDER_RECEIPTS_BUCKET, path, signedUrl: data.signedUrl, token: data.token } });
    } catch {
        return res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
});

const ReceiptSchema = z.object({ path: z.string().min(10).max(200) });
router.post('/orders/:id/receipt', async (req: Request, res: Response) => {
    const parsed = ReceiptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const { data, error } = await supabase.rpc('submit_order_receipt', {
        p_order_id: req.params.id, p_receipt_path: parsed.data.path, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    await auditLog(req, 'store_receipt_submitted', 'orders', req.params.id as string, null, { path: parsed.data.path });
    return res.json({ ok: true, data });
});

router.post('/orders/:id/cancel', async (req: Request, res: Response) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;
    const { data, error } = await supabase.rpc('cancel_my_order', {
        p_order_id: req.params.id, p_reason: reason, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

router.post('/orders/:id/received', async (req: Request, res: Response) => {
    const { data, error } = await supabase.rpc('order_transition', {
        p_order_id: req.params.id, p_to: 'delivered', p_note: 'Recibido por el comprador', p_tracking: null, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    return res.json({ ok: true, data });
});

// ─── Vendedor ───────────────────────────────────────────────────────────────
router.get('/vendor/orders/:id/receipt-url', async (req: Request, res: Response) => {
    try {
        const { data: order } = await supabase
            .from('orders')
            .select('id, vendor_profile_id, receipt_path')
            .eq('id', req.params.id as string)
            .maybeSingle();
        const o: any = order;
        if (!o || !o.vendor_profile_id || !(await canManageStoreAs(o.vendor_profile_id, req.user.id))) {
            return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
        }
        if (!o.receipt_path) return res.status(404).json({ ok: false, error: 'NO_RECEIPT' });
        const { data, error } = await supabase.storage.from(ORDER_RECEIPTS_BUCKET).createSignedUrl(o.receipt_path, 300);
        if (error || !data) return res.status(500).json({ ok: false, error: 'SIGNED_URL_FAILED' });
        return res.json({ ok: true, data: { signedUrl: data.signedUrl, expiresIn: 300 } });
    } catch {
        return res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
});

router.post('/vendor/orders/:id/approve-receipt', async (req: Request, res: Response) => {
    const { data, error } = await supabase.rpc('approve_order_receipt', { p_order_id: req.params.id, p_actor: req.user.id });
    if (error) return sendRpcError(res, error);
    await auditLog(req, 'store_receipt_approved', 'orders', req.params.id as string, null, data);
    return res.json({ ok: true, data });
});

router.post('/vendor/orders/:id/reject-receipt', async (req: Request, res: Response) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    const { data, error } = await supabase.rpc('reject_order_receipt', {
        p_order_id: req.params.id, p_reason: reason, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    await auditLog(req, 'store_receipt_rejected', 'orders', req.params.id as string, null, { reason });
    return res.json({ ok: true, data });
});

router.post('/vendor/orders/:id/confirm-cash', async (req: Request, res: Response) => {
    const code = typeof req.body?.pickupCode === 'string' ? req.body.pickupCode.trim() : '';
    if (!/^[0-9]{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'INVALID_PICKUP_CODE' });
    const { data, error } = await supabase.rpc('confirm_cash_pickup', {
        p_order_id: req.params.id, p_pickup_code: code, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    await auditLog(req, 'store_cash_confirmed', 'orders', req.params.id as string, null, null);
    return res.json({ ok: true, data });
});

const TransitionSchema = z.object({
    to: z.string().min(3).max(40),
    note: z.string().max(1000).optional(),
    trackingNumber: z.string().max(120).optional(),
    carrier: z.string().max(120).optional(),
    pickupCode: z.string().regex(/^[0-9]{6}$/).optional(),
});
router.post('/vendor/orders/:id/transition', async (req: Request, res: Response) => {
    const parsed = TransitionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const t = parsed.data;
    const tracking = (t.trackingNumber || t.carrier || t.pickupCode)
        ? { tracking_number: t.trackingNumber, carrier: t.carrier, pickup_code: t.pickupCode }
        : null;
    const { data, error } = await supabase.rpc('order_transition', {
        p_order_id: req.params.id, p_to: t.to, p_note: t.note ?? null, p_tracking: tracking, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    await auditLog(req, 'order_status_update', 'orders', req.params.id as string, null, { to: t.to });
    return res.json({ ok: true, data });
});

router.get('/vendor/:vendorProfileId/payment-settings', async (req: Request, res: Response) => {
    const { vendorProfileId } = req.params as { vendorProfileId: string };
    if (!UUID.test(vendorProfileId)) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    if (!(await canManageStoreAs(vendorProfileId, req.user.id))) return res.status(403).json({ ok: false, error: 'NOT_OWNER' });
    const { data } = await supabase.from('store_payment_settings').select('*').eq('vendor_profile_id', vendorProfileId).maybeSingle();
    const { data: methods } = await supabase.rpc('store_payment_methods', { p_vendor_profile_id: vendorProfileId });
    return res.json({ ok: true, data: { settings: data ?? null, methods: methods ?? null } });
});

const SettingsSchema = z.object({
    accept_wompi: z.boolean().optional(),
    accept_mercadopago: z.boolean().optional(),
    accept_transfer: z.boolean().optional(),
    accept_cash_pickup: z.boolean().optional(),
    transfer_instructions: z.string().max(1000).nullable().optional(),
    transfer_hold_hours: z.number().int().min(1).max(168).optional(),
    cash_hold_hours: z.number().int().min(1).max(168).optional(),
}).strict();
router.put('/vendor/:vendorProfileId/payment-settings', async (req: Request, res: Response) => {
    const { vendorProfileId } = req.params as { vendorProfileId: string };
    if (!UUID.test(vendorProfileId)) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const parsed = SettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_SETTINGS', details: parsed.error.issues });
    const { data, error } = await supabase.rpc('set_store_payment_settings', {
        p_vendor_profile_id: vendorProfileId, p_settings: parsed.data, p_actor: req.user.id,
    });
    if (error) return sendRpcError(res, error);
    await auditLog(req, 'store_payment_settings', 'store_payment_settings', vendorProfileId, null, parsed.data);
    return res.json({ ok: true, data });
});

export default router;
