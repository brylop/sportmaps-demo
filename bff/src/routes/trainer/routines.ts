import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { hydrateBlocksWithLocalTranslations, hydrateRoutineWithCalories } from './wger';

const router = Router();

// ── RUTINAS (Biblioteca) ──────────────────────────────────────────────────────

/**
 * GET /trainer/routines
 * Lista todas las rutinas del entrenador.
 */
router.get('/routines', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        const { data, error } = await supabase
            .from('trainer_routines')
            .select('id, name, category, difficulty, estimated_minutes, estimated_calories, tags, times_used, is_template, blocks, created_at')
            .eq('school_id', schoolId)
            .eq('trainer_id', trainerId)
            .order('times_used', { ascending: false });

        if (error) throw error;
        
        const hydratedData = (data || []).map((r: any) => hydrateRoutineWithCalories(r, 70));
        
        res.json(hydratedData);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer routines');
        res.status(500).json({ error: 'Error al obtener rutinas.' });
    }
});

/**
 * GET /trainer/routines/:routineId
 * Detalle completo de una rutina.
 */
router.get('/routines/:routineId', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        const { data, error } = await supabase
            .from('trainer_routines')
            .select('*')
            .eq('id', routineId)
            .eq('school_id', schoolId)
            .eq('trainer_id', trainerId)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Rutina no encontrada.' });

        const hydrated = hydrateRoutineWithCalories(data, 70);
        res.json(hydrated);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer routine detail');
        res.status(500).json({ error: 'Error al obtener detalle de la rutina.' });
    }
});

/**
 * POST /trainer/routines
 * Crear una nueva rutina.
 */
router.post('/routines', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { schoolId } = req;
        const { 
            name, category, description, warmup, blocks, 
            cooldown, estimated_minutes, estimated_calories, difficulty, tags, is_template 
        } = req.body;

        if (!name || !blocks) {
            return res.status(400).json({ error: 'Nombre y bloques son requeridos.' });
        }

        const normalizedCategory = category?.toLowerCase() ?? 'general';
        const normalizedDifficulty = difficulty?.toLowerCase() ?? 'intermedio';

        const { data, error } = await supabase
            .from('trainer_routines')
            .insert({
                school_id: schoolId,
                trainer_id: trainerId,
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
                is_template: is_template ?? true,
                times_used: 0
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error creating trainer routine');
        res.status(500).json({ error: 'Error al crear la rutina.' });
    }
});

/**
 * PUT /trainer/routines/:routineId
 * Actualizar una rutina existente.
 */
router.put('/routines/:routineId', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;
        
        const updates = req.body;
        // Impedir el cambio de trainer_id o school_id desde el body
        delete updates.trainer_id;
        delete updates.school_id;
        delete updates.id;

        // ✅ Normalizar category y difficulty a lowercase antes del update
        // (misma lógica que el POST — el constraint de BD exige valores en minúscula)
        if (updates.category) updates.category = updates.category.toLowerCase();
        if (updates.difficulty) updates.difficulty = updates.difficulty.toLowerCase();

        const { data, error } = await supabase
            .from('trainer_routines')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', routineId)
            .eq('trainer_id', trainerId)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating trainer routine');
        res.status(500).json({ error: 'Error al actualizar la rutina.' });
    }
});

/**
 * DELETE /trainer/routines/:routineId
 */
router.delete('/routines/:routineId', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        const { error } = await supabase
            .from('trainer_routines')
            .delete()
            .eq('id', routineId)
            .eq('trainer_id', trainerId)
            .eq('school_id', schoolId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error deleting trainer routine');
        res.status(500).json({ error: 'Error al eliminar la rutina.' });
    }
});

/**
 * POST /trainer/routines/:routineId/use
 * Crear un plan de sesión desde una rutina usando RPC.
 */
router.post('/routines/:routineId/use', async (req: Request, res: Response) => {
    try {
        const { routineId } = req.params;
        const { client_id, client_type, session_date } = req.body;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        if (!client_id || !client_type || !session_date) {
            return res.status(400).json({ error: 'client_id, client_type y session_date son requeridos.' });
        }

        const { data, error } = await supabase.rpc('fn_create_plan_from_routine', {
            p_routine_id:    routineId,
            p_client_id:     client_id,
            p_client_type:   client_type,
            p_session_date:  session_date,
            p_trainer_id:    trainerId,
            p_school_id:     schoolId,
            p_enrollment_id: req.body.enrollment_id ?? null,
        });

        if (error) throw error;

        if (data?.plan_id) {
            await supabase
                .from('trainer_session_plans')
                .update({ visible_from: session_date })
                .eq('id', data.plan_id);
        }

        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error using routine to create session plan');
        res.status(500).json({ error: 'Error al asignar la rutina al cliente.' });
    }
});

// ── PLANES DE SESIÓN (Asignados) ────────────────────────────────────────────────

/**
 * GET /trainer/session-plans
 * Filtra planes por cliente, status, fechas o routine_id.
 * Enriquece con el nombre del cliente (profiles o children según client_type).
 */
router.get('/session-plans', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { schoolId } = req;
        const { client_id, status, from_date, to_date, routine_id } = req.query;

        let query = supabase
            .from('trainer_session_plans')
            .select('id, name, session_date, visible_from, status, client_id, client_type, blocks, custom_notes, results, routine_id, created_at, execution_progress, trainer_feedback')
            .eq('school_id', schoolId)
            .eq('trainer_id', trainerId);

        if (client_id)   query = query.eq('client_id', client_id);
        if (status)      query = query.eq('status', status);
        if (from_date)   query = query.gte('session_date', from_date);
        if (to_date)     query = query.lte('session_date', to_date);
        if (routine_id)  query = query.eq('routine_id', routine_id);

        const { data, error } = await query.order('session_date', { ascending: false });
        if (error) throw error;

        // Enriquecer con nombre del cliente
        if (!data || data.length === 0) return res.json([]);

        const ADULT_TYPES = ['registered', 'adult'];
        const adultIds  = [...new Set(data.filter((p: any) => ADULT_TYPES.includes(p.client_type)).map((p: any) => p.client_id))];
        const childIds  = [...new Set(data.filter((p: any) => p.client_type === 'child').map((p: any) => p.client_id))];

        const [profilesRes, childrenRes] = await Promise.all([
            adultIds.length > 0
                ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', adultIds)
                : Promise.resolve({ data: [] }),
            childIds.length > 0
                ? supabase.from('children').select('id, full_name').in('id', childIds)
                : Promise.resolve({ data: [] }),
        ]);

        const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
        const childMap   = new Map((childrenRes.data || []).map((c: any) => [c.id, { full_name: c.full_name, avatar_url: null }]));

        const enriched = data.map((plan: any) => {
            const info = ADULT_TYPES.includes(plan.client_type)
                ? profileMap.get(plan.client_id)
                : childMap.get(plan.client_id);
            return {
                ...plan,
                blocks:        hydrateBlocksWithLocalTranslations(plan.blocks),
                client_name:   info?.full_name  ?? 'Cliente',
                client_avatar: info?.avatar_url ?? null,
            };
        });

        res.json(enriched);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer session plans');
        res.status(500).json({ error: 'Error al obtener planes de sesión.' });
    }
});

/**
 * GET /trainer/session-plans/:planId
 */
router.get('/session-plans/:planId', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .select('*')
            .eq('id', planId)
            .eq('school_id', schoolId)
            .eq('trainer_id', trainerId)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Plan de sesión no encontrado.' });

        data.blocks = hydrateBlocksWithLocalTranslations(data.blocks);
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer session plan detail');
        res.status(500).json({ error: 'Error al obtener detalle del plan.' });
    }
});

/**
 * POST /trainer/session-plans
 * Crear plan desde cero.
 */
router.post('/session-plans', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { schoolId } = req;
        const {
            client_id, client_type: rawClientType, session_date, session_time,
            name, blocks, custom_notes,
            enrollment_id: enrollmentIdFromBody,
        } = req.body;

        if (!client_id || !rawClientType || !session_date) {
            return res.status(400).json({ error: 'client_id, client_type y session_date son requeridos.' });
        }

        // ✅ Normalizar 'adult' → 'registered' (valor legacy del frontend)
        const client_type = rawClientType === 'adult' ? 'registered' : rawClientType;

        // Prevención de duplicados: mismo trainer + cliente + fecha (+ hora si aplica)
        let dupQuery = supabase
            .from('trainer_session_plans')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('client_id', client_id)
            .eq('session_date', session_date)
            .not('status', 'in', '("cancelled","completed")');
        if (session_time) dupQuery = dupQuery.eq('session_time', session_time);

        const { data: existing } = await dupQuery.maybeSingle();
        if (existing) {
            return res.status(409).json({
                error: 'Ya existe una sesión activa para este cliente en esa fecha.',
                existing_plan_id: existing.id,
            });
        }

        // Auto-resolver enrollment_id para que fn_complete_session_plan descuente créditos
        let resolvedEnrollmentId: string | null = enrollmentIdFromBody ?? null;
        if (!resolvedEnrollmentId) {
            const enrollQuery = supabase
                .from('enrollments')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'active')
                .not('offering_plan_id', 'is', null);

            if (client_type === 'child') {
                enrollQuery.eq('child_id', client_id);
            } else if (client_type === 'unregistered') {
                enrollQuery.eq('unregistered_athlete_id', client_id);
            } else {
                enrollQuery.eq('user_id', client_id).is('child_id', null);
            }

            const { data: autoEnroll } = await enrollQuery
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (autoEnroll) resolvedEnrollmentId = autoEnroll.id;
        }

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .insert({
                school_id:     schoolId,
                trainer_id:    trainerId,
                client_id,
                client_type,
                session_date,
                session_time:  session_time        ?? null,
                enrollment_id: resolvedEnrollmentId,
                name:          name                ?? 'Sesión sin nombre',
                blocks:        blocks              ?? [],
                custom_notes,
                status:        'assigned',
                visible_from:  session_date,
            })
            .select()
            .single();

        if (error) throw error;

        // ✅ Descontar crédito del enrollment si el plan tiene max_sessions
        if (resolvedEnrollmentId && ['registered', 'child', 'unregistered'].includes(client_type)) {
            const { data: enr } = await supabase
                .from('enrollments')
                .select('sessions_used, offering_plans(max_sessions)')
                .eq('id', resolvedEnrollmentId)
                .maybeSingle();

            const maxSessions = (enr as any)?.offering_plans?.max_sessions;
            if (enr && maxSessions !== null && maxSessions !== undefined) {
                await supabase
                    .from('enrollments')
                    .update({ sessions_used: ((enr as any).sessions_used ?? 0) + 1 })
                    .eq('id', resolvedEnrollmentId);
            }
        }

        res.status(201).json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error creating trainer session plan');
        res.status(500).json({ error: 'Error al crear el plan de sesión.' });
    }
});

/**
 * PUT /trainer/session-plans/:planId
 * Actualizar plan (solo si status !== 'completed').
 */
router.put('/session-plans/:planId', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        // 1. Verificar status actual
        const { data: existing } = await supabase
            .from('trainer_session_plans')
            .select('status')
            .eq('id', planId)
            .single();

        if (existing?.status === 'completed') {
            return res.status(400).json({ error: 'No se puede editar un plan ya completado.' });
        }

        const updates = req.body;
        delete updates.trainer_id;
        delete updates.school_id;
        delete updates.id;
        delete updates.client_id;
        delete updates.client_type;

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', planId)
            .eq('trainer_id', trainerId)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating trainer session plan');
        res.status(500).json({ error: 'Error al actualizar el plan.' });
    }
});

/**
 * POST /trainer/session-plans/:planId/complete
 * Marca plan como completado usando RPC.
 */
router.post('/session-plans/:planId/complete', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { results } = req.body;
        const { id: trainerId } = req.user;

        if (!results) {
            return res.status(400).json({ error: 'Los resultados de la sesión son requeridos.' });
        }

        const { data, error } = await supabase.rpc('fn_complete_session_plan', {
            p_plan_id:    planId,
            p_results:    results,
            p_trainer_id: trainerId,
        });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error completing session plan');
        res.status(500).json({ error: 'Error al completar la sesión.' });
    }
});

/**
 * DELETE /trainer/session-plans/:planId
 * Solo si status !== 'completed'.
 */
router.delete('/session-plans/:planId', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        // 1. Verificar status actual
        const { data: existing } = await supabase
            .from('trainer_session_plans')
            .select('status')
            .eq('id', planId)
            .single();

        if (existing?.status === 'completed') {
            return res.status(400).json({ error: 'No se puede eliminar un plan ya completado.' });
        }

        const { error } = await supabase
            .from('trainer_session_plans')
            .delete()
            .eq('id', planId)
            .eq('trainer_id', trainerId)
            .eq('school_id', schoolId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error deleting trainer session plan');
        res.status(500).json({ error: 'Error al eliminar el plan.' });
    }
});

/**
 * PATCH /trainer/session-plans/:planId/progress
 * Guarda progreso parcial de la sesión.
 */
router.patch('/session-plans/:planId/progress', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { execution_progress } = req.body;

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .update({
                execution_progress,
                status: 'in_progress', // transición assigned → in_progress
                updated_at: new Date().toISOString(),
            })
            .eq('id', planId)
            .in('status', ['assigned', 'in_progress']) // no tocar completed/cancelled
            .select('id, status, execution_progress')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error saving session progress');
        res.status(500).json({ error: 'Error al guardar progreso parcial.' });
    }
});

/**
 * PATCH /trainer/session-plans/:planId/feedback
 * Guarda feedback del entrenador sobre el desempeño del cliente.
 */
router.patch('/session-plans/:planId/feedback', async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const { note, rating } = req.body;

        const trainer_feedback = {
            note:       note   ?? null,
            rating:     rating ?? null,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .update({ trainer_feedback, updated_at: new Date().toISOString() })
            .eq('id', planId)
            .select('id, trainer_feedback')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error saving session feedback');
        res.status(500).json({ error: 'Error al guardar feedback.' });
    }
});

// ── RESULTADOS DE EJERCICIO (Set-by-set) ────────────────────────────────────────

/**
 * POST /trainer/session-exercise-results
 * Registra el resultado de una serie específica.
 */
router.post('/session-exercise-results', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { 
            plan_id, athlete_id, exercise_name, set_number, 
            reps_completed, weight_kg, rpe, rest_seconds, notes 
        } = req.body;

        if (!plan_id || !athlete_id || !exercise_name || set_number === undefined) {
            return res.status(400).json({ error: 'Faltan campos requeridos (plan_id, athlete_id, exercise_name, set_number).' });
        }

        const { data, error } = await supabase
            .from('session_exercise_results')
            .insert({
                plan_id,
                athlete_id,
                exercise_name,
                set_number,
                reps_completed,
                weight_kg,
                rpe,
                rest_seconds,
                notes,
                recorded_by: trainerId
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error recording exercise result');
        res.status(500).json({ error: 'Error al registrar resultado del ejercicio.' });
    }
});

export default router;
