/**
 * Football Module — BFF Queries
 *
 * Centraliza las llamadas al BFF para alineaciones, eventos de partido y
 * acumulados de temporada de fútbol (Fase 2 del módulo de rendimiento de
 * fútbol -- ver bff/src/routes/school/football.ts).
 */
import { bffClient } from '@/lib/api/bffClient';
import type { RosterSubject } from './performanceQueries';

export type FootballSourceType = 'team_match' | 'tournament_match';
export type LineupRole = 'starter' | 'bench';
export type PositionCode = 'arquero' | 'defensa' | 'medio' | 'delantero';
export type FootballEventType = 'goal' | 'own_goal' | 'yellow' | 'red' | 'assist';

export interface LineupPlayerInput {
  subject_type: RosterSubject['subject_type'];
  subject_id: string;
  position_code?: PositionCode | null;
  role: LineupRole;
  jersey_number?: number | null;
  minutes_played?: number | null;
}

export interface LineupPlayer extends LineupPlayerInput {
  id: string;
}

export interface Lineup {
  id: string;
  team_id: string;
  source_type: FootballSourceType;
  source_id: string;
  formation: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LineupDetail extends Lineup {
  players: LineupPlayer[];
}

export async function getFootballLineups(params: {
  team_id?: string;
  source_type?: FootballSourceType;
  source_id?: string;
}): Promise<Lineup[]> {
  const query = new URLSearchParams();
  if (params.team_id) query.set('team_id', params.team_id);
  if (params.source_type) query.set('source_type', params.source_type);
  if (params.source_id) query.set('source_id', params.source_id);
  return bffClient.get<Lineup[]>(`/api/v1/school/football/lineups?${query}`);
}

export async function getFootballLineup(id: string): Promise<LineupDetail> {
  return bffClient.get<LineupDetail>(`/api/v1/school/football/lineups/${id}`);
}

export async function saveFootballLineup(payload: {
  team_id: string;
  source_type: FootballSourceType;
  source_id: string;
  formation?: string | null;
  players: LineupPlayerInput[];
}): Promise<LineupDetail> {
  return bffClient.post<LineupDetail>('/api/v1/school/football/lineups', payload);
}

export async function deleteFootballLineup(id: string): Promise<void> {
  await bffClient.delete(`/api/v1/school/football/lineups/${id}`);
}

export interface FootballMatchEvent {
  id: string;
  team_id: string;
  source_type: FootballSourceType;
  source_id: string;
  subject_type: RosterSubject['subject_type'];
  subject_id: string;
  type: FootballEventType;
  minute: number | null;
  created_by: string;
  created_at: string;
}

export interface NewFootballMatchEvent {
  subject_type: RosterSubject['subject_type'];
  subject_id: string;
  type: FootballEventType;
  minute?: number | null;
}

export async function getFootballEvents(params: {
  team_id?: string;
  source_type?: FootballSourceType;
  source_id?: string;
  subject_type?: string;
  subject_id?: string;
}): Promise<FootballMatchEvent[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return bffClient.get<FootballMatchEvent[]>(`/api/v1/school/football/events?${query}`);
}

export async function createFootballEvents(payload: {
  team_id: string;
  source_type: FootballSourceType;
  source_id: string;
  events: NewFootballMatchEvent[];
}): Promise<FootballMatchEvent[]> {
  return bffClient.post<FootballMatchEvent[]>('/api/v1/school/football/events', payload);
}

export async function deleteFootballEvent(id: string): Promise<void> {
  await bffClient.delete(`/api/v1/school/football/events/${id}`);
}

export interface FootballSeasonStat {
  subject_type: RosterSubject['subject_type'];
  subject_id: string;
  matches_in_squad: number;
  matches_played: number;
  minutes_played: number;
  goals: number;
  own_goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

export interface FootballSeasonStatsResponse {
  team_id: string;
  stats: FootballSeasonStat[];
}

export async function getFootballSeasonStats(teamId: string): Promise<FootballSeasonStatsResponse> {
  return bffClient.get<FootballSeasonStatsResponse>(`/api/v1/school/football/season-stats?team_id=${teamId}`);
}

export interface TournamentMatch {
  id: string;
  event_id: string;
  event_title: string;
  round: number;
  is_home: boolean;
  opponent: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  scheduled_at: string | null;
  venue: string | null;
}

export async function getTournamentMatches(teamId: string): Promise<TournamentMatch[]> {
  return bffClient.get<TournamentMatch[]>(`/api/v1/school/football/tournament-matches?team_id=${teamId}`);
}
