/**
 * Subtítulo bajo la cancha (M6c): la nota del cuadro. Al reproducir sigue al
 * reloj (solo se re-renderiza esta franja); quieto, muestra la del cuadro
 * abierto. Sin notas en la jugada no ocupa lugar.
 */
import { useSyncExternalStore } from 'react';
import { MessageSquareText } from 'lucide-react';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import { frameStartMs, type PlaybackClock } from '@/lib/school/tacticalAnimation';
import { NoteText } from './NoteText';

/** Cuadro al que va (o en el que está) la reproducción en el instante t. */
export function frameIndexAt(frames: Pick<TacticalFrame, 'duration_ms'>[], tMs: number): number {
  for (let i = 0; i < frames.length; i++) if (frameStartMs(frames, i) >= tMs) return i;
  return Math.max(0, frames.length - 1);
}

const zero = () => 0;
const noSub = () => () => {};

export function FrameNoteBar({ frames, frameIndex, clock, playing, compact = false }: {
  frames: TacticalFrame[];
  frameIndex: number;
  clock: PlaybackClock;
  /** true mientras se reproduce o está en pausa (la cancha muestra el reloj). */
  playing: boolean;
  compact?: boolean;
}) {
  const t = useSyncExternalStore(playing ? clock.subscribe : noSub, playing ? clock.get : zero, playing ? clock.get : zero);
  if (frames.length < 2 || !frames.some((f) => f.note)) return null;
  const idx = playing ? frameIndexAt(frames, t) : Math.min(frameIndex, frames.length - 1);
  const note = frames[idx]?.note ?? '';
  return (
    <div className="shrink-0 px-3 sm:px-6 pb-1" aria-live={playing ? 'polite' : 'off'}>
      <div
        data-testid="frame-note-bar"
        className={`mx-auto max-w-[640px] flex items-start gap-2 rounded-lg px-3 ${compact ? 'py-1 text-xs' : 'py-1.5 text-sm'} ${note ? 'bg-black/70 text-white ring-1 ring-white/10' : 'text-white/40'}`}
      >
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 pt-0.5">
          <MessageSquareText className="h-3.5 w-3.5" /> {idx + 1}
        </span>
        {note ? <NoteText text={note} className="min-w-0 leading-snug" /> : <span className="text-xs pt-0.5">Cuadro sin nota</span>}
      </div>
    </div>
  );
}
