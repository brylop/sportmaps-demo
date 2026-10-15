/**
 * «Ajustes de la pizarra» (M6g, docs/specs/pizarra-m6-paridad-tacticalpad.md §4):
 * curvas de velocidad, rastros, posesión del balón, persistencia por usuario y
 * tema. Un error acá se ve como un balón que no sigue al jugador, una jugada
 * que en el GIF va a otro ritmo que en la pizarra, o los ajustes de un coach
 * que le aparecen al siguiente que usa el teléfono.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ANIMATION_CURVES, BOARD_SETTINGS_PREFIX, DEFAULT_BOARD_SETTINGS, applyCurve, boardSettingsKey,
  clearBoardSettings, loadBoardSettings, normalizeBoardSettings, playbackOptionsOf, saveBoardSettings,
  teamOfKey, type AnimationCurve, type SettingsStorage, type TacticalBoardSettings,
} from '@/lib/school/tacticalBoardSettings';
import {
  BALL_OFFSET, ballAnchor, hasPossession, passesOf, passesUntil, placeBallShape, possessionBallAt,
  remapBallOwner, setBallOwner,
} from '@/lib/school/tacticalPossession';
import { ballTrailAt, playerTrailsAt, trailSegmentOpacity } from '@/lib/school/tacticalTrails';
import {
  duplicateFrameAt, frameDuration, hydrateFrames, interpolateFrames, serializeFrames,
} from '@/lib/school/tacticalAnimation';
import { interpolateFrames as exportInterpolate } from '@/lib/export/tacticalInterpolation';
import { computeLive, court3D, toMeters } from '@/lib/school/tactical3d';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import { TacticalBoardSettingsButton } from '@/components/school/TacticalBoardSettingsDialog';
import { PinNameTag, TacticalBoardPrefsProvider, shortPlayerName, type TacticalBoardPrefs } from '@/components/school/tacticalBoardPrefs';

const CURVES: AnimationCurve[] = ANIMATION_CURVES.map((c) => c.id);
const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

const fr = (id: string, over: Partial<TacticalFrame> = {}): TacticalFrame => ({
  id, duration_ms: 1000, players: [], ball: null, arrows: [], ...over,
});
const ballShape = (x: number, y: number): TacticalArrow => ({ type: 'ball', x1: x, y1: y, x2: x, y2: y });

/** Almacenamiento en memoria con la misma interfaz que localStorage. */
function memoryStorage(): SettingsStorage & { dump: () => Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    dump: () => Object.fromEntries(m),
  };
}

// ─── Curvas ─────────────────────────────────────────────────────────────────

describe('applyCurve', () => {
  it.each(CURVES)('%s: 0 en 0 y 1 en 1', (c) => {
    expect(applyCurve(c, 0)).toBe(0);
    expect(applyCurve(c, 1)).toBe(1);
  });

  it.each(CURVES)('%s: monótona creciente y dentro de [0,1]', (c) => {
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const v = applyCurve(c, i / 200);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });

  it.each(CURVES)('%s: recorta fuera de rango y NaN', (c) => {
    expect(applyCurve(c, -2)).toBe(0);
    expect(applyCurve(c, 5)).toBe(1);
    expect(applyCurve(c, Number.NaN)).toBe(0);
  });

  it('cada curva tiene su forma: lineal = t, rápida al inicio adelanta, rápida al final atrasa', () => {
    close(applyCurve('lineal', 0.3), 0.3);
    expect(applyCurve('rapida_inicio', 0.3)).toBeGreaterThan(0.3);
    expect(applyCurve('rapida_final', 0.3)).toBeLessThan(0.3);
    expect(applyCurve('suave', 0.1)).toBeLessThan(0.1);
    expect(applyCurve('suave', 0.9)).toBeGreaterThan(0.9);
  });

  it('«suave» es la easeInOutCubic de siempre (las jugadas viejas no cambian) y es la por defecto', () => {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const old = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      close(applyCurve('suave', t), old);
      close(applyCurve(undefined, t), old);
    }
    expect(DEFAULT_BOARD_SETTINGS.curve).toBe('suave');
  });
});

// ─── Mismo instante = misma posición en 2D, export y 3D ─────────────────────

describe('la curva se aplica igual en la pizarra 2D, el GIF/video y el 3D', () => {
  const frames: TacticalFrame[] = [
    fr('a', { players: [{ key: 'p1', x: 10, y: 20 }, { key: 'p2', x: 60, y: 60 }], arrows: [ballShape(12, 22)] }),
    fr('b', { duration_ms: 1500, players: [{ key: 'p1', x: 50, y: 70 }, { key: 'p2', x: 40, y: 30 }], arrows: [ballShape(52, 72)] }),
    fr('c', { duration_ms: 800, players: [{ key: 'p1', x: 80, y: 40 }, { key: 'p2', x: 20, y: 10 }], arrows: [ballShape(82, 42)] }),
  ];
  const court = court3D('futbol');

  it.each(CURVES)('%s: jugadores en el mismo lugar en los tres', (curve) => {
    for (const t of [0, 137, 500, 1000, 1499, 1900, 2299, 2300, 5000]) {
      const p2d = interpolateFrames(frames, t, { curve });
      const pExp = exportInterpolate(frames, t, curve);
      const live = computeLive(court, frames, null, t, curve);
      for (const p of p2d.players) {
        const q = pExp.players.find((x) => x.key === p.key)!;
        close(q.x, p.x); close(q.y, p.y);
        const r = live.main.players.find((x) => x.key === p.key)!;
        close(r.x, p.x); close(r.y, p.y);
      }
    }
  });

  it('a mitad de una transición, cada curva deja al jugador en otro punto', () => {
    const at = (curve: AnimationCurve) => interpolateFrames(frames, 300, { curve }).players.find((p) => p.key === 'p1')!.x;
    const lineal = at('lineal');
    close(lineal, 10 + 40 * (300 / 1500));
    expect(at('rapida_inicio')).toBeGreaterThan(lineal);
    expect(at('rapida_final')).toBeLessThan(lineal);
  });

  it('con posesión, el balón está en el mismo lugar en 2D, export y 3D', () => {
    const owned = frames.map((f, i) => ({ ...f, ball_owner: i === 2 ? 'p2' : 'p1' }));
    for (const curve of CURVES) {
      for (const t of [0, 400, 1200, 1800, 2300]) {
        const bp = possessionBallAt(owned, t, curve, frameDuration)!;
        const b2d = interpolateFrames(owned, t, { curve }).arrows.find((a) => a.shape.type === 'ball')!.shape;
        close(b2d.x1, bp.x); close(b2d.y1, bp.y);
        const bExp = exportInterpolate(owned, t, curve).ball!;
        close(bExp.x, bp.x); close(bExp.y, bp.y);
        const b3d = computeLive(court, owned, null, t, curve).ball!;
        const m = toMeters(court, bp.x, bp.y);
        close(b3d.x, m.x); close(b3d.z, m.z);
      }
    }
  });
});

// ─── Rastros ────────────────────────────────────────────────────────────────

describe('playerTrailsAt: ruta acumulada hasta t', () => {
  const frames: TacticalFrame[] = [
    fr('a', { players: [{ key: 'athlete:1', x: 10, y: 10 }, { key: 'rival:1', x: 90, y: 90 }] }),
    fr('b', { players: [{ key: 'athlete:1', x: 30, y: 10 }, { key: 'rival:1', x: 70, y: 90 }] }),
    fr('c', { players: [{ key: 'athlete:1', x: 30, y: 50 }, { key: 'rival:1', x: 70, y: 50 }] }),
  ];
  const both = { home: true, away: true };

  it('en t=0 no hay rastro; en el medio del tramo 1 llega hasta la posición de ahora', () => {
    expect(playerTrailsAt(frames, 0, 'lineal', frameDuration, both)).toEqual([]);
    const home = playerTrailsAt(frames, 500, 'lineal', frameDuration, both).find((t) => t.key === 'athlete:1')!;
    expect(home.points).toEqual([{ x: 10, y: 10 }, { x: 20, y: 10 }]);
  });

  it('en el segundo tramo acumula el primero completo + lo recorrido del segundo', () => {
    const home = playerTrailsAt(frames, 1500, 'lineal', frameDuration, both).find((t) => t.key === 'athlete:1')!;
    expect(home.points).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }]);
  });

  it('el último punto es exactamente donde dibuja la ficha la interpolación (con la curva)', () => {
    for (const curve of CURVES) {
      const t = 1300;
      const tr = playerTrailsAt(frames, t, curve, frameDuration, both).find((x) => x.key === 'athlete:1')!;
      const p = interpolateFrames(frames, t, { curve }).players.find((x) => x.key === 'athlete:1')!;
      close(tr.points[tr.points.length - 1].x, p.x);
      close(tr.points[tr.points.length - 1].y, p.y);
    }
  });

  it('filtra por equipo: local / visitante', () => {
    const onlyHome = playerTrailsAt(frames, 1500, 'lineal', frameDuration, { home: true, away: false });
    expect(onlyHome.map((t) => t.team)).toEqual(['home']);
    const onlyAway = playerTrailsAt(frames, 1500, 'lineal', frameDuration, { home: false, away: true });
    expect(onlyAway.map((t) => t.key)).toEqual(['rival:1']);
    expect(playerTrailsAt(frames, 1500, 'lineal', frameDuration, { home: false, away: false })).toEqual([]);
  });

  it('las figuras rival que se deslizan cuentan como visitante', () => {
    const opp = (x: number): TacticalArrow => ({ type: 'opponent', x1: x, y1: 40, x2: x, y2: 40 });
    const fs = [fr('a', { arrows: [opp(10)] }), fr('b', { arrows: [opp(50)] })];
    const tr = playerTrailsAt(fs, 1000, 'lineal', frameDuration, { home: false, away: true });
    expect(tr).toEqual([{ key: 'shape#0', team: 'away', points: [{ x: 10, y: 40 }, { x: 50, y: 40 }] }]);
  });

  it('teamOfKey: rival:/away:/opp: son visitantes; lo demás es local', () => {
    expect(teamOfKey('rival:3')).toBe('away');
    expect(teamOfKey('away:x')).toBe('away');
    expect(teamOfKey('opp#2')).toBe('away');
    expect(teamOfKey('athlete:abc')).toBe('home');
    expect(teamOfKey('slot#0')).toBe('home');
  });

  it('el rastro se desvanece: el tramo más viejo es el más transparente', () => {
    expect(trailSegmentOpacity(0, 4)).toBeLessThan(trailSegmentOpacity(3, 4));
    expect(trailSegmentOpacity(0, 1)).toBeGreaterThan(0.5);
  });
});

describe('ballTrailAt: trayectoria del balón', () => {
  it('sin posesión sigue a la figura balón cuadro a cuadro', () => {
    const fs = [fr('a', { arrows: [ballShape(10, 10)] }), fr('b', { arrows: [ballShape(50, 10)] }), fr('c', { arrows: [ballShape(50, 50)] })];
    expect(ballTrailAt(fs, 1500, 'lineal', frameDuration)).toEqual([{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }]);
    expect(ballTrailAt(fs, 0, 'lineal', frameDuration)).toEqual([]);
  });
});

// ─── Posesión ───────────────────────────────────────────────────────────────

describe('posesión del balón', () => {
  const A = 'athlete:a';
  const B = 'athlete:b';
  const frames: TacticalFrame[] = [
    fr('1', { players: [{ key: A, x: 20, y: 20 }, { key: B, x: 60, y: 20 }], arrows: [ballShape(5, 5)], ball_owner: A }),
    fr('2', { players: [{ key: A, x: 40, y: 50 }, { key: B, x: 60, y: 60 }], arrows: [ballShape(5, 5)], ball_owner: A }),
    fr('3', { players: [{ key: A, x: 40, y: 50 }, { key: B, x: 80, y: 70 }], arrows: [ballShape(5, 5)], ball_owner: B }),
  ];

  it('el balón va a los pies del dueño en cada cuadro', () => {
    expect(ballAnchor(frames[0])).toEqual({ x: 20 + BALL_OFFSET.x, y: 20 + BALL_OFFSET.y });
    expect(ballAnchor(frames[2])).toEqual({ x: 80 + BALL_OFFSET.x, y: 70 + BALL_OFFSET.y });
  });

  it('con el mismo dueño, el balón SIGUE al jugador en todo el tramo', () => {
    for (const curve of CURVES) {
      for (const t of [100, 333, 500, 870]) {
        const st = interpolateFrames(frames, t, { curve });
        const a = st.players.find((p) => p.key === A)!;
        const ball = st.arrows.find((x) => x.shape.type === 'ball')!.shape;
        close(ball.x1, a.x + BALL_OFFSET.x);
        close(ball.y1, a.y + BALL_OFFSET.y);
      }
    }
  });

  it('cuando cambia de dueño se dibuja un pase de A a B (y solo uno)', () => {
    const passes = passesOf(frames);
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ toIndex: 2, fromKey: A, toKey: B });
    expect(passes[0].from).toEqual(ballAnchor(frames[1]));
    expect(passes[0].to).toEqual(ballAnchor(frames[2]));
    expect(passesUntil(frames, 500, frameDuration)).toEqual([]);
    expect(passesUntil(frames, 1500, frameDuration)).toHaveLength(1);
  });

  it('en el pase el balón viaja del pasador al receptor y llega con él', () => {
    const mid = possessionBallAt(frames, 1500, 'lineal', frameDuration)!;
    const from = ballAnchor(frames[1])!;
    const to = ballAnchor(frames[2])!;
    close(mid.x, (from.x + to.x) / 2);
    close(mid.y, (from.y + to.y) / 2);
    const end = possessionBallAt(frames, 2000, 'lineal', frameDuration)!;
    expect(end).toMatchObject({ ...to, owner: B });
  });

  it('una sola figura balón (no se duplica) y opaca', () => {
    const st = interpolateFrames(frames, 700);
    const balls = st.arrows.filter((a) => a.shape.type === 'ball');
    expect(balls).toHaveLength(1);
    expect(balls[0].opacity).toBe(1);
  });

  it('dueño sin figura balón: el balón aparece igual (como `ball`)', () => {
    const fs = frames.map((f) => ({ ...f, arrows: [] }));
    const st = interpolateFrames(fs, 0);
    expect(st.ball).toMatchObject({ x: 20 + BALL_OFFSET.x, y: 20 + BALL_OFFSET.y, opacity: 1 });
  });

  it('SIN posesión en ningún cuadro: exactamente el comportamiento de antes', () => {
    const plain = frames.map(({ ball_owner: _omit, ...f }) => f as TacticalFrame);
    expect(hasPossession(plain)).toBe(false);
    expect(possessionBallAt(plain, 500, 'suave', frameDuration)).toBeNull();
    const snap = [0, 250, 500, 1000, 1500, 2000].map((t) => interpolateFrames(plain, t));
    expect(snap).toMatchSnapshot();
    expect(passesOf(plain)).toEqual([]);
  });

  it('un dueño que no está en el cuadro no cuenta (balón suelto)', () => {
    const f = fr('x', { players: [{ key: A, x: 1, y: 1 }], arrows: [ballShape(33, 44)], ball_owner: 'athlete:fantasma' });
    expect(ballAnchor(f)).toEqual({ x: 33, y: 44 });
  });

  it('formato: hydrate/serialize conservan ball_owner (opcional) y descartan uno huérfano', () => {
    const raw = [
      { ...frames[0] },
      { ...frames[1], ball_owner: 'athlete:nadie' },
      { ...frames[2] },
    ];
    const h = hydrateFrames(raw)!;
    expect(h[0].ball_owner).toBe(A);
    expect('ball_owner' in h[1]).toBe(false);
    const s = serializeFrames(h)!;
    expect(s[0].ball_owner).toBe(A);
    expect(s[2].ball_owner).toBe(B);
    expect('ball_owner' in s[1]).toBe(false);
    // Jugada vieja (sin el campo): sigue igual al serializar.
    const old = serializeFrames(hydrateFrames([fr('a'), fr('b')])!)!;
    expect(old.every((f) => !('ball_owner' in f))).toBe(true);
  });

  it('setBallOwner / duplicar cuadro / plantillas', () => {
    const next = setBallOwner(frames, 1, B);
    expect(next[1].ball_owner).toBe(B);
    expect(frames[1].ball_owner).toBe(A); // inmutable
    expect('ball_owner' in setBallOwner(frames, 0, null)[0]).toBe(false);
    const dup = duplicateFrameAt(frames, 2, 'nuevo');
    expect(dup.frames[3].ball_owner).toBe(B);
    const mapped = remapBallOwner(frames[0], (k) => (k === A ? 'slot#0' : undefined));
    expect(mapped.ball_owner).toBe('slot#0');
    expect('ball_owner' in remapBallOwner(frames[2], () => undefined)).toBe(false);
  });

  it('placeBallShape mueve la figura balón o la agrega', () => {
    expect(placeBallShape([ballShape(1, 1)], { x: 9, y: 8 })).toEqual([ballShape(9, 8)]);
    expect(placeBallShape([], { x: 9, y: 8 })).toEqual([ballShape(9, 8)]);
  });
});

// ─── Persistencia por usuario ───────────────────────────────────────────────

describe('persistencia de los ajustes por usuario', () => {
  const custom: TacticalBoardSettings = {
    ...DEFAULT_BOARD_SETTINGS, curve: 'lineal', routeHome: true, ballTrail: true, theme: 'claro',
  };

  it('guarda y lee bajo una clave con el id del usuario', () => {
    const st = memoryStorage();
    expect(saveBoardSettings('u1', custom, st)).toBe(true);
    expect(Object.keys(st.dump())).toEqual([boardSettingsKey('u1')]);
    expect(boardSettingsKey('u1').startsWith(BOARD_SETTINGS_PREFIX)).toBe(true);
    expect(loadBoardSettings('u1', st)).toEqual(custom);
  });

  it('NO se filtra entre usuarios del mismo dispositivo', () => {
    const st = memoryStorage();
    saveBoardSettings('coach-a', custom, st);
    expect(loadBoardSettings('coach-b', st)).toEqual(DEFAULT_BOARD_SETTINGS);
    saveBoardSettings('coach-b', { ...DEFAULT_BOARD_SETTINGS, curve: 'rapida_final' }, st);
    expect(loadBoardSettings('coach-a', st).curve).toBe('lineal');
    expect(loadBoardSettings('coach-b', st).curve).toBe('rapida_final');
  });

  it('sin usuario no lee ni escribe', () => {
    const st = memoryStorage();
    saveBoardSettings('u1', custom, st);
    expect(saveBoardSettings(null, custom, st)).toBe(false);
    expect(loadBoardSettings(null, st)).toEqual(DEFAULT_BOARD_SETTINGS);
    expect(Object.keys(st.dump())).toHaveLength(1);
  });

  it('clearBoardSettings (signOut) borra las de todos por prefijo y deja lo demás', () => {
    const st = memoryStorage();
    saveBoardSettings('u1', custom, st);
    saveBoardSettings('u2', custom, st);
    st.setItem('sportmaps_cart', '[]');
    clearBoardSettings(st);
    expect(st.dump()).toEqual({ sportmaps_cart: '[]' });
  });

  it('JSON roto, viejo o con valores raros → valores válidos', () => {
    const st = memoryStorage();
    st.setItem(boardSettingsKey('u1'), '{no es json');
    expect(loadBoardSettings('u1', st)).toEqual(DEFAULT_BOARD_SETTINGS);
    expect(normalizeBoardSettings({ curve: 'turbo', theme: 'rosado', routeHome: 'si', ballTrail: true }))
      .toEqual({ ...DEFAULT_BOARD_SETTINGS, ballTrail: true });
  });

  it('localStorage que revienta (Safari privado) no rompe la pizarra', () => {
    const broken: SettingsStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
      key: () => null,
      get length() { return 0; },
    };
    expect(loadBoardSettings('u1', broken)).toEqual(DEFAULT_BOARD_SETTINGS);
    expect(saveBoardSettings('u1', custom, broken)).toBe(false);
    expect(() => clearBoardSettings(broken)).not.toThrow();
  });

  it('playbackOptionsOf lleva al export/3D solo lo que cambia el dibujo', () => {
    expect(playbackOptionsOf(custom)).toEqual({
      curve: 'lineal', routeHome: true, routeAway: false, ballTrail: true, ballTrailDashed: true,
    });
  });
});

// ─── Diálogo y tema ─────────────────────────────────────────────────────────

function makePrefs(over: Partial<TacticalBoardSettings> = {}): TacticalBoardPrefs & { update: ReturnType<typeof vi.fn> } {
  const settings = { ...DEFAULT_BOARD_SETTINGS, ...over };
  return {
    settings,
    update: vi.fn(),
    playback: playbackOptionsOf(settings),
    fullscreen: null,
    toggleFullscreen: vi.fn(),
    contentStyle: undefined,
  };
}

describe('diálogo «Ajustes de la pizarra»', () => {
  it('el engranaje abre el diálogo; elegir curva, rastros y tema llama a update', () => {
    const prefs = makePrefs();
    render(<TacticalBoardSettingsButton prefs={prefs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de la pizarra' }));
    expect(screen.getByRole('dialog', { name: 'Ajustes de la pizarra' })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Lineal/ }));
    expect(prefs.update).toHaveBeenLastCalledWith({ curve: 'lineal' });

    fireEvent.click(screen.getByRole('switch', { name: 'Ruta del jugador · equipo local' }));
    expect(prefs.update).toHaveBeenLastCalledWith({ routeHome: true });

    fireEvent.click(screen.getByRole('radio', { name: /Claro/ }));
    expect(prefs.update).toHaveBeenLastCalledWith({ theme: 'claro' });

    // «discontinua» depende de que la trayectoria esté prendida.
    expect((screen.getByRole('switch', { name: 'Trayectoria del balón discontinua' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('la curva y el tema elegidos se ven marcados', () => {
    render(<TacticalBoardSettingsButton prefs={makePrefs({ curve: 'rapida_final', theme: 'claro' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de la pizarra' }));
    expect(screen.getByRole('radio', { name: /Rápida al final/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /Suave/ }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('radio', { name: /Claro/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('pantalla completa llama al toggle', () => {
    const prefs = makePrefs();
    render(<TacticalBoardSettingsButton prefs={prefs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de la pizarra' }));
    fireEvent.click(screen.getByRole('button', { name: /Pantalla completa/ }));
    expect(prefs.toggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('etiqueta de nombre: solo con el ajuste prendido', () => {
    const { rerender } = render(
      <TacticalBoardPrefsProvider value={makePrefs()}><PinNameTag name="Juan Pablo Pérez" /></TacticalBoardPrefsProvider>,
    );
    expect(screen.queryByTestId('pin-name-tag')).toBeNull();
    rerender(<TacticalBoardPrefsProvider value={makePrefs({ labelsAlways: true })}><PinNameTag name="Juan Pablo Pérez" /></TacticalBoardPrefsProvider>);
    expect(screen.getByTestId('pin-name-tag').textContent).toBe('Juan P.');
    expect(shortPlayerName('Ana')).toBe('Ana');
  });
});
