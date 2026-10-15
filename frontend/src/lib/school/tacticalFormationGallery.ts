/**
 * Galería de formaciones de la pizarra (M6a de docs/specs/pizarra-m6-paridad-tacticalpad.md).
 *
 * Lógica pura, sin React (src/test/tacticalFormationGallery.test.ts):
 *  - el RIVAL en espejo: la formación se gira 180° alrededor del centro del
 *    tablero (todas las canchas están centradas en el viewBox), así el arquero
 *    rival queda en el arco de arriba y su «izquierda» en nuestra derecha;
 *  - el rival se representa como hoy en la pizarra: figuras `opponent` (un
 *    punto, x2/y2 = x1/y1) dentro de las figuras de la jugada. M6b le pone la
 *    configuración del equipo encima de esa misma representación;
 *  - familias (grupos) y filtros de la galería.
 *
 * El catálogo NO vive acá: fútbol 11 en tacticalFormations.ts, el resto en
 * tacticalSports.ts. Esto solo lo consulta.
 */
import type { TacticalArrow } from './footballQueries';

export interface GalleryFormation {
  key: string;
  label: string;
  players: number;
  slots: { x: number; y: number; label: string }[];
  /** Familia en la galería: «Clásicas», «Zonas», «Rotaciones 5-1»… */
  group?: string;
  /** Una línea: qué es y cuándo se usa. */
  description?: string;
}

/** Familia por defecto de una formación sin `group` (formaciones viejas o de
 *  un catálogo que todavía no las agrupa). */
export const DEFAULT_GROUP = 'Formaciones';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Punto en espejo (giro de 180° alrededor del centro del tablero). */
export const mirrorPoint = (p: { x: number; y: number }) => ({ x: round1(100 - p.x), y: round1(100 - p.y) });

/** Figuras `opponent` del rival en espejo, en el orden de la formación. */
export function rivalShapesFor(formation: Pick<GalleryFormation, 'slots'>): TacticalArrow[] {
  return formation.slots.map((s) => {
    const p = mirrorPoint(s);
    return { type: 'opponent', x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: 'red' };
  });
}

export const isRivalShape = (a: TacticalArrow) => a.type === 'opponent';

/** Cuántos rivales hay en la cancha. */
export const countRivals = (shapes: TacticalArrow[]) => shapes.filter(isRivalShape).length;

/**
 * Pone al rival en una formación: saca los rivales que ya estaban (si no, al
 * cambiar de formación quedarían dos equipos rivales) y agrega los nuevos al
 * final. El resto de las figuras (flechas, material, texto) no se toca.
 */
export function replaceRivalShapes(shapes: TacticalArrow[], formation: Pick<GalleryFormation, 'slots'>): TacticalArrow[] {
  return [...shapes.filter((a) => !isRivalShape(a)), ...rivalShapesFor(formation)];
}

/** Quita a todos los rivales. */
export const removeRivalShapes = (shapes: TacticalArrow[]) => shapes.filter((a) => !isRivalShape(a));

/** Orden de las familias en la galería; las que no están aquí van al final,
 *  en el orden del catálogo. */
export const GROUP_ORDER = [
  'Básicas', 'Clásicas', 'Modernas', 'Rotaciones 5-1', 'Rotaciones 4-2', 'Rotaciones 6-2',
  'Defensas', 'Zonas', 'Presiones', 'Defensivas', 'Ofensivas', 'Especiales', 'Históricas', 'Fútbol 7',
];

/** Familias presentes, en el orden de GROUP_ORDER. */
export function formationGroups(formations: GalleryFormation[]): string[] {
  const out: string[] = [];
  for (const f of formations) {
    const g = f.group ?? DEFAULT_GROUP;
    if (!out.includes(g)) out.push(g);
  }
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i < 0 ? GROUP_ORDER.length : i;
  };
  return out
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i)
    .map((x) => x.g);
}

/** Cantidades de jugadores distintas (fútbol 11 trae también la de F7). */
export const playerCounts = (formations: GalleryFormation[]) =>
  [...new Set(formations.map((f) => f.players))].sort((a, b) => b - a);

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface GalleryFilter {
  query?: string;
  group?: string | null;
  players?: number | null;
}

/** Filtro de la galería: texto (nombre, familia, descripción o posición; sin
 *  tildes ni mayúsculas, y «433» encuentra «4-3-3»), familia y jugadores. */
export function filterFormations<T extends GalleryFormation>(formations: T[], filter: GalleryFilter): T[] {
  const q = normalize(filter.query ?? '').trim();
  const qDigits = q.replace(/[^0-9]/g, '');
  return formations.filter((f) => {
    if (filter.group && (f.group ?? DEFAULT_GROUP) !== filter.group) return false;
    if (filter.players && f.players !== filter.players) return false;
    if (!q) return true;
    const hay = normalize([f.label, f.group ?? '', f.description ?? '', ...f.slots.map((s) => s.label)].join(' '));
    if (hay.includes(q)) return true;
    // «433» o «4 3 3» → «4-3-3»: solo si lo escrito son cifras.
    return qDigits.length >= 2 && qDigits === q.replace(/[\s-]/g, '') && f.label.replace(/[^0-9]/g, '').includes(qDigits);
  });
}
