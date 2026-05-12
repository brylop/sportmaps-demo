import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

// Todas las rutas de vendor requieren auth (sin school context)
router.use(requireMarketplaceAuth);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('vendor_profiles')
            .select('*')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo perfil.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/profile — Crear perfil (onboarding step 1)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/profile', async (req: Request, res: Response) => {
    try {
        const {
            display_name, description, city, address, phone, email,
            nit, website_url, vendor_type
        } = req.body;

        if (!display_name) {
            return res.status(400).json({ ok: false, error: 'display_name es requerido.' });
        }

        const { data, error } = await supabase
            .from('vendor_profiles')
            .upsert({
                user_id: req.user.id,
                display_name,
                description: description || null,
                vendor_type: vendor_type || 'store',
                city: city || null,
                address: address || null,
                phone: phone || null,
                email: email || req.user.email,
                nit: nit || null,
                website_url: website_url || null,
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'Error creando vendor profile');
            return res.status(500).json({ ok: false, error: 'Error creando perfil.' });
        }

        await auditLog(req, 'vendor_profile_create', 'vendor_profiles', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/vendor/profile — Actualizar perfil
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile', async (req: Request, res: Response) => {
    try {
        const {
            display_name, description, city, address, phone, email,
            nit, website_url, logo_url, cover_image_url
        } = req.body;

        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({
                ...(display_name && { display_name }),
                ...(description !== undefined && { description }),
                ...(city !== undefined && { city }),
                ...(address !== undefined && { address }),
                ...(phone !== undefined && { phone }),
                ...(email !== undefined && { email }),
                ...(nit !== undefined && { nit }),
                ...(website_url !== undefined && { website_url }),
                ...(logo_url !== undefined && { logo_url }),
                ...(cover_image_url !== undefined && { cover_image_url }),
            })
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando perfil.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/vendor/profile/payment — Config pago (onboarding step 2)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile/payment', async (req: Request, res: Response) => {
    try {
        const { payment_methods, bank_data } = req.body;

        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({
                payment_methods: payment_methods || [],
                bank_data: bank_data || {},
            })
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando métodos de pago.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/vendor/profile/verification — Doc verificacion (onboarding step 3)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile/verification', async (req: Request, res: Response) => {
    try {
        const { verification_doc_url } = req.body;

        if (!verification_doc_url) {
            return res.status(400).json({ ok: false, error: 'verification_doc_url es requerido.' });
        }

        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({
                verification_doc_url,
                verification_status: 'pending',
            })
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error enviando verificación.' });
        }

        // Notificar a todos los admins/owners para que revisen el doc.
        try {
            const { data: admins } = await supabase
                .from('profiles')
                .select('id')
                .in('role', ['admin', 'owner', 'super_admin']);

            for (const a of admins || []) {
                await supabase.rpc('notify_user', {
                    p_user_id: a.id,
                    p_title: 'Nuevo vendor para verificar',
                    p_message: `"${data.display_name || 'Vendor'}" subió su documento de verificación.`,
                    p_type: 'vendor_verification_pending',
                    p_link: '/admin/marketplace/moderation',
                }).then(() => {}, () => {});
            }
        } catch (notifErr) {
            req.log?.warn({ err: notifErr }, 'Admin notify failed (non-blocking)');
        }

        await auditLog(req, 'vendor_verification_submit', 'vendor_profiles', data.id);
        return res.json({ ok: true, data, message: 'Documento de verificación enviado. Será revisado pronto.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/stats — Dashboard stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
    try {
        // Obtener vendor profile
        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id, vendor_type')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!vendor) {
            return res.json({ ok: true, data: { total_products: 0, total_services: 0, total_orders: 0, revenue: 0 } });
        }

        // Contar productos
        const { count: totalProducts } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('vendor_id', req.user.id)
            .eq('status', 'active');

        // Contar servicios
        const { count: totalServices } = await supabase
            .from('service_listings')
            .select('*', { count: 'exact', head: true })
            .eq('vendor_profile_id', vendor.id)
            .eq('is_active', true);

        // Contar ordenes (items de mis productos)
        const { count: totalOrders } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('vendor_id', req.user.id);

        return res.json({
            ok: true,
            data: {
                total_products: totalProducts || 0,
                total_services: totalServices || 0,
                total_orders: totalOrders || 0,
                vendor_type: vendor.vendor_type,
            },
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/availability — Mi disponibilidad horaria
// ─────────────────────────────────────────────────────────────────────────────
router.get('/availability', async (req: Request, res: Response) => {
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
            .from('service_availability')
            .select('*')
            .eq('vendor_profile_id', vendor.id)
            .order('day_of_week')
            .order('start_time');

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo disponibilidad.' });
        }

        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/vendor/availability — Configurar horarios
// Body: { slots: [{ day_of_week, start_time, end_time, slot_duration_minutes, buffer_time_minutes }] }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/availability', async (req: Request, res: Response) => {
    try {
        const { slots } = req.body;

        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!vendor) {
            return res.status(404).json({ ok: false, error: 'Perfil de vendedor no encontrado.' });
        }

        // Eliminar slots existentes y reemplazar
        await supabase
            .from('service_availability')
            .delete()
            .eq('vendor_profile_id', vendor.id);

        if (slots && slots.length > 0) {
            const rows = slots.map((s: any) => ({
                vendor_profile_id: vendor.id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                slot_duration_minutes: s.slot_duration_minutes || 60,
                buffer_time_minutes: s.buffer_time_minutes || 10,
                max_concurrent: s.max_concurrent || 1,
                is_active: true,
            }));

            const { error } = await supabase
                .from('service_availability')
                .insert(rows);

            if (error) {
                req.log?.error({ err: error }, 'Error guardando disponibilidad');
                return res.status(500).json({ ok: false, error: 'Error guardando disponibilidad.' });
            }
        }

        return res.json({ ok: true, message: 'Disponibilidad actualizada.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
