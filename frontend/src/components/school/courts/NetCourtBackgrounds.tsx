/**
 * Canchas de red (M6f, docs/specs/pizarra-m6-paridad-tacticalpad.md §4):
 * tenis, pádel, bádminton y vóley playa. Medidas oficiales y fuentes en
 * COURT_METERS (tacticalSports.ts) y NET_M (courtGeometry.ts).
 *
 * Igual que el voleibol: la red cruza el medio de la cancha y la mitad propia
 * es la de abajo. Todas llevan `data-outline` en la línea exterior (las
 * pruebas miden con eso la proporción real).
 */
import { useCourtInk } from './courtLook';
import { CourtShell } from './CourtShell';
import { NET_M, courtOf, lineProps, type CourtBackgroundProps, type Meters } from './courtGeometry';

/** Red vista desde arriba: sombra, malla, faja y postes por fuera de la banda. */
export function NetAcross({ m, widthM, y, postOutside, antennas = false }: { m: Meters; widthM: number; y: number; postOutside: number; antennas?: boolean }) {
  const x0 = m.X(-postOutside);
  const x1 = m.X(widthM + postOutside);
  const yy = m.Y(y);
  return (
    <g data-net="true">
      <line x1={x0} y1={yy + 1.2} x2={x1} y2={yy + 1.2} stroke="#000000" strokeOpacity={0.35} strokeWidth={3.2} />
      <line x1={x0} y1={yy} x2={x1} y2={yy} stroke="#f8fafc" strokeWidth={2.6} strokeDasharray="1.2 1.2" />
      <line x1={x0} y1={yy - 1.3} x2={x1} y2={yy - 1.3} stroke="#f8fafc" strokeWidth={1} />
      {[-postOutside, widthM + postOutside].map((x) => (
        <circle key={x} data-net-post="true" cx={m.X(x)} cy={yy} r={2.6} fill="#e5e7eb" stroke="#111827" strokeOpacity={0.5} strokeWidth={0.8} />
      ))}
      {antennas && [0, widthM].map((x) => (
        <circle key={`a${x}`} cx={m.X(x)} cy={yy} r={1.6} fill="#ef4444" stroke="#ffffff" strokeWidth={0.7} />
      ))}
    </g>
  );
}

/** Tenis (ITF Rule 1): dobles 10,97 × 23,77 m, bandas de individuales a
 *  1,37 m, líneas de saque a 6,40 m de la red, línea central de saque y
 *  marca central de 10 cm en cada fondo. */
export function TennisCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('tenis');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.6, 0.95);
  const net = L / 2;
  const alley = 1.37;
  const service = 6.4;
  const net_ = NET_M.tenis;
  return (
    <CourtShell sport="tenis" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={1.9} />
      {[alley, W - alley].map((x) => (
        <line key={x} x1={m.X(x)} y1={m.Y(0)} x2={m.X(x)} y2={m.Y(L)} {...Ln} />
      ))}
      {[net - service, net + service].map((y) => (
        <line key={y} x1={m.X(alley)} y1={m.Y(y)} x2={m.X(W - alley)} y2={m.Y(y)} {...Ln} />
      ))}
      <line x1={m.X(W / 2)} y1={m.Y(net - service)} x2={m.X(W / 2)} y2={m.Y(net + service)} {...Ln} />
      {/* Marca central de los fondos (10 cm hacia adentro, se dibuja un poco más larga para que se vea). */}
      <line x1={m.X(W / 2)} y1={m.Y(0)} x2={m.X(W / 2)} y2={m.Y(0) + 4} {...Ln} />
      <line x1={m.X(W / 2)} y1={m.Y(L)} x2={m.X(W / 2)} y2={m.Y(L) - 4} {...Ln} />
      <NetAcross m={m} widthM={W} y={net} postOutside={net_.postOutside} />
    </CourtShell>
  );
}

/** Pádel (FIP): 10 × 20 m interiores; líneas de saque a 6,95 m de la red;
 *  línea central de saque que pasa 20 cm la de saque. Paredes: fondo de
 *  vidrio y, en los laterales, 4 m de vidrio desde cada fondo y malla en el
 *  resto. Red de 0,88 m con postes en las paredes. */
export function PadelCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('padel');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.6, 0.95);
  const net = L / 2;
  const service = 6.95;
  const wall = 4; // grosor dibujado de la pared (unidades del viewBox)
  const glass = '#a5f3fc';
  const mesh = '#94a3b8';
  return (
    <CourtShell sport="padel" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      {/* Paredes: vidrio en los fondos y en los 4 m laterales; malla en el medio. */}
      <g data-walls="true">
        {[m.Y(0) - wall / 2, m.Y(L) + wall / 2].map((y) => (
          <line key={y} x1={m.X(0) - wall} y1={y} x2={m.X(W) + wall} y2={y} stroke={glass} strokeOpacity={0.85} strokeWidth={wall} />
        ))}
        {[m.X(0) - wall / 2, m.X(W) + wall / 2].map((x) => (
          <g key={x}>
            <line x1={x} y1={m.Y(0)} x2={x} y2={m.Y(4)} stroke={glass} strokeOpacity={0.85} strokeWidth={wall} />
            <line x1={x} y1={m.Y(L - 4)} x2={x} y2={m.Y(L)} stroke={glass} strokeOpacity={0.85} strokeWidth={wall} />
            <line x1={x} y1={m.Y(4)} x2={x} y2={m.Y(L - 4)} stroke={mesh} strokeWidth={wall} strokeDasharray="1.5 1.5" />
          </g>
        ))}
      </g>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeOpacity={0.4} strokeWidth={1} />
      {[net - service, net + service].map((y) => (
        <line key={y} x1={m.X(0)} y1={m.Y(y)} x2={m.X(W)} y2={m.Y(y)} {...Ln} />
      ))}
      <line x1={m.X(W / 2)} y1={m.Y(net - service - 0.2)} x2={m.X(W / 2)} y2={m.Y(net + service + 0.2)} {...Ln} />
      <NetAcross m={m} widthM={W} y={net} postOutside={NET_M.padel.postOutside} />
    </CourtShell>
  );
}

/** Bádminton (BWF Law 1): dobles 6,10 × 13,40 m; bandas de individuales a
 *  0,46 m; línea de saque corto a 1,98 m de la red; línea de saque largo de
 *  dobles a 0,76 m del fondo; línea central. */
export function BadmintonCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('badminton');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 1.5, 0.95);
  const net = L / 2;
  const shortS = 1.98;
  const longD = 0.76;
  const single = 0.46;
  return (
    <CourtShell sport="badminton" frame={f} court={def.colors.court} surround={def.colors.surround} texture="wood" viewBox={viewBox}>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} strokeWidth={1.8} />
      {[single, W - single].map((x) => (
        <line key={x} x1={m.X(x)} y1={m.Y(0)} x2={m.X(x)} y2={m.Y(L)} {...Ln} />
      ))}
      {[net - shortS, net + shortS, longD, L - longD].map((y) => (
        <line key={y} x1={m.X(0)} y1={m.Y(y)} x2={m.X(W)} y2={m.Y(y)} {...Ln} />
      ))}
      <line x1={m.X(W / 2)} y1={m.Y(0)} x2={m.X(W / 2)} y2={m.Y(net - shortS)} {...Ln} />
      <line x1={m.X(W / 2)} y1={m.Y(net + shortS)} x2={m.X(W / 2)} y2={m.Y(L)} {...Ln} />
      <NetAcross m={m} widthM={W} y={net} postOutside={NET_M.badminton.postOutside} />
    </CourtShell>
  );
}

/** Vóley playa (FIVB Beach Rules 1): 8 × 16 m de arena, sin línea central
 *  ni de ataque; cintas azules; red con antenas sobre las bandas y postes a
 *  1 m por fuera. Zona libre de 5 m alrededor (lo que entra del tablero). */
export function BeachVolleyballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  const { def, f, m, W, L } = courtOf('voley_playa');
  // M6d: los colores de líneas del «Campo» (sin elegir nada = los del deporte).
  const ink = useCourtInk(def.colors);
  const Ln = lineProps(ink.line, 2.4, 0.95);
  // Granos de arena: puntos fijos (sin azar, el dibujo debe ser estable).
  const grains: [number, number][] = [];
  for (let i = 0; i < 90; i += 1) grains.push([(i * 73) % 300, (i * 131) % 340]);
  return (
    <CourtShell sport="voley_playa" frame={f} court={def.colors.court} surround={def.colors.surround} viewBox={viewBox}>
      <g opacity={0.25}>
        {grains.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={0.7} fill="#8a6a2f" />)}
      </g>
      <rect data-outline="true" x={f.ox} y={f.oy} width={f.w} height={f.h} {...Ln} />
      <NetAcross m={m} widthM={W} y={L / 2} postOutside={NET_M.voley_playa.postOutside} antennas />
    </CourtShell>
  );
}
