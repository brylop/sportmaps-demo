/**
 * Pista, cancha de netball y piscina (M6f, docs/specs/pizarra-m6-paridad-
 * tacticalpad.md §4): hockey sobre patines, netball y waterpolo. Medidas
 * oficiales y fuentes en COURT_METERS (tacticalSports.ts),
 * GOAL_WIDTH_EXTRA_M, GOAL_LINE_FROM_END_M y NETBALL_POST_M (courtGeometry.ts).
 *
 * `y` desde el fondo de ARRIBA; la mitad de abajo es la de arriba girada
 * (MIRROR). La línea exterior lleva `data-outline`.
 */
import { CourtShell, GoalTop, Spot } from './CourtShell';
import {
  courtOf, GOAL_LINE_FROM_END_M, GOAL_WIDTH_EXTRA_M, MIRROR, NETBALL_POST_M, lineProps,
  type CourtBackgroundProps, type Meters,
} from './courtGeometry';

/** Hockey sobre patines (World Skate, Rink Hockey Rules of the Game 2026,
 *  art. 1-2): pista de 40 × 20 m con esquinas redondeadas de 3 m; línea de
 *  gol de 1,70 m a 3 m de la valla (2,70-3,30); área de penal de 9 × 5,40 m;
 *  semicírculo del portero de poste a poste; punto de penal a 5,40 m y de
 *  tiro libre directo a 7,40 m de la línea de gol; línea media y círculo
 *  central de 3 m. */
export function RinkHockeyCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('hockey_patines');
  const Ln = lineProps(def.colors.line, 1.6, 0.9);
  const gl = GOAL_LINE_FROM_END_M.hockey_patines ?? 3;
  const g = GOAL_WIDTH_EXTRA_M.hockey_patines;
  const P1 = W / 2 - g / 2;
  const P2 = W / 2 + g / 2;
  // Arco corrido a la línea de gol: el mismo GoalTop con el origen en esa línea.
  const atGoal: Meters = { ...m, Y: (y) => m.Y(y + gl) };
  const half = (
    <g>
      <rect data-penalty-area="true" x={m.X(W / 2 - 4.5)} y={m.Y(gl)} width={m.X(W / 2 + 4.5) - m.X(W / 2 - 4.5)} height={m.Y(gl + 5.4) - m.Y(gl)} {...Ln} />
      <path d={`M ${m.X(P1)} ${m.Y(gl)} A ${m.rx(g / 2)} ${m.ry(g / 2)} 0 0 0 ${m.X(P2)} ${m.Y(gl)}`} fill={def.colors.accent} fillOpacity={0.35} {...Ln} />
      <line data-goal-line="true" x1={m.X(P1)} y1={m.Y(gl)} x2={m.X(P2)} y2={m.Y(gl)} {...Ln} strokeWidth={2} />
      <Spot cx={m.X(W / 2)} cy={m.Y(gl + 5.4)} color={def.colors.line} r={1.5} />
      <Spot cx={m.X(W / 2)} cy={m.Y(gl + 7.4)} color={def.colors.line} r={1.5} />
      <GoalTop m={atGoal} p1={P1} p2={P2} line="#f97316" />
    </g>
  );
  return (
    <CourtShell sport="hockey_patines" frame={f} court={def.colors.surround} surround={def.colors.surround} viewBox={viewBox}>
      {/* La pista (con esquinas de 3 m) sobre el fondo oscuro de la valla. */}
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} rx={m.rx(3)} ry={m.ry(3)} fill={def.colors.court} stroke="#e5e7eb" strokeWidth={2.4} />
      <g opacity={0.6}>
        {Array.from({ length: Math.floor(f.w / 7) }, (_, i) => f.ox + (i + 1) * 7).map((x) => (
          <line key={x} x1={x} y1={f.oy + 2} x2={x} y2={f.oy + f.h - 2} stroke="#000000" strokeOpacity={0.08} strokeWidth={0.6} />
        ))}
      </g>
      <line x1={m.X(0)} y1={m.Y(L / 2)} x2={m.X(W)} y2={m.Y(L / 2)} {...Ln} />
      <ellipse cx={m.X(W / 2)} cy={m.Y(L / 2)} rx={m.rx(3)} ry={m.ry(3)} {...Ln} />
      <Spot cx={m.X(W / 2)} cy={m.Y(L / 2)} color={def.colors.line} r={1.5} />
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}

/** Netball (World Netball Rules 1): 30,50 × 15,25 m en tres tercios; círculo
 *  central de 0,90 m de diámetro; semicírculos de tiro de 4,90 m de radio
 *  centrados en la línea de fondo; poste con aro de 380 mm. */
export function NetballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('netball');
  const Ln = lineProps(def.colors.line, 1.6, 0.92);
  const third = L / 3;
  const r = 4.9;
  const half = (
    <g>
      <path data-shooting-circle="true" d={`M ${m.X(W / 2 - r)} ${m.Y(0)} A ${m.rx(r)} ${m.ry(r)} 0 0 0 ${m.X(W / 2 + r)} ${m.Y(0)}`} fill="#ffffff" fillOpacity={0.08} {...Ln} />
      <circle data-netball-post="true" cx={m.X(W / 2)} cy={m.Y(0) - 1.6} r={1.6} fill="#e5e7eb" stroke="#111827" strokeOpacity={0.5} strokeWidth={0.6} />
      <ellipse cx={m.X(W / 2)} cy={m.Y(NETBALL_POST_M.ringFromGoalLine)} rx={m.rx(NETBALL_POST_M.ringRadius)} ry={m.ry(NETBALL_POST_M.ringRadius)} fill="none" stroke="#f97316" strokeWidth={1.4} />
    </g>
  );
  return (
    <CourtShell sport="netball" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={1.9} />
      {[third, 2 * third].map((y) => (
        <line key={y} data-third="true" x1={m.X(0)} y1={m.Y(y)} x2={m.X(W)} y2={m.Y(y)} {...Ln} />
      ))}
      <ellipse cx={m.X(W / 2)} cy={m.Y(L / 2)} rx={m.rx(0.45)} ry={m.ry(0.45)} {...Ln} />
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}

/** Waterpolo (World Aquatics WP 1-2; piscinas de competencia 25 × 20 m entre
 *  líneas de gol): agua más allá de la línea de gol; marcas de 2 m (rojo), 5 m
 *  (amarillo, penal), 6 m (amarillo, tiro libre) y media (blanco), en las
 *  corcheras laterales y cruzando el agua; arcos de 3 m. */
export function WaterPoloCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('waterpolo');
  const Ln = lineProps(def.colors.line, 1.4, 0.85);
  const g = GOAL_WIDTH_EXTRA_M.waterpolo;
  const P1 = W / 2 - g / 2;
  const P2 = W / 2 + g / 2;
  const RED = '#ef4444';
  const YELLOW = '#facc15';
  const behind = 1.6; // agua detrás de la línea de gol (≥ 0,30 m reglamentarios)
  const half = (
    <g>
      <line data-goal-line="true" x1={m.X(0)} y1={m.Y(0)} x2={m.X(W)} y2={m.Y(0)} {...Ln} strokeWidth={1.8} />
      <line data-wp-line="2" x1={m.X(0)} y1={m.Y(2)} x2={m.X(W)} y2={m.Y(2)} stroke={RED} strokeOpacity={0.85} strokeWidth={1.4} strokeDasharray="4 4" />
      <line data-wp-line="5" x1={m.X(0)} y1={m.Y(5)} x2={m.X(W)} y2={m.Y(5)} stroke={YELLOW} strokeOpacity={0.9} strokeWidth={1.4} strokeDasharray="4 4" />
      <line data-wp-line="6" x1={m.X(0)} y1={m.Y(6)} x2={m.X(W)} y2={m.Y(6)} stroke={YELLOW} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="1.5 3" />
      {/* Corcheras laterales: rojo hasta 2 m, amarillo hasta 6 m. */}
      {[0, W].map((x) => (
        <g key={x}>
          <line x1={m.X(x)} y1={m.Y(0)} x2={m.X(x)} y2={m.Y(2)} stroke={RED} strokeWidth={3} />
          <line x1={m.X(x)} y1={m.Y(2)} x2={m.X(x)} y2={m.Y(6)} stroke={YELLOW} strokeWidth={3} />
        </g>
      ))}
      <GoalTop m={m} p1={P1} p2={P2} line="#ffffff" />
    </g>
  );
  return (
    <CourtShell sport="waterpolo" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect x={m.X(-0.6)} y={m.Y(-behind)} width={m.X(W + 0.6) - m.X(-0.6)} height={m.Y(L + behind) - m.Y(-behind)} fill={def.colors.court} />
      {/* Reflejos del agua. */}
      <g opacity={0.12}>
        {[0.15, 0.35, 0.55, 0.75, 0.9].map((t) => (
          <path key={t} d={`M ${f.ox} ${f.oy + f.h * t} q ${f.w / 4} -4 ${f.w / 2} 0 t ${f.w / 2} 0`} fill="none" stroke="#ffffff" strokeWidth={1.2} />
        ))}
      </g>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
      <line x1={m.X(0)} y1={m.Y(L / 2)} x2={m.X(W)} y2={m.Y(L / 2)} {...Ln} strokeDasharray="4 4" />
      {[0, W].map((x) => (
        <line key={x} x1={m.X(x)} y1={m.Y(6)} x2={m.X(x)} y2={m.Y(L - 6)} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={3} strokeDasharray="2 2" />
      ))}
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}
