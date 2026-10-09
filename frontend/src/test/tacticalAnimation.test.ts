/**
 * Animación por cuadros de la pizarra (src/lib/school/tacticalAnimation.ts, T1
 * de docs/specs/pizarra-nivel-tacticalpad.md). Un error acá no revienta nada a
 * la vista: un jugador salta en vez de deslizarse, una figura parpadea, la
 * reproducción no termina o se guarda una animación que no abre.
 */
import { describe, it, expect, vi } from 'vitest';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import {
  DEFAULT_FRAME_MS, MAX_FRAMES, MAX_FRAME_MS, MIN_FRAME_MS,
  presetSlotIndex, presetSlotKey, playerKey, type TacticalFrame,
} from '@/lib/school/tacticalFrames';
import {
  ARROW_FADE_FRACTION, advancePlayback, createPlaybackClock, duplicateFrameAt, easeInOutCubic,
  frameDuration, frameStartMs, ghostTrail, groupArrowsByOpacity, hydrateFrames, interpolateFrames,
  moveFrame, removeFrameAt, serializeFrames, setFrameDuration, shapesEqual, totalDurationMs,
} from '@/lib/school/tacticalAnimation';

const f = (id: string, over: Partial<TacticalFrame> = {}): TacticalFrame => ({
  id, duration_ms: 1000, players: [], ball: null, arrows: [], ...over,
});
const line: TacticalArrow = { type: 'arrow', x1: 10, y1: 10, x2: 20, y2: 20, color: 'white' };
const zone: TacticalArrow = { type: 'zone', x1: 30, y1: 30, x2: 50, y2: 50, color: 'yellow' };
const cone = (x: number, y: number, rot?: number): TacticalArrow => ({ type: 'cone', x1: x, y1: y, x2: x, y2: y, color: 'orange', ...(rot != null ? { rot } : {}) });

describe('easeInOutCubic', () => {
  it('arranca en 0, termina en 1 y pasa por 0,5 en la mitad', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('arranca y frena suave (más lento que lineal en las puntas)', () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
  it('recorta fuera de [0,1]', () => {
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(7)).toBe(1);
  });
});

describe('duraciones', () => {
  const frames = [f('a', { duration_ms: 9999 }), f('b', { duration_ms: 500 }), f('c', { duration_ms: 2000 })];
  it('la duración del cuadro 1 no cuenta (no hay anterior)', () => {
    expect(totalDurationMs(frames)).toBe(2500);
    expect(totalDurationMs([f('a')])).toBe(0);
  });
  it('frameStartMs = instante en que se llega a cada cuadro', () => {
    expect(frameStartMs(frames, 0)).toBe(0);
    expect(frameStartMs(frames, 1)).toBe(500);
    expect(frameStartMs(frames, 2)).toBe(2500);
  });
  it('frameDuration recorta a [MIN, MAX] y repone lo que no es número', () => {
    expect(frameDuration({ duration_ms: 1 })).toBe(MIN_FRAME_MS);
    expect(frameDuration({ duration_ms: 10 ** 9 })).toBe(MAX_FRAME_MS);
    expect(frameDuration({ duration_ms: Number.NaN })).toBe(DEFAULT_FRAME_MS);
  });
});

describe('interpolateFrames — jugadores y balón', () => {
  const a = f('a', { players: [{ key: 'p1', x: 0, y: 0 }, { key: 'sale', x: 40, y: 40 }], ball: { x: 10, y: 10 } });
  const b = f('b', { duration_ms: 1000, players: [{ key: 'p1', x: 100, y: 50 }, { key: 'entra', x: 60, y: 60 }], ball: { x: 30, y: 50 } });

  it('sin cuadros → vacío; un cuadro o t≤0 → el primer cuadro quieto', () => {
    expect(interpolateFrames([], 100).players).toEqual([]);
    const s = interpolateFrames([a, b], 0);
    expect(s.fromIndex).toBe(0);
    expect(s.players.find((p) => p.key === 'p1')).toMatchObject({ x: 0, y: 0, opacity: 1 });
  });

  it('a la mitad, el jugador está a mitad de camino (easing simétrico)', () => {
    const s = interpolateFrames([a, b], 500);
    expect(s.fromIndex).toBe(0);
    expect(s.toIndex).toBe(1);
    expect(s.progress).toBeCloseTo(0.5);
    const p1 = s.players.find((p) => p.key === 'p1')!;
    expect(p1.x).toBeCloseTo(50);
    expect(p1.y).toBeCloseTo(25);
    expect(p1.opacity).toBe(1);
    expect(s.ball).toMatchObject({ opacity: 1 });
    expect(s.ball!.x).toBeCloseTo(20);
    expect(s.ball!.y).toBeCloseTo(30);
  });

  it('con easing: al 10 % el jugador avanzó menos del 10 %', () => {
    const p1 = interpolateFrames([a, b], 100).players.find((p) => p.key === 'p1')!;
    expect(p1.x).toBeGreaterThan(0);
    expect(p1.x).toBeLessThan(10);
  });

  it('quien sale se desvanece quieto; quien entra aparece quieto', () => {
    const s = interpolateFrames([a, b], 250);
    expect(s.players.find((p) => p.key === 'sale')).toMatchObject({ x: 40, y: 40, opacity: 0.75 });
    expect(s.players.find((p) => p.key === 'entra')).toMatchObject({ x: 60, y: 60, opacity: 0.25 });
  });

  it('balón que aparece o desaparece entre cuadros: fade', () => {
    const noBall = f('n', { duration_ms: 1000 });
    expect(interpolateFrames([a, noBall], 250).ball).toMatchObject({ x: 10, y: 10, opacity: 0.75 });
    expect(interpolateFrames([noBall, b], 250).ball).toMatchObject({ x: 30, y: 50, opacity: 0.25 });
    expect(interpolateFrames([noBall, noBall], 250).ball).toBeNull();
  });

  it('pasado el total queda el último cuadro', () => {
    const s = interpolateFrames([a, b], 5000);
    expect(s.fromIndex).toBe(1);
    expect(s.players.find((p) => p.key === 'p1')).toMatchObject({ x: 100, y: 50 });
  });

  it('con 3 cuadros elige el tramo correcto', () => {
    const c = f('c', { duration_ms: 2000, players: [{ key: 'p1', x: 100, y: 100 }] });
    const s = interpolateFrames([a, b, c], 1000 + 1000);
    expect(s.fromIndex).toBe(1);
    expect(s.toIndex).toBe(2);
    expect(s.players.find((p) => p.key === 'p1')!.y).toBeCloseTo(75);
  });

  it('acepta coordenadas que llegan como texto (numeric de Postgres)', () => {
    const raw = f('r', { players: [{ key: 'p1', x: '20' as unknown as number, y: '30' as unknown as number }] });
    expect(interpolateFrames([raw], 0).players[0]).toMatchObject({ x: 20, y: 30 });
  });
});

describe('interpolateFrames — figuras', () => {
  it('una figura igual en los dos cuadros se queda fija todo el tramo', () => {
    const s = interpolateFrames([f('a', { arrows: [zone] }), f('b', { arrows: [{ ...zone }] })], 500);
    expect(s.arrows).toEqual([{ shape: zone, opacity: 1 }]);
  });

  it('el material movido (mismo índice y tipo) se desliza, no parpadea', () => {
    const s = interpolateFrames([f('a', { arrows: [cone(0, 0)] }), f('b', { arrows: [cone(40, 80)] })], 500);
    expect(s.arrows).toHaveLength(1);
    expect(s.arrows[0].opacity).toBe(1);
    expect(s.arrows[0].shape.x1).toBeCloseTo(20);
    expect(s.arrows[0].shape.y2).toBeCloseTo(40);
  });

  it('el giro va por el camino corto (350° → 10°)', () => {
    const s = interpolateFrames([f('a', { arrows: [cone(5, 5, 350)] }), f('b', { arrows: [cone(5, 5, 10)] })], 500);
    expect(s.arrows[0].shape.rot).toBeCloseTo(0);
  });

  it(`las figuras del destino aparecen en el último ${ARROW_FADE_FRACTION * 100} %; las de origen se apagan en el primero`, () => {
    const frames = [f('a', { arrows: [line] }), f('b', { arrows: [{ ...line, x2: 90 }] })];
    const early = interpolateFrames(frames, 150);
    expect(early.arrows).toEqual([{ shape: line, opacity: expect.closeTo(0.5, 5) }]);
    const mid = interpolateFrames(frames, 500);
    expect(mid.arrows).toEqual([]);
    const late = interpolateFrames(frames, 850);
    expect(late.arrows).toHaveLength(1);
    expect(late.arrows[0].shape.x2).toBe(90);
    expect(late.arrows[0].opacity).toBeCloseTo(0.5);
  });

  it('una figura nueva en el destino no se ve antes del 70 %', () => {
    const frames = [f('a'), f('b', { arrows: [line] })];
    expect(interpolateFrames(frames, 690).arrows).toEqual([]);
    expect(interpolateFrames(frames, 1000 - 1).arrows[0].opacity).toBeGreaterThan(0.99);
  });

  it('agrupa por opacidad (una capa por grupo) y descarta las invisibles', () => {
    const groups = groupArrowsByOpacity([
      { shape: line, opacity: 1 }, { shape: zone, opacity: 1 }, { shape: cone(1, 1), opacity: 0.333 }, { shape: cone(2, 2), opacity: 0 },
    ]);
    expect(groups).toEqual([{ opacity: 1, shapes: [line, zone] }, { opacity: 0.33, shapes: [cone(1, 1)] }]);
  });

  it('shapesEqual ignora campos undefined', () => {
    expect(shapesEqual({ ...line, size: undefined }, line)).toBe(true);
    expect(shapesEqual(line, { ...line, x1: 11 })).toBe(false);
  });
});

describe('advancePlayback', () => {
  it('avanza según la velocidad', () => {
    expect(advancePlayback(0, 100, 1, 1000, false)).toEqual({ t: 100, ended: false });
    expect(advancePlayback(0, 100, 2, 1000, false)).toEqual({ t: 200, ended: false });
    expect(advancePlayback(0, 100, 0.5, 1000, false)).toEqual({ t: 50, ended: false });
  });
  it('sin Repetir se detiene al final', () => {
    expect(advancePlayback(950, 100, 1, 1000, false)).toEqual({ t: 1000, ended: true });
  });
  it('con Repetir vuelve a empezar con el sobrante', () => {
    expect(advancePlayback(950, 100, 1, 1000, true)).toEqual({ t: 50, ended: false });
  });
  it('sin duración (un solo cuadro) termina de una', () => {
    expect(advancePlayback(0, 16, 1, 0, true)).toEqual({ t: 0, ended: true });
  });
});

describe('edición de la lista de cuadros', () => {
  const list = [f('a', { players: [{ key: 'p', x: 1, y: 1 }], arrows: [cone(3, 3)] }), f('b'), f('c')];

  it('«+ Cuadro» copia el cuadro justo después, con duración por defecto, y lo selecciona', () => {
    const r = duplicateFrameAt(list, 0, 'nuevo');
    expect(r.index).toBe(1);
    expect(r.frames.map((x) => x.id)).toEqual(['a', 'nuevo', 'b', 'c']);
    expect(r.frames[1].players).toEqual(list[0].players);
    expect(r.frames[1].duration_ms).toBe(DEFAULT_FRAME_MS);
    // copia profunda: mover en el cuadro nuevo no toca el original
    r.frames[1].players[0].x = 99;
    r.frames[1].arrows[0].x1 = 99;
    expect(list[0].players[0].x).toBe(1);
    expect(list[0].arrows[0].x1).toBe(3);
  });

  it(`no pasa de ${MAX_FRAMES} cuadros`, () => {
    const full = Array.from({ length: MAX_FRAMES }, (_, i) => f(`f${i}`));
    const r = duplicateFrameAt(full, 3);
    expect(r.frames).toBe(full);
    expect(r.index).toBe(3);
  });

  it('quitar un cuadro selecciona el anterior; el último que queda no se quita', () => {
    expect(removeFrameAt(list, 2)).toMatchObject({ index: 1 });
    expect(removeFrameAt(list, 0).frames.map((x) => x.id)).toEqual(['b', 'c']);
    expect(removeFrameAt(list, 0).index).toBe(0);
    const one = [f('x')];
    expect(removeFrameAt(one, 0).frames).toBe(one);
  });

  it('mover reordena; fuera de rango no hace nada', () => {
    expect(moveFrame(list, 0, 2).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(moveFrame(list, 2, 0).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(moveFrame(list, 0, 5)).toBe(list);
    expect(moveFrame(list, 1, 1)).toBe(list);
  });

  it('la duración se recorta al rango permitido', () => {
    expect(setFrameDuration(list, 1, 50)[1].duration_ms).toBe(MIN_FRAME_MS);
    expect(setFrameDuration(list, 1, 3000)[1].duration_ms).toBe(3000);
    expect(setFrameDuration(list, 9, 3000)).toBe(list);
  });
});

describe('hydrateFrames / serializeFrames', () => {
  it('sin cuadros (jugada vieja) → null', () => {
    expect(hydrateFrames(null)).toBeNull();
    expect(hydrateFrames(undefined)).toBeNull();
    expect(hydrateFrames([])).toBeNull();
    expect(hydrateFrames('frames')).toBeNull();
  });

  it('normaliza texto a número, descarta jugadores rotos o repetidos y repone id/duración', () => {
    const out = hydrateFrames([
      { duration_ms: 'x', players: [{ key: 'a', x: '10', y: '20' }, { key: 'a', x: 1, y: 1 }, { key: 'b', x: 'nada', y: 1 }, null], ball: null, arrows: [{ x1: '1', y1: 2, x2: 3, y2: 4 }] },
      'roto',
    ])!;
    expect(out).toHaveLength(1);
    expect(out[0].id).toMatch(/\w+/);
    expect(out[0].duration_ms).toBe(DEFAULT_FRAME_MS);
    expect(out[0].players).toEqual([{ key: 'a', x: 10, y: 20 }]);
    expect(out[0].arrows[0].x1).toBe(1);
  });

  it('con ballAsObject el balón del cuadro pasa a ser una figura «balón»', () => {
    const out = hydrateFrames([{ id: 'a', duration_ms: 1000, players: [], ball: { x: 5, y: 6 }, arrows: [] }], { ballAsObject: true })!;
    expect(out[0].ball).toBeNull();
    expect(out[0].arrows).toEqual([{ type: 'ball', x1: 5, y1: 6, x2: 5, y2: 6 }]);
  });

  it('un solo cuadro se guarda como null (la fila queda chica)', () => {
    expect(serializeFrames([f('a')])).toBeNull();
  });

  it('redondea a 2 decimales y vuelve a abrir igual', () => {
    const saved = serializeFrames([
      f('a', { players: [{ key: 'p', x: 10.123456, y: 20.98765 }] }),
      f('b', { duration_ms: 50, ball: { x: 1.005, y: 2 } }),
    ])!;
    expect(saved[0].players[0]).toEqual({ key: 'p', x: 10.12, y: 20.99 });
    expect(saved[1].duration_ms).toBe(MIN_FRAME_MS);
    expect(hydrateFrames(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });
});

describe('ghostTrail', () => {
  it('solo los que se movieron y estaban en el cuadro anterior', () => {
    const prev = f('a', { players: [{ key: 'quieto', x: 10, y: 10 }, { key: 'corre', x: 20, y: 20 }] });
    const cur = { players: [{ key: 'quieto', x: 10.2, y: 10 }, { key: 'corre', x: 40, y: 20 }, { key: 'nuevo', x: 1, y: 1 }] };
    expect(ghostTrail(prev, cur)).toEqual([{ key: 'corre', from: { x: 20, y: 20 }, to: { x: 40, y: 20 } }]);
    expect(ghostTrail(undefined, cur)).toEqual([]);
  });
});

describe('claves de jugador', () => {
  it('playerKey: subject o slot', () => {
    expect(playerKey({ subject_type: 'athlete', subject_id: 'x' })).toBe('athlete:x');
    expect(playerKey({ slot_label: 'Central' })).toBe('slot:Central');
  });
  it('presetSlotKey / presetSlotIndex van y vuelven', () => {
    expect(presetSlotKey(3)).toBe('slot#3');
    expect(presetSlotIndex(presetSlotKey(12))).toBe(12);
    expect(presetSlotIndex('athlete:x')).toBeNull();
    expect(presetSlotIndex('slot:Central')).toBeNull();
  });
});

describe('createPlaybackClock', () => {
  it('avisa a los suscritos solo cuando cambia', () => {
    const clock = createPlaybackClock();
    const listener = vi.fn();
    const off = clock.subscribe(listener);
    clock.set(10);
    clock.set(10);
    expect(clock.get()).toBe(10);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    clock.set(20);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
