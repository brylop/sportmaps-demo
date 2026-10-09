/**
 * Piezas comunes de los fondos de cancha (T4, docs/specs/pizarra-nivel-tacticalpad.md).
 * SVG puro, sin interacción ni estado, autocontenido (sin clases de Tailwind
 * que importen para el dibujo): se puede serializar con renderToStaticMarkup.
 *
 * Todas las canchas comparten viewBox 300×340 y la misma firma de props que
 * FootballPitchBackground (`viewBox` opcional para el zoom al área).
 */
import type { ReactNode } from 'react';
import { BOARD_H, BOARD_W, type CourtFrame, type TacticalSport } from '@/lib/school/tacticalSports';
import type { CourtBackgroundProps, Meters } from './courtGeometry';

interface ShellProps extends CourtBackgroundProps {
  sport: TacticalSport;
  frame: CourtFrame;
  court: string;
  surround: string;
  /** Franjas de pasto (canchas de grama) o tablas de madera. */
  texture?: 'grass' | 'wood' | 'none';
  children: ReactNode;
}

export function CourtShell({ sport, frame: f, court, surround, texture = 'none', viewBox = `0 0 ${BOARD_W} ${BOARD_H}`, children }: ShellProps) {
  const stripes: ReactNode[] = [];
  if (texture === 'grass') {
    const n = 10;
    const h = f.h / n;
    for (let i = 0; i < n; i += 2) {
      stripes.push(<rect key={i} x={f.ox} y={f.oy + i * h} width={f.w} height={h} fill="#ffffff" opacity={0.05} />);
    }
  } else if (texture === 'wood') {
    const step = 7;
    for (let x = step; x < BOARD_W; x += step) {
      stripes.push(<line key={x} x1={x} y1={0} x2={x} y2={BOARD_H} stroke="#000000" strokeOpacity={0.07} strokeWidth={0.6} />);
    }
  }
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full rounded-xl"
      aria-hidden="true"
    >
      <g data-court={sport}>
        <rect x={0} y={0} width={BOARD_W} height={BOARD_H} fill={surround} />
        <rect x={f.ox} y={f.oy} width={f.w} height={f.h} fill={court} />
        <g>{stripes}</g>
        {/* Viñeta suave en los fondos, como la de la cancha de fútbol. */}
        <rect x={0} y={0} width={BOARD_W} height={24} fill="#000000" opacity={0.12} />
        <rect x={0} y={BOARD_H - 24} width={BOARD_W} height={24} fill="#000000" opacity={0.12} />
        {children}
      </g>
    </svg>
  );
}

/** Arco (portería) detrás de la línea de fondo de ARRIBA: marco + red. */
export function GoalTop({ m, p1, p2, line }: { m: Meters; p1: number; p2: number; line: string }) {
  const y0 = m.Y(0);
  const depth = Math.max(2, Math.min(6, y0 - 0.5));
  return (
    <g>
      <rect x={m.X(p1)} y={y0 - depth} width={m.X(p2) - m.X(p1)} height={depth} fill="#ffffff" fillOpacity={0.18} />
      <path d={`M ${m.X(p1)} ${y0} V ${y0 - depth} H ${m.X(p2)} V ${y0}`} fill="none" stroke={line} strokeWidth={2.2} strokeOpacity={0.95} />
    </g>
  );
}

/** Punto (penal, saque, centro). */
export function Spot({ cx, cy, color, r = 1.9 }: { cx: number; cy: number; color: string; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.9} />;
}
