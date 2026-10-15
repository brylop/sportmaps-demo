/**
 * Render ESTÁTICO de una jugada de la pizarra táctica: cancha + figuras +
 * jugadores en UN solo <svg>, sin estado, sin handlers, sin dnd-kit.
 * Spec docs/specs/rediseno-seguimiento-deportivo.md (F2): base de miniaturas,
 * del PDF del mesociclo (F3) y del modo "ver".
 *
 * El dibujo de las figuras es el MISMO de la capa de dibujo de TacticalBoard
 * (ArrowLayer) sin los handles de selección ni las áreas de toque: mismos
 * colores (ARROW_COLOR_HEX), misma geometría (tacticalGeometry) y mismos
 * glifos (tacticalGlyphs). Si cambia el dibujo allá, cambiarlo acá también.
 *
 * Coordenadas: todo lo guardado está en % de cancha (0-100); el viewBox es
 * 300×340, así que x*3 e y*3.4 (igual que FootballPitchBackground y ArrowLayer).
 *
 * Autocontenido a propósito (xmlns, tamaños en atributos, sin clases de
 * Tailwind que importen): se puede serializar con renderToStaticMarkup y
 * pintar en un <canvas> para sacar un PNG.
 */
import type { TacticalArrow, TacticalArrowColor } from '@/lib/school/footballQueries';
import {
  BALL_PATH_BEND,
  curveControlPoint,
  hydrateShape,
  isPointShape,
  pairsOf,
  smoothPathD,
  type ArrowPoint,
} from '@/lib/school/tacticalGeometry';
import { ARROW_COLOR_HEX, isGoalkeeperLabel } from '@/lib/school/tacticalPalette';
import type { TacticalSport } from '@/lib/school/tacticalSports';
import { CourtBackground } from './courts/CourtBackground';
import { BallGlyph, ObjectIcon } from './tacticalGlyphs';
import { isM6dShape, lineStylesIn } from '@/lib/school/tacticalDrawing';
import { courtShapeOf, drawableShapes, H_MATRIX, inkForSurface, mapBoardPoint, staticViewBox, type CourtConfig } from '@/lib/school/tacticalCourt';
import { LineLegendSvg, M6dShape, SeqBadge } from './tacticalM6dShapes';

export interface TacticalStaticPlayer {
  x: number;
  y: number;
  label?: string;
  jersey?: number | null;
  role?: 'starter' | 'bench';
}

export interface TacticalStaticSvgProps {
  players: TacticalStaticPlayer[];
  arrows: TacticalArrow[];
  /** Ancho en px del <svg> (el alto sale de la proporción 300×340). */
  width?: number;
  className?: string;
  /** Deporte de la cancha de fondo (T4). Sin `sport` o 'futbol' = la cancha de
   *  fútbol 11 de siempre (salida idéntica). Las coordenadas guardadas no
   *  dependen del deporte: todas las canchas usan el mismo viewBox 300×340. */
  sport?: TacticalSport | null;
  /** M6d: dibujar la leyenda de líneas cuando la jugada usa estilos (default sí). */
  legend?: boolean;
}

const VIEW_W = 300;
const VIEW_H = 340;
/** Mismo TEXT_FONT de TacticalBoard (no se exporta desde allá). */
const TEXT_FONT = 9;
/** Radio del disco de jugador en unidades del viewBox: el pin del tablero mide
 *  44px sobre una cancha de ~580px de ancho → ~22,7 u de diámetro. */
const PIN_R = 11;

const toSvg = (p: ArrowPoint) => ({ x: p.x * 3, y: p.y * 3.4 });

function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** M6d: cualquier figura. Las viejas van por renderShape, intactas; las que
 *  usan campos nuevos, por M6dShape. La pseudo-figura `court` no se dibuja. */
function renderAny(raw: TacticalArrow, i: number, upright = 0) {
  if (raw?.type === 'court') return null;
  const s = hydrateShape(raw);
  const body = isM6dShape(s) ? <g key={i}><M6dShape shape={s} /></g> : renderShape(raw, i, upright);
  if (typeof s.seq !== 'number') return body;
  return <g key={i}>{body}<SeqBadge shape={s} upright={upright} /></g>;
}

function renderShape(raw: TacticalArrow, i: number, upright = 0) {
  const s = hydrateShape(raw);
  const p1 = toSvg({ x: s.x1, y: s.y1 });
  const p2 = toSvg({ x: s.x2, y: s.y2 });
  const colorKey: TacticalArrowColor = s.color ?? 'white';
  const color = ARROW_COLOR_HEX[colorKey] ?? ARROW_COLOR_HEX.white;
  const marker = `url(#arrowhead-${colorKey})`;
  const type = s.type ?? 'arrow';

  if (type === 'freehand') {
    const d = smoothPathD(pairsOf(s.points).map(toSvg));
    if (!d) return null;
    return (
      <g key={i} data-shape="freehand">
        <path d={d} stroke="#111827" strokeOpacity={0.35} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (type === 'text') {
    const size = s.size ?? 1;
    const rot = s.rot ?? 0;
    const fs = TEXT_FONT * size;
    return (
      <g key={i} data-shape="text" transform={`rotate(${rot + upright} ${p1.x} ${p1.y})`}>
        <text x={p1.x} y={p1.y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={800}
          fontFamily="Helvetica, Arial, sans-serif"
          fill={color} stroke={s.color === 'black' ? '#f8fafc' : '#111827'} strokeWidth={fs * 0.22} strokeLinejoin="round" paintOrder="stroke">
          {s.text ?? ''}
        </text>
      </g>
    );
  }

  if (isPointShape(type)) {
    return (
      <g key={i} data-shape={type}>
        <ObjectIcon type={type} x={p1.x} y={p1.y} size={s.size ?? 1} rot={s.rot ?? 0} color={s.color} pinStyle="disc" />
      </g>
    );
  }

  if (type === 'ball_path') {
    const kind = s.kind ?? 'pase';
    const lofted = kind !== 'pase';
    const c = lofted ? curveControlPoint(p1, p2, BALL_PATH_BEND) : null;
    const d = c ? `M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}` : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    return (
      <g key={i} data-shape="ball_path">
        <path d={d} stroke="#111827" strokeOpacity={0.35} strokeWidth={3.6} fill="none" strokeLinecap="round" />
        <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round"
          strokeDasharray={lofted ? '2.5 3.5' : '5 3'}
          markerEnd={kind === 'pase' ? marker : undefined} />
        <g transform={`translate(${p1.x} ${p1.y})`}><BallGlyph r={3.6} /></g>
        {lofted && (
          <g>
            <circle cx={p2.x} cy={p2.y} r={4.5} fill="none" stroke={color} strokeWidth={1.6} />
            <circle cx={p2.x} cy={p2.y} r={1.3} fill={color} />
            {kind === 'penal' && (
              <text x={p2.x} y={p2.y - 7} textAnchor="middle" fontSize={7} fontWeight={800} fontFamily="Helvetica, Arial, sans-serif"
                fill={color} stroke="#111827" strokeWidth={0.5} paintOrder="stroke">P</text>
            )}
          </g>
        )}
      </g>
    );
  }

  if (type === 'zone') {
    return (
      <rect key={i} data-shape="zone"
        x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)}
        width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)}
        rx={5} fill={color} fillOpacity={0.14} stroke={color} strokeOpacity={0.7} strokeWidth={1.2}
      />
    );
  }

  if (type === 'curve') {
    const c = curveControlPoint(p1, p2);
    return (
      <path key={i} data-shape="curve" d={`M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`} stroke={color} strokeWidth={2} fill="none"
        strokeLinecap="round" markerEnd={marker} />
    );
  }

  return (
    <line key={i} data-shape="arrow" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} strokeLinecap="round"
      markerEnd={marker} />
  );
}

function renderPlayer(p: TacticalStaticPlayer, i: number, court?: CourtConfig) {
  // M6d: en horizontal el jugador se ubica girado pero se dibuja derecho.
  const m = court ? mapBoardPoint(court, Number(p.x) * 3, Number(p.y) * 3.4) : null;
  const x = m ? m.x : Number(p.x) * 3;
  const y = m ? m.y : Number(p.y) * 3.4;
  const label = (p.label ?? '').trim();
  const text = p.jersey != null && String(p.jersey) !== '' ? String(p.jersey) : initialsOf(label);
  const isGK = !!label && isGoalkeeperLabel(label);
  const fill = isGK ? '#eab308' : '#10b981';
  const labelW = Math.min(44, Math.max(14, label.length * 3.1 + 6));
  return (
    <g key={`p${i}`} data-player="true">
      <circle cx={x} cy={y + 1.2} r={PIN_R} fill="#000" opacity={0.35} />
      <circle cx={x} cy={y} r={PIN_R} fill={fill} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.6} />
      {text && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={text.length > 2 ? 7 : 8.5} fontWeight={900}
          fontFamily="Helvetica, Arial, sans-serif" fill="#ffffff">
          {text}
        </text>
      )}
      {label && (
        <g>
          <rect x={x - labelW / 2} y={y + PIN_R + 1.5} width={labelW} height={7.5} rx={3.75} fill="#000" fillOpacity={0.55} />
          <text x={x} y={y + PIN_R + 5.25} textAnchor="middle" dominantBaseline="central" fontSize={5.2} fontWeight={700}
            fontFamily="Helvetica, Arial, sans-serif" fill="#ffffff">
            {label.length > 14 ? `${label.slice(0, 13)}…` : label}
          </text>
        </g>
      )}
    </g>
  );
}

export function TacticalStaticSvg({ players, arrows, width = 300, className, sport, legend = true }: TacticalStaticSvgProps) {
  const starters = (players || []).filter(
    (p) => p.role !== 'bench' && p.x != null && p.y != null && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)),
  );
  const courtShape = courtShapeOf(arrows);
  const styles = legend ? lineStylesIn(arrows || []) : [];
  if (courtShape?.court || styles.length > 0) {
    return <ConfiguredStaticSvg players={starters} arrows={arrows || []} width={width} className={className} sport={sport} court={courtShape?.court ?? {}} styles={styles} />;
  }
  const height = Math.round((width * VIEW_H) / VIEW_W);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Jugada táctica"
    >
      {/* La cancha es un <svg> propio: anidado, ocupa el 100% del padre. */}
      <CourtBackground sport={sport} />
      <defs>
        {(Object.keys(ARROW_COLOR_HEX) as TacticalArrowColor[]).map((c) => (
          <marker key={c} id={`arrowhead-${c}`} markerWidth="5.5" markerHeight="5.5" refX="4" refY="2.75" orient="auto">
            <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill={ARROW_COLOR_HEX[c]} />
          </marker>
        ))}
        {/* Red del arco: ObjectIcon la referencia como url(#tb-net). */}
        <pattern id="tb-net" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L2.6 2.6 M2.6 0 L0 2.6" stroke="#f8fafc" strokeOpacity={0.6} strokeWidth={0.35} />
        </pattern>
      </defs>
      {/* Mismo orden de capas que el tablero: la capa de dibujo (z-40) va
          ENCIMA de los pines de jugador (z-10), así una flecha que sale de un
          jugador se ve completa. */}
      <g data-layer="players">{starters.map((p, i) => renderPlayer(p, i))}</g>
      <g data-layer="shapes">{(arrows || []).map((a, i) => renderAny(a, i))}</g>
    </svg>
  );
}

/** Altura en px del render estático para un ancho dado (la cámara y la
 *  orientación del «Campo» cambian la proporción). */
export function staticSvgHeight(arrows: TacticalArrow[] | null | undefined, width: number): number {
  const vb = staticViewBox(courtShapeOf(arrows)?.court ?? {});
  return Math.round((width * vb.h) / vb.w);
}

function SvgDefs() {
  return (
    <defs>
      {(Object.keys(ARROW_COLOR_HEX) as TacticalArrowColor[]).map((c) => (
        <marker key={c} id={`arrowhead-${c}`} markerWidth="5.5" markerHeight="5.5" refX="4" refY="2.75" orient="auto">
          <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill={ARROW_COLOR_HEX[c]} />
        </marker>
      ))}
      <pattern id="tb-net" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
        <path d="M0 0 L2.6 2.6 M2.6 0 L0 2.6" stroke="#f8fafc" strokeOpacity={0.6} strokeWidth={0.35} />
      </pattern>
    </defs>
  );
}

/** M6d: jugada con «Campo» (cámara, orientación, piso, plantilla) o con
 *  estilos de línea (leyenda). Mismo dibujo de figuras y jugadores; cambian el
 *  viewBox, el giro y el fondo. */
function ConfiguredStaticSvg({ players, arrows, width, className, sport, court, styles }: {
  players: TacticalStaticPlayer[]; arrows: TacticalArrow[]; width: number; className?: string;
  sport?: TacticalSport | null; court: CourtConfig; styles: ReturnType<typeof lineStylesIn>;
}) {
  const vb = staticViewBox(court);
  const height = Math.round((width * vb.h) / vb.w);
  const horizontal = court.orient === 'h';
  const shapes = inkForSurface(court, drawableShapes(arrows));
  // La cancha, a tamaño completo (300×340) en su propio <svg>: el padre puede
  // mirar solo una ventana y el fondo anidado tiene que seguir midiendo lo mismo.
  const pitch = (
    <svg x={0} y={0} width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <CourtBackground sport={sport} court={court} />
    </svg>
  );
  const shapeLayer = <g data-layer="shapes">{shapes.map((a, i) => renderAny(a, i, horizontal ? -90 : 0))}</g>;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Jugada táctica"
      data-orient={horizontal ? 'h' : 'v'}
      data-camera={court.cam ?? 'full'}
    >
      {horizontal ? <g transform={H_MATRIX}>{pitch}</g> : pitch}
      <SvgDefs />
      <g data-layer="players">{players.map((p, i) => renderPlayer(p, i, horizontal ? court : undefined))}</g>
      {horizontal ? <g transform={H_MATRIX}>{shapeLayer}</g> : shapeLayer}
      <LineLegendSvg styles={styles} x={vb.x + 5} y={vb.y + vb.h - 5} />
    </svg>
  );
}
