// Progresión por puntaje y días permitidos por plan (F-F,
// docs/specs/dreamers-niveles-por-horas-y-progresion.md D3/D4/D9/D15).
// Toda la lógica de elegibilidad vive en el servidor (RPC
// get_level_promotion_eligibility); acá solo hay llamadas y formato.
import { bffClient } from '@/lib/api/bffClient';

export const COMPETITION_LEVELS = ['club', 'regional', 'nacional', 'federacion'] as const;
export type CompetitionLevel = typeof COMPETITION_LEVELS[number];

export const COMPETITION_LEVEL_LABEL: Record<CompetitionLevel, string> = {
  club: 'Club',
  regional: 'Regional',
  nacional: 'Nacional',
  federacion: 'Federación',
};

/** 0 = domingo … 6 = sábado (igual que Date.getDay() y la columna allowed_days_of_week). */
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Día de la semana de 'YYYY-MM-DD' sin zona horaria. */
export function weekdayOfDateString(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isDayAllowed(allowedDays: number[] | null | undefined, date: string): boolean {
  if (!allowedDays || allowedDays.length === 0) return true;
  return allowedDays.includes(weekdayOfDateString(date));
}

export function describeAllowedDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_LONG[d]).join(', ');
}

/** Mensaje para un 422 day_not_allowed del BFF, o null si el error es otro. */
export function dayNotAllowedMessage(err: any): string | null {
  const data = err?.data ?? err?.body ?? null;
  if (err?.status !== 422 || data?.reason !== 'day_not_allowed') return null;
  const days: number[] = Array.isArray(data.allowed_days) ? data.allowed_days : [];
  return days.length
    ? `Tu plan solo permite reservar los días: ${describeAllowedDays(days)}.`
    : 'Tu plan no permite reservar ese día.';
}

export type SubjectType = 'child' | 'profile' | 'unregistered';

export interface ProgressionAthlete {
  subject_type: SubjectType;
  subject_id: string;
  full_name: string;
  enrollment_id: string;
  plan_name: string | null;
}

export interface EligibilityRow {
  enrollment_id: string;
  subject_type: SubjectType;
  subject_id: string;
  athlete_name: string | null;
  current_plan_id: string;
  current_plan_name: string | null;
  current_threshold: number | null;
  best_result_id: string;
  best_points: number;
  best_level: CompetitionLevel | null;
  best_competition_date: string;
  suggested_plan_id: string | null;
  suggested_plan_name: string | null;
  suggested_threshold: number | null;
  suggested_min_level: CompetitionLevel | null;
  suggested_fee: number | null;
  qualifying_result_id: string | null;
  qualifying_points: number | null;
}

export interface NewIndividualResult {
  subject_type: SubjectType;
  subject_id: string;
  competition_date: string;
  points: number;
  competition_level?: CompetitionLevel | null;
  result_type?: 'preparatorio' | 'competencia_oficial';
  competition_name?: string;
  notes?: string;
}

export async function getLevelProgressionSettings(): Promise<{ level_progression_enabled: boolean }> {
  return bffClient.get('/api/v1/school/level-progression/settings');
}

export async function setLevelProgressionEnabled(enabled: boolean): Promise<{ level_progression_enabled: boolean }> {
  return bffClient.put('/api/v1/school/level-progression/settings', { level_progression_enabled: enabled });
}

export async function getProgressionAthletes(): Promise<ProgressionAthlete[]> {
  return bffClient.get('/api/v1/school/level-progression/athletes');
}

export async function getEligibility(season: number): Promise<{ season: number; rows: EligibilityRow[] }> {
  return bffClient.get(`/api/v1/school/level-progression/eligibility?season=${season}`);
}

export async function createIndividualResult(input: NewIndividualResult): Promise<any> {
  return bffClient.post('/api/v1/school/competition-results/individual', input);
}
