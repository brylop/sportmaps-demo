/**
 * M6d — dibujo de las figuras nuevas: líneas con estilo (pase, conducción,
 * carrera, disparo), zonas rectángulo/elipse/polígono giratorias, foco sobre un
 * jugador, número de movimiento y la leyenda de líneas. SVG puro y sin estado:
 * lo usan la capa de dibujo de la pizarra (con sus áreas de toque encima) y
 * TacticalStaticSvg (PNG/PDF/GIF/video). Una figura vieja NO pasa por acá.
 */
import type { TacticalArrow, TacticalArrowColor } from '@/lib/school/footballQueries';
import { pairsOf } from '@/lib/school/tacticalGeometry';
import { ARROW_COLOR_HEX } from '@/lib/school/tacticalPalette';
import {
  arrowHeadPoints, isLineStyle, LINE_STYLE_LABEL, SPOTLIGHT_R, styledLineGeometry, zoneCenter, zoneFormOf,
  ZONE_FILL_DEFAULT, seqAnchorSvg, type LineStyle,
} from '@/lib/school/tacticalDrawing';

const FONT = 'Helvetica, Arial, sans-serif';
const colorOf = (c: TacticalArrowColor | undefined) => ARROW_COLOR_HEX[c ?? 'white'] ?? ARROW_COLOR_HEX.white;

/** Línea con estilo: sombra oscura debajo (se lee sobre cualquier piso) +
 *  trazo(s) + punta. */
export function StyledLine({ shape, style }: { shape: TacticalArrow; style: LineStyle }) {
  const g = styledLineGeometry(shape, style);
  const color = colorOf(shape.color);
  const shadow = shape.color === 'black' ? '#f8fafc' : '#111827';
  return (
    <g data-shape={shape.type ?? 'arrow'} data-line={style}>
      {g.paths.map((d, k) => (
        <path key={`s${k}`} d={d} stroke={shadow} strokeOpacity={0.35} strokeWidth={g.width + 1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={g.dash} />
      ))}
      {g.paths.map((d, k) => (
        <path key={`p${k}`} d={d} stroke={color} strokeWidth={g.width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={g.dash} />
      ))}
      <polygon points={arrowHeadPoints(g.head.tip, g.head.dir, g.head.size)} fill={color} stroke={shadow} strokeOpacity={0.35} strokeWidth={0.6} />
    </g>
  );
}

/** Zona: rectángulo redondeado / elipse (giran sobre su centro) o polígono. */
export function ZoneShape({ shape }: { shape: TacticalArrow }) {
  const color = colorOf(shape.color);
  const fill = shape.fill ?? ZONE_FILL_DEFAULT;
  const common = { fill: color, fillOpacity: fill, stroke: color, strokeOpacity: 0.75, strokeWidth: 1.3 } as const;
  const form = zoneFormOf(shape);
  if (form === 'polygon') {
    const pts = pairsOf(shape.points).map((p) => `${(p.x * 3).toFixed(2)},${(p.y * 3.4).toFixed(2)}`).join(' ');
    return <polygon data-shape="zone" data-form="polygon" points={pts} strokeLinejoin="round" {...common} />;
  }
  const c = zoneCenter(shape);
  const cx = c.x * 3;
  const cy = c.y * 3.4;
  const w = Math.abs(shape.x2 - shape.x1) * 3;
  const h = Math.abs(shape.y2 - shape.y1) * 3.4;
  const rot = shape.rot ?? 0;
  const transform = rot ? `rotate(${rot} ${cx} ${cy})` : undefined;
  if (form === 'ellipse') {
    return <ellipse data-shape="zone" data-form="ellipse" cx={cx} cy={cy} rx={w / 2} ry={h / 2} transform={transform} {...common} />;
  }
  return <rect data-shape="zone" data-form="rect" x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={5} transform={transform} {...common} />;
}

/** Foco: anillo con resplandor alrededor del jugador. Sin relleno en el centro
 *  a propósito: el número y la cara del jugador se siguen viendo. */
export function Spotlight({ shape }: { shape: TacticalArrow }) {
  const color = shape.color && shape.color !== 'white' ? colorOf(shape.color) : '#fde047';
  const r = SPOTLIGHT_R * (shape.size ?? 1);
  const cx = shape.x1 * 3;
  const cy = shape.y1 * 3.4;
  return (
    <g data-shape="spotlight">
      {/* Resplandor + anillo, pegados al disco: no tapan la etiqueta del jugador. */}
      <circle cx={cx} cy={cy} r={r + 1.5} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2.2} />
      <circle cx={cx} cy={cy} r={r + 4.5} fill="none" stroke={color} strokeOpacity={0.75} strokeWidth={0.9} strokeDasharray="2.5 3" />
    </g>
  );
}

/** Figura con algún campo de M6d (ver isM6dShape). */
export function M6dShape({ shape }: { shape: TacticalArrow }) {
  if (shape.type === 'spotlight') return <Spotlight shape={shape} />;
  if (shape.type === 'zone') return <ZoneShape shape={shape} />;
  if (isLineStyle(shape.line)) return <StyledLine shape={shape} style={shape.line} />;
  return null;
}

/** Número del movimiento (1, 2, 3…). `upright` = giro que lo endereza cuando
 *  la cancha se exporta horizontal. */
export function SeqBadge({ shape, upright = 0 }: { shape: TacticalArrow; upright?: number }) {
  if (typeof shape.seq !== 'number') return null;
  const a = seqAnchorSvg(shape);
  const color = colorOf(shape.color);
  const text = String(shape.seq);
  return (
    <g data-seq={shape.seq} transform={upright ? `rotate(${upright} ${a.x} ${a.y})` : undefined}>
      <circle cx={a.x} cy={a.y} r={5.4} fill="#111827" stroke={color} strokeWidth={1.3} />
      <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={text.length > 1 ? 5.6 : 6.8} fontWeight={900} fontFamily={FONT} fill="#ffffff">
        {text}
      </text>
    </g>
  );
}

/** Muestra de cada estilo (para la leyenda y los botones de la paleta). */
export function LineSample({ style, x, y, w, color = '#f8fafc' }: { style: LineStyle; x: number; y: number; w: number; color?: string }) {
  const sample: TacticalArrow = { type: 'arrow', x1: x / 3, y1: y / 3.4, x2: (x + w) / 3, y2: y / 3.4, line: style };
  const g = styledLineGeometry(sample, style);
  return (
    <g>
      {g.paths.map((d, k) => (
        <path key={k} d={d} stroke={color} strokeWidth={g.width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={g.dash} />
      ))}
      <polygon points={arrowHeadPoints(g.head.tip, g.head.dir, g.head.size)} fill={color} />
    </g>
  );
}

/** Leyenda de líneas dentro del SVG (esquina inferior izquierda de lo que se
 *  ve). Solo los estilos que la jugada usa. */
export function LineLegendSvg({ styles, x, y }: { styles: LineStyle[]; x: number; y: number }) {
  if (styles.length === 0) return null;
  const rowH = 9;
  const boxW = 74;
  const boxH = styles.length * rowH + 6;
  return (
    <g data-legend="lines" transform={`translate(${x} ${y - boxH})`}>
      <rect x={0} y={0} width={boxW} height={boxH} rx={3} fill="#0f172a" fillOpacity={0.78} />
      {styles.map((s, i) => (
        <g key={s}>
          <LineSample style={s} x={4} y={7.5 + i * rowH} w={22} />
          <text x={31} y={7.5 + i * rowH} dominantBaseline="central" fontSize={5.6} fontWeight={700} fontFamily={FONT} fill="#f8fafc">
            {LINE_STYLE_LABEL[s]}
          </text>
        </g>
      ))}
    </g>
  );
}
