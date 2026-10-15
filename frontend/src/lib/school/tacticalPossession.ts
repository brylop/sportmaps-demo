/**
 * Posesión del balón por cuadro (M6g, docs/specs/pizarra-m6-paridad-tacticalpad.md §4).
 * Lógica PURA: sin React ni DOM.
 *
 * Formato: cada cuadro puede llevar `ball_owner` = clave del jugador que tiene
 * el balón en ese cuadro (campo OPCIONAL del jsonb `frames`; el BFF lo valida
 * y lo conserva en sanitizeFrames). Sin `ball_owner` en ningún cuadro la jugada
 * se reproduce exactamente como antes (el balón es una figura que se desliza).
 *
 * Con posesión, el balón tiene un «ancla» en cada cuadro:
 *  - si hay dueño y está en el cuadro: a sus pies (posición + BALL_OFFSET);
 *  - si no: donde esté el balón suelto del cuadro (`ball` o la figura 'ball').
 * Entre dos cuadros el balón va de un ancla a la otra con la misma curva que
 * los jugadores. Con el mismo dueño eso es exactamente «se mueve con él» (el
 * ancla es su posición + una constante); con dueños distintos es el PASE, y
 * se dibuja una línea de pase (passesOf).
 */
import type { TacticalArrow } from './footballQueries';
import type { TacticalFrame } from './tacticalFrames';
import { applyCurve, type AnimationCurve } from './tacticalBoardSettings';

/** Balón a los pies del jugador: abajo a la derecha de la ficha, sin tapar
 *  su etiqueta (% de cancha). */
export const BALL_OFFSET = { x: 3.2, y: 1.4 } as const;

export interface Pt { x: number; y: number }

const clamp100 = (n: number) => Math.min(100, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** ¿La jugada usa posesión? (algún cuadro con dueño). */
export function hasPossession(frames: readonly TacticalFrame[] | null | undefined): boolean {
  return !!frames && frames.some((f) => typeof f?.ball_owner === 'string' && f.ball_owner !== '');
}

function playerPos(frame: TacticalFrame, key: string): Pt | null {
  const p = (frame.players || []).find((q) => q?.key === key);
  if (!p) return null;
  const x = Number(p.x);
  const y = Number(p.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** Dónde queda el balón de un jugador que está en (x, y): a sus pies. */
export function ballAtFeet(p: Pt): Pt {
  return { x: clamp100(p.x + BALL_OFFSET.x), y: clamp100(p.y + BALL_OFFSET.y) };
}

/** Dueño del balón en el cuadro, solo si ese jugador está en la cancha. */
export function ownerOf(frame: TacticalFrame | undefined): string | null {
  if (!frame || typeof frame.ball_owner !== 'string' || !frame.ball_owner) return null;
  return playerPos(frame, frame.ball_owner) ? frame.ball_owner : null;
}

/** Índice de la figura balón del cuadro (la pizarra mueve el balón como material). */
export function ballShapeIndex(arrows: readonly TacticalArrow[] | undefined): number {
  return (arrows || []).findIndex((a) => a?.type === 'ball');
}

/** Balón suelto del cuadro: el `ball` del jsonb o la figura 'ball'. */
export function looseBallOf(frame: TacticalFrame | undefined): Pt | null {
  if (!frame) return null;
  if (frame.ball) return { x: Number(frame.ball.x), y: Number(frame.ball.y) };
  const i = ballShapeIndex(frame.arrows);
  return i >= 0 ? { x: frame.arrows[i].x1, y: frame.arrows[i].y1 } : null;
}

/** Dónde está el balón en el cuadro (a los pies del dueño o suelto). */
export function ballAnchor(frame: TacticalFrame | undefined): Pt | null {
  const owner = ownerOf(frame);
  if (owner && frame) {
    return ballAtFeet(playerPos(frame, owner)!);
  }
  return looseBallOf(frame);
}

/** Segmento de la reproducción en `tMs`: cuadros de origen/destino y progreso
 *  lineal (misma partición que interpolateFrames). */
export function segmentAt(frames: readonly TacticalFrame[], tMs: number, durationOf: (f: TacticalFrame) => number): { from: number; to: number; progress: number } {
  if (frames.length <= 1 || !(tMs > 0)) return { from: 0, to: 0, progress: 1 };
  let acc = 0;
  for (let i = 1; i < frames.length; i++) {
    const d = durationOf(frames[i]);
    if (tMs < acc + d) return { from: i - 1, to: i, progress: (tMs - acc) / d };
    acc += d;
  }
  return { from: frames.length - 1, to: frames.length - 1, progress: 1 };
}

/**
 * Balón con posesión en el instante. null si la jugada no usa posesión (el que
 * llama sigue con el comportamiento de siempre) o si no hay balón en ninguno
 * de los dos cuadros.
 */
export function possessionBallAt(
  frames: readonly TacticalFrame[],
  tMs: number,
  curve: AnimationCurve | undefined,
  durationOf: (f: TacticalFrame) => number,
): (Pt & { owner: string | null }) | null {
  if (!hasPossession(frames)) return null;
  const { from, to, progress } = segmentAt(frames, tMs, durationOf);
  const a = ballAnchor(frames[from]);
  const b = ballAnchor(frames[to]);
  if (!a && !b) return null;
  if (!a || !b) {
    const p = (a ?? b)!;
    return { ...p, owner: ownerOf(frames[a ? from : to]) };
  }
  const e = applyCurve(curve, progress);
  const owner = progress >= 1 ? ownerOf(frames[to]) : ownerOf(frames[from]);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), owner };
}

export interface PassLine {
  /** El pase ocurre en la transición que LLEGA a este cuadro. */
  toIndex: number;
  fromKey: string;
  toKey: string;
  from: Pt;
  to: Pt;
}

/** Pases de la jugada: cada transición en la que el balón cambia de dueño. */
export function passesOf(frames: readonly TacticalFrame[]): PassLine[] {
  const out: PassLine[] = [];
  for (let i = 1; i < frames.length; i++) {
    const a = ownerOf(frames[i - 1]);
    const b = ownerOf(frames[i]);
    if (!a || !b || a === b) continue;
    const from = ballAnchor(frames[i - 1]);
    const to = ballAnchor(frames[i]);
    if (from && to) out.push({ toIndex: i, fromKey: a, toKey: b, from, to });
  }
  return out;
}

/** Pases ya empezados en `tMs` (el que está en curso incluido). */
export function passesUntil(
  frames: readonly TacticalFrame[],
  tMs: number,
  durationOf: (f: TacticalFrame) => number,
): PassLine[] {
  if (!(tMs > 0)) return [];
  const seg = segmentAt(frames, tMs, durationOf);
  return passesOf(frames).filter((p) => p.toIndex <= seg.to);
}

/** Pone (o quita con null) el dueño del balón del cuadro `index`. */
export function setBallOwner(frames: TacticalFrame[], index: number, key: string | null): TacticalFrame[] {
  if (!frames[index]) return frames;
  return frames.map((f, i) => {
    if (i !== index) return f;
    const next: TacticalFrame = { ...f };
    if (key) next.ball_owner = key;
    else delete next.ball_owner;
    return next;
  });
}

/** Deja la figura balón del cuadro en `at` (la agrega si no hay): así el
 *  cuadro quieto muestra el balón donde lo va a llevar la reproducción. */
export function placeBallShape(arrows: TacticalArrow[], at: Pt): TacticalArrow[] {
  const i = ballShapeIndex(arrows);
  if (i < 0) return [...arrows, { type: 'ball', x1: at.x, y1: at.y, x2: at.x, y2: at.y }];
  const cur = arrows[i];
  if (cur.x1 === at.x && cur.y1 === at.y) return arrows;
  return arrows.map((a, j) => (j === i ? { ...a, x1: at.x, y1: at.y, x2: at.x, y2: at.y } : a));
}

/** Cambia la clave del dueño con `map` (plantillas: jugador ↔ slot#i). Si la
 *  clave no tiene equivalente, el cuadro queda sin dueño. */
export function remapBallOwner(frame: TacticalFrame, map: (key: string) => string | undefined): TacticalFrame {
  if (typeof frame.ball_owner !== 'string' || !frame.ball_owner) return frame;
  const k = map(frame.ball_owner);
  const next: TacticalFrame = { ...frame };
  if (k) next.ball_owner = k;
  else delete next.ball_owner;
  return next;
}
