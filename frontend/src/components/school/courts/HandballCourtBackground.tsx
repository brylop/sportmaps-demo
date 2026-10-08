/**
 * Cancha de balonmano (40 × 20 m, reglas IHF): área de portería de 6 m
 * (cuartos de círculo desde cada palo + recta de 3 m), línea de golpe franco
 * de 9 m discontinua (cortada por la banda), línea de 7 m (1 m), línea de
 * limitación del portero a 4 m, arcos de 3 m, línea central y líneas de
 * cambio a 4,5 m del medio.
 */
import { SPORTS } from '@/lib/school/tacticalSports';
import { CourtShell, GoalTop } from './CourtShell';
import { MIRROR, dAreaPath, lineProps, meters, type CourtBackgroundProps } from './courtGeometry';

export function HandballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const def = SPORTS.balonmano;
  const f = def.frame!;
  const m = meters(f);
  const { line, accent } = def.colors;
  const L = lineProps(line);
  const W = f.widthM;
  const mid = f.lengthM / 2;
  const P1 = W / 2 - 1.5;
  const P2 = W / 2 + 1.5;
  const six = dAreaPath(m, W, P1, P2, 6);
  const nine = dAreaPath(m, W, P1, P2, 9);

  const half = (
    <g>
      <path d={`${six} Z`} fill={accent} fillOpacity={0.75} stroke="none" />
      <path d={six} {...L} />
      <path d={nine} {...L} strokeDasharray="5 4" />
      <line x1={m.X(W / 2 - 0.5)} y1={m.Y(7)} x2={m.X(W / 2 + 0.5)} y2={m.Y(7)} {...L} strokeWidth={2} />
      {/* Limitación del portero: 15 cm a 4 m. */}
      <line x1={m.X(W / 2 - 0.15)} y1={m.Y(4)} x2={m.X(W / 2 + 0.15)} y2={m.Y(4)} {...L} strokeWidth={1.6} />
      <GoalTop m={m} p1={P1} p2={P2} line={line} />
    </g>
  );

  return (
    <CourtShell sport="balonmano" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect x={f.ox} y={f.oy} width={f.w} height={f.h} {...L} strokeWidth={1.9} />
      <line x1={m.X(0)} y1={m.Y(mid)} x2={m.X(W)} y2={m.Y(mid)} {...L} />
      {half}
      <g transform={MIRROR}>{half}</g>
      {/* Líneas de cambio (banda derecha) a 4,5 m del medio. */}
      {[-4.5, 4.5].map((d) => (
        <line key={d} x1={m.X(W) - 3} y1={m.Y(mid + d)} x2={m.X(W) + 3} y2={m.Y(mid + d)} {...L} strokeWidth={1.2} />
      ))}
    </CourtShell>
  );
}
