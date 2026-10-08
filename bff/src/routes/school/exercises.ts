/**
 * Biblioteca de ejercicios — pizarra T3 (docs/specs/pizarra-nivel-tacticalpad.md).
 *
 *   GET    /api/v1/school/exercises                    lista (q, sport, tag, mine, templates)
 *   GET    /api/v1/school/exercises/:id
 *   POST   /api/v1/school/exercises
 *   PUT    /api/v1/school/exercises/:id                autor o admin de la escuela
 *   DELETE /api/v1/school/exercises/:id                baja lógica (is_active=false), autor o admin
 *   POST   /api/v1/school/exercises/:id/insert-into-session
 *          → RPC insert_exercise_into_session_block (transaccional)
 *
 * Igual que football.ts: las lecturas/escrituras de la tabla van con el
 * cliente de servicio y el filtro de escuela EXPLÍCITO (req.schoolId); la RPC
 * va con userClient(req) porque autoriza con auth.uid() (con la service key
 * auth.uid() es NULL y respondería 42501). Ver utils/userClient.ts.
 *
 * Plantillas SportMaps (school_id NULL + is_template): se leen, se usan, no se
 * editan ni se borran desde acá (solo super admin, por SQL / RLS).
 */
import { Router, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { userClient } from '../../utils/userClient';
import { validateExerciseInput, sanitizeSearch, EXERCISE_SPORTS, UUID_RE } from './exerciseShapes';

const router = Router();

// Ver y guardar ejercicios: cualquiera que TRABAJA en la escuela (mismo
// alcance que user_staff_school_ids() de la RLS).
const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
// Meter el ejercicio en una sesión reescribe la jugada del bloque: mismo gate
// que editar el tablero táctico en football.ts (TACTICAL_EDIT_ROLES).
const TACTICAL_EDIT_ROLES = ['owner', 'super_admin', 'coach'] as const;
// Editar/borrar lo que escribió OTRO miembro: administración (= user_admin_school_ids()).
const ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'school_admin'];

const LIST_COLUMNS =
  'id, school_id, created_by, name, objective, minutes, age_group, materials, tags, sport, description, board, is_template, is_active, times_used, created_at, updated_at';

// Express 5 tipa params como string | string[].
const paramId = (req: AuthenticatedRequest) => String(req.params.id ?? '');
const isTrue = (v: unknown) => v === 'true' || v === '1';
const isFalse = (v: unknown) => v === 'false' || v === '0';

async function loadVisible(id: string, schoolId: string) {
  const { data, error } = await supabase
    .from('training_exercises')
    .select(LIST_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const visible = (data.school_id === null && data.is_template) || data.school_id === schoolId;
  return visible ? data : null;
}

/** Puede editar/borrar: autor (que sigue en la escuela) o admin de la escuela. */
function canManage(row: { created_by: string | null }, req: AuthenticatedRequest) {
  return row.created_by === req.user.id || ADMIN_ROLES.includes(req.role);
}

// GET /api/v1/school/exercises?q=&sport=&tag=&mine=true&templates=true|false&limit=
router.get(
  '/exercises',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, user } = req;
      const { q, sport, tag, mine, templates, limit } = req.query as Record<string, string | undefined>;

      let query = supabase
        .from('training_exercises')
        .select(LIST_COLUMNS)
        .eq('is_active', true);

      // templates=true → solo SportMaps; templates=false → solo de mi escuela;
      // sin el parámetro → las dos.
      if (isTrue(templates)) query = query.is('school_id', null).eq('is_template', true);
      else if (isFalse(templates) || isTrue(mine)) query = query.eq('school_id', schoolId);
      else query = query.or(`school_id.eq.${schoolId},and(school_id.is.null,is_template.eq.true)`);

      if (isTrue(mine)) query = query.eq('created_by', user.id);

      if (sport) {
        if (!(EXERCISE_SPORTS as readonly string[]).includes(sport)) {
          return res.status(400).json({ error: `sport inválido: ${sport.slice(0, 20)}` });
        }
        query = query.eq('sport', sport);
      }
      if (tag) {
        const t = tag.trim().toLowerCase().slice(0, 40);
        if (t) query = query.contains('tags', [t]);
      }
      const term = sanitizeSearch(q);
      if (term) query = query.or(`name.ilike.%${term}%,objective.ilike.%${term}%`);

      const lim = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const { data, error } = await query
        .order('is_template', { ascending: true }) // primero lo de la escuela
        .order('times_used', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(lim);
      if (error) throw error;
      res.json(data ?? []);
    } catch (err: any) {
      req.log?.error({ err }, 'school/exercises unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

// GET /api/v1/school/exercises/:id
router.get(
  '/exercises/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!UUID_RE.test(paramId(req))) return res.status(400).json({ error: 'id inválido.' });
      const row = await loadVisible(paramId(req), req.schoolId);
      if (!row) return res.status(404).json({ error: 'Ejercicio no encontrado.' });
      res.json(row);
    } catch (err: any) {
      req.log?.error({ err }, 'school/exercises unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

// POST /api/v1/school/exercises
// Body: { name, objective?, minutes?, age_group?, materials?, tags?, sport?, description?, board? }
router.post(
  '/exercises',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { errors, fields } = validateExerciseInput(req.body, false);
      if (errors.length) return res.status(422).json({ error: 'Ejercicio inválido.', details: errors });

      const { data, error } = await supabase
        .from('training_exercises')
        .insert({
          ...fields,
          school_id: req.schoolId,
          created_by: req.user.id,
          is_template: false,
          is_active: true,
        })
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/exercises unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

// PUT /api/v1/school/exercises/:id
router.put(
  '/exercises/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!UUID_RE.test(paramId(req))) return res.status(400).json({ error: 'id inválido.' });
      const row = await loadVisible(paramId(req), req.schoolId);
      if (!row) return res.status(404).json({ error: 'Ejercicio no encontrado.' });
      if (row.school_id === null) {
        return res.status(403).json({ error: 'Las plantillas SportMaps no se editan. Guárdala como un ejercicio de tu escuela.' });
      }
      if (!canManage(row, req)) {
        return res.status(403).json({ error: 'Solo quien creó el ejercicio o un administrador de la escuela puede editarlo.' });
      }

      const { errors, fields } = validateExerciseInput(req.body, true);
      if (errors.length) return res.status(422).json({ error: 'Ejercicio inválido.', details: errors });
      if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'Nada para actualizar.' });

      const { data, error } = await supabase
        .from('training_exercises')
        .update(fields)
        .eq('id', row.id)
        .eq('school_id', req.schoolId)
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/exercises unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

// DELETE /api/v1/school/exercises/:id — baja lógica: los bloques que ya lo
// usaron conservan su copia (la jugada vive en match_lineups).
router.delete(
  '/exercises/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!UUID_RE.test(paramId(req))) return res.status(400).json({ error: 'id inválido.' });
      const row = await loadVisible(paramId(req), req.schoolId);
      if (!row) return res.status(404).json({ error: 'Ejercicio no encontrado.' });
      if (row.school_id === null) {
        return res.status(403).json({ error: 'Las plantillas SportMaps no se pueden borrar.' });
      }
      if (!canManage(row, req)) {
        return res.status(403).json({ error: 'Solo quien creó el ejercicio o un administrador de la escuela puede borrarlo.' });
      }
      const { error } = await supabase
        .from('training_exercises')
        .update({ is_active: false })
        .eq('id', row.id)
        .eq('school_id', req.schoolId);
      if (error) throw error;
      res.status(204).send();
    } catch (err: any) {
      req.log?.error({ err }, 'school/exercises unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

// POST /api/v1/school/exercises/:id/insert-into-session
// Body: { block_id, session_id?, team_id? }
//   · session_id presente: sesión ya guardada → completa el bloque en
//     session_blocks + arma la jugada del bloque.
//   · session_id ausente: sesión todavía sin guardar → hace falta team_id;
//     solo arma la jugada del bloque (el formulario guarda los textos).
router.post(
  '/exercises/:id/insert-into-session',
  requireAuth,
  requireRole(...TACTICAL_EDIT_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { block_id, session_id, team_id } = req.body ?? {};
      if (!UUID_RE.test(paramId(req))) return res.status(400).json({ error: 'id inválido.' });
      if (typeof block_id !== 'string' || !UUID_RE.test(block_id)) {
        return res.status(400).json({ error: 'block_id (uuid) es requerido.' });
      }
      if (session_id != null && (typeof session_id !== 'string' || !UUID_RE.test(session_id))) {
        return res.status(400).json({ error: 'session_id inválido.' });
      }
      if (team_id != null && (typeof team_id !== 'string' || !UUID_RE.test(team_id))) {
        return res.status(400).json({ error: 'team_id inválido.' });
      }
      if (!session_id && !team_id) {
        return res.status(400).json({ error: 'Sin session_id hace falta team_id.' });
      }

      // La RPC ya exige staff de la escuela de la sesión; acá además se exige
      // que sea la escuela ACTIVA de la petición (un coach en dos escuelas no
      // escribe en la otra desde esta).
      if (session_id) {
        const { data: s, error: sErr } = await supabase
          .from('training_sessions').select('school_id').eq('id', session_id).maybeSingle();
        if (sErr) throw sErr;
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada.' });
        if (s.school_id !== req.schoolId) return res.status(403).json({ error: 'La sesión no pertenece a esta escuela.' });
      } else {
        const { data: t, error: tErr } = await supabase
          .from('teams').select('school_id').eq('id', team_id).maybeSingle();
        if (tErr) throw tErr;
        if (!t || t.school_id !== req.schoolId) return res.status(403).json({ error: 'El equipo no pertenece a esta escuela.' });
      }

      const { data, error } = await userClient(req).rpc('insert_exercise_into_session_block', {
        p_exercise_id: paramId(req),
        p_session_id: session_id ?? null,
        p_block_id: block_id,
        p_team_id: team_id ?? null,
      });
      if (error) {
        if (error.code === '42501') return res.status(403).json({ error: error.message || 'Sin permiso.' });
        if (error.code === 'P0002') return res.status(404).json({ error: error.message || 'No encontrado.' });
        if (error.code === '22023') return res.status(400).json({ error: error.message || 'Datos inválidos.' });
        throw error;
      }
      res.json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/exercises unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },
);

export default router;
