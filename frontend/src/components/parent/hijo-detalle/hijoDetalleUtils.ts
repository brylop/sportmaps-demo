/**
 * Pantallas internas de un hijo (acudiente V2): progreso, asistencia,
 * informes, partidos e informe del equipo. Funciones puras de presentación:
 * sin React ni Supabase, se prueban solas.
 *
 * Las fechas y nombres se reutilizan de `parent/v2/hijos/hijosUtils` para que
 * la pestaña Hijos y estas pantallas digan lo mismo con las mismas palabras.
 */
import { MESES, cameToTraining, capitalize, etiquetaLegible, formatLongDate } from '@/components/parent/v2/hijos/hijosUtils';

// ─── Asistencia ────────────────────────────────────────────────────────────

export type AttendanceLabel = 'Vino' | 'Llegó tarde' | 'No vino' | 'Con excusa';

/** Estado crudo de attendance_records → palabra V2. Lo desconocido no se inventa: «No vino». */
export function attendanceLabel(status: string): AttendanceLabel {
  if (status === 'present') return 'Vino';
  if (status === 'late') return 'Llegó tarde';
  if (status === 'excused') return 'Con excusa';
  return 'No vino';
}

export interface AttendanceTotals {
  total: number;
  came: number;
  late: number;
  absent: number;
  excused: number;
  /** Presente + tarde sobre el total, igual que GET /attendance/rate del BFF. */
  pct: number;
}

export function attendanceTotals(records: { status: string }[] | null | undefined): AttendanceTotals {
  const list = records ?? [];
  const came = list.filter((r) => cameToTraining(r.status)).length;
  return {
    total: list.length,
    came,
    late: list.filter((r) => r.status === 'late').length,
    absent: list.filter((r) => !cameToTraining(r.status) && r.status !== 'excused').length,
    excused: list.filter((r) => r.status === 'excused').length,
    pct: list.length ? Math.round((came / list.length) * 100) : 0,
  };
}

export interface MonthGroup<T> {
  key: string;
  /** «Octubre 2026». */
  label: string;
  items: T[];
}

/** Agrupa por mes (más reciente primero) conservando el orden de entrada dentro del mes. */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>();
  const sorted = [...items].sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : 0));
  for (const item of sorted) {
    const key = dateOf(item).slice(0, 7);
    const [y, m] = key.split('-').map(Number);
    if (!groups.has(key)) {
      groups.set(key, { key, label: `${capitalize(MESES[(m || 1) - 1] ?? '')} ${y}`, items: [] });
    }
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}

// ─── Informes ──────────────────────────────────────────────────────────────

/** «Informe de septiembre 2026». */
export function reportTitle(month: number, year: number): string {
  return `Informe de ${MESES[month - 1] ?? ''} ${year}`.replace(/\s+/g, ' ').trim();
}

/** «+0,5 kg» / «−3 s»; null si no hay variación que mostrar. */
export function deltaText(delta: number | null | undefined, unit?: string | null): string | null {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  const r = Math.round(delta * 10) / 10;
  if (r === 0) return null;
  const n = Math.abs(r).toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return `${r > 0 ? '+' : '−'}${n}${unit ? ` ${unit}` : ''}`;
}

/** true = para bien (respeta «menos es mejor»), false = para mal, null = sin cambio. */
export function deltaIsGood(delta: number | null | undefined, higherIsBetter: boolean): boolean | null {
  if (delta === null || delta === undefined || Math.round(delta * 10) === 0) return null;
  return higherIsBetter ? delta > 0 : delta < 0;
}

/** Nombre visible de una medición del informe: nunca la clave técnica. */
export function metricLabel(label: string | null | undefined, key?: string | null): string {
  return etiquetaLegible(label, key);
}

// ─── Partidos ──────────────────────────────────────────────────────────────

export interface MatchLike {
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
}

export type MatchOutcome = 'Ganó' | 'Empató' | 'Perdió' | null;

/** Marcador desde el lado del equipo del hijo: «3 - 1», o null si no se cargó. */
export function matchScore(m: MatchLike): { ours: number; theirs: number; text: string; outcome: MatchOutcome } | null {
  if (m.home_score == null || m.away_score == null) return null;
  const ours = m.is_home ? m.home_score : m.away_score;
  const theirs = m.is_home ? m.away_score : m.home_score;
  const outcome: MatchOutcome = ours > theirs ? 'Ganó' : ours < theirs ? 'Perdió' : 'Empató';
  return { ours, theirs, text: `${ours} - ${theirs}`, outcome };
}

/** «Sábado 4 de octubre de 2026» (sin correrse de día con fechas sin hora). */
export function longDateWithYear(value: string): string {
  const base = formatLongDate(value);
  const year = value.slice(0, 4);
  return /^\d{4}$/.test(year) && base !== value ? `${base} de ${year}` : base;
}

// ─── Informe del equipo (post-entreno) ─────────────────────────────────────

/** Títulos V2 de las preguntas del post-entreno (nunca «BORG» ni «RPE»). */
export const POST_TRAINING_SECTIONS: { key: string; title: string; metricKeys: string[] }[] = [
  { key: 'rpe_borg', title: '¿Qué tan duro fue?', metricKeys: ['rpe_borg'] },
  { key: 'task_comprehension', title: '¿Entendieron los ejercicios?', metricKeys: ['task_comprehension'] },
  { key: 'self_effort_pct', title: '¿Cuánto se esforzaron?', metricKeys: ['self_effort_pct'] },
  { key: 'satisfaction', title: '¿Cómo se sintieron al terminar?', metricKeys: ['satisfaction'] },
  { key: 'focus', title: 'Qué quieren mejorar', metricKeys: [] }, // focus_*: se completa con lo que llegue
];

/** «1 deportista respondió» / «12 deportistas respondieron». */
export function respondieron(n: number): string {
  return n === 1 ? '1 deportista respondió' : `${n} deportistas respondieron`;
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
