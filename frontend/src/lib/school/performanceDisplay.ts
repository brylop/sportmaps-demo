/**
 * Performance Module — Presentación
 *
 * Centraliza las decisiones visuales del módulo de rendimiento: paleta de
 * categorías, semáforo de bandas, dirección de mejora y formato de series.
 *
 * Regla de color: verde / ámbar / rojo están RESERVADOS para el semáforo de
 * bandas. Las categorías usan cuatro matices distintos (teal / azul / violeta /
 * magenta) para que un chip rojo nunca se confunda con una alerta roja.
 * El set de categorías pasa las seis comprobaciones de contraste y daltonismo
 * en tema claro y oscuro; el par anterior (violeta #a855f7 / azul #3b82f6) daba
 * ΔE 0,9 con deuteranopía, por debajo del mínimo de 8.
 */
import type { MetricBand, MetricThreshold } from './performanceQueries';

/**
 * Lo mínimo que un componente de presentación necesita saber de una métrica.
 * Lo satisfacen tanto `SportMetricDefinition` (ruta school) como
 * `AthleteEvolutionMetric` (ruta athlete), así que las vistas de coach y de
 * padre comparten los mismos componentes.
 */
export interface DisplayMetric {
  metric_key: string;
  display_name: string;
  parent_label?: string | null;
  parent_hint?: string | null;
  unit?: string | null;
  category?: string | null;
  higher_is_better: boolean;
  thresholds?: MetricThreshold[];
}

// Nota: no hay helper para elegir entre display_name y parent_label. La
// resolución vive en el BFF, por ruta: /athlete/performance/evolution ya
// devuelve el rótulo de familia en display_name, y /school/performance/*
// devuelve el nombre técnico (el coach lo necesita preciso). Cada vista recibe
// el nombre que le corresponde sin decidir nada.

// ─── Categorías ───────────────────────────────────────────────────────

export interface CategoryStyle {
  /** Chip sin seleccionar: teñido, para poder escanear la lista. */
  idle: string;
  /** Chip seleccionado: relleno sólido. */
  active: string;
  /** Cuadrito de la cabecera del grupo. */
  swatch: string;
  label: string;
}

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  physical: {
    idle:   'text-teal-600 dark:text-teal-400 border-teal-600/40 hover:bg-teal-600/10',
    active: 'text-white bg-teal-600 border-teal-600',
    swatch: 'bg-teal-600',
    label:  'Físico',
  },
  technical: {
    idle:   'text-blue-600 dark:text-blue-400 border-blue-500/40 hover:bg-blue-500/10',
    active: 'text-white bg-blue-500 border-blue-500',
    swatch: 'bg-blue-500',
    label:  'Técnico',
  },
  tactical: {
    idle:   'text-violet-600 dark:text-violet-400 border-violet-500/40 hover:bg-violet-500/10',
    active: 'text-white bg-violet-500 border-violet-500',
    swatch: 'bg-violet-500',
    label:  'Táctico',
  },
  attendance: {
    idle:   'text-pink-600 dark:text-pink-400 border-pink-600/40 hover:bg-pink-600/10',
    active: 'text-white bg-pink-600 border-pink-600',
    swatch: 'bg-pink-600',
    label:  'Asistencia',
  },
  other: {
    idle:   'text-muted-foreground border-border hover:bg-muted/40',
    active: 'text-foreground bg-muted border-border',
    swatch: 'bg-muted-foreground',
    label:  'Otras',
  },
};

export function categoryStyle(category?: string | null): CategoryStyle {
  return CATEGORY_STYLE[category ?? ''] ?? CATEGORY_STYLE.other;
}

/** Orden fijo de categorías. Nunca se cicla ni se genera un matiz nuevo. */
export const CATEGORY_ORDER = ['physical', 'technical', 'tactical', 'attendance', 'other'] as const;

// ─── Semáforo de bandas ───────────────────────────────────────────────

export interface BandStyle {
  label: string;
  dot: string;
  chip: string;
  /** Para marcas SVG / Recharts, donde no aplican las clases de Tailwind. */
  hex: string;
  fill: string;
}

export const BAND_STYLE: Record<NonNullable<MetricBand>, BandStyle> = {
  green:  { label: 'Óptimo',     dot: 'bg-green-500', chip: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/25', hex: '#22c55e', fill: 'rgba(34,197,94,0.10)' },
  yellow: { label: 'En proceso', dot: 'bg-amber-500', chip: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25', hex: '#f59e0b', fill: 'rgba(245,158,11,0.10)' },
  red:    { label: 'Por debajo', dot: 'bg-red-500',   chip: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25',         hex: '#ef4444', fill: 'rgba(239,68,68,0.10)' },
};

/**
 * El BFF devuelve los umbrales sin ORDER BY, así que los ordenamos aquí para
 * que la banda asignada no dependa del orden en que llegó la fila.
 */
export function sortedThresholds(thresholds?: MetricThreshold[]): MetricThreshold[] {
  if (!thresholds) return [];
  return [...thresholds].sort((a, b) => {
    const am = a.min_value ?? Number.NEGATIVE_INFINITY;
    const bm = b.min_value ?? Number.NEGATIVE_INFINITY;
    return am - bm;
  });
}

export interface BandRange {
  band: NonNullable<MetricBand>;
  from: number;
  to: number;
  /** Texto del rango, p. ej. «≥ 48» o «40–47». */
  caption: string;
}

/**
 * Convierte los umbrales en rangos cerrados dentro de [domainMin, domainMax],
 * listos para pintarse como franjas de fondo.
 */
export function bandRanges(
  thresholds: MetricThreshold[] | undefined,
  domainMin: number,
  domainMax: number
): BandRange[] {
  return sortedThresholds(thresholds)
    .filter((t) => t.band === 'green' || t.band === 'yellow' || t.band === 'red')
    .map((t) => {
      const from = t.min_value ?? domainMin;
      const to = t.max_value ?? domainMax;
      let caption: string;
      if (t.min_value !== null && t.max_value !== null) caption = `${fmt(t.min_value)}–${fmt(t.max_value)}`;
      else if (t.min_value !== null) caption = `≥ ${fmt(t.min_value)}`;
      else if (t.max_value !== null) caption = `≤ ${fmt(t.max_value)}`;
      else caption = '';
      return {
        band: t.band as NonNullable<MetricBand>,
        from: Math.max(from, domainMin),
        to: Math.min(to, domainMax),
        caption,
      };
    })
    .filter((r) => r.to > r.from);
}

// ─── Dirección de mejora ──────────────────────────────────────────────

export interface MetricDelta {
  /** último − anterior, en la unidad de la métrica. */
  raw: number;
  /** Variación porcentual sobre el valor anterior; null si el anterior es 0. */
  pct: number | null;
  /** true = mejoró, false = empeoró, null = sin cambio. Respeta higher_is_better. */
  improved: boolean | null;
  /** Texto con signo aritmético, p. ej. «+3» o «−0,2». */
  label: string;
}

/**
 * Compara dos valores respetando la dirección de la métrica.
 *
 * En Velocidad T (higher_is_better = false) pasar de 10,5 s a 10,3 s da
 * raw = −0,2 pero improved = true: el signo aritmético y la mejora no coinciden.
 */
export function computeDelta(
  current: number,
  previous: number,
  higherIsBetter = true
): MetricDelta {
  const raw = current - previous;
  const pct = previous !== 0 ? (raw / Math.abs(previous)) * 100 : null;
  const improved = raw === 0 ? null : higherIsBetter ? raw > 0 : raw < 0;
  const sign = raw > 0 ? '+' : raw < 0 ? '−' : '';
  return { raw, pct, improved, label: `${sign}${fmt(Math.abs(raw))}` };
}

/** Clase de color de un delta: verde si mejoró, rojo si empeoró, neutro si igual. */
export function deltaTone(improved: boolean | null): string {
  if (improved === null) return 'text-muted-foreground';
  return improved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}

/** Trazo de la línea en las miniaturas: sigue la mejora, no el sentido del eje. */
export function trendStroke(improved: boolean | null): string {
  if (improved === null) return '#f59e0b';
  return improved ? '#22c55e' : '#ef4444';
}

// ─── Formato ──────────────────────────────────────────────────────────

/** Número en formato local, sin decimales de relleno. */
export function fmt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value);
}

export function fmtWithUnit(value: number, unit?: string | null): string {
  return unit ? `${fmt(value)} ${unit}` : fmt(value);
}

export interface SeriesPoint {
  date: string;
  value: number;
  notes?: string | null;
}

export interface ChartPoint {
  label: string;
  value: number;
  date: string;
  band: MetricBand;
  notes?: string | null;
}

/**
 * Etiquetas del eje X sin colisiones.
 *
 * Dos mediciones del mismo día colapsaban en la misma etiqueta («30 jul → 30
 * jul») y producían una línea plana sin sentido. Cuando una fecha se repite,
 * se le añade la hora.
 */
export function buildChartPoints(
  series: SeriesPoint[],
  resolveBand: (value: number) => MetricBand
): ChartPoint[] {
  const ordered = [...series].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  const seen = new Map<string, number>();
  for (const p of ordered) {
    const d = dayLabel(p.date);
    seen.set(d, (seen.get(d) ?? 0) + 1);
  }

  return ordered.map((p) => {
    const day = dayLabel(p.date);
    const collides = (seen.get(day) ?? 0) > 1;
    const label = collides
      ? `${day} ${new Date(p.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
      : day;
    return { label, value: p.value, date: p.date, band: resolveBand(p.value), notes: p.notes };
  });
}

// ─── Destacados para la vista del padre ───────────────────────────────────

/**
 * Rango de la escala de una métrica, para poder comparar mejoras entre
 * métricas que se miden en unidades distintas.
 *
 * Cadena de respaldo, porque el catálogo real no siempre tiene los dos
 * extremos: los `rating` sí (0-6 o 0-10) y los porcentajes también, pero las
 * medidas en cm, las repeticiones y el test de Léger tienen `max_value` NULL.
 */
function metricRange(metric: DisplayMetric): number | null {
  const t = sortedThresholds(metric.thresholds);
  const mins = t.map((x) => x.min_value).filter((v): v is number => v !== null);
  const maxs = t.map((x) => x.max_value).filter((v): v is number => v !== null);

  if (t.length > 0 && mins.length > 0 && maxs.length > 0) {
    const span = Math.max(...maxs) - Math.min(...mins);
    if (span > 0) return span;
  }
  return null;
}

export interface MetricHighlight {
  metric: DisplayMetric;
  series: SeriesPoint[];
  current: number;
  delta: MetricDelta;
  band: MetricBand;
  /** Fracción de mejora, comparable entre métricas. Positivo = mejoró. */
  score: number;
}

/**
 * Cuánto mejoró, en una escala comparable entre métricas distintas.
 *
 * El signo se corrige con `higher_is_better`, así que positivo siempre
 * significa «mejoró»: en Velocidad T bajar de 10,5 s a 10,3 s da score > 0.
 *
 * Si se conoce el rango de la escala, la mejora se expresa como fracción de
 * ese rango — es lo más justo entre unidades distintas. Si no (medidas en cm
 * sin techo definido), cae a variación relativa sobre el valor anterior.
 */
function improvementScore(metric: DisplayMetric, series: SeriesPoint[]): number | null {
  if (series.length < 2) return null;
  const current = series[series.length - 1].value;
  const previous = series[series.length - 2].value;

  const raw = current - previous;
  const signed = metric.higher_is_better ? raw : -raw;
  if (signed === 0) return 0;

  const range = metricRange(metric);
  if (range) return signed / range;
  if (previous !== 0) return signed / Math.abs(previous);
  return null;
}

function buildHighlight(
  metric: DisplayMetric,
  series: SeriesPoint[],
  resolveBand: (value: number, metric: DisplayMetric) => MetricBand
): MetricHighlight | null {
  const score = improvementScore(metric, series);
  if (score === null) return null;
  const current = series[series.length - 1].value;
  return {
    metric,
    series,
    current,
    delta: computeDelta(current, series[series.length - 2].value, metric.higher_is_better),
    band: resolveBand(current, metric),
    score,
  };
}

/**
 * Lo que más mejoró: el mejor de cada categoría, no los tres mejores en
 * absoluto.
 *
 * Comparar entre categorías es lo que menos se sostiene —dentro de `tactical`
 * y `technical` todo va en escala 0-6, pero `physical` mezcla centímetros,
 * repeticiones y segundos—, y además un padre saca más de ver un avance en
 * cada frente que tres notas técnicas seguidas.
 */
export function pickHighlights(
  metrics: DisplayMetric[],
  evolution: Record<string, SeriesPoint[]>,
  resolveBand: (value: number, metric: DisplayMetric) => MetricBand
): MetricHighlight[] {
  const best = new Map<string, MetricHighlight>();

  for (const metric of metrics) {
    const series = evolution[metric.metric_key];
    if (!series?.length) continue;
    const h = buildHighlight(metric, series, resolveBand);
    if (!h || h.score <= 0) continue;

    const category = metric.category ?? 'other';
    const previous = best.get(category);
    if (!previous || h.score > previous.score) best.set(category, h);
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}

/**
 * En qué se va a trabajar: lo que está en banda roja o ámbar, peor primero.
 * Sin bandas configuradas no aparece nada — es preferible a inventar un
 * veredicto.
 */
export function pickToWorkOn(
  metrics: DisplayMetric[],
  evolution: Record<string, SeriesPoint[]>,
  resolveBand: (value: number, metric: DisplayMetric) => MetricBand,
  limit = 3
): MetricHighlight[] {
  const rank: Record<string, number> = { red: 0, yellow: 1 };
  const out: MetricHighlight[] = [];

  for (const metric of metrics) {
    const series = evolution[metric.metric_key];
    if (!series?.length) continue;
    const current = series[series.length - 1].value;
    const band = resolveBand(current, metric);
    if (band !== 'red' && band !== 'yellow') continue;

    out.push({
      metric,
      series,
      current,
      band,
      delta:
        series.length >= 2
          ? computeDelta(current, series[series.length - 2].value, metric.higher_is_better)
          : { raw: 0, pct: null, improved: null, label: '—' },
      score: improvementScore(metric, series) ?? 0,
    });
  }

  return out
    .sort((a, b) => rank[a.band as string] - rank[b.band as string] || a.score - b.score)
    .slice(0, limit);
}

/** Dominio del eje Y que cubre datos y umbrales, con un margen del 8%. */
export function yDomain(values: number[], thresholds?: MetricThreshold[]): [number, number] {
  const bounds = sortedThresholds(thresholds)
    .flatMap((t) => [t.min_value, t.max_value])
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const all = [...values, ...bounds];
  if (all.length === 0) return [0, 1];

  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.08 || Math.abs(max) * 0.1 || 1;
  return [min - pad, max + pad];
}
