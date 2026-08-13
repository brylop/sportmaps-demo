/**
 * Athlete Reports (Informe Mensual del Atleta) — Vista del padre.
 *
 * A diferencia de performanceQueries.ts, esto NO pasa por el BFF: RLS ya
 * permite a la familia leer sus propios informes publicados
 * (athlete_reports_select_family) y mark_report_viewed ya tiene
 * GRANT EXECUTE TO authenticated -- ambos self-autorizan por auth.uid(),
 * así que el patrón "frontend lee DB directo" aplica tal cual.
 */
import { supabase } from '@/integrations/supabase/client';
import type { MetricBand, MetricThreshold } from './performanceQueries';

export type SubjectType = 'profile' | 'child' | 'unregistered';
export type ReportStatus = 'borrador' | 'listo' | 'publicado' | 'retenido' | 'omitido';

export interface SnapshotMetric {
  metric_key: string;
  label: string;
  hint: string | null;
  category: string | null;
  unit: string | null;
  higher_is_better: boolean;
  value: number;
  previous: number | null;
  delta: number | null;
  score: number | null;
  band: MetricBand;
  measured_at: string;
}

export interface FootballSummary {
  matches_played: number;
  minutes_played: number;
  goals: number;
  own_goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

export interface ReportSnapshot {
  version: 1;
  generated_at: string;
  period: { year: number; month: number; label: string };
  athlete: { name: string; subject_type: SubjectType; subject_id: string };
  school: { id: string; name: string };
  teams: { id: string; name: string }[];
  governing_team: { id: string; name: string } | null;
  team_notes: { team_id: string; team_name: string; body: string }[];
  coach_note: string | null;
  attendance: { present: number; total: number; pct: number | null };
  highlights: SnapshotMetric[];
  to_work_on: SnapshotMetric[];
  metrics: SnapshotMetric[];
  football: FootballSummary | null;
}

export interface AthleteReportListItem {
  id: string;
  period_year: number;
  period_month: number;
  status: ReportStatus;
  published_at: string | null;
  viewed_at: string | null;
}

export interface AthleteReportDetail extends AthleteReportListItem {
  snapshot: ReportSnapshot;
}

/** Solo informes YA publicados -- RLS filtra igual, pero se acota acá para no confiar solo en RLS. */
export async function getAthleteReports(
  subjectType: SubjectType,
  subjectId: string
): Promise<AthleteReportListItem[]> {
  // 'as any': athlete_reports todavía no está en el types.ts generado
  // (mismo patrón que 'school_athletes' en performance.ts del BFF).
  const { data, error } = await supabase
    .from('athlete_reports' as any)
    .select('id, period_year, period_month, status, published_at, viewed_at')
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .eq('status', 'publicado')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  if (error) throw error;
  return (data as unknown as AthleteReportListItem[]) ?? [];
}

export async function getAthleteReportDetail(id: string): Promise<AthleteReportDetail> {
  const { data, error } = await supabase
    .from('athlete_reports' as any)
    .select('id, period_year, period_month, status, published_at, viewed_at, snapshot')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as AthleteReportDetail;
}

export async function markReportViewed(id: string): Promise<void> {
  // 'as never': mark_report_viewed tampoco está en el types.ts generado
  // todavía (mismo escape hatch que useEquipment.ts ya usa para RPCs nuevas).
  const { error } = await supabase.rpc('mark_report_viewed' as never, { p_report_id: id } as never);
  // No es bloqueante: si falla el marcado de "visto" no tiene sentido tumbar
  // la lectura del informe que el padre ya está viendo.
  if (error) console.error('mark_report_viewed falló:', error);
}

export type { MetricThreshold };
