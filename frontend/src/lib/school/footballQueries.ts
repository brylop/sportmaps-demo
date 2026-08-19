/**
 * Football Module — BFF Queries
 *
 * Centraliza las llamadas al BFF para alineaciones, eventos de partido y
 * acumulados de temporada de fútbol (Fase 2 del módulo de rendimiento de
 * fútbol -- ver bff/src/routes/school/football.ts).
 */
import { bffClient } from '@/lib/api/bffClient';
import type { RosterSubject } from './performanceQueries';

// Separados (P0, tablero táctico): un entrenamiento tiene alineación pero
// nunca eventos de partido (goles/tarjetas), así que solo el primero acepta
// 'training_session'. Ver docs/plan-p0-tablero-tactico.md.
export type LineupSourceType = 'team_match' | 'tournament_match' | 'training_session';
export type EventSourceType = 'team_match' | 'tournament_match';
/** @deprecated usa LineupSourceType o EventSourceType según el endpoint. */
export type FootballSourceType = EventSourceType;

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
  /** Tablero táctico (P0): posición libre, sin catálogo de formaciones. */
  slot_label?: string | null;
  /** 0–100, normalizado sobre el ancho/alto de la cancha. */
  x?: number | null;
  y?: number | null;
}

export interface LineupPlayer extends LineupPlayerInput {
  id: string;
}

export interface Lineup {
  id: string;
  team_id: string;
  source_type: LineupSourceType;
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
  source_type?: LineupSourceType;
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
  source_type: LineupSourceType;
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
  source_type: EventSourceType;
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
  source_type?: EventSourceType;
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
  source_type: EventSourceType;
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

// ─── Plantillas tácticas guardadas (P2a/P2b) ───────────────────────────────
// Guardan SOLO layout (D8 de docs/plan-p2-estrategias-guardadas.md): sin
// subject_id -- reutilizable aunque cambie quién está disponible ese día.
export type TacticalSituation =
  | 'ataque' | 'defensa' | 'presion' | 'transicion'
  | 'corner' | 'tiro_libre' | 'penalti';

export interface TacticalPresetSlot {
  slot_label: string;
  x: number;
  y: number;
}

/** Figura del modo pizarra (P2d) -- mismo espacio de coordenadas 0-100 que
 *  los slots, para no manejar dos sistemas distintos en el frontend.
 *  "type" es opcional y por defecto 'arrow' -- así las flechas guardadas
 *  ANTES de agregar curva/zona se siguen leyendo sin romper. */
export type TacticalArrowColor = 'white' | 'yellow' | 'red' | 'blue';
export type TacticalShapeType = 'arrow' | 'curve' | 'zone';

export interface TacticalArrow {
  type?: TacticalShapeType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: TacticalArrowColor;
}

export interface TacticalPreset {
  id: string;
  team_id: string;
  name: string;
  situation: TacticalSituation;
  slots: TacticalPresetSlot[];
  arrows: TacticalArrow[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function getTacticalPresets(params: { team_id?: string; situation?: TacticalSituation }): Promise<TacticalPreset[]> {
  const query = new URLSearchParams();
  if (params.team_id) query.set('team_id', params.team_id);
  if (params.situation) query.set('situation', params.situation);
  return bffClient.get<TacticalPreset[]>(`/api/v1/school/football/tactical-presets?${query}`);
}

export async function createTacticalPreset(payload: {
  team_id: string;
  name: string;
  situation: TacticalSituation;
  slots: TacticalPresetSlot[];
  arrows?: TacticalArrow[];
}): Promise<TacticalPreset> {
  return bffClient.post<TacticalPreset>('/api/v1/school/football/tactical-presets', payload);
}

export async function deleteTacticalPreset(id: string): Promise<void> {
  await bffClient.delete(`/api/v1/school/football/tactical-presets/${id}`);
}
