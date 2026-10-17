/**
 * Videos subidos — M6h fase 1 (docs/specs/pizarra-m6h-videos-subidos.md).
 *
 *   GET    /api/v1/school/videos/settings          interruptor + cupo («Disponible pronto» si está apagado)
 *   GET    /api/v1/school/videos?team_id=           lista (staff)
 *   POST   /api/v1/school/videos/uploads            reserva cupo + autorización de subida DIRECTA al proveedor
 *   POST   /api/v1/school/videos/:id/sync           relee el estado en el proveedor (si el webhook no llegó)
 *   GET    /api/v1/school/videos/:id/playback       URL firmada que vence (nunca pública)
 *   PATCH  /api/v1/school/videos/:id                título, equipo, fecha, origen
 *   DELETE /api/v1/school/videos/:id                borrado lógico (autor o admin) + borra el asset
 *   GET    /api/v1/school/videos/:id/clips          clips del video
 *   POST   /api/v1/school/videos/:id/clips          nuevo clip (opcional: vinculado a una jugada)
 *   PATCH  /api/v1/school/video-clips/:clipId
 *   DELETE /api/v1/school/video-clips/:clipId
 *
 *   POST   /api/v1/webhooks/video/:provider         (videoWebhookRouter) firma verificada
 *
 * Capas: requireRole (BFF) → sesión del usuario contra la base (RLS + RPCs que
 * validan auth.uid()). El archivo nunca pasa por acá. Padres y atletas: 403.
 */
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { getVideoProvider } from '../../services/video';
import { userDb, serviceDb } from '../../services/video/db';
import {
  ALLOWED_VIDEO_TYPES, PLATFORM_MAX_DURATION_S, PLATFORM_MAX_UPLOAD_BYTES, VIDEO_SOURCES,
  clampTtl, cleanTitle, isUuid, parseClip, parseUploadRequest,
} from '../../services/video/policy';

const router = Router();
export const videoWebhookRouter = Router();

/** Ven videos: el cuerpo técnico y la administración (no padres ni atletas). */
export const VIDEO_READ_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
/** Suben, editan y recortan: los mismos que editan la pizarra (TACTICAL_EDIT_ROLES). */
export const VIDEO_EDIT_ROLES = ['owner', 'super_admin', 'coach'] as const;
/** Borran: autor táctico o admin (lo decide la RPC / la policy). */
export const VIDEO_DELETE_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach'] as const;

export const VIDEO_UPLOADS_PER_MINUTE = Number(process.env.VIDEO_UPLOADS_PER_MINUTE) || 10;

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: VIDEO_UPLOADS_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `video-upload-${req.user?.id ?? 'anon'}`,
  validate: false,
  handler: (_req, res) => { res.status(429).json({ error: 'Vas muy rápido: espera un minuto antes de subir otro video.' }); },
});

const VIDEO_COLS = 'id, school_id, team_id, provider, status, duration_s, size_bytes, title, recorded_at, source, consent_scope, created_by, created_at, updated_at';
const CLIP_COLS = 'id, video_id, start_s, end_s, title, lineup_id, preset_id, exercise_id, created_by, created_at, updated_at';

/** Error de Postgres/PostgREST → respuesta HTTP en español. */
export function mapDbError(err: any): { status: number; body: Record<string, unknown> } {
  const msg = String(err?.message ?? '');
  const code = String(err?.code ?? '');
  if (msg.includes('VIDEOS_DISABLED')) return { status: 403, body: { error: 'Los videos subidos estarán disponibles pronto para tu escuela.', code: 'VIDEOS_DISABLED' } };
  if (msg.includes('QUOTA_EXCEEDED')) return { status: 409, body: { error: 'Tu escuela llegó al cupo de videos. Borra videos viejos o pide más cupo.', code: 'QUOTA_EXCEEDED' } };
  if (msg.includes('FILE_TOO_LARGE')) return { status: 413, body: { error: 'El archivo supera el máximo de tu escuela.', code: 'FILE_TOO_LARGE' } };
  if (msg.includes('TOO_LONG')) return { status: 422, body: { error: 'El video supera la duración máxima de tu escuela.', code: 'TOO_LONG' } };
  if (code === '42501') return { status: 403, body: { error: msg.replace(/^[A-Z_]+:\s*/, '') || 'No tienes permiso.' } };
  if (code === 'P0002') return { status: 404, body: { error: 'Video no encontrado.' } };
  if (code === '22023' || code === '23514' || code === '54000') return { status: 422, body: { error: msg || 'Datos inválidos.' } };
  return { status: 500, body: { error: 'Error interno del servidor.' } };
}

function fail(res: Response, req: Request, err: any, where: string) {
  const m = mapDbError(err);
  if (m.status >= 500) (req as any).log?.error({ err }, `school/videos ${where}`);
  return res.status(m.status).json(m.body);
}

interface SettingsRow {
  enabled: boolean;
  quota_seconds: number; quota_bytes: number;
  used_seconds: number; used_bytes: number;
  max_upload_bytes: number; max_duration_s: number;
}

async function readSettings(req: AuthenticatedRequest): Promise<SettingsRow | null> {
  const { data, error } = await userDb(req)
    .from('school_video_settings')
    .select('enabled, quota_seconds, quota_bytes, used_seconds, used_bytes, max_upload_bytes, max_duration_s')
    .eq('school_id', req.schoolId)
    .maybeSingle();
  if (error) throw error;
  return (data as SettingsRow) ?? null;
}

/** Flag de la escuela + proveedor configurado. Responde y devuelve false si no. */
async function ensureEnabled(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const s = await readSettings(req);
  if (!s?.enabled) {
    res.status(403).json({ error: 'Los videos subidos estarán disponibles pronto para tu escuela.', code: 'VIDEOS_DISABLED' });
    return false;
  }
  if (!getVideoProvider()) {
    res.status(503).json({ error: 'La subida de videos todavía no está configurada en SportMaps.', code: 'PROVIDER_NOT_CONFIGURED' });
    return false;
  }
  return true;
}

// GET /videos/settings
router.get('/videos/settings', requireAuth, requireRole(...VIDEO_READ_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const s = await readSettings(req);
    const provider = getVideoProvider();
    const enabled = !!s?.enabled && !!provider;
    return res.json({
      enabled,
      school_flag: !!s?.enabled,
      provider_configured: !!provider,
      provider: provider?.name ?? null,
      quota_seconds: s?.quota_seconds ?? 0,
      quota_bytes: s?.quota_bytes ?? 0,
      used_seconds: s?.used_seconds ?? 0,
      used_bytes: s?.used_bytes ?? 0,
      max_upload_bytes: Math.min(s?.max_upload_bytes ?? PLATFORM_MAX_UPLOAD_BYTES(), PLATFORM_MAX_UPLOAD_BYTES()),
      max_duration_s: Math.min(s?.max_duration_s ?? PLATFORM_MAX_DURATION_S(), PLATFORM_MAX_DURATION_S()),
      allowed_types: ALLOWED_VIDEO_TYPES,
      sources: VIDEO_SOURCES,
    });
  } catch (err) { return fail(res, req, err, 'settings'); }
});

// GET /videos?team_id=
router.get('/videos', requireAuth, requireRole(...VIDEO_READ_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await ensureEnabled(req, res))) return;
    let q = userDb(req).from('school_videos').select(VIDEO_COLS)
      .eq('school_id', req.schoolId).neq('status', 'deleted')
      .order('created_at', { ascending: false }).limit(200);
    const team = req.query.team_id;
    if (typeof team === 'string' && team) {
      if (!isUuid(team)) return res.status(422).json({ error: 'Equipo inválido.' });
      q = q.eq('team_id', team);
    }
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ videos: data ?? [] });
  } catch (err) { return fail(res, req, err, 'list'); }
});

// POST /videos/uploads
router.post('/videos/uploads', requireAuth, requireRole(...VIDEO_EDIT_ROLES), uploadLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = parseUploadRequest(req.body);
    if (!parsed.ok) return res.status(parsed.status).json({ error: parsed.error });
    const provider = getVideoProvider();
    if (!provider) return res.status(503).json({ error: 'La subida de videos todavía no está configurada en SportMaps.', code: 'PROVIDER_NOT_CONFIGURED' });
    const db = userDb(req);
    const v = parsed.value;

    // 1) Reserva de cupo + fila, en UNA transacción (FOR UPDATE en la base).
    const { data: begun, error: beginErr } = await db.rpc('begin_school_video_upload', {
      p_school_id: req.schoolId, p_provider: provider.name, p_title: v.title,
      p_size_bytes: v.sizeBytes, p_max_duration_s: v.maxDurationS,
      p_team_id: v.teamId, p_source: v.source, p_recorded_at: v.recordedAt,
    });
    if (beginErr) return fail(res, req, beginErr, 'begin');
    const videoId = String((begun as any)?.video_id ?? '');

    // 2) Hueco en el proveedor. Si falla, se devuelve la reserva.
    let created;
    try {
      created = await provider.createUpload({
        videoId, schoolId: req.schoolId, title: v.title, sizeBytes: v.sizeBytes, mimeType: v.mimeType, maxDurationS: v.maxDurationS,
      });
    } catch (err) {
      req.log?.error({ err }, 'school/videos createUpload');
      await db.rpc('soft_delete_school_video', { p_video_id: videoId });
      return res.status(502).json({ error: 'El servicio de video no respondió. Intenta de nuevo en unos minutos.' });
    }

    // 3) Guardar el id del asset. Si falla, se borra el asset y la reserva.
    const { error: attachErr } = await db.rpc('attach_school_video_asset', {
      p_video_id: videoId, p_provider_asset_id: created.providerAssetId,
    });
    if (attachErr) {
      await provider.deleteAsset(created.providerAssetId).catch((err) => req.log?.error({ err }, 'school/videos rollback deleteAsset'));
      await db.rpc('soft_delete_school_video', { p_video_id: videoId });
      return fail(res, req, attachErr, 'attach');
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      video_id: videoId,
      upload: created.upload,
      quota: {
        quota_seconds: (begun as any)?.quota_seconds, quota_bytes: (begun as any)?.quota_bytes,
        used_seconds: (begun as any)?.used_seconds, used_bytes: (begun as any)?.used_bytes,
      },
    });
  } catch (err) { return fail(res, req, err, 'upload'); }
});

async function readVideo(req: AuthenticatedRequest, id: string) {
  const { data, error } = await userDb(req)
    .from('school_videos')
    .select(`${VIDEO_COLS}, provider_asset_id`)
    .eq('id', id)
    .eq('school_id', req.schoolId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

// POST /videos/:id/sync — si el webhook no llegó (o aún no se configura).
router.post('/videos/:id/sync', requireAuth, requireRole(...VIDEO_EDIT_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video no encontrado.' });
    if (!(await ensureEnabled(req, res))) return;
    const video = await readVideo(req, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video no encontrado.' });
    const provider = getVideoProvider()!;
    if (!video.provider_asset_id || video.provider !== provider.name) return res.json({ status: video.status });
    const asset = await provider.getAsset(video.provider_asset_id);
    if (asset.status === 'uploading') return res.json({ status: video.status });
    const { data, error } = await serviceDb().rpc('settle_school_video', {
      p_provider: provider.name, p_provider_asset_id: video.provider_asset_id, p_status: asset.status,
      p_duration_s: asset.durationS, p_size_bytes: asset.sizeBytes,
    });
    if (error) throw error;
    return res.json({ status: (data as any)?.status ?? asset.status });
  } catch (err) { return fail(res, req, err, 'sync'); }
});

// GET /videos/:id/playback?ttl=
router.get('/videos/:id/playback', requireAuth, requireRole(...VIDEO_READ_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video no encontrado.' });
    if (!(await ensureEnabled(req, res))) return;
    const video = await readVideo(req, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video no encontrado.' });
    if (video.status !== 'ready' || !video.provider_asset_id) {
      return res.status(409).json({ error: 'El video todavía se está procesando.', status: video.status });
    }
    const provider = getVideoProvider()!;
    if (video.provider !== provider.name) return res.status(409).json({ error: 'El video está en otro proveedor.' });
    const ttlS = clampTtl(req.query.ttl);
    const playback = provider.getPlaybackUrl(video.provider_asset_id, { ttlS });
    // La URL firmada es personal y vence: que no quede en ninguna caché.
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ...playback, ttl_s: ttlS, duration_s: video.duration_s });
  } catch (err) { return fail(res, req, err, 'playback'); }
});

// PATCH /videos/:id
router.patch('/videos/:id', requireAuth, requireRole(...VIDEO_EDIT_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video no encontrado.' });
    if (!(await ensureEnabled(req, res))) return;
    const patch: Record<string, unknown> = {};
    if ('title' in (req.body ?? {})) {
      const t = cleanTitle(req.body.title);
      if (!t) return res.status(422).json({ error: 'Título inválido.' });
      patch.title = t;
    }
    if ('team_id' in (req.body ?? {})) {
      if (req.body.team_id !== null && !isUuid(req.body.team_id)) return res.status(422).json({ error: 'Equipo inválido.' });
      patch.team_id = req.body.team_id;
    }
    if ('source' in (req.body ?? {})) {
      if (!(VIDEO_SOURCES as readonly string[]).includes(req.body.source)) return res.status(422).json({ error: 'Origen inválido.' });
      patch.source = req.body.source;
    }
    if ('recorded_at' in (req.body ?? {})) {
      const r = req.body.recorded_at;
      if (r !== null && (typeof r !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r))) return res.status(422).json({ error: 'Fecha inválida.' });
      patch.recorded_at = r;
    }
    if (!Object.keys(patch).length) return res.status(422).json({ error: 'Nada que cambiar.' });
    const { data, error } = await userDb(req).from('school_videos').update(patch)
      .eq('id', req.params.id).eq('school_id', req.schoolId).select(VIDEO_COLS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Video no encontrado.' });
    return res.json({ video: data });
  } catch (err) { return fail(res, req, err, 'patch'); }
});

// DELETE /videos/:id
router.delete('/videos/:id', requireAuth, requireRole(...VIDEO_DELETE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video no encontrado.' });
    const { data, error } = await userDb(req).rpc('soft_delete_school_video', { p_video_id: req.params.id });
    if (error) return fail(res, req, error, 'delete');
    const d: any = data;
    const provider = getVideoProvider();
    if (d?.provider_asset_id && provider && provider.name === d.provider) {
      // Si el proveedor falla, la fila ya quedó borrada y el cupo devuelto: se
      // registra para reintentar (spec §8, limpieza de huérfanos).
      await provider.deleteAsset(d.provider_asset_id).catch((err) => req.log?.error({ err, asset: d.provider_asset_id }, 'school/videos deleteAsset'));
    }
    return res.json({ ok: true });
  } catch (err) { return fail(res, req, err, 'delete'); }
});

// GET /videos/:id/clips
router.get('/videos/:id/clips', requireAuth, requireRole(...VIDEO_READ_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video no encontrado.' });
    if (!(await ensureEnabled(req, res))) return;
    const { data, error } = await userDb(req).from('school_video_clips').select(CLIP_COLS)
      .eq('video_id', req.params.id).eq('school_id', req.schoolId).order('start_s', { ascending: true });
    if (error) throw error;
    return res.json({ clips: data ?? [] });
  } catch (err) { return fail(res, req, err, 'clips'); }
});

// POST /videos/:id/clips
router.post('/videos/:id/clips', requireAuth, requireRole(...VIDEO_EDIT_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video no encontrado.' });
    if (!(await ensureEnabled(req, res))) return;
    const video = await readVideo(req, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video no encontrado.' });
    const parsed = parseClip(req.body, video.duration_s ?? null);
    if (!parsed.ok) return res.status(422).json({ error: parsed.error });
    const c = parsed.value;
    const { data, error } = await userDb(req).from('school_video_clips').insert({
      video_id: video.id, school_id: req.schoolId, title: c.title, start_s: c.startS, end_s: c.endS,
      lineup_id: c.lineupId, preset_id: c.presetId, exercise_id: c.exerciseId, created_by: req.user.id,
    }).select(CLIP_COLS).single();
    if (error) throw error;
    return res.status(201).json({ clip: data });
  } catch (err) { return fail(res, req, err, 'clip create'); }
});

// PATCH /video-clips/:clipId
router.patch('/video-clips/:clipId', requireAuth, requireRole(...VIDEO_EDIT_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.clipId)) return res.status(404).json({ error: 'Clip no encontrado.' });
    if (!(await ensureEnabled(req, res))) return;
    const db = userDb(req);
    const { data: cur, error: curErr } = await db.from('school_video_clips').select(CLIP_COLS)
      .eq('id', req.params.clipId).eq('school_id', req.schoolId).maybeSingle();
    if (curErr) throw curErr;
    if (!cur) return res.status(404).json({ error: 'Clip no encontrado.' });
    const merged = { ...(cur as any), ...(req.body ?? {}) };
    const parsed = parseClip(merged, null);
    if (!parsed.ok) return res.status(422).json({ error: parsed.error });
    const c = parsed.value;
    const { data, error } = await db.from('school_video_clips').update({
      title: c.title, start_s: c.startS, end_s: c.endS, lineup_id: c.lineupId, preset_id: c.presetId, exercise_id: c.exerciseId,
    }).eq('id', req.params.clipId).select(CLIP_COLS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Clip no encontrado.' });
    return res.json({ clip: data });
  } catch (err) { return fail(res, req, err, 'clip patch'); }
});

// DELETE /video-clips/:clipId (la policy decide: autor táctico o admin)
router.delete('/video-clips/:clipId', requireAuth, requireRole(...VIDEO_DELETE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isUuid(req.params.clipId)) return res.status(404).json({ error: 'Clip no encontrado.' });
    const { data, error } = await userDb(req).from('school_video_clips').delete()
      .eq('id', req.params.clipId).eq('school_id', req.schoolId).select('id');
    if (error) throw error;
    if (!data || !(data as any[]).length) return res.status(404).json({ error: 'Clip no encontrado o sin permiso para borrarlo.' });
    return res.json({ ok: true });
  } catch (err) { return fail(res, req, err, 'clip delete'); }
});

// ─── Webhook del proveedor ───────────────────────────────────────────────────
// Sin requireAuth: la credencial es la FIRMA sobre el cuerpo crudo (req.rawBody,
// lo guarda el express.json global). El payload solo dice «mira este asset»;
// el estado de verdad se relee en el API del proveedor, así que un webhook
// repetido o viejo no cambia nada (settle es idempotente).
videoWebhookRouter.post('/:provider', async (req: Request, res: Response) => {
  const provider = getVideoProvider();
  if (!provider || provider.name !== req.params.provider) return res.status(404).json({ error: 'Proveedor desconocido.' });
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!raw || !provider.webhook.verify(raw, req.headers as any)) {
    return res.status(401).json({ error: 'Firma inválida.' });
  }
  const ev = provider.webhook.parse(raw);
  if (!ev) return res.status(200).json({ ok: true, ignored: true });
  try {
    const asset = await provider.getAsset(ev.providerAssetId);
    if (asset.status === 'uploading') return res.status(200).json({ ok: true, ignored: true });
    const { data, error } = await serviceDb().rpc('settle_school_video', {
      p_provider: provider.name, p_provider_asset_id: ev.providerAssetId, p_status: asset.status,
      p_duration_s: asset.durationS, p_size_bytes: asset.sizeBytes,
    });
    if (error) throw error;
    return res.status(200).json({ ok: true, result: data });
  } catch (err) {
    (req as any).log?.error({ err }, 'webhooks/video');
    // 5xx: el proveedor reintenta.
    return res.status(500).json({ error: 'No se pudo procesar el aviso.' });
  }
});

export default router;
