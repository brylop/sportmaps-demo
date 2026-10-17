/**
 * «Subir video» (M6h): del celular (cámara o galería) o un MP4 descargado de
 * Veo/Hudl/…, directo al proveedor con subida reanudable. Barra de progreso,
 * cancelar, y si se cae la red espera y sigue sola donde iba.
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, FolderOpen, Loader2, UploadCloud, WifiOff, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { BFFError } from '@/lib/api/bffClient';
import { ResumableUpload, UploadCancelledError, type UploadProgress, type UploadStatus } from '@/lib/school/resumableUpload';
import {
  SOURCE_LABEL, VIDEO_SOURCES, createVideoUpload, defaultTitleFromFile, deleteSchoolVideo, formatBytes, formatClock,
  quotaLabel, readVideoDuration, syncVideoStatus, validateVideoFile, type VideoSettings, type VideoSource,
} from '@/lib/school/schoolVideos';

type Phase = 'pick' | 'ready' | 'starting' | 'uploading' | 'done' | 'error';

export interface UploadVideoTabProps {
  settings: VideoSettings;
  teamId?: string | null;
  initialSource?: VideoSource;
  onUploaded?: (videoId: string) => void;
}

function errorText(err: unknown): string {
  if (err instanceof BFFError) {
    const body = (err.body ?? {}) as { error?: string; code?: string };
    if (body.code === 'QUOTA_EXCEEDED') return 'Tu escuela llegó al cupo de videos. Borra videos viejos o pide más cupo a SportMaps.';
    if (body.code === 'VIDEOS_DISABLED') return 'Los videos subidos estarán disponibles pronto para tu escuela.';
    return body.error || err.message;
  }
  return (err as Error)?.message || 'No se pudo subir el video.';
}

export function UploadVideoTab({ settings, teamId, initialSource = 'phone', onUploaded }: UploadVideoTabProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [mime, setMime] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<VideoSource>(initialSource);
  const [recordedAt, setRecordedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({ sent: 0, total: 0, percent: 0 });
  const [status, setStatus] = useState<UploadStatus>('idle');
  const uploadRef = useRef<ResumableUpload | null>(null);
  const videoIdRef = useRef<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSource(initialSource); }, [initialSource]);
  // Si se cierra el diálogo a mitad de subida, se corta (la reserva la devuelve el cancelar).
  useEffect(() => () => { uploadRef.current?.cancel(); }, []);

  async function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    const check = validateVideoFile(f, settings.max_upload_bytes);
    if (!check.ok) { setError((check as { error: string }).error); setFile(null); setPhase('pick'); return; }
    setFile(f);
    setMime(check.mime);
    setTitle(defaultTitleFromFile(f.name));
    setPhase('ready');
    const d = await readVideoDuration(f);
    setDuration(d);
    if (d != null && d > settings.max_duration_s) {
      setError(`El video dura ${formatClock(d)} y el máximo es ${formatClock(settings.max_duration_s)}. Córtalo antes de subirlo.`);
    }
  }

  async function start() {
    if (!file || !title.trim()) return;
    setError(null);
    setPhase('starting');
    try {
      const res = await createVideoUpload({
        title: title.trim(), mime_type: mime, size_bytes: file.size, duration_s: duration,
        team_id: teamId ?? null, source, recorded_at: recordedAt || null,
      });
      videoIdRef.current = res.video_id;
      const up = new ResumableUpload({
        file,
        endpoint: res.upload.endpoint,
        headers: res.upload.headers,
        metadata: res.upload.metadata,
        chunkSize: res.upload.chunkSize,
        onProgress: setProgress,
        onStatus: (s) => setStatus(s),
      });
      uploadRef.current = up;
      setPhase('uploading');
      await up.start();
      setPhase('done');
      // Si el aviso del proveedor tarda, el estado se pide igual.
      syncVideoStatus(res.video_id).catch(() => undefined);
      onUploaded?.(res.video_id);
    } catch (err) {
      if (err instanceof UploadCancelledError) return; // cancel() ya dejó todo en orden
      setError(errorText(err));
      setPhase('error');
    }
  }

  async function cancel() {
    uploadRef.current?.cancel();
    uploadRef.current = null;
    const id = videoIdRef.current;
    videoIdRef.current = null;
    setPhase(file ? 'ready' : 'pick');
    setStatus('cancelled');
    setProgress({ sent: 0, total: 0, percent: 0 });
    // Devuelve la reserva de cupo y borra el hueco en el proveedor.
    if (id) await deleteSchoolVideo(id).catch(() => undefined);
  }

  function reset() {
    uploadRef.current = null;
    videoIdRef.current = null;
    setFile(null); setDuration(null); setTitle(''); setRecordedAt(''); setError(null);
    setProgress({ sent: 0, total: 0, percent: 0 }); setStatus('idle'); setPhase('pick');
  }

  const busy = phase === 'starting' || phase === 'uploading';

  return (
    <div className="space-y-4" data-testid="upload-video-tab">
      <p className="text-xs text-muted-foreground">
        Cupo de la escuela: <span className="font-medium text-foreground">{quotaLabel(settings)}</span>. Solo lo ve el cuerpo técnico.
      </p>

      {/* Dos entradas: «capture» abre la cámara directo en el celular; la otra, la galería/archivos. */}
      <input ref={cameraRef} type="file" accept="video/*" capture="environment" className="hidden"
        data-testid="video-input-camera" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden"
        data-testid="video-input-file" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

      {(phase === 'pick' || phase === 'ready' || phase === 'error') && (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-auto min-h-16 flex-col gap-1 py-3" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-5 w-5" /> <span className="text-sm">Grabar con la cámara</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto min-h-16 flex-col gap-1 py-3" onClick={() => galleryRef.current?.click()}>
            <FolderOpen className="h-5 w-5" /> <span className="text-sm">Elegir un video</span>
          </Button>
        </div>
      )}

      {file && phase !== 'done' && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="text-sm">
            <span className="font-medium break-all">{file.name}</span>
            <span className="text-muted-foreground"> · {formatBytes(file.size)}{duration != null ? ` · ${formatClock(duration)}` : ''}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs space-y-1 sm:col-span-3">
              <span className="text-muted-foreground">Título</span>
              <Input value={title} maxLength={120} disabled={busy} onChange={(e) => setTitle(e.target.value)} aria-label="Título del video" />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Origen</span>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={source} disabled={busy}
                onChange={(e) => setSource(e.target.value as VideoSource)} aria-label="Origen del video">
                {VIDEO_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Fecha de grabación</span>
              <Input type="date" value={recordedAt} disabled={busy} onChange={(e) => setRecordedAt(e.target.value)} aria-label="Fecha de grabación" />
            </label>
          </div>
        </div>
      )}

      {busy && (
        <div className="space-y-2" data-testid="upload-progress">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {status === 'offline' ? <WifiOff className="h-4 w-4 text-amber-600" /> : <Loader2 className="h-4 w-4 animate-spin" />}
              {phase === 'starting' && 'Preparando la subida…'}
              {phase === 'uploading' && status === 'offline' && 'Sin conexión: seguirá sola cuando vuelva la señal.'}
              {phase === 'uploading' && status === 'retrying' && 'Conexión inestable, reintentando…'}
              {phase === 'uploading' && (status === 'uploading' || status === 'idle') && 'Subiendo…'}
            </span>
            <span className="tabular-nums font-medium" data-testid="upload-percent">{progress.percent}%</span>
          </div>
          <Progress value={progress.percent} aria-label="Progreso de la subida" />
          <p className="text-xs text-muted-foreground">
            {formatBytes(progress.sent)} de {formatBytes(progress.total || file?.size || 0)} · No cierres esta ventana mientras sube.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void cancel()}>
            <X className="h-4 w-4 mr-1" /> Cancelar subida
          </Button>
        </div>
      )}

      {phase === 'done' && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" role="status">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Video subido</div>
          <p className="mt-1 text-xs">Se está procesando: en unos minutos aparece en «Videos de la escuela» listo para recortar clips.</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={reset}>Subir otro</Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {(phase === 'ready' || phase === 'error') && file && (
        <Button type="button" className="w-full" disabled={!title.trim() || (duration != null && duration > settings.max_duration_s)} onClick={() => void start()}>
          <UploadCloud className="h-4 w-4 mr-1" /> Subir video
        </Button>
      )}
    </div>
  );
}
