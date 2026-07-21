import { bffClient } from '@/lib/api/bffClient';

export type MatchFormat = 'bo3' | 'bo5' | 'libre';
export type ResultType = 'preparatorio' | 'competencia_oficial';
export type MatchResult = 'win' | 'loss' | 'draw' | null;

export interface SetScore {
  set_number: number;
  team_score: number;
  opponent_score: number;
}

export interface CompetitionResultData {
  sets: SetScore[];
  sets_won_team: number;
  sets_won_opponent: number;
  match_result: MatchResult;
  match_format: MatchFormat;
  warnings: string[];
}

export interface CompetitionResult {
  id: string;
  team_id: string;
  opponent: string;
  competition_date: string;
  result_type: ResultType;
  competition_name: string | null;
  result_data: CompetitionResultData;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface NewCompetitionResult {
  team_id: string;
  opponent: string;
  competition_date: string;
  result_type: ResultType;
  match_format: MatchFormat;
  competition_name?: string;
  sets?: SetScore[]; // vacío/omitido = partido "programado", se completa después
  notes?: string;
  force?: boolean; // reenvío tras confirmar un marcador atípico
}

export interface ApiConfirmationError {
  error: string;
  details: string[];
  requires_confirmation: boolean;
}

export async function getCompetitionResults(filters: {
  team_id?: string;
  result_type?: ResultType;
  from_date?: string;
  to_date?: string;
}): Promise<CompetitionResult[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return bffClient.get<CompetitionResult[]>(`/api/v1/school/competition-results?${params}`);
}

export async function createCompetitionResult(input: NewCompetitionResult): Promise<CompetitionResult> {
  return bffClient.post('/api/v1/school/competition-results', input);
}

export async function updateCompetitionResult(
  id: string,
  updates: Partial<NewCompetitionResult>
): Promise<CompetitionResult> {
  return bffClient.put(`/api/v1/school/competition-results/${id}`, updates);
}

export async function deleteCompetitionResult(id: string): Promise<void> {
  await bffClient.delete(`/api/v1/school/competition-results/${id}`);
}
