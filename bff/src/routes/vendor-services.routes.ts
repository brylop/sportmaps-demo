import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, requireRole, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);
router.use(requireRole('wellness_professional', 'admin' as any));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/services — Mis servicios con variaciones
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!vendor) {
            return res.json({ ok: true, data: [] });
        }

        const { data, error } = await supabase
            .from('service_listings')
            .select(`
                *,
                service_variations (id, name, description, price, duration_minutes, is_active, sort_order)
            `)
            .eq('vendor_profile_id', vendor.id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo servicios.' });
        }

        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/services — Crear servicio
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    try {
        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!vendor) {
            return res.status(404).json({ ok: false, error: 'Complete su perfil de vendedor primero.' });
        }

        const {
            name, description, service_type, price, duration_minutes,
            image_url, visibility, max_daily_slots, tax_rate,
            cancellation_policy_hours, variations
        } = req.body;

        if (!name || !service_type || price === undefined) {
            return res.status(400).json({ ok: false, error: 'name, service_type y price son requeridos.' });
        }

        const { data, error } = await supabase
            .from('service_listings')
            .insert({
                vendor_profile_id: vendor.id,
                name,
                description: description || null,
                service_type,
                price,
                duration_minutes: duration_minutes || 60,
                image_url: image_url || null,
                visibility: visibility || 'public',
                max_daily_slots: max_daily_slots || 8,
                tax_rate: tax_rate || 0,
                cancellation_policy_hours: cancellation_policy_hours || 24,
                has_variations: variations && variations.length > 0,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '42501') {
                return res.status(403).json({ ok: false, error: error.message });
            }
            req.log?.error({ err: error }, 'Error creando servicio');
            return res.status(500).json({ ok: false, error: 'Error creando servicio.' });
        }

        // Crear variaciones si se proporcionan
        if (variations && variations.length > 0) {
            const variationRows = variations.map((v: any) => ({
                service_listing_id: data.id,
                name: v.name,
                description: v.description || null,
                price: v.price,
                duration_minutes: v.duration_minutes,
                is_active: true,
            }));

            await supabase.from('service_variations').insert(variationRows);
        }

        await auditLog(req, 'service_create', 'service_listings', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/vendor/services/:id — Actualizar servicio
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        delete updates.id;
        delete updates.vendor_profile_id;
        delete updates.created_at;

        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!vendor) {
            return res.status(404).json({ ok: false, error: 'Perfil de vendedor no encontrado.' });
        }

        const { data, error } = await supabase
            .from('service_listings')
            .update(updates)
            .eq('id', id)
            .eq('vendor_profile_id', vendor.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Servicio no encontrado.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/vendor/services/:id — Desactivar servicio
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!vendor) {
            return res.status(404).json({ ok: false, error: 'Perfil de vendedor no encontrado.' });
        }

        const { data, error } = await supabase
            .from('service_listings')
            .update({ is_active: false })
            .eq('id', id)
            .eq('vendor_profile_id', vendor.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Servicio no encontrado.' });
        }

        await auditLog(req, 'service_deactivate', 'service_listings', id);
        return res.json({ ok: true, message: 'Servicio desactivado.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
