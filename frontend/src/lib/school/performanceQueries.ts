/**
 * Performance Module — BFF Queries
 *
 * Centraliza las llamadas al BFF para el catálogo de métricas por deporte
 * y el registro/consulta de performance_entries.
 */
import { bffClient } from '@/lib/api/bffClient';

export type MetricDataType = 'numeric' | 'duration' | 'count' | 'rating';
export type MetricCategory = 'physical' | 'technical' | 'tactical' | 'attendance';

export interface SportMetricDefinition {
  id: string;
  metric_key: string;
  display_name: string;
  data_type: MetricDataType;
  unit: string | null;
  category: MetricCategory | null;
  is_active: boolean;
}

export interface SchoolMetricsResponse {
  sport_category_id: string | null;
  metrics: SportMetricDefinition[];
  message?: string;
}

export interface PerformanceEntry {
  id: string;
  subject_type: 'profile' | 'child' | 'unregistered';
  subject_id: string;
  metric_key: string;
  value: number;
  context_type: 'manual' | 'competition' | 'evaluation' | 'session';
  context_id: string | null;
  recorded_by: string;
  recorded_at: string;
  notes: string | null;
}

export interface NewPerformanceEntry {
  subject_type: 'profile' | 'child' | 'unregistered';
  subject_id: string;
  metric_key: string;
  value: number;
  context_type?: PerformanceEntry['context_type'];
  context_id?: string;
  recorded_at?: string;
  notes?: string;
}

// ─── Escuela / Coach ──────────────────────────────────────────────────

export async function getSchoolPerformanceMetrics(): Promise<SchoolMetricsResponse> {
  return bffClient.get<SchoolMetricsResponse>('/api/v1/school/performance/metrics');
}

export async function getSchoolPerformanceEntries(filters: {
  subject_type?: string;
  subject_id?: string;
  metric_key?: string;
  from_date?: string;
  to_date?: string;
}): Promise<PerformanceEntry[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return bffClient.get<PerformanceEntry[]>(`/api/v1/school/performance/entries?${params}`);
}

export async function postPerformanceEntries(entries: NewPerformanceEntry[]): Promise<PerformanceEntry[]> {
  return bffClient.post('/api/v1/school/performance/entries', { entries });
}

export async function updatePerformanceEntry(
  id: string,
  updates: { value?: number; notes?: string; recorded_at?: string }
): Promise<PerformanceEntry> {
  return bffClient.put(`/api/v1/school/performance/entries/${id}`, updates);
}

export async function deletePerformanceEntry(id: string): Promise<void> {
  await bffClient.delete(`/api/v1/school/performance/entries/${id}`);
}

export interface SubjectEvolutionResponse {
  evolution: Record<string, { date: string; value: number; notes: string | null }[]>;
  period_days: number;
}

export async function getSubjectPerformanceEvolution(
  subjectType: string,
  subjectId: string,
  days = 365
): Promise<SubjectEvolutionResponse> {
  return bffClient.get<SubjectEvolutionResponse>(
    `/api/v1/school/performance/subjects/${subjectType}/${subjectId}/evolution?days=${days}`
  );
}

export interface RosterSubject {
  subject_type: 'profile' | 'child' | 'unregistered';
  subject_id: string;
  full_name: string;
}

export interface TeamPerformanceRoster {
  sport_category_id: string | null;
  metrics: SportMetricDefinition[];
  subjects: RosterSubject[];
  latest_values: Record<string, { value: number; recorded_at: string }>;
  message?: string;
}

export async function getTeamPerformanceRoster(params: {
  team_id?: string;
  offering_plan_id?: string;
}): Promise<TeamPerformanceRoster> {
  const query = new URLSearchParams();
  if (params.team_id) query.set('team_id', params.team_id);
  if (params.offering_plan_id) query.set('offering_plan_id', params.offering_plan_id);
  return bffClient.get<TeamPerformanceRoster>(`/api/v1/school/performance/roster?${query}`);
}

// ─── Atleta / Padre ───────────────────────────────────────────────────

export async function getAthletePerformanceEntries(childId?: string): Promise<PerformanceEntry[]> {
  const q = childId ? `?child_id=${childId}` : '';
  return bffClient.get<PerformanceEntry[]>(`/api/v1/athlete/performance/entries${q}`);
}

export interface AthleteEvolutionMetric {
  metric_key: string;
  display_name: string;
  unit: string;
  category: string;
}

export interface AthleteEvolutionResponse {
  evolution: Record<string, { date: string; value: number }[]>;
  metrics: AthleteEvolutionMetric[];
  period_days: number;
}

export async function getAthletePerformanceEvolution(
  childId?: string,
  days = 365
): Promise<AthleteEvolutionResponse> {
  const params = new URLSearchParams({ days: String(days) });
  if (childId) params.set('child_id', childId);
  return bffClient.get<AthleteEvolutionResponse>(`/api/v1/athlete/performance/evolution?${params}`);
}
