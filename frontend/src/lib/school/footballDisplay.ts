/**
 * Football Module — constantes de UI (posiciones, tipos de evento).
 * Misma separación que performanceDisplay.ts (BAND_STYLE) respecto de
 * footballQueries.ts (tipos + llamadas al BFF).
 */
import type { PositionCode, FootballEventType } from './footballQueries';

export const POSITION_LABEL: Record<PositionCode, string> = {
  arquero: 'Arquero',
  defensa: 'Defensa',
  medio: 'Medio',
  delantero: 'Delantero',
};

export const POSITION_ORDER: PositionCode[] = ['arquero', 'defensa', 'medio', 'delantero'];

export const EVENT_CONFIG: Record<FootballEventType, { label: string; shortLabel: string; color: string }> = {
  goal:     { label: 'Gol',        shortLabel: 'G',  color: 'text-green-600 border-green-500/30 bg-green-500/5' },
  own_goal: { label: 'Autogol',    shortLabel: 'AG', color: 'text-red-600 border-red-500/30 bg-red-500/5' },
  assist:   { label: 'Asistencia', shortLabel: 'A',  color: 'text-blue-600 border-blue-500/30 bg-blue-500/5' },
  yellow:   { label: 'Amarilla',   shortLabel: 'TA', color: 'text-yellow-600 border-yellow-500/30 bg-yellow-500/5' },
  red:      { label: 'Roja',       shortLabel: 'TR', color: 'text-red-700 border-red-600/30 bg-red-600/5' },
};
