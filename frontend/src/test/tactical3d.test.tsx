/**
 * Visor 3D de la pizarra (M4): lógica pura — coordenadas del tablero → metros
 * por deporte, misma interpolación que el 2D, cámaras por deporte y caída a 2D
 * (WebGL2 y fps, simulados).
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TACTICAL_SPORTS, SPORTS, COURT_METERS, type TacticalSport } from '@/lib/school/tacticalSports';
import {
  ballFor, cameraLabel, computeLive, court3D, createFpsMeter, figureScale, fixedCameraPose,
  fixtureFor, FOOTBALL11_M, playerCameraPose, playerVisual, resolveCamera, strokePath, toMeters, viewerFrames,
  GOALKEEPER_COLOR, TEAM_COLOR,
} from '@/lib/school/tactical3d';
import { detectWebGL2 } from '@/lib/school/tactical3dLaunch';
import { interpolateFrames, totalDurationMs } from '@/lib/school/tacticalAnimation';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import { BASKET_M, GOAL_WIDTH_M, VOLLEY_POST_OUTSIDE_M, meters } from '@/components/school/courts/courtGeometry';
import { BASKET_HEIGHTS_M } from '@/lib/school/tactical3d';
import { CourtBackground } from '@/components/school/courts/CourtBackground';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

const REAL: Record<TacticalSport, { w: number; l: number }> = {
  futbol: FOOTBALL11_M,
  ...COURT_METERS,
};

describe('court3D / toMeters: tablero → metros reales por deporte', () => {
  it.each(TACTICAL_SPORTS)('%s: medidas reales y esquinas/centro de la cancha', (sport) => {
    const c = court3D(sport);
    expect(c.widthM).toBe(REAL[sport].w);
    expect(c.lengthM).toBe(REAL[sport].l);
    const r = SPORTS[sport].court;
    const tl = toMeters(c, r.x0, r.y0);
    const tr = toMeters(c, r.x1, r.y0);
    const bl = toMeters(c, r.x0, r.y1);
    const br = toMeters(c, r.x1, r.y1);
    close(tl.x, -c.widthM / 2, 1e-4); close(tl.z, -c.lengthM / 2, 1e-4);
    close(tr.x, c.widthM / 2, 1e-4); close(tr.z, -c.lengthM / 2, 1e-4);
    close(bl.x, -c.widthM / 2, 1e-4); close(bl.z, c.lengthM / 2, 1e-4);
    close(br.x, c.widthM / 2, 1e-4); close(br.z, c.lengthM / 2, 1e-4);
    const center = toMeters(c, 50, 50);
    close(center.x, 0); close(center.z, 0);
    // El piso (tablero entero) cubre la cancha y algo de zona libre.
    expect(c.floorW).toBeGreaterThanOrEqual(c.widthM);
    expect(c.floorL).toBeGreaterThan(c.lengthM);
  });

  it('el estiramiento del ancho del 2D desaparece: un círculo de 3 m mide 3 m a lo ancho y a lo largo', () => {
    const c = court3D('futsal');
    const f = SPORTS.futsal.frame!;
    const m = meters(f);
    // 3 m a la derecha del centro y 3 m hacia abajo, en unidades del viewBox → %.
    const right = toMeters(c, (m.X(10 + 3) / 300) * 100, 50);
    const down = toMeters(c, 50, (m.Y(20 + 3) / 340) * 100);
    close(right.x, 3, 1e-9);
    close(down.z, 3, 1e-9);
  });

  it('deporte desconocido o nulo → fútbol 11', () => {
    expect(court3D(null).sport).toBe('futbol');
    expect(court3D('ajedrez' as TacticalSport).sport).toBe('futbol');
  });

  it('figuras: tamaño real hasta 70 m de largo; fútbol 11 = 1,5×', () => {
    expect(figureScale(court3D('futbol'))).toBe(1.5);
    expect(figureScale(court3D('futbol7'))).toBe(1);
    expect(figureScale(court3D('voleibol'))).toBe(1);
  });
});

describe('elementos del deporte = los del 2D (una sola fuente)', () => {
  it('arcos, red y canastas por deporte', () => {
    expect(fixtureFor('futbol')).toEqual({ kind: 'goals', width: 7.32, height: 2.44 });
    expect(fixtureFor('futsal')).toEqual({ kind: 'goals', width: GOAL_WIDTH_M.futsal, height: 2 });
    expect(fixtureFor('balonmano').kind).toBe('goals');
    expect(fixtureFor('voleibol').kind).toBe('net');
    expect(fixtureFor('baloncesto').kind).toBe('hoops');
    expect(fixtureFor('generico').kind).toBe('none');
  });

  it('el arco de futsal del fondo SVG tiene los palos donde dice GOAL_WIDTH_M', () => {
    const f = SPORTS.futsal.frame!;
    const m = meters(f);
    const svg = renderToStaticMarkup(<CourtBackground sport="futsal" />);
    const p1 = m.X(f.widthM / 2 - GOAL_WIDTH_M.futsal / 2);
    expect(svg).toContain(`M ${p1} ${m.Y(0)}`);
  });

  it('el aro del fondo SVG de básquet está en BASKET_M.rimFromBaseline', () => {
    const f = SPORTS.baloncesto.frame!;
    const m = meters(f);
    const svg = renderToStaticMarkup(<CourtBackground sport="baloncesto" />);
    expect(svg).toContain(`cy="${m.Y(BASKET_M.rimFromBaseline)}"`);
  });

  it('los postes de la red de vóley del SVG van a VOLLEY_POST_OUTSIDE_M de la banda', () => {
    const f = SPORTS.voleibol.frame!;
    const m = meters(f);
    const svg = renderToStaticMarkup(<CourtBackground sport="voleibol" />);
    expect(svg).toContain(`cx="${m.X(-VOLLEY_POST_OUTSIDE_M)}"`);
    expect(svg).toContain(`cx="${m.X(f.widthM + VOLLEY_POST_OUTSIDE_M)}"`);
  });

  it('balón por deporte', () => {
    expect(ballFor('baloncesto').style).toBe('basketball');
    expect(ballFor('voleibol').style).toBe('volleyball');
    expect(ballFor('voleibol').height).toBeGreaterThan(2);
    expect(ballFor('futbol').style).toBe('football');
    expect(ballFor('balonmano').style).toBe('handball');
  });
});

// ─── Interpolación ──────────────────────────────────────────────────────────

const frames: TacticalFrame[] = [
  { id: 'a', duration_ms: 1200, players: [{ key: 'p1', x: 50, y: 90 }, { key: 'p2', x: 30, y: 60 }], ball: { x: 50, y: 88 }, arrows: [{ type: 'cone', x1: 20, y1: 20, x2: 20, y2: 20 }] },
  { id: 'b', duration_ms: 1000, players: [{ key: 'p1', x: 50, y: 60 }, { key: 'p2', x: 40, y: 40 }], ball: { x: 40, y: 42 }, arrows: [{ type: 'cone', x1: 30, y1: 25, x2: 30, y2: 25 }] },
  { id: 'c', duration_ms: 1500, players: [{ key: 'p1', x: 60, y: 30 }, { key: 'p3', x: 70, y: 20 }], ball: null, arrows: [] },
];

describe('computeLive: la MISMA interpolación del 2D en el mismo instante', () => {
  const court = court3D('futbol');
  it.each([0, 300, 600, 1000, 1200, 1700, 2200, 2900, 3700, 9999])('t = %i ms', (t) => {
    const live = computeLive(court, frames, null, t);
    expect(live.main).toEqual(interpolateFrames(frames, t));
    for (const p of live.main.players) {
      const two = interpolateFrames(frames, t).players.find((q) => q.key === p.key)!;
      const m = toMeters(court, two.x, two.y);
      const again = toMeters(court, p.x, p.y);
      close(again.x, m.x); close(again.z, m.z);
    }
    const ball2d = interpolateFrames(frames, t).ball;
    if (ball2d) {
      const m = toMeters(court, ball2d.x, ball2d.y);
      close(live.ball!.x, m.x); close(live.ball!.z, m.z);
      expect(live.ball!.opacity).toBe(ball2d.opacity);
    } else {
      expect(live.ball).toBeNull();
    }
  });

  it('la superposición corre con el mismo reloj', () => {
    const overlay: TacticalFrame[] = [
      { id: 'r1', duration_ms: 1200, players: [{ key: 'r', x: 50, y: 10 }], ball: null, arrows: [] },
      { id: 'r2', duration_ms: 2000, players: [{ key: 'r', x: 50, y: 80 }], ball: null, arrows: [] },
    ];
    const live = computeLive(court, frames, overlay, 1500);
    expect(live.overlay).toEqual(interpolateFrames(overlay, 1500));
  });

  it('balón movido como material (pizarra nueva): sale del objeto «balón»', () => {
    const fs: TacticalFrame[] = [
      { id: 'a', duration_ms: 1200, players: [], ball: null, arrows: [{ type: 'ball', x1: 10, y1: 10, x2: 10, y2: 10 }] },
      { id: 'b', duration_ms: 1000, players: [], ball: null, arrows: [{ type: 'ball', x1: 90, y1: 90, x2: 90, y2: 90 }] },
    ];
    const live = computeLive(court, fs, null, 500);
    const obj = interpolateFrames(fs, 500).arrows[0].shape;
    const m = toMeters(court, obj.x1, obj.y1);
    close(live.ball!.x, m.x); close(live.ball!.z, m.z);
  });

  it('duración total igual a la del 2D', () => {
    expect(totalDurationMs(frames)).toBe(2500);
  });
});

// ─── Cámaras ────────────────────────────────────────────────────────────────

describe('cámaras', () => {
  it('etiqueta de la cámara de fondo según el deporte', () => {
    expect(cameraLabel('detras', 'futbol')).toBe('Detrás del arco');
    expect(cameraLabel('detras', 'futsal')).toBe('Detrás del arco');
    expect(cameraLabel('detras', 'balonmano')).toBe('Detrás del arco');
    expect(cameraLabel('detras', 'baloncesto')).toBe('Detrás del aro');
    expect(cameraLabel('detras', 'voleibol')).toBe('Detrás de la cancha');
    expect(cameraLabel('tribuna', 'voleibol')).toBe('Tribuna');
    expect(cameraLabel('jugador', 'futbol')).toBe('Vista del jugador');
  });

  it('«Vista del jugador» sin jugador elegido cae al primero; sin jugadores, a Tribuna', () => {
    expect(resolveCamera('jugador', 'p2', ['p1', 'p2'])).toEqual({ mode: 'jugador', playerKey: 'p2' });
    expect(resolveCamera('jugador', 'otro', ['p1', 'p2'])).toEqual({ mode: 'jugador', playerKey: 'p1' });
    expect(resolveCamera('jugador', null, [])).toEqual({ mode: 'tribuna', playerKey: null });
    expect(resolveCamera('detras', 'p1', ['p1'])).toEqual({ mode: 'detras', playerKey: null });
  });

  it.each(TACTICAL_SPORTS)('%s: tribuna desde la banda y elevada; la de fondo, detrás del arco o aro propio', (sport) => {
    const c = court3D(sport);
    const t = fixedCameraPose(c, 'tribuna');
    expect(t.position.x).toBeLessThan(-c.widthM / 2);
    expect(t.position.y).toBeGreaterThan(0);
    expect(t.position.z).toBe(0);
    // El largo entero entra a lo ancho del cuadro (fov 45, 16:9).
    const dist = Math.hypot(t.position.x, t.position.y);
    const halfH = Math.tan((22.5 * Math.PI) / 180) * (16 / 9);
    expect(dist * halfH).toBeGreaterThanOrEqual(c.lengthM / 2);
    const d = fixedCameraPose(c, 'detras');
    if (sport === 'baloncesto') {
      // Encima del tablero propio y por arriba del aro: el poste queda atrás.
      expect(d.position.z).toBeGreaterThan(c.lengthM / 2 - BASKET_M.boardFromBaseline);
      expect(d.position.y).toBeGreaterThan(BASKET_HEIGHTS_M.rimHeight + 1);
    } else {
      expect(d.position.z).toBeGreaterThan(c.lengthM / 2);
    }
    expect(d.target.z).toBeLessThan(d.position.z);
  });

  it('vista del jugador: ojos a su altura, mira al balón o al arco rival', () => {
    const c = court3D('futsal');
    const toBall = playerCameraPose(c, { x: 0, z: 5 }, { x: 3, z: -4 });
    expect(toBall.position).toEqual({ x: 0, y: 1.65, z: 5 });
    expect(toBall.target.x).toBe(3);
    const noBall = playerCameraPose(c, { x: 2, z: 5 }, null);
    expect(noBall.target.z).toBe(-c.lengthM / 2);
  });
});

// ─── Jugadores ──────────────────────────────────────────────────────────────

describe('jugadores', () => {
  it('arquero en amarillo (misma regla de la pizarra), el resto del color del equipo', () => {
    const gk = playerVisual('a', { labels: { a: 'Arquero' }, jerseys: { a: 1 }, sport: 'futbol' });
    expect(gk).toEqual({ number: '1', label: 'Arquero', isGoalkeeper: true, color: GOALKEEPER_COLOR });
    expect(playerVisual('b', { labels: { b: 'Delantero' }, sport: 'futbol' }).color).toBe(TEAM_COLOR);
    expect(playerVisual('h', { labels: { h: 'Portero' }, sport: 'balonmano' }).isGoalkeeper).toBe(true);
    // Vóley y básquet no tienen arquero.
    expect(playerVisual('v', { labels: { v: 'Arquero' }, sport: 'voleibol' }).isGoalkeeper).toBe(false);
  });

  it('una jugada de un cuadro (frames null) se arma con lo que se ve en la cancha', () => {
    const out = viewerFrames({ frames: null, players: [{ x: 10, y: 20, label: 'Base', jersey: 4 }], arrows: [] });
    expect(out.frames).toHaveLength(1);
    expect(out.frames[0].players).toEqual([{ key: 'p#0', x: 10, y: 20 }]);
    expect(out.labels).toEqual({ 'p#0': 'Base' });
    expect(out.jerseys).toEqual({ 'p#0': 4 });
  });
});

describe('trazos sobre el piso', () => {
  const c = court3D('futbol7');
  it('flecha recta: de punta a punta, con punta', () => {
    const p = strokePath(c, { type: 'arrow', x1: 50, y1: 50, x2: 50, y2: 30 })!;
    expect(p.head).toBe(true);
    close(p.points[0].z, 0); expect(p.points[1].z).toBeLessThan(0);
  });
  it('remate: se eleva hasta liftM en la mitad', () => {
    const p = strokePath(c, { type: 'ball_path', kind: 'remate', x1: 50, y1: 80, x2: 50, y2: 10 }, 2)!;
    expect(Math.max(...p.points.map((q) => q.y))).toBeCloseTo(2, 5);
    expect(p.points[0].y).toBeCloseTo(0, 9);
  });
  it('zonas y material no son trazos', () => {
    expect(strokePath(c, { type: 'zone', x1: 1, y1: 1, x2: 5, y2: 5 })).toBeNull();
    expect(strokePath(c, { type: 'cone', x1: 1, y1: 1, x2: 1, y2: 1 })).toBeNull();
  });
});

// ─── Caída a 2D ─────────────────────────────────────────────────────────────

describe('caída a 2D: WebGL2 y fps (simulados)', () => {
  it('sin canvas, sin contexto webgl2 o si revienta → no hay 3D', () => {
    expect(detectWebGL2(() => null)).toBe(false);
    expect(detectWebGL2(() => ({ getContext: () => null }))).toBe(false);
    expect(detectWebGL2(() => { throw new Error('boom'); })).toBe(false);
  });

  it('con webgl2 → sí, y suelta el contexto de prueba', () => {
    const loseContext = vi.fn();
    const getContext = vi.fn(() => ({ getExtension: () => ({ loseContext }) }));
    expect(detectWebGL2(() => ({ getContext }))).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  const run = (fps: number, ms = 2100) => {
    const meter = createFpsMeter();
    let v: string = 'pending';
    for (let t = 0; t <= ms; t += 1000 / fps) {
      const r = meter.tick(1000 + t);
      if (r !== 'pending' && r !== 'done') v = r;
    }
    return { v, fps: meter.fps };
  };

  it('60 fps los primeros 2 s → sigue en 3D', () => {
    const r = run(60);
    expect(r.v).toBe('ok');
    expect(r.fps).toBeGreaterThan(55);
  });

  it('12 fps → vuelve a 2D', () => {
    expect(run(12).v).toBe('slow');
  });

  it('justo en 20 fps → aguanta; 19 → no', () => {
    expect(run(20, 2050).v).toBe('ok');
    expect(run(19, 2100).v).toBe('slow');
  });

  it('antes de 2 s no decide, y decide una sola vez', () => {
    const meter = createFpsMeter();
    expect(meter.tick(0)).toBe('pending');
    expect(meter.tick(1000)).toBe('pending');
    expect(meter.tick(2500)).toBe('slow');
    expect(meter.tick(2600)).toBe('done');
  });
});
