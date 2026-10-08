import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';
import {
  buildMetricSettingsUpsert,
  computeBand,
  DEFAULT_QUICK_SIZE,
  defaultQuickKeys,
  getEvaluationCatalog,
  getMetricCatalog,
  getSchoolMetricRows,
  isEntryEligible,
  MAX_SCHOOL_METRICS,
  MetricSettingsError,
  scaleForDefinition,
  trainingRows,
} from '../../services/metric-catalog.service';

const router = Router();

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
/** Quién elige las métricas de evaluación de la escuela (spec F5 §5). */
const ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'school_admin'] as const;

// ==========================================
// GET /api/v1/school/performance/metrics
// Catálogo de métricas activas para el deporte de la escuela actual.
// `metrics` sigue siendo el catálogo COMPLETO (otras pantallas lo usan para
// nombrar el historial). `evaluation` dice qué se evalúa de entrada:
//   quick      → la lista de la escuela (school_metric_definitions) o la corta
//                por defecto del deporte;
//   full_keys  → el resto capturable, para el enlace "Evaluación completa".
// ==========================================
router.get(
  '/performance/metrics',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;

      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('id, category_id')
        .eq('id', schoolId)
        .maybeSingle();

      if (schoolErr) throw schoolErr;

      if (!school?.category_id) {
        return res.json({
          sport_category_id: null,
          metrics: [],
          message: 'Esta escuela aún no tiene un deporte asignado. Configúralo en Ajustes.',
        });
      }

      const metrics = await getMetricCatalog([school.category_id]);
      const evaluation = await getEvaluationCatalog(schoolId!, metrics, (err) =>
        req.log?.warn({ err }, 'school/performance: no se pudo leer school_metric_definitions; lista por defecto')
      );

      res.json({
        sport_category_id: school.category_id,
        metrics,
        evaluation,
      });
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/performance/roster
// Roster completo de un equipo o plan + catálogo de métricas activas +
// último valor registrado por atleta/métrica (para precargar la grilla).
// Query params: team_id | offering_plan_id (uno de los dos, requerido)
// ==========================================
router.get(
  '/performance/roster',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { team_id, offering_plan_id } = req.query as Record<string, string>;

      if (!team_id && !offering_plan_id) {
        return res.status(400).json({ error: 'team_id o offering_plan_id es requerido.' });
      }

      // 1. Deporte de la escuela -> catálogo de métricas activas
      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('id, category_id')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolErr) throw schoolErr;

      if (!school?.category_id) {
        return res.json({
          sport_category_id: null,
          metrics: [],
          subjects: [],
          latest_values: {},
          message: 'Esta escuela aún no tiene un deporte asignado. Configúralo en Ajustes.',
        });
      }

      const metrics = await getMetricCatalog([school.category_id]);
      const evaluation = await getEvaluationCatalog(schoolId!, metrics, (err) =>
        req.log?.warn({ err }, 'school/performance: no se pudo leer school_metric_definitions; lista por defecto')
      );

      // 2. Roster del equipo o plan, vía la vista unificada school_athletes
      let rosterQuery = supabase
        .from('school_athletes' as any)
        .select('id, full_name, athlete_type, avatar_url')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      rosterQuery = team_id
        ? rosterQuery.eq('enrolled_team_id', team_id)
        : rosterQuery.eq('offering_plan_id', offering_plan_id);

      const { data: athletes, error: rosterErr } = await rosterQuery.order('full_name');
      if (rosterErr) throw rosterErr;

      const subjects = (athletes ?? []).map((a: any) => ({
        subject_type: a.athlete_type === 'adult' ? 'profile' : a.athlete_type, // 'child' | 'unregistered' pasan igual
        subject_id: a.id,
        full_name: a.full_name,
        avatar_url: a.avatar_url ?? null,
      }));

      // 3. Último valor registrado por atleta+métrica, para precargar la grilla
      const subjectIds = subjects.map((s) => s.subject_id);
      let latestValues: Record<string, { value: number; recorded_at: string; band: 'green' | 'yellow' | 'red' | null }> = {};

      if (subjectIds.length > 0) {
        const { data: recentEntries } = await supabase
          .from('performance_entries')
          .select('subject_id, metric_key, value, recorded_at')
          .eq('school_id', schoolId)
          .in('subject_id', subjectIds)
          .order('recorded_at', { ascending: false })
          .limit(subjectIds.length * (metrics.length || 1) * 3); // margen para varias métricas/sujeto

        for (const e of recentEntries ?? []) {
          const key = `${e.subject_id}:${e.metric_key}`;
          if (!latestValues[key]) {
            const metric = metrics.find((m) => m.metric_key === e.metric_key);
            latestValues[key] = {
              value: Number(e.value),
              recorded_at: e.recorded_at,
              band: metric ? computeBand(Number(e.value), metric.thresholds) : null,
            };
          }
        }
      }

      res.json({
        sport_category_id: school.category_id,
        metrics,
        evaluation,
        subjects,
        latest_values: latestValues,
      });
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/performance/entries
// Filtros: subject_type, subject_id, metric_key, from_date, to_date,
//          recorded_by (quién registró), team_id (atletas activos del equipo)
// ==========================================
router.get(
  '/performance/entries',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { subject_type, subject_id, metric_key, from_date, to_date, recorded_by, team_id } =
        req.query as Record<string, string>;

      // team_id → los atletas activos de ese equipo en ESTA escuela. Un equipo de
      // otra escuela da roster vacío y, por tanto, respuesta vacía.
      let teamSubjectIds: string[] | null = null;
      if (team_id) {
        const { data: roster, error: rosterErr } = await supabase
          .from('school_athletes' as any)
          .select('id')
          .eq('school_id', schoolId)
          .eq('enrolled_team_id', team_id)
          .eq('is_active', true);
        if (rosterErr) throw rosterErr;
        teamSubjectIds = (roster ?? []).map((a: any) => a.id);
        if (teamSubjectIds.length === 0) return res.json([]);
      }

      let query = supabase
        .from('performance_entries')
        .select('id, subject_type, subject_id, metric_key, value, context_type, context_id, recorded_by, recorded_at, notes')
        .eq('school_id', schoolId)
        .order('recorded_at', { ascending: false });

      if (subject_type) query = query.eq('subject_type', subject_type);
      if (subject_id)   query = query.eq('subject_id', subject_id);
      if (metric_key)   query = query.eq('metric_key', metric_key);
      if (from_date)    query = query.gte('recorded_at', from_date);
      if (to_date)      query = query.lte('recorded_at', to_date);
      if (recorded_by)  query = query.eq('recorded_by', recorded_by);
      if (teamSubjectIds) query = query.in('subject_id', teamSubjectIds);

      const { data, error } = await query.limit(500);
      if (error) throw error;

      res.json(data ?? []);
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// POST /api/v1/school/performance/entries
// Crea uno o varios registros (array) en un solo request.
// Body: { entries: [{ subject_type, subject_id, metric_key, value, context_type?, context_id?, notes? }] }
// ==========================================
router.post(
  '/performance/entries',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, user } = req;
      const { entries, team_id } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'entries debe ser un array no vacío.' });
      }

      const VALID_SUBJECT_TYPES = ['profile', 'child', 'unregistered'];
      for (const e of entries) {
        if (!e.subject_type || !VALID_SUBJECT_TYPES.includes(e.subject_type)) {
          return res.status(400).json({ error: `subject_type inválido: ${e.subject_type}` });
        }
        if (!e.subject_id || !e.metric_key || e.value === undefined || e.value === null) {
          return res.status(400).json({ error: 'subject_id, metric_key y value son requeridos en cada entrada.' });
        }
      }

      // Resolver el deporte: si viene team_id (grilla de equipo), usar el deporte REAL
      // del equipo; si no (registro individual sin contexto de equipo), caer al deporte
      // por defecto de la escuela — comportamiento idéntico al de hoy.
      let sportCategoryId: string | null = null;
      if (team_id) {
        const { data: team } = await supabase.from('teams').select('sport').eq('id', team_id).maybeSingle();
        if (team?.sport) {
          const { data: cat } = await supabase
            .from('sports_categories')
            .select('id')
            .ilike('name', team.sport)
            .maybeSingle();
          sportCategoryId = cat?.id ?? null;
        }
      }
      if (!sportCategoryId) {
        const { data: school } = await supabase.from('schools').select('category_id').eq('id', schoolId).maybeSingle();
        sportCategoryId = school?.category_id ?? null;
      }

      if (sportCategoryId) {
        const metricKeys = [...new Set(entries.map((e: any) => e.metric_key))];
        const { data: validMetrics } = await supabase
          .from('sport_metric_definitions')
          .select('metric_key')
          .eq('sport_category_id', sportCategoryId)
          .in('metric_key', metricKeys);

        const validSet = new Set((validMetrics ?? []).map((m: any) => m.metric_key));
        // Las métricas que la escuela eligió para entrenamiento también valen,
        // aunque no estén en el catálogo del deporte del equipo.
        try {
          for (const r of trainingRows(await getSchoolMetricRows(schoolId!))) validSet.add(r.metric_key);
        } catch (err) {
          req.log?.warn({ err }, 'school/performance: no se pudo leer school_metric_definitions al validar');
        }
        const invalid = metricKeys.filter((k) => !validSet.has(k));
        if (invalid.length > 0) {
          return res.status(400).json({
            error: `Estas métricas no están activas para el deporte del equipo/escuela: ${invalid.join(', ')}`,
          });
        }
      }

      const rows = entries.map((e: any) => ({
        school_id:     schoolId,
        subject_type:  e.subject_type,
        subject_id:    e.subject_id,
        metric_key:    e.metric_key,
        value:         Number(e.value),
        context_type:  e.context_type ?? 'manual',
        context_id:    e.context_id ?? null,
        recorded_by:   user.id,
        recorded_at:   e.recorded_at ?? new Date().toISOString(),
        notes:         e.notes ?? null,
      }));

      const { data, error } = await supabase
        .from('performance_entries')
        .insert(rows)
        .select();

      if (error) throw error;
      res.status(201).json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// PUT /api/v1/school/performance/entries/:id
// ==========================================
router.put(
  '/performance/entries/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;
      const allowed = ['value', 'notes', 'recorded_at', 'context_type', 'context_id'];
      const updates: Record<string, any> = {};
      for (const f of allowed) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
      }

      const { data, error } = await supabase
        .from('performance_entries')
        .update(updates)
        .eq('id', id)
        .eq('school_id', schoolId)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Registro no encontrado.' });

      res.json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// DELETE /api/v1/school/performance/entries/:id
// ==========================================
router.delete(
  '/performance/entries/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;

      const { error } = await supabase
        .from('performance_entries')
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/performance/metric-settings
// Pantalla "Métricas de evaluación": catálogo capturable del deporte + lo que
// la escuela eligió (o la lista por defecto si no eligió nada).
// ==========================================
router.get(
  '/performance/metric-settings',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('id, category_id')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolErr) throw schoolErr;

      if (!school?.category_id) {
        return res.json({
          sport_category_id: null,
          catalog: [],
          selected_keys: [],
          default_keys: [],
          source: 'default',
          max: MAX_SCHOOL_METRICS,
          message: 'Esta escuela aún no tiene un deporte asignado. Configúralo en Ajustes.',
        });
      }

      const metrics = await getMetricCatalog([school.category_id]);
      const eligible = metrics.filter(isEntryEligible);
      const rows = await getSchoolMetricRows(schoolId!);
      const chosen = trainingRows(rows);
      const defaults = defaultQuickKeys(metrics);

      res.json({
        sport_category_id: school.category_id,
        catalog: eligible.map((d) => ({
          metric_key: d.metric_key,
          display_name: d.display_name,
          parent_label: d.parent_label,
          category: d.category,
          unit: d.unit,
          min_value: d.min_value,
          max_value: d.max_value,
          scale: scaleForDefinition(d),
        })),
        selected_keys: chosen.length > 0 ? chosen.map((r) => r.metric_key) : defaults,
        default_keys: defaults,
        source: chosen.length > 0 ? 'school' : 'default',
        max: MAX_SCHOOL_METRICS,
        recommended: { min: 3, max: 6, default_size: DEFAULT_QUICK_SIZE },
      });
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance metric-settings unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// PUT /api/v1/school/performance/metric-settings   (solo administración)
// Body: { metric_keys: string[] } en el orden en que se muestran.
// Lista vacía = volver a la lista por defecto del deporte.
// Un solo upsert (una sentencia, atómico) sobre (school_id, metric_key).
// ==========================================
router.put(
  '/performance/metric-settings',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, user } = req;
      const { metric_keys } = req.body ?? {};

      if (!Array.isArray(metric_keys) || metric_keys.some((k: unknown) => typeof k !== 'string')) {
        return res.status(400).json({ error: 'metric_keys debe ser una lista de claves.' });
      }

      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('id, category_id')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolErr) throw schoolErr;
      if (!school?.category_id) {
        return res.status(400).json({ error: 'Esta escuela aún no tiene un deporte asignado.' });
      }

      const metrics = await getMetricCatalog([school.category_id]);
      const existing = await getSchoolMetricRows(schoolId!);

      let rows;
      try {
        rows = buildMetricSettingsUpsert({
          schoolId: schoolId!,
          userId: user.id,
          selectedKeys: metric_keys,
          catalog: metrics,
          existing,
        });
      } catch (err) {
        if (err instanceof MetricSettingsError) return res.status(400).json({ error: err.message });
        throw err;
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('school_metric_definitions')
          .upsert(rows, { onConflict: 'school_id,metric_key' });
        if (error) throw error;
      }

      const evaluation = await getEvaluationCatalog(schoolId!, metrics);
      res.json({ evaluation });
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance metric-settings unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/performance/subjects/:subjectType/:subjectId/evolution
// Evolución de un atleta específico, agrupada por métrica.
// ==========================================
router.get(
  '/performance/subjects/:subjectType/:subjectId/evolution',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { subjectType, subjectId } = req.params;
      const days = parseInt((req.query.days as string) ?? '365', 10);

      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('performance_entries')
        .select('metric_key, value, recorded_at, notes')
        .eq('school_id', schoolId)
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      const evolution: Record<string, { date: string; value: number; notes: string | null }[]> = {};
      for (const row of data ?? []) {
        if (!evolution[row.metric_key]) evolution[row.metric_key] = [];
        evolution[row.metric_key].push({
          date: row.recorded_at,
          value: Number(row.value),
          notes: row.notes,
        });
      }

      res.json({ evolution, period_days: days });
    } catch (err: any) {
      req.log?.error({ err }, 'school/performance unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

export default router;
