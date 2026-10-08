/**
 * Cancha genérica (deportes sin cancha propia en la pizarra): rectángulo,
 * línea central, círculo y punto central. Sirve de lienzo para circuitos y
 * ejercicios de cualquier disciplina.
 */
import { SPORTS } from '@/lib/school/tacticalSports';
import { CourtShell, Spot } from './CourtShell';
import { lineProps, meters, type CourtBackgroundProps } from './courtGeometry';

export function GenericCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const def = SPORTS.generico;
  const f = def.frame!;
  const m = meters(f);
  const { line } = def.colors;
  const L = lineProps(line, 1.75, 0.6);
  const W = f.widthM;
  const mid = f.lengthM / 2;
  return (
    <CourtShell sport="generico" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect x={f.ox} y={f.oy} width={f.w} height={f.h} {...L} />
      <line x1={m.X(0)} y1={m.Y(mid)} x2={m.X(W)} y2={m.Y(mid)} {...L} />
      <ellipse cx={m.X(W / 2)} cy={m.Y(mid)} rx={m.rx(5)} ry={m.ry(5)} {...L} />
      <Spot cx={m.X(W / 2)} cy={m.Y(mid)} color={line} r={2.2} />
    </CourtShell>
  );
}
