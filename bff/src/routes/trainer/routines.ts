import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

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
        res.json(data);
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

        res.json(data);
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
            p_routine_id:   routineId,
            p_client_id:    client_id,
            p_client_type:  client_type,
            p_session_date: session_date,
            p_trainer_id:   trainerId,
            p_school_id:    schoolId,
        });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error using routine to create session plan');
        res.status(500).json({ error: 'Error al asignar la rutina al cliente.' });
    }
});

// ── PLANES DE SESIÓN (Asignados) ────────────────────────────────────────────────

/**
 * GET /trainer/session-plans
 * Filtra planes por cliente, status o fechas.
 */
router.get('/session-plans', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { schoolId } = req;
        const { client_id, status, from_date, to_date } = req.query;

        let query = supabase
            .from('trainer_session_plans')
            .select('*')
            .eq('school_id', schoolId)
            .eq('trainer_id', trainerId);

        if (client_id) query = query.eq('client_id', client_id);
        if (status) query = query.eq('status', status);
        if (from_date) query = query.gte('session_date', from_date);
        if (to_date) query = query.lte('session_date', to_date);

        const { data, error } = await query.order('session_date', { ascending: false });

        if (error) throw error;
        res.json(data);
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
        const { client_id, client_type, session_date, name, blocks, custom_notes } = req.body;

        if (!client_id || !client_type || !session_date) {
            return res.status(400).json({ error: 'client_id, client_type y session_date son requeridos.' });
        }

        const { data, error } = await supabase
            .from('trainer_session_plans')
            .insert({
                school_id: schoolId,
                trainer_id: trainerId,
                client_id,
                client_type,
                session_date,
                name: name ?? 'Sesión sin nombre',
                blocks: blocks ?? [],
                custom_notes,
                status: 'assigned' // Por defecto asignado si se crea desde cero
            })
            .select()
            .single();

        if (error) throw error;
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
