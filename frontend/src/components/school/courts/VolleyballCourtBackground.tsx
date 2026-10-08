/**
 * Cancha de voleibol (18 × 9 m, reglas FIVB) con zona libre alrededor: red al
 * centro (con postes y antenas), líneas de ataque a 3 m de la red con su
 * prolongación discontinua fuera de la banda, marcas de la zona de saque y,
 * en la mitad propia (abajo), las zonas 1-6 de rotación.
 */
import { SPORTS } from '@/lib/school/tacticalSports';
import { CourtShell } from './CourtShell';
import { lineProps, meters, type CourtBackgroundProps } from './courtGeometry';

export function VolleyballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const def = SPORTS.voleibol;
  const f = def.frame!;
  const m = meters(f);
  const { line } = def.colors;
  const L = lineProps(line, 1.8, 0.95);
  const W = f.widthM;
  const len = f.lengthM;
  const net = len / 2;
  // Zonas de la mitad propia, mirando a la red: adelante 4-3-2, atrás 5-6-1.
  const zones: [number, number, string][] = [
    [1.5, net + 1.5, '4'], [4.5, net + 1.5, '3'], [7.5, net + 1.5, '2'],
    [1.5, net + 6, '5'], [4.5, net + 6, '6'], [7.5, net + 6, '1'],
  ];

  return (
    <CourtShell sport="voleibol" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect x={f.ox} y={f.oy} width={f.w} height={f.h} {...L} strokeWidth={2} />
      {/* Líneas de ataque (3 m) y su prolongación discontinua de 1,75 m. */}
      {[net - 3, net + 3].map((y) => (
        <g key={y}>
          <line x1={m.X(0)} y1={m.Y(y)} x2={m.X(W)} y2={m.Y(y)} {...L} />
          <line x1={m.X(-1.75)} y1={m.Y(y)} x2={m.X(0)} y2={m.Y(y)} {...L} strokeWidth={1.2} strokeDasharray="2.5 3" />
          <line x1={m.X(W)} y1={m.Y(y)} x2={m.X(W + 1.75)} y2={m.Y(y)} {...L} strokeWidth={1.2} strokeDasharray="2.5 3" />
        </g>
      ))}
      {/* Zona de saque: marcas cortas detrás de cada fondo, en la prolongación de las bandas. */}
      {[0, W].map((x) => (
        <g key={x}>
          <line x1={m.X(x)} y1={m.Y(0) - 2} x2={m.X(x)} y2={m.Y(0) - 5} {...L} strokeWidth={1.2} />
          <line x1={m.X(x)} y1={m.Y(len) + 2} x2={m.X(x)} y2={m.Y(len) + 5} {...L} strokeWidth={1.2} />
        </g>
      ))}
      {/* Zonas 1-6 de la mitad propia. */}
      <g>
        {[3, 6].map((x) => (
          <line key={x} x1={m.X(x)} y1={m.Y(net)} x2={m.X(x)} y2={m.Y(len)} stroke={line} strokeOpacity={0.28} strokeWidth={1} strokeDasharray="3 4" />
        ))}
        {zones.map(([x, y, n]) => (
          <text key={n} x={m.X(x)} y={m.Y(y)} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={800}
            fontFamily="Helvetica, Arial, sans-serif" fill={line} fillOpacity={0.3}>
            {n}
          </text>
        ))}
      </g>
      {/* Línea central (bajo la red) + red, postes y antenas. */}
      <line x1={m.X(0)} y1={m.Y(net)} x2={m.X(W)} y2={m.Y(net)} {...L} />
      <line x1={m.X(-1)} y1={m.Y(net) + 1.2} x2={m.X(W + 1)} y2={m.Y(net) + 1.2} stroke="#000000" strokeOpacity={0.35} strokeWidth={3.4} />
      <line x1={m.X(-1)} y1={m.Y(net)} x2={m.X(W + 1)} y2={m.Y(net)} stroke="#f8fafc" strokeWidth={3} strokeDasharray="1.2 1.2" />
      <line x1={m.X(-1)} y1={m.Y(net) - 1.5} x2={m.X(W + 1)} y2={m.Y(net) - 1.5} stroke="#f8fafc" strokeWidth={1} />
      {[-1, W + 1].map((x) => (
        <circle key={x} cx={m.X(x)} cy={m.Y(net)} r={3} fill="#e5e7eb" stroke="#111827" strokeOpacity={0.5} strokeWidth={0.8} />
      ))}
      {[0, W].map((x) => (
        <circle key={x} cx={m.X(x)} cy={m.Y(net)} r={1.8} fill="#ef4444" stroke="#ffffff" strokeWidth={0.8} />
      ))}
    </CourtShell>
  );
}
