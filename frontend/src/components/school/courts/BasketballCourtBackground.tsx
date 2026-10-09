/**
 * Cancha de baloncesto (28 × 15 m, reglas FIBA): zona pintada (4,9 × 5,8 m),
 * círculo de tiro libre (r 1,8 m, mitad interior discontinua), línea de 3 a
 * 6,75 m del aro con sus rectas a 0,9 m de la banda, tablero a 1,2 m del
 * fondo, aro, semicírculo de no-carga (r 1,25 m), línea y círculo central.
 */
import { SPORTS } from '@/lib/school/tacticalSports';
import { CourtShell, Spot } from './CourtShell';
import { MIRROR, lineProps, meters, type CourtBackgroundProps } from './courtGeometry';

const RIM_Y = 1.575; // centro del aro desde la línea de fondo
const THREE_R = 6.75;
const THREE_SIDE = 0.9;

export function BasketballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const def = SPORTS.baloncesto;
  const f = def.frame!;
  const m = meters(f);
  const { line, accent } = def.colors;
  const L = lineProps(line, 1.6, 0.85);
  const W = f.widthM;
  const cx = W / 2;
  const mid = f.lengthM / 2;
  const keyW = 4.9;
  const keyD = 5.8;
  // Donde la recta de 3 (x = 0,9) se une al arco.
  const dx = cx - THREE_SIDE;
  const threeJoinY = RIM_Y + Math.sqrt(THREE_R * THREE_R - dx * dx);

  const half = (
    <g>
      <rect x={m.X(cx - keyW / 2)} y={m.Y(0)} width={m.rx(keyW)} height={m.ry(keyD)} fill={accent} fillOpacity={0.85}
        stroke={line} strokeOpacity={0.85} strokeWidth={1.6} />
      {/* Tiro libre: mitad exterior continua, interior discontinua. */}
      <path d={`M ${m.X(cx - 1.8)} ${m.Y(keyD)} A ${m.rx(1.8)} ${m.ry(1.8)} 0 0 0 ${m.X(cx + 1.8)} ${m.Y(keyD)}`} {...L} />
      <path d={`M ${m.X(cx - 1.8)} ${m.Y(keyD)} A ${m.rx(1.8)} ${m.ry(1.8)} 0 0 1 ${m.X(cx + 1.8)} ${m.Y(keyD)}`} {...L}
        stroke="#ffffff" strokeOpacity={0.6} strokeDasharray="3 3" />
      {/* Línea de 3. */}
      <path
        d={`M ${m.X(THREE_SIDE)} ${m.Y(0)} L ${m.X(THREE_SIDE)} ${m.Y(threeJoinY)} A ${m.rx(THREE_R)} ${m.ry(THREE_R)} 0 0 0 ${m.X(W - THREE_SIDE)} ${m.Y(threeJoinY)} L ${m.X(W - THREE_SIDE)} ${m.Y(0)}`}
        {...L}
      />
      {/* No-carga (r 1,25 m). */}
      <path
        d={`M ${m.X(cx - 1.25)} ${m.Y(1.2)} L ${m.X(cx - 1.25)} ${m.Y(RIM_Y)} A ${m.rx(1.25)} ${m.ry(1.25)} 0 0 0 ${m.X(cx + 1.25)} ${m.Y(RIM_Y)} L ${m.X(cx + 1.25)} ${m.Y(1.2)}`}
        {...L} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1.1}
      />
      {/* Tablero y aro. */}
      <line x1={m.X(cx - 0.9)} y1={m.Y(1.2)} x2={m.X(cx + 0.9)} y2={m.Y(1.2)} stroke="#f8fafc" strokeWidth={2.6} />
      <line x1={m.X(cx)} y1={m.Y(1.2)} x2={m.X(cx)} y2={m.Y(RIM_Y) - Math.max(2.6, m.ry(0.225))} stroke="#f97316" strokeWidth={1.4} />
      <ellipse cx={m.X(cx)} cy={m.Y(RIM_Y)} rx={Math.max(2.6, m.rx(0.225))} ry={Math.max(2.6, m.ry(0.225))} fill="none" stroke="#f97316" strokeWidth={1.6} />
    </g>
  );

  return (
    <CourtShell sport="baloncesto" frame={f} court={def.colors.court} surround={def.colors.surround} texture="wood" viewBox={viewBox}>
      <rect x={f.ox} y={f.oy} width={f.w} height={f.h} {...L} strokeWidth={1.9} />
      <line x1={m.X(0)} y1={m.Y(mid)} x2={m.X(W)} y2={m.Y(mid)} {...L} />
      <ellipse cx={m.X(cx)} cy={m.Y(mid)} rx={m.rx(1.8)} ry={m.ry(1.8)} fill={accent} fillOpacity={0.85} stroke={line} strokeOpacity={0.85} strokeWidth={1.6} />
      <Spot cx={m.X(cx)} cy={m.Y(mid)} color="#ffffff" r={1.4} />
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}
