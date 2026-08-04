import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// ==========================================
//  TRAINING PLANS (Weekly) - CRUD
// ==========================================

router.get('/training-plans', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { athlete_id, from_date, to_date } = req.query;

    let query = supabase
      .from('athlete_training_plans')
      .select('*, trainer_routines(name, category, difficulty)')
      .eq('school_id', schoolId);

    if (athlete_id) query = query.eq('athlete_id', athlete_id);
    if (from_date) query = query.gte('scheduled_at', from_date);
    if (to_date) query = query.lte('scheduled_at', to_date);

    const { data, error } = await query.order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error fetching training plans');
    res.status(500).json({ error: 'Error al obtener planes de entrenamiento.' });
  }
});

router.post('/training-plans', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { athlete_id, routine_id, scheduled_at, notes } = req.body;

    if (!athlete_id || !routine_id || !scheduled_at) {
      return res.status(400).json({ error: 'athlete_id, routine_id y scheduled_at son requeridos.' });
    }

    const { data, error } = await supabase
      .from('athlete_training_plans')
      .insert({
        school_id: schoolId,
        athlete_id,
        routine_id,
        scheduled_at,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error creating training plan');
    res.status(500).json({ error: 'Error al crear el plan de entrenamiento.' });
  }
});

router.put('/training-plans/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.school_id;

    const { data, error } = await supabase
      .from('athlete_training_plans')
      .update(updates)
      .eq('id', planId)
      .eq('school_id', req.schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error updating training plan');
    res.status(500).json({ error: 'Error al actualizar el plan.' });
  }
});

router.delete('/training-plans/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { error } = await supabase
      .from('athlete_training_plans')
      .delete()
      .eq('id', planId)
      .eq('school_id', req.schoolId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error deleting training plan');
    res.status(500).json({ error: 'Error al eliminar el plan.' });
  }
});

export default router;
