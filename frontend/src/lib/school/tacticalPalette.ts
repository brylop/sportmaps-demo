/**
 * Paleta y etiquetas de la pizarra táctica (sin React): colores, nombres de
 * material y recorridos, y la preferencia disco/silueta del coach. Separado
 * de tacticalGlyphs.tsx para que ese archivo exporte solo componentes (regla
 * de Fast Refresh) y estas constantes se puedan importar desde cualquier lado.
 */
import type { TacticalArrowColor, BallPathKind } from './footballQueries';
import type { ObjectType } from './tacticalGeometry';

// ─── Colores ────────────────────────────────────────────────────────────────

/** 9 colores (eran 4). Verde claro y no verde puro: sobre el césped un verde
 *  oscuro desaparece. Negro para contraste máximo en zonas y flechas.
 *  Ampliar JUNTO con TacticalArrowColor (footballQueries.ts) y
 *  VALID_ARROW_COLORS (bff football.ts). */
export const ARROW_COLOR_HEX: Record<TacticalArrowColor, string> = {
  white: '#f8fafc',
  yellow: '#facc15',
  red: '#ef4444',
  blue: '#38bdf8',
  green: '#86efac',
  orange: '#fb923c',
  purple: '#c084fc',
  pink: '#f472b6',
  black: '#111827',
};
export const COLOR_LABEL: Record<TacticalArrowColor, string> = {
  white: 'Blanco', yellow: 'Amarillo', red: 'Rojo', blue: 'Azul', green: 'Verde',
  orange: 'Naranja', purple: 'Morado', pink: 'Rosado', black: 'Negro',
};

/** El blanco es el color "por defecto" de la paleta: un objeto con color
 *  natural (cono naranja, aro amarillo…) lo conserva salvo que el coach haya
 *  elegido otro color explícito. */
export function objectColor(color: TacticalArrowColor | undefined, fallback: string) {
  return color && color !== 'white' ? ARROW_COLOR_HEX[color] : fallback;
}

// ─── Etiquetas ──────────────────────────────────────────────────────────────

export const OBJECT_LABEL: Record<ObjectType, string> = {
  cone: 'Cono', marker: 'Plato', ball: 'Balón', goal: 'Arco', mini_goal: 'Arco chico', hurdle: 'Vallita',
  ring: 'Aro', ladder: 'Escalera', pole: 'Estaca', mannequin: 'Maniquí', opponent: 'Rival',
};
export const BALL_PATH_LABEL: Record<BallPathKind, string> = { pase: 'Pase', remate: 'Remate', penal: 'Penal' };

// ─── Estilo de pin (disco vs silueta) ───────────────────────────────────────

/** Cómo se dibuja cada jugador en la cancha: disco (número/iniciales, foto si
 *  hay) o silueta genérica por posición (nunca foto). Preferencia de vista
 *  del coach, no dato: vive en localStorage. */
export type PinStyle = 'disc' | 'silhouette';
export const PIN_STYLE_KEY = 'tactical_board_pin_style';
export function readPinStyle(): PinStyle {
  try { return localStorage.getItem(PIN_STYLE_KEY) === 'silhouette' ? 'silhouette' : 'disc'; } catch { return 'disc'; }
}
export const isGoalkeeperLabel = (label: string) => /arquer|portero|golero|guardameta/i.test(label);
