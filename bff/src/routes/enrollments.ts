import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────
const EnrollmentSchema = z.object({
    user_id: z.string().uuid().optional(),
    child_id: z.string().uuid().optional(),
    team_id: z.string().uuid(),
}).refine(
    (d) => (d.user_id && !d.child_id) || (!d.user_id && d.child_id),
    { message: 'Debe especificar user_id o child_id, no ambos' }
);

// ── POST /api/v1/enrollments ──────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('owner', 'admin', 'school_admin', 'coach', 'staff'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        // 1. Validar request
        const parsed = EnrollmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: parsed.error.issues,
            });
        }

        const { user_id, child_id, team_id } = parsed.data;

        // 2. Comprobar si ya está inscrito
        let dupQuery = supabase
            .from('enrollments')
            .select('id')
            .eq('team_id', team_id)
            .eq('school_id', req.schoolId);

        if (child_id) dupQuery = dupQuery.eq('child_id', child_id);
        else dupQuery = dupQuery.eq('user_id', user_id as string);

        const { data: existing, error: findError } = await dupQuery.maybeSingle();

        if (existing) {
            return res.status(400).json({ error: 'Ya está inscrito en este equipo.' });
        }

        // 3. Ejecutar inserción en enrollments
        // req.schoolId asegura que no matriculemos en otra escuela
        const { data, error } = await supabase.from('enrollments').insert({
            user_id: user_id || null,
            child_id: child_id || null,
            team_id,
            school_id: req.schoolId,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
        }).select().single();

        if (error) {
            req.log?.error({ err: error }, 'Inscripción falló en la BD');

            if (error.code === '23505') {
                return res.status(400).json({ error: 'El estudiante ya está inscrito en esta clase.' });
            }

            return res.status(500).json({ error: 'Error interno al procesar la inscripción.' });
        }

        return res.status(201).json({
            success: true,
            message: 'Inscripción exitosa',
            data: data
        });

    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Error inesperado en inscripciones');
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/v1/enrollments ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { team_id } = req.query;

    let query = supabase
        .from('enrollments')
        .select(`
            id, child_id, user_id, team_id,
            status, offering_plan_id, sessions_used,
            secondary_sessions_used, expires_at, start_date, created_at
        `)
        .eq('school_id', req.schoolId);  // 🔒 siempre filtrado

    if (team_id && typeof team_id === 'string') {
        query = query.eq('team_id', team_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Error al obtener inscripciones.' });

    return res.json({ enrollments: data });
});

// ── GET /api/v1/enrollments/my-plan ─────────────────────────────────────────
// Plan activo del atleta (user_id = auth.uid()) o de un hijo.
router.get('/my-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user.id;
        const { child_id } = req.query;
        const { schoolId } = req;

        let query = supabase
            .from('enrollments')
            .select(`
                id, status, sessions_used, secondary_sessions_used,
                expires_at, start_date, team_id, offering_plan_id
            `)
            .eq('school_id', schoolId)
            .eq('status', 'active');

        if (child_id && typeof child_id === 'string') {
            query = query.eq('child_id', child_id);
        } else {
            query = query.eq('user_id', userId);
        }

        const { data: enrollments, error } = await query;
        if (error) throw error;

        // ── IDs únicos para batch queries ──────────────────────────────
        const planIds = [...new Set((enrollments || []).map((e: any) => e.offering_plan_id).filter(Boolean))];
        const teamIds = [...new Set((enrollments || []).map((e: any) => e.team_id).filter(Boolean))];

        const [plansRes, teamsRes] = await Promise.all([
            planIds.length
                ? supabase
                    .from('offering_plans')
                    .select('id, name, max_sessions, max_secondary_sessions, duration_days, price, offering_id, offering:offerings(id, name, offering_type, sport)')
                    .in('id', planIds)
                : Promise.resolve({ data: [], error: null }),
            teamIds.length
                ? supabase
                    .from('teams')
                    .select('id, name, sport')
                    .in('id', teamIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        const planMap = Object.fromEntries((plansRes.data || []).map((p: any) => [p.id, p]));
        const teamMap = Object.fromEntries((teamsRes.data || []).map((t: any) => [t.id, t]));

        const enriched = (enrollments || []).map((enrollment: any) => {
            const offeringPlan = enrollment.offering_plan_id
                ? planMap[enrollment.offering_plan_id] ?? null
                : null;
            const team = enrollment.team_id ? teamMap[enrollment.team_id] ?? null : null;

            const maxSessions = offeringPlan?.max_sessions ?? null;
            const used = enrollment.sessions_used || 0;
            const expiresAt = enrollment.expires_at;
            const now = new Date();

            let planStatus = 'active';
            let daysLeft: number | null = null;
            let percentUsed: number | null = null;

            if (!offeringPlan) {
                planStatus = 'no_plan';
            } else if (expiresAt && new Date(expiresAt) < now) {
                planStatus = 'expired';
            } else if (maxSessions !== null && used >= maxSessions) {
                planStatus = 'exhausted';
            } else {
                if (expiresAt) {
                    daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86400000));
                    if (daysLeft <= 5) planStatus = 'expiring_soon';
                }
                if (maxSessions !== null) {
                    percentUsed = Math.round((used / maxSessions) * 100);
                    if (percentUsed > 85 && planStatus === 'active') planStatus = 'expiring_soon';
                }
            }

            return {
                ...enrollment,
                offering_plan: offeringPlan,
                offering: offeringPlan?.offering ?? null,
                team,
                computed: {
                    plan_status: planStatus,
                    percent_used: percentUsed,
                    days_left: daysLeft,
                    sessions_remaining: maxSessions !== null ? Math.max(0, maxSessions - used) : null,
                },
            };
        });

        res.json({ enrollments: enriched });
    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Error fetching my plan');
        res.status(500).json({ error: 'Error al consultar plan' });
    }
});

// ── POST /api/v1/enrollments/assign-plan ────────────────────────────────────
// Asigna un offering_plan a un enrollment existente (vender plan a atleta).
router.post('/assign-plan',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const AssignPlanSchema = z.object({
                enrollment_id: z.string().uuid(),
                offering_plan_id: z.string().uuid(),
            });

            const parsed = AssignPlanSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { enrollment_id, offering_plan_id } = parsed.data;
            const { schoolId } = req;

            // Verificar que el plan pertenece a la escuela
            const { data: plan, error: planErr } = await supabase
                .from('offering_plans')
                .select('id, duration_days')
                .eq('id', offering_plan_id)
                .eq('school_id', schoolId)
                .single();

            if (planErr || !plan) {
                return res.status(404).json({ error: 'Plan no encontrado' });
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

            const { data, error } = await supabase
                .from('enrollments')
                .update({
                    offering_plan_id,
                    sessions_used: 0,
                    secondary_sessions_used: 0,
                    expires_at: expiresAt.toISOString().split('T')[0],
                })
                .eq('id', enrollment_id)
                .eq('school_id', schoolId)
                .select()
                .single();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Inscripción no encontrada' });

            res.json({ enrollment: data });
        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error assigning plan');
            res.status(500).json({ error: 'Error al asignar plan' });
        }
    }
);

export default router;
