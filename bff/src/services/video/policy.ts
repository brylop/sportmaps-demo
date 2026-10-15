/**
 * Reglas puras de los videos subidos (M6h): tipos permitidos, tamaño,
 * duración y vida de las URLs firmadas. Sin red ni base: se prueban solas.
 * Los topes de la ESCUELA (cupo, máximo por archivo) los aplica además la RPC
 * begin_school_video_upload con FOR UPDATE; estos son los techos de plataforma.
 */

/** MP4 (Android, Veo, Hudl…), MOV (iPhone), WebM (grabación desde el navegador). */
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export type AllowedVideoType = (typeof ALLOWED_VIDEO_TYPES)[number];

const envInt = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/** Techo de plataforma por archivo: 4 GB (un partido de 90' en 1080p del celular ≈ 6–9 GB a 9–13 Mbps; se pide exportar a 720p). */
export const PLATFORM_MAX_UPLOAD_BYTES = () => envInt('VIDEO_UPLOAD_MAX_BYTES', 4 * 1024 ** 3);
/** Techo de plataforma por video: 3 h. */
export const PLATFORM_MAX_DURATION_S = () => envInt('VIDEO_UPLOAD_MAX_DURATION_S', 3 * 3600);
/** URL firmada: por defecto 15 min, entre 1 min y 6 h (un partido largo en pausa). */
export const PLAYBACK_TTL_DEFAULT_S = () => envInt('VIDEO_PLAYBACK_TTL_S', 15 * 60);
export const PLAYBACK_TTL_MIN_S = 60;
export const PLAYBACK_TTL_MAX_S = 6 * 3600;

export const VIDEO_SOURCES = ['phone', 'veo', 'hudl', 'trace', 'pixellot', 'other'] as const;
export type VideoSource = (typeof VIDEO_SOURCES)[number];

export const TITLE_MAX = 120;
export const CLIP_TITLE_MAX = 120;

export function normalizeMime(raw: unknown): string {
  return String(raw ?? '').split(';')[0].trim().toLowerCase();
}

export function isAllowedVideoType(mime: unknown): mime is AllowedVideoType {
  return (ALLOWED_VIDEO_TYPES as readonly string[]).includes(normalizeMime(mime));
}

export function clampTtl(requested?: unknown): number {
  const n = Number(requested);
  const base = Number.isFinite(n) && n > 0 ? Math.floor(n) : PLAYBACK_TTL_DEFAULT_S();
  return Math.min(Math.max(base, PLAYBACK_TTL_MIN_S), PLAYBACK_TTL_MAX_S);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/** Texto plano corto: sin etiquetas ni caracteres de control. */
export function cleanTitle(raw: unknown, max = TITLE_MAX): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > max) return null;
  return t;
}

export interface UploadRequest {
  title: string;
  sizeBytes: number;
  mimeType: AllowedVideoType;
  maxDurationS: number;
  teamId: string | null;
  source: VideoSource;
  recordedAt: string | null;
}

export type UploadParse =
  | { ok: true; value: UploadRequest }
  | { ok: false; status: 413 | 415 | 422; error: string };

/** Valida el pedido de subida ANTES de reservar cupo o llamar al proveedor. */
export function parseUploadRequest(body: any): UploadParse {
  const title = cleanTitle(body?.title);
  if (!title) return { ok: false, status: 422, error: 'Ponle un título al video (máximo 120 caracteres).' };

  if (!isAllowedVideoType(body?.mime_type)) {
    return { ok: false, status: 415, error: 'Formato no permitido. Sube MP4, MOV (iPhone) o WebM.' };
  }
  const size = Number(body?.size_bytes);
  if (!Number.isSafeInteger(size) || size <= 0) {
    return { ok: false, status: 422, error: 'Tamaño del archivo inválido.' };
  }
  if (size > PLATFORM_MAX_UPLOAD_BYTES()) {
    const gb = (PLATFORM_MAX_UPLOAD_BYTES() / 1024 ** 3).toFixed(0);
    return { ok: false, status: 413, error: `El archivo pesa más de ${gb} GB. Expórtalo en 720p o córtalo antes de subirlo.` };
  }

  // Duración: la que mide el navegador (metadata del archivo) + margen; sin
  // dato, el techo. Nunca más que el techo.
  const declared = Number(body?.duration_s);
  const maxDur = PLATFORM_MAX_DURATION_S();
  let maxDurationS = maxDur;
  if (Number.isFinite(declared) && declared > 0) {
    if (declared > maxDur) {
      return { ok: false, status: 422, error: `El video dura más de ${Math.round(maxDur / 3600)} h. Córtalo antes de subirlo.` };
    }
    maxDurationS = Math.min(maxDur, Math.ceil(declared) + 60);
  }

  let teamId: string | null = null;
  if (body?.team_id != null && body.team_id !== '') {
    if (!isUuid(body.team_id)) return { ok: false, status: 422, error: 'Equipo inválido.' };
    teamId = body.team_id;
  }
  const source = (VIDEO_SOURCES as readonly string[]).includes(body?.source) ? (body.source as VideoSource) : 'phone';

  let recordedAt: string | null = null;
  if (body?.recorded_at) {
    if (typeof body.recorded_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.recorded_at)
        || Number.isNaN(Date.parse(body.recorded_at))) {
      return { ok: false, status: 422, error: 'Fecha de grabación inválida (AAAA-MM-DD).' };
    }
    recordedAt = body.recorded_at;
  }

  return { ok: true, value: { title, sizeBytes: size, mimeType: normalizeMime(body.mime_type) as AllowedVideoType, maxDurationS, teamId, source, recordedAt } };
}

export interface ClipInput {
  title: string;
  startS: number;
  endS: number;
  lineupId: string | null;
  presetId: string | null;
  exerciseId: string | null;
}

export type ClipParse = { ok: true; value: ClipInput } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseClip(body: any, durationS: number | null): ClipParse {
  const title = cleanTitle(body?.title, CLIP_TITLE_MAX);
  if (!title) return { ok: false, error: 'Ponle un nombre al clip.' };
  const startS = Number(body?.start_s);
  const endS = Number(body?.end_s);
  if (!Number.isFinite(startS) || !Number.isFinite(endS) || startS < 0) {
    return { ok: false, error: 'Marca el inicio y el fin del clip.' };
  }
  if (endS - startS < 1) return { ok: false, error: 'El clip debe durar al menos 1 segundo y terminar después de empezar.' };
  if (durationS != null && endS > durationS + 1) return { ok: false, error: 'El clip termina después del final del video.' };
  const links = ['lineup_id', 'preset_id', 'exercise_id'].filter((k) => body?.[k] != null && body[k] !== '');
  if (links.length > 1) return { ok: false, error: 'Un clip se vincula a una sola jugada.' };
  for (const k of links) if (!isUuid(body[k])) return { ok: false, error: 'Jugada inválida.' };
  return {
    ok: true,
    value: {
      title, startS: round2(startS), endS: round2(endS),
      lineupId: body?.lineup_id || null, presetId: body?.preset_id || null, exerciseId: body?.exercise_id || null,
    },
  };
}
