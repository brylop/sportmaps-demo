/**
 * marketplace-admin.routes — Cola de moderacion para admins.
 *
 *  - GET  /api/v1/admin/marketplace/moderation-queue
 *  - POST /api/v1/admin/products/:id/approve
 *  - POST /api/v1/admin/products/:id/reject
 *  - POST /api/v1/admin/vendors/:id/verify
 *
 * Requiere rol admin/super_admin/owner via requireRole.
 */

import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, requireRole, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);
router.use(requireRole('admin'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/marketplace/moderation-queue
// ─────────────────────────────────────────────────────────────────────────────
router.get('/marketplace/moderation-queue', async (req: Request, res: Response) => {
    try {
        const { status = 'pending_review', page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        const { data, error, count } = await supabase
            .from('products')
            .select(`
                id, name, description, price, image_url, attributes, status,
                created_at, vendor_id, vendor_profile_id,
                vendor_profiles(id, display_name, verification_status, city),
                product_categories(slug, name)
            `, { count: 'exact' })
            .eq('status', status as string)
            .order('created_at', { ascending: true })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo cola.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/products/:id/approve — publica el producto
// ─────────────────────────────────────────────────────────────────────────────
router.post('/products/:id/approve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('products')
            .update({
                status:      'active',
                reviewed_at: new Date().toISOString(),
                reviewed_by: req.user.id,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            // El trigger enforce_product_publish_gate puede tirar 23514
            if (error.code === '23514') {
                return res.status(422).json({ ok: false, error: error.message });
            }
            return res.status(500).json({ ok: false, error: 'Error aprobando producto.' });
        }
        if (!data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        await auditLog(req, 'product_approve', 'products', id as string);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/products/:id/reject — rechaza con motivo
// ─────────────────────────────────────────────────────────────────────────────
router.post('/products/:id/reject', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body as { reason?: string };

        if (!reason || reason.length < 5) {
            return res.status(400).json({ ok: false, error: 'Motivo de rechazo requerido (min 5 chars).' });
        }

        const { data, error } = await supabase
            .from('products')
            .update({
                status:           'rejected',
                rejection_reason: reason,
                reviewed_at:      new Date().toISOString(),
                reviewed_by:      req.user.id,
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        await auditLog(req, 'product_reject', 'products', id as string, null, { reason });
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/vendors/:id/verify — marca vendor como verificado
// ─────────────────────────────────────────────────────────────────────────────
router.post('/vendors/:id/verify', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { verified = true } = req.body as { verified?: boolean };

        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({ verification_status: verified ? 'verified' : 'rejected' })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Vendor no encontrado.' });
        }

        await auditLog(req, 'vendor_verify', 'vendor_profiles', id as string, null, { verified });
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
