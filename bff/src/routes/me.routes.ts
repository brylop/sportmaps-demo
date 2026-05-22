import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * GET /api/v1/me/entitlements
 *
 * Retorna el plan SaaS + addons activos para la escuela actual del usuario
 * (vinculada por x-school-id + JWT). Lee la vista v_school_entitlements
 * que agrega schools.school_type + school_subscriptions + school_addons.
 *
 * Consumido por el hook useEntitlements() en el frontend y por el componente
 * <EntitlementGate /> para decidir qué features bloquear / mostrar upsell.
 *
 * Fallback: si la escuela no tiene fila en school_subscriptions (no debería
 * pasar tras el backfill Pre-F0, pero por seguridad), retorna defaults
 * starter/free/active para no romper la UI.
 */
router.get('/entitlements', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;

        if (!schoolId) {
            return res.status(400).json({ error: 'school_id requerido' });
        }

        const { data, error } = await supabase
            .from('v_school_entitlements')
            .select('*')
            .eq('school_id', schoolId)
            .maybeSingle();

        if (error) {
            req.log?.error({ err: error, schoolId }, 'Error leyendo v_school_entitlements');
            return res.status(500).json({ error: 'Error al obtener entitlements' });
        }

        if (!data) {
            // Escuela sin fila en school_subscriptions — defaults seguros
            req.log?.warn({ schoolId }, 'Sin fila en school_subscriptions, devolviendo defaults');
            return res.json({
                school_id:            schoolId,
                school_type:          'academy',
                plan_code:            'starter',
                tier:                 'free',
                subscription_status:  'active',
                trial_ends_at:        null,
                current_period_start: null,
                current_period_end:   null,
                billing_cycle:        null,
                has_academy:          true,
                has_reservations:     false,
                has_wallet:           false,
                has_tournaments:      false,
                has_access_control:   false,
                has_biomech:          false,
                has_nutrition:        false,
                has_whitelabel:       false,
                has_whatsapp:         false,
                has_wompi:            false,
                has_mp:               false,
            });
        }

        if (process.env.NODE_ENV === 'staging') {
            data.has_biomech = false;
        }

        return res.json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error en GET /me/entitlements');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
