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

/** Etiqueta sugerida por altura (0-100, 0 = arco rival) en la cancha libre
 *  (x/y) que comparten TacticalBoard y LineupModal. Mismos cortes que
 *  ZONE_BANDS en TacticalBoard.tsx -- si se cambian ahí, cambiar acá. */
export function suggestLabel(y: number): string {
  if (y < 22) return 'Delantero';
  if (y < 48) return 'Medio';
  if (y < 78) return 'Defensa';
  return 'Arquero';
}

/** Y por defecto de cada position_code clásico -- para ubicar en una cancha
 *  libre (x/y) alineaciones viejas que solo guardaban position_code. */
export const LEGACY_BAND_Y: Record<PositionCode, number> = {
  delantero: 12,
  medio: 38,
  defensa: 65,
  arquero: 92,
};

/** Reparte N jugadores del mismo position_code en una fila horizontal, para
 *  que una alineación vieja (sin x/y) no aparezca toda apilada en el mismo punto. */
export function legacyFallbackPosition(positionCode: PositionCode | null | undefined, indexInBand: number, totalInBand: number) {
  const y = positionCode ? LEGACY_BAND_Y[positionCode] : 50;
  const x = totalInBand <= 1 ? 50 : 20 + indexInBand * (60 / (totalInBand - 1));
  return { x, y };
}

export const EVENT_CONFIG: Record<FootballEventType, { label: string; shortLabel: string; color: string }> = {
  goal:     { label: 'Gol',        shortLabel: 'G',  color: 'text-green-600 border-green-500/30 bg-green-500/5' },
  own_goal: { label: 'Autogol',    shortLabel: 'AG', color: 'text-red-600 border-red-500/30 bg-red-500/5' },
  assist:   { label: 'Asistencia', shortLabel: 'A',  color: 'text-blue-600 border-blue-500/30 bg-blue-500/5' },
  yellow:   { label: 'Amarilla',   shortLabel: 'TA', color: 'text-yellow-600 border-yellow-500/30 bg-yellow-500/5' },
  red:      { label: 'Roja',       shortLabel: 'TR', color: 'text-red-700 border-red-600/30 bg-red-600/5' },
};
