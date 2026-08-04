import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, requireVendorProfile, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);
// Autoriza por capability — wellness_professional, personal_trainer, coach (activado),
// o cualquier vendor que tenga can_sell_services = true.
router.use(requireVendorProfile('can_sell_services'));

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
            name, description, service_type, subcategory, price, duration_minutes,
            image_url, visibility, max_daily_slots, tax_rate,
            cancellation_policy_hours, variations,
            modality, target_audience, includes, requirements
        } = req.body;

        if (!name || !service_type || price === undefined) {
            return res.status(400).json({ ok: false, error: 'name, service_type y price son requeridos.' });
        }

        const VALID_MODALITIES = ['presencial', 'virtual', 'domicilio', 'hibrido'];
        const cleanModality = Array.isArray(modality)
            ? modality.filter((m: unknown) => typeof m === 'string' && VALID_MODALITIES.includes(m))
            : [];

        const cleanAudience = Array.isArray(target_audience)
            ? target_audience.filter((a: unknown) => typeof a === 'string' && (a as string).trim().length > 0).slice(0, 20)
            : [];

        const cleanIncludes = Array.isArray(includes)
            ? includes
                .filter((i: unknown) => typeof i === 'string' && (i as string).trim().length > 0)
                .map((i: string) => i.trim().slice(0, 120))
                .slice(0, 20)
            : [];

        const { data, error } = await supabase
            .from('service_listings')
            .insert({
                vendor_profile_id: vendor.id,
                name,
                description: description || null,
                service_type,
                subcategory: subcategory || null,
                price,
                duration_minutes: duration_minutes || 60,
                image_url: image_url || null,
                visibility: visibility || 'public',
                max_daily_slots: max_daily_slots || 8,
                tax_rate: tax_rate || 0,
                cancellation_policy_hours: cancellation_policy_hours || 24,
                has_variations: variations && variations.length > 0,
                modality: cleanModality,
                target_audience: cleanAudience,
                includes: cleanIncludes,
                requirements: requirements || null,
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
        const ALLOWED_FIELDS = [
            'name', 'description', 'service_type', 'subcategory', 'price',
            'duration_minutes', 'image_url', 'visibility', 'is_active',
            'max_daily_slots', 'tax_rate', 'cancellation_policy_hours',
            'modality', 'target_audience', 'includes', 'requirements',
        ] as const;

        const updates: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in req.body) updates[key] = (req.body as Record<string, unknown>)[key];
        }

        if (Array.isArray(updates.modality)) {
            const VALID_MODALITIES = ['presencial', 'virtual', 'domicilio', 'hibrido'];
            updates.modality = (updates.modality as unknown[])
                .filter((m): m is string => typeof m === 'string' && VALID_MODALITIES.includes(m));
        }
        if (Array.isArray(updates.target_audience)) {
            updates.target_audience = (updates.target_audience as unknown[])
                .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
                .slice(0, 20);
        }
        if (Array.isArray(updates.includes)) {
            updates.includes = (updates.includes as unknown[])
                .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
                .map((i) => i.trim().slice(0, 120))
                .slice(0, 20);
        }

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

        await auditLog(req, 'service_deactivate', 'service_listings', id as string);
        return res.json({ ok: true, message: 'Servicio desactivado.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
