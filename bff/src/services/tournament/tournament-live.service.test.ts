import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/supabase', async () => {
  const kit = await import('./fakeDb.testkit');
  return { supabase: kit.fakeSupabase };
});

import { db, resetDb, seedEvent, seedTeams, seedCategory } from './fakeDb.testkit';
import {
  LiveError, loadEvent, loadMatches, performMatchAction, generateCategoryFixtures, buildCategoryStandings, patchConfig, getConfig,
  createScorekeeper, authScorekeeper, revokeScorekeeper, scorerMatches, publicLive, _clearPublicCache, takeMatch, validateStreamUrl,
  Actor, LiveEvent,
} from './tournament-live.service';
import { SCORING_PRESETS } from './scoring.shared';

const admin: Actor = { type: 'user', id: 'u1', label: 'Administración' };
const volleyCfg = { ...SCORING_PRESETS.voleibol_3.config };

async function setup(opts: { live?: boolean; scoring?: any; teams?: number } = {}) {
  resetDb(); _clearPublicCache();
  const ev = seedEvent({ live_enabled: opts.live ?? true, scoring_config: opts.scoring === undefined ? volleyCfg : opts.scoring });
  const cat = seedCategory(ev.id);
  seedTeams(ev.id, cat, opts.teams ?? 4);
  const live = (await loadEvent(ev.id)) as LiveEvent;
  return { ev: live, cat };
}

const act = (ev: LiveEvent, matchId: string, action: any, extra: Record<string, any> = {}, actor: Actor = admin) =>
  performMatchAction(ev, matchId, actor, { action, ...extra });

/** Juega un partido de vóley completo: gana `winner` por 2-0 (o 2-1 si `three`). */
async function playVolley(ev: LiveEvent, matchId: string, winner: 'home' | 'away', three = false) {
  await act(ev, matchId, { type: 'start' });
  const w = winner, l = winner === 'home' ? 'away' : 'home';
  const pts = async (side: 'home' | 'away', n: number) => { for (let i = 0; i < n; i++) await act(ev, matchId, { type: 'point', side }); };
  if (three) { await pts(w, 25); await pts(l, 25); await pts(w, 15); } else { await pts(w, 25); await pts(w, 25); }
  return act(ev, matchId, { type: 'finish' });
}

describe('performMatchAction — vía única', () => {
  it('start → puntos → finish guarda estado, marcador, versión y log', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    const r = await playVolley(ev, m.id, 'home');
    expect(r.match.status).toBe('played');
    expect(r.match.home_score).toBe(2);
    expect(r.match.away_score).toBe(0);
    expect(r.match.sets).toHaveLength(2);
    const row = db.tables.tournament_matches.find((x) => x.id === m.id)!;
    expect(row.version).toBe(52); // start + 50 puntos + finish
    expect(row.finished_at).toBeTruthy();
    expect(db.tables.tournament_match_log).toHaveLength(52);
    expect(db.tables.tournament_match_log[0]).toMatchObject({ action: 'start', actor_type: 'user' });
  });

  it('un reintento con el mismo client_action_id no se aplica dos veces', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await act(ev, m.id, { type: 'start' });
    const first = await act(ev, m.id, { type: 'point', side: 'home' }, { client_action_id: 'abc' });
    const again = await act(ev, m.id, { type: 'point', side: 'home' }, { client_action_id: 'abc' });
    expect(first.duplicate).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(db.tables.tournament_matches.find((x) => x.id === m.id)!.live_state.points).toBe('h');
    expect(db.tables.tournament_match_log.filter((l) => l.client_action_id === 'abc')).toHaveLength(1);
  });

  it('dos acciones con la misma versión: una se aplica y la otra recibe conflicto con el partido actual', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await act(ev, m.id, { type: 'start' });
    const v = db.tables.tournament_matches.find((x) => x.id === m.id)!.version;
    await act(ev, m.id, { type: 'point', side: 'home' }, { expected_version: v });
    await expect(act(ev, m.id, { type: 'point', side: 'away' }, { expected_version: v })).rejects.toMatchObject({ status: 409, code: 'version_conflict' });
    try { await act(ev, m.id, { type: 'point', side: 'away' }, { expected_version: v }); } catch (e: any) { expect(e.extra.match.version).toBe(v + 1); }
  });

  it('reglas del motor: terminar sin ganador → 422', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await act(ev, m.id, { type: 'start' });
    await expect(act(ev, m.id, { type: 'finish' })).rejects.toMatchObject({ status: 422, code: 'no_decidido' });
  });

  it('con «en vivo» apagado solo se carga el resultado final; iniciar da 403', async () => {
    const { ev, cat } = await setup({ live: false, teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await expect(act(ev, m.id, { type: 'start' })).rejects.toMatchObject({ status: 403, code: 'live_disabled' });
    const r = await act(ev, m.id, { type: 'correct', sets: [[25, 23], [20, 25], [15, 12]] });
    expect(r.match).toMatchObject({ status: 'played', home_score: 2, away_score: 1 });
    // y se puede corregir un resultado ya cargado
    const fix = await act(ev, m.id, { type: 'correct', sets: [[25, 10], [25, 10]] });
    expect(fix.match.away_score).toBe(0);
  });

  it('el interruptor global apaga lo en vivo en todos los torneos', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    process.env.TOURNAMENT_LIVE_DISABLED = 'true';
    try { await expect(act(ev, m.id, { type: 'start' })).rejects.toMatchObject({ code: 'live_disabled' }); }
    finally { delete process.env.TOURNAMENT_LIVE_DISABLED; }
  });

  it('un partido sin los dos equipos no se puede anotar', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'copa', { seed: 1 });
    const final = (await loadMatches(ev.id, cat)).find((x) => x.round === 2)!;
    await expect(act(ev, final.id, { type: 'start' })).rejects.toMatchObject({ code: 'equipos_sin_definir' });
  });

  it('un anotador activo por partido: otro necesita tomarlo', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await act(ev, m.id, { type: 'start' });
    const mesa: Actor = { type: 'scorekeeper', id: 's1', label: 'Mesa cancha 1' };
    await expect(act(ev, m.id, { type: 'point', side: 'home' }, {}, mesa)).rejects.toMatchObject({ status: 409, code: 'otro_anotador' });
    await takeMatch(ev, m.id, mesa);
    const ok = await act(ev, m.id, { type: 'point', side: 'home' }, {}, mesa);
    expect(ok.match.home_score).toBe(0);
    expect(db.tables.tournament_matches.find((x) => x.id === m.id)!.scorer_label).toBe('Mesa cancha 1');
  });

  it('acción inválida → 400', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await expect(act(ev, m.id, { type: 'explotar' })).rejects.toMatchObject({ status: 400 });
  });

  it('fútbol sin configuración: «cargar resultado» como antes, y avisa a las familias', async () => {
    const { ev, cat } = await setup({ live: false, scoring: null, teams: 2 });
    const [t1] = db.tables.event_teams;
    db.tables.event_team_members.push({ team_id: t1.id, profile_id: 'p1', child_id: null });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    const r = await act(ev, m.id, { type: 'correct', home: 3, away: 1 });
    expect(r.match).toMatchObject({ status: 'played', home_score: 3, away_score: 1, model: 'goals' });
    await new Promise((res) => setTimeout(res, 10));
    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0].message).not.toMatch(/podés/);
  });
});

describe('copa', () => {
  it('los ganadores avanzan y el tercer puesto recibe a los perdedores', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'copa', { seed: 3, third_place: true });
    let ms = await loadMatches(ev.id, cat);
    const semis = ms.filter((m) => m.stage === 'knockout' && m.round === 1);
    await playVolley(ev, semis[0].id, 'home');
    await playVolley(ev, semis[1].id, 'away');
    ms = await loadMatches(ev.id, cat);
    const final = ms.find((m) => m.stage === 'knockout' && m.round === 2)!;
    const third = ms.find((m) => m.stage === 'third_place')!;
    expect(final.home_team_id).toBe(semis[0].home_team_id);
    expect(final.away_team_id).toBe(semis[1].away_team_id);
    expect(third.home_team_id).toBe(semis[0].away_team_id);
    expect(third.away_team_id).toBe(semis[1].home_team_id);
  });

  it('en eliminatoria un empate en goles se rechaza', async () => {
    const { ev, cat } = await setup({ live: false, scoring: null, teams: 4 });
    await generateCategoryFixtures(ev, cat, 'copa', { seed: 1 });
    const m = (await loadMatches(ev.id, cat)).find((x) => x.round === 1)!;
    await expect(act(ev, m.id, { type: 'correct', home: 1, away: 1 })).rejects.toMatchObject({ code: 'empate_no_permitido' });
  });

  it('no se puede cambiar un semifinal si la final ya empezó con otro ganador', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'copa', { seed: 3 });
    const semis = (await loadMatches(ev.id, cat)).filter((m) => m.round === 1);
    await playVolley(ev, semis[0].id, 'home');
    await playVolley(ev, semis[1].id, 'home');
    const final = (await loadMatches(ev.id, cat)).find((m) => m.round === 2)!;
    await act(ev, final.id, { type: 'start' });
    await expect(act(ev, semis[0].id, { type: 'reopen' })).rejects.toMatchObject({ code: 'siguiente_ronda_en_curso' });
    await expect(act(ev, semis[0].id, { type: 'correct', sets: [[10, 25], [10, 25]] })).rejects.toMatchObject({ code: 'siguiente_ronda_en_curso' });
  });

  it('corregir un semifinal con la final aún programada recalcula el finalista', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'copa', { seed: 3 });
    const semis = (await loadMatches(ev.id, cat)).filter((m) => m.round === 1);
    await playVolley(ev, semis[0].id, 'home');
    await act(ev, semis[0].id, { type: 'correct', sets: [[10, 25], [10, 25]] });
    const final = (await loadMatches(ev.id, cat)).find((m) => m.round === 2)!;
    expect(final.home_team_id).toBe(semis[0].away_team_id);
  });

  it('con 3 equipos el bye pasa solo a la siguiente ronda', async () => {
    const { ev, cat } = await setup({ teams: 3 });
    await generateCategoryFixtures(ev, cat, 'copa', { seed: 1 });
    const ms = await loadMatches(ev.id, cat);
    const bye = ms.find((m) => m.round === 1 && m.status === 'walkover')!;
    expect(bye).toBeTruthy();
    const final = ms.find((m) => m.round === 2)!;
    expect(final.home_team_id || final.away_team_id).toBeTruthy();
  });
});

describe('grupos + fase final (torneo completo)', () => {
  it('8 equipos, 2 grupos: al terminar los grupos se arman los cruces y se juega hasta la final', async () => {
    const { ev, cat } = await setup({ teams: 8 });
    const gen = await generateCategoryFixtures(ev, cat, 'grupos', { seed: 7, groups: { count: 2, advance: 2 } });
    expect(gen.matches).toBe(15);

    let ms = await loadMatches(ev.id, cat);
    const groupMs = ms.filter((m) => m.stage === 'group');
    expect(groupMs).toHaveLength(12);
    // antes de terminar los grupos la fase final no tiene equipos
    expect(ms.filter((m) => m.stage === 'knockout' && m.round === 1).every((m) => !m.home_team_id && !m.away_team_id)).toBe(true);

    // gana siempre el local de cada partido de grupo, 2-0
    for (const g of groupMs) await playVolley(ev, g.id, 'home');

    ms = await loadMatches(ev.id, cat);
    const semis = ms.filter((m) => m.stage === 'knockout' && m.round === 1);
    expect(semis.every((m) => m.home_team_id && m.away_team_id)).toBe(true);
    const st = await buildCategoryStandings(ev, cat);
    expect(Object.keys(st.groups!)).toEqual(['A', 'B']);
    const firstA = st.groups!.A[0].team_id, secondA = st.groups!.A[1].team_id;
    const firstB = st.groups!.B[0].team_id, secondB = st.groups!.B[1].team_id;
    const pairs = semis.map((m) => [m.home_team_id, m.away_team_id].sort().join('|'));
    expect(pairs.sort()).toEqual([[firstA, secondB].sort().join('|'), [firstB, secondA].sort().join('|')].sort());

    await playVolley(ev, semis[0].id, 'home');
    await playVolley(ev, semis[1].id, 'away');
    const final = (await loadMatches(ev.id, cat)).find((m) => m.stage === 'knockout' && m.round === 2)!;
    expect(final.home_team_id && final.away_team_id).toBeTruthy();
    const done = await playVolley(ev, final.id, 'home', true);
    expect(done.match).toMatchObject({ status: 'played', home_score: 2, away_score: 1 });
  });

  it('corregir un partido de grupo después de armada la fase final recalcula si no empezó', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'grupos', { seed: 2, groups: { count: 1, advance: 2 } });
    const groupMs = (await loadMatches(ev.id, cat)).filter((m) => m.stage === 'group');
    for (const g of groupMs) await playVolley(ev, g.id, 'home');
    let final = (await loadMatches(ev.id, cat)).find((m) => m.stage === 'knockout')!;
    expect(final.home_team_id && final.away_team_id).toBeTruthy();

    // invertimos TODOS los resultados: cambian los clasificados mientras la fase final no empezó
    for (const g of groupMs) await act(ev, g.id, { type: 'correct', sets: [[10, 25], [10, 25]] });
    final = (await loadMatches(ev.id, cat)).find((m) => m.stage === 'knockout')!;
    expect(final.home_team_id && final.away_team_id).toBeTruthy();
  });

  it('si la fase final ya empezó, corregir un grupo guarda el marcador pero avisa que no cambia los cruces', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'grupos', { seed: 2, groups: { count: 1, advance: 2 } });
    const groupMs = (await loadMatches(ev.id, cat)).filter((m) => m.stage === 'group');
    for (const g of groupMs) await playVolley(ev, g.id, 'home');
    const final = (await loadMatches(ev.id, cat)).find((m) => m.stage === 'knockout')!;
    await act(ev, final.id, { type: 'start' });
    let warning: string | undefined;
    for (const g of groupMs) { const r: any = await act(ev, g.id, { type: 'correct', sets: [[10, 25], [10, 25]] }); warning = warning ?? r.warning; }
    expect(warning).toMatch(/fase final ya empezó/);
  });
});

describe('generateCategoryFixtures', () => {
  it('valida la configuración con mensaje legible', async () => {
    const { ev, cat } = await setup({ teams: 3 });
    await expect(generateCategoryFixtures(ev, cat, 'grupos', { groups: { count: 3, advance: 1 } })).rejects.toMatchObject({ status: 400, code: 'config_invalida' });
    await expect(generateCategoryFixtures(ev, cat, 'quiniela' as any, {})).rejects.toMatchObject({ code: 'formato_invalido' });
  });
  it('regenerar reemplaza lo programado; con partidos jugados se bloquea', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const a = (await loadMatches(ev.id, cat)).length;
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 2, double_round: true });
    expect((await loadMatches(ev.id, cat)).length).toBe(a * 2);
    const [m] = await loadMatches(ev.id, cat);
    await playVolley(ev, m.id, 'home');
    await expect(generateCategoryFixtures(ev, cat, 'copa', {})).rejects.toMatchObject({ status: 409, code: 'hay_partidos_jugados' });
  });
  it('guarda formato, semilla y reglas en el torneo; liga parcial y con calendario', async () => {
    const { ev, cat } = await setup({ teams: 6 });
    const r = await generateCategoryFixtures(ev, cat, 'liga', { seed: 'x', matches_per_team: 2, schedule: { start: '2026-11-07T08:00:00-05:00', courts: 2, slot_minutes: 50 } });
    expect(r.matches).toBe(6);
    const stored = db.tables.events.find((e) => e.id === ev.id)!;
    expect(stored.competition_format).toBe('liga');
    expect(stored.format_config.matches_per_team).toBe(2);
    const ms = await loadMatches(ev.id, cat);
    expect(ms.every((m) => m.court && m.scheduled_at)).toBe(true);
  });
  it('los tres formatos conviven en categorías distintas del mismo torneo', async () => {
    resetDb(); _clearPublicCache();
    const e = seedEvent({ scoring_config: volleyCfg, live_enabled: true });
    const c1 = seedCategory(e.id), c2 = seedCategory(e.id), c3 = seedCategory(e.id);
    seedTeams(e.id, c1, 4); seedTeams(e.id, c2, 4); seedTeams(e.id, c3, 8);
    const ev = (await loadEvent(e.id)) as LiveEvent;
    await generateCategoryFixtures(ev, c1, 'liga', { seed: 1 });
    await generateCategoryFixtures(ev, c2, 'copa', { seed: 1 });
    await generateCategoryFixtures(ev, c3, 'grupos', { seed: 1, groups: { count: 2, advance: 2 } });
    expect((await loadMatches(ev.id, c1)).every((m) => m.stage === 'league')).toBe(true);
    expect((await loadMatches(ev.id, c2)).every((m) => m.stage === 'knockout')).toBe(true);
    expect((await loadMatches(ev.id, c3)).some((m) => m.stage === 'group')).toBe(true);
    // jugar el primer partido de liga no toca las otras categorías
    const m = (await loadMatches(ev.id, c1))[0];
    await playVolley(ev, m.id, 'home');
    expect((await loadMatches(ev.id, c2)).every((x) => x.status === 'scheduled' || x.status === 'walkover')).toBe(true);
  });
});

describe('configuración del torneo', () => {
  it('aplica una plantilla, valida el enlace de transmisión y respeta partidos en juego', async () => {
    const { ev, cat } = await setup({ live: false, scoring: null, teams: 2 });
    await patchConfig(ev, { preset: 'voleibol_5', live_enabled: true, stream_url: 'https://www.youtube.com/live/abc' });
    const stored = db.tables.events.find((e) => e.id === ev.id)!;
    expect(stored.live_enabled).toBe(true);
    expect(stored.scoring_config.best_of).toBe(5);
    await expect(patchConfig(ev, { stream_url: 'http://youtube.com/x' })).rejects.toMatchObject({ code: 'stream_invalido' });
    await expect(patchConfig(ev, { stream_url: 'https://malicioso.com/x' })).rejects.toMatchObject({ code: 'stream_invalido' });
    await expect(patchConfig(ev, { preset: 'cricket' })).rejects.toMatchObject({ code: 'preset_invalido' });
    await expect(patchConfig(ev, {})).rejects.toMatchObject({ code: 'nada' });

    const live = (await loadEvent(ev.id)) as LiveEvent;
    await generateCategoryFixtures(live, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await act(live, m.id, { type: 'start' });
    await expect(patchConfig(live, { preset: 'voleibol_3' })).rejects.toMatchObject({ code: 'partidos_en_juego' });
  });
  it('getConfig sugiere plantilla por deporte y lista las disponibles', async () => {
    const { ev } = await setup({ scoring: null });
    const cfg = await getConfig(ev);
    expect(cfg.suggested_preset).toBe('voleibol_3');
    expect(cfg.presets.map((p) => p.key)).toContain('padel');
    expect(cfg.global_live_disabled).toBe(false);
  });
  it('validateStreamUrl acepta dominios permitidos y vacío', () => {
    expect(validateStreamUrl('')).toBeNull();
    expect(validateStreamUrl('https://youtu.be/abc')).toContain('youtu.be');
    expect(() => validateStreamUrl('javascript:alert(1)')).toThrow(LiveError);
  });
});

describe('anotadores sin cuenta', () => {
  it('el token se muestra una vez, solo se guarda el hash y sirve hasta que se revoca', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    const created = await createScorekeeper(ev, 'u1', { label: 'Mesa cancha 1', expires_hours: 5 }, 'https://app.sportmaps.co');
    expect(created.url).toBe(`https://app.sportmaps.co/anotador/${created.token}`);
    const stored = db.tables.tournament_scorekeepers[0];
    expect(stored.token_hash).not.toContain(created.token);
    expect(JSON.stringify(stored)).not.toContain(created.token);

    const sk = await authScorekeeper(created.token);
    expect(sk.label).toBe('Mesa cancha 1');

    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const list = await scorerMatches(sk);
    expect(list.length).toBeGreaterThan(0);
    const m = list[0];
    const r = await performMatchAction(sk.event, m.id, { type: 'scorekeeper', id: sk.id, label: sk.label }, { action: { type: 'start' } });
    expect(r.match.status).toBe('live');

    await revokeScorekeeper(ev.id, created.id);
    await expect(authScorekeeper(created.token)).rejects.toMatchObject({ code: 'token_revocado' });
  });
  it('rechaza tokens inventados, vencidos y vacíos', async () => {
    const { ev } = await setup();
    await expect(authScorekeeper('x'.repeat(43))).rejects.toMatchObject({ status: 401, code: 'token_invalido' });
    await expect(authScorekeeper('corto')).rejects.toMatchObject({ code: 'token_invalido' });
    const c = await createScorekeeper(ev, 'u1', { label: 'Mesa', expires_hours: 1 }, 'https://x.co');
    db.tables.tournament_scorekeepers[0].expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(authScorekeeper(c.token)).rejects.toMatchObject({ code: 'token_vencido' });
  });
  it('exige nombre y limita la cancha del enlace', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    await expect(createScorekeeper(ev, 'u1', { label: '  ' }, 'https://x.co')).rejects.toMatchObject({ code: 'label_requerido' });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1, schedule: { start: '2026-11-07T08:00:00-05:00', courts: 2, slot_minutes: 50 } });
    const c = await createScorekeeper(ev, 'u1', { label: 'Mesa 2', court: 'Cancha 2', expires_hours: 5 }, 'https://x.co');
    const sk = await authScorekeeper(c.token);
    const mine = await scorerMatches(sk);
    expect(mine.every((m: any) => m.court === 'Cancha 2')).toBe(true);
  });
});

describe('lectura pública', () => {
  const FORBIDDEN = ['version', 'live_state', 'scorer_label', 'scorer_ref', 'config', 'profile_id', 'child_id', 'email', 'phone', 'document', 'payment'];

  it('muestra equipos, marcadores y tablas, sin datos internos ni de personas', async () => {
    const { ev, cat } = await setup({ teams: 4 });
    db.tables.event_team_members.push({ team_id: db.tables.event_teams[0].id, full_name: 'Niña Menor de Edad', profile_id: 'p', child_id: 'c' });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await playVolley(ev, m.id, 'home');
    const out = (await publicLive(ev.slug!))!;
    const text = JSON.stringify(out.payload);
    for (const f of FORBIDDEN) expect(text, f).not.toContain(`"${f}"`);
    expect(text).not.toContain('Menor de Edad');
    expect(out.payload.event).toMatchObject({ title: 'Copa Monster', live_enabled: true, school_name: 'Monster Volley' });
    expect(out.payload.matches).toHaveLength(6);
    expect(out.payload.matches.find((x: any) => x.id === m.id)).toMatchObject({ status: 'played', home_score: 2 });
    expect(out.payload.standings[cat].standings[0].Pts).toBe(3);
    expect(out.payload.categories[0].name).toBe('Infantil · A · Sub 14 · Femenina');
    expect(out.etag).toMatch(/^"/);
  });

  it('cachea 5 s: dos lecturas seguidas hacen una sola consulta a la base', async () => {
    const { ev } = await setup();
    const spy = vi.spyOn(db.tables.events, 'filter');
    await publicLive(ev.slug!);
    const calls = spy.mock.calls.length;
    await publicLive(ev.slug!);
    expect(spy.mock.calls.length).toBe(calls);
    spy.mockRestore();
  });

  it('slug desconocido o torneo privado sin en vivo → null', async () => {
    const { ev } = await setup({ live: false });
    expect(await publicLive('no-existe')).toBeNull();
    db.tables.events.find((e) => e.id === ev.id)!.visibility = 'school_only';
    _clearPublicCache();
    expect(await publicLive(ev.slug!)).toBeNull();
  });

  it('en vivo apagado: no muestra marcadores de partidos en juego ni el enlace de video', async () => {
    const { ev, cat } = await setup({ teams: 2 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const [m] = await loadMatches(ev.id, cat);
    await act(ev, m.id, { type: 'start' });
    await act(ev, m.id, { type: 'point', side: 'home' });
    db.tables.events.find((e) => e.id === ev.id)!.live_enabled = false;
    db.tables.events.find((e) => e.id === ev.id)!.stream_url = 'https://youtu.be/x';
    _clearPublicCache();
    const out = (await publicLive(ev.slug!))!;
    expect(out.payload.event.live_enabled).toBe(false);
    expect(out.payload.event.stream_url).toBeNull();
    expect(out.payload.matches[0]).toMatchObject({ status: 'scheduled', home_score: null });
  });
});

describe('carga: 500 lecturas públicas con caché', () => {
  it('500 espectadores en 5 s hacen una sola ronda de consultas', async () => {
    const { ev, cat } = await setup({ teams: 8 });
    await generateCategoryFixtures(ev, cat, 'liga', { seed: 1 });
    const spy = vi.spyOn(db.tables.tournament_matches, 'filter');
    await publicLive(ev.slug!);
    const base = spy.mock.calls.length;
    await Promise.all(Array.from({ length: 500 }, () => publicLive(ev.slug!)));
    expect(spy.mock.calls.length).toBe(base);
    spy.mockRestore();
  });
});
