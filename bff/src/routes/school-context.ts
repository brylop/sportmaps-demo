import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * GET /api/v1/school/context
 * Retorna las capacidades y módulos activos de la escuela actual.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;

        const [settingsRes, sportConfigsRes] = await Promise.all([
            supabase
                .from('school_settings')
                .select('active_modules')
                .eq('school_id', schoolId)
                .single(),
            supabase
                .from('sport_configs')
                .select('sport, categorization_axis, settings')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .order('created_at', { ascending: true }),
        ]);

        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') {
            throw settingsRes.error;
        }

        const activeModules: string[] = settingsRes.data?.active_modules ?? [];
        const sports = (sportConfigsRes.data || []).map(s => ({
            sport: s.sport,
            categorization_axis: s.categorization_axis,
            settings: s.settings ?? {},
        }));

        const features = {
            selfBooking: activeModules.includes('session_bookings'),
            capacityCheck: activeModules.includes('capacity_check'),
            offeringPlans: activeModules.includes('offering_plans'),
            creditDeduction: activeModules.includes('credit_deduction'),
            courtBooking: activeModules.includes('court_booking'),
            tournamentMode: activeModules.includes('tournament_mode'),
            billingEvents: activeModules.includes('billing_events'),
            sportConfigs: activeModules.includes('sport_configs'),
        };

        res.json({
            active_modules: activeModules,
            features,
            is_universal_mode: activeModules.length > 0,
            sports,
            primary_sport: sports[0] ?? null,
        });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching school context');
        res.status(500).json({ error: 'Error al obtener contexto de escuela' });
    }
});

/**
 * PATCH /api/v1/school/context/modules
 * Actualiza los módulos activos de la escuela.
 */
router.patch('/modules', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId, role } = req;

        if (!['owner', 'admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ error: 'Solo el propietario o admin puede modificar módulos.' });
        }

        const VALID_MODULES = [
            'session_bookings',
            'capacity_check',
            'offering_plans',
            'credit_deduction',
            'billing_events',
            'sport_configs',
            'court_booking',
            'tournament_mode',
        ];

        const { active_modules } = req.body;

        if (!Array.isArray(active_modules)) {
            return res.status(400).json({ error: 'active_modules debe ser un array.' });
        }

        const invalid = active_modules.filter((m: string) => !VALID_MODULES.includes(m));
        if (invalid.length > 0) {
            return res.status(400).json({
                error: `Módulos inválidos: ${invalid.join(', ')}`,
                valid_modules: VALID_MODULES,
            });
        }

        const { error } = await supabase
            .from('school_settings')
            .update({ active_modules })
            .eq('school_id', schoolId);

        if (error) throw error;

        res.json({ success: true, active_modules });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating active modules');
        res.status(500).json({ error: 'Error al actualizar módulos' });
    }
});

export default router;
