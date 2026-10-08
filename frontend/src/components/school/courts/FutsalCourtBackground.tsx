/**
 * Cancha de futsal (40 × 20 m, Reglas de Juego de Futsal FIFA): área penal
 * de 6 m (dos cuartos de círculo desde cada palo unidos por una recta), punto
 * penal a 6 m, segundo punto penal a 10 m, círculo central de 3 m, arcos de
 * 3 m, esquinas de 25 cm y zonas de sustitución en una banda.
 */
import { SPORTS } from '@/lib/school/tacticalSports';
import { CourtShell, GoalTop, Spot } from './CourtShell';
import { MIRROR, dAreaPath, lineProps, meters, type CourtBackgroundProps } from './courtGeometry';

export function FutsalCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const def = SPORTS.futsal;
  const f = def.frame!;
  const m = meters(f);
  const { line, accent } = def.colors;
  const L = lineProps(line);
  const W = f.widthM;
  const mid = f.lengthM / 2;
  const P1 = W / 2 - 1.5;
  const P2 = W / 2 + 1.5;
  const area = dAreaPath(m, W, P1, P2, 6);

  const half = (
    <g>
      <path d={`${area} Z`} fill={accent} fillOpacity={0.6} stroke="none" />
      <path d={area} {...L} />
      <Spot cx={m.X(W / 2)} cy={m.Y(6)} color={line} />
      <Spot cx={m.X(W / 2)} cy={m.Y(10)} color={line} />
      <path d={`M ${m.X(0)} ${m.Y(0.25)} A ${m.rx(0.25)} ${m.ry(0.25)} 0 0 0 ${m.X(0.25)} ${m.Y(0)}`} {...L} strokeWidth={1.2} />
      <path d={`M ${m.X(W - 0.25)} ${m.Y(0)} A ${m.rx(0.25)} ${m.ry(0.25)} 0 0 0 ${m.X(W)} ${m.Y(0.25)}`} {...L} strokeWidth={1.2} />
      <GoalTop m={m} p1={P1} p2={P2} line={line} />
    </g>
  );

  return (
    <CourtShell sport="futsal" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect x={f.ox} y={f.oy} width={f.w} height={f.h} {...L} strokeWidth={1.9} />
      <line x1={m.X(0)} y1={m.Y(mid)} x2={m.X(W)} y2={m.Y(mid)} {...L} />
      <ellipse cx={m.X(W / 2)} cy={m.Y(mid)} rx={m.rx(3)} ry={m.ry(3)} {...L} />
      <Spot cx={m.X(W / 2)} cy={m.Y(mid)} color={line} />
      {half}
      <g transform={MIRROR}>{half}</g>
      {/* Zonas de sustitución (banda derecha): marcas a 5 y 10 m del medio. */}
      {[-10, -5, 5, 10].map((d) => (
        <line key={d} x1={m.X(W) - 3} y1={m.Y(mid + d)} x2={m.X(W) + 3} y2={m.Y(mid + d)} {...L} strokeWidth={1.2} />
      ))}
    </CourtShell>
  );
}
