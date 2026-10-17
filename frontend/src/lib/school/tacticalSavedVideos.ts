/**
 * «Videos guardados» por escuela (M6c): enlaces que el cuerpo técnico reusa en
 * varias jugadas. BFF: /api/v1/school/tactical/videos (tacticalVideos.ts).
 * Solo enlaces: cero almacenamiento.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { hydrateVideo, type PlayVideo } from './tacticalMedia';

export interface SavedVideo extends PlayVideo {
  id: string;
  created_by: string | null;
  created_at: string;
}

export interface SavedVideosResponse {
  videos: SavedVideo[];
  /** false = la migración todavía no está aplicada en esta base. */
  available: boolean;
}

const BASE = '/api/v1/school/tactical/videos';
const KEY = ['tactical-saved-videos'];

export async function listSavedVideos(): Promise<SavedVideosResponse> {
  const r = await bffClient.get<SavedVideosResponse>(BASE);
  const videos = (r?.videos ?? []).flatMap((row) => {
    const v = hydrateVideo(row);
    return v ? [{ ...v, id: row.id, created_by: row.created_by ?? null, created_at: row.created_at }] : [];
  });
  return { videos, available: r?.available !== false };
}

export function useSavedVideos(enabled: boolean) {
  return useQuery({ queryKey: KEY, queryFn: listSavedVideos, enabled, staleTime: 60_000 });
}

export function useSaveVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PlayVideo) => bffClient.post<SavedVideo>(BASE, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSavedVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffClient.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
