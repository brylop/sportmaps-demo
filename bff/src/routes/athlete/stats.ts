import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const context   = (req.query.context as string) ?? 'all';
    const sourceId  = (req.query.source_id as string) ?? null;
    const days      = parseInt((req.query.days as string) ?? '30', 10);

    if (!['all', 'pt', 'school', 'free'].includes(context)) {
      return res.status(400).json({ error: 'context debe ser all | pt | school | free' });
    }

    const { data, error } = await supabase.rpc('get_athlete_stats', {
      p_athlete_id: athleteId,
      p_context:    context,
      p_source_id:  sourceId,
      p_days:       days,
    });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats/sources', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;

    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('school_id, schools!enrollments_school_id_fkey(id, name, school_type)')
      .eq('user_id', athleteId)
      .eq('status', 'active');

    if (error) throw error;

    const sources = (enrollments ?? []).map((e: any) => ({
      type:      e.schools?.school_type === 'personal_trainer' ? 'pt' : 'school',
      school_id: e.school_id,
      name:      e.schools?.name ?? 'Sin nombre',
    }));

    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats/exercise-history/:exerciseKey', async (req: Request, res: Response) => {
  try {
    const athleteId      = req.user.id;
    const { exerciseKey } = req.params;
    const limit          = parseInt((req.query.limit as string) ?? '50', 10);

    const { data, error } = await supabase
      .from('session_exercise_results')
      .select(`
        id, set_number, reps_completed, weight_kg,
        duration_seconds, distance_m, rpe, created_at,
        trainer_session_plans!session_exercise_results_session_plan_id_fkey!inner(
          session_date, name, client_id
        )
      `)
      .eq('exercise_key', exerciseKey)
      .eq('trainer_session_plans.client_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
