/**
 * Geometría compartida de los fondos de cancha (sin React). Ver CourtShell.tsx.
 */
import { BOARD_H, BOARD_W, SPORTS, type CourtFrame, type TacticalSport } from '@/lib/school/tacticalSports';

/** Mismas props que FootballPitchBackground. */
export interface CourtBackgroundProps {
  viewBox?: string;
}

export interface Meters {
  X: (xm: number) => number;
  Y: (ym: number) => number;
  rx: (r: number) => number;
  ry: (r: number) => number;
}

/** Conversor metro → unidad del viewBox para un marco. `y` se mide desde la
 *  línea de fondo de ARRIBA (arco/canasta rival). */
export function meters(f: CourtFrame): Meters {
  return {
    X: (xm) => f.ox + xm * f.sx,
    Y: (ym) => f.oy + ym * f.sy,
    // Radio elíptico: la cancha puede ir estirada a lo ancho.
    rx: (r) => r * f.sx,
    ry: (r) => r * f.sy,
  };
}

/** Giro de 180° alrededor del centro del tablero: dibuja la mitad de ABAJO
 *  con el mismo código que la de arriba (todas las canchas van centradas). */
export const MIRROR = `rotate(180 ${BOARD_W / 2} ${BOARD_H / 2})`;

/** Props de trazo de las líneas reglamentarias. */
export const lineProps = (color: string, width = 1.6, opacity = 0.9) => ({
  fill: 'none',
  stroke: color,
  strokeOpacity: opacity,
  strokeWidth: width,
});

/** Área con forma de "D" (futsal 6 m, balonmano 6 m y 9 m): cuartos de
 *  círculo de radio `r` centrados en los palos (x = p1 y p2) unidos por una
 *  recta paralela a la línea de fondo. Si el radio pasa la banda, el arco
 *  arranca donde la corta (la línea de 9 m de balonmano). */
export function dAreaPath(m: Meters, widthM: number, p1: number, p2: number, r: number) {
  const left = p1 - r;
  const right = p2 + r;
  const yAtLeft = left < 0 ? Math.sqrt(r * r - p1 * p1) : 0;
  const yAtRight = right > widthM ? Math.sqrt(r * r - (widthM - p2) * (widthM - p2)) : 0;
  const sx = Math.max(0, left);
  const ex = Math.min(widthM, right);
  return [
    `M ${m.X(sx)} ${m.Y(yAtLeft)}`,
    `A ${m.rx(r)} ${m.ry(r)} 0 0 0 ${m.X(p1)} ${m.Y(r)}`,
    `L ${m.X(p2)} ${m.Y(r)}`,
    `A ${m.rx(r)} ${m.ry(r)} 0 0 0 ${m.X(ex)} ${m.Y(yAtRight)}`,
  ].join(' ');
}

// ─── Dónde van arcos, red y canastas ────────────────────────────────────────
// Medidas reales en metros que comparten el fondo 2D y el visor 3D
// (components/school/tactical3d): una sola fuente. Las alturas, que el 2D no
// usa, viven en lib/school/tactical3d.ts.

/** Ancho del arco (entre palos) por deporte. */
export const GOAL_WIDTH_M = { futbol: 7.32, futbol7: 6, futbol5: 3, futsal: 3, balonmano: 3 } as const;

/** Canasta FIBA: tablero (1,8 m de ancho) a 1,2 m del fondo, centro del aro a
 *  1,575 m, radio del aro 22,5 cm. */
export const BASKET_M = { boardFromBaseline: 1.2, rimFromBaseline: 1.575, boardWidth: 1.8, rimRadius: 0.225 } as const;

/** Postes de la red de voleibol: a 1 m por fuera de cada banda. */
export const VOLLEY_POST_OUTSIDE_M = 1;

// ─── M6f: más deportes (fuentes en COURT_METERS de tacticalSports.ts) ───────

/** Arcos de hockey y waterpolo (ancho interior entre palos, metros):
 *  hockey césped 3,66 m (FIH Rules of Hockey, 1.6); hockey sobre patines
 *  1,70 m (World Skate Rink Hockey 2026, art. 3); waterpolo 3 m (World
 *  Aquatics WP 2). */
export const GOAL_WIDTH_EXTRA_M = { hockey_cesped: 3.66, hockey_patines: 1.7, waterpolo: 3 } as const;

/** Línea de gol medida desde el fondo de la cancha (donde va el arco). En
 *  patines está a 2,70-3,30 m de la valla (art. 2.4): se toma 3 m. En el
 *  resto el arco va sobre la línea de fondo. */
export const GOAL_LINE_FROM_END_M: Partial<Record<keyof typeof GOAL_WIDTH_EXTRA_M, number>> = { hockey_patines: 3 };

/** Palos en H (vista de planta + 3D). Rugby: 5,6 m entre postes, travesaño a
 *  3 m (World Rugby Law 1), sobre la línea de ensayo (a 10 m del fondo en
 *  esta cancha). Fútbol americano: 18 ft 6 in (5,64 m), travesaño a 10 ft
 *  (3,05 m), postes de 35 ft sobre el travesaño (NFL Rule 1, Sec. 2), en la
 *  línea de fondo de la zona de anotación. */
export const H_POSTS_M = {
  rugby: { width: 5.6, crossbar: 3, height: 11, lineFromEnd: 10 },
  futbol_americano: { width: 5.64, crossbar: 3.05, height: 13.72, lineFromEnd: 0 },
} as const;

/** Redes al medio de la cancha (altura en el centro, metros, y postes por
 *  fuera de la banda exterior): tenis 0,914 m, postes a 0,914 m de la banda
 *  de dobles (ITF Rule 1-2); pádel 0,88 m, postes en las paredes (FIP);
 *  bádminton 1,524 m en el centro, postes sobre la banda de dobles (BWF Law
 *  1.4); vóley playa 2,43 m (2,24 m femenino), postes a 0,7-1 m (FIVB Beach
 *  Rules 2.1-2.4). */
export const NET_M = {
  tenis: { height: 0.914, postOutside: 0.914, antennas: false },
  padel: { height: 0.88, postOutside: 0, antennas: false },
  badminton: { height: 1.524, postOutside: 0, antennas: false },
  voley_playa: { height: 2.43, postOutside: 1, antennas: true },
} as const;

/** Poste de netball: aro de 380 mm de diámetro interior a 3,05 m, centrado
 *  sobre la línea de fondo y salido 15 cm del poste (World Netball Rules 1.3). */
export const NETBALL_POST_M = { height: 3.05, ringRadius: 0.19, ringFromGoalLine: 0.34 } as const;

/** Catálogo + marco + conversor metro→viewBox de una cancha con marco propio
 *  (todas menos fútbol 11). */
export function courtOf(sport: Exclude<TacticalSport, 'futbol'>) {
  const def = SPORTS[sport];
  const f = def.frame!;
  return { def, f, m: meters(f), W: f.widthM, L: f.lengthM };
}
