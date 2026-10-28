/**
 * Tipos (DTO) del BFF de «Torneos en vivo» — base `/api/v1/tournament-live`.
 * Contrato: docs/specs/torneos-en-vivo-multideporte-plan.md.
 */
import type { Action, ScoringConfig, ScoreModel, MatchStatus, MatchDetail } from '@/lib/tournamentScoring';

export type { Action, ScoringConfig, ScoreModel, MatchStatus };

export type MatchStage = 'league' | 'group' | 'knockout' | 'third_place';
export type FixtureFormat = 'liga' | 'copa' | 'grupos';

export interface SetDto {
  home: number; away: number; closed: boolean; deciding: boolean;
  /** Tenis: puntos del tie-break / super tie-break. */
  tb?: { home: number; away: number };
  super?: boolean;
}

export interface LiveStateDto {
  status: MatchStatus;
  points: string;
  walkover?: 'home' | 'away' | null;
  /** Penales / desempate e innings de críquet. */
  detail?: MatchDetail | null;
}

export interface MatchDto {
  id: string;
  category_id: string;
  stage: MatchStage;
  group_label: string | null;
  round: number;
  slot: number;
  home_team_id: string | null;
  away_team_id: string | null;
  home_name: string | null;
  away_name: string | null;
  /** Texto de referencia mientras el equipo no está definido («1.º Grupo A»). */
  home_label: string | null;
  away_label: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  scheduled_at: string | null;
  court: string | null;
  version: number;
  live_state: LiveStateDto | null;
  sets: SetDto[];
  scorer_label: string | null;
  started_at: string | null;
  finished_at: string | null;
  model: ScoreModel;
  config: ScoringConfig;
  /** Llave con «pasa directo»: un lado sin equipo ni referencia. No cuenta como partido jugado. */
  is_bye: boolean;
}

/** Partido en lo público: sin version / live_state / config / scorer_*. */
export type PublicMatchDto = Omit<MatchDto, 'version' | 'live_state' | 'config' | 'scorer_label'>;

export interface StandingRow {
  team_id: string;
  team_name: string;
  P: number; W: number; D: number; L: number;
  GF: number; GA: number; GD: number; Pts: number;
  SW?: number; SL?: number; PF?: number; PA?: number;
}

export interface StandingsDto {
  model: ScoreModel;
  standings: StandingRow[];
  groups?: Record<string, StandingRow[]>;
  scorers?: Array<{ name: string; goals: number }>;
}

export interface FormatConfig {
  draw?: 'random' | 'manual';
  seed?: string | number;
  team_order?: string[];
  matches_per_team?: number | null;
  double_round?: boolean;
  groups?: { count: number; advance: number };
  third_place?: boolean;
  schedule?: { start: string; courts: number; slot_minutes: number; break_minutes?: number } | null;
}

export interface FixturesResponse {
  matches: number;
  format: FixtureFormat;
  seed: number;
  groups?: Record<string, string[]>;
}

export interface ScoringPreset { key: string; label: string; config: Partial<ScoringConfig> }

export interface LiveConfigDto {
  event: {
    id: string; title: string; sport: string | null; slug: string;
    competition_format: string | null;
    live_enabled: boolean;
    scoring_config: Partial<ScoringConfig> | null;
    format_config: unknown;
    stream_url: string | null;
  };
  presets: ScoringPreset[];
  suggested_preset: string;
  global_live_disabled: boolean;
}

export interface ScorekeeperDto {
  id: string; label: string; court: string | null;
  expires_at: string | null; revoked_at: string | null; last_used_at: string | null;
}

export interface ScorekeeperCreated { id: string; token: string; url: string }

export interface ActionResponse { ok: true; duplicate?: boolean; warning?: string; match: MatchDto }

export interface ScorerHomeDto {
  event: { id: string; title: string; sport: string | null; slug: string };
  scorekeeper: { label: string; court: string | null };
  matches: MatchDto[];
}

export interface PublicLiveDto {
  event: {
    id: string; title: string; sport: string | null; city: string | null; event_date: string | null;
    school_name: string | null; live_enabled: boolean; stream_url: string | null; format: string | null;
  };
  categories: Array<{ id: string; name: string }>;
  matches: PublicMatchDto[];
  standings: Record<string, StandingsDto>;
  server_time: string;
}

export interface ApiErrorBody { error?: string; code?: string; match?: MatchDto }
