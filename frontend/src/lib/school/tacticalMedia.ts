/**
 * Notas y videos de una jugada (M6c, docs/specs/pizarra-m6-paridad-tacticalpad.md).
 *
 * Lógica pura (sin React): parser de enlaces de video, saneo de notas, el
 * markdown mínimo que se permite (negrita, lista, salto de línea) y la
 * entrada/salida del jsonb `notes` / `videos`.
 *
 * Reglas de seguridad:
 *   · Un enlace solo se acepta si su dominio está en la lista EXACTA de abajo,
 *     es http(s) (se sube a https), sin usuario/clave ni puerto. Cualquier otro
 *     esquema (javascript:, data:, file:…) se rechaza antes de parsear.
 *   · Solo YouTube (youtube-nocookie) y Vimeo se incrustan: tienen un embed
 *     público documentado con una URL que se arma desde un id validado con
 *     regex estricta. Las cámaras y plataformas (Veo, Hudl, Trace, Pixellot,
 *     Spiideo, XbotGo, Reeplayer) y los archivos de Drive/Dropbox salen como
 *     tarjeta «Ver en … ↗» en una pestaña nueva: nunca un iframe a un dominio
 *     sin embed verificado.
 *   · Las notas se guardan como texto con un markdown mínimo y se pintan como
 *     elementos de React (nunca dangerouslySetInnerHTML). Igual se quitan las
 *     etiquetas HTML y los `javascript:` al guardar: el BFF rechaza texto con
 *     marcado (mismo criterio que los paquetes de la biblioteca).
 *   · Cero almacenamiento: ningún archivo se sube. `provider = 'sportmaps'`
 *     (video subido desde el celular, bloque M6h) solo está reservado en el
 *     tipo y en el validador; no se crea desde acá.
 */

// ─── Topes (mismos del BFF tacticalMediaShapes.ts y de los CHECK de la base) ──
export const NOTE_TEXT_MAX = 2000;
export const FRAME_NOTE_MAX = 280;
export const NOTE_TAGS_MAX = 10;
export const NOTE_TAG_MAX_LEN = 40;
export const PLAY_VIDEOS_MAX = 10;
export const VIDEO_TITLE_MAX = 120;
export const VIDEO_URL_MAX = 500;
/** 6 h: cubre un partido completo con alargue y una jornada de torneo grabada. */
export const VIDEO_TIME_MAX_S = 6 * 3600;
export const SAVED_VIDEOS_MAX = 300;

// ─── Etiquetas ──────────────────────────────────────────────────────────────
/** Fases (momentos) del juego. Son etiquetas: filtran en la biblioteca. */
export const PHASE_TAGS = [
  'ataque organizado', 'defensa organizada', 'transición ofensiva', 'transición defensiva', 'balón parado',
] as const;
/** Objetivos frecuentes (los mismos de los chips de la biblioteca). */
export const OBJECTIVE_TAGS = [
  'posesión', 'salida de balón', 'presión', 'finalización', 'contraataque', 'marcaje', 'juego aéreo', 'rondo',
  'conducción', 'calentamiento',
] as const;

export function normalizeTag(raw: string): string {
  return String(raw ?? '')
    .replace(/[<>"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, NOTE_TAG_MAX_LEN);
}

export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const v = normalizeTag(t);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= NOTE_TAGS_MAX) break;
  }
  return out;
}

// ─── Notas ──────────────────────────────────────────────────────────────────
export interface PlayNotes {
  /** Markdown mínimo: **negrita**, líneas «- » = lista, salto de línea. */
  text: string;
  tags: string[];
}

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAG_RE = /<\s*\/?\s*[a-z!?][^>]*>/gi;
const SCHEME_RE = /(javascript|vbscript)\s*:|data\s*:\s*text\/html/gi;

/** Texto de una nota listo para guardar: sin etiquetas HTML, sin caracteres
 *  de control ni esquemas peligrosos, con saltos normalizados y el tope. */
export function sanitizeNoteText(raw: unknown, max = NOTE_TEXT_MAX): string {
  if (typeof raw !== 'string') return '';
  let t = raw.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(CONTROL_RE, '');
  // Dos pasadas: «<scr<b>ipt>» deja una etiqueta nueva al quitar la primera.
  for (let i = 0, prev = ''; i < 5 && prev !== t; i++) { prev = t; t = t.replace(TAG_RE, '').replace(SCHEME_RE, ''); }
  t = t.split('\n').map((l) => l.replace(/\s+$/g, '')).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t.slice(0, max).trim();
}

export interface NoteSpan { text: string; bold: boolean }
export type NoteBlock =
  | { type: 'p'; lines: NoteSpan[][] }
  | { type: 'ul'; items: NoteSpan[][] };

const LIST_RE = /^\s*(?:[-*•])\s+(.*)$/;

/** «a **b** c» → spans. Un ** sin cerrar queda como texto. */
export function parseInline(line: string): NoteSpan[] {
  const out: NoteSpan[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out;
}

/** Bloques de la nota: párrafos (con sus saltos de línea) y listas. */
export function parseNote(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let para: NoteSpan[][] = [];
  let list: NoteSpan[][] = [];
  const flushPara = () => { if (para.length) blocks.push({ type: 'p', lines: para }); para = []; };
  const flushList = () => { if (list.length) blocks.push({ type: 'ul', items: list }); list = []; };
  for (const line of sanitizeNoteText(text).split('\n')) {
    const li = LIST_RE.exec(line);
    if (li) { flushPara(); list.push(parseInline(li[1])); continue; }
    flushList();
    if (!line.trim()) { flushPara(); continue; }
    para.push(parseInline(line));
  }
  flushPara();
  flushList();
  return blocks;
}

/** La nota como líneas de texto plano (PDF, prompt): «• » en las listas y sin **. */
export function noteToPlainLines(text: string): string[] {
  const out: string[] = [];
  for (const b of parseNote(text)) {
    if (out.length) out.push('');
    const join = (spans: NoteSpan[]) => spans.map((s) => s.text).join('');
    if (b.type === 'p') for (const l of b.lines) out.push(join(l));
    else for (const it of b.items) out.push(`• ${join(it)}`);
  }
  return out;
}

export function hydrateNotes(raw: unknown): PlayNotes | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const text = sanitizeNoteText(r.text);
  const tags = cleanTags(r.tags);
  return text || tags.length ? { text, tags } : null;
}

/** null si no hay nada que guardar (la fila queda como antes). */
export function serializeNotes(notes: PlayNotes | null | undefined): PlayNotes | null {
  return hydrateNotes(notes ?? null);
}

// ─── Videos ─────────────────────────────────────────────────────────────────
export const EMBED_PROVIDERS = ['youtube', 'vimeo'] as const;
export const LINK_PROVIDERS = ['veo', 'hudl', 'trace', 'pixellot', 'spiideo', 'xbotgo', 'reeplayer', 'drive', 'dropbox'] as const;
/** 'sportmaps' = subido desde el celular (M6h, sin implementar). */
export const VIDEO_PROVIDERS = [...EMBED_PROVIDERS, ...LINK_PROVIDERS, 'sportmaps'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];
export type LinkProvider = (typeof LINK_PROVIDERS)[number];

export const PROVIDER_LABEL: Record<VideoProvider, string> = {
  youtube: 'YouTube', vimeo: 'Vimeo', veo: 'Veo', hudl: 'Hudl', trace: 'Trace', pixellot: 'Pixellot',
  spiideo: 'Spiideo', xbotgo: 'XbotGo', reeplayer: 'Reeplayer', drive: 'Google Drive', dropbox: 'Dropbox',
  sportmaps: 'SportMaps',
};

/** Dominio EXACTO → proveedor. Nada de comodines ni sufijos: «veo.co.evil.com»
 *  o «evilyoutube.com» no están en la lista y se rechazan. */
export const VIDEO_HOSTS: Record<string, Exclude<VideoProvider, 'sportmaps'>> = {
  'youtube.com': 'youtube', 'www.youtube.com': 'youtube', 'm.youtube.com': 'youtube', 'youtu.be': 'youtube',
  'youtube-nocookie.com': 'youtube', 'www.youtube-nocookie.com': 'youtube',
  'vimeo.com': 'vimeo', 'www.vimeo.com': 'vimeo', 'player.vimeo.com': 'vimeo',
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

export interface PlayVideo {
  provider: VideoProvider;
  /** youtube / vimeo / drive. */
  video_id?: string | null;
  /** Vimeo no listado: el «h» del enlace privado. */
  hash?: string | null;
  /** Proveedores de enlace (Veo, Hudl, Drive…): la URL normalizada. */
  url?: string | null;
  /** 'sportmaps' (M6h): id del archivo subido. Reservado. */
  asset_id?: string | null;
  title: string;
  start_s: number;
  end_s: number | null;
  /** «Enlace privado»: no sale en exportaciones públicas (PDF, paquetes). */
  is_private: boolean;
}

export type ParsedVideo = Pick<PlayVideo, 'provider' | 'video_id' | 'hash' | 'url'> & { start_s: number };
export type ParseResult = { ok: true; video: ParsedVideo } | { ok: false; error: string };

/** «90», «90s», «1m30s», «1h2m3s» → segundos; null si no es un tiempo. */
export function parseTimeParam(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (/^\d{1,6}$/.test(v)) return Number(v);
  const m = /^(?:(\d{1,2})h)?(?:(\d{1,3})m)?(?:(\d{1,5})s)?$/.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const clampTime = (s: number | null) => (s == null || !Number.isFinite(s) ? 0 : Math.max(0, Math.min(VIDEO_TIME_MAX_S, Math.floor(s))));

const fail = (error: string): ParseResult => ({ ok: false, error });
const BAD_LINK = 'Ese enlace no es de un video que podamos abrir. Pega un enlace de YouTube, Vimeo, Veo, Hudl, Trace, Pixellot, Spiideo, XbotGo, Reeplayer, Google Drive o Dropbox.';

function parseYoutube(u: URL): ParseResult {
  const segs = u.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (u.hostname === 'youtu.be') {
    if (segs.length === 1) id = segs[0];
  } else if (segs[0] === 'watch' && segs.length === 1) {
    id = u.searchParams.get('v');
  } else if (['shorts', 'embed', 'live', 'v'].includes(segs[0] ?? '') && segs.length === 2) {
    id = segs[1];
  }
  if (!id || !YOUTUBE_ID_RE.test(id)) return fail('No encontramos el video en ese enlace de YouTube.');
  const start = parseTimeParam(u.searchParams.get('t')) ?? parseTimeParam(u.searchParams.get('start'));
  return { ok: true, video: { provider: 'youtube', video_id: id, start_s: clampTime(start) } };
}

function parseVimeo(u: URL): ParseResult {
  const segs = u.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  let hash: string | null = null;
  if (u.hostname === 'player.vimeo.com') {
    if (segs[0] === 'video' && segs.length === 2) id = segs[1];
    hash = u.searchParams.get('h');
  } else if (segs.length === 1 || segs.length === 2) {
    if (VIMEO_ID_RE.test(segs[0])) { id = segs[0]; hash = segs[1] ?? null; }
    else if (segs.length === 2 && segs[0] === 'video') id = segs[1];
  } else if (segs[0] === 'channels' && segs.length === 3) {
    id = segs[2];
  } else if ((segs[0] === 'groups' && segs[2] === 'videos' && segs.length === 4) || (segs[0] === 'showcase' && segs[2] === 'video' && segs.length === 4)) {
    id = segs[3];
  }
  if (!id || !VIMEO_ID_RE.test(id)) return fail('No encontramos el video en ese enlace de Vimeo.');
  if (hash !== null && !VIMEO_HASH_RE.test(hash)) return fail('El enlace privado de Vimeo no es válido.');
  const frag = /(?:^|&)t=([^&]+)/.exec(u.hash.replace(/^#/, ''))?.[1] ?? u.searchParams.get('t');
  return { ok: true, video: { provider: 'vimeo', video_id: id, hash, start_s: clampTime(parseTimeParam(frag)) } };
}

function parseLink(u: URL, provider: LinkProvider): ParseResult {
  const label = PROVIDER_LABEL[provider];
  const path = u.pathname.replace(/\/+$/, '');
  if (!path || path === '/') return fail(`Pega el enlace del video en ${label}, no la página de inicio.`);
  if (provider === 'drive') {
    const m = /^\/file\/d\/([^/]+)(?:\/(?:view|preview))?$/.exec(path);
    const id = m ? m[1] : path === '/open' ? u.searchParams.get('id') : null;
    if (!id || !DRIVE_ID_RE.test(id)) return fail('Pega el enlace de un archivo de video de Google Drive (no de una carpeta).');
    return { ok: true, video: { provider, video_id: id, url: `https://drive.google.com/file/d/${id}/view`, start_s: 0 } };
  }
  if (provider === 'dropbox' && !/^\/(s|scl\/fi)\//.test(path)) {
    return fail('Pega el enlace compartido del video en Dropbox (dropbox.com/s/… o /scl/fi/…).');
  }
  const url = `https://${u.hostname}${u.pathname}${u.search}`;
  if (url.length > VIDEO_URL_MAX) return fail('El enlace es demasiado largo.');
  return { ok: true, video: { provider, url, start_s: 0 } };
}

/**
 * Enlace pegado → video. Estricto: dominio exacto de la lista, http(s) sin
 * usuario/clave ni puerto, y el id con su regex. Todo lo demás se rechaza con
 * un mensaje para el coach.
 */
export function parseVideoUrl(input: unknown): ParseResult {
  if (typeof input !== 'string') return fail(BAD_LINK);
  let raw = input.trim();
  if (!raw) return fail('Pega el enlace del video.');
  if (raw.length > VIDEO_URL_MAX) return fail('El enlace es demasiado largo.');
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001F\u007F<>"`\\]/.test(raw)) return fail(BAD_LINK);
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return fail(BAD_LINK);
  if (!scheme) {
    if (raw.startsWith('//')) return fail(BAD_LINK);
    raw = `https://${raw}`;
  }
  let u: URL;
  try { u = new URL(raw); } catch { return fail(BAD_LINK); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail(BAD_LINK);
  if (u.username || u.password || u.port) return fail(BAD_LINK);
  const provider = VIDEO_HOSTS[u.hostname.toLowerCase()];
  if (!provider) return fail(BAD_LINK);
  if (provider === 'youtube') return parseYoutube(u);
  if (provider === 'vimeo') return parseVimeo(u);
  return parseLink(u, provider);
}

export const isEmbeddable = (p: VideoProvider) => (EMBED_PROVIDERS as readonly string[]).includes(p);

/** URL del iframe (solo YouTube-nocookie y Vimeo), o null. */
export function embedUrl(v: Pick<PlayVideo, 'provider' | 'video_id' | 'hash' | 'start_s' | 'end_s'>): string | null {
  if (v.provider === 'youtube' && v.video_id && YOUTUBE_ID_RE.test(v.video_id)) {
    const end = v.end_s && v.end_s > v.start_s ? `&end=${v.end_s}` : '';
    return `https://www.youtube-nocookie.com/embed/${v.video_id}?start=${clampTime(v.start_s)}${end}&rel=0`;
  }
  if (v.provider === 'vimeo' && v.video_id && VIMEO_ID_RE.test(v.video_id)) {
    const h = v.hash && VIMEO_HASH_RE.test(v.hash) ? `?h=${v.hash}` : '';
    return `https://player.vimeo.com/video/${v.video_id}${h}#t=${clampTime(v.start_s)}s`;
  }
  return null;
}

/** Enlace para abrir el video fuera de la app (PDF, tarjetas). */
export function watchUrl(v: Pick<PlayVideo, 'provider' | 'video_id' | 'hash' | 'url' | 'start_s'>): string | null {
  const t = clampTime(v.start_s);
  if (v.provider === 'youtube' && v.video_id && YOUTUBE_ID_RE.test(v.video_id)) {
    return `https://www.youtube.com/watch?v=${v.video_id}${t ? `&t=${t}s` : ''}`;
  }
  if (v.provider === 'vimeo' && v.video_id && VIMEO_ID_RE.test(v.video_id)) {
    const h = v.hash && VIMEO_HASH_RE.test(v.hash) ? `/${v.hash}` : '';
    return `https://vimeo.com/${v.video_id}${h}${t ? `#t=${t}s` : ''}`;
  }
  if ((LINK_PROVIDERS as readonly string[]).includes(v.provider) && v.url) {
    const re = parseVideoUrl(v.url);
    return re.ok && re.video.provider === v.provider ? re.video.url ?? null : null;
  }
  return null;
}

/** «1:30», «1:02:03». */
export function formatClock(s: number | null | undefined): string {
  const n = clampTime(s ?? 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** «1:30» → 90; «1:02:03» → 3723; «12» = minuto 12 → 720; '' → null; basura → NaN. */
export function parseClock(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{1,3}$/.test(v)) return Number(v) * 60;
  const m = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/.exec(v);
  if (!m || Number(m[3]) > 59) return Number.NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Valida un video completo (lo que llega del BFF o de un paquete): null si no sirve. */
export function hydrateVideo(raw: unknown): PlayVideo | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const provider = r.provider as VideoProvider;
  if (!(VIDEO_PROVIDERS as readonly string[]).includes(provider)) return null;
  const title = typeof r.title === 'string' ? sanitizeNoteText(r.title, VIDEO_TITLE_MAX).replace(/\n+/g, ' ') : '';
  const start = clampTime(Number(r.start_s ?? 0));
  const endN = r.end_s == null ? null : clampTime(Number(r.end_s));
  const base = {
    provider, title: title || PROVIDER_LABEL[provider], start_s: start,
    end_s: endN != null && endN > start ? endN : null, is_private: r.is_private === true,
  };
  if (provider === 'youtube') {
    return typeof r.video_id === 'string' && YOUTUBE_ID_RE.test(r.video_id) ? { ...base, video_id: r.video_id } : null;
  }
  if (provider === 'vimeo') {
    if (typeof r.video_id !== 'string' || !VIMEO_ID_RE.test(r.video_id)) return null;
    const hash = typeof r.hash === 'string' && VIMEO_HASH_RE.test(r.hash) ? r.hash : null;
    return { ...base, video_id: r.video_id, hash };
  }
  if (provider === 'sportmaps') {
    return typeof r.asset_id === 'string' && ASSET_ID_RE.test(r.asset_id) ? { ...base, asset_id: r.asset_id.toLowerCase() } : null;
  }
  const re = parseVideoUrl(r.url);
  if (!re.ok || re.video.provider !== provider) return null;
  return { ...base, url: re.video.url ?? null, ...(re.video.video_id ? { video_id: re.video.video_id } : {}) };
}

export function hydrateVideos(raw: unknown): PlayVideo[] {
  if (!Array.isArray(raw)) return [];
  const out: PlayVideo[] = [];
  for (const v of raw) {
    const h = hydrateVideo(v);
    if (h) out.push(h);
    if (out.length >= PLAY_VIDEOS_MAX) break;
  }
  return out;
}

/** Lo que se guarda: solo campos conocidos; null si no hay videos. */
export function serializeVideos(videos: PlayVideo[] | null | undefined): PlayVideo[] | null {
  const list = hydrateVideos(videos ?? []);
  if (!list.length) return null;
  return list.map((v) => {
    const out: PlayVideo = { provider: v.provider, title: v.title, start_s: v.start_s, end_s: v.end_s, is_private: v.is_private };
    if (v.video_id) out.video_id = v.video_id;
    if (v.hash) out.hash = v.hash;
    if (v.url) out.url = v.url;
    if (v.asset_id) out.asset_id = v.asset_id;
    return out;
  });
}

/** Clave para no repetir un video en la jugada. */
export function videoKey(v: Pick<PlayVideo, 'provider' | 'video_id' | 'url' | 'asset_id' | 'start_s'>): string {
  return `${v.provider}|${v.video_id ?? v.url ?? v.asset_id ?? ''}|${v.start_s}`;
}

/** Exportación pública (PDF, paquetes): sin los de «enlace privado». */
export function publicVideos(videos: PlayVideo[] | null | undefined): PlayVideo[] {
  return (videos ?? []).filter((v) => !v.is_private);
}
