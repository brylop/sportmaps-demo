/**
 * Animación por cuadros de la pizarra táctica (T1 de
 * docs/specs/pizarra-nivel-tacticalpad.md §4). Lógica PURA: sin React ni DOM.
 *
 * Esta es la interpolación canónica del reproductor de la pizarra. Reglas:
 *  - `frames[i].duration_ms` es lo que tarda en llegar al cuadro i desde el
 *    anterior; la del cuadro 0 no cuenta (no hay anterior).
 *  - Jugadores y balón: x/y con easing easeInOutCubic.
 *  - Un jugador (o el balón) que está en un cuadro y no en el otro entra o sale
 *    con fade, quieto en la posición donde sí está.
 *  - Figuras: si la misma figura (mismo índice) está igual en los dos cuadros,
 *    se queda fija. El material y los textos que solo cambiaron de lugar (mismo
 *    índice y mismo tipo) se DESLIZAN con el mismo easing que los jugadores —
 *    así un balón o un cono movido entre cuadros se ve moverse.
 *    El resto cambia por fundido: las del cuadro de origen se apagan en el
 *    primer 30 % de la transición y las del cuadro destino aparecen en el
 *    último 30 %.
 */
import type { TacticalArrow } from './footballQueries';
import { hydrateShape, isPointShape } from './tacticalGeometry';
import {
  DEFAULT_FRAME_MS, MAX_FRAME_MS, MIN_FRAME_MS, MAX_FRAMES,
  type TacticalFrame, type TacticalFramePlayer, type TacticalPlayerKey,
} from './tacticalFrames';

// ─── Tiempo ─────────────────────────────────────────────────────────────────

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Fracción de la transición en que las figuras se apagan / aparecen. */
export const ARROW_FADE_FRACTION = 0.3;

/** Duración saneada de la transición que LLEGA al cuadro. */
export function frameDuration(frame: Pick<TacticalFrame, 'duration_ms'>): number {
  const d = Number(frame.duration_ms);
  if (!Number.isFinite(d)) return DEFAULT_FRAME_MS;
  return clamp(d, MIN_FRAME_MS, MAX_FRAME_MS);
}

/** Duración total de la jugada en ms (suma de las transiciones). */
export function totalDurationMs(frames: Pick<TacticalFrame, 'duration_ms'>[]): number {
  let total = 0;
  for (let i = 1; i < frames.length; i++) total += frameDuration(frames[i]);
  return total;
}

/** Instante (ms) en que la reproducción LLEGA al cuadro i (0 para el primero). */
export function frameStartMs(frames: Pick<TacticalFrame, 'duration_ms'>[], index: number): number {
  let t = 0;
  for (let i = 1; i <= Math.min(index, frames.length - 1); i++) t += frameDuration(frames[i]);
  return t;
}

/** Avanza el reloj de reproducción `dtMs` reales a `speed`×. Al llegar al
 *  final: con `loop` vuelve a 0 (sumando el sobrante), si no se queda en el
 *  total y avisa `ended`. */
export function advancePlayback(
  tMs: number, dtMs: number, speed: number, totalMs: number, loop: boolean,
): { t: number; ended: boolean } {
  if (!(totalMs > 0)) return { t: 0, ended: true };
  const next = tMs + Math.max(0, dtMs) * speed;
  if (next < totalMs) return { t: next, ended: false };
  if (loop) return { t: next % totalMs, ended: false };
  return { t: totalMs, ended: true };
}

// ─── Interpolación ──────────────────────────────────────────────────────────

export interface InterpolatedPlayer {
  key: TacticalPlayerKey;
  x: number;
  y: number;
  /** 0-1: fade de entrada/salida. 1 si está en los dos cuadros. */
  opacity: number;
}

export interface InterpolatedArrow {
  shape: TacticalArrow;
  /** 0-1. Las figuras con opacidad 0 no se devuelven. */
  opacity: number;
}

export interface InterpolatedFrame {
  players: InterpolatedPlayer[];
  ball: { x: number; y: number; opacity: number } | null;
  arrows: InterpolatedArrow[];
  fromIndex: number;
  toIndex: number;
  /** Progreso lineal (sin easing) dentro de la transición, 0-1. */
  progress: number;
}

function playersByKey(frame: TacticalFrame): Map<string, { x: number; y: number }> {
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

/** Igualdad estructural de dos figuras (ignora campos undefined). */
export function shapesEqual(a: TacticalArrow, b: TacticalArrow): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Material y texto: se mueven enteros con un punto; entre cuadros se deslizan. */
const slides = (a: TacticalArrow, b: TacticalArrow) =>
  (a.type ?? 'arrow') === (b.type ?? 'arrow')
  && (isPointShape(a.type) || (a.type === 'text' && a.text === b.text))
  && (a.color ?? 'white') === (b.color ?? 'white');

/** Giro por el camino corto (350° → 10° gira 20°, no 340°). */
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

function staticFrame(frames: TacticalFrame[], index: number): InterpolatedFrame {
  const f = frames[index];
  return {
    players: [...playersByKey(f)].map(([key, p]) => ({ key, x: p.x, y: p.y, opacity: 1 })),
    ball: f.ball ? { x: Number(f.ball.x), y: Number(f.ball.y), opacity: 1 } : null,
    arrows: (f.arrows || []).map((shape) => ({ shape, opacity: 1 })),
    fromIndex: index,
    toIndex: index,
    progress: 1,
  };
}

/**
 * Estado de la jugada en el instante `tMs` (0 = cuadro 1). Fuera de rango se
 * recorta: antes de 0 es el primer cuadro, después del total, el último.
 */
export function interpolateFrames(frames: TacticalFrame[], tMs: number): InterpolatedFrame {
  if (!frames || frames.length === 0) {
    return { players: [], ball: null, arrows: [], fromIndex: 0, toIndex: 0, progress: 1 };
  }
  if (frames.length === 1 || !(tMs > 0)) return staticFrame(frames, 0);

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
  if (seg === -1) return staticFrame(frames, frames.length - 1);

  const from = frames[seg - 1];
  const to = frames[seg];
  const e = easeInOutCubic(progress);

  // Jugadores: en los dos → se desliza; en uno solo → fade quieto.
  const a = playersByKey(from);
  const b = playersByKey(to);
  const players: InterpolatedPlayer[] = [];
  for (const [key, pa] of a) {
    const pb = b.get(key);
    if (pb) players.push({ key, x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e), opacity: 1 });
    else players.push({ key, x: pa.x, y: pa.y, opacity: 1 - progress });
  }
  for (const [key, pb] of b) {
    if (!a.has(key)) players.push({ key, x: pb.x, y: pb.y, opacity: progress });
  }

  let ball: InterpolatedFrame['ball'] = null;
  if (from.ball && to.ball) {
    ball = { x: lerp(Number(from.ball.x), Number(to.ball.x), e), y: lerp(Number(from.ball.y), Number(to.ball.y), e), opacity: 1 };
  } else if (from.ball) {
    ball = { x: Number(from.ball.x), y: Number(from.ball.y), opacity: 1 - progress };
  } else if (to.ball) {
    ball = { x: Number(to.ball.x), y: Number(to.ball.y), opacity: progress };
  }

  // Figuras, emparejadas por índice (un cuadro nuevo es copia del anterior,
  // así que la misma figura conserva su índice).
  const fadeOut = clamp(1 - progress / ARROW_FADE_FRACTION, 0, 1);
  const fadeIn = clamp((progress - (1 - ARROW_FADE_FRACTION)) / ARROW_FADE_FRACTION, 0, 1);
  const fa = from.arrows || [];
  const fb = to.arrows || [];
  const stay: InterpolatedArrow[] = [];
  const leaving: InterpolatedArrow[] = [];
  const entering: InterpolatedArrow[] = [];
  for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
    const sa = fa[i];
    const sb = fb[i];
    if (sa && sb && shapesEqual(sa, sb)) {
      stay.push({ shape: sb, opacity: 1 });
      continue;
    }
    if (sa && sb && slides(sa, sb)) {
      const moved: TacticalArrow = {
        ...sb,
        x1: lerp(sa.x1, sb.x1, e), y1: lerp(sa.y1, sb.y1, e),
        x2: lerp(sa.x2, sb.x2, e), y2: lerp(sa.y2, sb.y2, e),
      };
      if (sa.size != null || sb.size != null) moved.size = lerp(sa.size ?? 1, sb.size ?? 1, e);
      if (sa.rot != null || sb.rot != null) moved.rot = ((lerpAngle(sa.rot ?? 0, sb.rot ?? 0, e) % 360) + 360) % 360;
      stay.push({ shape: moved, opacity: 1 });
      continue;
    }
    if (sa && fadeOut > 0) leaving.push({ shape: sa, opacity: fadeOut });
    if (sb && fadeIn > 0) entering.push({ shape: sb, opacity: fadeIn });
  }

  return { players, ball, arrows: [...stay, ...leaving, ...entering], fromIndex: seg - 1, toIndex: seg, progress };
}

/** Agrupa las figuras interpoladas por opacidad (redondeada): el reproductor
 *  dibuja una capa por grupo en vez de una opacidad por figura. */
export function groupArrowsByOpacity(arrows: InterpolatedArrow[]): { opacity: number; shapes: TacticalArrow[] }[] {
  const groups = new Map<number, TacticalArrow[]>();
  for (const a of arrows) {
    const o = Math.round(a.opacity * 100) / 100;
    if (o <= 0) continue;
    const list = groups.get(o);
    if (list) list.push(a.shape); else groups.set(o, [a.shape]);
  }
  return [...groups.entries()].sort((x, y) => y[0] - x[0]).map(([opacity, shapes]) => ({ opacity, shapes }));
}

// ─── Rastro fantasma ────────────────────────────────────────────────────────

/** Movimientos de cada jugador desde el cuadro anterior (para dibujar la línea
 *  punteada). Ignora desplazamientos menores a `minDist` (% de cancha). */
export function ghostTrail(
  prev: TacticalFrame | undefined,
  current: { players: TacticalFramePlayer[] },
  minDist = 0.5,
): { key: TacticalPlayerKey; from: { x: number; y: number }; to: { x: number; y: number } }[] {
  if (!prev) return [];
  const before = playersByKey(prev);
  const out: { key: TacticalPlayerKey; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  for (const p of current.players) {
    const q = before.get(p.key);
    if (!q) continue;
    if (Math.hypot(p.x - q.x, p.y - q.y) < minDist) continue;
    out.push({ key: p.key, from: q, to: { x: p.x, y: p.y } });
  }
  return out;
}

// ─── Edición de la lista de cuadros ─────────────────────────────────────────

let idSeq = 0;
/** Id local de un cuadro (no hace falta que sea un uuid: solo distingue
 *  cuadros dentro de una jugada). */
export function newFrameId(): string {
  idSeq = (idSeq + 1) % 1e6;
  return `f${Date.now().toString(36)}${idSeq.toString(36)}`;
}

const cloneFrame = (f: TacticalFrame, id: string): TacticalFrame => ({
  id,
  duration_ms: f.duration_ms,
  players: f.players.map((p) => ({ ...p })),
  ball: f.ball ? { ...f.ball } : null,
  arrows: f.arrows.map((a) => ({ ...a, ...(a.points ? { points: [...a.points] } : {}) })),
});

/** «+ Cuadro»: copia el cuadro `index` justo después y lo devuelve como
 *  seleccionado. Con el tope alcanzado no hace nada. */
export function duplicateFrameAt(frames: TacticalFrame[], index: number, id = newFrameId()): { frames: TacticalFrame[]; index: number } {
  if (frames.length >= MAX_FRAMES || !frames[index]) return { frames, index };
  const copy = cloneFrame(frames[index], id);
  copy.duration_ms = DEFAULT_FRAME_MS;
  const next = [...frames.slice(0, index + 1), copy, ...frames.slice(index + 1)];
  return { frames: next, index: index + 1 };
}

/** Quita el cuadro `index` (nunca el último que queda). Selecciona el anterior. */
export function removeFrameAt(frames: TacticalFrame[], index: number): { frames: TacticalFrame[]; index: number } {
  if (frames.length <= 1 || !frames[index]) return { frames, index: Math.min(index, frames.length - 1) };
  const next = frames.filter((_, i) => i !== index);
  return { frames: next, index: Math.max(0, index - 1) };
}

/** Mueve el cuadro `from` a la posición `to`. */
export function moveFrame(frames: TacticalFrame[], from: number, to: number): TacticalFrame[] {
  if (from === to || !frames[from] || to < 0 || to >= frames.length) return frames;
  const next = [...frames];
  const [f] = next.splice(from, 1);
  next.splice(to, 0, f);
  return next;
}

export function setFrameDuration(frames: TacticalFrame[], index: number, ms: number): TacticalFrame[] {
  if (!frames[index]) return frames;
  const d = Math.round(clamp(ms, MIN_FRAME_MS, MAX_FRAME_MS));
  return frames.map((f, i) => (i === index ? { ...f, duration_ms: d } : f));
}

// ─── Entrada / salida ───────────────────────────────────────────────────────

const finite01 = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, 0, 100) : null;
};

/**
 * Normaliza los cuadros que llegan del BFF (jsonb: numeric puede venir como
 * string; un cuadro roto se descarta, no revienta la pizarra). null si no hay
 * cuadros utilizables. Con `ballAsObject`, el `ball` de un cuadro se pasa a
 * una figura «balón» (la pizarra mueve el balón como material) salvo que el
 * cuadro ya tenga uno.
 */
export function hydrateFrames(raw: unknown, opts: { ballAsObject?: boolean } = {}): TacticalFrame[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: TacticalFrame[] = [];
  for (const f of raw.slice(0, MAX_FRAMES)) {
    if (!f || typeof f !== 'object') continue;
    const fr = f as Partial<TacticalFrame>;
    const players: TacticalFramePlayer[] = [];
    const seen = new Set<string>();
    for (const p of Array.isArray(fr.players) ? fr.players : []) {
      if (!p || typeof p.key !== 'string' || seen.has(p.key)) continue;
      const x = finite01(p.x);
      const y = finite01(p.y);
      if (x === null || y === null) continue;
      seen.add(p.key);
      players.push({ key: p.key, x, y });
    }
    const arrows = (Array.isArray(fr.arrows) ? fr.arrows : [])
      .filter((a): a is TacticalArrow => !!a && typeof a === 'object')
      .map(hydrateShape);
    let ball: TacticalFrame['ball'] = null;
    if (fr.ball && typeof fr.ball === 'object') {
      const bx = finite01(fr.ball.x);
      const by = finite01(fr.ball.y);
      if (bx !== null && by !== null) ball = { x: bx, y: by };
    }
    if (ball && opts.ballAsObject) {
      if (!arrows.some((a) => a.type === 'ball')) arrows.push({ type: 'ball', x1: ball.x, y1: ball.y, x2: ball.x, y2: ball.y });
      ball = null;
    }
    out.push({
      id: typeof fr.id === 'string' && fr.id ? fr.id : newFrameId(),
      duration_ms: frameDuration({ duration_ms: fr.duration_ms ?? DEFAULT_FRAME_MS }),
      players,
      ball,
      arrows,
    });
  }
  return out.length > 0 ? out : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Cuadros listos para guardar: null si la jugada es un solo cuadro (las
 *  columnas de siempre alcanzan y la fila queda chica). Redondea coordenadas a
 *  2 decimales (el jsonb no necesita 15). */
export function serializeFrames(frames: TacticalFrame[]): TacticalFrame[] | null {
  if (frames.length <= 1) return null;
  return frames.slice(0, MAX_FRAMES).map((f) => ({
    id: f.id,
    duration_ms: frameDuration(f),
    players: f.players.map((p) => ({ key: p.key, x: round2(p.x), y: round2(p.y) })),
    ball: f.ball ? { x: round2(f.ball.x), y: round2(f.ball.y) } : null,
    arrows: f.arrows,
  }));
}

/** Estado del reproductor: en pausa la cancha muestra el instante pausado. */
export type PlayState = 'stopped' | 'playing' | 'paused';
export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// ─── Reloj de reproducción ──────────────────────────────────────────────────

/** Reloj observable: el bucle de requestAnimationFrame escribe acá y solo se
 *  re-renderizan los componentes suscritos (capa de reproducción y barra de
 *  progreso), no el tablero entero 60 veces por segundo. */
export interface PlaybackClock {
  get(): number;
  set(tMs: number): void;
  subscribe(listener: () => void): () => void;
}

export function createPlaybackClock(initial = 0): PlaybackClock {
  let t = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => t,
    set(next) {
      if (next === t) return;
      t = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
