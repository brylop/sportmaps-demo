/**
 * M6d (docs/specs/pizarra-m6-paridad-tacticalpad.md): geometría pura de las
 * herramientas de dibujo nuevas -- estilos de línea con convención de leyenda,
 * zonas (rectángulo / elipse / polígono, giratorias), foco sobre un jugador y
 * numeración de movimientos. Sin React: la usan la capa de dibujo de la
 * pizarra, TacticalStaticSvg (PNG/PDF/GIF/video) y el visor 3D.
 *
 * Coordenadas: lo GUARDADO está en % de cancha completa (0-100). Lo que
 * devuelven las funciones "Svg" está en unidades del viewBox 300×340.
 */
import type { TacticalArrow } from './footballQueries';
import { curveControlPoint, BALL_PATH_BEND, isLoftedPath, type ArrowPoint } from './tacticalGeometry';

// ─── Estilos de línea ───────────────────────────────────────────────────────

/** Convención de la leyenda (la de TacticalPad, Tacticsboard y la pizarra de
 *  cualquier cuerpo técnico): pase = discontinua con flecha; conducción =
 *  ondulada; carrera sin balón = continua; disparo = doble/gruesa. */
export type LineStyle = 'pass' | 'dribble' | 'run' | 'shot';
export const LINE_STYLES: LineStyle[] = ['pass', 'dribble', 'run', 'shot'];
export const LINE_STYLE_LABEL: Record<LineStyle, string> = {
  pass: 'Pase', dribble: 'Conducción', run: 'Carrera sin balón', shot: 'Disparo',
};
export const LINE_STYLE_HINT: Record<LineStyle, string> = {
  pass: 'Discontinua con flecha',
  dribble: 'Ondulada (con el balón en los pies)',
  run: 'Continua (desmarque, sin balón)',
  shot: 'Doble y gruesa',
};
export const isLineStyle = (v: unknown): v is LineStyle => typeof v === 'string' && (LINE_STYLES as string[]).includes(v);

const toSvg = (p: ArrowPoint): ArrowPoint => ({ x: p.x * 3, y: p.y * 3.4 });

/** Línea central de una flecha o curva, en unidades SVG (la curva, muestreada). */
export function lineCenterSvg(s: TacticalArrow, samples = 32): ArrowPoint[] {
  const p1 = toSvg({ x: s.x1, y: s.y1 });
  const p2 = toSvg({ x: s.x2, y: s.y2 });
  if (s.type !== 'curve') return [p1, p2];
  const c = curveControlPoint(p1, p2);
  const out: ArrowPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    out.push({ x: mt * mt * p1.x + 2 * mt * t * c.x + t * t * p2.x, y: mt * mt * p1.y + 2 * mt * t * c.y + t * t * p2.y });
  }
  return out;
}

export function polylineLength(pts: ArrowPoint[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** Punto y dirección (unitaria) a la distancia `d` del inicio de la polilínea. */
export function pointAtLength(pts: ArrowPoint[], d: number): { p: ArrowPoint; dir: ArrowPoint } {
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    if (left <= seg || i === pts.length - 1) {
      const k = Math.min(1, left / seg);
      return { p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, dir: { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } };
    }
    left -= seg;
  }
  const last = pts[pts.length - 1] ?? { x: 0, y: 0 };
  return { p: last, dir: { x: 1, y: 0 } };
}

/** Onda de la conducción: sigue la línea central desplazándose a lo normal con
 *  un seno. Los últimos `tail` (unidades SVG) van rectos para que la punta de
 *  flecha se lea limpia. Amplitud y largo de onda fijos en unidades del
 *  viewBox: una conducción corta y una larga tienen la misma "letra". */
export function wavyPoints(center: ArrowPoint[], amplitude = 2.6, wavelength = 9, tail = 7): ArrowPoint[] {
  const total = polylineLength(center);
  if (total < 1) return center.slice();
  const waveLen = Math.max(0, total - tail);
  const step = wavelength / 8;
  const out: ArrowPoint[] = [];
  for (let d = 0; d <= waveLen; d += step) {
    const { p, dir } = pointAtLength(center, d);
    // Se apaga suave al llegar a la cola recta (sin quiebre).
    const fade = Math.min(1, (waveLen - d) / (wavelength / 2), d / (wavelength / 2));
    const off = Math.sin((d / wavelength) * Math.PI * 2) * amplitude * Math.max(0, fade);
    out.push({ x: p.x - dir.y * off, y: p.y + dir.x * off });
  }
  out.push(pointAtLength(center, total).p);
  return out;
}

/** Copia de la polilínea desplazada `d` a lo normal (disparo: dos líneas). */
export function offsetPolyline(pts: ArrowPoint[], d: number): ArrowPoint[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
  });
}

/** Recorta `cut` unidades del final (la doble línea del disparo termina donde
 *  arranca su punta, que es más ancha). */
export function trimPolylineEnd(pts: ArrowPoint[], cut: number): ArrowPoint[] {
  const total = polylineLength(pts);
  if (total <= cut + 0.5) return pts.slice();
  const keep = total - cut;
  const out: ArrowPoint[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= keep) {
      const k = seg === 0 ? 0 : (keep - acc) / seg;
      out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k });
      return out;
    }
    acc += seg;
    out.push(pts[i]);
  }
  return out;
}

export const polylineD = (pts: ArrowPoint[]) =>
  pts.length === 0 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round2(p.x)} ${round2(p.y)}`).join(' ');

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Todo lo necesario para dibujar una línea con estilo (en unidades SVG). */
export interface StyledLineGeometry {
  style: LineStyle;
  /** Trazos a dibujar (el disparo son dos). */
  paths: string[];
  dash?: string;
  width: number;
  /** Punta de flecha: triángulo en la punta, apuntando según `dir`. */
  head: { tip: ArrowPoint; dir: ArrowPoint; size: number };
  /** Trazo ancho invisible para tocarla (sigue la línea central). */
  hitPath: string;
}

export function styledLineGeometry(s: TacticalArrow, style: LineStyle): StyledLineGeometry {
  const center = lineCenterSvg(s);
  const total = polylineLength(center);
  const end = pointAtLength(center, total);
  const headSize = style === 'shot' ? 7.5 : 5.5;
  const hitPath = polylineD(center);
  const head = { tip: end.p, dir: end.dir, size: headSize };
  if (style === 'dribble') {
    return { style, paths: [polylineD(trimPolylineEnd(wavyPoints(center), headSize * 0.6))], width: 1.8, head, hitPath };
  }
  if (style === 'shot') {
    const body = trimPolylineEnd(center, headSize * 0.7);
    return { style, paths: [polylineD(offsetPolyline(body, 1.9)), polylineD(offsetPolyline(body, -1.9))], width: 1.6, head, hitPath };
  }
  const body = trimPolylineEnd(center, headSize * 0.6);
  return { style, paths: [polylineD(body)], dash: style === 'pass' ? '6 4' : undefined, width: style === 'run' ? 2.2 : 2, head, hitPath };
}

/** Triángulo de la punta: `tip` es la punta, base perpendicular a `dir`. */
export function arrowHeadPoints(tip: ArrowPoint, dir: ArrowPoint, size: number): string {
  const bx = tip.x - dir.x * size;
  const by = tip.y - dir.y * size;
  const nx = -dir.y * size * 0.55;
  const ny = dir.x * size * 0.55;
  return `${round2(tip.x)},${round2(tip.y)} ${round2(bx + nx)},${round2(by + ny)} ${round2(bx - nx)},${round2(by - ny)}`;
}

/** Línea central de un estilo en % de cancha (para el 3D: misma onda). */
export function styledLineCenterPct(s: TacticalArrow, style: LineStyle): ArrowPoint[] {
  const center = lineCenterSvg(s);
  const pts = style === 'dribble' ? wavyPoints(center) : center;
  return pts.map((p) => ({ x: p.x / 3, y: p.y / 3.4 }));
}

// ─── Zonas ──────────────────────────────────────────────────────────────────

export type ZoneForm = 'rect' | 'ellipse' | 'polygon';
export const ZONE_FORMS: ZoneForm[] = ['rect', 'ellipse', 'polygon'];
export const ZONE_FORM_LABEL: Record<ZoneForm, string> = { rect: 'Rectángulo', ellipse: 'Elipse', polygon: 'Polígono' };
/** Mismos topes que el BFF (footballShapes.ts). */
export const POLYGON_MIN_POINTS = 3;
export const POLYGON_MAX_POINTS = 24;
export const ZONE_FILL_MIN = 0.05;
export const ZONE_FILL_MAX = 0.6;
/** Relleno de siempre de una zona (0.14): translúcido, deja ver a los jugadores. */
export const ZONE_FILL_DEFAULT = 0.14;

export const zoneFormOf = (s: TacticalArrow): ZoneForm => (s.form === 'ellipse' || s.form === 'polygon' ? s.form : 'rect');

/** Centro de la zona en % de cancha (el del rectángulo que la encierra). */
export function zoneCenter(s: TacticalArrow): ArrowPoint {
  return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
}

/** Caja [x1,y1,x2,y2] de los vértices de un polígono, en %. */
export function polygonBox(points: number[]): { x1: number; y1: number; x2: number; y2: number } {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

/** Polígono cerrado → zona lista para guardar (o null con < 3 vértices). */
export function buildPolygonZone(vertices: ArrowPoint[], color: TacticalArrow['color']): TacticalArrow | null {
  if (vertices.length < POLYGON_MIN_POINTS) return null;
  const r = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;
  const pts = vertices.slice(0, POLYGON_MAX_POINTS).flatMap((p) => [r(p.x), r(p.y)]);
  return { type: 'zone', form: 'polygon', color, points: pts, ...polygonBox(pts) };
}

/** Punto dentro de polígono (par-impar), todo en la misma unidad. */
export function pointInPolygon(p: ArrowPoint, poly: ArrowPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Gira `p` alrededor de `c` en grados (espacio SVG: y hacia abajo = horario). */
export function rotateAround(p: ArrowPoint, c: ArrowPoint, deg: number): ArrowPoint {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** ¿El punto `p` (en % de cancha) cae dentro de la zona (o a `margin` % de su
 *  borde)? El giro se aplica en espacio SVG, que es como se ve. */
export function zoneContains(s: TacticalArrow, p: ArrowPoint, margin = 0): boolean {
  const form = zoneFormOf(s);
  if (form === 'polygon') {
    const poly = pairs(s.points).map(toSvg);
    if (poly.length < 3) return false;
    const q = toSvg(p);
    if (pointInPolygon(q, poly)) return true;
    if (margin <= 0) return false;
    const m = margin * 3;
    for (let i = 0; i < poly.length; i++) if (distSeg(q, poly[i], poly[(i + 1) % poly.length]) <= m) return true;
    return false;
  }
  const c = toSvg(zoneCenter(s));
  const q = rotateAround(toSvg(p), c, -(s.rot ?? 0));
  const hw = (Math.abs(s.x2 - s.x1) * 3) / 2 + margin * 3;
  const hh = (Math.abs(s.y2 - s.y1) * 3.4) / 2 + margin * 3.4;
  if (form === 'ellipse') {
    if (hw <= 0 || hh <= 0) return false;
    return ((q.x - c.x) / hw) ** 2 + ((q.y - c.y) / hh) ** 2 <= 1;
  }
  return Math.abs(q.x - c.x) <= hw && Math.abs(q.y - c.y) <= hh;
}

const pairs = (flat: number[] | undefined): ArrowPoint[] => {
  const out: ArrowPoint[] = [];
  if (!flat) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
};

function distSeg(p: ArrowPoint, a: ArrowPoint, b: ArrowPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** ¿El borde de la zona está a `r` (%) del punto? Así se toca una zona sin que
 *  su relleno le robe el toque a los jugadores que tiene encima. */
export function zoneBorderNear(s: TacticalArrow, p: ArrowPoint, r: number): boolean {
  if (zoneFormOf(s) === 'polygon') {
    const poly = pairs(s.points).map(toSvg);
    const q = toSvg(p);
    for (let i = 0; i < poly.length; i++) if (distSeg(q, poly[i], poly[(i + 1) % poly.length]) <= r * 3) return true;
    return false;
  }
  return zoneContains(s, p, r) && !zoneContains(s, p, -r);
}

/** Mueve una zona entera (también los vértices del polígono). */
export function moveZone(s: TacticalArrow, dx: number, dy: number): Partial<TacticalArrow> {
  // Que ningún vértice salga de la cancha: el desplazamiento se acota.
  const xs = s.form === 'polygon' ? (s.points ?? []).filter((_, i) => i % 2 === 0) : [s.x1, s.x2];
  const ys = s.form === 'polygon' ? (s.points ?? []).filter((_, i) => i % 2 === 1) : [s.y1, s.y2];
  const ddx = Math.min(100 - Math.max(...xs), Math.max(-Math.min(...xs), dx));
  const ddy = Math.min(100 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
  const r = (n: number) => Math.round(n * 100) / 100;
  const out: Partial<TacticalArrow> = { x1: r(s.x1 + ddx), y1: r(s.y1 + ddy), x2: r(s.x2 + ddx), y2: r(s.y2 + ddy) };
  if (s.form === 'polygon' && s.points) out.points = s.points.map((n, i) => r(n + (i % 2 === 0 ? ddx : ddy)));
  return out;
}

/** Mueve UN vértice del polígono y recalcula su caja. */
export function moveVertex(s: TacticalArrow, index: number, p: ArrowPoint): Partial<TacticalArrow> {
  const pts = (s.points ?? []).slice();
  const r = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;
  pts[index * 2] = r(p.x);
  pts[index * 2 + 1] = r(p.y);
  return { points: pts, ...polygonBox(pts) };
}

// ─── Foco (resaltar jugador) ────────────────────────────────────────────────

/** Radio del halo en unidades SVG a tamaño 1: un poco más que el disco del
 *  jugador (PIN_R 11 en el render estático, 22 px en la pizarra). */
export const SPOTLIGHT_R = 13.5;

/** Si el toque cae cerca de un jugador (en % de cancha), el foco se centra en
 *  él: resaltar es "este jugador", no "este pedazo de pasto". */
export function snapToNearest(p: ArrowPoint, targets: ArrowPoint[], radiusPct = 6): ArrowPoint {
  let best: ArrowPoint | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    // Distancia en espacio SVG (la cancha no es cuadrada).
    const d = Math.hypot((t.x - p.x) * 3, (t.y - p.y) * 3.4);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best && bestD <= radiusPct * 3.2 ? { x: best.x, y: best.y } : p;
}

// ─── Numeración de movimientos ──────────────────────────────────────────────

export const SEQ_MAX = 99;
export const isSequenceable = (s: TacticalArrow) => {
  const t = s.type ?? 'arrow';
  return t === 'arrow' || t === 'curve' || t === 'ball_path';
};

/** Próximo número libre: uno más que el mayor puesto (no rellena huecos: si el
 *  coach borró el 2, el siguiente igual es el 4 -- el orden lo decide él). */
export function nextSeq(shapes: TacticalArrow[]): number {
  const max = shapes.reduce((m, s) => (typeof s.seq === 'number' ? Math.max(m, s.seq) : m), 0);
  return Math.min(SEQ_MAX, max + 1);
}

/** Renumera 1..n en el orden en que se dibujaron las líneas numeradas. */
export function renumber(shapes: TacticalArrow[]): TacticalArrow[] {
  let n = 0;
  return shapes.map((s) => (typeof s.seq === 'number' ? { ...s, seq: Math.min(SEQ_MAX, ++n) } : s));
}

/** Dónde va el número: en la mitad del recorrido, corrido hacia afuera para
 *  no tapar la línea. En unidades SVG. */
export function seqAnchorSvg(s: TacticalArrow): ArrowPoint {
  const p1 = toSvg({ x: s.x1, y: s.y1 });
  const p2 = toSvg({ x: s.x2, y: s.y2 });
  let mid: ArrowPoint;
  if (s.type === 'curve' || (s.type === 'ball_path' && isLoftedPath(s))) {
    const c = curveControlPoint(p1, p2, s.type === 'curve' ? 0.18 : BALL_PATH_BEND);
    mid = { x: 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y };
  } else {
    mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  const off = 7;
  return { x: mid.x - ((p2.y - p1.y) / len) * off, y: mid.y + ((p2.x - p1.x) / len) * off };
}

// ─── ¿Qué figuras dibuja el render nuevo? ───────────────────────────────────

/** Las figuras que usan algún campo de M6d (las viejas siguen por el camino de
 *  siempre y salen idénticas). */
export function isM6dShape(s: TacticalArrow): boolean {
  if (s.type === 'spotlight') return true;
  if (s.line !== undefined && isLineStyle(s.line)) return true;
  if (s.type === 'zone' && (s.form !== undefined || s.rot !== undefined || s.fill !== undefined)) return true;
  return false;
}

/** Estilos de línea presentes en la jugada, en el orden de la leyenda. */
export function lineStylesIn(shapes: TacticalArrow[]): LineStyle[] {
  const used = new Set<LineStyle>();
  for (const s of shapes) if (isLineStyle(s.line)) used.add(s.line);
  return LINE_STYLES.filter((l) => used.has(l));
}

// ─── Opciones de la herramienta al crear ────────────────────────────────────

/** Lo que el panel de herramientas M6d fija para la próxima figura. */
export interface DrawOptions {
  /** null = la flecha/curva de siempre (sin estilo). */
  lineStyle: LineStyle | null;
  zoneForm: ZoneForm;
  autoNumber: boolean;
  /** Centros de los jugadores en cancha (% de cancha): el foco se pega a ellos. */
  snapTargets?: ArrowPoint[];
}
export const DEFAULT_DRAW_OPTIONS: DrawOptions = { lineStyle: null, zoneForm: 'rect', autoNumber: false };

/** Figura recién dibujada + opciones del panel → figura a guardar. Sin
 *  opciones (o con las de siempre) sale igual que antes de M6d. */
export function decorateNewShape(shape: TacticalArrow, opts: DrawOptions | undefined, existing: TacticalArrow[]): TacticalArrow {
  if (!opts) return shape;
  const out: TacticalArrow = { ...shape };
  const t = out.type ?? 'arrow';
  if ((t === 'arrow' || t === 'curve') && opts.lineStyle) out.line = opts.lineStyle;
  // Rectángulo nuevo con forma explícita: así se selecciona, gira y escala.
  // Las zonas viejas (sin `form`) siguen como siempre.
  if (t === 'zone' && opts.zoneForm !== 'polygon') out.form = opts.zoneForm;
  if (opts.autoNumber && isSequenceable(out)) out.seq = nextSeq(existing);
  return out;
}
