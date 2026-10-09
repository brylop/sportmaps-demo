/**
 * Formaciones fijas de la pizarra táctica (F2 de
 * docs/specs/rediseno-seguimiento-deportivo.md): la cancha arranca llena sin
 * depender de estadísticas de partidos. Coordenadas 0-100 de cancha COMPLETA,
 * arco propio abajo (y alto = defensa, y bajo = ataque), la misma convención
 * de generateFormation442() y de suggestLabel().
 *
 * Lógica pura, sin React: se puede probar en unidad.
 */
import type { PlacedSlot } from './tacticalBoardLogic';

export type FormationKey = '4-3-3' | '4-4-2' | '3-5-2' | 'f7-2-3-1';

export interface FormationSlot { x: number; y: number; label: string }

export interface Formation {
  key: FormationKey;
  /** Lo que se ve en el menú y en el botón: "4-3-3", "2-3-1 (F7)". */
  label: string;
  /** Jugadores en cancha, arquero incluido (11 o 7). */
  players: number;
  slots: FormationSlot[];
}

// Alturas de las líneas: dentro de las franjas de suggestLabel (Arquero ≥78,
// Defensa 48-78, Medio 22-48, Delantero <22) para que, si el coach mueve a un
// jugador, la etiqueta sugerida no salte a otra línea sin motivo.
const GK_Y = 92;
const DEF_Y = 70;
const MID_Y = 45;
const FWD_Y = 18;

export const FORMATIONS: Formation[] = [
  {
    key: '4-3-3',
    label: '4-3-3',
    players: 11,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 14, y: DEF_Y - 2, label: 'Lateral izq.' },
      { x: 37, y: DEF_Y + 2, label: 'Central' },
      { x: 63, y: DEF_Y + 2, label: 'Central' },
      { x: 86, y: DEF_Y - 2, label: 'Lateral der.' },
      { x: 28, y: MID_Y, label: 'Medio' },
      { x: 50, y: MID_Y + 2, label: 'Volante' },
      { x: 72, y: MID_Y, label: 'Medio' },
      { x: 18, y: FWD_Y + 3, label: 'Extremo izq.' },
      { x: 50, y: FWD_Y, label: 'Delantero' },
      { x: 82, y: FWD_Y + 3, label: 'Extremo der.' },
    ],
  },
  {
    key: '4-4-2',
    label: '4-4-2',
    players: 11,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 14, y: DEF_Y - 2, label: 'Lateral izq.' },
      { x: 37, y: DEF_Y + 2, label: 'Central' },
      { x: 63, y: DEF_Y + 2, label: 'Central' },
      { x: 86, y: DEF_Y - 2, label: 'Lateral der.' },
      { x: 14, y: MID_Y - 2, label: 'Volante izq.' },
      { x: 38, y: MID_Y + 2, label: 'Medio' },
      { x: 62, y: MID_Y + 2, label: 'Medio' },
      { x: 86, y: MID_Y - 2, label: 'Volante der.' },
      { x: 36, y: FWD_Y, label: 'Delantero' },
      { x: 64, y: FWD_Y, label: 'Delantero' },
    ],
  },
  {
    key: '3-5-2',
    label: '3-5-2',
    players: 11,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 26, y: DEF_Y, label: 'Central' },
      { x: 50, y: DEF_Y + 3, label: 'Central' },
      { x: 74, y: DEF_Y, label: 'Central' },
      { x: 10, y: MID_Y - 3, label: 'Carrilero izq.' },
      { x: 31, y: MID_Y, label: 'Medio' },
      { x: 50, y: MID_Y + 2, label: 'Volante' },
      { x: 69, y: MID_Y, label: 'Medio' },
      { x: 90, y: MID_Y - 3, label: 'Carrilero der.' },
      { x: 36, y: FWD_Y, label: 'Delantero' },
      { x: 64, y: FWD_Y, label: 'Delantero' },
    ],
  },
  {
    key: 'f7-2-3-1',
    label: '2-3-1 (F7)',
    players: 7,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 32, y: DEF_Y, label: 'Defensa' },
      { x: 68, y: DEF_Y, label: 'Defensa' },
      { x: 16, y: MID_Y, label: 'Volante izq.' },
      { x: 50, y: MID_Y + 2, label: 'Medio' },
      { x: 84, y: MID_Y, label: 'Volante der.' },
      { x: 50, y: FWD_Y, label: 'Delantero' },
    ],
  },
];

export function formationByKey(key: FormationKey): Formation {
  return FORMATIONS.find((f) => f.key === key) ?? FORMATIONS[0];
}

/** Formación con la que arranca una cancha vacía: 4-3-3 si el roster alcanza
 *  para fútbol 11; si no, la de fútbol 7 (un equipo de 8-10 niños casi
 *  siempre juega F7, y un 4-3-3 con 3 huecos se ve roto). */
export function defaultFormationFor(rosterSize: number): Formation {
  return formationByKey(rosterSize >= 11 ? '4-3-3' : 'f7-2-3-1');
}

/**
 * Ubica jugadores en una formación sobre la cancha VACÍA. `keys` ya viene en
 * el orden en que se reparten (el primero va al arco). Sobran slots → quedan
 * en `emptySlots` (marcadores a los que se arrastra a alguien); sobran
 * jugadores → no se ubican (quedan disponibles en el panel Jugadores).
 */
export function placeInFormation(
  keys: string[],
  formation: Formation,
): { placed: Record<string, PlacedSlot>; emptySlots: { id: string; slot_label: string; x: number; y: number }[] } {
  const placed: Record<string, PlacedSlot> = {};
  formation.slots.forEach((slot, i) => {
    const key = keys[i];
    if (!key) return;
    placed[key] = { x: slot.x, y: slot.y, slot_label: slot.label, labelIsCustom: false, jersey_number: '' };
  });
  const emptySlots = formation.slots
    .map((s, i) => ({ id: `formation:${formation.key}:${i}`, slot_label: s.label, x: s.x, y: s.y }))
    .slice(keys.length);
  return { placed, emptySlots };
}

/** Orden en que se reparte el roster: por nombre (el roster no trae dorsal),
 *  con collator en español para que tildes y ñ ordenen como se espera. */
export function sortRosterForFormation<T extends { full_name: string }>(subjects: T[]): T[] {
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return [...subjects].sort((a, b) => collator.compare(a.full_name, b.full_name));
}

/** Slots de la formación en el formato de applyPresetSlots (reubicar a los
 *  que ya están en cancha en el slot más cercano). */
export function formationAsPresetSlots(formation: Formation): { slot_label: string; x: number; y: number }[] {
  return formation.slots.map((s) => ({ slot_label: s.label, x: s.x, y: s.y }));
}
