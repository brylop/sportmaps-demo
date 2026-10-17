/**
 * Canchas grandes de pasto (M6f, docs/specs/pizarra-m6-paridad-tacticalpad.md
 * §4): rugby, fútbol americano, hockey sobre césped y ultimate. Medidas
 * oficiales y fuentes en COURT_METERS (tacticalSports.ts), H_POSTS_M y
 * GOAL_WIDTH_EXTRA_M (courtGeometry.ts).
 *
 * Igual que el resto: `y` se mide desde el fondo de ARRIBA (rival) y la mitad
 * de abajo se dibuja girando 180° la de arriba (MIRROR). La línea exterior
 * lleva `data-outline` (las pruebas miden con eso la proporción real).
 */
import { useCourtInk } from './courtLook';
import { CourtShell, GoalTop, Spot } from './CourtShell';
import { GOAL_WIDTH_EXTRA_M, H_POSTS_M, MIRROR, courtOf, dAreaPath, lineProps, type CourtBackgroundProps, type Meters } from './courtGeometry';

/** Palos en H vistos desde arriba: travesaño y los dos postes (`y` = línea
 *  donde están). */
function HPostsTop({ m, cx, y, width }: { m: Meters; cx: number; y: number; width: number }) {
  return (
    <g data-posts="true">
      <line x1={m.X(cx - width / 2)} y1={m.Y(y)} x2={m.X(cx + width / 2)} y2={m.Y(y)} stroke="#f8fafc" strokeWidth={2} />
      {[cx - width / 2, cx + width / 2].map((x) => (
        <circle key={x} cx={m.X(x)} cy={m.Y(y)} r={2.2} fill="#f8fafc" stroke="#111827" strokeOpacity={0.5} strokeWidth={0.7} />
      ))}
    </g>
  );
}

/** Rugby (World Rugby Law 1): 70 m de ancho; líneas de ensayo a 10 m de las de
 *  balón muerto (in-goal) y 100 m entre ellas; líneas de 22 m (sólidas), de
 *  10 m (discontinuas) y media; discontinuas a 5 y 15 m de las laterales y a
 *  5 m de las de ensayo; palos en H sobre la línea de ensayo. XV y 7s usan
 *  la misma cancha. */
export function RugbyCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('rugby');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.5, 0.9);
  const ig = H_POSTS_M.rugby.lineFromEnd; // in-goal
  const mid = L / 2;
  const half = (
    <g>
      <rect x={m.X(0)} y={m.Y(0)} width={m.X(W) - m.X(0)} height={m.Y(ig) - m.Y(0)} fill="#ffffff" fillOpacity={0.07} />
      <line x1={m.X(0)} y1={m.Y(ig)} x2={m.X(W)} y2={m.Y(ig)} {...Ln} strokeWidth={1.8} />
      <line x1={m.X(0)} y1={m.Y(ig + 22)} x2={m.X(W)} y2={m.Y(ig + 22)} {...Ln} />
      <line x1={m.X(0)} y1={m.Y(mid - 10)} x2={m.X(W)} y2={m.Y(mid - 10)} {...Ln} strokeDasharray="5 4" />
      {/* Marcas a 5 m de la línea de ensayo (frente a las líneas de 5 y 15 m y a los palos). */}
      {[5, 15, W / 2, W - 15, W - 5].map((x) => (
        <line key={x} x1={m.X(x - 1)} y1={m.Y(ig + 5)} x2={m.X(x + 1)} y2={m.Y(ig + 5)} {...Ln} />
      ))}
      <HPostsTop m={m} cx={W / 2} y={ig} width={H_POSTS_M.rugby.width} />
    </g>
  );
  return (
    <CourtShell sport="rugby" frame={f} court={def.colors.court} surround={def.colors.surround} texture="grass" viewBox={viewBox}>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={1.9} />
      <line x1={m.X(0)} y1={m.Y(mid)} x2={m.X(W)} y2={m.Y(mid)} {...Ln} />
      <line x1={m.X(W / 2)} y1={m.Y(mid) - 3} x2={m.X(W / 2)} y2={m.Y(mid) + 3} {...Ln} />
      {/* Discontinuas a 5 y 15 m de las laterales, de 5 m a 5 m de las líneas de ensayo. */}
      {[5, 15, W - 15, W - 5].map((x) => (
        <line key={x} x1={m.X(x)} y1={m.Y(ig + 5)} x2={m.X(x)} y2={m.Y(L - ig - 5)} {...Ln} strokeWidth={1.1} strokeDasharray="4 6" />
      ))}
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}

/** Fútbol americano (NFL Rule 1; NCAA Rule 1 igual salvo las hash marks):
 *  120 × 53⅓ yardas con zonas de anotación de 10 yd, líneas cada 5 yd,
 *  números cada 10, hash marks NFL a 70 ft 9 in (21,56 m) de cada lateral,
 *  marca del punto extra a 2 yd y postes en la línea de fondo. */
export function AmericanFootballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W } = courtOf('futbol_americano');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.3, 0.9);
  const yd = 0.9144;
  const hash = 21.5646; // 70 ft 9 in
  const lines: number[] = [];
  for (let y = 10; y <= 110; y += 5) lines.push(y);
  const hashes: number[] = [];
  for (let y = 11; y < 110; y += 1) if (y % 5 !== 0) hashes.push(y);
  const numbers: [number, string][] = [20, 30, 40, 50, 60, 70, 80, 90, 100].map((y) => [y, String(y <= 60 ? y - 10 : 110 - y)]);
  return (
    <CourtShell sport="futbol_americano" frame={f} court={def.colors.court} surround={def.colors.surround} texture="grass" viewBox={viewBox}>
      {[0, 110].map((y) => (
        <rect key={y} data-endzone="true" x={m.X(0)} y={m.Y(y * yd)} width={m.X(W) - m.X(0)} height={m.Y((y + 10) * yd) - m.Y(y * yd)} fill={ink.accent} fillOpacity={0.55} />
      ))}
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={2} />
      {lines.map((y) => (
        <line key={y} x1={m.X(0)} y1={m.Y(y * yd)} x2={m.X(W)} y2={m.Y(y * yd)} {...Ln} strokeWidth={y === 10 || y === 110 ? 1.8 : y === 60 ? 1.5 : 1} />
      ))}
      <g>
        {hashes.map((y) => [hash, W - hash].map((x) => (
          <line key={`${y}-${x}`} x1={m.X(x - 0.3)} y1={m.Y(y * yd)} x2={m.X(x + 0.3)} y2={m.Y(y * yd)} stroke={ink.line} strokeOpacity={0.75} strokeWidth={0.7} />
        )))}
      </g>
      {numbers.map(([y, n]) => [9.6, W - 9.6].map((x) => (
        <text key={`${y}-${x}`} x={m.X(x)} y={m.Y(y * yd)} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={800}
          fontFamily="Helvetica, Arial, sans-serif" fill={ink.line} fillOpacity={0.8}>
          {n}
        </text>
      )))}
      {/* Punto extra: marca de 1 yd en la yarda 2 de cada zona. */}
      {[12, 108].map((y) => (
        <line key={y} x1={m.X(W / 2 - yd / 2)} y1={m.Y(y * yd)} x2={m.X(W / 2 + yd / 2)} y2={m.Y(y * yd)} {...Ln} />
      ))}
      <HPostsTop m={m} cx={W / 2} y={0} width={H_POSTS_M.futbol_americano.width} />
      <g transform={MIRROR}><HPostsTop m={m} cx={W / 2} y={0} width={H_POSTS_M.futbol_americano.width} /></g>
    </CourtShell>
  );
}

/** Hockey sobre césped (FIH Rules of Hockey, «Field of play»): 91,40 × 55 m;
 *  línea central y de 23 m; área de tiro: cuartos de círculo de 14,63 m desde
 *  cada palo unidos por una recta de 3,66 m; línea discontinua 5 m por fuera;
 *  punto de penal a 6,475 m; arcos de 3,66 m. */
export function FieldHockeyCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('hockey_cesped');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.5, 0.92);
  const g = GOAL_WIDTH_EXTRA_M.hockey_cesped;
  const P1 = W / 2 - g / 2;
  const P2 = W / 2 + g / 2;
  const half = (
    <g>
      <path d={dAreaPath(m, W, P1, P2, 14.63)} {...Ln} />
      <path d={dAreaPath(m, W, P1, P2, 19.63)} {...Ln} strokeWidth={1.1} strokeDasharray="3 5" />
      <line x1={m.X(0)} y1={m.Y(22.9)} x2={m.X(W)} y2={m.Y(22.9)} {...Ln} />
      <Spot cx={m.X(W / 2)} cy={m.Y(6.475)} color={ink.line} r={1.4} />
      <GoalTop m={m} p1={P1} p2={P2} line={ink.line} />
    </g>
  );
  return (
    <CourtShell sport="hockey_cesped" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={1.9} />
      <line x1={m.X(0)} y1={m.Y(L / 2)} x2={m.X(W)} y2={m.Y(L / 2)} {...Ln} />
      {half}
      <g transform={MIRROR}>{half}</g>
    </CourtShell>
  );
}

/** Ultimate (WFDF Rules 2025-2028, Apéndice A): 100 × 37 m; zona central de
 *  64 m y zonas de anotación de 18 m; brick marks (cruces de 1 m) a 18 m de
 *  cada línea de gol, al centro; conos en las esquinas. */
export function UltimateCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('ultimate');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.5, 0.9);
  const ez = 18;
  const cones: [number, number][] = [];
  for (const y of [0, ez, L - ez, L]) for (const x of [0, W]) cones.push([x, y]);
  return (
    <CourtShell sport="ultimate" frame={f} court={def.colors.court} surround={def.colors.surround} texture="grass" viewBox={viewBox}>
      {[0, L - ez].map((y) => (
        <rect key={y} x={m.X(0)} y={m.Y(y)} width={m.X(W) - m.X(0)} height={m.Y(y + ez) - m.Y(y)} fill="#ffffff" fillOpacity={0.08} />
      ))}
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={1.8} />
      {[ez, L - ez].map((y) => (
        <line key={y} data-goal-line="true" x1={m.X(0)} y1={m.Y(y)} x2={m.X(W)} y2={m.Y(y)} {...Ln} />
      ))}
      {[ez + 18, L - ez - 18].map((y) => (
        <g key={y} data-brick="true">
          <line x1={m.X(W / 2 - 0.5)} y1={m.Y(y - 0.5)} x2={m.X(W / 2 + 0.5)} y2={m.Y(y + 0.5)} {...Ln} />
          <line x1={m.X(W / 2 + 0.5)} y1={m.Y(y - 0.5)} x2={m.X(W / 2 - 0.5)} y2={m.Y(y + 0.5)} {...Ln} />
        </g>
      ))}
      {cones.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={m.X(x)} cy={m.Y(y)} r={2} fill="#f97316" stroke="#ffffff" strokeWidth={0.6} />
      ))}
    </CourtShell>
  );
}
