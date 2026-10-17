/**
 * «Videos guardados» de la escuela — pizarra M6c (docs/specs/pizarra-m6-paridad-tacticalpad.md).
 *
 *   GET    /api/v1/school/tactical/videos        lista de la escuela activa
 *   POST   /api/v1/school/tactical/videos        guarda un enlace (YouTube, Vimeo, Veo, Hudl…)
 *   DELETE /api/v1/school/tactical/videos/:id
 *
 * Tabla public.tactical_saved_videos (migración 20261014163705). Mismo patrón
 * que football.ts: cliente de servicio con el filtro de escuela EXPLÍCITO y los
 * roles de la pizarra (leer = staff; escribir = TACTICAL_EDIT_ROLES), espejo de
 * la RLS (user_staff_school_ids() / user_tactical_edit_school_ids()). Padres y
 * atletas no leen: la jugada es solo del cuerpo técnico (20261005173002).
 * Solo enlaces: cero almacenamiento. Con la migración sin aplicar, GET responde
 * una lista vacía con available=false y POST un 503 claro.
 */
import { Router, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { SAVED_VIDEOS_MAX, isMissingSavedVideosTable, validateVideo } from './tacticalMediaShapes';

const router = Router();

/** Espejo de football.ts. */
const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
const TACTICAL_EDIT_ROLES = ['owner', 'super_admin', 'coach'] as const;

const COLS = 'id, provider, video_id, hash, url, asset_id, title, start_s, end_s, is_private, created_by, created_at';
const NOT_READY = { error: 'Los videos guardados todavía no están habilitados. Puedes agregar el video solo a esta jugada.' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get(
  '/tactical/videos',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('tactical_saved_videos' as any)
        .select(COLS)
        .eq('school_id', req.schoolId)
        .order('created_at', { ascending: false })
        .limit(SAVED_VIDEOS_MAX);
      if (error) {
        if (isMissingSavedVideosTable(error)) return res.json({ videos: [], available: false });
        throw error;
      }
      res.json({ videos: data ?? [], available: true });
    } catch (err: any) {
      req.log?.error({ err }, 'school/tactical/videos unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

router.post(
  '/tactical/videos',
  requireAuth,
  requireRole(...TACTICAL_EDIT_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { errors, value } = validateVideo(req.body, 'video');
      if (!value) return res.status(422).json({ error: 'Video inválido.', details: errors.slice(0, 10) });
      if (value.provider === 'sportmaps') {
        // M6h (subir videos) todavía no existe: no se guardan referencias a archivos.
        return res.status(422).json({ error: 'Los videos subidos todavía no están disponibles.' });
      }

      const { count, error: countErr } = await supabase
        .from('tactical_saved_videos' as any)
        .select('id', { count: 'exact', head: true })
        .eq('school_id', req.schoolId);
      if (countErr) {
        if (isMissingSavedVideosTable(countErr)) return res.status(503).json(NOT_READY);
        throw countErr;
      }
      if ((count ?? 0) >= SAVED_VIDEOS_MAX) {
        return res.status(409).json({ error: `La escuela ya tiene ${SAVED_VIDEOS_MAX} videos guardados. Borra alguno para guardar otro.` });
      }

      const row = {
        school_id: req.schoolId,
        provider: value.provider,
        video_id: value.video_id ?? null,
        hash: value.hash ?? null,
        url: value.url ?? null,
        title: value.title,
        start_s: value.start_s,
        end_s: value.end_s,
        is_private: value.is_private,
        created_by: req.user.id,
      };
      const { data, error } = await supabase.from('tactical_saved_videos' as any).insert(row).select(COLS).single();
      if (error) {
        if (isMissingSavedVideosTable(error)) return res.status(503).json(NOT_READY);
        // Índice único (escuela, proveedor, video, inicio): ya estaba guardado.
        if ((error as any).code === '23505') return res.status(409).json({ error: 'Ese video ya está en Videos guardados.' });
        throw error;
      }
      res.status(201).json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/tactical/videos unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

router.delete(
  '/tactical/videos/:id',
  requireAuth,
  requireRole(...TACTICAL_EDIT_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido.' });
      const { data, error } = await supabase
        .from('tactical_saved_videos' as any)
        .delete()
        .eq('id', id)
        .eq('school_id', req.schoolId)
        .select('id');
      if (error) {
        if (isMissingSavedVideosTable(error)) return res.status(503).json(NOT_READY);
        throw error;
      }
      if (!data || (data as unknown[]).length === 0) return res.status(404).json({ error: 'Video no encontrado.' });
      res.status(204).send();
    } catch (err: any) {
      req.log?.error({ err }, 'school/tactical/videos unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

export default router;
