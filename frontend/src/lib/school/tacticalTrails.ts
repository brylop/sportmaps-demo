/**
 * Rastros de la animación (M6g): la ruta que ya recorrió cada jugador y la
 * trayectoria del balón hasta el instante actual. Lógica PURA, la comparten
 * la capa de reproducción 2D (TacticalPlaybackTrails) y el GIF/video
 * (tacticalFrameRenderer).
 *
 * Entre dos cuadros todo se mueve en línea recta (la curva solo cambia la
 * VELOCIDAD, no el camino), así que la ruta exacta es la polilínea de las
 * posiciones en cada cuadro ya alcanzado + la posición interpolada de ahora.
 */
import type { TacticalFrame } from './tacticalFrames';
import { applyCurve, teamOfKey, type AnimationCurve, type TeamSide } from './tacticalBoardSettings';
import { ballAnchor, segmentAt, type Pt } from './tacticalPossession';
import { isPointShape } from './tacticalGeometry';

/** Colores de los rastros (2D y export iguales). */
export const TRAIL_COLORS = {
  home: '#34d399', // emerald-400, el verde de las fichas
  away: '#f87171', // red-400, el rojo del rival
  ball: '#fde047', // yellow-300
  pass: '#facc15', // yellow-400
} as const;

export interface TrailPath {
  /** Clave del jugador o `shape#i` para una figura rival que se desliza. */
  key: string;
  team: TeamSide;
  points: Pt[];
}

export interface TrailFilter {
  home: boolean;
  away: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const near = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 0.05;

function push(points: Pt[], p: Pt) {
  if (points.length === 0 || !near(points[points.length - 1], p)) points.push(p);
}

/** Posición de un jugador en el cuadro (null si no está). */
function posIn(frame: TacticalFrame, key: string): Pt | null {
  const p = (frame.players || []).find((q) => q?.key === key);
  return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) ? { x: Number(p.x), y: Number(p.y) } : null;
}

/**
 * Ruta acumulada de cada jugador hasta `tMs`. Solo cuenta tramos en que el
 * jugador está en los dos cuadros (si sale y vuelve a entrar, la ruta empieza
 * de nuevo). Devuelve solo las que se movieron (2+ puntos).
 * Las figuras «rival» (opponent) que se deslizan entre cuadros cuentan como
 * equipo visitante: así se ve también la ruta de los rivales de una jugada
 * guardada desde la IA.
 */
export function playerTrailsAt(
  frames: readonly TacticalFrame[],
  tMs: number,
  curve: AnimationCurve | undefined,
  durationOf: (f: TacticalFrame) => number,
  filter: TrailFilter,
  teamOf: (key: string) => TeamSide = teamOfKey,
): TrailPath[] {
  if (frames.length < 2 || !(tMs > 0) || (!filter.home && !filter.away)) return [];
  const seg = segmentAt(frames, tMs, durationOf);
  const e = applyCurve(curve, seg.progress);
  const out: TrailPath[] = [];

  const keys = new Set<string>();
  for (const f of frames.slice(0, seg.to + 1)) for (const p of f.players || []) if (p?.key) keys.add(p.key);
  for (const key of keys) {
    const team = teamOf(key);
    if (!(team === 'home' ? filter.home : filter.away)) continue;
    let points: Pt[] = [];
    for (let i = 0; i <= seg.from; i++) {
      const p = posIn(frames[i], key);
      if (!p) { points = []; continue; }
      push(points, p);
    }
    if (seg.to !== seg.from) {
      const a = posIn(frames[seg.from], key);
      const b = posIn(frames[seg.to], key);
      if (a && b) push(points, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) });
    }
    if (points.length >= 2) out.push({ key, team, points });
  }

  if (filter.away) {
    // Figuras rival: emparejadas por índice, igual que las desliza interpolateFrames.
    const maxShapes = Math.max(...frames.slice(0, seg.to + 1).map((f) => (f.arrows || []).length), 0);
    for (let s = 0; s < maxShapes; s++) {
      let points: Pt[] = [];
      const at = (i: number): Pt | null => {
        const a = frames[i]?.arrows?.[s];
        return a && a.type === 'opponent' && isPointShape(a.type) ? { x: a.x1, y: a.y1 } : null;
      };
      for (let i = 0; i <= seg.from; i++) {
        const p = at(i);
        if (!p) { points = []; continue; }
        push(points, p);
      }
      if (seg.to !== seg.from) {
        const a = at(seg.from);
        const b = at(seg.to);
        if (a && b) push(points, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) });
      }
      if (points.length >= 2) out.push({ key: `shape#${s}`, team: 'away', points });
    }
  }
  return out;
}

/**
 * Trayectoria del balón hasta `tMs`: ancla del balón en cada cuadro alcanzado
 * (a los pies del dueño o suelto) + la posición de ahora. Vacía si se movió
 * menos de un punto.
 */
export function ballTrailAt(
  frames: readonly TacticalFrame[],
  tMs: number,
  curve: AnimationCurve | undefined,
  durationOf: (f: TacticalFrame) => number,
): Pt[] {
  if (frames.length < 2 || !(tMs > 0)) return [];
  const seg = segmentAt(frames, tMs, durationOf);
  const e = applyCurve(curve, seg.progress);
  let points: Pt[] = [];
  for (let i = 0; i <= seg.from; i++) {
    const p = ballAnchor(frames[i]);
    if (!p) { points = []; continue; }
    push(points, p);
  }
  if (seg.to !== seg.from) {
    const a = ballAnchor(frames[seg.from]);
    const b = ballAnchor(frames[seg.to]);
    if (a && b) push(points, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) });
  }
  return points.length >= 2 ? points : [];
}

/** Opacidad de cada tramo de un rastro: el más viejo casi transparente, el
 *  de ahora casi opaco (el «fade» del rastro). n = cantidad de tramos. */
export function trailSegmentOpacity(index: number, n: number): number {
  if (n <= 1) return 0.85;
  return 0.2 + (0.65 * index) / (n - 1);
}

