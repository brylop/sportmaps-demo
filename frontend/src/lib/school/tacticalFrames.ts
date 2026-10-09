/**
 * Formato de jugada animada por cuadros (spec docs/specs/pizarra-nivel-tacticalpad.md §4).
 *
 * Una jugada es una lista de cuadros. Cada uno guarda dónde está cada jugador,
 * el balón y las figuras en ese momento. Entre cuadro y cuadro se interpola.
 * Sin `frames` la jugada es un solo cuadro armado con las columnas de siempre
 * (`match_lineup_players` + `arrows`): así las jugadas viejas siguen abriendo.
 */
import type { TacticalArrow } from './footballQueries';

/** `subject_type:subject_id`, o el `slot_label` si la jugada no tiene jugador asignado. */
export type TacticalPlayerKey = string;

export interface TacticalFramePlayer {
  key: TacticalPlayerKey;
  x: number; // 0-100, cancha completa
  y: number; // 0-100, cancha completa
}

export interface TacticalFrame {
  id: string;
  /** Lo que tarda en llegar a este cuadro desde el anterior. */
  duration_ms: number;
  players: TacticalFramePlayer[];
  ball: { x: number; y: number } | null;
  arrows: TacticalArrow[];
}

export const MAX_FRAMES = 30;
export const DEFAULT_FRAME_MS = 1200;
export const MIN_FRAME_MS = 200;
export const MAX_FRAME_MS = 10000;

export function playerKey(p: { subject_type?: string | null; subject_id?: string | null; slot_label?: string | null }): TacticalPlayerKey {
  return p.subject_type && p.subject_id ? `${p.subject_type}:${p.subject_id}` : `slot:${p.slot_label ?? ''}`;
}

/** Duraciones rápidas del selector de la línea de tiempo (0,5 s – 5 s). */
export const FRAME_DURATION_CHOICES_MS = [500, 1000, 1500, 2000, 3000, 5000] as const;

/** Tope de jugadores por cuadro (dos equipos de 11 + banca de sobra). Igual
 *  que MAX_FRAME_PLAYERS del BFF (footballShapes.ts). */
export const MAX_FRAME_PLAYERS = 60;

/**
 * Clave de un jugador dentro de los cuadros de una jugada de «Mis jugadas»:
 * una plantilla guarda posiciones, no personas, y varias posiciones comparten
 * etiqueta («Central», «Medio»), así que la clave es el ÍNDICE del slot en
 * `team_tactical_presets.slots` (cuadro 1), no el slot_label.
 */
export function presetSlotKey(index: number): TacticalPlayerKey {
  return `slot#${index}`;
}

/** Índice del slot de una clave de plantilla, o null si no es una. */
export function presetSlotIndex(key: TacticalPlayerKey): number | null {
  const m = /^slot#(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}
