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
  /** Cómo agrega el informe mensual mediciones de sesión (spec evaluacion-post-entrenamiento.md §3.1/§3.4). */
  aggregation: 'latest' | 'avg' | 'distribution' | 'count';
  /** Opciones de valor fijo, [{value,label}], o null en métricas numéricas puras. */
  options: { value: number; label: string }[] | null;
  required: boolean;
  thresholds: MetricThreshold[];
}

const DEFINITION_COLUMNS =
  'id, metric_key, display_name, parent_label, parent_hint, data_type, unit, category, subcategory, min_value, max_value, higher_is_better, is_active, aggregation, options, required';

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

// =============================================================================
// Evaluación por escuela (spec rediseno-seguimiento-deportivo.md F5 y §5)
//
// "Cada escuela elige sus métricas". La elección vive en
// `school_metric_definitions` (filas con applies_to 'training' | 'both').
// Sin elección, se aplica la LISTA CORTA del deporte. El catálogo completo
// (`getMetricCatalog`) no cambia: varias pantallas lo usan para NOMBRAR
// mediciones del historial, y recortarlo las dejaría con claves crudas.
// =============================================================================

export type EvaluationScale = 'scale_1_5' | 'scale_1_10' | 'yes_no' | 'number' | 'text';

/** Fila de `school_metric_definitions` tal como la lee el BFF. */
export interface SchoolMetricRow {
  metric_key: string;
  display_name: string;
  description?: string | null;
  scale: EvaluationScale;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  options: { value: number; label: string }[] | null;
  applies_to: 'match' | 'training' | 'both';
  sort_order: number;
  is_active: boolean;
  source_definition_id: string | null;
  created_by?: string | null;
}

/** Métrica lista para pintarse en la "Evaluación rápida". */
export interface EvaluationMetric {
  metric_key: string;
  /** Nombre que ve el entrenador (el de la escuela si lo cambió). */
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
  /** "Evaluación completa": el resto de métricas capturables (sin las de `quick`). */
  full_keys: string[];
}

/** Máximo de métricas que una escuela puede elegir para la evaluación rápida. */
export const MAX_SCHOOL_METRICS = 12;

/** Cuántas trae la lista corta por defecto. */
export const DEFAULT_QUICK_SIZE = 5;

/**
 * Lista corta preferida (claves de fútbol, decisión 5b.3 del spec). En otro
 * deporte ninguna existe y se cae a las primeras escalas 1-5 del catálogo.
 */
export const DEFAULT_QUICK_KEYS = [
  'actitud_esfuerzo',
  'control_balon',
  'precision_pase',
  'posicionamiento_tactico',
  'definicion',
];

/**
 * ¿Se captura en el modal de rendimiento? Fuera:
 *  · `asistencia_entrenamiento` → sale de la asistencia real;
 *  · `focus_*` → contadores 0/1 del flujo de foco;
 *  · `mesociclo_*` → los registra la rúbrica del mesociclo;
 *  · `category IS NULL` → métricas del flujo post-entreno (rating, RPE…).
 */
export function isEntryEligible(def: Pick<MetricDefinition, 'metric_key' | 'category'>): boolean {
  if (!def.category) return false;
  const k = def.metric_key;
  if (k === 'asistencia_entrenamiento') return false;
  if (k.startsWith('focus_') || k.startsWith('mesociclo_')) return false;
  return true;
}

/** Escala de captura que corresponde a una definición del catálogo del deporte. */
export function scaleForDefinition(
  def: Pick<MetricDefinition, 'data_type' | 'min_value' | 'max_value'>
): EvaluationScale {
  const min = def.min_value === null || def.min_value === undefined ? null : Number(def.min_value);
  const max = def.max_value === null || def.max_value === undefined ? null : Number(def.max_value);
  if (def.data_type === 'rating' && min === 1 && max === 5) return 'scale_1_5';
  if (def.data_type === 'rating' && min === 1 && max === 10) return 'scale_1_10';
  if (def.data_type === 'count' && min === 0 && max === 1) return 'yes_no';
  return 'number';
}

function fromDefinition(def: MetricDefinition, sortOrder: number): EvaluationMetric {
  return {
    metric_key: def.metric_key,
    display_name: def.display_name,
    parent_label: def.parent_label ?? null,
    scale: scaleForDefinition(def),
    unit: def.unit ?? null,
    min_value: def.min_value ?? null,
    max_value: def.max_value ?? null,
    options: def.options ?? null,
    category: def.category ?? null,
    sort_order: sortOrder,
    source_definition_id: def.id,
    thresholds: def.thresholds ?? [],
  };
}

/** Las filas que cuentan como "elección de la escuela" para entrenamiento, en orden. */
export function trainingRows(rows: SchoolMetricRow[]): SchoolMetricRow[] {
  return rows
    .filter((r) => r.is_active && (r.applies_to === 'training' || r.applies_to === 'both'))
    .sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name, 'es'));
}

/** Lista corta por defecto de un catálogo. */
export function defaultQuickKeys(catalog: MetricDefinition[]): string[] {
  const eligible = catalog.filter((d) => d.is_active !== false && isEntryEligible(d));
  const present = new Set(eligible.map((d) => d.metric_key));
  const preferred = DEFAULT_QUICK_KEYS.filter((k) => present.has(k));
  if (preferred.length > 0) return preferred.slice(0, DEFAULT_QUICK_SIZE);

  const oneToFive = eligible.filter((d) => scaleForDefinition(d) === 'scale_1_5').map((d) => d.metric_key);
  const rest = eligible.map((d) => d.metric_key).filter((k) => !oneToFive.includes(k));
  return [...oneToFive, ...rest].slice(0, DEFAULT_QUICK_SIZE);
}

/**
 * Decide qué evalúa el entrenador. Pura: recibe el catálogo activo del deporte
 * y las filas de la escuela.
 */
export function selectEvaluationCatalog(
  catalog: MetricDefinition[],
  schoolRows: SchoolMetricRow[]
): EvaluationCatalog {
  const eligible = catalog.filter((d) => d.is_active !== false && isEntryEligible(d));
  const byKey = new Map(catalog.map((d) => [d.metric_key, d]));
  const byId = new Map(catalog.map((d) => [d.id, d]));
  const chosen = trainingRows(schoolRows);

  let quick: EvaluationMetric[];
  let source: EvaluationCatalog['source'];

  if (chosen.length > 0) {
    source = 'school';
    quick = chosen.map((r) => {
      const def = (r.source_definition_id ? byId.get(r.source_definition_id) : undefined) ?? byKey.get(r.metric_key);
      return {
        metric_key: r.metric_key,
        display_name: r.display_name || def?.display_name || r.metric_key,
        parent_label: def?.parent_label ?? null,
        scale: r.scale,
        unit: r.unit ?? def?.unit ?? null,
        min_value: r.min_value ?? def?.min_value ?? null,
        max_value: r.max_value ?? def?.max_value ?? null,
        options: r.options ?? def?.options ?? null,
        category: def?.category ?? null,
        sort_order: r.sort_order,
        source_definition_id: r.source_definition_id ?? def?.id ?? null,
        thresholds: def?.thresholds ?? [],
      };
    });
  } else {
    source = 'default';
    quick = defaultQuickKeys(eligible).map((k, i) => fromDefinition(byKey.get(k)!, (i + 1) * 10));
  }

  const quickKeys = new Set(quick.map((m) => m.metric_key));
  const full_keys = eligible.map((d) => d.metric_key).filter((k) => !quickKeys.has(k));

  return { source, quick, full_keys };
}

const SCHOOL_METRIC_COLUMNS =
  'metric_key, display_name, description, scale, unit, min_value, max_value, options, applies_to, sort_order, is_active, source_definition_id, created_by';

/** Filas de `school_metric_definitions` de una escuela (todas, activas o no). */
export async function getSchoolMetricRows(schoolId: string): Promise<SchoolMetricRow[]> {
  const { data, error } = await supabase
    .from('school_metric_definitions')
    .select(SCHOOL_METRIC_COLUMNS)
    .eq('school_id', schoolId);
  if (error) throw error;
  return (data ?? []) as SchoolMetricRow[];
}

/**
 * Catálogo de evaluación de una escuela. Si la lectura de la configuración
 * falla, se cae a la lista por defecto: el modal no debe quedar vacío por eso.
 */
export async function getEvaluationCatalog(
  schoolId: string,
  catalog: MetricDefinition[],
  onError?: (err: unknown) => void
): Promise<EvaluationCatalog> {
  let rows: SchoolMetricRow[] = [];
  try {
    rows = await getSchoolMetricRows(schoolId);
  } catch (err) {
    onError?.(err);
  }
  return selectEvaluationCatalog(catalog, rows);
}

export interface MetricSettingsUpsertRow {
  school_id: string;
  metric_key: string;
  display_name: string;
  description: string | null;
  scale: EvaluationScale;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  options: { value: number; label: string }[] | null;
  applies_to: 'match' | 'training' | 'both';
  sort_order: number;
  is_active: boolean;
  source_definition_id: string | null;
  created_by: string | null;
  updated_at: string;
}

export class MetricSettingsError extends Error {}

/**
 * Filas a escribir (un solo upsert = una sola sentencia, atómica) para que la
 * elección de entrenamiento de la escuela quede EXACTAMENTE en `selectedKeys`,
 * en ese orden. Respeta las filas de partido:
 *  · elegir una métrica que ya era 'match' activa la deja en 'both';
 *  · quitar una 'both' la devuelve a 'match' (sigue activa para partidos);
 *  · quitar una 'training' la desactiva (no se borra).
 * Todas las filas llevan las mismas columnas: en un upsert por lote PostgREST
 * rellena con NULL las que falten en alguna fila.
 * Lista vacía = volver a la lista por defecto del deporte.
 */
export function buildMetricSettingsUpsert(params: {
  schoolId: string;
  userId: string;
  selectedKeys: string[];
  catalog: MetricDefinition[];
  existing: SchoolMetricRow[];
  now?: string;
}): MetricSettingsUpsertRow[] {
  const { schoolId, userId, catalog, existing } = params;
  const now = params.now ?? new Date().toISOString();
  const selected = [...new Set(params.selectedKeys)];

  if (selected.length > MAX_SCHOOL_METRICS) {
    throw new MetricSettingsError(`Puedes elegir hasta ${MAX_SCHOOL_METRICS} métricas.`);
  }

  const eligible = new Map(
    catalog.filter((d) => d.is_active !== false && isEntryEligible(d)).map((d) => [d.metric_key, d])
  );
  const invalid = selected.filter((k) => !eligible.has(k));
  if (invalid.length > 0) {
    throw new MetricSettingsError(`Estas métricas no se pueden elegir: ${invalid.join(', ')}`);
  }

  const existingByKey = new Map(existing.map((r) => [r.metric_key, r]));
  const out: MetricSettingsUpsertRow[] = [];

  selected.forEach((key, i) => {
    const def = eligible.get(key)!;
    const prev = existingByKey.get(key);
    const keepsMatch = !!prev && prev.is_active && (prev.applies_to === 'match' || prev.applies_to === 'both');
    out.push({
      school_id: schoolId,
      metric_key: key,
      display_name: prev?.display_name || def.display_name,
      description: prev?.description ?? null,
      scale: prev?.scale ?? scaleForDefinition(def),
      unit: prev?.unit ?? def.unit ?? null,
      min_value: prev?.min_value ?? def.min_value ?? null,
      max_value: prev?.max_value ?? def.max_value ?? null,
      options: prev?.options ?? def.options ?? null,
      applies_to: keepsMatch ? 'both' : 'training',
      sort_order: (i + 1) * 10,
      is_active: true,
      source_definition_id: prev?.source_definition_id ?? def.id,
      created_by: prev?.created_by ?? userId,
      updated_at: now,
    });
  });

  const selectedSet = new Set(selected);
  for (const prev of existing) {
    if (selectedSet.has(prev.metric_key)) continue;
    if (!prev.is_active || prev.applies_to === 'match') continue;
    out.push({
      school_id: schoolId,
      metric_key: prev.metric_key,
      display_name: prev.display_name,
      description: prev.description ?? null,
      scale: prev.scale,
      unit: prev.unit ?? null,
      min_value: prev.min_value ?? null,
      max_value: prev.max_value ?? null,
      options: prev.options ?? null,
      applies_to: prev.applies_to === 'both' ? 'match' : 'training',
      sort_order: prev.sort_order,
      is_active: prev.applies_to === 'both',
      source_definition_id: prev.source_definition_id ?? null,
      created_by: prev.created_by ?? null,
      updated_at: now,
    });
  }

  return out;
}
