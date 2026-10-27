/**
 * Torneos en vivo — capa de datos sobre los motores puros (scoring / standings / fixtures).
 * Una sola vía para cambiar un marcador: `performMatchAction` (versión optimista + log + idempotencia
 * en una RPC transaccional). Todo lo demás (avance de llaves, fase final desde grupos, avisos) cuelga de ahí.
 */
import { createHash, randomBytes } from 'crypto';
import { supabase } from '../../config/supabase';
import {
  Action, ACTION_TYPES, ApplyResult, LiveState, MatchStatus, ScoringConfig, Side,
  applyAction, derive, emptyState, matchOutcome, presetKeyForSport, resolveConfig, SCORING_PRESETS, validateConfig,
} from './scoring.shared';
import { computeStandings, StandingRow } from './standings.shared';
import { FormatConfig, Format, generateFixtures, validateFormat } from './fixtures.shared';
import { onMatchActionApplied } from './tournament-follow.service';

// ── Utilidades ───────────────────────────────────────────────────────────────

/** Interruptor de emergencia global: apaga lo «en vivo» en todos los torneos sin desplegar. */
export const liveGloballyDisabled = () => process.env.TOURNAMENT_LIVE_DISABLED === 'true';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const FINISHED: MatchStatus[] = ['played', 'walkover'];
const isFinished = (s: string) => s === 'played' || s === 'walkover';
/** Un anotador distinto necesita «tomar» el partido si el anterior actuó hace menos de esto. */
const SCORER_LOCK_MS = 10 * 60 * 1000;

export class LiveError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export function refLabel(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const g = /^G(\d+):([A-Z])$/.exec(ref);
  if (g) return `${g[1]}.º Grupo ${g[2]}`;
  const l = /^L:(\d+):(\d+)$/.exec(ref);
  if (l) return `Perdedor partido ${l[2]} de la ronda ${l[1]}`;
  return null;
}

// ── Carga ────────────────────────────────────────────────────────────────────

const MATCH_COLS = 'id, event_id, category_id, stage, group_label, round, slot, home_team_id, away_team_id, home_ref, away_ref, '
  + 'home_score, away_score, status, scheduled_at, court, version, live_state, scorer_ref, scorer_label, started_at, finished_at, updated_at, '
  + 'home:home_team_id(team_name), away:away_team_id(team_name)';

export interface LiveEvent {
  id: string; title: string; sport: string | null; slug: string | null; city: string | null; event_date: string | null;
  school_id: string | null; visibility: string | null; competition_format: string | null;
  live_enabled: boolean; scoring_config: any; format_config: any; stream_url: string | null;
  school?: { name: string | null } | null;
}

const EVENT_COLS = 'id, title, sport, slug, city, event_date, school_id, visibility, competition_format, live_enabled, scoring_config, format_config, stream_url, school:school_id(name)';

export async function loadEvent(eventId: string): Promise<LiveEvent | null> {
  const { data } = await supabase.from('events').select(EVENT_COLS).eq('id', eventId).maybeSingle();
  return (data as unknown as LiveEvent) ?? null;
}

export const liveEffective = (ev: Pick<LiveEvent, 'live_enabled'>) => !!ev.live_enabled && !liveGloballyDisabled();

export interface MatchRow {
  id: string; event_id: string; category_id: string | null; stage: string; group_label: string | null; round: number; slot: number;
  home_team_id: string | null; away_team_id: string | null; home_ref: string | null; away_ref: string | null;
  home_score: number | null; away_score: number | null; status: MatchStatus; scheduled_at: string | null; court: string | null;
  version: number; live_state: any; scorer_ref: string | null; scorer_label: string | null;
  started_at: string | null; finished_at: string | null; updated_at: string | null;
  home?: { team_name: string } | null; away?: { team_name: string } | null;
}

export async function loadMatch(eventId: string, matchId: string): Promise<MatchRow | null> {
  const { data } = await supabase.from('tournament_matches').select(MATCH_COLS).eq('id', matchId).eq('event_id', eventId).maybeSingle();
  return (data as unknown as MatchRow) ?? null;
}

export async function loadMatches(eventId: string, categoryId?: string | null): Promise<MatchRow[]> {
  let q = supabase.from('tournament_matches').select(MATCH_COLS).eq('event_id', eventId).order('stage').order('round').order('slot');
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data } = await q;
  return (data ?? []) as unknown as MatchRow[];
}

// ── DTO ──────────────────────────────────────────────────────────────────────

export function stateOf(m: Pick<MatchRow, 'status' | 'live_state' | 'home_score' | 'away_score'>, cfg: ScoringConfig): LiveState {
  const ls = m.live_state;
  if (ls && typeof ls === 'object' && typeof ls.points === 'string') {
    return { status: m.status, points: ls.points, walkover: (ls.walkover as Side | null) ?? null };
  }
  // Partido anterior al motor: si es de goles reconstruimos la secuencia desde el marcador.
  if (cfg.model === 'goals' && (m.home_score != null || m.away_score != null)) {
    return { status: m.status, points: 'h'.repeat(Math.max(0, Number(m.home_score ?? 0))) + 'a'.repeat(Math.max(0, Number(m.away_score ?? 0))), walkover: null };
  }
  return { ...emptyState(m.status), status: m.status };
}

export function isByeRow(m: Pick<MatchRow, 'stage' | 'home_team_id' | 'away_team_id' | 'home_ref' | 'away_ref'>): boolean {
  return m.stage === 'knockout' && ((!m.home_team_id && !m.home_ref) || (!m.away_team_id && !m.away_ref));
}

export function toMatchDto(m: MatchRow, cfg: ScoringConfig, opts: { pub?: boolean } = {}) {
  const st = stateOf(m, cfg);
  const sets = cfg.model === 'sets' && m.live_state ? derive(st, cfg).sets : [];
  const base = {
    id: m.id, category_id: m.category_id, stage: m.stage, group_label: m.group_label, round: m.round, slot: m.slot,
    home_team_id: m.home_team_id, away_team_id: m.away_team_id,
    home_name: m.home?.team_name ?? null, away_name: m.away?.team_name ?? null,
    home_label: m.home_team_id ? null : refLabel(m.home_ref), away_label: m.away_team_id ? null : refLabel(m.away_ref),
    is_bye: isByeRow(m),
    home_score: m.home_score, away_score: m.away_score, status: m.status,
    scheduled_at: m.scheduled_at, court: m.court, started_at: m.started_at, finished_at: m.finished_at,
    sets, model: cfg.model,
  };
  if (opts.pub) return base;
  return { ...base, version: m.version, live_state: m.live_state ?? null, scorer_label: m.scorer_label, config: cfg };
}

// ── Avance de llaves ─────────────────────────────────────────────────────────

interface AdvancePlan { updates: Array<{ id: string; patch: Record<string, unknown> }> }

async function planAdvance(m: MatchRow, winnerTeam: string | null, loserTeam: string | null): Promise<AdvancePlan> {
  const plan: AdvancePlan = { updates: [] };
  if (m.stage !== 'knockout' || !m.category_id) return plan;

  const { data: sibs } = await supabase.from('tournament_matches')
    .select('id, stage, round, slot, status, home_team_id, away_team_id, home_ref, away_ref')
    .eq('event_id', m.event_id).eq('category_id', m.category_id);
  const all = (sibs ?? []) as any[];

  const guard = (target: any, field: 'home_team_id' | 'away_team_id', value: string | null) => {
    if ((target[field] ?? null) === (value ?? null)) return;
    if (target.status !== 'scheduled') {
      throw new LiveError(422, 'siguiente_ronda_en_curso', 'El partido de la siguiente ronda ya empezó: no se puede cambiar este resultado.');
    }
    plan.updates.push({ id: target.id, patch: { [field]: value } });
  };

  const parent = all.find((x) => x.stage === 'knockout' && x.round === m.round + 1 && x.slot === Math.ceil(m.slot / 2));
  if (parent) guard(parent, m.slot % 2 === 1 ? 'home_team_id' : 'away_team_id', winnerTeam);

  const ref = `L:${m.round}:${m.slot}`;
  const third = all.find((x) => x.stage === 'third_place' && (x.home_ref === ref || x.away_ref === ref));
  if (third) guard(third, third.home_ref === ref ? 'home_team_id' : 'away_team_id', loserTeam);

  return plan;
}

async function applyPlan(plan: AdvancePlan) {
  for (const u of plan.updates) {
    await supabase.from('tournament_matches').update({ ...u.patch, updated_at: new Date().toISOString() }).eq('id', u.id);
  }
}

/** Rondas con un solo equipo y el otro lado sin referencia (bye): avanzan solas. */
export async function advanceByes(eventId: string, categoryId: string): Promise<void> {
  const { data } = await supabase.from('tournament_matches')
    .select(MATCH_COLS).eq('event_id', eventId).eq('category_id', categoryId).eq('stage', 'knockout').eq('round', 1);
  for (const m of ((data ?? []) as unknown as MatchRow[])) {
    if (m.status !== 'scheduled') continue;
    const homeBye = !m.home_team_id && !m.home_ref;
    const awayBye = !m.away_team_id && !m.away_ref;
    const winnerSide: Side | null = m.home_team_id && awayBye ? 'home' : m.away_team_id && homeBye ? 'away' : null;
    if (!winnerSide) continue;
    await supabase.from('tournament_matches')
      .update({ status: 'walkover', home_score: winnerSide === 'home' ? 1 : 0, away_score: winnerSide === 'away' ? 1 : 0, updated_at: new Date().toISOString() })
      .eq('id', m.id);
    const plan = await planAdvance({ ...m, status: 'walkover' }, winnerSide === 'home' ? m.home_team_id : m.away_team_id, null);
    await applyPlan(plan);
  }
}

// ── Grupos → fase final ──────────────────────────────────────────────────────

export interface CategoryStandings {
  model: 'goals' | 'sets';
  standings: StandingRow[];
  groups?: Record<string, StandingRow[]>;
}

export function standingsFor(
  teams: Array<{ id: string; team_name: string }>, matches: MatchRow[], cfg: ScoringConfig,
): CategoryStandings {
  const groupMatches = matches.filter((m) => m.stage === 'group');
  if (groupMatches.length === 0) {
    return { model: cfg.model, standings: computeStandings(teams, matches.filter((m) => m.stage !== 'third_place'), cfg) };
  }
  const byLabel = new Map<string, Set<string>>();
  for (const m of groupMatches) {
    const s = byLabel.get(m.group_label ?? '?') ?? new Set<string>();
    if (m.home_team_id) s.add(m.home_team_id);
    if (m.away_team_id) s.add(m.away_team_id);
    byLabel.set(m.group_label ?? '?', s);
  }
  const groups: Record<string, StandingRow[]> = {};
  [...byLabel.keys()].sort().forEach((label) => {
    const ids = byLabel.get(label)!;
    groups[label] = computeStandings(teams.filter((t) => ids.has(t.id)), groupMatches.filter((m) => m.group_label === label), cfg);
  });
  return { model: cfg.model, standings: [], groups };
}

async function loadTeams(eventId: string, categoryId?: string | null) {
  let q = supabase.from('event_teams').select('id, team_name, category_id').eq('event_id', eventId).neq('status', 'rejected');
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data } = await q;
  return (data ?? []) as Array<{ id: string; team_name: string; category_id: string | null }>;
}

/**
 * Cuando TODOS los partidos de grupo de la categoría terminaron, llena los cruces de la fase final
 * (1.º A vs 2.º B…). Si luego se corrige un partido de grupo, vuelve a calcular mientras la fase final
 * no haya empezado; si ya empezó, avisa en vez de cambiar los cruces por debajo.
 */
export async function resolveGroupKnockout(ev: LiveEvent, categoryId: string): Promise<{ resolved: boolean }> {
  const matches = await loadMatches(ev.id, categoryId);
  const groupMatches = matches.filter((m) => m.stage === 'group');
  const koMatches = matches.filter((m) => m.stage === 'knockout' || m.stage === 'third_place');
  if (groupMatches.length === 0 || koMatches.length === 0) return { resolved: false };

  const allDone = groupMatches.every((m) => isFinished(m.status) || m.status === 'cancelled');
  const cfg = resolveConfig(ev.scoring_config, categoryId);
  const teams = await loadTeams(ev.id, categoryId);

  const refMap = new Map<string, string>();
  if (allDone) {
    const { groups } = standingsFor(teams, matches, cfg);
    for (const [label, rows] of Object.entries(groups ?? {})) rows.forEach((r, i) => refMap.set(`G${i + 1}:${label}`, r.team_id));
  }

  const touched = koMatches.filter((m) => m.home_ref?.startsWith('G') || m.away_ref?.startsWith('G'));
  const started = koMatches.some((m) => m.status !== 'scheduled' && !(m.status === 'walkover' && isByeRow(m)));
  const wouldChange = touched.some((m) => (m.home_ref?.startsWith('G') && (m.home_team_id ?? null) !== (refMap.get(m.home_ref) ?? null))
    || (m.away_ref?.startsWith('G') && (m.away_team_id ?? null) !== (refMap.get(m.away_ref!) ?? null)));
  if (!wouldChange) return { resolved: allDone };
  if (started) throw new LiveError(422, 'fase_final_en_curso', 'La fase final ya empezó: no se pueden cambiar los clasificados de los grupos.');

  // Se limpia todo lo que dependía de los cruces anteriores y se vuelve a llenar.
  const r1ids = koMatches.filter((m) => m.stage === 'knockout' && m.round === 1).map((m) => m.id);
  for (const m of koMatches) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (m.home_ref?.startsWith('G')) patch.home_team_id = refMap.get(m.home_ref) ?? null;
    if (m.away_ref?.startsWith('G')) patch.away_team_id = refMap.get(m.away_ref) ?? null;
    if (m.stage === 'knockout' && m.round > 1) { patch.home_team_id = null; patch.away_team_id = null; }
    if (m.stage === 'third_place') { patch.home_team_id = null; patch.away_team_id = null; }
    if (m.status === 'walkover' && isByeRow(m)) { patch.status = 'scheduled'; patch.home_score = null; patch.away_score = null; }
    await supabase.from('tournament_matches').update(patch).eq('id', m.id);
  }
  if (allDone && r1ids.length) await advanceByes(ev.id, categoryId);
  return { resolved: allDone };
}

// ── Acción única sobre un partido ────────────────────────────────────────────

export interface Actor { type: 'user' | 'scorekeeper'; id: string; label: string }

export interface ActionInput { action: Action; client_action_id?: string | null; expected_version?: number | null }

const LIVE_FREE_ACTIONS = new Set(['correct', 'walkover', 'cancel']);

export function validateAction(a: any): Action {
  if (!a || typeof a !== 'object' || !ACTION_TYPES.includes(a.type)) throw new LiveError(400, 'accion_invalida', 'Acción inválida');
  return a as Action;
}

export async function performMatchAction(ev: LiveEvent, matchId: string, actor: Actor, input: ActionInput) {
  const action = validateAction(input.action);
  const match = await loadMatch(ev.id, matchId);
  if (!match) throw new LiveError(404, 'partido_no_encontrado', 'Partido no encontrado');

  const cfg = resolveConfig(ev.scoring_config, match.category_id);
  const dto = () => toMatchDto(match, cfg);

  // Marcador en vivo apagado: solo se permite cargar el resultado final a mano (como antes).
  if (!liveEffective(ev) && !(LIVE_FREE_ACTIONS.has(action.type) && match.status === 'scheduled') && !(action.type === 'correct' && isFinished(match.status))) {
    throw new LiveError(403, 'live_disabled', liveGloballyDisabled()
      ? 'El marcador en vivo está apagado temporalmente.' : 'Este torneo no tiene el marcador en vivo encendido.');
  }

  if (!match.home_team_id || !match.away_team_id) {
    throw new LiveError(422, 'equipos_sin_definir', 'Este partido aún no tiene los dos equipos definidos.');
  }

  // Idempotencia: un reintento con el mismo client_action_id no se aplica dos veces.
  if (input.client_action_id) {
    const { data: dup } = await supabase.from('tournament_match_log').select('id').eq('match_id', matchId).eq('client_action_id', input.client_action_id).maybeSingle();
    if (dup) return { duplicate: true, match: dto() };
  }

  // Un anotador activo por partido.
  const actorRef = `${actor.type === 'user' ? 'u' : 's'}:${actor.id}`;
  if (match.status === 'live' && match.scorer_ref && match.scorer_ref !== actorRef && match.updated_at
    && Date.now() - Date.parse(match.updated_at) < SCORER_LOCK_MS) {
    throw new LiveError(409, 'otro_anotador', `${match.scorer_label ?? 'Otro anotador'} está anotando este partido. Tómalo para continuar.`, { match: dto() });
  }

  const before = stateOf(match, cfg);
  const knockout = match.stage === 'knockout' || match.stage === 'third_place';
  const result: ApplyResult = applyAction(before, action, cfg, { knockout });
  if (!result.ok) throw new LiveError(422, result.code, result.message);

  const next = result.state;
  const d = result.derived;
  const nowIso = new Date().toISOString();
  const becameFinished = isFinished(next.status) && !isFinished(match.status);
  const startedAt = action.type === 'start' ? nowIso : match.started_at;
  const finishedAt = isFinished(next.status) ? (isFinished(match.status) ? match.finished_at ?? nowIso : nowIso) : null;

  // Llaves: antes de guardar, comprobar que el cambio no pisa una ronda que ya empezó.
  let plan: AdvancePlan = { updates: [] };
  if (knockout && (isFinished(next.status) || isFinished(match.status))) {
    const winnerTeam = isFinished(next.status) && d.winner ? (d.winner === 'home' ? match.home_team_id : match.away_team_id) : null;
    const loserTeam = isFinished(next.status) && d.winner ? (d.winner === 'home' ? match.away_team_id : match.home_team_id) : null;
    plan = await planAdvance(match, winnerTeam, loserTeam);
  }

  const expected = input.expected_version ?? match.version;
  const { data: rpc, error } = await supabase.rpc('apply_tournament_match_action', {
    p_match_id: matchId, p_expected_version: expected, p_status: next.status,
    p_live_state: { status: next.status, points: next.points, walkover: next.walkover ?? null },
    p_home_score: d.homeScore, p_away_score: d.awayScore,
    p_started_at: startedAt, p_finished_at: finishedAt,
    p_scorer_ref: actorRef, p_scorer_label: actor.label,
    p_actor_type: actor.type, p_actor_id: actor.id, p_action: action.type,
    p_client_action_id: input.client_action_id ?? null,
    p_before: before, p_after: { status: next.status, points: next.points, walkover: next.walkover ?? null, home: d.homeScore, away: d.awayScore },
  });
  if (error) throw new LiveError(500, 'error_guardando', 'No se pudo guardar la acción');
  const out = rpc as { ok?: boolean; duplicate?: boolean; error?: string; version?: number };
  if (out?.error === 'version_conflict') {
    const fresh = await loadMatch(ev.id, matchId);
    throw new LiveError(409, 'version_conflict', 'El partido cambió mientras anotabas. Se cargó la versión actual.', { match: fresh ? toMatchDto(fresh, cfg) : dto() });
  }
  if (out?.error === 'not_found') throw new LiveError(404, 'partido_no_encontrado', 'Partido no encontrado');

  const fresh = await loadMatch(ev.id, matchId);
  const freshDto = fresh ? toMatchDto(fresh, cfg) : dto();
  if (out?.duplicate) return { duplicate: true, match: freshDto };

  await applyPlan(plan);

  let warning: string | undefined;
  if (match.stage === 'group' && match.category_id && (isFinished(next.status) || isFinished(match.status))) {
    try { await resolveGroupKnockout(ev, match.category_id); }
    catch (e: any) {
      if (e instanceof LiveError) warning = e.message; // el marcador ya quedó guardado; los cruces no se tocan
      else console.error('[tournament-live] resolviendo fase final:', e?.message);
    }
  }

  if (becameFinished) notifyMatchFinished(ev, match, d.homeScore, d.awayScore, cfg).catch(() => { /* aviso best-effort */ });
  // Tiempo real (Broadcast `tlive:<slug>`) + avisos a quien sigue el torneo. Nunca lanza. (agente «vivo»)
  if (fresh) onMatchActionApplied({ id: ev.id, title: ev.title, slug: ev.slug, live: liveEffective(ev) }, match.status, freshDto as any, action.type);
  return { duplicate: false, match: freshDto, ...(warning ? { warning } : {}) };
}

/** «Tomar» el partido: el anotador actual pasa a ser quien lo toma. */
export async function takeMatch(ev: LiveEvent, matchId: string, actor: Actor) {
  const match = await loadMatch(ev.id, matchId);
  if (!match) throw new LiveError(404, 'partido_no_encontrado', 'Partido no encontrado');
  await supabase.from('tournament_matches').update({
    scorer_ref: `${actor.type === 'user' ? 'u' : 's'}:${actor.id}`, scorer_label: actor.label,
    scorer_taken_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', matchId);
  return { ok: true };
}

// ── Avisos (solo resultado final; nunca punto a punto) ───────────────────────

async function notifyMatchFinished(ev: LiveEvent, m: MatchRow, hs: number, as: number, cfg: ScoringConfig) {
  const teamIds = [m.home_team_id, m.away_team_id].filter(Boolean) as string[];
  if (teamIds.length === 0) return;
  const { data: members } = await supabase.from('event_team_members').select('profile_id, child_id, children:child_id(parent_id)').in('team_id', teamIds);
  const ids = Array.from(new Set((members ?? []).map((x: any) => x.profile_id || x.children?.parent_id).filter(Boolean)));
  if (ids.length === 0) return;
  const unit = cfg.model === 'sets' ? ' en sets' : '';
  const link = ev.slug && liveEffective(ev) ? `/torneo/${ev.slug}/en-vivo` : `/tournaments/${ev.id}/results`;
  await supabase.from('notifications').insert(ids.map((user_id) => ({
    user_id, title: '📣 Resultado del partido', message: `${m.home?.team_name ?? 'Local'} ${hs} - ${as} ${m.away?.team_name ?? 'Visitante'}${unit}. Ya puedes verlo y compartirlo.`,
    type: 'info', category: 'tournament', link, data: { eventId: ev.id, matchId: m.id },
  })));
}

// ── Calendario ───────────────────────────────────────────────────────────────

export async function generateCategoryFixtures(ev: LiveEvent, categoryId: string, format: Format, cfg: FormatConfig) {
  if (!['liga', 'copa', 'grupos'].includes(format)) throw new LiveError(400, 'formato_invalido', 'Formato inválido: liga, copa o grupos');
  const teams = await loadTeams(ev.id, categoryId);
  const ids = teams.map((t) => t.id);
  const err = validateFormat(format, ids.length, cfg ?? {});
  if (err) throw new LiveError(400, 'config_invalida', err);

  const existing = await loadMatches(ev.id, categoryId);
  const blocking = existing.filter((m) => m.status !== 'scheduled' && !(m.status === 'walkover' && isByeRow(m)));
  if (blocking.length > 0) {
    throw new LiveError(409, 'hay_partidos_jugados', 'Ya hay partidos jugados o en juego en esta categoría: no se puede regenerar el calendario.');
  }

  let gen;
  try { gen = generateFixtures(format, ids, cfg ?? {}); }
  catch (e: any) { throw new LiveError(400, 'config_invalida', e?.message ?? 'Configuración inválida'); }

  if (existing.length) await supabase.from('tournament_matches').delete().in('id', existing.map((m) => m.id));
  const rows = gen.rows.map((r) => ({
    event_id: ev.id, category_id: categoryId, status: 'scheduled', stage: r.stage, group_label: r.group_label,
    round: r.round, slot: r.slot, home_team_id: r.home_team_id, away_team_id: r.away_team_id,
    home_ref: r.home_ref, away_ref: r.away_ref, court: r.court, scheduled_at: r.scheduled_at,
  }));
  if (rows.length) {
    const { error } = await supabase.from('tournament_matches').insert(rows);
    if (error) throw new LiveError(500, 'error_generando', 'Error al generar el calendario');
  }
  await supabase.from('events').update({
    competition_format: format, format_config: { ...cfg, seed: gen.seed }, updated_at: new Date().toISOString(),
  }).eq('id', ev.id);
  if (format !== 'liga') await advanceByes(ev.id, categoryId);
  return { matches: rows.length, format, seed: gen.seed, groups: gen.groups };
}

// ── Tabla ────────────────────────────────────────────────────────────────────

export async function buildCategoryStandings(ev: LiveEvent, categoryId?: string | null): Promise<CategoryStandings> {
  const [teams, matches] = await Promise.all([loadTeams(ev.id, categoryId), loadMatches(ev.id, categoryId)]);
  return standingsFor(teams, matches, resolveConfig(ev.scoring_config, categoryId));
}

// ── Configuración del torneo ─────────────────────────────────────────────────

export async function getConfig(ev: LiveEvent) {
  return {
    event: {
      id: ev.id, title: ev.title, sport: ev.sport, slug: ev.slug, competition_format: ev.competition_format,
      live_enabled: ev.live_enabled, scoring_config: ev.scoring_config ?? null, format_config: ev.format_config ?? null, stream_url: ev.stream_url,
    },
    presets: Object.entries(SCORING_PRESETS).map(([key, p]) => ({ key, label: p.label, config: p.config })),
    suggested_preset: presetKeyForSport(ev.sport),
    global_live_disabled: liveGloballyDisabled(),
  };
}

const STREAM_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'facebook.com', 'www.facebook.com', 'fb.watch', 'vimeo.com', 'player.vimeo.com'];

export function validateStreamUrl(url: unknown): string | null {
  if (url == null || url === '') return null;
  if (typeof url !== 'string' || url.length > 500) throw new LiveError(400, 'stream_invalido', 'El enlace de transmisión no es válido');
  let u: URL;
  try { u = new URL(url); } catch { throw new LiveError(400, 'stream_invalido', 'El enlace de transmisión no es válido'); }
  if (u.protocol !== 'https:' || !STREAM_HOSTS.includes(u.hostname.toLowerCase())) {
    throw new LiveError(400, 'stream_invalido', 'Solo se admiten enlaces https de YouTube, Facebook o Vimeo');
  }
  return u.toString();
}

export async function patchConfig(ev: LiveEvent, body: Record<string, any>) {
  const patch: Record<string, unknown> = {};
  if ('live_enabled' in body) {
    if (typeof body.live_enabled !== 'boolean') throw new LiveError(400, 'invalido', 'live_enabled debe ser true o false');
    patch.live_enabled = body.live_enabled;
  }
  if (body.preset != null) {
    const p = SCORING_PRESETS[String(body.preset)];
    if (!p) throw new LiveError(400, 'preset_invalido', 'Plantilla de marcador desconocida');
    patch.scoring_config = p.config.model ? { ...p.config } : { model: 'goals', ...p.config };
  } else if ('scoring_config' in body) {
    const bad = validateConfig(body.scoring_config);
    if (bad) throw new LiveError(400, 'config_invalida', bad);
    patch.scoring_config = body.scoring_config ?? null;
  }
  if ('stream_url' in body) patch.stream_url = validateStreamUrl(body.stream_url);
  if (Object.keys(patch).length === 0) throw new LiveError(400, 'nada', 'No hay nada que guardar');

  // No se cambian las reglas de marcador con partidos ya en juego o jugados con otro modelo.
  if (patch.scoring_config !== undefined) {
    const matches = await loadMatches(ev.id);
    const touched = matches.some((m) => m.status === 'live' || (isFinished(m.status) && m.live_state && typeof m.live_state.points === 'string' && m.live_state.points.length > 0));
    const newModel = resolveConfig(patch.scoring_config as any).model;
    const oldModel = resolveConfig(ev.scoring_config).model;
    if (touched && newModel !== oldModel) throw new LiveError(409, 'modelo_en_uso', 'Ya hay partidos con marcador: no se puede cambiar el modelo (goles/sets).');
    if (matches.some((m) => m.status === 'live')) throw new LiveError(409, 'partidos_en_juego', 'Hay partidos en juego: cambia las reglas cuando terminen.');
  }
  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('events').update(patch).eq('id', ev.id);
  if (error) throw new LiveError(500, 'error_guardando', 'No se pudo guardar la configuración');
  publicCache.clear();
  return { success: true };
}

// ── Anotadores sin cuenta ────────────────────────────────────────────────────

export async function createScorekeeper(ev: LiveEvent, createdBy: string, body: { label?: string; court?: string | null; expires_hours?: number }, origin: string) {
  const label = String(body.label ?? '').trim().slice(0, 60);
  if (!label) throw new LiveError(400, 'label_requerido', 'Ponle un nombre al enlace (ej. «Mesa cancha 1»)');
  let hours = Number(body.expires_hours);
  if (!Number.isFinite(hours) || hours <= 0) {
    // por defecto: hasta 24 h después del día del torneo
    const end = ev.event_date ? Date.parse(`${ev.event_date}T23:59:59-05:00`) + 24 * 3600_000 : 0;
    hours = end > Date.now() ? (end - Date.now()) / 3600_000 : 24;
  }
  hours = Math.min(Math.max(hours, 1), 24 * 30);
  const token = randomBytes(32).toString('base64url');
  const expires_at = new Date(Date.now() + hours * 3600_000).toISOString();
  const { data, error } = await supabase.from('tournament_scorekeepers').insert({
    event_id: ev.id, label, court: body.court ? String(body.court).slice(0, 40) : null,
    token_hash: hashToken(token), expires_at, created_by: createdBy,
  }).select('id').single();
  if (error || !data) throw new LiveError(500, 'error_guardando', 'No se pudo crear el enlace');
  return { id: (data as any).id as string, token, url: `${origin.replace(/\/$/, '')}/anotador/${token}`, expires_at };
}

export async function listScorekeepers(eventId: string) {
  const { data } = await supabase.from('tournament_scorekeepers')
    .select('id, label, court, expires_at, revoked_at, last_used_at').eq('event_id', eventId).order('created_at', { ascending: false });
  return data ?? [];
}

export async function revokeScorekeeper(eventId: string, id: string) {
  await supabase.from('tournament_scorekeepers').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('event_id', eventId);
  return { success: true };
}

export interface ScorekeeperAuth { id: string; label: string; court: string | null; event: LiveEvent }

export async function authScorekeeper(token: string): Promise<ScorekeeperAuth> {
  if (!token || token.length < 20 || token.length > 100) throw new LiveError(401, 'token_invalido', 'Enlace inválido');
  const { data } = await supabase.from('tournament_scorekeepers')
    .select('id, event_id, label, court, expires_at, revoked_at').eq('token_hash', hashToken(token)).maybeSingle();
  const sk = data as any;
  if (!sk) throw new LiveError(401, 'token_invalido', 'Enlace inválido');
  if (sk.revoked_at) throw new LiveError(403, 'token_revocado', 'Este enlace fue revocado');
  if (Date.parse(sk.expires_at) < Date.now()) throw new LiveError(403, 'token_vencido', 'Este enlace venció');
  const ev = await loadEvent(sk.event_id);
  if (!ev) throw new LiveError(404, 'torneo_no_encontrado', 'Torneo no encontrado');
  return { id: sk.id, label: sk.label, court: sk.court, event: ev };
}

export async function touchScorekeeper(id: string) {
  await supabase.from('tournament_scorekeepers').update({ last_used_at: new Date().toISOString() }).eq('id', id);
}

export async function scorerMatches(sk: ScorekeeperAuth) {
  const all = await loadMatches(sk.event.id);
  const mine = all.filter((m) => !sk.court || !m.court || m.court === sk.court);
  const open = mine.filter((m) => !isFinished(m.status) && m.status !== 'cancelled' && m.home_team_id && m.away_team_id);
  const recent = mine.filter((m) => isFinished(m.status) && !isByeRow(m)).sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at))).slice(0, 10);
  return [...open, ...recent].map((m) => toMatchDto(m, resolveConfig(sk.event.scoring_config, m.category_id)));
}

// ── Lectura pública (caché de 5 s, solo equipos y marcadores) ────────────────

const publicCache = new Map<string, { at: number; payload: any; etag: string }>();
const PUBLIC_TTL_MS = 5000;

export async function publicLive(slug: string): Promise<{ payload: any; etag: string } | null> {
  const hit = publicCache.get(slug);
  if (hit && Date.now() - hit.at < PUBLIC_TTL_MS) return { payload: hit.payload, etag: hit.etag };

  const { data: evRaw } = await supabase.from('events').select(EVENT_COLS).eq('slug', slug).maybeSingle();
  const ev = evRaw as unknown as LiveEvent | null;
  if (!ev) return null;
  if (ev.visibility === 'school_only' && !ev.live_enabled) return null;

  const [{ data: cats }, teams, matches] = await Promise.all([
    supabase.from('event_categories_config').select('id, division, level, category, rama').eq('event_id', ev.id),
    loadTeams(ev.id),
    loadMatches(ev.id),
  ]);
  const live = liveEffective(ev);
  const categories = ((cats ?? []) as any[]).map((c) => ({ id: c.id as string, name: [c.division, c.level, c.category, c.rama].filter(Boolean).join(' · ') }));
  const catIds = new Set<string | null>([...categories.map((c) => c.id), ...matches.map((m) => m.category_id)]);

  const standings: Record<string, CategoryStandings> = {};
  const outMatches: any[] = [];
  for (const cid of catIds) {
    const cfg = resolveConfig(ev.scoring_config, cid);
    const cm = matches.filter((m) => m.category_id === cid);
    if (cid) standings[cid] = standingsFor(teams.filter((t) => t.category_id === cid), cm, cfg);
    for (const m of cm) {
      const dto: any = toMatchDto(m, cfg, { pub: true });
      if (!live && m.status === 'live') Object.assign(dto, { status: 'scheduled', home_score: null, away_score: null, sets: [] });
      outMatches.push(dto);
    }
  }

  const payload = {
    event: {
      id: ev.id, title: ev.title, sport: ev.sport, city: ev.city, event_date: ev.event_date,
      school_name: ev.school?.name ?? null, live_enabled: live, stream_url: live ? ev.stream_url : null, format: ev.competition_format,
    },
    categories, matches: outMatches, standings, server_time: new Date().toISOString(),
  };
  const etag = `"${createHash('sha1').update(JSON.stringify({ ...payload, server_time: undefined })).digest('hex').slice(0, 20)}"`;
  publicCache.set(slug, { at: Date.now(), payload, etag });
  if (publicCache.size > 200) publicCache.delete(publicCache.keys().next().value as string);
  return { payload, etag };
}

export const _clearPublicCache = () => publicCache.clear();

export { matchOutcome, FINISHED };
