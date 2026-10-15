/**
 * M6d — diálogo «Campo» (docs/specs/pizarra-m6-paridad-tacticalpad.md §4):
 * plantillas de líneas, cámara (ventana visible), orientación, piso y colores.
 *
 * Dónde se guarda: en UNA pseudo-figura `{ type: 'court', court: {...} }` dentro
 * del jsonb `arrows` de la jugada (y de cada cuadro). Así viaja sola por todo lo
 * que ya guarda y exporta figuras -- alineación, Mis jugadas, biblioteca,
 * cuadros, PNG/PDF/GIF/video, 3D -- sin columna nueva ni migración. No se dibuja
 * como figura: cada capa la salta (`drawableShapes`). Configuración por defecto
 * = sin pseudo-figura, así una jugada vieja queda byte a byte igual.
 *
 * Coordenadas: las guardadas SIEMPRE son de cancha completa vertical (0-100);
 * la cámara y la orientación solo cambian qué parte se mira y cómo se gira.
 */
import type { TacticalArrow, TacticalCourtConfig } from './footballQueries';
import { FULL_VIEW, GK_VIEW, type PitchView } from './tacticalGeometry';

export type CourtConfig = TacticalCourtConfig;
export type CourtCamera = NonNullable<CourtConfig['cam']>;
export type CourtSurface = NonNullable<CourtConfig['surface']>;

// ─── Pseudo-figura ──────────────────────────────────────────────────────────

export const courtShapeOf = (arrows: TacticalArrow[] | null | undefined): TacticalArrow | undefined =>
  (arrows ?? []).find((a) => a?.type === 'court');

export const courtOf = (arrows: TacticalArrow[] | null | undefined): CourtConfig => ({ ...(courtShapeOf(arrows)?.court ?? {}) });

/** Las figuras que SÍ se dibujan (sin la configuración de cancha). */
export const drawableShapes = (arrows: TacticalArrow[] | null | undefined): TacticalArrow[] =>
  (arrows ?? []).filter((a) => a?.type !== 'court');

/** Deja solo los campos con valor distinto del de siempre. */
export function normalizeCourt(c: CourtConfig): CourtConfig {
  const out: CourtConfig = {};
  if (c.tpl && isTemplateId(c.tpl)) out.tpl = c.tpl;
  if (c.goals === false) out.goals = false;
  if (c.cam && c.cam !== 'full') out.cam = c.cam;
  if (c.orient === 'h') out.orient = 'h';
  if (c.surface) out.surface = c.surface;
  if (c.grass) out.grass = c.grass;
  if (c.lines) out.lines = c.lines;
  if (c.outline) out.outline = c.outline;
  return out;
}
export const isDefaultCourt = (c: CourtConfig) => Object.keys(normalizeCourt(c)).length === 0;

/** Pone (o reemplaza, o quita si es la de siempre) la configuración en la
 *  lista. Reemplaza EN SU LUGAR: no corre los índices de las demás figuras. */
export function withCourt(arrows: TacticalArrow[], cfg: CourtConfig): TacticalArrow[] {
  const c = normalizeCourt(cfg);
  const idx = arrows.findIndex((a) => a?.type === 'court');
  if (isDefaultCourt(c)) return idx < 0 ? arrows : arrows.filter((_, i) => i !== idx);
  const shape: TacticalArrow = { type: 'court', x1: 0, y1: 0, x2: 0, y2: 0, court: c };
  if (idx < 0) return [...arrows, shape];
  return arrows.map((a, i) => (i === idx ? shape : a));
}

/** «Borrar todo» quita los dibujos, no el campo elegido. */
export const keepCourtOnly = (arrows: TacticalArrow[]): TacticalArrow[] => arrows.filter((a) => a?.type === 'court');

// ─── Plantillas de líneas ───────────────────────────────────────────────────

/** `overlay`: líneas encima de la cancha del deporte. `replace`: lienzo de
 *  ejercicio (se ocultan las líneas reglamentarias; «Incluyendo porterías»
 *  agrega un arco arriba y otro abajo). */
export type TemplateFamily = 'overlay' | 'replace';
export interface CourtTemplate {
  id: string;
  label: string;
  family: TemplateFamily;
  /** Solo en canchas de fútbol (carriles, half-spaces, juego de posición: la
   *  geometría sale del área grande y el área chica). */
  footballOnly?: boolean;
}

export const COURT_TEMPLATES: CourtTemplate[] = [
  { id: 'lanes5', label: '5 carriles', family: 'overlay', footballOnly: true },
  { id: 'thirds', label: '3 tercios', family: 'overlay' },
  { id: 'lanes_thirds', label: 'Carriles + tercios', family: 'overlay', footballOnly: true },
  { id: 'half_spaces', label: 'Half-spaces', family: 'overlay', footballOnly: true },
  { id: 'positional', label: 'Juego de posición (20 zonas)', family: 'overlay', footballOnly: true },
  { id: 'big_area', label: 'Área grande + líneas', family: 'overlay', footballOnly: true },
  { id: 'diagonals', label: 'Diagonales', family: 'overlay' },
  { id: 'grid2x2', label: 'Cuadrícula 2×2', family: 'replace' },
  { id: 'grid3x3', label: 'Cuadrícula 3×3', family: 'replace' },
  { id: 'grid4x3', label: 'Cuadrícula 4×3', family: 'replace' },
  { id: 'no_lines', label: 'Sin líneas', family: 'replace' },
  { id: 'rondo_circle', label: 'Rondo · círculo', family: 'replace' },
  { id: 'rondo_triangle', label: 'Rondo · triángulo', family: 'replace' },
  { id: 'rondo_hexagon', label: 'Rondo · hexágono', family: 'replace' },
  { id: 'rondo_square', label: 'Rondo · cuadrado', family: 'replace' },
];
const TEMPLATE_BY_ID = new Map(COURT_TEMPLATES.map((t) => [t.id, t]));
export const isTemplateId = (id: unknown): id is string => typeof id === 'string' && TEMPLATE_BY_ID.has(id);
export const templateOf = (id: string | undefined): CourtTemplate | undefined => (id ? TEMPLATE_BY_ID.get(id) : undefined);

/** Deportes de cancha de fútbol (donde carriles y half-spaces tienen sentido). */
const FOOTBALL_FAMILY = new Set(['futbol', 'futbol7', 'futbol5', 'futsal']);
export const isFootballFamily = (sport: string | null | undefined) => FOOTBALL_FAMILY.has(sport ?? 'futbol');

export const templatesFor = (sport: string | null | undefined) =>
  COURT_TEMPLATES.filter((t) => !t.footballOnly || isFootballFamily(sport));

/** ¿Hay que ocultar las líneas reglamentarias? */
export const hidesCourtLines = (c: CourtConfig) => templateOf(c.tpl)?.family === 'replace';

// ─── Cámara (ventana visible) ───────────────────────────────────────────────

export const CAMERA_LABEL: Record<CourtCamera, string> = {
  full: 'Cancha completa',
  half_bottom: 'Media cancha · arco abajo',
  half_top: 'Media cancha · arco arriba',
  three_quarters: '3/4 de cancha',
  area: 'Área (arqueros)',
};
export const CAMERAS: CourtCamera[] = ['full', 'half_bottom', 'half_top', 'three_quarters', 'area'];

/** Ventanas verticales. Las medias canchas dejan ver un poco del otro lado de
 *  la línea central (se lee dónde queda el medio). El área es la GK_VIEW de
 *  siempre (zoom de arqueros), ahora una opción más del selector. */
export const CAMERA_VIEW: Record<CourtCamera, PitchView> = {
  full: FULL_VIEW,
  half_bottom: { y0: 46, y1: 100 },
  half_top: { y0: 0, y1: 54 },
  three_quarters: { y0: 28, y1: 100 },
  area: GK_VIEW,
};

export function viewForCourt(c: CourtConfig, allowArea = true): PitchView {
  const cam = c.cam ?? 'full';
  if (cam === 'area' && !allowArea) return FULL_VIEW;
  return CAMERA_VIEW[cam] ?? FULL_VIEW;
}

export const camerasFor = (allowArea: boolean) => CAMERAS.filter((c) => c !== 'area' || allowArea);

// ─── Orientación (solo render estático y exportaciones) ─────────────────────

/** viewBox del render estático: ventana de la cámara, y en horizontal la
 *  cancha girada (el arco rival, arriba en la pizarra, queda a la DERECHA). */
export function staticViewBox(c: CourtConfig, allowArea = true): { x: number; y: number; w: number; h: number } {
  const v = viewForCourt(c, allowArea);
  const y0 = v.y0 * 3.4;
  const h = (v.y1 - v.y0) * 3.4;
  if (c.orient === 'h') return { x: 340 - (y0 + h), y: 0, w: h, h: 300 };
  return { x: 0, y: y0, w: 300, h };
}

/** Transformación SVG que gira el dibujo vertical (300×340) a horizontal
 *  (340×300): (u, v) → (340 − v, u). */
export const H_MATRIX = 'matrix(0 1 -1 0 340 0)';

/** Punto del tablero vertical (unidades SVG) → punto del lienzo según la
 *  orientación (sin restar el origen del viewBox). */
export function mapBoardPoint(c: CourtConfig, u: number, v: number): { x: number; y: number } {
  return c.orient === 'h' ? { x: 340 - v, y: u } : { x: u, y: v };
}

// ─── Piso y colores ─────────────────────────────────────────────────────────

export const SURFACE_LABEL: Record<CourtSurface, string> = {
  grass_stripes: 'Césped a rayas',
  grass: 'Césped liso',
  synthetic: 'Sintética',
  wood: 'Piso de madera',
  blue: 'Piso azul (indoor)',
  whiteboard: 'Pizarra blanca (imprimir)',
};
export const SURFACES: CourtSurface[] = ['grass_stripes', 'grass', 'synthetic', 'wood', 'blue', 'whiteboard'];

export type CourtTexture = 'grass' | 'wood' | 'turf' | 'none';
interface SurfaceDef { court: string; surround: string; line?: string; accent?: string; texture: CourtTexture; vignette: boolean }
export const SURFACE_DEF: Record<CourtSurface, SurfaceDef> = {
  grass_stripes: { court: '#2c8c45', surround: '#1d6b34', texture: 'grass', vignette: true },
  grass: { court: '#2f8f47', surround: '#24733a', texture: 'none', vignette: true },
  synthetic: { court: '#1f9e6d', surround: '#147352', texture: 'turf', vignette: true },
  wood: { court: '#d6a66e', surround: '#9a6a3a', line: '#1e293b', accent: '#c0874f', texture: 'wood', vignette: false },
  blue: { court: '#1f5fa8', surround: '#0f2f57', line: '#ffffff', accent: '#2f76c4', texture: 'none', vignette: false },
  whiteboard: { court: '#ffffff', surround: '#f1f5f9', line: '#334155', accent: '#e2e8f0', texture: 'none', vignette: false },
};

/** Paletas del diálogo (colores pensados para que las figuras se sigan leyendo). */
export const GRASS_COLORS = ['#2c8c45', '#1f6f3a', '#3fa35a', '#1f9e6d', '#5b7f3a', '#1f5fa8', '#d6a66e', '#ffffff'];
export const LINE_COLORS = ['#ffffff', '#f8fafc', '#fde047', '#334155', '#111827', '#f97316'];
export const OUTLINE_COLORS = ['#ffffff', '#111827', '#fde047', '#ef4444', '#38bdf8'];

export interface BaseCourtColors { court: string; surround: string; line: string; accent?: string }
export interface CourtLook {
  court: string;
  surround: string;
  line: string;
  accent?: string;
  /** undefined = la textura propia del deporte. */
  texture?: CourtTexture;
  vignette: boolean;
  outline?: string;
  hideLines: boolean;
}

/** Oscurece un #rrggbb (para el contorno exterior del césped elegido). */
export function darken(hex: string, k = 0.22): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k)).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Colores efectivos de la cancha: los del deporte, pisados por el piso
 *  elegido y luego por los colores sueltos. */
export function resolveCourtLook(base: BaseCourtColors, c: CourtConfig): CourtLook {
  const s = c.surface ? SURFACE_DEF[c.surface] : null;
  const court = c.grass ?? s?.court ?? base.court;
  return {
    court,
    surround: c.grass ? darken(c.grass) : s?.surround ?? base.surround,
    line: c.lines ?? s?.line ?? base.line,
    accent: s?.accent ?? base.accent,
    texture: s?.texture,
    vignette: s ? s.vignette : true,
    outline: c.outline,
    hideLines: hidesCourtLines(c),
  };
}

/** ¿La configuración cambia el DIBUJO de la cancha (no solo la cámara)? */
export const changesCourtLook = (c: CourtConfig) =>
  !!(c.surface || c.grass || c.lines || c.outline || hidesCourtLines(c));

/** Pizarra blanca: lo dibujado en blanco (el color por defecto) no se vería
 *  sobre el blanco; se pinta en negro. El material conserva su color natural
 *  y el foco su amarillo. Solo cambia el DIBUJO, no lo guardado. */
export function inkForSurface(c: CourtConfig, arrows: TacticalArrow[]): TacticalArrow[] {
  if (c.surface !== 'whiteboard') return arrows;
  return arrows.map((a) => {
    const t = a.type ?? 'arrow';
    const ink = t === 'arrow' || t === 'curve' || t === 'zone' || t === 'ball_path' || t === 'freehand' || t === 'text';
    return ink && (!a.color || a.color === 'white') ? { ...a, color: 'black' } : a;
  });
}
