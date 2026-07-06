import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

/**
 * Resuelve subject_type/subject_id para el llamador actual.
 * - Si viene ?child_id=..., valida que el usuario sea el padre de ese hijo.
 * - Si no, asume que el propio usuario autenticado es el atleta (subject_type='profile').
 */
async function resolveSubject(req: Request): Promise<{ subjectType: string; subjectId: string } | null> {
  const userId = req.user.id;
  const childId = req.query.child_id as string | undefined;

  if (!childId) {
    return { subjectType: 'profile', subjectId: userId };
  }

  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', userId)
    .maybeSingle();

  if (!child) return null; // no es su hijo, o no existe

  return { subjectType: 'child', subjectId: childId };
}

// ==========================================
// GET /api/v1/athlete/performance/entries
// ==========================================
router.get('/performance/entries', async (req: Request, res: Response) => {
  try {
    const subject = await resolveSubject(req);
    if (!subject) return res.status(403).json({ error: 'Sin permisos para ver este atleta.' });

    const limit = parseInt((req.query.limit as string) ?? '100', 10);

    const { data, error } = await supabase
      .from('performance_entries')
      .select('id, school_id, metric_key, value, context_type, recorded_at, notes')
      .eq('subject_type', subject.subjectType)
      .eq('subject_id', subject.subjectId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/performance unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ==========================================
// GET /api/v1/athlete/performance/evolution
// Evolución agrupada por métrica, con nombre y unidad ya resueltos
// desde sport_metric_definitions (vía school_id -> category_id).
// ==========================================
router.get('/performance/evolution', async (req: Request, res: Response) => {
  try {
    const subject = await resolveSubject(req);
    if (!subject) return res.status(403).json({ error: 'Sin permisos para ver este atleta.' });

    const days = parseInt((req.query.days as string) ?? '365', 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: entries, error } = await supabase
      .from('performance_entries')
      .select('school_id, metric_key, value, recorded_at')
      .eq('subject_type', subject.subjectType)
      .eq('subject_id', subject.subjectId)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    const rows = entries ?? [];
    if (rows.length === 0) {
      return res.json({ evolution: {}, metrics: [], period_days: days });
    }

    // Resolver definiciones de métrica vía el/los deporte(s) de las escuelas involucradas
    const schoolIds = [...new Set(rows.map((r: any) => r.school_id))];
    const { data: schools } = await supabase
      .from('schools')
      .select('id, category_id')
      .in('id', schoolIds);

    const categoryIds = [...new Set((schools ?? []).map((s: any) => s.category_id).filter(Boolean))];
    const { data: defs } = categoryIds.length
      ? await supabase
          .from('sport_metric_definitions')
          .select('metric_key, display_name, data_type, unit, category')
          .in('sport_category_id', categoryIds)
      : { data: [] as any[] };

    const defMap = new Map((defs ?? []).map((d: any) => [d.metric_key, d]));

    const evolution: Record<string, { date: string; value: number }[]> = {};
    for (const row of rows) {
      if (!evolution[row.metric_key]) evolution[row.metric_key] = [];
      evolution[row.metric_key].push({ date: row.recorded_at, value: Number(row.value) });
    }

    const metrics = Object.keys(evolution).map((key) => ({
      metric_key: key,
      display_name: defMap.get(key)?.display_name ?? key,
      unit: defMap.get(key)?.unit ?? '',
      category: defMap.get(key)?.category ?? 'other',
    }));

    res.json({ evolution, metrics, period_days: days });
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/performance unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
