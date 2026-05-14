import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

// ============================================================
// Tipos del request body
// ============================================================

type RequestType =
    | 'plan_upgrade'
    | 'plan_downgrade'
    | 'addon_activate'
    | 'addon_deactivate'
    | 'payment_update'
    | 'contact_sales';

type PlanCode = 'starter' | 'crecimiento' | 'profesional' | 'elite' | 'enterprise';
type AddonKey =
    | 'tournaments' | 'access_control' | 'biomech' | 'nutrition'
    | 'whitelabel' | 'whatsapp' | 'wompi' | 'mp';
type BillingCycle = 'monthly' | 'annual';
type Source = 'admin_app' | 'landing' | 'admin_panel' | 'whatsapp' | 'unknown';

interface CreateRequestBody {
    request_type:            RequestType;
    requested_plan_code?:    PlanCode;
    requested_addon_key?:    AddonKey;
    requested_billing_cycle?: BillingCycle;
    source?:                 Source;
    source_url?:             string;
    notes?:                  string;
}

// ============================================================
// POST /api/v1/upgrade-requests
//
// Crea un upgrade request. Disparado desde:
//   - MiPlanPage (admin app) cuando click en "Mejorar plan" o addon
//   - Landing /planes cuando usuario autenticado pide un plan
//
// El trigger DB notifica automaticamente al super_admin.
// ============================================================

router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId, userId } = req;
        const body = req.body as CreateRequestBody;

        if (!schoolId) {
            return res.status(400).json({ error: 'school_id requerido' });
        }
        if (!body.request_type) {
            return res.status(400).json({ error: 'request_type es requerido' });
        }

        // Validacion logica: si plan_upgrade necesita plan_code, addon_activate necesita addon_key
        if ((body.request_type === 'plan_upgrade' || body.request_type === 'plan_downgrade') && !body.requested_plan_code) {
            return res.status(400).json({ error: 'requested_plan_code es requerido para upgrade/downgrade' });
        }
        if ((body.request_type === 'addon_activate' || body.request_type === 'addon_deactivate') && !body.requested_addon_key) {
            return res.status(400).json({ error: 'requested_addon_key es requerido para activate/deactivate addon' });
        }

        // Snapshot del plan actual
        const { data: currentSub } = await supabase
            .from('school_subscriptions')
            .select('plan_code, status')
            .eq('school_id', schoolId)
            .maybeSingle();

        const { data: inserted, error } = await supabase
            .from('plan_upgrade_requests')
            .insert({
                school_id:               schoolId,
                requested_by:            userId,
                request_type:            body.request_type,
                requested_plan_code:     body.requested_plan_code || null,
                requested_addon_key:     body.requested_addon_key || null,
                requested_billing_cycle: body.requested_billing_cycle || null,
                current_plan_code:       currentSub?.plan_code || null,
                current_status:          currentSub?.status || null,
                source:                  body.source || 'admin_app',
                source_url:              body.source_url || null,
                user_agent:              (req.headers['user-agent'] as string) || null,
                metadata:                body.notes ? { notes: body.notes } : {},
            })
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error, schoolId }, 'Error creando upgrade request');
            return res.status(500).json({ error: 'Error al crear request' });
        }

        return res.status(201).json({
            ok: true,
            request_id: inserted.id,
            status: inserted.status,
            message: 'Solicitud recibida. Nuestro equipo te contactará pronto.',
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error en POST /upgrade-requests');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// GET /api/v1/upgrade-requests
//
// Lista requests. Por RLS:
//   - Admin de escuela: ve solo los suyos
//   - super_admin: ve TODOS
//
// Query params opcionales:
//   ?status=pending|contacted|processed|rejected|cancelled
//   ?limit=20
// ============================================================

router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const status = req.query.status as string | undefined;
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);

        let query = supabase
            .from('plan_upgrade_requests')
            .select(`
                *,
                schools:school_id ( id, name, school_type, is_demo ),
                requester:requested_by ( id, email )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            req.log?.error({ err: error }, 'Error listando upgrade requests');
            return res.status(500).json({ error: 'Error al listar requests' });
        }

        return res.json({ requests: data || [] });
    } catch (err: any) {
        req.log?.error({ err }, 'Error en GET /upgrade-requests');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/v1/upgrade-requests/:id/process
//
// Marca un request como procesado y aplica el cambio
// (UPDATE school_subscriptions o INSERT/UPDATE school_addons).
// Solo super_admin (forzado por RPC rpc_process_upgrade_request).
// ============================================================

router.post('/:id/process', requireAuth, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const requestId = req.params.id;
        const { notes, amount_cents, contact_method } = req.body || {};

        const { data, error } = await supabase.rpc('rpc_process_upgrade_request', {
            p_request_id:    requestId,
            p_notes:         notes || null,
            p_amount_cents:  amount_cents || null,
            p_contact_method: contact_method || 'whatsapp',
        });

        if (error) {
            req.log?.error({ err: error, requestId }, 'Error procesando request');
            return res.status(500).json({ error: error.message || 'Error al procesar request' });
        }

        return res.json({ ok: true, result: data });
    } catch (err: any) {
        req.log?.error({ err }, 'Error en POST /upgrade-requests/:id/process');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// PATCH /api/v1/upgrade-requests/:id
//
// Permite super_admin marcar un request como contacted/rejected/cancelled
// sin necesariamente procesar el upgrade.
// ============================================================

router.patch('/:id', requireAuth, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const requestId = req.params.id;
        const { status, processed_notes, contact_method } = req.body || {};

        const allowed = ['contacted', 'rejected', 'cancelled'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `status invalido. Debe ser uno de: ${allowed.join(', ')}` });
        }

        const { data, error } = await supabase
            .from('plan_upgrade_requests')
            .update({
                status,
                processed_notes: processed_notes || null,
                contact_method:  contact_method || 'whatsapp',
            })
            .eq('id', requestId)
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error, requestId }, 'Error actualizando request');
            return res.status(500).json({ error: 'Error al actualizar request' });
        }

        return res.json({ ok: true, request: data });
    } catch (err: any) {
        req.log?.error({ err }, 'Error en PATCH /upgrade-requests/:id');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
