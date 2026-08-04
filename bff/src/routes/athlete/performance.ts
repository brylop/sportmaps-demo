import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { getMetricCatalog } from '../../services/metric-catalog.service';

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

    // Mismo catálogo que ve el coach: incluye umbrales, rango y dirección de
    // mejora, para que padre y atleta no vean una versión degradada.
    // includeInactive: es una vista de historial, no un formulario — una métrica
    // desactivada conserva sus mediciones y hay que seguir sabiendo nombrarla.
    const defs = await getMetricCatalog(
      (schools ?? []).map((s: any) => s.category_id),
      { includeInactive: true }
    );
    const defMap = new Map(defs.map((d) => [d.metric_key, d]));

    const evolution: Record<string, { date: string; value: number }[]> = {};
    for (const row of rows) {
      if (!evolution[row.metric_key]) evolution[row.metric_key] = [];
      evolution[row.metric_key].push({ date: row.recorded_at, value: Number(row.value) });
    }

    const metrics = Object.keys(evolution).map((key) => {
      const def = defMap.get(key);
      return {
        metric_key: key,
        // El padre ve el rótulo de familia; si no hay, el nombre técnico.
        display_name: def?.parent_label ?? def?.display_name ?? key,
        parent_hint: def?.parent_hint ?? null,
        unit: def?.unit ?? '',
        category: def?.category ?? 'other',
        min_value: def?.min_value ?? null,
        max_value: def?.max_value ?? null,
        // Por defecto "más es mejor": es lo que asumía la UI antes de exponerlo.
        higher_is_better: def?.higher_is_better ?? true,
        thresholds: def?.thresholds ?? [],
      };
    });

    res.json({ evolution, metrics, period_days: days });
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/performance unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
