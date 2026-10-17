/**
 * M6d — plantillas de líneas del diálogo «Campo»: carriles, tercios,
 * half-spaces, juego de posición, cuadrículas, diagonales y rondos, dibujados
 * sobre el rectángulo de juego del deporte (SPORTS[sport].court). SVG puro,
 * autocontenido: lo serializa TacticalStaticSvg para PNG/PDF/GIF/video.
 *
 * La geometría de fútbol sale de la cancha: los carriles los marcan el área
 * grande y el área chica (como en el juego de posición), no quintos parejos.
 */
import type { ReactNode } from 'react';
import { DEFAULT_SPORT, isTacticalSport, SPORTS, type TacticalSport } from '@/lib/school/tacticalSports';
import { isFootballFamily, resolveCourtLook, templateOf, type CourtConfig } from '@/lib/school/tacticalCourt';

/** Fracciones del ancho del área grande y del área chica (fútbol 11: 40,3 y
 *  18,3 m sobre 68 m) y del largo del área grande (16,5 m sobre 105 m, como
 *  la dibuja FootballPitchBackground: 45 de 328). */
const BOX_X = [0.222, 0.778];
const SMALL_X = [0.378, 0.622];
const BOX_Y = 45 / 328;

export function CourtTemplateOverlay({ sport, court, viewBox = '0 0 300 340' }: {
  sport?: TacticalSport | null;
  court: CourtConfig;
  viewBox?: string;
}) {
  const tpl = templateOf(court.tpl);
  if (!tpl) return null;
  const key = isTacticalSport(sport) ? sport : DEFAULT_SPORT;
  const def = SPORTS[key];
  const r = def.court;
  const X0 = r.x0 * 3;
  const Y0 = r.y0 * 3.4;
  const W = (r.x1 - r.x0) * 3;
  const H = (r.y1 - r.y0) * 3.4;
  const look = resolveCourtLook(def.colors, court);
  const line = look.line;
  const football = isFootballFamily(key);
  const fx = (k: number) => X0 + W * k;
  const fy = (k: number) => Y0 + H * k;
  const dash = { fill: 'none', stroke: line, strokeOpacity: 0.6, strokeWidth: 1.2, strokeDasharray: '5 4' } as const;
  const solid = { fill: 'none', stroke: line, strokeOpacity: 0.75, strokeWidth: 1.4 } as const;
  const parts: ReactNode[] = [];
  const vlines = (ks: number[], props: object = dash) =>
    ks.forEach((k) => parts.push(<line key={`v${k}${parts.length}`} x1={fx(k)} y1={Y0} x2={fx(k)} y2={Y0 + H} {...props} />));
  const hlines = (ks: number[], props: object = dash) =>
    ks.forEach((k) => parts.push(<line key={`h${k}${parts.length}`} x1={X0} y1={fy(k)} x2={X0 + W} y2={fy(k)} {...props} />));
  const lanes = football ? [BOX_X[0], SMALL_X[0], SMALL_X[1], BOX_X[1]] : [0.2, 0.4, 0.6, 0.8];
  const grid = (cols: number, rows: number) => {
    parts.push(<rect key="gb" x={X0} y={Y0} width={W} height={H} {...solid} />);
    vlines(Array.from({ length: cols - 1 }, (_, i) => (i + 1) / cols), solid);
    hlines(Array.from({ length: rows - 1 }, (_, i) => (i + 1) / rows), solid);
  };

  switch (tpl.id) {
    case 'lanes5': vlines(lanes); break;
    case 'thirds': hlines([1 / 3, 2 / 3]); break;
    case 'lanes_thirds': vlines(lanes); hlines([1 / 3, 2 / 3]); break;
    case 'half_spaces':
      for (const [a, b] of [[lanes[0], lanes[1]], [lanes[2], lanes[3]]]) {
        parts.push(<rect key={`hs${a}`} x={fx(a)} y={Y0} width={fx(b) - fx(a)} height={H} fill={line} fillOpacity={0.1} />);
      }
      vlines(lanes);
      break;
    case 'positional': vlines(lanes); hlines(football ? [BOX_Y, 0.5, 1 - BOX_Y] : [0.25, 0.5, 0.75]); break;
    case 'big_area': vlines(football ? BOX_X : [0.25, 0.75]); hlines(football ? [BOX_Y, 1 - BOX_Y] : [0.2, 0.8]); break;
    case 'diagonals':
      parts.push(<line key="d1" x1={X0} y1={Y0} x2={X0 + W} y2={Y0 + H} {...dash} />);
      parts.push(<line key="d2" x1={X0 + W} y1={Y0} x2={X0} y2={Y0 + H} {...dash} />);
      break;
    case 'grid2x2': grid(2, 2); break;
    case 'grid3x3': grid(3, 3); break;
    case 'grid4x3': grid(4, 3); break;
    case 'no_lines': break;
    default: {
      // Rondos: la forma centrada, con conos en los vértices.
      const cx = X0 + W / 2;
      const cy = Y0 + H / 2;
      const rad = Math.min(W, H) * 0.3;
      const n = tpl.id === 'rondo_triangle' ? 3 : tpl.id === 'rondo_hexagon' ? 6 : tpl.id === 'rondo_square' ? 4 : 0;
      const verts = n === 0
        ? Array.from({ length: 8 }, (_, i) => ({ x: cx + rad * Math.cos((i * Math.PI) / 4), y: cy + rad * Math.sin((i * Math.PI) / 4) }))
        : Array.from({ length: n }, (_, i) => {
          const a = -Math.PI / 2 + (n === 4 ? Math.PI / 4 : 0) + (i * 2 * Math.PI) / n;
          return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
        });
      if (n === 0) parts.push(<circle key="rc" cx={cx} cy={cy} r={rad} {...solid} strokeDasharray="6 4" />);
      else parts.push(<polygon key="rp" points={verts.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ')} {...solid} strokeDasharray="6 4" />);
      verts.forEach((v, i) => parts.push(<circle key={`rv${i}`} cx={v.x} cy={v.y} r={2.6} fill="#f97316" stroke="#7c2d12" strokeWidth={0.6} />));
    }
  }

  // «Incluyendo porterías»: en los lienzos de ejercicio, un arco en cada fondo.
  if (tpl.family === 'replace' && court.goals !== false) {
    const gw = Math.max(18, W * 0.16);
    for (const top of [true, false]) {
      const y = top ? Y0 : Y0 + H;
      const d = top ? -4.5 : 4.5;
      parts.push(
        <path key={`g${top}`} d={`M ${X0 + W / 2 - gw / 2} ${y} v ${d} h ${gw} v ${-d}`} fill={line} fillOpacity={0.15}
          stroke={line} strokeWidth={2} strokeOpacity={0.95} />,
      );
    }
  }

  return (
    <svg viewBox={viewBox} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <g data-court-template={tpl.id}>{parts}</g>
    </svg>
  );
}
