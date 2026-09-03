/**
 * Tablero táctico (P0) — cancha con drag-and-drop, formación libre (D1 de
 * docs/specs/football-tactical-experience.md). Reemplaza gradualmente a
 * LineupModal; LineupModal se mantiene como vista clásica hasta validar este
 * flujo en producción (ver docs/plan-p0-tablero-tactico.md, sección 3).
 *
 * @dnd-kit en vez de HTML5 Drag and Drop nativo: pointer events unificados
 * mouse+touch, sin el comportamiento errático de HTML5 DnD dentro de
 * WebViews de Capacitor (D7).
 */
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X, Bookmark, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, PenLine, Undo2, Eraser, Ruler, Sparkles, Plus, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTeamPerformanceRoster } from '@/hooks/usePerformanceData';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  useFootballLineups,
  useFootballLineup,
  useSaveFootballLineup,
  useTacticalPresets,
  useCreateTacticalPreset,
  useUpdateTacticalPreset,
  useDeleteTacticalPreset,
  useFootballEvents,
  useFootballSeasonStats,
} from '@/hooks/useFootballData';
import { FootballPitchBackground } from './FootballPitchBackground';
import { PlayerCard } from './PlayerCard';
import { POSITION_LABEL } from '@/lib/school/footballDisplay';
import type { LineupSourceType, LineupPlayerInput, TacticalSituation, PositionCode, TacticalArrow, TacticalArrowColor, TacticalShapeType, EventSourceType } from '@/lib/school/footballQueries';
import type { RosterSubject } from '@/lib/school/performanceQueries';

const SITUATION_LABEL: Record<TacticalSituation, string> = {
  ataque: 'Ataque',
  defensa: 'Defensa',
  presion: 'Presión',
  transicion: 'Transición',
  corner: 'Córner',
  tiro_libre: 'Tiro libre',
  penalti: 'Penalti',
};
const SITUATIONS = Object.keys(SITUATION_LABEL) as TacticalSituation[];

/** Distancia (en % de cancha) dentro de la cual soltar un jugador "adopta"
 *  un marcador de plantilla en vez de crear una posición libre nueva. */
const SNAP_DISTANCE = 8;

interface TacticalBoardProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  sourceType: LineupSourceType;
  sourceId: string;
  /** "vs Rival — 20 ago" o "Entrenamiento — 20 ago", según el contexto. */
  contextLabel: string;
}

const subjectKey = (t: string, id: string) => `${t}:${id}`;

/** Sugerencia de etiqueta según la altura donde se soltó -- un default
 *  editable, no una regla de negocio (D1: formación libre, sin catálogo). */
function suggestLabel(y: number): string {
  if (y < 22) return 'Delantero';
  if (y < 48) return 'Medio';
  if (y < 78) return 'Defensa';
  return 'Arquero';
}

/** Franjas de la cancha (mismos cortes que suggestLabel) para el overlay de
 *  zonas y para ubicar alineaciones viejas sin x/y (ver LEGACY_BAND_Y). */
const ZONE_BANDS: { label: string; y0: number; y1: number }[] = [
  { label: 'Ataque', y0: 0, y1: 22 },
  { label: 'Medio', y0: 22, y1: 48 },
  { label: 'Defensa', y0: 48, y1: 78 },
  { label: 'Arquero', y0: 78, y1: 100 },
];

/** Y por defecto de cada position_code clásico -- para ubicar en la cancha
 *  alineaciones creadas con el LineupModal viejo, que no guardaba x/y. */
const LEGACY_BAND_Y: Record<PositionCode, number> = {
  delantero: 12,
  medio: 38,
  defensa: 65,
  arquero: 92,
};

/** Reparte N jugadores del mismo position_code en una fila horizontal, para
 *  que una alineación vieja (sin x/y) no aparezca toda apilada en el mismo punto. */
function legacyFallbackPosition(positionCode: PositionCode | null | undefined, indexInBand: number, totalInBand: number) {
  const y = positionCode ? LEGACY_BAND_Y[positionCode] : 50;
  const x = totalInBand <= 1 ? 50 : 20 + indexInBand * (60 / (totalInBand - 1));
  return { x, y };
}

/** P4 (sugerencia de XI): 11 posiciones de un 4-4-2 genérico, sin saber la
 *  posición real de cada jugador (las season-stats no la traen) -- es un
 *  punto de partida ordenado por minutos jugados, no una formación "correcta"
 *  para ese equipo. El coach reacomoda desde ahí. */
function generateFormation442(): { x: number; y: number; label: string }[] {
  const rows: { y: number; count: number; label: string }[] = [
    { y: 92, count: 1, label: 'Arquero' },
    { y: 65, count: 4, label: 'Defensa' },
    { y: 38, count: 4, label: 'Medio' },
    { y: 12, count: 2, label: 'Delantero' },
  ];
  const slots: { x: number; y: number; label: string }[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const x = row.count <= 1 ? 50 : 15 + i * (70 / (row.count - 1));
      slots.push({ x, y: row.y, label: row.label });
    }
  }
  return slots;
}

/** D6 de la spec: con muy pocos jugadores con partidos registrados, "sugerir"
 *  algo sería ruido estadístico, no una sugerencia real. */
const MIN_SUGGEST_SAMPLE = 5;

/** Empareja cada punto de `from` con el más cercano de `to`, sin repetir
 *  ninguno de los dos lados -- una aproximación simple (no es el algoritmo
 *  húngaro/óptimo) pero alcanza para "qué jugador va a qué posición de la
 *  plantilla" sin pedirle al coach que lo arme a mano. Se usa tanto para
 *  aplicar una plantilla sobre jugadores ya puestos como, en principio,
 *  para cualquier otro emparejamiento por cercanía que haga falta. */
function greedyNearestMatch<A extends { x: number; y: number }, B extends { x: number; y: number }>(
  from: A[],
  to: B[],
): { from: A; to: B }[] {
  const pairs: { fi: number; ti: number; dist: number }[] = [];
  from.forEach((f, fi) => {
    to.forEach((t, ti) => {
      pairs.push({ fi, ti, dist: Math.hypot(f.x - t.x, f.y - t.y) });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);

  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();
  const matches: { from: A; to: B }[] = [];
  for (const p of pairs) {
    if (usedFrom.has(p.fi) || usedTo.has(p.ti)) continue;
    usedFrom.add(p.fi);
    usedTo.add(p.ti);
    matches.push({ from: from[p.fi], to: to[p.ti] });
  }
  return matches;
}

interface PlacedSlot {
  x: number;
  y: number;
  slot_label: string;
  /** false = la etiqueta sigue siendo una sugerencia automática por altura y
   *  se recalcula si el coach mueve al jugador. true = el coach la escribió
   *  a mano y ya no se toca, se mueva a donde se mueva. */
  labelIsCustom: boolean;
  jersey_number: number | '';
}

/** Marcador de una plantilla cargada: posición sugerida SIN jugador todavía
 *  (D8 -- los presets guardan layout, no personas). */
interface EmptySlot {
  id: string;
  slot_label: string;
  x: number;
  y: number;
}

function initialsOf(name: string) {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** Tarjeta de jugador estilo videojuego (banca): avatar circular con anillo,
 *  nombre debajo, en una tira horizontal desplazable. */
function BenchDraggable({ subject, onOpenCard }: { subject: RosterSubject; onOpenCard: () => void }) {
  const key = subjectKey(subject.subject_type, subject.subject_id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bench:${key}`,
    data: { subject },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`touch-none cursor-grab active:cursor-grabbing shrink-0 w-[62px] flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-gradient-to-b from-zinc-800/95 to-zinc-900/95 px-1.5 py-1.5 shadow-lg transition-all hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-emerald-500/10 ${isDragging ? 'opacity-40 scale-95' : ''}`}
    >
      {/* Tocar (sin arrastrar) abre la tarjeta -- dnd-kit solo activa el drag
          después de moverse `distance` px, así que un tap corto sigue
          disparando este onClick normal, mismo patrón que ya usa la etiqueta
          del pin para renombrar. */}
      <Avatar className="h-8 w-8 ring-2 ring-white/15 cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpenCard(); }}>
        <AvatarImage src={subject.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
          {initialsOf(subject.full_name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-[10px] font-semibold text-white/90 text-center leading-tight line-clamp-2">
        {subject.full_name}
      </span>
    </div>
  );
}

/** Marcador de plantilla cargada -- no arrastrable, solo referencia visual
 *  hasta que un jugador se suelte cerca y lo "adopte" (ver SNAP_DISTANCE). */
function EmptySlotMarker({ slot, onRemove }: { slot: EmptySlot; onRemove: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}
      className="flex flex-col items-center gap-0.5 group"
    >
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 z-10 h-3.5 w-3.5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Quitar marcador"
      >
        <X className="h-2 w-2" />
      </button>
      <div className="h-11 w-11 rounded-full border-2 border-dashed border-emerald-300/70 bg-emerald-400/10 animate-pulse" />
      <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 leading-tight max-w-[84px] truncate">
        {slot.slot_label}
      </span>
    </div>
  );
}

/** Overlay de zonas (ataque/medio/defensa/arquero + bandas), togglable con el
 *  ícono de ojo. Puramente visual -- pointer-events-none para no interferir
 *  con el drag de los pines que quedan encima. */
function ZoneOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      {ZONE_BANDS.map((b, i) => (
        <div
          key={b.label}
          style={{ position: 'absolute', top: `${b.y0}%`, height: `${b.y1 - b.y0}%`, left: 0, right: 0 }}
          className={`flex items-start justify-center pt-1.5 border-t border-white/25 ${i % 2 === 0 ? 'bg-white/[0.05]' : ''}`}
        >
          <span className="text-[10px] uppercase tracking-widest text-white/45 font-bold">{b.label}</span>
        </div>
      ))}
      {/* Bandas (izquierda/centro/derecha) */}
      <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1 }} className="bg-white/20" />
      <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1 }} className="bg-white/20" />
    </div>
  );
}

const ARROW_COLOR_HEX: Record<TacticalArrowColor, string> = {
  white: '#f8fafc',
  yellow: '#facc15',
  red: '#ef4444',
  blue: '#38bdf8',
};

/** cono/balón/valla/contrincante/implemento: objetos de UN punto (se
 *  colocan con un toque, no arrastrando de un punto A a un punto B como
 *  flecha/curva/zona). */
const POINT_SHAPE_TYPES: TacticalShapeType[] = ['cone', 'ball', 'goal', 'opponent', 'hurdle'];
const isPointShape = (t: TacticalShapeType | undefined) => !!t && POINT_SHAPE_TYPES.includes(t);

const OBJECT_LABEL: Record<'cone' | 'ball' | 'goal' | 'opponent' | 'hurdle', string> = {
  cone: 'Cono', ball: 'Balón', goal: 'Valla', opponent: 'Contrincante', hurdle: 'Vallita',
};

/** Ícono de cada objeto, dibujado a mano en vez de emoji para 'cone'/'hurdle'
 *  (no hay un emoji de cono confiable multiplataforma) y 'opponent' (mismo
 *  estilo de disco que PitchPin, en rojo, para que se lea como "del otro
 *  equipo" de un vistazo). 'ball'/'goal' sí tienen emoji bien soportado. */
function ObjectIcon({ type, x, y }: { type: TacticalShapeType; x: number; y: number }) {
  switch (type) {
    case 'cone':
      return <polygon points={`${x},${y - 6} ${x - 5},${y + 6} ${x + 5},${y + 6}`} fill="#f97316" stroke="#7c2d12" strokeWidth={0.8} />;
    case 'hurdle':
      return (
        <g stroke="#e2e8f0" strokeWidth={1.2}>
          <line x1={x - 6} y1={y + 4} x2={x + 6} y2={y + 4} />
          <line x1={x - 5} y1={y + 4} x2={x - 5} y2={y - 3} />
          <line x1={x + 5} y1={y + 4} x2={x + 5} y2={y - 3} />
        </g>
      );
    case 'opponent':
      return (
        <>
          <circle cx={x} cy={y} r={7} fill="#dc2626" stroke="white" strokeWidth={1.5} />
          <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill="white">R</text>
        </>
      );
    case 'ball':
      return <text x={x} y={y + 4} textAnchor="middle" fontSize={12}>⚽</text>;
    case 'goal':
      return <text x={x} y={y + 4} textAnchor="middle" fontSize={13}>🥅</text>;
    default:
      return null;
  }
}

/** Punto en el mismo espacio 0-100 que x/y de jugadores y slots -- se
 *  convierte al viewBox real (300x340, igual que FootballPitchBackground)
 *  solo al dibujar, para no manejar dos sistemas de coordenadas. */
interface ArrowPoint { x: number; y: number }

/** Punto de control de una curva, calculado en espacio SVG (no en % 0-100)
 *  para que el "abombado" se vea perpendicular de verdad -- la cancha no es
 *  cuadrada (300x340), así que un offset calculado en % antes de escalar
 *  queda torcido. */
function curveControlPoint(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular normalizado * 18% de la longitud -- "comba" fija, no es
  // dibujo libre de la curva, es la forma más simple que se distingue de
  // una flecha recta sin pedirle al usuario un gesto de 3 puntos.
  const offset = len * 0.18;
  return { x: mx - (dy / len) * offset, y: my + (dx / len) * offset };
}

/** Capa de dibujo + edición del modo pizarra (P2d): crea flechas/curvas/
 *  zonas, deja mover cada figura por sus extremos y borrarlas individual, y
 *  la herramienta de medir distancia. Todo el manejo de puntero vive ACÁ
 *  (no en el padre) para no re-renderizar TacticalBoard entero en cada
 *  pixel de arrastre.
 *
 *  Capas de pointer-events: el <svg> raíz solo intercepta el puntero
 *  (pointer-events-auto) cuando drawMode o measureMode están activos -- así
 *  el resto del tiempo los pines de abajo se arrastran normal. Los handles y
 *  el cuerpo de cada figura SÍ son siempre interactivos (pointer-events
 *  explícito por elemento), para poder ajustar o borrar una figura ya hecha
 *  sin tener que activar el modo dibujo. */
function ArrowLayer({
  shapes, drawMode, drawShapeType, drawColor, measureMode, pitchLengthMeters,
  onCreateShape, onUpdateShape, onDeleteShape,
}: {
  shapes: TacticalArrow[];
  drawMode: boolean;
  drawShapeType: TacticalShapeType;
  drawColor: TacticalArrowColor;
  measureMode: boolean;
  pitchLengthMeters: number;
  onCreateShape: (shape: TacticalArrow) => void;
  onUpdateShape: (index: number, patch: Partial<Pick<TacticalArrow, 'x1' | 'y1' | 'x2' | 'y2'>>) => void;
  onDeleteShape: (index: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<{ start: ArrowPoint; current: ArrowPoint } | null>(null);
  const [measurePoints, setMeasurePoints] = useState<ArrowPoint[]>([]);
  // `moved` distingue un tap real (borra un objeto de un punto) de un drag
  // (lo reposiciona) -- se marca en handleHandlePointerMove, que el
  // navegador solo dispara cuando el puntero de verdad se movió.
  const draggingHandle = useRef<{ index: number; endpoint: 'start' | 'end'; moved: boolean } | null>(null);
  const draggingMeasurePoint = useRef<0 | 1 | null>(null);

  const toSvg = (p: ArrowPoint) => ({ x: p.x * 3, y: p.y * 3.4 });

  function pctFromEvent(e: { clientX: number; clientY: number }): ArrowPoint | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function handleCanvasPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (measureMode || !drawMode) return;
    const p = pctFromEvent(e);
    if (!p) return;
    // Objetos de un punto (cono/balón/valla/contrincante/vallita) se colocan
    // con un toque, no con un arrastre de A a B como flecha/curva/zona.
    if (isPointShape(drawShapeType)) {
      onCreateShape({ type: drawShapeType, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: drawColor });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setPreview({ start: p, current: p });
  }

  function handleCanvasPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!preview) return;
    const p = pctFromEvent(e);
    if (!p) return;
    setPreview((prev) => (prev ? { ...prev, current: p } : prev));
  }

  function handleCanvasPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (!preview) return;
    const p = pctFromEvent(e) ?? preview.current;
    const dist = Math.hypot(p.x - preview.start.x, p.y - preview.start.y);
    if (dist >= 4) {
      onCreateShape({ type: drawShapeType, x1: preview.start.x, y1: preview.start.y, x2: p.x, y2: p.y, color: drawColor });
    }
    setPreview(null);
  }

  function handleCanvasClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (!measureMode) return;
    // Con los 2 puntos ya puestos, un click en la cancha NO reinicia la
    // medición -- antes sí, y por eso "solo dejaba usarla una vez": para
    // ajustarla había que empezar de cero. Ahora se ajusta arrastrando los
    // puntos (ver handleMeasure*), y se borra tocando la línea entre ellos.
    if (measurePoints.length >= 2) return;
    const p = pctFromEvent(e);
    if (!p) return;
    setMeasurePoints((prev) => [...prev, p]);
  }

  function handleMeasurePointerDown(index: 0 | 1, e: ReactPointerEvent<SVGCircleElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingMeasurePoint.current = index;
  }

  function handleMeasurePointerMove(e: ReactPointerEvent<SVGCircleElement>) {
    const idx = draggingMeasurePoint.current;
    if (idx === null) return;
    const p = pctFromEvent(e);
    if (!p) return;
    setMeasurePoints((prev) => prev.map((pt, i) => (i === idx ? p : pt)));
  }

  function handleMeasurePointerUp() {
    draggingMeasurePoint.current = null;
  }

  function handleHandlePointerDown(index: number, endpoint: 'start' | 'end', e: ReactPointerEvent<SVGCircleElement | SVGGElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingHandle.current = { index, endpoint, moved: false };
  }

  function handleHandlePointerMove(e: ReactPointerEvent<SVGCircleElement | SVGGElement>) {
    const dh = draggingHandle.current;
    if (!dh) return;
    const p = pctFromEvent(e);
    if (!p) return;
    dh.moved = true;
    // Objeto de un punto: mover su único handle actualiza x1/y1 Y x2/y2
    // juntos, para que se mantengan iguales (así el ícono se sigue
    // dibujando en un solo punto, no como si fuera una línea).
    if (isPointShape(shapes[dh.index]?.type)) {
      onUpdateShape(dh.index, { x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    onUpdateShape(dh.index, dh.endpoint === 'start' ? { x1: p.x, y1: p.y } : { x2: p.x, y2: p.y });
  }

  function handleHandlePointerUp() {
    draggingHandle.current = null;
  }

  /** Solo para objetos de un punto: soltar sin haber movido = borrar (un
   *  "tap" limpio); soltar habiendo arrastrado = solo reposicionar, no borra. */
  function handleObjectPointerUp(index: number) {
    const wasTap = draggingHandle.current !== null && !draggingHandle.current.moved;
    draggingHandle.current = null;
    if (wasTap) onDeleteShape(index);
  }

  // Ancho real = largo * proporción de la cancha (300/340) -- la cancha no
  // es cuadrada, y el largo (arco a arco) es el que el coach conoce mejor.
  const pitchWidthMeters = pitchLengthMeters * (300 / 340);
  const measureDistanceM = measurePoints.length === 2
    ? Math.hypot(
        ((measurePoints[1].x - measurePoints[0].x) / 100) * pitchWidthMeters,
        ((measurePoints[1].y - measurePoints[0].y) / 100) * pitchLengthMeters,
      )
    : null;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 300 340"
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full z-40 touch-none ${
        measureMode ? 'cursor-crosshair pointer-events-auto' : drawMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
      }`}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onClick={handleCanvasClick}
    >
      <defs>
        {/* Punta más chica que antes (era 8x8) -- se sentía muy pesada sobre
            una cancha con jugadores y etiquetas ya de por sí cargada. */}
        {(Object.keys(ARROW_COLOR_HEX) as TacticalArrowColor[]).map((c) => (
          <marker key={c} id={`arrowhead-${c}`} markerWidth="5.5" markerHeight="5.5" refX="4" refY="2.75" orient="auto">
            <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill={ARROW_COLOR_HEX[c]} />
          </marker>
        ))}
      </defs>

      {shapes.map((s, i) => {
        const p1 = toSvg({ x: s.x1, y: s.y1 });
        const p2 = toSvg({ x: s.x2, y: s.y2 });
        const color = ARROW_COLOR_HEX[s.color ?? 'white'];
        const type = s.type ?? 'arrow';

        if (isPointShape(type)) {
          // Objeto de un punto: el ícono ENTERO es el handle -- un solo
          // toque para mover, tocar sin arrastrar para borrar (mismo umbral
          // de distancia que ya usa handleCanvasPointerUp para no confundir
          // un tap con un drag).
          return (
            <g
              key={i}
              className="pointer-events-auto cursor-grab touch-none"
              onPointerDown={(e) => handleHandlePointerDown(i, 'start', e)}
              onPointerMove={handleHandlePointerMove}
              onPointerUp={() => handleObjectPointerUp(i)}
            >
              <ObjectIcon type={type} x={p1.x} y={p1.y} />
            </g>
          );
        }

        return (
          <g key={i}>
            {type === 'zone' ? (
              <rect
                x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)}
                width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)}
                rx={5} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.55} strokeWidth={1}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onDeleteShape(i); }}
              />
            ) : type === 'curve' ? (() => {
              const c = curveControlPoint(p1, p2);
              return (
                <>
                  {/* Trazo ancho invisible = área de click más generosa para
                      borrar, sin engordar la línea que se ve. */}
                  <path d={`M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`} stroke="transparent" strokeWidth={12} fill="none"
                    className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); onDeleteShape(i); }} />
                  <path d={`M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`} stroke={color} strokeWidth={2} fill="none"
                    strokeLinecap="round" markerEnd={`url(#arrowhead-${s.color ?? 'white'})`} className="pointer-events-none" />
                </>
              );
            })() : (
              <>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={12}
                  className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); onDeleteShape(i); }} />
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} strokeLinecap="round"
                  markerEnd={`url(#arrowhead-${s.color ?? 'white'})`} className="pointer-events-none" />
              </>
            )}

            {/* Handles -- más chicos que antes (r=5), siguen siendo
                interactivos siempre, muevan o no drawMode/measureMode. */}
            <circle cx={p1.x} cy={p1.y} r={3.2} fill="white" stroke={color} strokeWidth={1.5}
              className="pointer-events-auto cursor-grab touch-none"
              onPointerDown={(e) => handleHandlePointerDown(i, 'start', e)}
              onPointerMove={handleHandlePointerMove}
              onPointerUp={handleHandlePointerUp}
            />
            <circle cx={p2.x} cy={p2.y} r={3.2} fill="white" stroke={color} strokeWidth={1.5}
              className="pointer-events-auto cursor-grab touch-none"
              onPointerDown={(e) => handleHandlePointerDown(i, 'end', e)}
              onPointerMove={handleHandlePointerMove}
              onPointerUp={handleHandlePointerUp}
            />
          </g>
        );
      })}

      {preview && (() => {
        const p1 = toSvg(preview.start);
        const p2 = toSvg(preview.current);
        if (drawShapeType === 'zone') {
          return (
            <rect
              x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)}
              width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)}
              rx={6} fill={ARROW_COLOR_HEX[drawColor]} fillOpacity={0.15}
              stroke={ARROW_COLOR_HEX[drawColor]} strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="5 4"
            />
          );
        }
        if (drawShapeType === 'curve') {
          const c = curveControlPoint(p1, p2);
          return <path d={`M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`} stroke="#f8fafc" strokeOpacity={0.7} strokeWidth={2} fill="none" strokeDasharray="5 4" strokeLinecap="round" />;
        }
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#f8fafc" strokeOpacity={0.7} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />;
      })()}

      {/* Regla de medir (no se guarda con la plantilla -- es una consulta
          puntual). Los puntos se arrastran para ajustar la medición sin
          reiniciarla, y tocar la línea la borra -- antes un 3er click
          simplemente arrancaba una medición nueva, sin forma de afinar la
          que ya estaba ni de borrarla explícitamente. */}
      {measurePoints.length === 2 && measureDistanceM !== null && (() => {
        const a = toSvg(measurePoints[0]);
        const b = toSvg(measurePoints[1]);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12}
              className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setMeasurePoints([]); }} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#facc15" strokeWidth={1.25} strokeDasharray="4 3" className="pointer-events-none" />
            <rect x={mid.x - 22} y={mid.y - 9} width={44} height={16} rx={4} fill="#111827" fillOpacity={0.9} className="pointer-events-none" />
            <text x={mid.x} y={mid.y + 1.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#facc15" className="pointer-events-none">
              ~{measureDistanceM.toFixed(1)}m
            </text>
          </>
        );
      })()}
      {/* Puntos de la regla -- arrastrables (antes eran fijos: la única forma
          de "ajustar" era borrar todo y volver a medir desde cero). Más
          chicos que las figuras (r=2.6) porque son solo una referencia, no
          algo que se guarda. */}
      {measurePoints.map((p, i) => {
        const svgP = toSvg(p);
        return (
          <circle
            key={i} cx={svgP.x} cy={svgP.y} r={2.6} fill="#facc15" stroke="#78350f" strokeWidth={1}
            className="pointer-events-auto cursor-grab touch-none"
            onPointerDown={(e) => handleMeasurePointerDown(i as 0 | 1, e)}
            onPointerMove={handleMeasurePointerMove}
            onPointerUp={handleMeasurePointerUp}
          />
        );
      })}
    </svg>
  );
}

/** Ficha de jugador en la cancha, estilo disco de videojuego (número de
 *  camiseta si existe, si no las iniciales) con etiqueta flotante debajo. */
function PitchPin({ subject, slot, onLabelChange, onRemove, onOpenCard, events, animate }: {
  subject: RosterSubject;
  slot: PlacedSlot;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
  onOpenCard: () => void;
  events?: { goals: number; assists: number };
  /** true durante "Reproducir jugada" o al aplicar una plantilla sobre
   *  jugadores ya puestos -- el cambio de left/top se anima en vez de
   *  saltar de golpe. Fuera de esos momentos NO se anima (arrastrar se
   *  sentiría con retraso si el transition estuviera siempre activo). */
  animate?: boolean;
}) {
  const key = subjectKey(subject.subject_type, subject.subject_id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pitch:${key}`,
    data: { subject },
  });
  const [editing, setEditing] = useState(false);
  // BenchDraggable y LineupModal ya mostraban la foto -- el pin en cancha
  // era el único lugar que se quedaba en solo número/iniciales. `imgError`
  // cubre el caso de una avatar_url rota (404, bucket privado, etc.): cae
  // de vuelta al disco de siempre en vez de dejar un ícono roto.
  const [imgError, setImgError] = useState(false);
  const displayNumber = slot.jersey_number !== '' ? String(slot.jersey_number) : null;
  const hasPhoto = !!subject.avatar_url && !imgError;

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: `translate(-50%, -50%) ${transform ? CSS.Translate.toString(transform) : ''}`,
        transition: animate ? 'left 1.3s ease-in-out, top 1.3s ease-in-out' : undefined,
        zIndex: isDragging ? 30 : 10,
      }}
      className="flex flex-col items-center gap-1 touch-none"
    >
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-2 -right-2 z-10 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg ring-2 ring-zinc-950/80"
        aria-label={`Quitar a ${subject.full_name} de la cancha`}
      >
        <X className="h-3 w-3" />
      </button>
      {/* El handle de arrastre cubre disco + etiqueta juntos -- antes solo
          cubría el círculo del avatar (36px), así que agarrar la etiqueta o
          el borde del pin no arrastraba nada. El botón X queda AFUERA de
          este div a propósito, para que nunca compita con el drag. */}
      <div
        {...listeners}
        {...attributes}
        className="flex flex-col items-center gap-1 touch-none cursor-grab active:cursor-grabbing"
      >
        <div
          onClick={(e) => { e.stopPropagation(); onOpenCard(); }}
          className={`relative h-11 w-11 rounded-full overflow-hidden flex items-center justify-center font-black text-sm text-white cursor-pointer
            ${hasPhoto ? 'bg-zinc-800' : 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700'}
            shadow-[0_3px_12px_rgba(0,0,0,0.55)] ring-2 transition-transform
            ${isDragging ? 'ring-white scale-110' : 'ring-white/80'}`}
        >
          {hasPhoto ? (
            <img
              src={subject.avatar_url ?? undefined}
              alt={subject.full_name}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            displayNumber ?? initialsOf(subject.full_name)
          )}
          {/* Con foto, el número pasa a insignia de esquina (estilo FC/PES)
              en vez de superpuesto sobre la cara del jugador. */}
          {hasPhoto && displayNumber && (
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-zinc-950 ring-1 ring-white/70 text-[8px] font-black flex items-center justify-center">
              {displayNumber}
            </span>
          )}
          {/* P2c: goles/asistencias de este partido, de un vistazo. */}
          {events && (events.goals > 0 || events.assists > 0) && (
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5 whitespace-nowrap">
              {events.goals > 0 && (
                <span className="text-[9px] bg-zinc-950 rounded-full px-1 ring-1 ring-white/30">⚽{events.goals > 1 ? `×${events.goals}` : ''}</span>
              )}
              {events.assists > 0 && (
                <span className="text-[9px] bg-zinc-950 rounded-full px-1 ring-1 ring-white/30">🅰️{events.assists > 1 ? `×${events.assists}` : ''}</span>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <Input
            autoFocus
            defaultValue={slot.slot_label}
            className="h-5 w-20 text-[10px] px-1 py-0 text-center bg-white/95 text-black"
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => { onLabelChange(e.target.value.trim() || slot.slot_label); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className="text-[10px] font-bold text-white bg-black/55 backdrop-blur-sm rounded-full px-2 py-0.5 leading-tight max-w-[84px] truncate cursor-text shadow"
          >
            {slot.slot_label}
          </span>
        )}
      </div>
    </div>
  );
}

export function TacticalBoard({ open, onClose, teamId, teamName, sourceType, sourceId, contextLabel }: TacticalBoardProps) {
  const { toast } = useToast();
  const { data: roster, isLoading: loadingRoster } = useTeamPerformanceRoster({ team_id: teamId });
  const { data: existingList } = useFootballLineups({ source_type: sourceType, source_id: sourceId });
  const existingLineupId = existingList?.[0]?.id;
  const { data: existingLineup, isLoading: loadingLineup } = useFootballLineup(existingLineupId);
  const saveLineup = useSaveFootballLineup();

  // P2c: eventos de ESTE partido, para resaltar goles/asistencias en la
  // cancha. Un entrenamiento no tiene eventos (no es 'team_match' ni
  // 'tournament_match'), así que ahí simplemente no se pide nada.
  const isMatchContext = sourceType === 'team_match' || sourceType === 'tournament_match';
  const { data: matchEvents } = useFootballEvents(
    isMatchContext ? { source_type: sourceType as EventSourceType, source_id: sourceId } : {},
  );

  // P4: sugerencia de XI, a partir de minutos jugados en la temporada.
  const { data: seasonStats } = useFootballSeasonStats(teamId);

  const pitchRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Record<string, PlacedSlot>>({});
  const [benchKeys, setBenchKeys] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Plantillas guardadas (P2a/P2b) -- ver docs/plan-p2-estrategias-guardadas.md
  const [situation, setSituation] = useState<TacticalSituation>('ataque');
  const [emptySlots, setEmptySlots] = useState<EmptySlot[]>([]);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);
  const { data: presets } = useTacticalPresets({ team_id: teamId, situation });
  const createPreset = useCreateTacticalPreset();
  const updatePreset = useUpdateTacticalPreset();
  const deletePreset = useDeleteTacticalPreset();
  const [showZones, setShowZones] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  // Modo pizarra (P2d) -- flechas/curvas/zonas, viajan con la plantilla
  // guardada (D8 extendido: mismo mecanismo de "Guardar como plantilla").
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawShapeType, setDrawShapeType] = useState<TacticalShapeType>('arrow');
  const [arrows, setArrows] = useState<TacticalArrow[]>([]);
  const [drawColor, setDrawColor] = useState<TacticalArrowColor>('white');

  // Regla de medir -- consulta puntual, no viaja con la plantilla (mutuamente
  // excluyente con drawMode: no tiene sentido dibujar y medir con el mismo gesto).
  const [measureMode, setMeasureMode] = useState(false);
  const [pitchLengthMeters, setPitchLengthMeters] = useState(90);

  // Guías de alineación (mientras se arrastra un jugador ya puesto) --
  // puramente visuales, no se guardan en ningún lado.
  const [alignGuides, setAlignGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  // Tarjeta de jugador (P1) -- se abre con la data que ya trae el roster
  // cargado (metrics + latest_values), sin pedir nada nuevo al BFF.
  const [cardSubject, setCardSubject] = useState<RosterSubject | null>(null);

  // Animaciones de movimiento -- true solo mientras dura la transición CSS
  // de PitchPin (1.3s), después vuelve a false para no dejar el transition
  // activo durante un arrastre normal (se sentiría con retraso).
  const [animatingMove, setAnimatingMove] = useState(false);
  const ANIMATE_MS = 1300;
  // Cubre TODA la secuencia de "Reproducir jugada" (ida + pausa + vuelta),
  // no solo el tramo animado -- si solo gateara con animatingMove, el botón
  // se re-habilitaría durante la pausa a mitad de la reproducción.
  const [playingSequence, setPlayingSequence] = useState(false);
  const PLAY_HOLD_MS = 900;

  // Con el tablero abierto se pierde tiempo trabajando sin mover el mouse
  // (mirando el campo, pensando la jugada) o el coach se va a otra pestaña un
  // rato -- eso no debe contar como "inactividad" y cerrarle la sesión,
  // borrando alineación/flechas sin guardar. Mismo mecanismo que ya usan
  // CoachAttendancePage/RoutineFormModal para lo mismo.
  useUnsavedChanges(`tactical-board-${sourceId}`, open);

  const subjects = roster?.subjects ?? [];
  const subjectByKey = useMemo(() => {
    const m = new Map<string, RosterSubject>();
    for (const s of subjects) m.set(subjectKey(s.subject_type, s.subject_id), s);
    return m;
  }, [subjects]);

  // P2c: goles/asistencias de ESTE partido por jugador, para el badge sobre
  // el pin. own_goal/tarjetas no se muestran acá -- son datos negativos que
  // no aportan al "de un vistazo" que busca el badge, se siguen viendo
  // completos en MatchEventsModal.
  const eventSummaryByKey = useMemo(() => {
    const m = new Map<string, { goals: number; assists: number }>();
    for (const e of matchEvents ?? []) {
      const key = subjectKey(e.subject_type, e.subject_id);
      const entry = m.get(key) ?? { goals: 0, assists: 0 };
      if (e.type === 'goal') entry.goals += 1;
      if (e.type === 'assist') entry.assists += 1;
      m.set(key, entry);
    }
    return m;
  }, [matchEvents]);

  // Hidrata desde la alineación existente UNA sola vez -- no en cada refetch,
  // para no pisar lo que el coach está armando en pantalla mientras trabaja.
  //
  // Puente con alineaciones VIEJAS (creadas con el LineupModal clásico, antes
  // de que existieran x/y): un titular sin coordenadas no se pierde -- se
  // ubica aproximado según su position_code, repartiendo en fila a los que
  // comparten la misma posición para que no queden todos apilados en un punto.
  if (!initialized && existingLineup && subjects.length > 0) {
    const nextPlaced: Record<string, PlacedSlot> = {};
    const nextBench = new Set<string>();

    const legacyStarters = existingLineup.players.filter(
      (p) => p.role === 'starter' && (p.x == null || p.y == null),
    );
    const legacyByBand = new Map<string, typeof legacyStarters>();
    for (const p of legacyStarters) {
      const bandKey = p.position_code ?? 'sin_posicion';
      if (!legacyByBand.has(bandKey)) legacyByBand.set(bandKey, []);
      legacyByBand.get(bandKey)!.push(p);
    }

    for (const p of existingLineup.players) {
      const key = subjectKey(p.subject_type, p.subject_id);
      // x/y numeric de Postgres puede llegar como string por PostgREST.
      const px = p.x != null ? Number(p.x) : null;
      const py = p.y != null ? Number(p.y) : null;

      if (px != null && py != null && !Number.isNaN(px) && !Number.isNaN(py)) {
        nextPlaced[key] = {
          x: px, y: py,
          slot_label: p.slot_label || suggestLabel(py),
          labelIsCustom: !!p.slot_label,
          jersey_number: p.jersey_number ?? '',
        };
      } else if (p.role === 'starter') {
        const bandKey = p.position_code ?? 'sin_posicion';
        const band = legacyByBand.get(bandKey)!;
        const idx = band.indexOf(p);
        const { x, y } = legacyFallbackPosition(p.position_code, idx, band.length);
        nextPlaced[key] = {
          x, y,
          slot_label: (p.position_code && POSITION_LABEL[p.position_code]) || suggestLabel(y),
          labelIsCustom: false,
          jersey_number: p.jersey_number ?? '',
        };
      } else if (p.role === 'bench') {
        nextBench.add(key);
      }
    }
    setPlaced(nextPlaced);
    setBenchKeys(nextBench);
    setInitialized(true);
  }

  const availableSubjects = subjects.filter((s) => {
    const key = subjectKey(s.subject_type, s.subject_id);
    return !placed[key] && !benchKeys.has(key);
  });

  // PointerSensor unifica mouse + touch + pen (D7) -- no se combina con
  // TouchSensor aparte, porque los dos a la vez pueden disparar el drag dos
  // veces sobre el mismo gesto táctil.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /** Distancia (en % de cancha) dentro de la cual dos jugadores se
   *  consideran "alineados" y aparece la guía. */
  const ALIGN_TOLERANCE = 2;

  // Guías de alineación: solo para REPOSICIONAR un jugador ya puesto (el
  // caso real de "armar una línea pareja") -- no se calculan para un
  // arrastre nuevo desde la banca, que ya tiene su propia lógica de
  // snap-a-marcador-de-plantilla en handleDragEnd.
  function handleDragMove(event: DragMoveEvent) {
    const { active, delta } = event;
    const data = active.data.current as { subject: RosterSubject } | undefined;
    if (!data?.subject || !String(active.id).startsWith('pitch:')) return;
    const key = subjectKey(data.subject.subject_type, data.subject.subject_id);
    const current = placed[key];
    if (!current) return;

    const pitchRect = pitchRef.current?.getBoundingClientRect();
    if (!pitchRect) return;

    const xPct = current.x + (delta.x / pitchRect.width) * 100;
    const yPct = current.y + (delta.y / pitchRect.height) * 100;

    const xs: number[] = [];
    const ys: number[] = [];
    for (const [otherKey, other] of Object.entries(placed)) {
      if (otherKey === key) continue;
      if (Math.abs(other.x - xPct) <= ALIGN_TOLERANCE) xs.push(other.x);
      if (Math.abs(other.y - yPct) <= ALIGN_TOLERANCE) ys.push(other.y);
    }
    setAlignGuides({ x: xs, y: ys });
  }

  function handleDragEnd(event: DragEndEvent) {
    setAlignGuides({ x: [], y: [] });
    const { active, delta } = event;
    const data = active.data.current as { subject: RosterSubject } | undefined;
    if (!data?.subject) return;
    const key = subjectKey(data.subject.subject_type, data.subject.subject_id);

    const pitchRect = pitchRef.current?.getBoundingClientRect();
    if (!pitchRect) return;

    const isReposicionando = String(active.id).startsWith('pitch:') && placed[key];
    let centerX: number;
    let centerY: number;

    if (isReposicionando) {
      // Reposicionar un jugador YA puesto: sumar el delta (px, siempre
      // confiable en @dnd-kit) a su posición actual -- remedir el rect del
      // nodo acá da mal porque el pin ya trae su propio transform de reposo
      // (translate(-50%,-50%)) combinado con el de arrastre.
      const currentPxX = pitchRect.left + (placed[key].x / 100) * pitchRect.width;
      const currentPxY = pitchRect.top + (placed[key].y / 100) * pitchRect.height;
      centerX = currentPxX + delta.x;
      centerY = currentPxY + delta.y;
    } else {
      // Nuevo desde la banca: sin transform previo, sí es confiable medir
      // dónde quedó el elemento.
      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      if (!activeRect) return;
      centerX = activeRect.left + activeRect.width / 2;
      centerY = activeRect.top + activeRect.height / 2;
    }

    const withinPitch = centerX >= pitchRect.left && centerX <= pitchRect.right
      && centerY >= pitchRect.top && centerY <= pitchRect.bottom;

    // Soltar afuera de la cancha no hace nada -- ni agrega, ni borra. Sacar
    // a alguien ya puesto es el botón X, a propósito: un drag accidental no
    // debería borrar una posición ya armada.
    if (!withinPitch) return;

    let xPct = Math.min(100, Math.max(0, ((centerX - pitchRect.left) / pitchRect.width) * 100));
    let yPct = Math.min(100, Math.max(0, ((centerY - pitchRect.top) / pitchRect.height) * 100));
    let adoptedLabel: string | null = null;

    // Si es un jugador NUEVO (no reposicionando) y cae cerca de un marcador
    // de plantilla, lo adopta: toma su posición exacta y su etiqueta, y el
    // marcador desaparece. Reposicionar uno ya puesto no adopta marcadores --
    // sería confuso que mover a alguien lo tironee hacia un slot ajeno.
    if (!isReposicionando && emptySlots.length > 0) {
      let closest: EmptySlot | null = null;
      let closestDist = SNAP_DISTANCE;
      for (const es of emptySlots) {
        const dist = Math.hypot(es.x - xPct, es.y - yPct);
        if (dist < closestDist) { closest = es; closestDist = dist; }
      }
      if (closest) {
        xPct = closest.x;
        yPct = closest.y;
        adoptedLabel = closest.slot_label;
        setEmptySlots((prev) => prev.filter((s) => s.id !== closest!.id));
      }
    }

    setPlaced((prev) => {
      const existing = prev[key];
      // La etiqueta se recalcula por altura MIENTRAS siga siendo una
      // sugerencia (labelIsCustom=false) -- si el coach la escribió a mano,
      // se respeta sin importar a dónde mueva al jugador.
      const keepCustomLabel = !adoptedLabel && existing?.labelIsCustom;
      return {
        ...prev,
        [key]: {
          x: xPct,
          y: yPct,
          slot_label: adoptedLabel || (keepCustomLabel ? existing!.slot_label : suggestLabel(yPct)),
          labelIsCustom: !!keepCustomLabel,
          jersey_number: existing?.jersey_number ?? '',
        },
      };
    });
    setBenchKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function removeFromPitch(key: string) {
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toggleBench(key: string) {
    setBenchKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Cargar una plantilla NUNCA toca a los jugadores ya puestos (D8 -- solo
  // agrega marcadores de referencia); por eso no hace falta confirmar nada,
  // a diferencia de lo que decía el plan original antes de implementarlo.
  // Las flechas SÍ se reemplazan por las del preset (a diferencia de los
  // slots, no tiene sentido "sumar" flechas de dos tácticas distintas).
  function handleLoadPreset(presetId: string) {
    const preset = presets?.find((p) => p.id === presetId);
    if (!preset) return;

    const slots = preset.slots.map((s) => ({ slot_label: s.slot_label, x: Number(s.x), y: Number(s.y) }));
    const placedEntries = Object.entries(placed).map(([key, slot]) => ({ key, x: slot.x, y: slot.y }));

    if (placedEntries.length > 0 && slots.length > 0) {
      // Con jugadores ya puestos, la plantilla los reubica animado hacia el
      // slot más cercano en vez de solo dejar marcadores vacíos -- eso
      // seguía pasando antes SIEMPRE (D8: el preset no sabe qué jugador va
      // dónde), pero acá sí conviene mover a quien ya está, no solo sugerir
      // dónde falta poner a alguien.
      const matches = greedyNearestMatch(placedEntries, slots);
      const matchedSlots = new Set(matches.map((m) => m.to));

      setPlaced((prev) => {
        const next = { ...prev };
        for (const m of matches) {
          const existing = next[m.from.key];
          next[m.from.key] = {
            x: m.to.x, y: m.to.y,
            slot_label: m.to.slot_label,
            labelIsCustom: false,
            jersey_number: existing?.jersey_number ?? '',
          };
        }
        return next;
      });
      setAnimatingMove(true);
      setTimeout(() => setAnimatingMove(false), ANIMATE_MS);

      setEmptySlots(
        slots
          .filter((s) => !matchedSlots.has(s))
          .map((s, i) => ({ id: `${preset.id}:${i}`, slot_label: s.slot_label, x: s.x, y: s.y })),
      );
    } else {
      setEmptySlots(slots.map((s, i) => ({ id: `${preset.id}:${i}`, slot_label: s.slot_label, x: s.x, y: s.y })));
    }

    setArrows((preset.arrows ?? []).map((a) => ({ type: a.type, x1: Number(a.x1), y1: Number(a.y1), x2: Number(a.x2), y2: Number(a.y2), color: a.color })));
    setLoadedPresetId(preset.id);
  }

  async function handleSaveAsPreset() {
    const name = savingName?.trim();
    if (!name) return;
    const slots = Object.values(placed).map((s) => ({ slot_label: s.slot_label, x: s.x, y: s.y }));
    if (slots.length === 0) {
      toast({ title: 'Nada que guardar', description: 'Ubica al menos un jugador en la cancha primero.', variant: 'destructive' });
      return;
    }
    try {
      const created = await createPreset.mutateAsync({ team_id: teamId, name, situation, slots, arrows });
      toast({ title: 'Plantilla guardada', description: `"${name}" para ${SITUATION_LABEL[situation]}.` });
      setSavingName(null);
      // Queda "cargada" la que se acaba de crear -- así un ajuste siguiente
      // usa Actualizar en vez de crear otra copia sin querer.
      setLoadedPresetId(created.id);
    } catch (err: any) {
      toast({ title: 'No se pudo guardar la plantilla', description: err?.message, variant: 'destructive' });
    }
  }

  /** Actualiza EN EL MISMO registro la plantilla que está cargada -- antes no
   *  existía este camino: "editar" una plantilla siempre terminaba en
   *  handleSaveAsPreset, que crea una fila nueva (POST), nunca actualiza la
   *  que se cargó (PUT). Ese era el bug: cargar, mover una flecha, "guardar"
   *  → aparecía una plantilla duplicada con el cambio, la original quedaba
   *  intacta y el coach no entendía por qué "no editaba bien". */
  async function handleUpdatePreset() {
    if (!loadedPresetId) return;
    const slots = Object.values(placed).map((s) => ({ slot_label: s.slot_label, x: s.x, y: s.y }));
    if (slots.length === 0) {
      toast({ title: 'Nada que guardar', description: 'Ubica al menos un jugador en la cancha primero.', variant: 'destructive' });
      return;
    }
    try {
      await updatePreset.mutateAsync({ id: loadedPresetId, slots, arrows });
      toast({ title: 'Plantilla actualizada' });
    } catch (err: any) {
      toast({ title: 'No se pudo actualizar la plantilla', description: err?.message, variant: 'destructive' });
    }
  }

  const suggestibleCount = (seasonStats?.stats ?? []).filter((s) => s.matches_played > 0).length;
  const canSuggestXI = suggestibleCount >= MIN_SUGGEST_SAMPLE && Object.keys(placed).length === 0;

  /** P4: ordena por minutos jugados (no hay dato de posición real en las
   *  season-stats) y los ubica en un 4-4-2 genérico. Solo actúa sobre cancha
   *  vacía a propósito -- sobre una alineación que el coach ya armó, "sugerir"
   *  significaría reemplazar su trabajo sin avisar, y eso no es aceptable. */
  function handleSuggestXI() {
    if (!seasonStats) return;
    const ranked = seasonStats.stats
      .filter((s) => s.matches_played > 0)
      .sort((a, b) => b.minutes_played - a.minutes_played);

    if (ranked.length < MIN_SUGGEST_SAMPLE) {
      toast({
        title: 'Todavía no hay suficientes datos',
        description: `Se necesitan al menos ${MIN_SUGGEST_SAMPLE} jugadores con partidos registrados en la temporada.`,
        variant: 'destructive',
      });
      return;
    }

    const top = ranked.slice(0, 11);
    const slots = generateFormation442();
    const nextPlaced: Record<string, PlacedSlot> = {};

    top.forEach((stat, i) => {
      const key = subjectKey(stat.subject_type, stat.subject_id);
      if (!subjectByKey.has(key)) return; // la plantilla pudo cambiar desde que se calcularon las stats
      const slot = slots[i];
      nextPlaced[key] = { x: slot.x, y: slot.y, slot_label: slot.label, labelIsCustom: false, jersey_number: '' };
    });

    setPlaced(nextPlaced);
    setBenchKeys(new Set());
    toast({
      title: 'XI sugerido por minutos jugados',
      description: 'Formación genérica (no conoce la posición real de cada jugador) -- reacomoda a mano lo que haga falta.',
    });
  }

  /** Distancia (en % de cancha) dentro de la cual una flecha "sale de" un
   *  jugador -- si el inicio de la flecha no está cerca de nadie, no se
   *  anima (es una flecha de zona/espacio, no de un jugador puntual). */
  const PLAY_MATCH_DISTANCE = 6;

  /** "Reproducir jugada": cada jugador puesto que tenga una flecha o curva
   *  arrancando cerca de su posición se desliza animado hasta la punta de
   *  esa flecha. Es una aproximación (línea recta con CSS, no sigue el
   *  arco real de una curva) -- alcanza para "mostrar la jugada", no
   *  pretende ser una animación exacta del trazo. */
  /** Ida hasta la punta de la flecha, pausa breve mostrando la formación
   *  final, y VUELTA al punto de partida -- así "Reproducir" es un ensayo
   *  repetible (el coach lo aprieta las veces que quiera) y no algo que se
   *  "gasta": si el jugador se quedara en la punta, la segunda reproducción
   *  no tendría de dónde partir, porque el jugador ya no está donde arranca
   *  la flecha. */
  function handlePlayMovement() {
    if (playingSequence) return;

    const candidateArrows = arrows.filter((a) => (a.type ?? 'arrow') === 'arrow' || a.type === 'curve');

    const placedEntries = Object.entries(placed);
    const matches: { key: string; fromX: number; fromY: number; fromLabel: string; toX: number; toY: number }[] = [];
    for (const [key, slot] of placedEntries) {
      let closest: TacticalArrow | null = null;
      let closestDist = PLAY_MATCH_DISTANCE;
      for (const a of candidateArrows) {
        const dist = Math.hypot(a.x1 - slot.x, a.y1 - slot.y);
        if (dist < closestDist) { closest = a; closestDist = dist; }
      }
      if (closest) matches.push({ key, fromX: slot.x, fromY: slot.y, fromLabel: slot.slot_label, toX: closest.x2, toY: closest.y2 });
    }

    if (matches.length === 0) {
      toast({
        title: 'Nada que reproducir',
        description: 'Dibuja una flecha o curva que salga de un jugador puesto en la cancha.',
        variant: 'destructive',
      });
      return;
    }

    setPlayingSequence(true);

    // 1) Ida.
    setPlaced((prev) => {
      const next = { ...prev };
      for (const m of matches) {
        next[m.key] = { ...next[m.key], x: m.toX, y: m.toY, slot_label: next[m.key]?.labelIsCustom ? next[m.key].slot_label : suggestLabel(m.toY) };
      }
      return next;
    });
    setAnimatingMove(true);

    setTimeout(() => {
      setAnimatingMove(false);

      // 2) Pausa viendo la formación final, después 3) vuelta al origen.
      setTimeout(() => {
        setPlaced((prev) => {
          const next = { ...prev };
          for (const m of matches) {
            next[m.key] = { ...next[m.key], x: m.fromX, y: m.fromY, slot_label: m.fromLabel };
          }
          return next;
        });
        setAnimatingMove(true);

        setTimeout(() => {
          setAnimatingMove(false);
          setPlayingSequence(false);
        }, ANIMATE_MS);
      }, PLAY_HOLD_MS);
    }, ANIMATE_MS);
  }

  // El manejo de puntero para dibujar/editar vive dentro de ArrowLayer (no
  // acá) para no re-renderizar todo TacticalBoard en cada pixel de
  // arrastre -- estos 3 callbacks son la única superficie que necesita.
  function handleCreateShape(shape: TacticalArrow) {
    setArrows((prev) => [...prev, shape]);
  }
  function handleUpdateShape(index: number, patch: Partial<Pick<TacticalArrow, 'x1' | 'y1' | 'x2' | 'y2'>>) {
    setArrows((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  function handleDeleteShape(index: number) {
    setArrows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const starters = Object.entries(placed);
    if (starters.length > 11) {
      toast({ title: 'Máximo 11 en cancha', description: `Hay ${starters.length} jugadores colocados.`, variant: 'destructive' });
      return;
    }

    const players: LineupPlayerInput[] = [
      ...starters.map(([key, slot]) => {
        const subject = subjectByKey.get(key)!;
        return {
          subject_type: subject.subject_type,
          subject_id: subject.subject_id,
          role: 'starter' as const,
          slot_label: slot.slot_label,
          x: slot.x,
          y: slot.y,
          jersey_number: slot.jersey_number === '' ? null : Number(slot.jersey_number),
        };
      }),
      ...Array.from(benchKeys).map((key) => {
        const subject = subjectByKey.get(key)!;
        return {
          subject_type: subject.subject_type,
          subject_id: subject.subject_id,
          role: 'bench' as const,
        };
      }),
    ];

    try {
      await saveLineup.mutateAsync({ team_id: teamId, source_type: sourceType, source_id: sourceId, players });
      toast({ title: 'Alineación guardada' });
      onClose();
    } catch (err: any) {
      toast({ title: 'No se pudo guardar', description: err?.message, variant: 'destructive' });
    }
  }

  const loading = loadingRoster || (!!existingLineupId && loadingLineup);

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* rounded-none Y sm:rounded-none a propósito: la base de DialogContent
          trae "sm:rounded-lg" -- sin el mismo prefijo, el merge de clases no
          lo reconoce como el mismo "slot" y la base gana en desktop. */}
      <DialogContent
        className="w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:rounded-none border-0 overflow-hidden flex flex-col p-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-2xl"
      >
        {/* DialogTitle/Description quedan para accesibilidad (Radix los exige)
            pero visualmente ocultos -- el título completo y las instrucciones
            no justifican una sección propia cuando la prioridad es la cancha. */}
        <DialogHeader className="sr-only">
          <DialogTitle>Tablero táctico — {teamName}</DialogTitle>
          <DialogDescription>{contextLabel} · arrastra jugadores a la cancha, toca la etiqueta para renombrarla</DialogDescription>
        </DialogHeader>

        {/* Un solo toolbar compacto -- reemplaza lo que antes eran 2 barras
            (encabezado + controles) más el footer de guardar/cancelar. */}
        <div className="px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-black/30 shrink-0">
          <span className="text-xs font-bold text-white/80 truncate max-w-[110px] sm:max-w-none mr-1" title={teamName}>
            {teamName}
          </span>

          {!loading && (
            <>
              <Select value={situation} onValueChange={(v) => { setSituation(v as TacticalSituation); setEmptySlots([]); setLoadedPresetId(null); setArrows([]); }}>
                <SelectTrigger className="h-7 w-[110px] text-[11px] bg-white/5 border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUATIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{SITUATION_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {presets && presets.length > 0 && (
                <>
                  <Select onValueChange={handleLoadPreset}>
                    <SelectTrigger className="h-7 w-[120px] text-[11px] bg-white/5 border-white/15 text-white">
                      <SelectValue placeholder="Plantilla…" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadedPresetId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-white/50 hover:text-red-400 hover:bg-white/10"
                      title="Eliminar la plantilla cargada"
                      onClick={() => {
                        deletePreset.mutate(loadedPresetId);
                        setEmptySlots([]);
                        setLoadedPresetId(null);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}

              {savingName !== null ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={savingName}
                    onChange={(e) => setSavingName(e.target.value)}
                    placeholder="Nombre"
                    className="h-7 w-[110px] text-[11px] bg-white/5 border-white/15 text-white placeholder:text-white/40"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsPreset(); if (e.key === 'Escape') setSavingName(null); }}
                  />
                  <Button size="sm" className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-500 text-white" disabled={createPreset.isPending} onClick={handleSaveAsPreset}>
                    OK
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 text-white/60 hover:text-white hover:bg-white/10" onClick={() => setSavingName(null)}>✕</Button>
                </div>
              ) : loadedPresetId ? (
                // Con una plantilla cargada, "Actualizar" guarda los cambios
                // SOBRE ESA MISMA fila (PUT) -- antes esto no existía, y la
                // única opción (crear nueva) dejaba la original intacta y
                // duplicaba una plantilla por cada ajuste.
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={updatePreset.isPending}
                    onClick={handleUpdatePreset}
                    title="Guarda los cambios sobre la plantilla cargada"
                  >
                    {updatePreset.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                    Actualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                    title="Guardar como plantilla NUEVA (no toca la que está cargada)"
                    onClick={() => setSavingName('')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10" title="Guardar como plantilla" onClick={() => setSavingName('')}>
                  <Bookmark className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => setShowZones((v) => !v)}
                title={showZones ? 'Ocultar zonas de la cancha' : 'Mostrar zonas de la cancha'}
              >
                {showZones ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>

              <Button
                size="sm"
                variant={tacticsOpen ? 'default' : 'ghost'}
                className={`h-7 gap-1 text-[11px] px-2 ${tacticsOpen ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                onClick={() => setTacticsOpen((v) => !v)}
                title="Pizarra táctica: dibujar flechas de movimiento"
              >
                <PenLine className="h-3.5 w-3.5" />
                Pizarra{arrows.length > 0 ? ` (${arrows.length})` : ''}
              </Button>
            </>
          )}

          {/* pr-8: la X nativa del Dialog (absolute right-4 top-4) queda
              encima del último botón si el toolbar llega hasta el borde. */}
          <div className="ml-auto flex items-center gap-1.5 pr-8">
            {!loading && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-[11px] px-2 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setRosterOpen((v) => !v)}
              >
                {rosterOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                Plantilla ({availableSubjects.length + benchKeys.size})
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 text-white/60 hover:text-white hover:bg-white/10" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              onClick={handleSave}
              disabled={saveLineup.isPending || loading}
            >
              {saveLineup.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={() => setAlignGuides({ x: [], y: [] })}>
            {/* Fila: cancha (usa lo que sobre) + panel de plantilla a la
                derecha, en el margen lateral que antes quedaba vacío -- ya no
                tapa la cancha por abajo. El lado izquierdo se deja libre a
                propósito (futuro panel de tácticas), sin agregar nada ahí
                todavía para no saturar la pantalla. */}
            <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
              <div className="relative flex-1 min-h-0 flex items-center justify-center px-3 sm:px-6 py-3 overflow-hidden">
                {/* Ancho = alto de pantalla menos el toolbar (~90px) convertido
                    a ancho según la proporción de la cancha (300/340), topado
                    en 580px. El 100% final del min() ya cubre el caso de que
                    el panel de plantilla angoste el espacio disponible.
                    Verificado en pantalla real en varios tamaños. */}
                <div
                  ref={pitchRef}
                  className="relative w-[min(580px,calc((100dvh-90px)*300/340),100%)] aspect-[300/340] rounded-2xl overflow-hidden select-none shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
                >
                  <FootballPitchBackground />
                  {showZones && <ZoneOverlay />}
                  {emptySlots.map((es) => (
                    <EmptySlotMarker
                      key={es.id}
                      slot={es}
                      onRemove={() => setEmptySlots((prev) => prev.filter((s) => s.id !== es.id))}
                    />
                  ))}
                  {Object.entries(placed).map(([key, slot]) => {
                    const subject = subjectByKey.get(key);
                    if (!subject) return null;
                    return (
                      <PitchPin
                        key={key}
                        subject={subject}
                        slot={slot}
                        onLabelChange={(label) => setPlaced((prev) => ({ ...prev, [key]: { ...prev[key], slot_label: label, labelIsCustom: true } }))}
                        onRemove={() => removeFromPitch(key)}
                        onOpenCard={() => setCardSubject(subject)}
                        events={eventSummaryByKey.get(key)}
                        animate={animatingMove}
                      />
                    );
                  })}
                  {/* z-40: intercepta el puntero cuando drawMode o
                      measureMode están activos, así el gesto dibuja/mide en
                      vez de arrastrar a un jugador. El resto del tiempo es
                      pointer-events-none y los pines se arrastran normal --
                      salvo los handles de cada figura, que son siempre
                      interactivos (ver comentario dentro de ArrowLayer). */}
                  <ArrowLayer
                    shapes={arrows}
                    drawMode={drawMode}
                    drawShapeType={drawShapeType}
                    drawColor={drawColor}
                    measureMode={measureMode}
                    pitchLengthMeters={pitchLengthMeters}
                    onCreateShape={handleCreateShape}
                    onUpdateShape={handleUpdateShape}
                    onDeleteShape={handleDeleteShape}
                  />
                  {/* Guías de alineación mientras se arrastra un jugador ya
                      puesto -- puramente visuales, encima de todo (z-50). */}
                  {(alignGuides.x.length > 0 || alignGuides.y.length > 0) && (
                    <svg viewBox="0 0 300 340" preserveAspectRatio="none" className="absolute inset-0 w-full h-full z-50 pointer-events-none">
                      {alignGuides.x.map((x, i) => (
                        <line key={`x${i}`} x1={x * 3} y1={0} x2={x * 3} y2={340} stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
                      ))}
                      {alignGuides.y.map((y, i) => (
                        <line key={`y${i}`} x1={0} y1={y * 3.4} x2={300} y2={y * 3.4} stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
                      ))}
                    </svg>
                  )}
                </div>
              </div>

              {/* Panel de pizarra táctica -- a la izquierda, en el margen que
                  antes quedaba vacío. Se abre con el botón "Pizarra" del
                  toolbar. Todo pasa dentro del mismo modal del tablero, sin
                  vistas aparte. */}
              {tacticsOpen && (
                <div className="w-[220px] shrink-0 border-r border-white/10 bg-black/30 backdrop-blur-sm overflow-y-auto px-3 py-3 space-y-3 order-first">
                  <div>
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Pizarra táctica</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 gap-1.5 text-xs justify-start bg-transparent border-white/15 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 mb-1.5"
                      disabled={playingSequence}
                      onClick={handlePlayMovement}
                      title="Anima a cada jugador hasta la punta de su flecha/curva y lo devuelve -- se puede repetir"
                    >
                      <Play className="h-3.5 w-3.5" /> {playingSequence ? 'Reproduciendo…' : 'Reproducir jugada'}
                    </Button>
                    <Button
                      size="sm"
                      className={`w-full h-8 gap-1.5 text-xs justify-start ${drawMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/15'}`}
                      onClick={() => { setDrawMode((v) => !v); setMeasureMode(false); }}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      {drawMode ? 'Dibujando…' : 'Modo dibujo'}
                    </Button>
                    <p className="text-[10px] text-white/40 mt-1.5 leading-snug">
                      {drawMode
                        ? 'Arrastra sobre la cancha para dibujar. Los puntos blancos de cada figura se pueden arrastrar para ajustarla; tócala para borrarla.'
                        : 'Activa el modo dibujo y arrastra sobre la cancha. Ya puestas, cada figura se ajusta o se borra sin necesidad de este modo.'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Líneas</p>
                    <div className="flex gap-1.5">
                      {([
                        { type: 'arrow' as const, label: 'Flecha' },
                        { type: 'curve' as const, label: 'Curva' },
                        { type: 'zone' as const, label: 'Zona' },
                      ]).map((opt) => (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => setDrawShapeType(opt.type)}
                          className={`flex-1 h-7 rounded text-[10px] font-semibold border ${
                            drawShapeType === opt.type
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Objetos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(OBJECT_LABEL) as (keyof typeof OBJECT_LABEL)[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDrawShapeType(type)}
                          title={OBJECT_LABEL[type]}
                          className={`h-7 px-2 rounded text-[10px] font-semibold border ${
                            drawShapeType === type
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {OBJECT_LABEL[type]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/40 mt-1 leading-snug">
                      Un toque para colocarlo; tócalo de nuevo (sin arrastrar) para borrarlo.
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Color</p>
                    <div className="flex gap-2">
                      {(Object.keys(ARROW_COLOR_HEX) as TacticalArrowColor[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDrawColor(c)}
                          aria-label={`Color ${c}`}
                          className={`h-6 w-6 rounded-full border-2 transition-transform ${drawColor === c ? 'border-emerald-400 scale-110' : 'border-white/20'}`}
                          style={{ backgroundColor: ARROW_COLOR_HEX[c] }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 gap-1 text-[11px] bg-transparent border-white/15 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      disabled={arrows.length === 0}
                      onClick={() => setArrows((prev) => prev.slice(0, -1))}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Deshacer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 gap-1 text-[11px] bg-transparent border-white/15 text-white/80 hover:bg-white/10 hover:text-red-400 disabled:opacity-30"
                      disabled={arrows.length === 0}
                      onClick={() => setArrows([])}
                    >
                      <Eraser className="h-3.5 w-3.5" /> Borrar
                    </Button>
                  </div>

                  <p className="text-[10px] text-white/40">
                    {arrows.length} {arrows.length === 1 ? 'figura' : 'figuras'} · se guardan junto con la plantilla.
                  </p>

                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Medir distancia</p>
                    <Button
                      size="sm"
                      className={`w-full h-8 gap-1.5 text-xs justify-start ${measureMode ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-white/5 hover:bg-white/10 text-white border border-white/15'}`}
                      onClick={() => { setMeasureMode((v) => !v); setDrawMode(false); }}
                    >
                      <Ruler className="h-3.5 w-3.5" />
                      {measureMode ? 'Midiendo…' : 'Regla'}
                    </Button>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <label className="text-[10px] text-white/50 whitespace-nowrap">Largo cancha</label>
                      <Input
                        type="number"
                        min={1}
                        value={pitchLengthMeters}
                        onChange={(e) => setPitchLengthMeters(Math.max(1, Number(e.target.value) || 1))}
                        className="h-6 text-[10px] px-1.5 bg-white/5 border-white/15 text-white"
                      />
                      <span className="text-[10px] text-white/50">m</span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-1 leading-snug">
                      Toca 2 puntos en la cancha. Aproximado -- calculado a partir del largo que pongas arriba, no del tamaño real de tu cancha.
                    </p>
                  </div>
                </div>
              )}

              {/* Panel de plantilla/banca -- ahora es un panel lateral real
                  (no flotante encima de la cancha). Se abre y cierra con el
                  botón "Plantilla" del toolbar; el usuario decide si lo deja
                  visible todo el tiempo o lo oculta. */}
              {rosterOpen && (
                <div className="w-[260px] shrink-0 border-l border-white/10 bg-black/30 backdrop-blur-sm overflow-y-auto px-3 py-3 space-y-3">
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 gap-1.5 text-[11px] bg-transparent border-white/15 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      disabled={!canSuggestXI}
                      onClick={handleSuggestXI}
                      title={
                        Object.keys(placed).length > 0
                          ? 'Vacía la cancha primero -- no reemplaza una alineación ya armada'
                          : suggestibleCount < MIN_SUGGEST_SAMPLE
                            ? `Necesitas al menos ${MIN_SUGGEST_SAMPLE} jugadores con partidos registrados`
                            : 'Ubica un XI de partida ordenado por minutos jugados en la temporada'
                      }
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Sugerir XI
                    </Button>
                    <p className="text-[10px] text-white/40 mt-1 mb-2 leading-snug">
                      Por minutos jugados -- formación genérica, no la posición real de cada uno.
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">
                      Plantilla disponible ({availableSubjects.length})
                    </p>
                    {availableSubjects.length === 0 ? (
                      <p className="text-xs text-white/40 italic">Todos los jugadores ya están ubicados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {availableSubjects.map((s) => (
                          <BenchDraggable key={subjectKey(s.subject_type, s.subject_id)} subject={s} onOpenCard={() => setCardSubject(s)} />
                        ))}
                      </div>
                    )}
                    {availableSubjects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {availableSubjects.map((s) => {
                          const key = subjectKey(s.subject_type, s.subject_id);
                          return (
                            <Button
                              key={key}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-5 text-[9px] px-1.5 bg-transparent border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
                              onClick={() => toggleBench(key)}
                            >
                              + {s.full_name.split(' ')[0]} a banca
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">
                      Banca ({benchKeys.size})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(benchKeys).map((key) => {
                        const subject = subjectByKey.get(key);
                        if (!subject) return null;
                        return (
                          <Badge key={key} variant="secondary" className="gap-1.5 pr-1 bg-white/10 text-white border border-white/15 hover:bg-white/15 text-[11px]">
                            {subject.full_name}
                            <button type="button" onClick={() => toggleBench(key)} aria-label="Quitar de la banca">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DndContext>
        )}
      </DialogContent>
    </Dialog>
    {cardSubject && roster && (
      <PlayerCard
        open={!!cardSubject}
        onClose={() => setCardSubject(null)}
        subject={cardSubject}
        metrics={roster.metrics}
        latestValues={roster.latest_values}
      />
    )}
    </>
  );
}
