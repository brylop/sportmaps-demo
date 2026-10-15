/**
 * «Equipos almacenados» de la pizarra (M6b de docs/specs/pizarra-m6-paridad-tacticalpad.md;
 * migración 20261015142003): rivales guardados por escuela.
 *
 *   GET    /api/v1/school/tactical-rival-teams        lista de la escuela (staff)
 *   POST   /api/v1/school/tactical-rival-teams        crear (táctica)
 *   PATCH  /api/v1/school/tactical-rival-teams/:id    editar (táctica)
 *   DELETE /api/v1/school/tactical-rival-teams/:id    borrar (táctica)
 *
 * Mismo patrón que football.ts (plantillas tácticas): cliente de servicio con
 * el filtro de escuela EXPLÍCITO (req.schoolId) y requireRole como barrera;
 * la RLS de la tabla (staff lee, táctica escribe) cubre a cualquier otro
 * camino. La validación vive en tacticalTeamsShapes.ts (pura, probada aparte).
 *
 * Mientras la migración no esté aplicada la tabla no existe: 503 claro en vez
 * de un 500, y la pizarra sigue funcionando sin rivales guardados.
 */
import { Router, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { validateRivalTeamBody } from './tacticalTeamsShapes';

const router = Router();

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
/** = TACTICAL_EDIT_ROLES de football.ts = user_tactical_edit_school_ids(). */
const TACTICAL_EDIT_ROLES = ['owner', 'super_admin', 'coach'] as const;
/** Tope por escuela: un club real tiene decenas de rivales, no miles. */
export const MAX_RIVALS_PER_SCHOOL = 200;

const COLUMNS = 'id, school_id, name, short_name, color_primary, color_secondary, color_number, crest, chip_style, roster, created_by, created_at, updated_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_READY = { error: 'Los equipos almacenados todavía no están disponibles.' };

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  return (e.code === 'PGRST205' || e.code === '42P01') && /tactical_rival_teams/.test(e.message ?? '');
}

function fail(req: AuthenticatedRequest, res: Response, err: unknown) {
  if (isMissingTable(err)) return res.status(503).json(NOT_READY);
  const code = (err as { code?: string } | null)?.code;
  if (code === '23505') return res.status(409).json({ error: 'Ya hay un rival guardado con ese nombre.' });
  if (code === '23514') return res.status(422).json({ error: 'Datos del rival inválidos.' });
  req.log?.error({ err }, 'school/tactical-rival-teams unhandled error');
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

router.get(
  '/tactical-rival-teams',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('tactical_rival_teams')
        .select(COLUMNS)
        .eq('school_id', req.schoolId)
        .order('name', { ascending: true })
        .limit(MAX_RIVALS_PER_SCHOOL);
      if (error) throw error;
      return res.json(data ?? []);
    } catch (err) {
      return fail(req, res, err);
    }
  },
);

router.post(
  '/tactical-rival-teams',
  requireAuth,
  requireRole(...TACTICAL_EDIT_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { errors, value } = validateRivalTeamBody(req.body, false);
      if (errors.length) return res.status(422).json({ error: 'Rival inválido.', details: errors });

      const { data: existing, error: cErr } = await supabase
        .from('tactical_rival_teams')
        .select('id')
        .eq('school_id', req.schoolId)
        .limit(MAX_RIVALS_PER_SCHOOL);
      if (cErr) throw cErr;
      if ((existing ?? []).length >= MAX_RIVALS_PER_SCHOOL) {
        return res.status(409).json({ error: `Máximo ${MAX_RIVALS_PER_SCHOOL} rivales guardados por escuela.` });
      }

      const { data, error } = await supabase
        .from('tactical_rival_teams')
        .insert({ ...value, school_id: req.schoolId, created_by: req.user.id })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      return fail(req, res, err);
    }
  },
);

router.patch(
  '/tactical-rival-teams/:id',
  requireAuth,
  requireRole(...TACTICAL_EDIT_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido.' });
      const { errors, value } = validateRivalTeamBody(req.body, true);
      if (errors.length) return res.status(422).json({ error: 'Rival inválido.', details: errors });
      const { data, error } = await supabase
        .from('tactical_rival_teams')
        .update(value)
        .eq('id', id)
        .eq('school_id', req.schoolId)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Rival no encontrado.' });
      return res.json(data);
    } catch (err) {
      return fail(req, res, err);
    }
  },
);

router.delete(
  '/tactical-rival-teams/:id',
  requireAuth,
  requireRole(...TACTICAL_EDIT_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido.' });
      const { data, error } = await supabase
        .from('tactical_rival_teams')
        .delete()
        .eq('id', id)
        .eq('school_id', req.schoolId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).json({ error: 'Rival no encontrado.' });
      return res.status(204).end();
    } catch (err) {
      return fail(req, res, err);
    }
  },
);

export default router;
