/**
 * Performance Module — BFF Queries
 *
 * Centraliza las llamadas al BFF para el catálogo de métricas por deporte
 * y el registro/consulta de performance_entries.
 */
import { bffClient } from '@/lib/api/bffClient';

export type MetricDataType = 'numeric' | 'duration' | 'count' | 'rating';
export type MetricCategory = 'physical' | 'technical' | 'tactical' | 'attendance';
export type MetricBand = 'green' | 'yellow' | 'red' | null;

export interface MetricThreshold {
  band: 'green' | 'yellow' | 'red';
  min_value: number | null;
  max_value: number | null;
}

export interface SportMetricDefinition {
  id: string;
  metric_key: string;
  display_name: string;
  /** Nombre en idioma de familia. NULL = usar display_name. */
  parent_label?: string | null;
  /** Qué mide y por qué importa, para el padre. */
  parent_hint?: string | null;
  data_type: MetricDataType;
  unit: string | null;
  category: MetricCategory | null;
  subcategory: string | null;
  min_value: number | null;
  max_value: number | null;
  higher_is_better: boolean;
  is_active: boolean;
  thresholds?: MetricThreshold[];
}

/**
 * Calcula la banda (verde/amarillo/rojo) de un valor según los umbrales
 * de su métrica. Vive en el cliente para dar feedback en vivo mientras
 * el coach escribe, sin esperar a guardar.
 */
export function computeMetricBand(value: number | '' | undefined, thresholds?: MetricThreshold[]): MetricBand {
  if (value === '' || value === undefined || value === null) return null;
  if (!thresholds || thresholds.length === 0) return null;
  const num = Number(value);
  for (const t of thresholds) {
    const aboveMin = t.min_value === null || num >= t.min_value;
    const belowMax = t.max_value === null || num <= t.max_value;
    if (aboveMin && belowMax) return t.band;
  }
  return null;
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

export async function postPerformanceEntries(entries: NewPerformanceEntry[], teamId?: string): Promise<PerformanceEntry[]> {
  return bffClient.post('/api/v1/school/performance/entries', { entries, team_id: teamId });
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
  latest_values: Record<string, { value: number; recorded_at: string; band?: MetricBand }>;
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
  /** Ya viene resuelto por el BFF: parent_label si existe, si no display_name. */
  display_name: string;
  parent_hint?: string | null;
  unit: string;
  category: string;
  min_value: number | null;
  max_value: number | null;
  higher_is_better: boolean;
  thresholds: MetricThreshold[];
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
