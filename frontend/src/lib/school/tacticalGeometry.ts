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
  if (Array.isArray(a.points)) out.points = a.points.map(Number);
  if (typeof a.text === 'string') out.text = a.text;
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

// ─── Lápiz libre y texto ────────────────────────────────────────────────────

/** Tope de puntos de un trazo: el mismo FREEHAND_MAX_POINTS del BFF. */
export const FREEHAND_MAX_POINTS = 600;
/** Tope de caracteres del texto: el mismo TEXT_MAX_LENGTH del BFF. */
export const TEXT_MAX_LENGTH = 80;

/** Distancia de un punto al segmento a-b (todo en la misma unidad). */
function distToSegment(p: ArrowPoint, a: ArrowPoint, b: ArrowPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer-Douglas-Peucker: deja los puntos que dan la forma y tira los que
 *  caen casi sobre la recta. `tolerance` en % de cancha: 0.35 no se nota a
 *  la vista y baja un trazo de cientos de eventos de puntero a decenas. */
export function simplifyStroke(points: ArrowPoint[], tolerance = 0.35): ArrowPoint[] {
  if (points.length <= 2) return points.slice();
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i], first, last);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist <= tolerance) return [first, last];
  const left = simplifyStroke(points.slice(0, index + 1), tolerance);
  const right = simplifyStroke(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Trazo de puntero → figura freehand lista para guardar (o null si fue un
 *  toque sin recorrido). Simplifica, recorta al tope del BFF, redondea a 2
 *  decimales y fija x1..y2 a la caja del trazo (la validación las exige y
 *  "duplicar"/borrador las usan). */
export function buildFreehandShape(raw: ArrowPoint[], color: TacticalArrow['color']): TacticalArrow | null {
  if (raw.length < 2) return null;
  let pts = simplifyStroke(raw);
  // Un trazo larguísimo que ni simplificado entra: se recorta parejo.
  if (pts.length > FREEHAND_MAX_POINTS) {
    const step = pts.length / FREEHAND_MAX_POINTS;
    pts = Array.from({ length: FREEHAND_MAX_POINTS }, (_, i) => pts[Math.floor(i * step)]);
  }
  const r = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;
  const xs = pts.map((p) => r(p.x));
  const ys = pts.map((p) => r(p.y));
  if (pts.length === 2 && Math.hypot(xs[1] - xs[0], ys[1] - ys[0]) < 0.5) return null;
  return {
    type: 'freehand',
    x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys),
    color,
    points: xs.flatMap((x, i) => [x, ys[i]]),
  };
}

/** Path SVG suavizado de un trazo: curvas cuadráticas por los puntos medios
 *  (el dibujo a mano no queda "quebrado" aunque se haya simplificado). Entra
 *  en espacio SVG ya escalado. */
export function smoothPathD(pts: ArrowPoint[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} l 0.01 0`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** [x,y,x,y,…] → puntos. */
export const pairsOf = (flat: number[] | undefined): ArrowPoint[] => {
  const out: ArrowPoint[] = [];
  if (!flat) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
};

/** ¿El borrador (punto `p`, radio `r`, ambos en % de cancha) toca la figura?
 *  Trazo: cercanía a cualquiera de sus segmentos. Texto y objetos: su punto.
 *  Flechas/curvas/recorridos: el segmento entre extremos. Zona: dentro del
 *  rectángulo. Aproximado a propósito: es un borrador, no una selección fina. */
export function eraserHits(s: TacticalArrow, p: ArrowPoint, r: number): boolean {
  if (s.type === 'freehand') {
    const pts = pairsOf(s.points);
    if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= r;
    for (let i = 0; i + 1 < pts.length; i++) if (distToSegment(p, pts[i], pts[i + 1]) <= r) return true;
    return false;
  }
  if (s.type === 'zone') {
    return p.x >= Math.min(s.x1, s.x2) - r && p.x <= Math.max(s.x1, s.x2) + r
      && p.y >= Math.min(s.y1, s.y2) - r && p.y <= Math.max(s.y1, s.y2) + r;
  }
  if (s.type === 'text' || isPointShape(s.type)) {
    return Math.hypot(p.x - s.x1, p.y - s.y1) <= r + 2.5 * (s.size ?? 1);
  }
  return distToSegment(p, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) <= r;
}

/** Desplaza una figura entera (duplicar): también los puntos del trazo. */
export function offsetShape(s: TacticalArrow, dx: number, dy: number): TacticalArrow {
  const cx = (n: number) => Math.min(100, Math.max(0, n));
  const out: TacticalArrow = { ...s, x1: cx(s.x1 + dx), y1: cx(s.y1 + dy), x2: cx(s.x2 + dx), y2: cx(s.y2 + dy) };
  if (s.points) out.points = s.points.map((n, i) => cx(n + (i % 2 === 0 ? dx : dy)));
  return out;
}
