/**
 * Notas y videos de una jugada (pizarra M6c, docs/specs/pizarra-m6-paridad-tacticalpad.md).
 * Validación del jsonb `notes` / `videos` de match_lineups y team_tactical_presets
 * (migración 20261014163705), de board.notes / board.videos de training_exercises
 * y de la nota de cada cuadro. Lógica pura: sin Express ni Supabase.
 *
 * Mismos topes que lib/school/tacticalMedia.ts (frontend) y que las funciones
 * tactical_play_notes_ok / tactical_play_videos_ok de los CHECK de la base.
 *
 *   notes  = { text: string ≤ 2000, tags: string[] ≤ 10 (≤ 40 c/u) }
 *   videos = [{ provider, video_id?, hash?, url?, asset_id?, title, start_s, end_s, is_private }] ≤ 10
 *
 * El texto de las notas es dato del coach: se rechaza con 422 si trae HTML o
 * `javascript:` (el frontend ya lo quita al guardar; un cliente que lo mande
 * igual no llega a la base). Los enlaces se validan con lista EXACTA de
 * dominios y regex del id: el frontend arma el iframe desde el id, nunca desde
 * una URL del cliente.
 */

export const NOTE_TEXT_MAX = 2000;
export const FRAME_NOTE_MAX = 280;
export const NOTE_TAGS_MAX = 10;
export const NOTE_TAG_MAX_LEN = 40;
export const PLAY_VIDEOS_MAX = 10;
export const VIDEO_TITLE_MAX = 120;
export const VIDEO_URL_MAX = 500;
export const VIDEO_TIME_MAX_S = 6 * 3600;
export const SAVED_VIDEOS_MAX = 300;

export const EMBED_PROVIDERS = ['youtube', 'vimeo'] as const;
export const LINK_PROVIDERS = ['veo', 'hudl', 'trace', 'pixellot', 'spiideo', 'xbotgo', 'reeplayer', 'drive', 'dropbox'] as const;
/** 'sportmaps' = video subido (bloque M6h): reservado, sin implementar. */
export const VIDEO_PROVIDERS = [...EMBED_PROVIDERS, ...LINK_PROVIDERS, 'sportmaps'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

/** Dominio exacto → proveedor (igual que VIDEO_HOSTS del frontend). */
export const LINK_HOSTS: Record<string, (typeof LINK_PROVIDERS)[number]> = {
  'veo.co': 'veo', 'www.veo.co': 'veo', 'app.veo.co': 'veo',
  'hudl.com': 'hudl', 'www.hudl.com': 'hudl', 'fan.hudl.com': 'hudl',
  'traceup.com': 'trace', 'www.traceup.com': 'trace', 'app.traceup.com': 'trace',
  'pixellot.tv': 'pixellot', 'www.pixellot.tv': 'pixellot', 'app.pixellot.tv': 'pixellot',
  'vidswap.com': 'pixellot', 'www.vidswap.com': 'pixellot',
  'spiideo.com': 'spiideo', 'www.spiideo.com': 'spiideo', 'play.spiideo.com': 'spiideo', 'app.spiideo.com': 'spiideo',
  'xbotgo.com': 'xbotgo', 'www.xbotgo.com': 'xbotgo', 'app.xbotgo.com': 'xbotgo',
  'reeplayer.com': 'reeplayer', 'www.reeplayer.com': 'reeplayer', 'app.reeplayer.com': 'reeplayer',
  'drive.google.com': 'drive',
  'dropbox.com': 'dropbox', 'www.dropbox.com': 'dropbox',
};

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const VIMEO_ID_RE = /^\d{6,12}$/;
export const VIMEO_HASH_RE = /^[0-9a-f]{6,20}$/;
export const DRIVE_ID_RE = /^[A-Za-z0-9_-]{20,100}$/;
export const ASSET_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const MARKUP_RE = /<\s*\/?\s*[a-z!?][^>]*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i;
export const hasMarkup = (v: unknown) => typeof v === 'string' && MARKUP_RE.test(v);
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Normaliza saltos y quita caracteres de control (no valida el tope). */
export function cleanText(v: string): string {
  return v.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(CONTROL_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface PlayNotes { text: string; tags: string[] }

/** `notes` del body. undefined = no tocar; null = borrar. */
export function validatePlayNotes(raw: unknown): { errors: string[]; value: PlayNotes | null } {
  if (raw === null) return { errors: [], value: null };
  if (!isPlainObject(raw)) return { errors: ['notes debe ser un objeto { text, tags } o null.'], value: null };
  const errors: string[] = [];
  let text = '';
  if (raw.text !== undefined && raw.text !== null) {
    if (typeof raw.text !== 'string') errors.push('notes.text debe ser texto.');
    else {
      text = cleanText(raw.text);
      if (text.length > NOTE_TEXT_MAX) errors.push(`La nota es demasiado larga: máximo ${NOTE_TEXT_MAX} caracteres.`);
      if (hasMarkup(text)) errors.push('La nota trae HTML o código: no se permite.');
    }
  }
  const tags: string[] = [];
  if (raw.tags !== undefined && raw.tags !== null) {
    if (!Array.isArray(raw.tags)) errors.push('notes.tags debe ser una lista.');
    else {
      for (const t of raw.tags) {
        if (typeof t !== 'string') { errors.push('Cada etiqueta debe ser texto.'); break; }
        const v = t.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!v) continue;
        if (v.length > NOTE_TAG_MAX_LEN) { errors.push(`Etiqueta demasiado larga: máximo ${NOTE_TAG_MAX_LEN} caracteres.`); break; }
        if (hasMarkup(v) || /[<>"`\\]/.test(v)) { errors.push('Una etiqueta trae caracteres no permitidos.'); break; }
        if (!tags.includes(v)) tags.push(v);
      }
      if (tags.length > NOTE_TAGS_MAX) errors.push(`Demasiadas etiquetas: máximo ${NOTE_TAGS_MAX}.`);
    }
  }
  for (const k of Object.keys(raw)) if (k !== 'text' && k !== 'tags') { errors.push(`notes.${k.slice(0, 20)} no es un campo de la nota.`); break; }
  if (errors.length) return { errors, value: null };
  return { errors, value: text || tags.length ? { text, tags } : null };
}

/** Nota de un cuadro: texto corto o ausente. Devuelve el texto limpio o los errores. */
export function validateFrameNote(raw: unknown, n: number): { error: string | null; value: string | undefined } {
  if (raw === undefined || raw === null || raw === '') return { error: null, value: undefined };
  if (typeof raw !== 'string') return { error: `cuadro ${n}: note debe ser texto.`, value: undefined };
  const t = cleanText(raw);
  if (t.length > FRAME_NOTE_MAX) return { error: `cuadro ${n}: la nota es demasiado larga (máximo ${FRAME_NOTE_MAX} caracteres).`, value: undefined };
  if (hasMarkup(t)) return { error: `cuadro ${n}: la nota trae HTML o código.`, value: undefined };
  return { error: null, value: t || undefined };
}

export interface PlayVideo {
  provider: VideoProvider;
  video_id?: string;
  hash?: string;
  url?: string;
  asset_id?: string;
  title: string;
  start_s: number;
  end_s: number | null;
  is_private: boolean;
}

/** URL de un proveedor de enlace: https, dominio exacto, sin usuario/puerto. */
export function checkLinkUrl(provider: string, raw: unknown): { error: string | null; url?: string; video_id?: string } {
  if (typeof raw !== 'string' || !raw || raw.length > VIDEO_URL_MAX) return { error: 'url inválida.' };
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001F\u007F<>"`\\]/.test(raw) || !/^https:\/\//i.test(raw)) return { error: 'url inválida: debe ser https.' };
  let u: URL;
  try { u = new URL(raw); } catch { return { error: 'url inválida.' }; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return { error: 'url inválida.' };
  const host = u.hostname.toLowerCase();
  if (LINK_HOSTS[host] !== provider) return { error: `url no corresponde a ${provider}.` };
  const path = u.pathname.replace(/\/+$/, '');
  if (!path) return { error: 'url sin video.' };
  if (provider === 'drive') {
    const m = /^\/file\/d\/([^/]+)(?:\/(?:view|preview))?$/.exec(path);
    if (!m || !DRIVE_ID_RE.test(m[1])) return { error: 'url de Google Drive inválida (debe ser un archivo).' };
    return { error: null, url: `https://drive.google.com/file/d/${m[1]}/view`, video_id: m[1] };
  }
  if (provider === 'dropbox' && !/^\/(s|scl\/fi)\//.test(path)) return { error: 'url de Dropbox inválida.' };
  return { error: null, url: `https://${host}${u.pathname}${u.search}` };
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= VIDEO_TIME_MAX_S;

/** Un video. `where` antecede los errores («video 2: …»). */
export function validateVideo(raw: unknown, where: string): { errors: string[]; value: PlayVideo | null } {
  if (!isPlainObject(raw)) return { errors: [`${where}: debe ser un objeto.`], value: null };
  const errors: string[] = [];
  const provider = raw.provider;
  if (!(VIDEO_PROVIDERS as readonly unknown[]).includes(provider)) {
    return { errors: [`${where}: proveedor no soportado (${String(provider).slice(0, 20)}).`], value: null };
  }
  const out: PlayVideo = { provider, title: '', start_s: 0, end_s: null, is_private: false };
  if (provider === 'youtube') {
    if (typeof raw.video_id !== 'string' || !YOUTUBE_ID_RE.test(raw.video_id)) errors.push(`${where}: id de YouTube inválido.`);
    else out.video_id = raw.video_id;
  } else if (provider === 'vimeo') {
    if (typeof raw.video_id !== 'string' || !VIMEO_ID_RE.test(raw.video_id)) errors.push(`${where}: id de Vimeo inválido.`);
    else out.video_id = raw.video_id;
    if (raw.hash !== undefined && raw.hash !== null) {
      if (typeof raw.hash !== 'string' || !VIMEO_HASH_RE.test(raw.hash)) errors.push(`${where}: clave privada de Vimeo inválida.`);
      else out.hash = raw.hash;
    }
  } else if (provider === 'sportmaps') {
    if (typeof raw.asset_id !== 'string' || !ASSET_ID_RE.test(raw.asset_id)) errors.push(`${where}: asset_id inválido.`);
    else out.asset_id = raw.asset_id.toLowerCase();
  } else {
    const r = checkLinkUrl(provider, raw.url);
    if (r.error) errors.push(`${where}: ${r.error}`);
    else { out.url = r.url; if (r.video_id) out.video_id = r.video_id; }
  }
  if (typeof raw.title !== 'string' || !cleanText(raw.title)) errors.push(`${where}: falta el título.`);
  else {
    const t = cleanText(raw.title).replace(/\n+/g, ' ');
    if (t.length > VIDEO_TITLE_MAX) errors.push(`${where}: título demasiado largo (máximo ${VIDEO_TITLE_MAX}).`);
    else if (hasMarkup(t)) errors.push(`${where}: el título trae HTML o código.`);
    else out.title = t;
  }
  const start = raw.start_s ?? 0;
  if (!isTime(start)) errors.push(`${where}: start_s debe ser un entero entre 0 y ${VIDEO_TIME_MAX_S}.`);
  else out.start_s = start;
  if (raw.end_s !== undefined && raw.end_s !== null) {
    if (!isTime(raw.end_s) || raw.end_s <= (isTime(start) ? start : 0)) errors.push(`${where}: end_s debe ser posterior al inicio.`);
    else out.end_s = raw.end_s;
  }
  if (raw.is_private !== undefined && typeof raw.is_private !== 'boolean') errors.push(`${where}: is_private debe ser true/false.`);
  else out.is_private = raw.is_private === true;
  return errors.length ? { errors, value: null } : { errors, value: out };
}

/** `videos` del body. null = borrar; [] = sin videos (se guarda null). */
export function validatePlayVideos(raw: unknown): { errors: string[]; value: PlayVideo[] | null } {
  if (raw === null) return { errors: [], value: null };
  if (!Array.isArray(raw)) return { errors: ['videos debe ser una lista o null.'], value: null };
  if (raw.length > PLAY_VIDEOS_MAX) return { errors: [`Demasiados videos: máximo ${PLAY_VIDEOS_MAX} por jugada.`], value: null };
  const errors: string[] = [];
  const out: PlayVideo[] = [];
  raw.forEach((v, i) => {
    const r = validateVideo(v, `video ${i + 1}`);
    errors.push(...r.errors);
    if (r.value) out.push(r.value);
  });
  if (errors.length) return { errors, value: null };
  return { errors, value: out.length ? out : null };
}

/** notes + videos del body de una jugada: undefined = no tocar la columna. */
export function parseMediaBody(body: Record<string, unknown>): {
  errors: string[];
  fields: { notes?: PlayNotes | null; videos?: PlayVideo[] | null };
} {
  const errors: string[] = [];
  const fields: { notes?: PlayNotes | null; videos?: PlayVideo[] | null } = {};
  if (body.notes !== undefined) {
    const r = validatePlayNotes(body.notes);
    errors.push(...r.errors);
    if (!r.errors.length) fields.notes = r.value;
  }
  if (body.videos !== undefined) {
    const r = validatePlayVideos(body.videos);
    errors.push(...r.errors);
    if (!r.errors.length) fields.videos = r.value;
  }
  return { errors, fields };
}

/** Exportación pública (paquetes): sin los videos de «enlace privado». */
export function publicVideos(videos: PlayVideo[] | null | undefined): PlayVideo[] | null {
  const list = (videos ?? []).filter((v) => !v.is_private);
  return list.length ? list : null;
}

/** Columnas notes/videos sin aplicar (migración 20261014163705): 42703 / PGRST204. */
export function isMissingMediaColumn(err: unknown): boolean {
  if (!isPlainObject(err)) return false;
  const code = String(err.code ?? '');
  const msg = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`;
  return (code === '42703' || code === 'PGRST204') && /\b(notes|videos)\b/.test(msg);
}

/** Tabla tactical_saved_videos sin aplicar: 42P01 / PGRST205. */
export function isMissingSavedVideosTable(err: unknown): boolean {
  if (!isPlainObject(err)) return false;
  const code = String(err.code ?? '');
  return (code === '42P01' || code === 'PGRST205') && /tactical_saved_videos/.test(`${err.message ?? ''} ${err.details ?? ''}`);
}
