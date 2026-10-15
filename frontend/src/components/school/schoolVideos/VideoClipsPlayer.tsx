/**
 * Reproductor de un video subido + clips (M6h): marcar inicio/fin, nombrar el
 * clip y «Vincular a esta jugada». Los clips son virtuales (inicio/fin sobre el
 * mismo video): no ocupan cupo ni crean otro video en el proveedor.
 *
 * Reproducción por URL firmada que vence; nunca se guarda ni se muestra la URL.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Link2, Loader2, Play, Scissors, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BFFError } from '@/lib/api/bffClient';
import { createPlayerBridge, type PlayerBridge } from '@/lib/school/playerJsBridge';
import {
  createVideoClip, deleteVideoClip, formatClock, getVideoPlayback, listVideoClips, parseClock, playbackTtlFor,
  updateVideoClip, type PlaybackInfo, type SchoolVideo, type VideoClip,
} from '@/lib/school/schoolVideos';

export interface VideoClipsPlayerProps {
  video: SchoolVideo;
  /** Jugada abierta en la pizarra (match_lineups.id). Sin guardar = null. */
  lineupId?: string | null;
  canEdit: boolean;
  onBack: () => void;
}

const msg = (err: unknown) => (err instanceof BFFError ? ((err.body as any)?.error ?? err.message) : (err as Error)?.message) || 'Algo falló.';

export function VideoClipsPlayer({ video, lineupId, canEdit, onBack }: VideoClipsPlayerProps) {
  const [playback, setPlayback] = useState<PlaybackInfo | null>(null);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState(!!lineupId);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bridgeRef = useRef<PlayerBridge | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([getVideoPlayback(video.id, playbackTtlFor(video.duration_s)), listVideoClips(video.id)])
      .then(([p, c]) => { if (alive) { setPlayback(p); setClips(c); } })
      .catch((err) => { if (alive) setError(msg(err)); });
    return () => { alive = false; };
  }, [video.id, video.duration_s]);

  useEffect(() => () => { bridgeRef.current?.dispose(); }, []);

  const onIframeLoad = () => {
    bridgeRef.current?.dispose();
    if (iframeRef.current) bridgeRef.current = createPlayerBridge(iframeRef.current);
  };

  const currentTime = useCallback(async (): Promise<number | null> => {
    if (playback?.kind === 'video') return videoRef.current ? videoRef.current.currentTime : null;
    return bridgeRef.current ? bridgeRef.current.getCurrentTime() : null;
  }, [playback?.kind]);

  async function mark(which: 'start' | 'end') {
    setHint(null);
    const t = await currentTime();
    if (t == null) { setHint('El reproductor no respondió: escribe el minuto a mano (ej. 12:30).'); return; }
    (which === 'start' ? setStart : setEnd)(formatClock(t));
  }

  function seek(sec: number) {
    if (playback?.kind === 'video' && videoRef.current) {
      videoRef.current.currentTime = sec;
      void videoRef.current.play().catch(() => undefined);
    } else {
      bridgeRef.current?.setCurrentTime(sec);
      bridgeRef.current?.play();
    }
  }

  async function saveClip() {
    setError(null);
    const s = parseClock(start);
    const e = parseClock(end);
    if (s == null || e == null) { setError('Marca el inicio y el fin (ej. 12:30).'); return; }
    if (e - s < 1) { setError('El fin debe ir al menos 1 segundo después del inicio.'); return; }
    if (video.duration_s != null && e > video.duration_s + 1) { setError('El clip termina después del final del video.'); return; }
    setSaving(true);
    try {
      const clip = await createVideoClip(video.id, {
        title: title.trim() || `Clip ${formatClock(s)}`, start_s: s, end_s: e, lineup_id: link && lineupId ? lineupId : null,
      });
      setClips((cs) => [...cs, clip].sort((a, b) => a.start_s - b.start_s));
      setStart(''); setEnd(''); setTitle('');
    } catch (err) { setError(msg(err)); } finally { setSaving(false); }
  }

  async function linkClip(c: VideoClip) {
    if (!lineupId) return;
    try {
      const upd = await updateVideoClip(c.id, { lineup_id: lineupId });
      setClips((cs) => cs.map((x) => (x.id === c.id ? upd : x)));
    } catch (err) { setError(msg(err)); }
  }

  async function removeClip(c: VideoClip) {
    try {
      await deleteVideoClip(c.id);
      setClips((cs) => cs.filter((x) => x.id !== c.id));
    } catch (err) { setError(msg(err)); }
  }

  return (
    <div className="space-y-3" data-testid="video-clips-player">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Videos</Button>
        <h3 className="min-w-0 truncate text-sm font-semibold">{video.title}</h3>
        {video.duration_s != null && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatClock(video.duration_s)}</span>}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        {!playback && !error && <div className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {playback?.kind === 'iframe' && (
          <iframe
            ref={iframeRef}
            title={`Video: ${video.title}`}
            src={playback.url}
            onLoad={onIframeLoad}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        {playback?.kind === 'video' && (
          <video ref={videoRef} src={playback.url} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full" />
        )}
      </div>

      {canEdit && playback && (
        <div className="rounded-md border p-3 space-y-2" data-testid="clip-form">
          <div className="flex items-center gap-1 text-sm font-medium"><Scissors className="h-4 w-4" /> Nuevo clip</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex gap-1">
              <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Inicio 0:00" aria-label="Inicio del clip" inputMode="decimal" />
              <Button type="button" size="sm" variant="outline" onClick={() => void mark('start')}>Marcar</Button>
            </div>
            <div className="flex gap-1">
              <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Fin 0:00" aria-label="Fin del clip" inputMode="decimal" />
              <Button type="button" size="sm" variant="outline" onClick={() => void mark('end')}>Marcar</Button>
            </div>
          </div>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre (ej. Salida por la izquierda)" aria-label="Nombre del clip" />
          <label className={`flex items-center gap-2 text-xs ${lineupId ? '' : 'text-muted-foreground'}`}>
            <input type="checkbox" checked={link && !!lineupId} disabled={!lineupId} onChange={(e) => setLink(e.target.checked)} />
            Vincular a esta jugada {lineupId ? '' : '(guarda la jugada primero)'}
          </label>
          {hint && <p className="text-xs text-amber-700">{hint}</p>}
          <Button type="button" size="sm" disabled={saving} onClick={() => void saveClip()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Scissors className="mr-1 h-4 w-4" />} Guardar clip
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clips ({clips.length})</h4>
        {clips.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay clips de este video.</p>}
        <ul className="space-y-1" data-testid="clip-list">
          {clips.map((c) => {
            const linkedHere = !!lineupId && c.lineup_id === lineupId;
            return (
              <li key={c.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Ver clip ${c.title}`} onClick={() => seek(Number(c.start_s))}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{formatClock(Number(c.start_s))}–{formatClock(Number(c.end_s))}</span>
                {linkedHere && <Badge variant="secondary" className="shrink-0">En esta jugada</Badge>}
                {canEdit && lineupId && !linkedHere && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => void linkClip(c)}>
                    <Link2 className="mr-1 h-3.5 w-3.5" /> Vincular a esta jugada
                  </Button>
                )}
                {canEdit && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Borrar clip ${c.title}`} onClick={() => void removeClip(c)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
