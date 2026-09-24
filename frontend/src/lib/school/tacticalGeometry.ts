/**
 * Geometría pura de la pizarra táctica (sin React): ventana visible (zoom al
 * área), conversión de coordenadas, comba de curvas, recorridos de balón y el
 * catálogo de material con sus cajas. Vive aparte de TacticalBoard.tsx para
 * poder testearla en unidad y reutilizarla (paleta, futuro visor 3D).
 *
 * Convención de coordenadas: todo lo GUARDADO está en % de cancha completa
 * (x 0-100, y 0-100). El viewBox del SVG es 300×340, así que x*3 e y*3.4 dan
 * unidades SVG. La "ventana visible" solo cambia qué parte se mira.
 */
import type { TacticalArrow, TacticalShapeType } from './footballQueries';

// ─── Ventana visible ────────────────────────────────────────────────────────

/** Ventana vertical visible de la cancha, en % 0-100. Cancha completa =
 *  {y0:0, y1:100}; modo arqueros = solo el tercio defensivo (área + un
 *  tramo antes). Las coordenadas guardadas siguen siendo siempre de cancha
 *  completa: una plantilla armada con zoom se ve bien en cancha completa y
 *  viceversa. */
export interface PitchView { y0: number; y1: number }
export const FULL_VIEW: PitchView = { y0: 0, y1: 100 };
export const GK_VIEW: PitchView = { y0: 52, y1: 100 };

export const viewBoxOf = (v: PitchView) => `0 ${v.y0 * 3.4} 300 ${(v.y1 - v.y0) * 3.4}`;
/** y de cancha (0-100) → % dentro de la ventana visible (pines HTML). */
export const yToView = (y: number, v: PitchView) => ((y - v.y0) / (v.y1 - v.y0)) * 100;
/** % dentro de la ventana visible → y de cancha (0-100). */
export const yFromView = (vy: number, v: PitchView) => v.y0 + (vy / 100) * (v.y1 - v.y0);

// ─── Puntos y curvas ────────────────────────────────────────────────────────

/** Punto en el mismo espacio 0-100 que x/y de jugadores y slots -- se
 *  convierte al viewBox real (300x340) solo al dibujar, para no manejar dos
 *  sistemas de coordenadas. */
export interface ArrowPoint { x: number; y: number }

/** Punto de control de una curva, calculado en espacio SVG (no en % 0-100)
 *  para que el "abombado" se vea perpendicular de verdad -- la cancha no es
 *  cuadrada (300x340), así que un offset calculado en % antes de escalar
 *  queda torcido. `offsetFactor` = comba relativa al largo (0.18 para las
 *  curvas de jugador; los recorridos de balón usan una más chata). */
export function curveControlPoint(p1: { x: number; y: number }, p2: { x: number; y: number }, offsetFactor = 0.18) {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular normalizado * factor de la longitud -- "comba" fija, no es
  // dibujo libre de la curva, es la forma más simple que se distingue de
  // una flecha recta sin pedirle al usuario un gesto de 3 puntos.
  const offset = len * offsetFactor;
  return { x: mx - (dy / len) * offset, y: my + (dx / len) * offset };
}

// ─── Figuras: normalización y recorridos de balón ───────────────────────────

/** Normaliza una figura que llega del BFF/jsonb (numeric de Postgres puede
 *  venir como string) conservando los campos opcionales nuevos. Una figura
 *  guardada antes de 2026-09-24 (sin size/rot/kind) sale igual que entró. */
export function hydrateShape(a: TacticalArrow): TacticalArrow {
  const out: TacticalArrow = { type: a.type, x1: Number(a.x1), y1: Number(a.y1), x2: Number(a.x2), y2: Number(a.y2), color: a.color };
  if (a.size != null) out.size = Number(a.size);
  if (a.rot != null) out.rot = Number(a.rot);
  if (a.kind) out.kind = a.kind;
  return out;
}

/** Comba de los recorridos de balón elevados (remate/penal): más chata que la
 *  de una curva de jugador, para que se lea como trayectoria y no como desvío. */
export const BALL_PATH_BEND = 0.12;
export const isLoftedPath = (a: TacticalArrow) => a.kind === 'remate' || a.kind === 'penal';

/** Punto (en % de cancha) sobre un ball_path en t∈[0,1]. Recta para el pase;
 *  la MISMA Bézier cuadrática que se dibuja, para remate/penal -- se calcula
 *  en espacio SVG y se vuelve a %, para que la animación siga exactamente la
 *  línea que el coach ve. */
export function ballPathPoint(a: TacticalArrow, t: number): ArrowPoint {
  if (!isLoftedPath(a)) return { x: a.x1 + (a.x2 - a.x1) * t, y: a.y1 + (a.y2 - a.y1) * t };
  const p1 = { x: a.x1 * 3, y: a.y1 * 3.4 };
  const p2 = { x: a.x2 * 3, y: a.y2 * 3.4 };
  const c = curveControlPoint(p1, p2, BALL_PATH_BEND);
  const mt = 1 - t;
  return {
    x: (mt * mt * p1.x + 2 * mt * t * c.x + t * t * p2.x) / 3,
    y: (mt * mt * p1.y + 2 * mt * t * c.y + t * t * p2.y) / 3.4,
  };
}

// ─── Material (objetos de un punto) ─────────────────────────────────────────

/** Objetos de UN punto (se colocan con un toque, no arrastrando de A a B
 *  como flecha/curva/zona). Material de entrenamiento de fútbol: cono,
 *  plato, balón, arco (movible y girable), arco chico, vallita, aro,
 *  escalera, estaca, maniquí y rival. El orden es el de la paleta.
 *  Ampliar JUNTO con TacticalShapeType (footballQueries.ts), OBJECT_LABEL /
 *  renderObjectBody (tacticalGlyphs.tsx) y VALID_SHAPE_TYPES (bff football.ts). */
export const OBJECT_TYPES = ['cone', 'marker', 'ball', 'goal', 'mini_goal', 'hurdle', 'ring', 'ladder', 'pole', 'mannequin', 'opponent'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];
export const isPointShape = (t: TacticalShapeType | undefined): t is ObjectType =>
  !!t && (OBJECT_TYPES as readonly string[]).includes(t);

/** Caja (ancho × alto en unidades del viewBox, sin escalar) de cada objeto:
 *  área de toque, marco de selección y posición de los handles. */
export const OBJECT_BOX: Record<ObjectType, { w: number; h: number }> = {
  cone: { w: 14, h: 15 }, marker: { w: 13, h: 8 }, ball: { w: 14, h: 14 }, goal: { w: 34, h: 13 },
  mini_goal: { w: 20, h: 9 }, hurdle: { w: 17, h: 10 }, ring: { w: 16, h: 16 }, ladder: { w: 12, h: 35 },
  pole: { w: 8, h: 20 }, mannequin: { w: 14, h: 23 }, opponent: { w: 16, h: 16 },
};
/** Rango del slider de tamaño. El BFF acepta 0.25–4 (margen) y rechaza el resto. */
export const OBJ_SIZE_MIN = 0.5;
export const OBJ_SIZE_MAX = 3;
