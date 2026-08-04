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
// GET /api/v1/admin/vendors/verification-queue — vendors con doc cargado
// pendientes de revision, o filtrados por status.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vendors/verification-queue', async (req: Request, res: Response) => {
    try {
        const { status = 'pending', page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let query = supabase
            .from('vendor_profiles')
            .select(`
                id, user_id, display_name, vendor_type, capabilities, description,
                city, phone, verification_status, verification_doc_url,
                is_active, created_at,
                profiles!vendor_profiles_user_id_fkey ( id, full_name, email, role )
            `, { count: 'exact' })
            .order('created_at', { ascending: true })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (status !== 'all') {
            query = query.eq('verification_status', status as string);
        }
        // Para "pending" solo mostramos los que subieron doc (los otros no requieren accion).
        if (status === 'pending') {
            query = query.not('verification_doc_url', 'is', null);
        }

        const { data, error, count } = await query;

        if (error) {
            req.log?.error({ err: error }, 'verification-queue failed');
            return res.status(500).json({ ok: false, error: 'Error obteniendo cola.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/vendors/:id/doc-url — genera signed URL del doc privado.
// El bucket vendor-docs es privado; este endpoint resuelve la URL temporal
// para que el admin pueda previsualizar.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vendors/:id/doc-url', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data: vp, error: vpErr } = await supabase
            .from('vendor_profiles')
            .select('id, verification_doc_url')
            .eq('id', id)
            .maybeSingle();

        if (vpErr || !vp) {
            return res.status(404).json({ ok: false, error: 'Vendor no encontrado.' });
        }
        if (!vp.verification_doc_url) {
            return res.status(404).json({ ok: false, error: 'Sin documento cargado.' });
        }

        // El frontend guardo getPublicUrl. Extraemos el path del nombre del archivo
        // (luego de /object/<public|sign>/vendor-docs/<filename>).
        const url: string = vp.verification_doc_url;
        const match = url.match(/vendor-docs\/(.+?)(?:\?|$)/);
        const filePath = match ? decodeURIComponent(match[1]) : url.split('/').pop();

        if (!filePath) {
            return res.status(400).json({ ok: false, error: 'No se pudo resolver el archivo.' });
        }

        const { data, error } = await supabase.storage
            .from('vendor-docs')
            .createSignedUrl(filePath, 60 * 5); // 5 minutos

        if (error) {
            req.log?.error({ err: error, filePath }, 'createSignedUrl failed');
            return res.status(500).json({ ok: false, error: 'No se pudo generar URL firmada.' });
        }

        return res.json({ ok: true, data: { signed_url: data.signedUrl, expires_in: 300 } });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/vendors/:id/verify — marca vendor como verificado o rechazado
// ─────────────────────────────────────────────────────────────────────────────
router.post('/vendors/:id/verify', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { verified = true, reason } = req.body as { verified?: boolean; reason?: string };

        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({ verification_status: verified ? 'verified' : 'rejected' })
            .eq('id', id)
            .select('id, user_id, display_name, verification_status')
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Vendor no encontrado.' });
        }

        // Notificar al vendor del resultado
        await supabase.from('notifications').insert({
            user_id: data.user_id,
            title: verified ? 'Verificación aprobada' : 'Verificación rechazada',
            message: verified
                ? `Tu tienda "${data.display_name}" ya esta verificada. Apareceras destacada.`
                : `Tu verificacion fue rechazada${reason ? `: ${reason}` : '.'} Puedes reenviar otro documento.`,
            type: verified ? 'verification_approved' : 'verification_rejected',
            link: '/vendor/onboarding',
        }); // bypass RPC auth.uid() check via direct insert

        await auditLog(req, 'vendor_verify', 'vendor_profiles', id as string, null, { verified, reason });
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
