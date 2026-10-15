/**
 * Movimiento del visor 3D (M6e, docs/specs/pizarra-m6e-camaras-3d.md). Lógica
 * PURA y determinista: todo sale del instante `t` y de los MISMOS cuadros e
 * interpolación del 2D (tacticalAnimation.ts), así pausar, adelantar, ir
 * cuadro a cuadro o la cámara lenta muestran siempre lo mismo.
 *
 *  - Balón: la posición en planta es la del 2D; encima se le suma una ALTURA
 *    en parábola en los pases largos y remates (según la distancia). Como usa
 *    el mismo easing, cae exactamente donde dice el cuadro.
 *  - Jugadores: hacia dónde miran (el último desplazamiento), cuánto corren
 *    (velocidad = derivada del easing) y la fase de la zancada (ciclos por
 *    tramo, con tope de cadencia: las jugadas van comprimidas en el tiempo).
 */
import { easeInOutCubic, frameDuration, frameStartMs, totalDurationMs, type InterpolatedFrame } from './tacticalAnimation';
import type { TacticalFrame } from './tacticalFrames';
import { toMeters, type Court3D } from './tactical3d';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Derivada de easeInOutCubic (para la velocidad). */
export function easeInOutCubicDeriv(p: number): number {
  const x = clamp(p, 0, 1);
  return x < 0.5 ? 12 * x * x : 3 * Math.pow(-2 * x + 2, 2);
}

// ─── Balón ──────────────────────────────────────────────────────────────────

/** Balón de un cuadro (% del tablero): el `ball` del cuadro o el material «balón». */
export function frameBallPct(frame: TacticalFrame | undefined): { x: number; y: number } | null {
  if (!frame) return null;
  if (frame.ball) return { x: Number(frame.ball.x), y: Number(frame.ball.y) };
  const obj = (frame.arrows ?? []).find((a) => a && a.type === 'ball');
  return obj ? { x: obj.x1, y: obj.y1 } : null;
}

/** Desde qué distancia un pase va por el aire (m): 20 % del largo, entre 5 y 16 m. */
export const loftThresholdM = (court: Court3D) => clamp(court.lengthM * 0.2, 5, 16);
/** Tope de la altura del arco (m): 10 % del largo, mínimo 4 m. */
export const arcCapM = (court: Court3D) => Math.max(4, court.lengthM * 0.1);
/** Altura máxima de un pase de `distM` metros. */
export const arcApexM = (court: Court3D, distM: number) => Math.min(distM * 0.22, arcCapM(court));

export interface BallArc {
  /** Altura sobre la del balón en el piso / en la mano, metros. */
  lift: number;
  /** El tramo va por el aire. */
  lofted: boolean;
  /** El balón se mueve en este tramo (rueda si no va por el aire). */
  moving: boolean;
  /** Distancia en planta del tramo (m) y altura máxima. */
  distM: number;
  apexM: number;
}

const NO_ARC: BallArc = { lift: 0, lofted: false, moving: false, distM: 0, apexM: 0 };

/** Altura del balón en el instante `main` (el resultado de interpolateFrames). */
export function ballArc(court: Court3D, frames: TacticalFrame[], main: Pick<InterpolatedFrame, 'fromIndex' | 'toIndex' | 'progress'>): BallArc {
  if (main.fromIndex === main.toIndex) return NO_ARC;
  const a = frameBallPct(frames[main.fromIndex]);
  const b = frameBallPct(frames[main.toIndex]);
  if (!a || !b) return NO_ARC;
  const ma = toMeters(court, a.x, a.y);
  const mb = toMeters(court, b.x, b.y);
  const distM = Math.hypot(mb.x - ma.x, mb.z - ma.z);
  if (distM < 1e-3) return NO_ARC;
  const lofted = distM >= loftThresholdM(court);
  if (!lofted) return { ...NO_ARC, moving: true, distM };
  const apexM = arcApexM(court, distM);
  // Mismo easing que la planta: la parábola queda simétrica EN EL ESPACIO y
  // vale 0 justo en el pie que pasa y en el que recibe.
  const e = easeInOutCubic(main.progress);
  return { lift: 4 * apexM * e * (1 - e), lofted: true, moving: true, distM, apexM };
}

/**
 * Hacia dónde viaja el balón en el instante (rad, dirección (sin h, cos h)):
 * el tramo actual si se mueve; si no, el último tramo en que se movió; sin
 * movimiento, hacia el arco rival. Puro: no depende de cuadros dibujados antes.
 */
export function ballHeadingAt(court: Court3D, frames: TacticalFrame[], main: Pick<InterpolatedFrame, 'toIndex'>): number {
  for (let i = Math.min(main.toIndex, frames.length - 1); i >= 1; i--) {
    const a = frameBallPct(frames[i - 1]);
    const b = frameBallPct(frames[i]);
    if (!a || !b) continue;
    const ma = toMeters(court, a.x, a.y);
    const mb = toMeters(court, b.x, b.y);
    if (Math.hypot(mb.x - ma.x, mb.z - ma.z) > 0.5) return Math.atan2(mb.x - ma.x, mb.z - ma.z);
  }
  return Math.PI;
}

// ─── Jugadores ──────────────────────────────────────────────────────────────

/** Hacia dónde mira quien no se movió nunca: el arco rival (−z). */
export const DEFAULT_HEADING = Math.PI;
/** Zancada (m, escala 1) y tope de ciclos por segundo. */
export const STRIDE_M = 1.7;
export const MAX_CADENCE_HZ = 3;

export interface PlayerMotion {
  /** Rad: dirección (sin h, cos h) en x/z. */
  heading: number;
  /** m/s en el reloj de la jugada (la cámara lenta lo baja en tiempo real, no acá). */
  speed: number;
  /** Fase de la zancada (ciclos acumulados). */
  phase: number;
  moving: boolean;
}

function playerAt(frame: TacticalFrame, key: string) {
  const p = (frame.players ?? []).find((q) => q && q.key === key);
  return p ? { x: Number(p.x), y: Number(p.y) } : null;
}

/** Movimiento de `key` en el instante `tMs` (misma tabla de tiempos del 2D). */
export function playerMotion(court: Court3D, frames: TacticalFrame[], key: string, tMs: number, scale = 1): PlayerMotion {
  let heading = DEFAULT_HEADING;
  let phase = 0;
  let speed = 0;
  let acc = 0;
  const stride = STRIDE_M * scale;
  for (let i = 1; i < frames.length; i++) {
    const dur = frameDuration(frames[i]);
    const pa = playerAt(frames[i - 1], key);
    const pb = playerAt(frames[i], key);
    const inSeg = tMs < acc + dur;
    if (pa && pb) {
      const ma = toMeters(court, pa.x, pa.y);
      const mb = toMeters(court, pb.x, pb.y);
      const dx = mb.x - ma.x;
      const dz = mb.z - ma.z;
      const d = Math.hypot(dx, dz);
      const cycles = Math.min(d / stride, MAX_CADENCE_HZ * (dur / 1000));
      if (inSeg) {
        const p = Math.max(0, (tMs - acc) / dur);
        if (d > 0.05) heading = Math.atan2(dx, dz);
        phase += cycles * easeInOutCubic(p);
        speed = (d * easeInOutCubicDeriv(p)) / (dur / 1000);
        break;
      }
      if (d > 0.05) heading = Math.atan2(dx, dz);
      phase += cycles;
    } else if (inSeg) break;
    acc += dur;
  }
  return { heading, speed, phase, moving: speed > 0.3 };
}

export interface Gait {
  /** Ángulo de cada pierna (rad, la otra va al revés). */
  legSwing: number;
  /** Rebote del cuerpo (m, escala 1). */
  bob: number;
  /** Inclinación hacia adelante (rad). */
  lean: number;
  /** 0 quieto … 1 corriendo. */
  run: number;
}

/** Zancada a partir del movimiento. Quieto = todo en 0 (postura de reposo). */
export function gaitOf(m: Pick<PlayerMotion, 'phase' | 'speed'>, scale = 1): Gait {
  const run = clamp(m.speed / (2.5 * scale), 0, 1);
  if (run <= 0.02) return { legSwing: 0, bob: 0, lean: 0, run: 0 };
  const s = Math.sin(m.phase * Math.PI * 2);
  return { legSwing: s * 0.6 * run, bob: Math.abs(s) * 0.06 * run, lean: 0.14 * run, run };
}

/**
 * Rastro del recorrido de `key` hasta el instante (% del tablero): las
 * posiciones de los cuadros ya pasados y la de ahora, sin repetidos.
 */
export function trailPoints(frames: TacticalFrame[], key: string, main: Pick<InterpolatedFrame, 'fromIndex' | 'players'>): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const push = (p: { x: number; y: number } | null) => {
    if (!p) return;
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) return;
    out.push(p);
  };
  for (let i = 0; i <= Math.min(main.fromIndex, frames.length - 1); i++) push(playerAt(frames[i], key));
  const now = main.players.find((p) => p.key === key);
  if (now) push({ x: now.x, y: now.y });
  return out;
}

// ─── Reproducción ───────────────────────────────────────────────────────────

/** Velocidades del visor 3D: cámara lenta 0,25× además de las del 2D. */
export const VIEWER_SPEEDS = [0.25, 0.5, 1, 2] as const;
export type ViewerSpeed = (typeof VIEWER_SPEEDS)[number];

/** ◀ ▶ cuadro a cuadro: el instante del cuadro anterior / siguiente. */
export function stepFrame(frames: TacticalFrame[], tMs: number, dir: -1 | 1): number {
  const starts = frames.map((_, i) => frameStartMs(frames, i));
  if (dir > 0) return starts.find((s) => s > tMs + 1) ?? totalDurationMs(frames);
  for (let i = starts.length - 1; i >= 0; i--) if (starts[i] < tMs - 1) return starts[i];
  return 0;
}

/** Número de cuadro (0-based) en el que se está o al que se llega. */
export function frameIndexAt(frames: TacticalFrame[], tMs: number): number {
  let index = 0;
  for (let i = 0; i < frames.length; i++) if (tMs >= frameStartMs(frames, i) - 1e-6) index = i;
  return index;
}

/** «Repetición»: el último tramo de la jugada (llegada al último cuadro). */
export function replayRange(frames: TacticalFrame[]): { startMs: number; endMs: number } {
  const endMs = totalDurationMs(frames);
  if (frames.length < 2) return { startMs: 0, endMs };
  return { startMs: frameStartMs(frames, frames.length - 2), endMs };
}

/** Velocidad de la repetición. */
export const REPLAY_SPEED: ViewerSpeed = 0.25;

/** Balón del instante en % del tablero (el del cuadro o el material «balón»). */
export function liveBallPct(main: Pick<InterpolatedFrame, 'ball' | 'arrows'>): { x: number; y: number } | null {
  if (main.ball) return { x: main.ball.x, y: main.ball.y };
  const obj = main.arrows.find((a) => a.shape.type === 'ball');
  return obj ? { x: obj.shape.x1, y: obj.shape.y1 } : null;
}

/**
 * A quién apunta el foco del cuadro congelado: el elegido si está; si no, el
 * más cercano al balón; sin balón, el primero.
 */
export function spotlightKey(
  main: Pick<InterpolatedFrame, 'players'>, ball: { x: number; y: number } | null, selectedKey: string | null,
): string | null {
  const visible = main.players.filter((p) => p.opacity > 0.01);
  if (selectedKey && visible.some((p) => p.key === selectedKey)) return selectedKey;
  if (visible.length === 0) return null;
  if (!ball) return visible[0].key;
  let best = visible[0];
  let bd = Infinity;
  for (const p of visible) {
    const d = Math.hypot(p.x - ball.x, p.y - ball.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best.key;
}
