/**
 * Interpolación de una jugada por cuadros (spec docs/specs/pizarra-nivel-tacticalpad.md §4, T1/T2).
 *
 * PURA: sin DOM, sin React. La usa el export de video (T2) y la puede usar el
 * reproductor de la pizarra (T1) -- si T1 la mueve a lib/school, que la mueva
 * entera con su prueba (src/test/tacticalExportInterpolation.test.ts).
 *
 * Reglas:
 *  - `frames[i].duration_ms` es lo que tarda en llegar al cuadro i desde el
 *    anterior; la del cuadro 0 no cuenta (no hay anterior).
 *  - x/y de jugadores y balón: lineal con easing easeInOutCubic.
 *  - Un jugador (o el balón) que está en un cuadro y no en el otro entra o sale
 *    con fade (opacity) quieto en la posición donde sí está.
 *  - Las figuras del cuadro destino aparecen AL FINAL de la transición: durante
 *    el movimiento se ven las del cuadro de origen (son las que lo explican).
 */
import type { TacticalArrow } from '@/lib/school/footballQueries';
import {
  DEFAULT_FRAME_MS,
  MAX_FRAME_MS,
  MIN_FRAME_MS,
  type TacticalFrame,
  type TacticalPlayerKey,
} from '@/lib/school/tacticalFrames';
import type { TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Duración saneada de la transición que LLEGA al cuadro (no aplica al cuadro 0). */
export function frameDuration(frame: Pick<TacticalFrame, 'duration_ms'>): number {
  const d = Number(frame.duration_ms);
  if (!Number.isFinite(d)) return DEFAULT_FRAME_MS;
  return Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, d));
}

/** Duración total de la jugada en ms (suma de las transiciones). */
export function framesDuration(frames: TacticalFrame[]): number {
  let total = 0;
  for (let i = 1; i < frames.length; i++) total += frameDuration(frames[i]);
  return total;
}

export interface InterpolatedPlayer {
  key: TacticalPlayerKey;
  x: number;
  y: number;
  /** 0-1: fade de entrada/salida. 1 si está en los dos cuadros. */
  opacity: number;
}

export interface InterpolatedState {
  players: InterpolatedPlayer[];
  ball: { x: number; y: number; opacity: number } | null;
  arrows: TacticalArrow[];
  /** Cuadro del que salen las figuras visibles (sirve de clave de caché). */
  arrowsFrameIndex: number;
  fromIndex: number;
  toIndex: number;
  /** Progreso lineal (sin easing) dentro de la transición, 0-1. */
  progress: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function byKey(frame: TacticalFrame): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>();
  for (const p of frame.players || []) {
    if (!p || m.has(p.key)) continue;
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    m.set(p.key, { x, y });
  }
  return m;
}

function staticState(frames: TacticalFrame[], index: number): InterpolatedState {
  const f = frames[index];
  return {
    players: [...byKey(f)].map(([key, p]) => ({ key, x: p.x, y: p.y, opacity: 1 })),
    ball: f.ball ? { x: f.ball.x, y: f.ball.y, opacity: 1 } : null,
    arrows: f.arrows || [],
    arrowsFrameIndex: index,
    fromIndex: index,
    toIndex: index,
    progress: 1,
  };
}

/**
 * Estado de la jugada en el instante `tMs` (0 = cuadro 1). Fuera de rango se
 * recorta: antes de 0 es el primer cuadro, después del total el último.
 */
export function interpolateFrames(frames: TacticalFrame[], tMs: number): InterpolatedState {
  if (!frames || frames.length === 0) {
    return { players: [], ball: null, arrows: [], arrowsFrameIndex: 0, fromIndex: 0, toIndex: 0, progress: 1 };
  }
  if (frames.length === 1 || !(tMs > 0)) return staticState(frames, 0);

  let acc = 0;
  let seg = -1;
  let progress = 1;
  for (let i = 1; i < frames.length; i++) {
    const d = frameDuration(frames[i]);
    if (tMs < acc + d) {
      seg = i;
      progress = (tMs - acc) / d;
      break;
    }
    acc += d;
  }
  if (seg === -1) return staticState(frames, frames.length - 1);

  const from = frames[seg - 1];
  const to = frames[seg];
  const e = easeInOutCubic(progress);
  const a = byKey(from);
  const b = byKey(to);

  const players: InterpolatedPlayer[] = [];
  for (const [key, pa] of a) {
    const pb = b.get(key);
    if (pb) players.push({ key, x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e), opacity: 1 });
    else players.push({ key, x: pa.x, y: pa.y, opacity: 1 - e });
  }
  for (const [key, pb] of b) {
    if (!a.has(key)) players.push({ key, x: pb.x, y: pb.y, opacity: e });
  }

  let ball: InterpolatedState['ball'] = null;
  if (from.ball && to.ball) ball = { x: lerp(from.ball.x, to.ball.x, e), y: lerp(from.ball.y, to.ball.y, e), opacity: 1 };
  else if (from.ball) ball = { ...from.ball, opacity: 1 - e };
  else if (to.ball) ball = { ...to.ball, opacity: e };

  return {
    players,
    ball,
    arrows: from.arrows || [],
    arrowsFrameIndex: seg - 1,
    fromIndex: seg - 1,
    toIndex: seg,
    progress,
  };
}

/**
 * Un cuadro → lo que pinta TacticalStaticSvg. El balón suelto del cuadro va
 * como objeto `ball` (figura de un punto) para que salga en el PNG/PDF.
 */
export function frameToStatic(
  frame: TacticalFrame,
  playerLabels?: Record<string, string>,
  playerJerseys?: Record<string, number | null>,
): { players: TacticalStaticPlayer[]; arrows: TacticalArrow[] } {
  const players: TacticalStaticPlayer[] = [...byKey(frame)].map(([key, p]) => ({
    x: p.x,
    y: p.y,
    label: playerLabels?.[key] ?? (key.startsWith('slot:') ? key.slice(5) : undefined),
    jersey: playerJerseys?.[key] ?? null,
    role: 'starter',
  }));
  const arrows: TacticalArrow[] = [...(frame.arrows || [])];
  if (frame.ball) {
    arrows.push({ type: 'ball', x1: frame.ball.x, y1: frame.ball.y, x2: frame.ball.x, y2: frame.ball.y });
  }
  return { players, arrows };
}
