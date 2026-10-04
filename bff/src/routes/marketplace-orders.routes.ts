import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { canManageStoreAs } from '../services/store-access';
import { checkVendorTransition, normalizeOrderStatus, STORE_ORDER_STATUSES } from '../services/store-order-status';
import { mapStoreRpcError } from '../services/store-rpc-errors';

const router = Router();

router.use(requireMarketplaceAuth);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/marketplace/orders — APAGADO (tienda v2 F0, M-F0-3 / T4)
//
// Creaba la orden con precios y vendor_id tomados del body, con service role
// (la base no lo frenaba) y sin transacción. Las órdenes nacen solo en el
// checkout del carrito (POST /api/v1/marketplace/checkout/cart).
// No toca la base.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', (_req: Request, res: Response) => {
    return res.status(410).json({
        ok: false,
        error: 'ORDER_ENDPOINT_GONE',
        message: 'Usa el checkout del carrito',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/orders — Mis ordenes (comprador)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const { status, page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let query = supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id, product_id, variant_id, vendor_id, quantity, unit_price, tax_amount,
                    products (id, name, image_url, category)
                )
            `, { count: 'exact' })
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (status) query = query.eq('status', status as string);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo ordenes.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/orders/:id — Detalle de orden
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id, product_id, variant_id, vendor_id, quantity, unit_price, tax_amount,
                    products (id, name, image_url, category, vendor_id),
                    product_variants (id, name, attributes, image_url)
                )
            `)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Orden no encontrada.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/orders/vendor/mine — Ordenes de mis productos (vendedor)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vendor/mine', async (req: Request, res: Response) => {
    try {
        const { status, page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        // Obtener ordenes que contienen items del vendor
        let query = supabase
            .from('order_items')
            .select(`
                id, quantity, unit_price, tax_amount,
                products (id, name, image_url),
                product_variants (id, name, attributes),
                orders (id, user_id, total_amount, status, shipping_address, created_at, tracking_number, shipping_carrier)
            `, { count: 'exact' })
            .eq('vendor_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo ordenes.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/marketplace/orders/vendor/:id/status — Actualizar estado (vendedor)
//
// El estado ya no es libre: se normaliza (valores legacy) y tiene que ser una
// transición permitida al vendedor desde el estado actual
// (services/store-order-status.ts). Cancelar un pedido pagado NO va por acá:
// es un reembolso.
// Dueño: can_manage_store_as sobre orders.vendor_profile_id, o el legacy
// (order_items.vendor_id = usuario).
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/vendor/:id/status', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { status, tracking_number, shipping_carrier, vendor_notes } = req.body ?? {};

        if (!status) {
            return res.status(400).json({ ok: false, error: 'status es requerido.' });
        }
        const requested = normalizeOrderStatus(status);
        if (!requested) {
            return res.status(400).json({
                ok: false,
                error: 'INVALID_STATUS',
                message: `Estado inválido. Valores: ${STORE_ORDER_STATUSES.join(', ')}.`,
            });
        }

        let { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, status, vendor_profile_id')
            .eq('id', id)
            .maybeSingle();
        if (orderErr) {
            // orders.vendor_profile_id llega con M-F0-3; sin la columna, solo la regla legacy.
            ({ data: order } = await supabase
                .from('orders')
                .select('id, status')
                .eq('id', id)
                .maybeSingle() as any);
        }

        if (!order) {
            return res.status(404).json({ ok: false, error: 'Orden no encontrada para este vendedor.' });
        }

        let allowed = false;
        if ((order as any).vendor_profile_id) {
            allowed = await canManageStoreAs((order as any).vendor_profile_id, req.user.id);
        }
        if (!allowed) {
            const { data: vendorItems } = await supabase
                .from('order_items')
                .select('id')
                .eq('vendor_id', req.user.id)
                .eq('order_id', id)
                .limit(1);
            allowed = !!vendorItems && vendorItems.length > 0;
        }
        if (!allowed) {
            return res.status(404).json({ ok: false, error: 'Orden no encontrada para este vendedor.' });
        }

        const check = checkVendorTransition((order as any).status, requested);
        if (!check.ok) {
            return res.status(check.http).json({
                ok: false,
                error: check.error,
                message: `No se puede pasar de ${check.from ?? (order as any).status} a ${requested}.`,
                from: check.from,
                to: check.to,
            });
        }

        const updates: Record<string, unknown> = {};
        if (check.changed) updates.status = check.to;
        if (tracking_number) updates.tracking_number = tracking_number;
        if (shipping_carrier) updates.shipping_carrier = shipping_carrier;
        if (vendor_notes) updates.vendor_notes = vendor_notes;

        if (Object.keys(updates).length === 0) {
            return res.json({ ok: true, data: order, unchanged: true });
        }

        // Guard optimista: solo si el estado no cambió entre la lectura y la escritura.
        const { data, error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', id)
            .eq('status', (order as any).status)
            .select()
            .maybeSingle();

        if (error) {
            const mapped = mapStoreRpcError(error);
            if (mapped.status !== 500) {
                return res.status(mapped.status).json({ ok: false, error: mapped.code, message: mapped.message });
            }
            return res.status(500).json({ ok: false, error: 'Error actualizando orden.' });
        }
        if (!data) {
            return res.status(409).json({ ok: false, error: 'STATUS_CHANGED', message: 'La orden cambió de estado; recarga e intenta de nuevo.' });
        }

        await auditLog(req, 'order_status_update', 'orders', id, null, {
            from_status: (order as any).status,
            new_status: check.to,
        });
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
