/**
 * Lógica pura del tablero táctico (sin React, sin red): emparejado de
 * jugadores con plantillas, posición de soltado con/sin zoom de arqueros y
 * armado de los slots de una plantilla. Vive aparte de TacticalBoard.tsx
 * para poder probarla en unidad -- un error acá no revienta nada a la vista:
 * mueve a un jugador a otra parte de la cancha o pierde posiciones de una
 * plantilla sin avisar.
 */
import { yFromView, yToView, type PitchView } from './tacticalGeometry';

/** Distancia (en % de cancha) dentro de la cual soltar un jugador "adopta"
 *  un marcador de plantilla en vez de crear una posición libre nueva. */
export const SNAP_DISTANCE = 8;

/** Máximo de titulares en cancha (fútbol 11). */
export const MAX_STARTERS = 11;

export interface PlacedSlot {
  x: number;
  y: number;
  slot_label: string;
  /** false = la etiqueta sigue siendo una sugerencia automática por altura y
   *  se recalcula si el coach mueve al jugador. true = el coach la escribió
   *  a mano y ya no se toca, se mueva a donde se mueva. */
  labelIsCustom: boolean;
  jersey_number: number | '';
}

/** Marcador de una plantilla cargada: posición sugerida SIN jugador todavía
 *  (D8 -- los presets guardan layout, no personas). */
export interface EmptySlot {
  id: string;
  slot_label: string;
  x: number;
  y: number;
}

/** Empareja cada punto de `from` con el más cercano de `to`, sin repetir
 *  ninguno de los dos lados -- una aproximación simple (no es el algoritmo
 *  húngaro/óptimo) pero alcanza para "qué jugador va a qué posición de la
 *  plantilla" sin pedirle al coach que lo arme a mano. */
export function greedyNearestMatch<A extends { x: number; y: number }, B extends { x: number; y: number }>(
  from: A[],
  to: B[],
): { from: A; to: B }[] {
  const pairs: { fi: number; ti: number; dist: number }[] = [];
  from.forEach((f, fi) => {
    to.forEach((t, ti) => {
      pairs.push({ fi, ti, dist: Math.hypot(f.x - t.x, f.y - t.y) });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);

  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();
  const matches: { from: A; to: B }[] = [];
  for (const p of pairs) {
    if (usedFrom.has(p.fi) || usedTo.has(p.ti)) continue;
    usedFrom.add(p.fi);
    usedTo.add(p.ti);
    matches.push({ from: from[p.fi], to: to[p.ti] });
  }
  return matches;
}

/** Caja de la cancha en pantalla (lo que devuelve getBoundingClientRect). */
export interface PitchRect { left: number; top: number; width: number; height: number }

/**
 * Centro (en px de pantalla) de un jugador YA puesto después de arrastrarlo
 * `delta` px. Con zoom al área (modo arqueros) el alto de la caja representa
 * solo la ventana visible (view.y0..view.y1), no la cancha entera: la posición
 * guardada hay que pasarla por `yToView` antes de convertirla a px. Sin esto
 * el pin saltaba ~10 puntos al reposicionarlo con zoom.
 */
export function repositionedCenterPx(
  placed: { x: number; y: number },
  pitchRect: PitchRect,
  delta: { x: number; y: number },
  view: PitchView,
): { x: number; y: number } {
  return {
    x: pitchRect.left + (placed.x / 100) * pitchRect.width + delta.x,
    y: pitchRect.top + (yToView(placed.y, view) / 100) * pitchRect.height + delta.y,
  };
}

/** Punto de pantalla → % de cancha completa (0-100), recortado a la cancha.
 *  `inside` dice si el punto cayó dentro de la caja visible. */
export function pitchPctFromPx(
  px: { x: number; y: number },
  pitchRect: PitchRect,
  view: PitchView,
): { x: number; y: number; inside: boolean } {
  const inside = px.x >= pitchRect.left && px.x <= pitchRect.left + pitchRect.width
    && px.y >= pitchRect.top && px.y <= pitchRect.top + pitchRect.height;
  const x = Math.min(100, Math.max(0, ((px.x - pitchRect.left) / pitchRect.width) * 100));
  const y = Math.min(100, Math.max(0, yFromView(((px.y - pitchRect.top) / pitchRect.height) * 100, view)));
  return { x, y, inside };
}

/**
 * Slots que se guardan en una plantilla: los jugadores puestos Y los
 * marcadores que todavía no adoptó nadie. Una plantilla es layout (D8): un
 * marcador sin jugador sigue siendo una posición de la formación. Antes solo
 * se guardaba `placed` y una plantilla de 11 posiciones cargada con 3
 * jugadores puestos se "actualizaba" a 3 sin avisar.
 */
export function buildPresetSlots(
  placed: Record<string, PlacedSlot>,
  emptySlots: EmptySlot[],
): { slot_label: string; x: number; y: number }[] {
  return [
    ...Object.values(placed).map((s) => ({ slot_label: s.slot_label, x: s.x, y: s.y })),
    ...emptySlots.map((s) => ({ slot_label: s.slot_label, x: s.x, y: s.y })),
  ];
}

/**
 * Resultado de aplicar una plantilla sobre lo que ya hay en cancha: los
 * jugadores puestos se reubican en el slot más cercano (sin repetir) y los
 * slots que quedaron sin jugador pasan a ser marcadores de referencia.
 */
export function applyPresetSlots(
  placed: Record<string, PlacedSlot>,
  presetId: string,
  presetSlots: { slot_label: string; x: number | string; y: number | string }[],
): { placed: Record<string, PlacedSlot>; emptySlots: EmptySlot[] } {
  const slots = presetSlots.map((s) => ({ slot_label: s.slot_label, x: Number(s.x), y: Number(s.y) }));
  const entries = Object.entries(placed).map(([key, slot]) => ({ key, x: slot.x, y: slot.y }));
  const toMarker = (s: { slot_label: string; x: number; y: number }, i: number): EmptySlot => (
    { id: `${presetId}:${i}`, slot_label: s.slot_label, x: s.x, y: s.y }
  );

  if (entries.length === 0 || slots.length === 0) {
    return { placed, emptySlots: slots.map(toMarker) };
  }

  const matches = greedyNearestMatch(entries, slots);
  const matched = new Set(matches.map((m) => m.to));
  const next = { ...placed };
  for (const m of matches) {
    const existing = next[m.from.key];
    next[m.from.key] = {
      x: m.to.x, y: m.to.y,
      slot_label: m.to.slot_label,
      labelIsCustom: false,
      jersey_number: existing?.jersey_number ?? '',
    };
  }
  return { placed: next, emptySlots: slots.filter((s) => !matched.has(s)).map(toMarker) };
}

/** Marcador más cercano a (x, y) dentro de `snap`, o null. */
export function nearestEmptySlot(emptySlots: EmptySlot[], x: number, y: number, snap = SNAP_DISTANCE): EmptySlot | null {
  let closest: EmptySlot | null = null;
  let closestDist = snap;
  for (const es of emptySlots) {
    const dist = Math.hypot(es.x - x, es.y - y);
    if (dist < closestDist) { closest = es; closestDist = dist; }
  }
  return closest;
}

/**
 * Separa a los jugadores de una alineación guardada entre los que todavía
 * existen en el roster y los que no (dados de baja, cambiados de equipo).
 * Los que ya no existen no se pueden guardar -- antes `subjectByKey.get(k)!`
 * reventaba el guardado entero -- y no deben contar para el máximo de 11.
 */
export function splitKnownKeys<T>(keys: string[], known: Map<string, T>): { valid: string[]; missing: string[] } {
  const valid: string[] = [];
  const missing: string[] = [];
  for (const k of keys) (known.has(k) ? valid : missing).push(k);
  return { valid, missing };
}
