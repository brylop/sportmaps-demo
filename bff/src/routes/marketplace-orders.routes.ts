import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/marketplace/orders — Crear orden desde carrito
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            items, shipping_address, contact_phone, contact_email,
            payment_method, fulfillment_type
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ ok: false, error: 'Items requeridos.' });
        }

        // Calcular total
        let totalAmount = 0;
        let taxTotal = 0;

        for (const item of items) {
            const subtotal = item.unit_price * item.quantity;
            const tax = subtotal * (item.tax_rate || 0);
            totalAmount += subtotal + tax;
            taxTotal += tax;
        }

        // Crear orden
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: req.user.id,
                total_amount: totalAmount,
                tax_total: taxTotal,
                status: 'pending',
                shipping_address: shipping_address || null,
                contact_phone: contact_phone || null,
                contact_email: contact_email || req.user.email,
                payment_method: payment_method || null,
                fulfillment_type: fulfillment_type || 'physical',
            })
            .select()
            .single();

        if (orderError) {
            req.log?.error({ err: orderError }, 'Error creando orden');
            return res.status(500).json({ ok: false, error: 'Error creando orden.' });
        }

        // Crear order_items
        const orderItems = items.map((item: any) => ({
            order_id: order.id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            vendor_id: item.vendor_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_amount: (item.unit_price * item.quantity) * (item.tax_rate || 0),
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            req.log?.error({ err: itemsError }, 'Error creando order_items');
            // Rollback: eliminar la orden
            await supabase.from('orders').delete().eq('id', order.id);
            return res.status(500).json({ ok: false, error: 'Error procesando items de la orden.' });
        }

        await auditLog(req, 'order_create', 'orders', order.id, null, {
            items_count: items.length,
            total: totalAmount,
        });

        return res.status(201).json({ ok: true, data: { ...order, items: orderItems } });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
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
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/vendor/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, tracking_number, shipping_carrier, vendor_notes } = req.body;

        if (!status) {
            return res.status(400).json({ ok: false, error: 'status es requerido.' });
        }

        // Verificar que la orden contiene items del vendor
        const { data: vendorItems } = await supabase
            .from('order_items')
            .select('id')
            .eq('vendor_id', req.user.id)
            .eq('order_id', id)
            .limit(1);

        if (!vendorItems || vendorItems.length === 0) {
            return res.status(404).json({ ok: false, error: 'Orden no encontrada para este vendedor.' });
        }

        const updates: any = { status };
        if (tracking_number) updates.tracking_number = tracking_number;
        if (shipping_carrier) updates.shipping_carrier = shipping_carrier;
        if (vendor_notes) updates.vendor_notes = vendor_notes;

        const { data, error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando orden.' });
        }

        await auditLog(req, 'order_status_update', 'orders', id, null, { new_status: status });
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
