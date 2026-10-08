import { describe, expect, it } from 'vitest';
import {
  easeInOutCubic,
  frameToStatic,
  framesDuration,
  interpolateFrames,
} from '@/lib/export/tacticalInterpolation';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { TacticalArrow } from '@/lib/school/footballQueries';

const arrowA: TacticalArrow = { type: 'arrow', x1: 10, y1: 10, x2: 20, y2: 20 };
const arrowB: TacticalArrow = { type: 'curve', x1: 30, y1: 30, x2: 40, y2: 40 };

function frame(
  id: string,
  duration_ms: number,
  players: [string, number, number][],
  ball: { x: number; y: number } | null,
  arrows: TacticalArrow[] = [],
): TacticalFrame {
  return { id, duration_ms, players: players.map(([key, x, y]) => ({ key, x, y })), ball, arrows };
}

const frames: TacticalFrame[] = [
  frame('f1', 999, [['a', 10, 10], ['b', 50, 50]], { x: 10, y: 10 }, [arrowA]),
  frame('f2', 1000, [['a', 30, 50], ['b', 50, 50]], { x: 30, y: 50 }, [arrowB]),
  frame('f3', 2000, [['a', 30, 90]], null, []),
];

const pos = (st: ReturnType<typeof interpolateFrames>, key: string) => st.players.find((p) => p.key === key);

describe('easeInOutCubic', () => {
  it('fija extremos y punto medio', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
  it('es monótona creciente', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('framesDuration', () => {
  it('ignora la duración del cuadro 1', () => {
    expect(framesDuration(frames)).toBe(3000);
    expect(framesDuration([frames[0]])).toBe(0);
  });
  it('recorta duraciones fuera de rango', () => {
    expect(framesDuration([frames[0], { ...frames[1], duration_ms: 5 }])).toBe(200);
    expect(framesDuration([frames[0], { ...frames[1], duration_ms: Number.NaN }])).toBe(1200);
  });
});

describe('interpolateFrames', () => {
  it('en los extremos devuelve el cuadro exacto', () => {
    const s0 = interpolateFrames(frames, 0);
    expect(pos(s0, 'a')).toMatchObject({ x: 10, y: 10, opacity: 1 });
    expect(s0.arrows).toEqual([arrowA]);
    expect(s0.ball).toMatchObject({ x: 10, y: 10 });

    const s1 = interpolateFrames(frames, 1000);
    expect(pos(s1, 'a')).toMatchObject({ x: 30, y: 50 });
    expect(s1.arrows).toEqual([arrowB]);
    expect(s1.arrowsFrameIndex).toBe(1);

    const end = interpolateFrames(frames, 3000);
    expect(pos(end, 'a')).toMatchObject({ x: 30, y: 90, opacity: 1 });
    expect(end.players).toHaveLength(1);
    expect(end.ball).toBeNull();
    expect(interpolateFrames(frames, 99999)).toEqual(end);
    expect(interpolateFrames(frames, -50)).toEqual(s0);
  });

  it('en la mitad de la transición está a mitad de camino (easing simétrico)', () => {
    const s = interpolateFrames(frames, 500);
    expect(pos(s, 'a')!.x).toBeCloseTo(20);
    expect(pos(s, 'a')!.y).toBeCloseTo(30);
    expect(s.ball!.x).toBeCloseTo(20);
    expect(pos(s, 'b')).toMatchObject({ x: 50, y: 50, opacity: 1 });
    expect(s.progress).toBeCloseTo(0.5);
  });

  it('a un cuarto del tiempo va por detrás de lo lineal (ease-in)', () => {
    const s = interpolateFrames(frames, 250);
    expect(pos(s, 'a')!.x).toBeLessThan(15);
    expect(pos(s, 'a')!.x).toBeGreaterThan(10);
  });

  it('las figuras del destino aparecen al final de la transición', () => {
    expect(interpolateFrames(frames, 999).arrows).toEqual([arrowA]);
    expect(interpolateFrames(frames, 1000).arrows).toEqual([arrowB]);
  });

  it('el movimiento es monótono (sin rebote del easing)', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1000; t += 25) {
      const y = pos(interpolateFrames(frames, t), 'a')!.y;
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });

  it('un jugador que falta en un cuadro sale con fade quieto en su lugar', () => {
    const s = interpolateFrames(frames, 2000); // mitad de f2 → f3
    const b = pos(s, 'b')!;
    expect(b.x).toBe(50);
    expect(b.y).toBe(50);
    expect(b.opacity).toBeCloseTo(0.5);
    expect(s.ball!.opacity).toBeCloseTo(0.5);
    expect(s.ball).toMatchObject({ x: 30, y: 50 });
  });

  it('un jugador que aparece entra con fade en su posición destino', () => {
    const fs = [frame('1', 0, [['a', 0, 0]], null), frame('2', 1000, [['a', 10, 10], ['n', 70, 70]], null)];
    const n = pos(interpolateFrames(fs, 250), 'n')!;
    expect(n).toMatchObject({ x: 70, y: 70 });
    expect(n.opacity).toBeGreaterThan(0);
    expect(n.opacity).toBeLessThan(0.5);
  });

  it('sin cuadros o con uno solo no revienta', () => {
    expect(interpolateFrames([], 100).players).toEqual([]);
    expect(pos(interpolateFrames([frames[0]], 500), 'a')).toMatchObject({ x: 10, y: 10 });
  });
});

describe('frameToStatic', () => {
  it('pone nombres, dorsales y el balón como objeto', () => {
    const st = frameToStatic(
      frame('x', 0, [['athlete:1', 5, 6], ['slot:DC', 7, 8]], { x: 1, y: 2 }, [arrowA]),
      { 'athlete:1': 'Ana' },
      { 'athlete:1': 9 },
    );
    expect(st.players[0]).toMatchObject({ x: 5, y: 6, label: 'Ana', jersey: 9 });
    expect(st.players[1]).toMatchObject({ label: 'DC', jersey: null });
    expect(st.arrows).toHaveLength(2);
    expect(st.arrows[1]).toMatchObject({ type: 'ball', x1: 1, y1: 2 });
  });
});
