/**
 * Catálogo de métricas de rendimiento — fuente única.
 *
 * Antes este bloque estaba copiado tres veces (school/performance /metrics y
 * /roster, athlete/performance /evolution) y las copias se desincronizaron: la
 * de athlete nunca consultó `sport_metric_thresholds`, así que padres y atletas
 * veían el valor crudo sin semáforo mientras el coach sí lo veía. Cualquier
 * campo de presentación que se agregue va aquí y llega a las tres rutas.
 */
import { supabase } from '../config/supabase';

export type Band = 'green' | 'yellow' | 'red';

export interface MetricThreshold {
  band: Band;
  min_value: number | null;
  max_value: number | null;
}

export interface MetricDefinition {
  id: string;
  metric_key: string;
  display_name: string;
  /** Nombre en idioma de familia. NULL = usar display_name. */
  parent_label: string | null;
  /** Qué mide y por qué importa, para el padre. NULL = no mostrar. */
  parent_hint: string | null;
  data_type: string;
  unit: string | null;
  category: string | null;
  subcategory: string | null;
  min_value: number | null;
  max_value: number | null;
  higher_is_better: boolean;
  is_active: boolean;
  thresholds: MetricThreshold[];
}

const DEFINITION_COLUMNS =
  'id, metric_key, display_name, parent_label, parent_hint, data_type, unit, category, subcategory, min_value, max_value, higher_is_better, is_active';

const VALID_BANDS: Band[] = ['green', 'yellow', 'red'];

export interface MetricCatalogOptions {
  /**
   * Incluir métricas desactivadas. Los formularios de captura quieren solo las
   * activas; las vistas de historial las necesitan todas, porque una métrica
   * que se desactivó ayer sigue teniendo mediciones que hay que saber nombrar.
   */
  includeInactive?: boolean;
}

/**
 * Métricas de uno o varios deportes, con sus bandas ya adjuntas.
 * Dos queries en total, sin importar cuántas métricas haya.
 */
export async function getMetricCatalog(
  sportCategoryIds: (string | null | undefined)[],
  { includeInactive = false }: MetricCatalogOptions = {}
): Promise<MetricDefinition[]> {
  const categoryIds = [...new Set(sportCategoryIds.filter((id): id is string => !!id))];
  if (categoryIds.length === 0) return [];

  let query = supabase
    .from('sport_metric_definitions')
    .select(DEFINITION_COLUMNS)
    .in('sport_category_id', categoryIds)
    .order('category', { ascending: true });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data: definitions, error } = await query;

  if (error) throw error;
  if (!definitions || definitions.length === 0) return [];

  const { data: thresholds, error: thresholdsError } = await supabase
    .from('sport_metric_thresholds')
    .select('metric_id, band, min_value, max_value')
    .in('metric_id', definitions.map((d: any) => d.id));

  if (thresholdsError) throw thresholdsError;

  const byMetric: Record<string, MetricThreshold[]> = {};
  for (const t of thresholds ?? []) {
    if (!VALID_BANDS.includes(t.band)) continue;
    if (!byMetric[t.metric_id]) byMetric[t.metric_id] = [];
    byMetric[t.metric_id].push({ band: t.band, min_value: t.min_value, max_value: t.max_value });
  }

  return definitions.map((d: any) => ({
    ...d,
    thresholds: sortThresholds(byMetric[d.id] ?? []),
  })) as MetricDefinition[];
}

/**
 * Umbrales en orden ascendente por cota inferior.
 *
 * La query no lleva ORDER BY, y `computeBand` devuelve la primera banda que
 * encaja: sin ordenar, dos rangos solapados podían asignar bandas distintas
 * entre requests según el orden en que llegaran las filas.
 */
export function sortThresholds(thresholds: MetricThreshold[]): MetricThreshold[] {
  return [...thresholds].sort(
    (a, b) => (a.min_value ?? Number.NEGATIVE_INFINITY) - (b.min_value ?? Number.NEGATIVE_INFINITY)
  );
}

/** Banda en la que cae un valor, o null si la métrica no define umbrales. */
export function computeBand(value: number, thresholds: MetricThreshold[] | undefined): Band | null {
  if (!thresholds || thresholds.length === 0) return null;
  for (const t of sortThresholds(thresholds)) {
    const aboveMin = t.min_value === null || value >= t.min_value;
    const belowMax = t.max_value === null || value <= t.max_value;
    if (aboveMin && belowMax) return t.band;
  }
  return null;
}
