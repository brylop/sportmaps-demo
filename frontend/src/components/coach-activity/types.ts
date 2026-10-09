/**
 * Respuesta de GET /api/v1/school/coach-activity (BFF:
 * bff/src/routes/school/coach-activity.aggregate.ts). Copia a mano de los
 * tipos del BFF: si cambian allá, cambiarlos acá.
 */
import { bffClient } from '@/lib/api/bffClient';

export type CoachStatus = 'verde' | 'ambar' | 'rojo';

export interface CoachTeamRef { id: string; name: string; role: 'titular' | 'adicional' }
export interface CoachWeekPoint { week: string; planned: number; lists: number; evaluations: number }
export interface CoachSessionItem {
  id: string; team_id: string; team_name: string; session_date: string;
  objective: string; blocks: number; in_mesocycle: boolean;
  created_by_name: string | null; created_by_coach: boolean;
}
export interface CoachAttendanceItem {
  id: string; team_id: string | null; team_name: string; session_date: string;
  present: number; total: number; finalized: boolean;
}
export interface CoachEvaluationDay { date: string; entries: number; athletes: number }
export interface CoachMesocycle {
  id: string; team_id: string; team_name: string; starts_on: string; ends_on: string;
  general_objective: string | null;
  planned_total: number; planned_to_date: number; done_to_date: number;
  adherence_pct: number | null;
}
export interface CoachActivity {
  staff_id: string;
  full_name: string;
  has_account: boolean;
  teams: CoachTeamRef[];
  last_activity_at: string | null;
  status: CoachStatus;
  sessions_planned_week: number;
  sessions_created_by_coach_week: number;
  attendance_sessions_week: number;
  days_with_list: number;
  evaluations_week: { entries: number; athletes: number };
  mesocycle_evaluations_week: number;
  mesocycles: CoachMesocycle[];
  weekly: CoachWeekPoint[];
  sessions: CoachSessionItem[];
  attendance: CoachAttendanceItem[];
  evaluations_by_day: CoachEvaluationDay[];
}
export interface CoachActivityResponse {
  week: string;
  week_end: string;
  weeks: string[];
  coaches: CoachActivity[];
  totals: {
    coaches: number; verde: number; ambar: number; rojo: number;
    sessions_planned: number; attendance_sessions: number; evaluations: number;
  };
}

export function getCoachActivity(week: string): Promise<CoachActivityResponse> {
  return bffClient.get<CoachActivityResponse>(`/api/v1/school/coach-activity?week=${encodeURIComponent(week)}`);
}

/** Semáforo en palabras (nunca solo color). */
export const STATUS_META: Record<CoachStatus, { label: string; hint: string; className: string; dot: string }> = {
  verde: {
    label: 'Al día',
    hint: 'Planificó y tomó lista',
    className: 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400',
    dot: 'bg-green-500',
  },
  ambar: {
    label: 'Le falta algo',
    hint: 'Planificó o tomó lista, no las dos',
    className: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  rojo: {
    label: 'Sin actividad',
    hint: 'Ni sesiones ni listas esta semana',
    className: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400',
    dot: 'bg-red-500',
  },
};

/** Colores fijos de la gráfica: misma serie = mismo color en toda la página. */
export const SERIES_COLORS = {
  planned: '#2563eb', // azul: sesiones planificadas
  lists: '#0d9488',   // verde azulado: listas tomadas
} as const;
