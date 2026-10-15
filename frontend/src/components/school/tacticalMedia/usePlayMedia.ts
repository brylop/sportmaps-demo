/**
 * Estado de notas + videos de la jugada abierta en la pizarra (M6c). La
 * pizarra solo engancha: hydrate() al cargar una jugada, payload() al guardar.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  hydrateNotes, hydrateVideos, serializeNotes, serializeVideos,
  type PlayNotes, type PlayVideo,
} from '@/lib/school/tacticalMedia';

export interface PlayMedia {
  notes: PlayNotes | null;
  videos: PlayVideo[];
  setNotes: (n: PlayNotes | null) => void;
  setVideos: (v: PlayVideo[]) => void;
  /** Carga lo que trae una fila (alineación, Mis jugadas o board de la biblioteca). */
  hydrate: (row: { notes?: unknown; videos?: unknown } | null | undefined) => void;
  /** Para el body del BFF: siempre presentes (null = sin notas / sin videos). */
  payload: () => { notes: PlayNotes | null; videos: PlayVideo[] | null };
  /** Tags de la nota (para la biblioteca). */
  tags: string[];
  /** Texto de la nota de la jugada («intención» para la IA). */
  intention: string;
  count: { notes: number; videos: number };
}

export function usePlayMedia(): PlayMedia {
  const [notes, setNotesState] = useState<PlayNotes | null>(null);
  const [videos, setVideosState] = useState<PlayVideo[]>([]);
  const setNotes = useCallback((n: PlayNotes | null) => setNotesState(serializeNotes(n)), []);
  const setVideos = useCallback((v: PlayVideo[]) => setVideosState(hydrateVideos(v)), []);
  const hydrate = useCallback((row: { notes?: unknown; videos?: unknown } | null | undefined) => {
    setNotesState(hydrateNotes(row?.notes));
    setVideosState(hydrateVideos(row?.videos));
  }, []);
  const payload = useCallback(() => ({ notes: serializeNotes(notes), videos: serializeVideos(videos) }), [notes, videos]);
  return useMemo(() => ({
    notes, videos, setNotes, setVideos, hydrate, payload,
    tags: notes?.tags ?? [],
    intention: notes?.text ?? '',
    count: { notes: notes ? 1 : 0, videos: videos.length },
  }), [notes, videos, setNotes, setVideos, hydrate, payload]);
}
