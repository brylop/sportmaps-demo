import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { hydrateBlocksWithLocalTranslations, hydrateRoutineWithCalories } from '../trainer/wger';

const router = Router();

const STAFF_ROLES = ['owner', 'admin', 'coach', 'staff'];

/**
 * Verifica que el caller sea staff activo (owner/admin/coach/staff) de la escuela.
 * Espeja la misma regla que ya vive en RLS (trainer_routines_school_staff_all)
 * y en fn_create_plan_from_routine — el BFF usa service_role y por eso necesita
 * este chequeo explícito además de RLS.
 */
async function assertSchoolStaff(callerId: string, schoolId: string): Promise<boolean> {
    const { data } = await supabase
        .from('school_members')
        .select('role')
        .eq('profile_id', callerId)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .in('role', STAFF_ROLES)
        .maybeSingle();
    return !!data;
}

// ── RUTINAS (Biblioteca del gimnasio) ───────────────────────────────────────

/**
 * GET /school/routines
 * Lista rutinas visibles para el gimnasio: las 'custom' propias de la escuela
 * + las 'default' de la escuela + opcionalmente el catálogo global de SportMaps.
 * Query param: ?include_global=true para incluir el catálogo global.
 */
router.get('/routines', async (req: Request, res: Response) => {
    try {
        const { id: callerId } = req.user;
        const { schoolId } = req;
        const includeGlobal = req.query.include_global === 'true';

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        let query = supabase
            .from('trainer_routines')
            .select('id, name, category, difficulty, estimated_minutes, estimated_calories, tags, times_used, routine_type, scope, visible_to_athletes, created_by, blocks, created_at');

        if (includeGlobal) {
            query = query.or(`school_id.eq.${schoolId},scope.eq.global`);
        } else {
            query = query.eq('school_id', schoolId).eq('scope', 'school');
        }

        const { data, error } = await query.order('routine_type', { ascending: true }).order('times_used', { ascending: false });

        if (error) throw error;

        const hydratedData = (data || []).map((r: any) => hydrateRoutineWithCalories(r, 70));

        res.json(hydratedData);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching school routines');
        res.status(500).json({ error: 'Error al obtener rutinas del gimnasio.' });
    }
});

/**
 * GET /school/routines/:routineId
 */
router.get('/routines/:routineId', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { id: callerId } = req.user;
        const { schoolId } = req;

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        const { data, error } = await supabase
            .from('trainer_routines')
            .select('*')
            .eq('id', routineId)
            .or(`school_id.eq.${schoolId},scope.eq.global`)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Rutina no encontrada.' });

        const hydrated = hydrateRoutineWithCalories(data, 70);
        res.json(hydrated);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching school routine detail');
        res.status(500).json({ error: 'Error al obtener detalle de la rutina.' });
    }
});

/**
 * POST /school/routines
 * Crea una rutina 'custom' o 'default' para el gimnasio.
 * scope siempre 'school' — el catálogo 'global' lo gestiona solo SportMaps (super_admin).
 */
router.post('/routines', async (req: Request, res: Response) => {
    try {
        const { id: callerId } = req.user;
        const { schoolId } = req;
        const {
            name, category, description, warmup, blocks,
            cooldown, estimated_minutes, estimated_calories, difficulty, tags,
            routine_type, visible_to_athletes,
        } = req.body;

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        if (!name || !blocks) {
            return res.status(400).json({ error: 'Nombre y bloques son requeridos.' });
        }

        const normalizedCategory = category?.toLowerCase() ?? 'general';
        const normalizedDifficulty = difficulty?.toLowerCase() ?? 'intermedio';
        const normalizedType = routine_type === 'default' ? 'default' : 'custom';

        const { data, error } = await supabase
            .from('trainer_routines')
            .insert({
                school_id: schoolId,
                trainer_id: callerId, // compat: guardamos también aquí por si algo legacy lo lee
                created_by: callerId,
                scope: 'school',
                routine_type: normalizedType,
                visible_to_athletes: !!visible_to_athletes,
                name,
                category: normalizedCategory,
                description,
                warmup,
                blocks,
                cooldown,
                estimated_minutes,
                estimated_calories,
                difficulty: normalizedDifficulty,
                tags,
                times_used: 0,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error creating school routine');
        res.status(500).json({ error: 'Error al crear la rutina.' });
    }
});

/**
 * PUT /school/routines/:routineId
 * Solo rutinas 'school' de la propia escuela (el catálogo global no se edita aquí).
 */
router.put('/routines/:routineId', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { id: callerId } = req.user;
        const { schoolId } = req;

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        const updates = req.body;
        delete updates.trainer_id;
        delete updates.created_by;
        delete updates.school_id;
        delete updates.scope;
        delete updates.id;

        if (updates.category) updates.category = updates.category.toLowerCase();
        if (updates.difficulty) updates.difficulty = updates.difficulty.toLowerCase();
        if (updates.routine_type && !['custom', 'default'].includes(updates.routine_type)) {
            delete updates.routine_type;
        }

        const { data, error } = await supabase
            .from('trainer_routines')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', routineId)
            .eq('school_id', schoolId)
            .eq('scope', 'school')
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Rutina no encontrada.' });
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating school routine');
        res.status(500).json({ error: 'Error al actualizar la rutina.' });
    }
});

/**
 * DELETE /school/routines/:routineId
 */
router.delete('/routines/:routineId', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { id: callerId } = req.user;
        const { schoolId } = req;

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        const { error } = await supabase
            .from('trainer_routines')
            .delete()
            .eq('id', routineId)
            .eq('school_id', schoolId)
            .eq('scope', 'school');

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error deleting school routine');
        res.status(500).json({ error: 'Error al eliminar la rutina.' });
    }
});

/**
 * POST /school/routines/:routineId/use
 * Asigna la rutina (custom, default o global) a un atleta del gimnasio.
 * La autorización real la resuelve fn_create_plan_from_routine (owner/coach/global).
 */
router.post('/routines/:routineId/use', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { client_id, client_type, session_date, enrollment_id } = req.body;
        const { id: callerId } = req.user;
        const { schoolId } = req;

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        if (!client_id || !client_type || !session_date) {
            return res.status(400).json({ error: 'client_id, client_type y session_date son requeridos.' });
        }

        const { data, error } = await supabase.rpc('fn_create_plan_from_routine', {
            p_routine_id:        routineId,
            p_client_id:         client_id,
            p_client_type:       client_type,
            p_session_date:      session_date,
            p_trainer_id:        callerId,
            p_school_id:         schoolId,
            p_enrollment_id:     enrollment_id ?? null,
            p_assignment_source: 'gym_staff',
        });

        if (error) throw error;
        if (!data?.success) return res.status(400).json(data);

        if (data.plan_id) {
            await supabase
                .from('trainer_session_plans')
                .update({ visible_from: session_date })
                .eq('id', data.plan_id);
        }

        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error using school routine to create session plan');
        res.status(500).json({ error: 'Error al asignar la rutina al atleta.' });
    }
});

/**
 * GET /school/session-plans
 * Lista las sesiones que el gimnasio (owner/coach) ha asignado a
 * atletas (assignment_source='gym_staff'), con el nombre del atleta
 * resuelto. Mismo patrón de enriquecimiento que ya usa
 * GET /trainer/session-plans.
 */
router.get('/session-plans', async (req: Request, res: Response) => {
    try {
        const { id: callerId } = req.user;
        const { schoolId } = req;

        if (!(await assertSchoolStaff(callerId, schoolId))) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta escuela.' });
        }

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .select('id, name, session_date, status, client_id, client_type, routine_id, created_at, trainer_id')
            .eq('school_id', schoolId)
            .eq('assignment_source', 'gym_staff')
            .order('session_date', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return res.json([]);

        const ADULT_TYPES = ['registered', 'adult'];
        const adultIds = [...new Set(data.filter((p: any) => ADULT_TYPES.includes(p.client_type)).map((p: any) => p.client_id))];
        const childIds = [...new Set(data.filter((p: any) => p.client_type === 'child').map((p: any) => p.client_id))];
        const unregIds  = [...new Set(data.filter((p: any) => p.client_type === 'unregistered').map((p: any) => p.client_id))];

        const [profilesRes, childrenRes, unregRes] = await Promise.all([
            adultIds.length > 0
                ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', adultIds)
                : Promise.resolve({ data: [] }),
            childIds.length > 0
                ? supabase.from('children').select('id, full_name').in('id', childIds)
                : Promise.resolve({ data: [] }),
            unregIds.length > 0
                ? supabase.from('unregistered_athletes').select('id, full_name').in('id', unregIds)
                : Promise.resolve({ data: [] }),
        ]);

        const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
        const childMap   = new Map((childrenRes.data || []).map((c: any) => [c.id, { full_name: c.full_name, avatar_url: null }]));
        const unregMap   = new Map((unregRes.data   || []).map((u: any) => [u.id, { full_name: u.full_name, avatar_url: null }]));

        const enriched = data.map((plan: any) => {
            let info;
            if (ADULT_TYPES.includes(plan.client_type)) info = profileMap.get(plan.client_id);
            else if (plan.client_type === 'child')       info = childMap.get(plan.client_id);
            else                                          info = unregMap.get(plan.client_id);
            return {
                ...plan,
                client_name:   info?.full_name  ?? 'Atleta',
                client_avatar: info?.avatar_url ?? null,
            };
        });

        res.json(enriched);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching gym-assigned session plans');
        res.status(500).json({ error: 'Error al obtener sesiones asignadas.' });
    }
});

/**
 * DELETE /school/session-plans/:planId
 * Cualquier staff activo de la escuela (no solo quien la asignó)
 * puede desasociar una rutina asignada por error.
 */
router.delete('/session-plans/:planId', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { id: callerId } = req.user;

        const { data, error } = await supabase.rpc('fn_unassign_gym_session', {
            p_plan_id:   planId,
            p_caller_id: callerId,
        });

        if (error) throw error;
        if (!data?.success) return res.status(400).json(data);

        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error unassigning gym session');
        res.status(500).json({ error: 'Error al desasociar la sesión.' });
    }
});

export default router;
