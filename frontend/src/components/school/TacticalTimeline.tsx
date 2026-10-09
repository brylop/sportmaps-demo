/**
 * Línea de tiempo de la jugada animada por cuadros (T1 de
 * docs/specs/pizarra-nivel-tacticalpad.md §5) y la capa que dibuja la
 * reproducción sobre la cancha.
 *
 * El tiempo de reproducción vive en un reloj observable (PlaybackClock): el
 * bucle de requestAnimationFrame lo escribe y solo se re-renderizan la barra
 * de progreso y la capa de reproducción, no el tablero entero 60 veces por
 * segundo.
 */
import { memo, useMemo, useSyncExternalStore, type ReactNode, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import {
  FRAME_DURATION_CHOICES_MS, MAX_FRAMES, type TacticalFrame,
} from '@/lib/school/tacticalFrames';
import {
  PLAYBACK_SPEEDS, frameStartMs, groupArrowsByOpacity, interpolateFrames,
  type InterpolatedPlayer, type PlaybackClock, type PlaybackSpeed, type PlayState,
} from '@/lib/school/tacticalAnimation';
import { isPointShape, viewBoxOf, yToView, type PitchView } from '@/lib/school/tacticalGeometry';
import { BallGlyph } from './tacticalGlyphs';

export type { PlayState, PlaybackSpeed };

/** Tiempo actual del reloj, re-renderizando solo a quien lo usa. */
function useClockTime(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}

const speedLabel = (s: number) => `${String(s).replace('.', ',')}×`;
const secondsLabel = (ms: number) => `${String(ms / 1000).replace('.', ',')} s`;

// ─── Miniatura ──────────────────────────────────────────────────────────────

/** Miniatura liviana: puntos y trazos finos, no el SVG completo de la cancha
 *  (con 30 cuadros el render estático entero pesaba demasiado). */
const FrameThumb = memo(function FrameThumb({ frame }: { frame: TacticalFrame }) {
  return (
    <svg viewBox="0 0 30 34" className="h-full w-full" aria-hidden="true">
      <rect x={0.5} y={0.5} width={29} height={33} rx={2} fill="#166534" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.6} />
      <line x1={0.5} y1={17} x2={29.5} y2={17} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.5} />
      {frame.arrows.map((a, i) => {
        if (isPointShape(a.type) || a.type === 'text') {
          return <circle key={i} cx={a.x1 * 0.3} cy={a.y1 * 0.34} r={0.9} fill={a.type === 'ball' ? '#ffffff' : '#fbbf24'} />;
        }
        if (a.type === 'zone' || a.type === 'freehand') return null;
        return <line key={i} x1={a.x1 * 0.3} y1={a.y1 * 0.34} x2={a.x2 * 0.3} y2={a.y2 * 0.34} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={0.5} />;
      })}
      {frame.players.map((p) => (
        <circle key={p.key} cx={p.x * 0.3} cy={p.y * 0.34} r={1.4} fill="#34d399" stroke="#022c22" strokeWidth={0.3} />
      ))}
      {frame.ball && <circle cx={frame.ball.x * 0.3} cy={frame.ball.y * 0.34} r={1} fill="#ffffff" />}
    </svg>
  );
});

// ─── Barra de progreso ──────────────────────────────────────────────────────

function ProgressBar({ clock, frames, totalMs, onSeek }: {
  clock: PlaybackClock;
  frames: TacticalFrame[];
  totalMs: number;
  onSeek?: (tMs: number) => void;
}) {
  const t = useClockTime(clock);
  const pct = totalMs > 0 ? Math.min(100, (t / totalMs) * 100) : 0;
  return (
    <div
      className={`relative h-1.5 w-full rounded-full bg-white/15 ${onSeek ? 'cursor-pointer' : ''}`}
      role="progressbar"
      aria-label="Avance de la jugada"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      onPointerDown={onSeek ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * totalMs);
      } : undefined}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
      {totalMs > 0 && frames.slice(1, -1).map((f, i) => (
        <span key={f.id} className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-white/50"
          style={{ left: `${(frameStartMs(frames, i + 1) / totalMs) * 100}%` }} />
      ))}
    </div>
  );
}

// ─── Línea de tiempo ────────────────────────────────────────────────────────

export interface TacticalTimelineProps {
  mode: 'edit' | 'view';
  frames: TacticalFrame[];
  currentIndex: number;
  playState: PlayState;
  clock: PlaybackClock;
  totalMs: number;
  speed: PlaybackSpeed;
  loop: boolean;
  onPlayPause: () => void;
  onSeek?: (tMs: number) => void;
  onSpeedChange: (s: PlaybackSpeed) => void;
  onLoopChange: (v: boolean) => void;
  // Solo edición:
  onSelect?: (index: number) => void;
  onAdd?: () => void;
  onDelete?: (index: number) => void;
  onMove?: (from: number, to: number) => void;
  onDurationChange?: (index: number, ms: number) => void;
}

const BTN = 'h-11 min-w-11 shrink-0 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 px-2 transition-colors disabled:opacity-30 disabled:pointer-events-none';
const BTN_IDLE = 'bg-white/5 border-white/15 text-white/85 hover:bg-white/10';
const BTN_ON = 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500';

export function TacticalTimeline(props: TacticalTimelineProps) {
  const {
    mode, frames, currentIndex, playState, clock, totalMs, speed, loop,
    onPlayPause, onSeek, onSpeedChange, onLoopChange,
    onSelect, onAdd, onDelete, onMove, onDurationChange,
  } = props;
  const n = frames.length;
  const playing = playState === 'playing';
  const playBtn = (
    <button
      type="button"
      className={`${BTN} ${playing ? BTN_ON : BTN_IDLE} w-11`}
      onClick={onPlayPause}
      disabled={n < 2}
      aria-label={playing ? 'Pausa' : 'Reproducir cuadros'}
      title={n < 2 ? 'Agrega un cuadro para animar la jugada' : playing ? 'Pausa' : 'Reproducir la jugada cuadro por cuadro'}
    >
      {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4" />}
    </button>
  );

  if (mode === 'view') {
    if (n < 2) return null;
    return (
      <div className="shrink-0 border-t border-white/10 bg-black/30 px-3 py-1.5 flex items-center gap-2" aria-label="Línea de tiempo">
        {playBtn}
        <div className="flex-1 min-w-0"><ProgressBar clock={clock} frames={frames} totalMs={totalMs} onSeek={onSeek} /></div>
        <span className="text-[11px] tabular-nums text-white/70 shrink-0">{n} cuadros</span>
      </div>
    );
  }

  const locked = playState !== 'stopped';
  const handleDragStart = (i: number) => (e: DragEvent) => {
    e.dataTransfer.setData('text/x-frame-index', String(i));
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/x-frame-index'));
    if (Number.isInteger(from) && from !== i) onMove?.(from, i);
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/30 px-2 sm:px-3 pt-1.5 pb-1.5 space-y-1.5" aria-label="Línea de tiempo">
      {n > 1 && <ProgressBar clock={clock} frames={frames} totalMs={totalMs} onSeek={onSeek} />}
      <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        {playBtn}
        <div className="flex items-center gap-1.5" role="list" aria-label="Cuadros">
          {frames.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="listitem"
              draggable={!locked}
              onDragStart={handleDragStart(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(i)}
              onClick={() => onSelect?.(i)}
              aria-label={`Cuadro ${i + 1}`}
              aria-current={i === currentIndex ? 'true' : undefined}
              title={i === 0 ? 'Cuadro 1: posición inicial' : `Cuadro ${i + 1} (${secondsLabel(f.duration_ms)} para llegar)`}
              className={`relative h-12 w-11 shrink-0 rounded-md p-0.5 ring-2 transition ${
                i === currentIndex && !locked ? 'ring-emerald-400 bg-emerald-500/20' : 'ring-white/10 bg-white/5 hover:ring-white/30'
              }`}
            >
              <FrameThumb frame={f} />
              <span className="absolute -top-1 -left-1 h-4 min-w-4 px-0.5 rounded-full bg-zinc-950 ring-1 ring-white/40 text-[9px] font-black leading-4 text-white">
                {i + 1}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${BTN} ${BTN_IDLE} whitespace-nowrap`}
          onClick={onAdd}
          disabled={n >= MAX_FRAMES || locked}
          title={n >= MAX_FRAMES ? `Máximo ${MAX_FRAMES} cuadros` : 'Copia el cuadro actual para mover a los jugadores desde ahí'}
        >
          <Plus className="h-4 w-4" /> Cuadro
        </button>
        {n < 2 && (
          <span className="text-[11px] text-white/60 leading-tight min-w-[160px]">
            Agrega cuadros y mueve a los jugadores en cada uno para animar la jugada.
          </span>
        )}
      </div>

      {n > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <span className="text-[11px] font-semibold text-white/80 whitespace-nowrap px-1">
            Cuadro {currentIndex + 1} de {n}
          </span>
          <button type="button" className={`${BTN} ${BTN_IDLE}`} aria-label="Mover el cuadro a la izquierda"
            disabled={locked || currentIndex === 0} onClick={() => onMove?.(currentIndex, currentIndex - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className={`${BTN} ${BTN_IDLE}`} aria-label="Mover el cuadro a la derecha"
            disabled={locked || currentIndex >= n - 1} onClick={() => onMove?.(currentIndex, currentIndex + 1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          {currentIndex > 0 && (
            <label className="flex items-center gap-1 text-[11px] text-white/70 whitespace-nowrap">
              Tiempo
              <select
                className="h-11 rounded-lg border border-white/15 bg-zinc-900 px-2 text-xs text-white"
                value={frames[currentIndex].duration_ms}
                disabled={locked}
                onChange={(e) => onDurationChange?.(currentIndex, Number(e.target.value))}
                aria-label="Tiempo para llegar a este cuadro"
              >
                {!FRAME_DURATION_CHOICES_MS.includes(frames[currentIndex].duration_ms as (typeof FRAME_DURATION_CHOICES_MS)[number]) && (
                  <option value={frames[currentIndex].duration_ms}>{secondsLabel(frames[currentIndex].duration_ms)}</option>
                )}
                {FRAME_DURATION_CHOICES_MS.map((ms) => <option key={ms} value={ms}>{secondsLabel(ms)}</option>)}
              </select>
            </label>
          )}
          <button type="button" className={`${BTN} ${BTN_IDLE} hover:text-red-400`} aria-label="Quitar este cuadro"
            title="Quitar este cuadro" disabled={locked} onClick={() => onDelete?.(currentIndex)}>
            <Trash2 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-6 w-px bg-white/15 shrink-0" />
          <div className="flex items-center gap-1" role="group" aria-label="Velocidad">
            {PLAYBACK_SPEEDS.map((s) => (
              <button key={s} type="button" className={`${BTN} ${speed === s ? BTN_ON : BTN_IDLE}`}
                aria-pressed={speed === s} onClick={() => onSpeedChange(s)}>
                {speedLabel(s)}
              </button>
            ))}
          </div>
          <button type="button" className={`${BTN} ${loop ? BTN_ON : BTN_IDLE} whitespace-nowrap`}
            aria-pressed={loop} onClick={() => onLoopChange(!loop)} title="Volver a empezar al terminar">
            <Repeat className="h-4 w-4" /> Repetir
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Capa de reproducción ───────────────────────────────────────────────────

export interface TacticalFramePlaybackProps {
  frames: TacticalFrame[];
  clock: PlaybackClock;
  view: PitchView;
  /** Ficha del jugador en (x, y) % de cancha completa, con su opacidad. */
  renderPlayer: (p: InterpolatedPlayer, topPct: number) => ReactNode;
  /** Capa de figuras (solo lectura) con una opacidad común. */
  renderShapes: (shapes: TacticalArrow[], opacity: number, layerKey: string) => ReactNode;
}

/** Dibuja la jugada interpolada en el instante del reloj. Reemplaza a los
 *  pines y a la capa de dibujo mientras se reproduce o está en pausa. */
export function TacticalFramePlayback({ frames, clock, view, renderPlayer, renderShapes }: TacticalFramePlaybackProps) {
  const t = useClockTime(clock);
  const state = useMemo(() => interpolateFrames(frames, t), [frames, t]);
  const groups = groupArrowsByOpacity(state.arrows);
  return (
    <div className="absolute inset-0 z-[35] pointer-events-none" aria-hidden="true">
      {groups.map((g) => (
        <div key={`g${g.opacity}`} className="absolute inset-0" style={{ opacity: g.opacity }}>
          {renderShapes(g.shapes, g.opacity, `g${g.opacity}`)}
        </div>
      ))}
      {state.players.map((p) => {
        const top = yToView(p.y, view);
        if (top < -1 || top > 101) return null;
        return renderPlayer(p, top);
      })}
      {state.ball && (
        <svg viewBox={viewBoxOf(view)} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <g transform={`translate(${state.ball.x * 3} ${state.ball.y * 3.4})`} opacity={state.ball.opacity}>
            <BallGlyph r={4} />
          </g>
        </svg>
      )}
    </div>
  );
}
