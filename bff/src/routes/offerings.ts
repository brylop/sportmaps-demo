import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateOfferingSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    offering_type: z.enum(['membership', 'session_pack', 'court_booking', 'tournament', 'single_session']),
    sport: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
    sort_order: z.number().int().min(0).optional().default(0),
});

const UpdateOfferingSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    sport: z.string().optional(),
    branch_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    sort_order: z.number().int().min(0).optional(),
});

const CreatePlanSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    max_sessions: z.number().int().positive().nullable().optional(),
    max_secondary_sessions: z.number().int().min(0).optional().default(0),
    duration_days: z.number().int().positive().default(30),
    price: z.number().min(0),
    currency: z.string().default('COP'),
    slot_duration_minutes: z.number().int().positive().optional(),
    auto_renew: z.boolean().default(false),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
    sort_order: z.number().int().min(0).optional().default(0),
});

const UpdatePlanSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    max_sessions: z.number().int().positive().nullable().optional(),
    max_secondary_sessions: z.number().int().min(0).optional(),
    duration_days: z.number().int().positive().optional(),
    price: z.number().min(0).optional(),
    currency: z.string().default('COP').optional(),
    slot_duration_minutes: z.number().int().positive().nullable().optional(),
    auto_renew: z.boolean().optional(),
    is_active: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    sort_order: z.number().int().min(0).optional(),
});

// ── GET /api/v1/offerings ────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { type, active_only } = req.query;

        // ✅ QUERY 1: Offerings + Plans
        let query = supabase
            .from('offerings')
            .select('*, offering_plans(*)')
            .eq('school_id', schoolId)
            .order('sort_order', { ascending: true });

        if (type) {
            query = query.eq('offering_type', type as string);
        }
        if (active_only !== 'false') {
            query = query.eq('is_active', true);
        }

        const { data: offerings, error: offeringError } = await query;
        if (offeringError) throw offeringError;

        // ✅ QUERY 2: Solo enrollments SIN join
        const { data: allEnrollments, error: enrollmentError } = await supabase
            .from('enrollments')
            .select('id, user_id, offering_plan_id, status, sessions_used, secondary_sessions_used, expires_at')
            .eq('school_id', schoolId)
            .eq('status', 'active');

        if (enrollmentError) throw enrollmentError;

        // ✅ QUERY 3: Perfiles de los usuarios enrollados
        const userIds = allEnrollments?.map(e => e.user_id).filter(Boolean) || [];
        const uniqueUserIds = [...new Set(userIds)];

        let profiles: any[] = [];
        if (uniqueUserIds.length > 0) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', uniqueUserIds);

            if (profileError) throw profileError;
            profiles = profileData || [];
        }

        // ✅ COMBINAR en código (no en Supabase)
        const profileMap = new Map(profiles.map(p => [p.id, p]));

        const enrollmentsWithProfiles = (allEnrollments || []).map(e => ({
            ...e,
            profile: profileMap.get(e.user_id) || null
        }));

        const result = (offerings || []).map(offering => ({
            ...offering,
            offering_plans: (offering.offering_plans || []).map((plan: any) => ({
                ...plan,
                enrollments: enrollmentsWithProfiles.filter(e => e.offering_plan_id === plan.id)
            }))
        }));

        res.json({ offerings: result });
    } catch (err) {
        console.error('Error listing offerings:', err);
        (req as any).log?.error({ err }, 'Error listing offerings');
        res.status(500).json({ error: 'Error al listar offerings', details: (err as any).message });
    }
});

// ── GET /api/v1/offerings/:id ────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;

        const { data: offering, error: offeringError } = await supabase
            .from('offerings')
            .select('*, offering_plans(*)')
            .eq('id', id)
            .eq('school_id', schoolId)
            .single();

        if (offeringError || !offering) {
            return res.status(404).json({ error: 'Offering no encontrado' });
        }

        // Sin join de Supabase
        const planIds = offering.offering_plans?.map((p: any) => p.id) || [];
        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('id, user_id, offering_plan_id, status, sessions_used, secondary_sessions_used, expires_at')
            .in('offering_plan_id', planIds)
            .eq('school_id', schoolId)
            .eq('status', 'active');

        const userIds = enrollments?.map(e => e.user_id).filter(Boolean) || [];
        const uniqueUserIds = [...new Set(userIds)];

        let profiles: any[] = [];
        if (uniqueUserIds.length > 0) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', uniqueUserIds);
            profiles = profileData || [];
        }

        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const enrollmentsWithProfiles = (enrollments || []).map(e => ({
            ...e,
            profile: profileMap.get(e.user_id) || null
        }));

        const result = {
            ...offering,
            offering_plans: offering.offering_plans?.map((plan: any) => ({
                ...plan,
                enrollments: enrollmentsWithProfiles.filter(e => e.offering_plan_id === plan.id)
            })) || []
        };

        res.json({ offering: result });
    } catch (err) {
        console.error('Error fetching offering:', err);
        (req as any).log?.error({ err }, 'Error fetching offering');
        res.status(500).json({ error: 'Error al obtener offering', details: (err as any).message });
    }
});

// ── POST /api/v1/offerings ───────────────────────────────────────────────────

router.post('/',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const parsed = CreateOfferingSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;
            const { data, error } = await supabase
                .from('offerings')
                .insert({ ...parsed.data, school_id: schoolId })
                .select()
                .single();

            if (error) throw error;
            res.status(201).json({ offering: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error creating offering');
            res.status(500).json({ error: 'Error al crear offering' });
        }
    }
);

// ── PATCH /api/v1/offerings/:id ──────────────────────────────────────────────

router.patch('/:id',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const parsed = UpdateOfferingSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;
            const { id } = req.params;

            const { data, error } = await supabase
                .from('offerings')
                .update(parsed.data)
                .eq('id', id)
                .eq('school_id', schoolId)
                .select()
                .single();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Offering no encontrado' });

            res.json({ offering: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error updating offering');
            res.status(500).json({ error: 'Error al actualizar offering' });
        }
    }
);

// ── DELETE /api/v1/offerings/:id ─────────────────────────────────────────────

router.delete('/:id',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const { schoolId } = req;
            const { id } = req.params;

            // Antes del DELETE — verificar que no haya enrollments activos
            const { data: plans } = await supabase
                .from('offering_plans')
                .select('id')
                .eq('offering_id', id);

            const planIds = plans?.map(p => p.id) || [];
            if (planIds.length > 0) {
                const { count } = await supabase
                    .from('enrollments')
                    .select('id', { count: 'exact', head: true })
                    .in('offering_plan_id', planIds)
                    .eq('status', 'active');

                if (count && count > 0) {
                    return res.status(409).json({
                        error: 'No se puede eliminar un offering con inscripciones activas',
                        code: 'OFFERING_HAS_ACTIVE_ENROLLMENTS'
                    });
                }
            }

            const { error } = await supabase
                .from('offerings')
                .delete()
                .eq('id', id)
                .eq('school_id', schoolId);

            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error deleting offering');
            res.status(500).json({ error: 'Error al eliminar offering' });
        }
    }
);

// ── GET /api/v1/offerings/:id/plans ──────────────────────────────────────────

router.get('/:id/plans', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('offering_plans')
            .select('*')
            .eq('offering_id', id)
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        res.json({ plans: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error listing plans');
        res.status(500).json({ error: 'Error al listar planes' });
    }
});

// ── POST /api/v1/offerings/:id/plans ─────────────────────────────────────────

router.post('/:id/plans',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const parsed = CreatePlanSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;
            const { id: offeringId } = req.params;

            // Verificar que el offering pertenece a la escuela
            const { data: offering, error: offErr } = await supabase
                .from('offerings')
                .select('id')
                .eq('id', offeringId)
                .eq('school_id', schoolId)
                .single();

            if (offErr || !offering) {
                return res.status(404).json({ error: 'Offering no encontrado' });
            }

            const { data, error } = await supabase
                .from('offering_plans')
                .insert({
                    ...parsed.data,
                    offering_id: offeringId,
                    school_id: schoolId,
                })
                .select()
                .single();

            if (error) throw error;
            res.status(201).json({ plan: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error creating plan');
            res.status(500).json({ error: 'Error al crear plan' });
        }
    }
);

// ── PATCH /api/v1/offerings/:offeringId/plans/:planId ────────────────────────

router.patch('/:offeringId/plans/:planId',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const parsed = UpdatePlanSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;
            const { planId } = req.params;

            const { data, error } = await supabase
                .from('offering_plans')
                .update(parsed.data)
                .eq('id', planId)
                .eq('school_id', schoolId)
                .select()
                .single();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Plan no encontrado' });

            res.json({ plan: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error updating plan');
            res.status(500).json({ error: 'Error al actualizar plan' });
        }
    }
);

// ── DELETE /api/v1/offerings/:offeringId/plans/:planId ───────────────

router.delete('/:offeringId/plans/:planId',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const { schoolId } = req;
            const { planId } = req.params;

            // Verificar si hay enrollments activos para este plan
            const { count } = await supabase
                .from('enrollments')
                .select('id', { count: 'exact', head: true })
                .eq('offering_plan_id', planId)
                .eq('status', 'active');

            if (count && count > 0) {
                return res.status(409).json({
                    error: 'No se puede eliminar un plan con inscripciones activas',
                    code: 'PLAN_HAS_ACTIVE_ENROLLMENTS'
                });
            }

            const { error } = await supabase
                .from('offering_plans')
                .delete()
                .eq('id', planId)
                .eq('school_id', schoolId);

            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error deleting plan');
            res.status(500).json({ error: 'Error al eliminar plan' });
        }
    }
);

export default router;
