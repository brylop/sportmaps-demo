/**
 * «Videos de la escuela» (M6h): lista de videos subidos (del equipo de la
 * pizarra primero), estado de procesamiento y entrada al reproductor con clips.
 */
import { useCallback, useEffect, useState } from 'react';
import { Film, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BFFError } from '@/lib/api/bffClient';
import {
  SOURCE_LABEL, STATUS_LABEL, deleteSchoolVideo, formatClock, listSchoolVideos, syncVideoStatus, type SchoolVideo,
} from '@/lib/school/schoolVideos';
import { VideoClipsPlayer } from './VideoClipsPlayer';

export interface VideoLibraryTabProps {
  teamId?: string | null;
  lineupId?: string | null;
  canEdit: boolean;
  /** Cambia cuando se sube uno nuevo (recarga la lista). */
  refreshKey?: number;
}

const msg = (err: unknown) => (err instanceof BFFError ? ((err.body as any)?.error ?? err.message) : (err as Error)?.message) || 'Algo falló.';

export function VideoLibraryTab({ teamId, lineupId, canEdit, refreshKey = 0 }: VideoLibraryTabProps) {
  const [videos, setVideos] = useState<SchoolVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SchoolVideo | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await listSchoolVideos();
      // Los del equipo de la pizarra primero; el resto de la escuela después.
      setVideos([...all].sort((a, b) => Number(b.team_id === teamId) - Number(a.team_id === teamId)));
    } catch (err) { setError(msg(err)); setVideos([]); }
  }, [teamId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function refresh(v: SchoolVideo) {
    setBusyId(v.id);
    try { await syncVideoStatus(v.id); await load(); } catch (err) { setError(msg(err)); } finally { setBusyId(null); }
  }

  async function remove(v: SchoolVideo) {
    if (!window.confirm(`¿Borrar «${v.title}» y sus clips? No se puede deshacer.`)) return;
    setBusyId(v.id);
    try { await deleteSchoolVideo(v.id); setVideos((vs) => (vs ?? []).filter((x) => x.id !== v.id)); }
    catch (err) { setError(msg(err)); } finally { setBusyId(null); }
  }

  if (selected) {
    return <VideoClipsPlayer video={selected} lineupId={lineupId} canEdit={canEdit} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-2" data-testid="video-library-tab">
      {videos === null && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {videos?.length === 0 && !error && (
        <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay videos subidos. Sube el primero en «Subir video».</p>
      )}
      <ul className="space-y-1.5">
        {videos?.map((v) => (
          <li key={v.id} className="flex items-center gap-2 rounded-md border p-2">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
              disabled={v.status !== 'ready'} onClick={() => setSelected(v)} aria-label={`Abrir ${v.title}`}>
              <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-slate-800 text-white/80"><Film className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{v.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {SOURCE_LABEL[v.source] ?? v.source}
                  {v.duration_s != null ? ` · ${formatClock(v.duration_s)}` : ''}
                  {v.recorded_at ? ` · ${v.recorded_at}` : ''}
                  {teamId && v.team_id === teamId ? ' · este equipo' : ''}
                </span>
              </span>
            </button>
            <Badge variant={v.status === 'ready' ? 'secondary' : v.status === 'failed' ? 'destructive' : 'outline'} className="shrink-0">
              {STATUS_LABEL[v.status]}
            </Badge>
            {(v.status === 'processing' || v.status === 'uploading') && canEdit && (
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Actualizar estado"
                disabled={busyId === v.id} onClick={() => void refresh(v)}>
                <RefreshCw className={`h-4 w-4 ${busyId === v.id ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {canEdit && (
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Borrar ${v.title}`}
                disabled={busyId === v.id} onClick={() => void remove(v)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
