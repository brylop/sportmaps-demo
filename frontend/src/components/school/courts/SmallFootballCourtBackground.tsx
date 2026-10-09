/**
 * Canchas de fútbol reducido sobre grama. Las medidas cambian por liga; se
 * toman las típicas de escuela:
 *  - Fútbol 7 (60 × 40 m): área grande 26 × 12 m, área chica 12 × 5 m, punto
 *    penal a 9 m con su medialuna (r 6 m), círculo central de 6 m, arcos de
 *    6 m y esquinas de 1 m.
 *  - Fútbol 5 (40 × 25 m, sintética): área rectangular 15 × 7 m, punto penal
 *    a 6 m, círculo central de 3 m y arcos de 3 m.
 */
import { SPORTS, type TacticalSport } from '@/lib/school/tacticalSports';
import { CourtShell, GoalTop, Spot } from './CourtShell';
import { MIRROR, lineProps, meters, type CourtBackgroundProps } from './courtGeometry';

interface Spec {
  area: { w: number; d: number };
  small: { w: number; d: number } | null;
  penalty: number;
  /** Radio de la medialuna (null = sin medialuna). */
  arc: number | null;
  center: number;
  goal: number;
  corner: number;
}

const SPECS: Record<'futbol7' | 'futbol5', Spec> = {
  futbol7: { area: { w: 26, d: 12 }, small: { w: 12, d: 5 }, penalty: 9, arc: 6, center: 6, goal: 6, corner: 1 },
  futbol5: { area: { w: 15, d: 7 }, small: null, penalty: 6, arc: null, center: 3, goal: 3, corner: 0.5 },
};

function SmallFootballCourt({ sport, viewBox }: CourtBackgroundProps & { sport: 'futbol7' | 'futbol5' }) {
  const def = SPORTS[sport as TacticalSport];
  const spec = SPECS[sport];
  const f = def.frame!;
  const m = meters(f);
  const { line } = def.colors;
  const L = lineProps(line, 1.75, 0.7);
  const W = f.widthM;
  const cx = W / 2;
  const mid = f.lengthM / 2;

  let arcPath: string | null = null;
  if (spec.arc != null && spec.arc > spec.area.d - spec.penalty) {
    const dy = spec.area.d - spec.penalty;
    const dx = Math.sqrt(spec.arc * spec.arc - dy * dy);
    arcPath = `M ${m.X(cx - dx)} ${m.Y(spec.area.d)} A ${m.rx(spec.arc)} ${m.ry(spec.arc)} 0 0 0 ${m.X(cx + dx)} ${m.Y(spec.area.d)}`;
  }

  const half = (
    <g>
      <rect x={m.X(cx - spec.area.w / 2)} y={m.Y(0)} width={m.rx(spec.area.w)} height={m.ry(spec.area.d)} {...L} />
      {spec.small && (
        <rect x={m.X(cx - spec.small.w / 2)} y={m.Y(0)} width={m.rx(spec.small.w)} height={m.ry(spec.small.d)} {...L} />
      )}
      {arcPath && <path d={arcPath} {...L} />}
      <Spot cx={m.X(cx)} cy={m.Y(spec.penalty)} color={line} r={1.8} />
      <path d={`M ${m.X(0)} ${m.Y(spec.corner)} A ${m.rx(spec.corner)} ${m.ry(spec.corner)} 0 0 0 ${m.X(spec.corner)} ${m.Y(0)}`} {...L} strokeWidth={1.4} />
      <path d={`M ${m.X(W - spec.corner)} ${m.Y(0)} A ${m.rx(spec.corner)} ${m.ry(spec.corner)} 0 0 0 ${m.X(W)} ${m.Y(spec.corner)}`} {...L} strokeWidth={1.4} />
      <GoalTop m={m} p1={cx - spec.goal / 2} p2={cx + spec.goal / 2} line={line} />
    </g>
  );

  return (
    <CourtShell sport={sport} frame={f} court={def.colors.court} surround={def.colors.surround} texture="grass" viewBox={viewBox}>
      <rect x={f.ox} y={f.oy} width={f.w} height={f.h} {...L} />
      <line x1={m.X(0)} y1={m.Y(mid)} x2={m.X(W)} y2={m.Y(mid)} {...L} />
      <ellipse cx={m.X(cx)} cy={m.Y(mid)} rx={m.rx(spec.center)} ry={m.ry(spec.center)} {...L} />
      <Spot cx={m.X(cx)} cy={m.Y(mid)} color={line} r={2.2} />
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}

export function Football7CourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  return <SmallFootballCourt sport="futbol7" viewBox={viewBox} />;
}

export function Football5CourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  return <SmallFootballCourt sport="futbol5" viewBox={viewBox} />;
}
