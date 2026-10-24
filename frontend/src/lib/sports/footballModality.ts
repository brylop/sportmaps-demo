/**
 * Modalidad de fútbol del equipo (teams.sport_modality: '11' | '7' | '5').
 * Solo aplica cuando el deporte del equipo es «Fútbol»; para cualquier otro
 * deporte se guarda NULL. NULL = no declarada: la pizarra la deduce del nombre
 * del equipo ("F7", "Fútbol 5"…), como antes de esta columna.
 */
import { resolveSport } from './sportCatalog';

export type FootballModality = '11' | '7' | '5';

export const FOOTBALL_MODALITIES: readonly { value: FootballModality; label: string }[] = [
  { value: '11', label: 'Fútbol 11' },
  { value: '7', label: 'Fútbol 7' },
  { value: '5', label: 'Fútbol 5' },
];

export const isFootballModality = (v: unknown): v is FootballModality => v === '11' || v === '7' || v === '5';

/** ¿El deporte escrito es «Fútbol» a secas (no futsal, americano, etc.)? */
export const sportAllowsModality = (sport: string | null | undefined): boolean =>
  resolveSport(sport).key === 'futbol';

/** Lo que se guarda en teams.sport_modality: NULL si el deporte no es fútbol. */
export function modalityToSave(sport: string | null | undefined, modality: string | null | undefined): FootballModality | null {
  return sportAllowsModality(sport) && isFootballModality(modality) ? modality : null;
}
