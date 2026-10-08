/**
 * Geometría compartida de los fondos de cancha (sin React). Ver CourtShell.tsx.
 */
import { BOARD_H, BOARD_W, type CourtFrame } from '@/lib/school/tacticalSports';

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
