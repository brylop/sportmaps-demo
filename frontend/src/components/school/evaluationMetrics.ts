/**
 * Evaluación rápida (spec rediseno-seguimiento-deportivo.md F5): tipos y
 * lectura de `evaluation`, que el BFF manda en /school/performance/metrics y
 * /school/performance/roster junto al catálogo completo.
 */
import type { MetricThreshold, SportMetricDefinition } from '@/lib/school/performanceQueries';

export type EvaluationScale = 'scale_1_5' | 'scale_1_10' | 'yes_no' | 'number' | 'text';

export interface EvaluationMetric {
  metric_key: string;
  display_name: string;
  parent_label: string | null;
  scale: EvaluationScale;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  options: { value: number; label: string }[] | null;
  category: string | null;
  sort_order: number;
  source_definition_id: string | null;
  thresholds: MetricThreshold[];
}

export interface EvaluationCatalog {
  /** 'school' = la escuela eligió su lista; 'default' = lista corta del deporte. */
  source: 'school' | 'default';
  /** Lo que se muestra de entrada, en orden. */
  quick: EvaluationMetric[];
  /** "Evaluación completa": el resto capturable. */
  full_keys: string[];
}

/** Misma regla que el BFF, solo para un BFF viejo que todavía no manda `evaluation`. */
const FALLBACK_QUICK_KEYS = ['actitud_esfuerzo', 'control_balon', 'precision_pase', 'posicionamiento_tactico', 'definicion'];

function isEntryEligible(m: SportMetricDefinition): boolean {
  if (!m.category) return false;
  if (m.metric_key === 'asistencia_entrenamiento') return false;
  return !m.metric_key.startsWith('focus_') && !m.metric_key.startsWith('mesociclo_');
}

function scaleOf(m: SportMetricDefinition): EvaluationScale {
  if (m.data_type === 'rating' && m.min_value === 1 && m.max_value === 5) return 'scale_1_5';
  if (m.data_type === 'rating' && m.min_value === 1 && m.max_value === 10) return 'scale_1_10';
  if (m.data_type === 'count' && m.min_value === 0 && m.max_value === 1) return 'yes_no';
  return 'number';
}

/** Lee `evaluation` de la respuesta del BFF (o la arma si no vino). */
export function readEvaluation(
  data: { metrics?: SportMetricDefinition[]; evaluation?: EvaluationCatalog } | undefined
): EvaluationCatalog {
  if (data?.evaluation) return data.evaluation;
  const eligible = (data?.metrics ?? []).filter((m) => m.is_active && isEntryEligible(m));
  const quickDefs = FALLBACK_QUICK_KEYS.map((k) => eligible.find((m) => m.metric_key === k)).filter(
    (m): m is SportMetricDefinition => !!m
  );
  const quickKeys = new Set(quickDefs.map((m) => m.metric_key));
  return {
    source: 'default',
    quick: quickDefs.map((m, i) => ({
      metric_key: m.metric_key,
      display_name: m.display_name,
      parent_label: m.parent_label ?? null,
      scale: scaleOf(m),
      unit: m.unit,
      min_value: m.min_value,
      max_value: m.max_value,
      options: null,
      category: m.category,
      sort_order: (i + 1) * 10,
      source_definition_id: m.id,
      thresholds: m.thresholds ?? [],
    })),
    full_keys: eligible.map((m) => m.metric_key).filter((k) => !quickKeys.has(k)),
  };
}

/** Nombre para el entrenador + ayuda en lenguaje de familia, si difiere. */
export function metricLabels(m: { display_name: string; parent_label: string | null }) {
  const hint = m.parent_label && m.parent_label !== m.display_name ? m.parent_label : null;
  return { title: m.display_name, hint };
}
