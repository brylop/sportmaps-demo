import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateEnrollmentSchema = z.object({
    user_id: z.string().uuid().optional(),
    child_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    program_id: z.string().uuid().optional(),
    offering_plan_id: z.string().uuid().optional(),
    status: z.enum(['active', 'cancelled', 'pending']).default('active'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
    (data) => data.user_id || data.child_id,
    { message: 'Debe proporcionar user_id o child_id' }
).refine(
    (data) => data.team_id || data.offering_plan_id,
    { message: 'Debe proporcionar team_id u offering_plan_id' }
);

// ── POST /api/v1/enrollments ─────────────────────────────────────────────────
// ✅ Crear inscripción (equipo, plan o ambos)
router.post('/', requireAuth, requireRole('owner', 'admin', 'school_admin', 'coach', 'staff'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = CreateEnrollmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: parsed.error.issues
            });
        }

        const { schoolId } = req;
        const data = parsed.data;

        // ✅ Validar que user_id o child_id existe
        const studentId = data.user_id || data.child_id;
        const studentField = data.user_id ? 'user_id' : 'child_id';

        const targetTable = data.user_id ? 'profiles' : 'children';
        const { data: student, error: studentError } = await supabase
            .from(targetTable)
            .select('id')
            .eq('id', studentId)
            .maybeSingle();

        if (studentError || !student) {
            return res.status(404).json({
                error: 'Estudiante no encontrado'
            });
        }

        // ✅ Si es inscripción a equipo, validar que no exista ya activa
        if (data.team_id) {
            const { data: existingTeamEnroll } = await supabase
                .from('enrollments')
                .select('id')
                .eq('team_id', data.team_id)
                .eq(studentField, studentId)
                .eq('status', 'active')
                .eq('school_id', schoolId)
                .maybeSingle();

            if (existingTeamEnroll) {
                return res.status(400).json({
                    error: 'Ya está inscrito en este equipo'
                });
            }
        }

        // ✅ Si es inscripción a plan, validar que no exista ya activo
        if (data.offering_plan_id) {
            const { data: existingPlanEnroll } = await supabase
                .from('enrollments')
                .select('id')
                .eq('offering_plan_id', data.offering_plan_id)
                .eq(studentField, studentId)
                .eq('status', 'active')
                .eq('school_id', schoolId)
                .maybeSingle();

            if (existingPlanEnroll) {
                return res.status(400).json({
                    error: 'Ya está inscrito en este plan'
                });
            }
        }

        // ✅ Calcular fecha de expiración si hay plan
        let expiresAt = null;
        if (data.offering_plan_id) {
            const { data: plan } = await supabase
                .from('offering_plans')
                .select('duration_days')
                .eq('id', data.offering_plan_id)
                .single();
            
            if (plan?.duration_days) {
                const date = new Date();
                date.setDate(date.getDate() + plan.duration_days);
                expiresAt = date.toISOString().split('T')[0];
            }
        }

        // ✅ Crear inscripción
        const { data: enrollment, error: enrollError } = await supabase
            .from('enrollments')
            .insert({
                user_id: data.user_id || null,
                child_id: data.child_id || null,
                team_id: data.team_id || null,
                program_id: data.program_id || null,
                offering_plan_id: data.offering_plan_id || null,
                school_id: schoolId,
                status: data.status,
                start_date: data.start_date || new Date().toISOString().split('T')[0],
                end_date: data.end_date || null,
                expires_at: expiresAt,
                sessions_used: 0,
                secondary_sessions_used: 0
            })
            .select()
            .single();

        if (enrollError) throw enrollError;

        res.status(201).json({
            message: 'Inscripción creada exitosamente',
            data: enrollment
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error creating enrollment');
        res.status(500).json({
            error: 'Error al crear inscripción',
            details: err.message
        });
    }
});

// ── GET /api/v1/enrollments ──────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schoolId } = req;
        const { team_id, offering_plan_id, status } = req.query;

        let query = supabase
            .from('enrollments')
            .select(`
                id, child_id, user_id, team_id,
                status, offering_plan_id, sessions_used,
                secondary_sessions_used, expires_at, start_date, created_at
            `)
            .eq('school_id', schoolId);

        if (team_id) {
            query = query.eq('team_id', team_id as string);
        }
        if (offering_plan_id) {
            query = query.eq('offering_plan_id', offering_plan_id as string);
        }
        if (status) {
            query = query.eq('status', status as string);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        res.json({ enrollments: data });
    } catch (err: any) {
        req.log?.error({ err }, 'Error listing enrollments');
        res.status(500).json({ error: 'Error al listar inscripciones' });
    }
});

// ── GET /api/v1/enrollments/my-plan ─────────────────────────────────────────
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
                    .select('id, name, sport, price_monthly')
                    .in('id', teamIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        const planMap = Object.fromEntries((plansRes.data || []).map((p: any) => [p.id, p]));
        const teamMap = Object.fromEntries((teamsRes.data || []).map((t: any) => [t.id, t]));

        const enriched = (enrollments || []).map((enrollment: any) => {
            const offeringPlan = enrollment.offering_plan_id ? planMap[enrollment.offering_plan_id] : null;
            const team = enrollment.team_id ? teamMap[enrollment.team_id] : null;

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
                offering_id: (offeringPlan?.offering as any)?.id ?? null,
                // Precio unificado: plan tiene price, equipo tiene price_monthly
                price_monthly: offeringPlan?.price ?? team?.price_monthly ?? null,
                currency: offeringPlan?.currency ?? 'COP',
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
        req.log?.error({ err }, 'Error fetching my plan');
        res.status(500).json({ error: 'Error al consultar plan' });
    }
});

// ── POST /api/v1/enrollments/assign-plan (Legacy/Team-based) ────────────────
router.post('/assign-plan', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { enrollment_id, offering_plan_id } = req.body;
        const { schoolId } = req;

        const { data: plan } = await supabase
            .from('offering_plans')
            .select('duration_days')
            .eq('id', offering_plan_id)
            .eq('school_id', schoolId)
            .single();

        if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

        const { data, error } = await supabase
            .from('enrollments')
            .update({
                offering_plan_id,
                sessions_used: 0,
                secondary_sessions_used: 0,
                expires_at: expiresAt.toISOString().split('T')[0],
                status: 'active'
            })
            .eq('id', enrollment_id)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;
        res.json({ enrollment: data });
    } catch (err: any) {
        req.log?.error({ err }, 'Error assigning plan');
        res.status(500).json({ error: 'Error al asignar plan' });
    }
});

// ── PATCH /api/v1/enrollments/:id ────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { schoolId } = req;
        const { status, end_date, offering_plan_id } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (end_date) updateData.end_date = end_date;
        if (offering_plan_id) updateData.offering_plan_id = offering_plan_id;

        const { data, error } = await supabase
            .from('enrollments')
            .update(updateData)
            .eq('id', id)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Inscripción no encontrada' });

        res.json({ message: 'Inscripción actualizada', data });
    } catch (err: any) {
        req.log?.error({ err }, 'Error updating enrollment');
        res.status(500).json({ error: 'Error al actualizar inscripción' });
    }
});

// ── DELETE /api/v1/enrollments/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { schoolId } = req;

        const { data, error } = await supabase
            .from('enrollments')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Inscripción no encontrada' });

        res.json({ message: 'Inscripción desactivada', data });
    } catch (err: any) {
        req.log?.error({ err }, 'Error deleting enrollment');
        res.status(500).json({ error: 'Error al eliminar inscripción' });
    }
});

export default router;
