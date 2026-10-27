/**
 * Motor de marcador de torneos — PURO (sin base de datos ni red).
 *
 * Modelos: `goals` (fútbol, futsal, baloncesto…) y `sets` (vóley, pádel, bádminton, tenis de mesa…).
 * El estado de un partido en vivo es una SECUENCIA de puntos ('h' = local, 'a' = visitante):
 * todo lo demás (sets, marcador, quién ganó) se DERIVA de ella. Así «deshacer» es quitar el
 * último punto, y un set cerrado se reabre solo.
 *
 * Una copia idéntica vive en frontend/src/lib/tournamentScoring.ts (para la cola offline del
 * anotador); una prueba falla si dejan de ser iguales. Editar AMBAS.
 */

export type Side = 'home' | 'away';
export type ScoreModel = 'goals' | 'sets';
export type MatchStatus = 'scheduled' | 'live' | 'played' | 'walkover' | 'cancelled';
export type TiebreakerKey =
  | 'pts' | 'wins' | 'gd' | 'gf' | 'set_ratio' | 'point_ratio' | 'set_diff' | 'point_diff' | 'head_to_head';

/** Desempates disponibles, en el orden en que se ofrecen al organizador. */
export const TIEBREAKER_KEYS: TiebreakerKey[] = ['pts', 'wins', 'set_ratio', 'point_ratio', 'set_diff', 'point_diff', 'gd', 'gf', 'head_to_head'];

export interface StandingsPoints {
  win: number;
  draw: number;
  loss: number;
  /** Solo sets: victoria / derrota cuando el partido llegó al set decisivo (ej. vóley 2 y 1). */
  win_deciding_set?: number;
  loss_deciding_set?: number;
}

export interface ScoringConfig {
  model: ScoreModel;
  /** goals: ¿se permite empatar? (fútbol de liga sí; baloncesto no). */
  allow_draw: boolean;
  /** sets */
  best_of: number;
  set_points: number;
  deciding_set_points: number;
  win_by: number;
  cap: number | null;
  standings_points: StandingsPoints;
  walkover: {
    loser_points: number;
    /** sets: marcador de cada set ganado por W.O. */
    set_score: [number, number];
    /** goals: marcador del W.O. (ganador, perdedor). */
    goals: [number, number];
  };
  tiebreakers: TiebreakerKey[];
  by_category?: Record<string, Partial<Omit<ScoringConfig, 'by_category'>>>;
}

export const FOOTBALL_DEFAULT: ScoringConfig = {
  model: 'goals',
  allow_draw: true,
  best_of: 1,
  set_points: 0,
  deciding_set_points: 0,
  win_by: 1,
  cap: null,
  standings_points: { win: 3, draw: 1, loss: 0 },
  walkover: { loser_points: 0, set_score: [25, 0], goals: [1, 0] },
  tiebreakers: ['pts', 'gd', 'gf', 'head_to_head'],
};

/** Plantillas por deporte/modalidad. La escuela elige una; nunca edita JSON. */
export const SCORING_PRESETS: Record<string, { label: string; config: Partial<ScoringConfig> }> = {
  futbol: { label: 'Fútbol / Futsal (3-1-0, empates)', config: {} },
  baloncesto: {
    label: 'Baloncesto (2-1, sin empates)',
    config: { allow_draw: false, standings_points: { win: 2, draw: 0, loss: 1 }, tiebreakers: ['pts', 'gd', 'gf', 'head_to_head'], walkover: { loser_points: 0, set_score: [25, 0], goals: [20, 0] } },
  },
  voleibol_3: {
    label: 'Vóley a 2 de 3 sets (25, decisivo a 15)',
    config: { model: 'sets', best_of: 3, set_points: 25, deciding_set_points: 15, win_by: 2, cap: null, allow_draw: false,
      standings_points: { win: 3, draw: 0, loss: 0, win_deciding_set: 2, loss_deciding_set: 1 },
      tiebreakers: ['pts', 'wins', 'set_ratio', 'point_ratio', 'head_to_head'] },
  },
  voleibol_5: {
    label: 'Vóley a 3 de 5 sets (25, decisivo a 15)',
    config: { model: 'sets', best_of: 5, set_points: 25, deciding_set_points: 15, win_by: 2, cap: null, allow_draw: false,
      standings_points: { win: 3, draw: 0, loss: 0, win_deciding_set: 2, loss_deciding_set: 1 },
      tiebreakers: ['pts', 'wins', 'set_ratio', 'point_ratio', 'head_to_head'] },
  },
  voley_playa: {
    label: 'Vóley playa a 2 de 3 sets (21, decisivo a 15)',
    config: { model: 'sets', best_of: 3, set_points: 21, deciding_set_points: 15, win_by: 2, cap: null, allow_draw: false,
      standings_points: { win: 3, draw: 0, loss: 0, win_deciding_set: 2, loss_deciding_set: 1 },
      tiebreakers: ['pts', 'wins', 'set_ratio', 'point_ratio', 'head_to_head'], walkover: { loser_points: 0, set_score: [21, 0], goals: [1, 0] } },
  },
  badminton: {
    label: 'Bádminton a 2 de 3 sets (21, tope 30)',
    config: { model: 'sets', best_of: 3, set_points: 21, deciding_set_points: 21, win_by: 2, cap: 30, allow_draw: false,
      standings_points: { win: 2, draw: 0, loss: 0 }, tiebreakers: ['pts', 'set_ratio', 'point_ratio', 'head_to_head'], walkover: { loser_points: 0, set_score: [21, 0], goals: [1, 0] } },
  },
  tenis_mesa: {
    label: 'Tenis de mesa a 3 de 5 sets (11)',
    config: { model: 'sets', best_of: 5, set_points: 11, deciding_set_points: 11, win_by: 2, cap: null, allow_draw: false,
      standings_points: { win: 2, draw: 0, loss: 0 }, tiebreakers: ['pts', 'set_ratio', 'point_ratio', 'head_to_head'], walkover: { loser_points: 0, set_score: [11, 0], goals: [1, 0] } },
  },
  padel: {
    label: 'Pádel a 2 de 3 sets (a 6 games, diferencia de 2, tope 7)',
    config: { model: 'sets', best_of: 3, set_points: 6, deciding_set_points: 6, win_by: 2, cap: 7, allow_draw: false,
      standings_points: { win: 2, draw: 0, loss: 0 }, tiebreakers: ['pts', 'set_ratio', 'point_ratio', 'head_to_head'], walkover: { loser_points: 0, set_score: [6, 0], goals: [1, 0] } },
  },
};

/** Plantilla sugerida según el nombre visible del deporte. */
export function presetKeyForSport(sport: string | null | undefined): string {
  const s = (sport ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/voley.*playa|beach/.test(s)) return 'voley_playa';
  if (/voley|volley|voleibol/.test(s)) return 'voleibol_3';
  if (/baloncesto|basket|basquet/.test(s)) return 'baloncesto';
  if (/badminton/.test(s)) return 'badminton';
  if (/tenis.*mesa|ping/.test(s)) return 'tenis_mesa';
  if (/padel/.test(s)) return 'padel';
  return 'futbol';
}

function mergeConfig(base: ScoringConfig, over: Partial<ScoringConfig> | null | undefined): ScoringConfig {
  if (!over) return base;
  return {
    ...base,
    ...over,
    standings_points: { ...base.standings_points, ...(over.standings_points ?? {}) },
    walkover: { ...base.walkover, ...(over.walkover ?? {}) },
    tiebreakers: over.tiebreakers && over.tiebreakers.length ? over.tiebreakers : base.tiebreakers,
  } as ScoringConfig;
}

/**
 * Configuración efectiva: defaults de fútbol ← config del torneo ← ajustes de la categoría.
 * `raw = null` (torneo sin scoring_config) = fútbol 3-1-0, exactamente como hoy.
 */
export function resolveConfig(raw: Partial<ScoringConfig> | null | undefined, categoryId?: string | null): ScoringConfig {
  let cfg = mergeConfig(FOOTBALL_DEFAULT, raw ? { ...raw, by_category: undefined } : null);
  const cat = categoryId && raw?.by_category ? raw.by_category[categoryId] : null;
  if (cat) cfg = mergeConfig(cfg, cat);
  if (cfg.model === 'sets') {
    cfg.best_of = cfg.best_of % 2 === 0 ? cfg.best_of + 1 : Math.max(1, cfg.best_of);
    cfg.allow_draw = false;
  }
  return cfg;
}

export function validateConfig(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return 'La configuración de marcador debe ser un objeto';
  const c = raw as Record<string, any>;
  if (c.model != null && c.model !== 'goals' && c.model !== 'sets') return 'Modelo de marcador no soportado (goals | sets)';
  const num = (v: any, min: number, max: number) => v == null || (Number.isInteger(v) && v >= min && v <= max);
  if (!num(c.best_of, 1, 9)) return 'best_of debe ser un entero entre 1 y 9';
  if (!num(c.set_points, 1, 100) || !num(c.deciding_set_points, 1, 100)) return 'Los puntos por set deben estar entre 1 y 100';
  if (!num(c.win_by, 1, 5)) return 'win_by debe estar entre 1 y 5';
  if (c.cap != null && !num(c.cap, 1, 200)) return 'cap inválido';
  if (c.tiebreakers != null) {
    if (!Array.isArray(c.tiebreakers) || c.tiebreakers.length > TIEBREAKER_KEYS.length) return 'Los desempates deben ser una lista';
    if (c.tiebreakers.some((k: unknown) => !TIEBREAKER_KEYS.includes(k as TiebreakerKey))) return 'Hay un desempate desconocido';
    if (new Set(c.tiebreakers).size !== c.tiebreakers.length) return 'Un desempate está repetido';
  }
  if (c.by_category != null) {
    if (typeof c.by_category !== 'object' || Array.isArray(c.by_category)) return 'Las reglas por categoría deben ser un objeto';
    for (const sub of Object.values(c.by_category)) {
      if (sub != null && typeof sub === 'object' && 'by_category' in (sub as object)) return 'Una categoría no puede tener reglas por categoría';
      const bad = validateConfig(sub);
      if (bad) return `Categoría: ${bad}`;
    }
  }
  return null;
}

// ── Estado y derivación ──────────────────────────────────────────────────────

export interface LiveState {
  status: MatchStatus;
  /** Secuencia de puntos/goles: 'h' local, 'a' visitante. */
  points: string;
  /** Si el partido se resolvió por W.O., quién ganó. */
  walkover?: Side | null;
}

export interface SetScore { home: number; away: number; closed: boolean; deciding: boolean }

export interface Derived {
  homeScore: number; // sets ganados (sets) o goles (goals)
  awayScore: number;
  sets: SetScore[];
  setsToWin: number;
  /** El marcador ya define un ganador (sets) / hay al menos un resultado válido (goals). */
  decided: boolean;
  winner: Side | null;
  drawn: boolean;
  /** Puntos totales a favor (sets) o goles. */
  pointsHome: number;
  pointsAway: number;
}

export function setsToWin(cfg: ScoringConfig): number {
  return Math.floor(cfg.best_of / 2) + 1;
}

export function setTarget(cfg: ScoringConfig, setIndex: number): number {
  return setIndex === cfg.best_of - 1 ? cfg.deciding_set_points : cfg.set_points;
}

export function isSetClosed(home: number, away: number, target: number, winBy: number, cap: number | null): boolean {
  const max = Math.max(home, away);
  if (cap != null && max >= cap) return true;
  return max >= target && Math.abs(home - away) >= winBy;
}

export function derive(state: Pick<LiveState, 'points' | 'walkover' | 'status'>, cfg: ScoringConfig): Derived {
  const need = setsToWin(cfg);

  if (state.walkover) {
    if (cfg.model === 'sets') {
      const [w, l] = cfg.walkover.set_score;
      const sets: SetScore[] = Array.from({ length: need }, (_, i) => ({
        home: state.walkover === 'home' ? w : l, away: state.walkover === 'home' ? l : w, closed: true, deciding: i === cfg.best_of - 1,
      }));
      const pw = w * need, pl = l * need;
      return {
        homeScore: state.walkover === 'home' ? need : 0, awayScore: state.walkover === 'away' ? need : 0,
        sets, setsToWin: need, decided: true, winner: state.walkover, drawn: false,
        pointsHome: state.walkover === 'home' ? pw : pl, pointsAway: state.walkover === 'away' ? pw : pl,
      };
    }
    const [w, l] = cfg.walkover.goals;
    return {
      homeScore: state.walkover === 'home' ? w : l, awayScore: state.walkover === 'away' ? w : l,
      sets: [], setsToWin: need, decided: true, winner: state.walkover, drawn: false,
      pointsHome: state.walkover === 'home' ? w : l, pointsAway: state.walkover === 'away' ? w : l,
    };
  }

  if (cfg.model === 'goals') {
    let h = 0, a = 0;
    for (const ch of state.points) { if (ch === 'h') h++; else if (ch === 'a') a++; }
    return {
      homeScore: h, awayScore: a, sets: [], setsToWin: need, decided: true,
      winner: h > a ? 'home' : a > h ? 'away' : null, drawn: h === a, pointsHome: h, pointsAway: a,
    };
  }

  const sets: SetScore[] = [];
  let wonH = 0, wonA = 0;
  let cur: SetScore | null = null;
  for (const ch of state.points) {
    if (ch !== 'h' && ch !== 'a') continue;
    if (wonH >= need || wonA >= need) break; // puntos sobrantes tras decidirse: se ignoran
    if (!cur) { cur = { home: 0, away: 0, closed: false, deciding: sets.length === cfg.best_of - 1 }; sets.push(cur); }
    if (ch === 'h') cur.home++; else cur.away++;
    if (isSetClosed(cur.home, cur.away, setTarget(cfg, sets.length - 1), cfg.win_by, cfg.cap)) {
      cur.closed = true;
      if (cur.home > cur.away) wonH++; else wonA++;
      cur = null;
    }
  }
  const decided = wonH >= need || wonA >= need;
  return {
    homeScore: wonH, awayScore: wonA, sets, setsToWin: need, decided,
    winner: decided ? (wonH > wonA ? 'home' : 'away') : null, drawn: false,
    pointsHome: sets.reduce((s, x) => s + x.home, 0), pointsAway: sets.reduce((s, x) => s + x.away, 0),
  };
}

// ── Acciones ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'start' }
  | { type: 'point'; side: Side }
  | { type: 'undo' }
  | { type: 'finish' }
  | { type: 'reopen' }
  | { type: 'cancel' }
  | { type: 'walkover'; winner: Side }
  /** goals: { home, away }. sets: { sets: [[25,23],[20,25],[15,12]] }. */
  | { type: 'correct'; home?: number; away?: number; sets?: Array<[number, number]> };

export const ACTION_TYPES = ['start', 'point', 'undo', 'finish', 'reopen', 'cancel', 'walkover', 'correct'] as const;

export interface ApplyContext {
  /** Fase eliminatoria: no se admite empate al terminar. */
  knockout?: boolean;
}

export type ApplyResult =
  | { ok: true; state: LiveState; derived: Derived }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): ApplyResult => ({ ok: false, code, message });

export function emptyState(status: MatchStatus = 'scheduled'): LiveState {
  return { status, points: '', walkover: null };
}

/** Genera una secuencia de puntos que cierra el set justo en el marcador pedido (o null si es imposible). */
function sequenceForSet(h: number, a: number, target: number, cfg: ScoringConfig): string | null {
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h === a) return null;
  const hi = Math.max(h, a), lo = Math.min(h, a);
  const winCh = h > a ? 'h' : 'a', loseCh = h > a ? 'a' : 'h';
  // Alterna hasta igualar al perdedor y luego suma los del ganador: el set cierra exactamente al final.
  let seq = '';
  for (let i = 0; i < lo; i++) seq += loseCh + winCh;
  seq += winCh.repeat(hi - lo);
  if (!isSetClosed(h, a, target, cfg.win_by, cfg.cap)) return null;
  // Debe cerrar SOLO en el último punto.
  let ch = 0, cw = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === winCh) cw++; else ch++;
    const closed = isSetClosed(winCh === 'h' ? cw : ch, winCh === 'h' ? ch : cw, target, cfg.win_by, cfg.cap);
    if (closed && i < seq.length - 1) return null;
  }
  return seq;
}

export function applyAction(state: LiveState, action: Action, cfg: ScoringConfig, ctx: ApplyContext = {}): ApplyResult {
  const s: LiveState = { status: state.status, points: state.points ?? '', walkover: state.walkover ?? null };
  const done = (next: LiveState): ApplyResult => ({ ok: true, state: next, derived: derive(next, cfg) });

  switch (action.type) {
    case 'start':
      if (s.status !== 'scheduled') return fail('estado_invalido', 'Solo un partido programado puede iniciarse');
      return done({ ...s, status: 'live' });

    case 'point': {
      if (s.status !== 'live') return fail('no_en_juego', 'El partido no está en juego');
      if (action.side !== 'home' && action.side !== 'away') return fail('lado_invalido', 'Lado inválido');
      if (cfg.model === 'sets' && derive(s, cfg).decided) return fail('partido_decidido', 'El partido ya está decidido: termínalo o deshaz el último punto');
      return done({ ...s, points: s.points + (action.side === 'home' ? 'h' : 'a') });
    }

    case 'undo': {
      if (s.status !== 'live') return fail('no_en_juego', 'Solo se deshace con el partido en juego');
      if (!s.points) return fail('nada_que_deshacer', 'No hay puntos que deshacer');
      return done({ ...s, points: s.points.slice(0, -1) });
    }

    case 'finish': {
      if (s.status !== 'live') return fail('no_en_juego', 'El partido no está en juego');
      const d = derive(s, cfg);
      if (cfg.model === 'sets' && !d.decided) return fail('no_decidido', 'Aún no se define el ganador del partido');
      if (cfg.model === 'goals' && d.drawn && (!cfg.allow_draw || ctx.knockout)) {
        return fail('empate_no_permitido', ctx.knockout ? 'En eliminatoria no puede terminar empatado' : 'En este deporte no hay empate');
      }
      return done({ ...s, status: 'played' });
    }

    case 'reopen':
      if (s.status !== 'played' && s.status !== 'walkover') return fail('estado_invalido', 'Solo se reabre un partido terminado');
      return done({ ...s, status: 'live', walkover: null });

    case 'cancel':
      if (s.status !== 'scheduled') return fail('estado_invalido', 'Solo se cancela un partido programado');
      return done({ ...s, status: 'cancelled' });

    case 'walkover': {
      if (s.status !== 'scheduled' && s.status !== 'live') return fail('estado_invalido', 'El W.O. se declara en un partido programado o en juego');
      if (action.winner !== 'home' && action.winner !== 'away') return fail('lado_invalido', 'Indica quién gana por W.O.');
      return done({ status: 'walkover', points: '', walkover: action.winner });
    }

    case 'correct': {
      if (s.status === 'cancelled') return fail('estado_invalido', 'Un partido cancelado no admite marcador');
      let points = '';
      if (cfg.model === 'goals') {
        const h = action.home, a = action.away;
        if (!Number.isInteger(h) || !Number.isInteger(a) || (h as number) < 0 || (a as number) < 0 || (h as number) > 999 || (a as number) > 999) return fail('marcador_invalido', 'Marcador inválido');
        if (h === a && (!cfg.allow_draw || ctx.knockout)) return fail('empate_no_permitido', ctx.knockout ? 'En eliminatoria no puede terminar empatado' : 'En este deporte no hay empate');
        points = 'h'.repeat(h as number) + 'a'.repeat(a as number);
      } else {
        const list = action.sets;
        if (!Array.isArray(list) || list.length === 0) return fail('marcador_invalido', 'Indica el marcador de cada set');
        for (let i = 0; i < list.length; i++) {
          const seq = Array.isArray(list[i]) ? sequenceForSet(Number(list[i][0]), Number(list[i][1]), setTarget(cfg, i), cfg) : null;
          if (seq == null) return fail('marcador_invalido', `El set ${i + 1} no es un marcador válido para estas reglas`);
          points += seq;
        }
        const d = derive({ points, walkover: null, status: s.status }, cfg);
        if (d.sets.length !== list.length || !d.sets.every((x) => x.closed)) return fail('marcador_invalido', 'Hay sets de más o sets sin cerrar');
        if (!d.decided) return fail('marcador_invalido', 'Los sets no definen un ganador');
      }
      // Desde «programado» el marcador cargado cierra el partido (equivale al viejo «cargar resultado»).
      const status: MatchStatus = s.status === 'scheduled' || s.status === 'walkover' ? 'played' : s.status;
      return done({ status, points, walkover: null });
    }

    default:
      return fail('accion_desconocida', 'Acción desconocida');
  }
}

/** Resultado de un partido para la tabla, a partir de su estado (o del marcador entero si es anterior al motor). */
export interface Outcome {
  winner: Side | null;
  drawn: boolean;
  homeScore: number; awayScore: number; // sets ganados o goles
  setsHome: number; setsAway: number;
  pointsHome: number; pointsAway: number;
  deciding: boolean; // llegó al set decisivo
  walkover: boolean;
}

export function matchOutcome(
  m: { status: string; home_score: number | null; away_score: number | null; live_state?: Partial<LiveState> | null },
  cfg: ScoringConfig,
): Outcome | null {
  if (m.status !== 'played' && m.status !== 'walkover') return null;
  const ls = m.live_state && typeof m.live_state === 'object' ? m.live_state : null;
  if (ls && (typeof ls.points === 'string' || ls.walkover)) {
    const d = derive({ points: ls.points ?? '', walkover: (ls.walkover as Side | null) ?? null, status: m.status as MatchStatus }, cfg);
    const total = d.homeScore + d.awayScore;
    return {
      winner: d.winner, drawn: d.drawn, homeScore: d.homeScore, awayScore: d.awayScore,
      setsHome: cfg.model === 'sets' ? d.homeScore : 0, setsAway: cfg.model === 'sets' ? d.awayScore : 0,
      pointsHome: d.pointsHome, pointsAway: d.pointsAway,
      deciding: cfg.model === 'sets' && cfg.best_of > 1 && total === cfg.best_of, walkover: m.status === 'walkover',
    };
  }
  // Partido anterior al motor: solo marcador entero.
  const hs = Number(m.home_score ?? 0), as = Number(m.away_score ?? 0);
  const winner: Side | null = hs > as ? 'home' : as > hs ? 'away' : null;
  return {
    winner, drawn: hs === as, homeScore: hs, awayScore: as,
    setsHome: cfg.model === 'sets' ? hs : 0, setsAway: cfg.model === 'sets' ? as : 0,
    pointsHome: hs, pointsAway: as,
    deciding: cfg.model === 'sets' && cfg.best_of > 1 && hs + as === cfg.best_of, walkover: m.status === 'walkover',
  };
}
