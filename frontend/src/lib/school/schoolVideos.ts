/**
 * Videos subidos de la pizarra — M6h fase 1 (docs/specs/pizarra-m6h-videos-subidos.md).
 * Llamadas al BFF (bff/src/routes/school/videos.ts) y lógica pura: validación
 * del archivo, relojes mm:ss, guía de importación por plataforma.
 *
 * Privacidad (spec §5): un video es SOLO del cuerpo técnico en esta fase. La
 * reproducción es por URL firmada que vence; nunca se guarda ni se comparte la
 * URL. Nada de esto se muestra a padres ni atletas.
 */
import { bffClient } from '@/lib/api/bffClient';

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const VIDEO_SOURCES = ['phone', 'veo', 'hudl', 'trace', 'pixellot', 'other'] as const;
export type VideoSource = (typeof VIDEO_SOURCES)[number];
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';

export const SOURCE_LABEL: Record<VideoSource, string> = {
  phone: 'Celular', veo: 'Veo', hudl: 'Hudl', trace: 'Trace', pixellot: 'Pixellot', other: 'Otra cámara',
};
export const STATUS_LABEL: Record<VideoStatus, string> = {
  uploading: 'Subiendo', processing: 'Procesando', ready: 'Listo', failed: 'Falló', deleted: 'Borrado',
};

export interface VideoSettings {
  enabled: boolean;
  school_flag: boolean;
  provider_configured: boolean;
  quota_seconds: number;
  quota_bytes: number;
  used_seconds: number;
  used_bytes: number;
  max_upload_bytes: number;
  max_duration_s: number;
}

export interface SchoolVideo {
  id: string;
  school_id: string;
  team_id: string | null;
  provider: string;
  status: VideoStatus;
  duration_s: number | null;
  size_bytes: number | null;
  title: string;
  recorded_at: string | null;
  source: VideoSource;
  created_by: string | null;
  created_at: string;
}

export interface VideoClip {
  id: string;
  video_id: string;
  start_s: number;
  end_s: number;
  title: string;
  lineup_id: string | null;
  preset_id: string | null;
  exercise_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DirectUploadInfo {
  protocol: 'tus';
  endpoint: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  expiresAt: string;
  chunkSize: number;
}

export interface CreateUploadResponse {
  video_id: string;
  upload: DirectUploadInfo;
}

export interface PlaybackInfo {
  kind: 'iframe' | 'video';
  url: string;
  thumbnailUrl?: string | null;
  expiresAt: string;
  ttl_s: number;
  duration_s: number | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────
const BASE = '/api/v1/school';

export const fetchVideoSettings = () => bffClient.get<VideoSettings>(`${BASE}/videos/settings`);
export const listSchoolVideos = async (teamId?: string | null) =>
  (await bffClient.get<{ videos: SchoolVideo[] }>(`${BASE}/videos${teamId ? `?team_id=${encodeURIComponent(teamId)}` : ''}`)).videos;
export const createVideoUpload = (body: {
  title: string; mime_type: string; size_bytes: number; duration_s?: number | null;
  team_id?: string | null; source: VideoSource; recorded_at?: string | null;
}) => bffClient.post<CreateUploadResponse>(`${BASE}/videos/uploads`, body);
export const syncVideoStatus = (id: string) => bffClient.post<{ status: VideoStatus }>(`${BASE}/videos/${id}/sync`, {});
/** TTL pedido = duración + 30 min (el BFF lo acota a 1 min–6 h): que no venza a mitad del partido. */
export const playbackTtlFor = (durationS: number | null | undefined) =>
  Math.round(Math.max(15 * 60, (durationS ?? 0) + 30 * 60));
export const getVideoPlayback = (id: string, ttlS?: number) =>
  bffClient.get<PlaybackInfo>(`${BASE}/videos/${id}/playback${ttlS ? `?ttl=${Math.round(ttlS)}` : ''}`);
export const deleteSchoolVideo = (id: string) => bffClient.delete<{ ok: true }>(`${BASE}/videos/${id}`);
export const listVideoClips = async (videoId: string) =>
  (await bffClient.get<{ clips: VideoClip[] }>(`${BASE}/videos/${videoId}/clips`)).clips;
export const createVideoClip = async (videoId: string, body: { title: string; start_s: number; end_s: number; lineup_id?: string | null }) =>
  (await bffClient.post<{ clip: VideoClip }>(`${BASE}/videos/${videoId}/clips`, body)).clip;
export const updateVideoClip = async (clipId: string, body: Partial<Pick<VideoClip, 'title' | 'start_s' | 'end_s' | 'lineup_id'>>) =>
  (await bffClient.patch<{ clip: VideoClip }>(`${BASE}/video-clips/${clipId}`, body)).clip;
export const deleteVideoClip = (clipId: string) => bffClient.delete<{ ok: true }>(`${BASE}/video-clips/${clipId}`);

// ─── Archivo ─────────────────────────────────────────────────────────────────
const EXT_TYPE: Record<string, (typeof ALLOWED_VIDEO_TYPES)[number]> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', qt: 'video/quicktime', webm: 'video/webm',
};

/** Tipo del archivo; algunos Android lo mandan vacío → por extensión. */
export function videoMimeOf(file: { type?: string; name?: string }): string | null {
  const t = String(file.type ?? '').split(';')[0].trim().toLowerCase();
  if ((ALLOWED_VIDEO_TYPES as readonly string[]).includes(t)) return t;
  if (t && t !== 'application/octet-stream') return null;
  const ext = String(file.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  return EXT_TYPE[ext] ?? null;
}

export type FileCheck = { ok: true; mime: string } | { ok: false; error: string };

export function validateVideoFile(file: { type?: string; name?: string; size: number }, maxBytes: number): FileCheck {
  const mime = videoMimeOf(file);
  if (!mime) return { ok: false, error: 'Ese archivo no es un video compatible. Sube MP4, MOV (iPhone) o WebM.' };
  if (!(file.size > 0)) return { ok: false, error: 'El archivo está vacío.' };
  if (maxBytes > 0 && file.size > maxBytes) {
    return { ok: false, error: `El video pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(maxBytes)}. Expórtalo en 720p o córtalo.` };
  }
  return { ok: true, mime };
}

/** Duración leyendo solo la metadata (no carga el video). null si el navegador no puede. */
export function readVideoDuration(file: Blob, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let done = false;
    const finish = (d: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      resolve(d != null && Number.isFinite(d) && d > 0 ? d : null);
    };
    const t = setTimeout(() => finish(null), timeoutMs);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => finish(v.duration);
    v.onerror = () => finish(null);
    v.src = url;
  });
}

export function defaultTitleFromFile(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (base || 'Video').slice(0, 120);
}

// ─── Formatos ────────────────────────────────────────────────────────────────
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 MB';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
  const mb = n / 1024 ** 2;
  // Por debajo de 10 MB con un decimal: «0,5 de 1,2 MB» dice más que «1 de 1».
  return mb < 10 ? `${Math.max(0.1, mb).toFixed(1).replace('.', ',')} MB` : `${Math.round(mb)} MB`;
}

/** 83 → «1:23»; 3723 → «1:02:03». */
export function formatClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '–:–';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** «1:23», «01:02:03», «95», «1:23,5» → segundos. null si no se entiende. */
export function parseClock(raw: string): number | null {
  const t = String(raw ?? '').trim().replace(',', '.');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const [, h, mm, ss] = m;
  if (Number(mm) > 59 && h) return null;
  if (Number(ss) >= 60) return null;
  return (h ? Number(h) * 3600 : 0) + Number(mm) * 60 + Number(ss);
}

export function quotaLabel(s: Pick<VideoSettings, 'used_seconds' | 'quota_seconds' | 'used_bytes' | 'quota_bytes'>): string {
  const hUsed = (s.used_seconds / 3600).toFixed(1).replace('.', ',');
  const hQuota = Math.round(s.quota_seconds / 3600);
  return `${hUsed} de ${hQuota} h · ${formatBytes(s.used_bytes)} de ${formatBytes(s.quota_bytes)}`;
}

// ─── Importar de cámaras y plataformas (spec §4) ─────────────────────────────
export interface ImportSource {
  id: string;
  name: string;
  /** Cómo sacar el MP4 (pasos cortos, verificados en la ayuda oficial cuando se pudo). */
  steps: string[];
  /** ¿Se puede pegar el enlace en «Videos» de la jugada (M6c)? */
  link: boolean;
  /** Valor para el campo «origen» al subirlo. */
  source: VideoSource;
  note?: string;
}

export const IMPORT_SOURCES: ImportSource[] = [
  {
    id: 'veo', name: 'Veo', source: 'veo', link: true,
    steps: [
      'Abre la grabación en app.veo.co (el partido debe estar asignado a tu equipo).',
      'Toca «Download» arriba del video → «Download full game» (en el celular: el engranaje).',
      'Para jugadas sueltas: «Highlights» → descarga el resumen o cada clip.',
      'Vuelve acá a «Subir video», elige el MP4 y en «Origen» marca Veo.',
    ],
    note: 'Veo solo deja descargar la vista que sigue el balón; los dibujos de Veo no vienen en el archivo.',
  },
  {
    id: 'hudl', name: 'Hudl', source: 'hudl', link: true,
    steps: [
      'En Hudl abre el video del partido o la lista de clips.',
      'Usa «Download» (o pide el enlace de descarga por correo): llega un MP4 o un ZIP con los clips.',
      'Sube aquí el MP4 (o cada clip del ZIP) con origen Hudl.',
    ],
  },
  {
    id: 'trace', name: 'Trace', source: 'trace', link: true,
    steps: [
      'En la app de Trace abre el partido.',
      'Descarga el partido completo o tus highlights (la descarga completa depende del plan del club).',
      'Súbelo aquí con origen Trace.',
    ],
  },
  {
    id: 'pixellot', name: 'Pixellot / VidSwap', source: 'pixellot', link: true,
    steps: [
      'En la plataforma de Pixellot (o VidSwap) abre el evento.',
      'Descarga el video o los highlights (ZIP).',
      'Súbelo aquí con origen Pixellot.',
    ],
  },
  {
    id: 'otras', name: 'Spiideo, XbotGo, Reeplayer, PlaySight', source: 'other', link: true,
    steps: [
      'Descarga el video desde la app de la cámara a tu celular o computador.',
      'Súbelo aquí con origen «Otra cámara».',
    ],
    note: 'Si la app solo da un enlace para ver, pégalo en «Videos» de la jugada (no ocupa cupo).',
  },
  {
    id: 'phone', name: 'Cámara del celular', source: 'phone', link: false,
    steps: [
      'Toca «Grabar con la cámara» en «Subir video», o graba con la cámara normal y luego «Elegir video».',
      'Graba en horizontal y en 720p o 1080p a 30 fps: pesa menos y sube más rápido.',
      'Con datos móviles, mejor espera a tener wifi para los partidos completos.',
    ],
  },
];
