/**
 * M6d — piezas interactivas de la capa de dibujo de la pizarra para las
 * figuras nuevas (líneas con estilo, zonas con forma, foco) y el polígono en
 * construcción. ArrowLayer (TacticalBoard.tsx) solo delega acá: el dibujo es el
 * mismo de TacticalStaticSvg (tacticalM6dShapes) con áreas de toque encima.
 *
 * Gestos (mismos que el material):
 *  - Línea con estilo: los dos extremos se arrastran; tocar la línea la borra
 *    (igual que una flecha de siempre).
 *  - Zona: tocar el BORDE la selecciona (el relleno no captura toques, para no
 *    tapar a los jugadores). Seleccionada: mover (centro), escalar (esquina),
 *    girar (rect/elipse), mover vértices (polígono) y quitar (×).
 *  - Foco: arrastrar lo mueve; tocar lo selecciona (tamaño en «Objeto», ×).
 */
import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import { pairsOf, type ArrowPoint } from '@/lib/school/tacticalGeometry';
import { ARROW_COLOR_HEX } from '@/lib/school/tacticalPalette';
import {
  isLineStyle, LINE_STYLE_LABEL, moveVertex, moveZone, rotateAround, SPOTLIGHT_R, zoneCenter, zoneFormOf, type LineStyle,
} from '@/lib/school/tacticalDrawing';
import { LineSample, M6dShape, SeqBadge, StyledLine } from './tacticalM6dShapes';

type Patch = Partial<TacticalArrow>;
const toSvg = (p: ArrowPoint) => ({ x: p.x * 3, y: p.y * 3.4 });
const clamp01 = (n: number) => Math.min(100, Math.max(0, Math.round(n * 100) / 100));

type Drag =
  | { kind: 'move'; start: ArrowPoint; orig: TacticalArrow; moved: boolean }
  | { kind: 'scale'; orig: TacticalArrow }
  | { kind: 'rotate'; orig: TacticalArrow }
  | { kind: 'vertex'; vertex: number }
  | { kind: 'point'; moved: boolean };

export function InteractiveM6dShape({
  shape, index, selected, pe, readOnly, toPct, onUpdate, onSelect, onDelete, endHandles,
}: {
  shape: TacticalArrow;
  index: number;
  selected: boolean;
  /** Clase de pointer-events que ArrowLayer decide para esta figura. */
  pe: string;
  readOnly: boolean;
  toPct: (e: { clientX: number; clientY: number }) => ArrowPoint | null;
  onUpdate: (index: number, patch: Patch) => void;
  onSelect: (index: number | null) => void;
  onDelete: (index: number) => void;
  /** Handles de extremos de ArrowLayer (los mismos de flecha/curva). */
  endHandles: (index: number, p1: ArrowPoint, p2: ArrowPoint, color: string) => ReactNode;
}) {
  const drag = useRef<Drag | null>(null);
  const color = ARROW_COLOR_HEX[shape.color ?? 'white'] ?? ARROW_COLOR_HEX.white;

  const begin = (d: Drag) => (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = d;
  };
  const onMove = (e: ReactPointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toPct(e);
    if (!p) return;
    if (d.kind === 'move') {
      d.moved = true;
      onUpdate(index, moveZone(d.orig, p.x - d.start.x, p.y - d.start.y));
    } else if (d.kind === 'point') {
      d.moved = true;
      onUpdate(index, { x1: clamp01(p.x), y1: clamp01(p.y), x2: clamp01(p.x), y2: clamp01(p.y) });
    } else if (d.kind === 'vertex') {
      onUpdate(index, moveVertex(shape, d.vertex, p));
    } else if (d.kind === 'scale') {
      // Escala simétrica sobre el centro: el puntero se lleva al marco sin
      // girar de la zona, así una zona girada escala a lo largo de sus lados.
      const c = zoneCenter(d.orig);
      const local = rotateAround(toSvg(p), toSvg(c), -(d.orig.rot ?? 0));
      const hw = Math.max(2, Math.abs(local.x - c.x * 3) / 3);
      const hh = Math.max(2, Math.abs(local.y - c.y * 3.4) / 3.4);
      onUpdate(index, { x1: clamp01(c.x - hw), y1: clamp01(c.y - hh), x2: clamp01(c.x + hw), y2: clamp01(c.y + hh) });
    } else if (d.kind === 'rotate') {
      const c = toSvg(zoneCenter(d.orig));
      const sp = toSvg(p);
      const deg = (Math.atan2(sp.y - c.y, sp.x - c.x) * 180) / Math.PI + 90;
      onUpdate(index, { rot: Math.round(((deg % 360) + 360) % 360) });
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    // Un toque sin arrastre sobre el foco = seleccionar / deseleccionar.
    if (d?.kind === 'point' && !d.moved) onSelect(selected ? null : index);
  };
  const handlers = { onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: () => { drag.current = null; } };

  if (shape.type === 'spotlight') {
    const c = toSvg({ x: shape.x1, y: shape.y1 });
    const r = SPOTLIGHT_R * (shape.size ?? 1);
    return (
      <g data-m6d="spotlight">
        <g className="pointer-events-none"><M6dShape shape={shape} /></g>
        {!readOnly && (
          <circle cx={c.x} cy={c.y} r={r + 3} fill="none" stroke="transparent" strokeWidth={8} pointerEvents={pe === 'pointer-events-auto' ? 'stroke' : 'none'}
            className="cursor-grab touch-none" onPointerDown={begin({ kind: 'point', moved: false })} {...handlers} />
        )}
        {selected && !readOnly && <DeleteButton x={c.x + r * 0.75} y={c.y - r * 0.75 - 4} pe={pe} onDelete={() => onDelete(index)} />}
      </g>
    );
  }

  if (shape.type === 'zone') {
    const form = zoneFormOf(shape);
    const c = toSvg(zoneCenter(shape));
    const rot = shape.rot ?? 0;
    const w = Math.abs(shape.x2 - shape.x1) * 3;
    const h = Math.abs(shape.y2 - shape.y1) * 3.4;
    const hitPe = pe === 'pointer-events-auto' ? 'stroke' : 'none';
    const tap = (e: ReactMouseEvent) => { e.stopPropagation(); onSelect(selected ? null : index); };
    let hit: ReactNode;
    if (form === 'polygon') {
      const pts = pairsOf(shape.points).map((p) => `${p.x * 3},${p.y * 3.4}`).join(' ');
      hit = <polygon points={pts} fill="none" stroke="transparent" strokeWidth={12} pointerEvents={hitPe} className="cursor-pointer" onClick={tap} />;
    } else if (form === 'ellipse') {
      hit = <ellipse cx={c.x} cy={c.y} rx={w / 2} ry={h / 2} transform={rot ? `rotate(${rot} ${c.x} ${c.y})` : undefined} fill="none" stroke="transparent" strokeWidth={12} pointerEvents={hitPe} className="cursor-pointer" onClick={tap} />;
    } else {
      hit = <rect x={c.x - w / 2} y={c.y - h / 2} width={w} height={h} rx={5} transform={rot ? `rotate(${rot} ${c.x} ${c.y})` : undefined} fill="none" stroke="transparent" strokeWidth={12} pointerEvents={hitPe} className="cursor-pointer" onClick={tap} />;
    }
    const corner = rotateAround({ x: c.x + w / 2, y: c.y + h / 2 }, c, rot);
    const top = rotateAround({ x: c.x, y: c.y - h / 2 - 11 }, c, rot);
    const topEdge = rotateAround({ x: c.x, y: c.y - h / 2 }, c, rot);
    return (
      <g data-m6d="zone" data-form={form}>
        <g className="pointer-events-none"><M6dShape shape={shape} /></g>
        {!readOnly && hit}
        {selected && !readOnly && (
          <g>
            {form === 'polygon'
              ? pairsOf(shape.points).map((p, k) => (
                <circle key={k} cx={p.x * 3} cy={p.y * 3.4} r={3.2} fill="white" stroke={color} strokeWidth={1.5}
                  className={`${pe} cursor-grab touch-none`} onPointerDown={begin({ kind: 'vertex', vertex: k })} {...handlers} />
              ))
              : (
                <>
                  <line x1={topEdge.x} y1={topEdge.y} x2={top.x} y2={top.y} stroke="#34d399" strokeWidth={1} className="pointer-events-none" />
                  <circle cx={top.x} cy={top.y} r={4.2} fill="#34d399" stroke="#064e3b" strokeWidth={1} aria-label="Girar zona"
                    className={`${pe} cursor-grab touch-none`} onPointerDown={begin({ kind: 'rotate', orig: shape })} {...handlers} />
                  <rect x={corner.x - 3.4} y={corner.y - 3.4} width={6.8} height={6.8} rx={1.2} fill="white" stroke={color} strokeWidth={1.5}
                    className={`${pe} cursor-nwse-resize touch-none`} onPointerDown={begin({ kind: 'scale', orig: shape })} {...handlers} />
                </>
              )}
            {/* Mover: el centro (cruz), para no confundirlo con tocar un jugador. */}
            <g className={`${pe} cursor-move touch-none`} onPointerDown={(e) => { const p = toPct(e); if (p) begin({ kind: 'move', start: p, orig: shape, moved: false })(e); }} {...handlers}>
              <circle cx={c.x} cy={c.y} r={5} fill="#064e3b" fillOpacity={0.85} stroke="#34d399" strokeWidth={1} />
              <path d={`M ${c.x - 3} ${c.y} H ${c.x + 3} M ${c.x} ${c.y - 3} V ${c.y + 3}`} stroke="#ecfdf5" strokeWidth={1.1} strokeLinecap="round" />
            </g>
            <DeleteButton x={c.x + 9} y={c.y - 9} pe={pe} onDelete={() => onDelete(index)} />
          </g>
        )}
      </g>
    );
  }

  // Línea con estilo.
  const p1 = toSvg({ x: shape.x1, y: shape.y1 });
  const p2 = toSvg({ x: shape.x2, y: shape.y2 });
  const style: LineStyle = isLineStyle(shape.line) ? shape.line : 'run';
  return (
    <g data-m6d="line" data-line={style}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={12}
        className={`${pe} cursor-pointer`} onClick={(e) => { e.stopPropagation(); onDelete(index); }} />
      <g className="pointer-events-none"><StyledLine shape={shape} style={style} /></g>
      {!readOnly && endHandles(index, p1, p2, color)}
    </g>
  );
}

function DeleteButton({ x, y, pe, onDelete }: { x: number; y: number; pe: string; onDelete: () => void }) {
  return (
    <g className={`${pe} cursor-pointer`} aria-label="Quitar" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
      <circle cx={x} cy={y} r={4.6} fill="#dc2626" stroke="white" strokeWidth={1} />
      <path d={`M ${x - 2} ${y - 2} l 4 4 M ${x + 2} ${y - 2} l -4 4`} stroke="white" strokeWidth={1.3} strokeLinecap="round" />
    </g>
  );
}

/** Número de una figura vieja (flecha/curva/recorrido sin estilo) con seq. */
export function SeqOverlay({ shape }: { shape: TacticalArrow }) {
  return <g className="pointer-events-none"><SeqBadge shape={shape} /></g>;
}

/** Polígono en construcción: tramos, vértices y el primero resaltado (tocarlo cierra). */
export function PolygonDraftView({ points, color, cursor }: { points: ArrowPoint[]; color: string; cursor: ArrowPoint | null }) {
  if (points.length === 0) return null;
  const pts = points.map(toSvg);
  const all = cursor ? [...pts, toSvg(cursor)] : pts;
  return (
    <g className="pointer-events-none" data-polygon-draft={points.length}>
      {pts.length >= 3 && <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} fillOpacity={0.14} stroke="none" />}
      <polyline points={all.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeOpacity={0.85} strokeWidth={1.5} strokeDasharray="4 3" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 4.2 : 2.6} fill={i === 0 ? '#34d399' : 'white'} stroke="#064e3b" strokeWidth={1} />
      ))}
    </g>
  );
}

/** Vista previa de una línea con estilo mientras se arrastra. */
export function StyledLinePreview({ start, current, type, style }: { start: ArrowPoint; current: ArrowPoint; type: 'arrow' | 'curve'; style: LineStyle }) {
  return (
    <g opacity={0.75} className="pointer-events-none">
      <StyledLine shape={{ type, x1: start.x, y1: start.y, x2: current.x, y2: current.y, line: style }} style={style} />
    </g>
  );
}

/** Leyenda de líneas sobre la cancha (HTML, esquina inferior izquierda): solo
 *  los estilos que la jugada usa. No captura toques. */
export function LineLegendOverlay({ styles }: { styles: LineStyle[] }) {
  if (styles.length === 0) return null;
  return (
    // En celular la cancha es chica y la leyenda taparía jugadores: ahí la
    // leyenda es la paleta «Tipo de línea» (mismas muestras) y la exportación.
    <div data-testid="tb-line-legend" className="hidden md:block absolute left-1.5 bottom-1.5 z-[45] pointer-events-none rounded-md bg-zinc-950/75 px-1.5 py-1 space-y-0.5 shadow">
      {styles.map((s) => (
        <div key={s} className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-semibold text-white leading-none">
          <svg viewBox="0 -5 30 10" className="h-2.5 w-7 shrink-0 overflow-visible" aria-hidden="true">
            <LineSample style={s} x={1} y={0} w={27} />
          </svg>
          {LINE_STYLE_LABEL[s]}
        </div>
      ))}
    </div>
  );
}
