/**
 * Paquetes de la Biblioteca de ejercicios — pizarra M2 (D4 y §4 de
 * docs/specs/pizarra-multideporte-3d-ia.md; migración 20261014121142).
 *
 *   GET  /api/v1/school/exercise-packs                 paquetes de la escuela + estado
 *   POST /api/v1/school/exercise-packs/:id/activate    RPC activate_exercise_pack
 *   POST /api/v1/school/exercise-packs/:id/deactivate  RPC deactivate_exercise_pack
 *   GET  /api/v1/school/exercise-packs/:id/export      archivo .json del paquete
 *   GET  /api/v1/school/exercise-packs/mine/export     archivo .json con los ejercicios
 *                                                      propios que no están en un paquete
 *   POST /api/v1/school/exercise-packs/import          ?dry_run=true → vista previa
 *                                                      sin escribir; sin él → RPC
 *                                                      import_exercise_pack
 *
 * Igual que exercises.ts: lecturas con el cliente de servicio y el filtro de
 * escuela EXPLÍCITO (req.schoolId); las escrituras SOLO por las RPC con
 * userClient(req), que autorizan con auth.uid() (gate interno
 * user_admin_school_ids() ∪ user_tactical_edit_school_ids()). El requireRole
 * de acá es la primera barrera, no la única.
 *
 * Ver qué paquetes y exportar: cualquiera que trabaja en la escuela (staff).
 * Activar, desactivar e importar: administración + coaches (PACK_MANAGE_ROLES).
 */
import { Router, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { userClient } from '../../utils/userClient';
import { UUID_RE, EXERCISE_SPORTS } from './exerciseShapes';
import { loadSchoolLibrarySports } from './exercises';
import { isMissingPacksSchema, loadPackVisibility } from './exercisePackState';
import {
  MAX_IMPORT_BYTES,
  MAX_PACK_EXERCISES,
  buildPackFile,
  packFileName,
  validatePackFile,
  type ExportableExercise,
} from './exercisePackShapes';

const router = Router();

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
/** = user_admin_school_ids() ∪ user_tactical_edit_school_ids() de las RPC. */
export const PACK_MANAGE_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach'] as const;

const PACK_COLUMNS = 'id, school_id, sport, name, description, version, is_active, updated_at';
const EXPORT_COLUMNS = 'name, objective, minutes, age_group, materials, tags, sport, description, board';

interface PackRow {
  id: string;
  school_id: string | null;
  sport: string;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  updated_at: string;
}

const paramId = (req: AuthenticatedRequest) => String(req.params.id ?? '');
const isTrue = (v: unknown) => v === 'true' || v === '1';
const NOT_READY = { error: 'Los paquetes de ejercicios todavía no están disponibles.' };
const sportOrder = (s: string) => {
  const i = (EXERCISE_SPORTS as readonly string[]).indexOf(s);
  return i < 0 ? 99 : i;
};

function fail(req: AuthenticatedRequest, res: Response, err: unknown) {
  if (isMissingPacksSchema(err)) return res.status(503).json(NOT_READY);
  req.log?.error({ err }, 'school/exercise-packs unhandled error');
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

/** Errores de las RPC → HTTP (42501 sin permiso, P0002 no existe, 22023/23514 datos). */
function rpcError(res: Response, error: { code?: string; message?: string }) {
  if (error.code === '42501') return res.status(403).json({ error: error.message || 'Sin permiso.' });
  if (error.code === 'P0002') return res.status(404).json({ error: error.message || 'Paquete no encontrado.' });
  if (error.code === '22023' || error.code === '23514' || error.code === '22P02' || error.code === '22001') {
    return res.status(422).json({ error: error.message || 'Datos inválidos.' });
  }
  return null;
}

async function loadPack(id: string): Promise<PackRow | null> {
  const { data, error } = await supabase.from('exercise_packs').select(PACK_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as PackRow | null) ?? null;
}

/** ¿La escuela puede ver este paquete? Propio: siempre. Del sistema: activo y
 *  de sus deportes (D1). Otro: como si no existiera. */
function packVisibleTo(pack: PackRow, schoolId: string, allowed: readonly string[]) {
  if (pack.school_id === null) return pack.is_active && allowed.includes(pack.sport);
  return pack.school_id === schoolId;
}

// GET /api/v1/school/exercise-packs
// → { mode: 'todos'|'seleccion', can_manage, loose_own_count, packs: [...] }
router.get(
  '/exercise-packs',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const vis = await loadPackVisibility(schoolId);
      if (!vis) return res.status(503).json(NOT_READY);
      const allowed: string[] = await loadSchoolLibrarySports(schoolId);

      const { data, error } = await supabase
        .from('exercise_packs')
        .select(PACK_COLUMNS)
        .or(`school_id.is.null,school_id.eq.${schoolId}`);
      if (error) throw error;
      const packs = ((data ?? []) as PackRow[]).filter((p) => packVisibleTo(p, schoolId, allowed));

      const counts = new Map<string, number>();
      let looseOwn = 0;
      if (packs.length > 0) {
        const { data: ex, error: exErr } = await supabase
          .from('training_exercises')
          .select('pack_id, school_id')
          .in('pack_id', packs.map((p) => p.id))
          .eq('is_active', true);
        if (exErr) throw exErr;
        const bySchool = new Map(packs.map((p) => [p.id, p.school_id]));
        for (const r of (ex ?? []) as { pack_id: string; school_id: string | null }[]) {
          // Un ejercicio solo cuenta en un paquete de su misma escuela (o los dos del sistema).
          if (bySchool.get(r.pack_id) !== r.school_id) continue;
          counts.set(r.pack_id, (counts.get(r.pack_id) ?? 0) + 1);
        }
      }
      {
        const { data: loose, error: lErr } = await supabase
          .from('training_exercises')
          .select('id')
          .eq('school_id', schoolId)
          .is('pack_id', null)
          .eq('is_active', true)
          .limit(MAX_PACK_EXERCISES + 1);
        if (lErr) throw lErr;
        looseOwn = (loose ?? []).length;
      }

      const activated = new Set(vis.activatedSystemPackIds);
      const out = packs
        .map((p) => {
          const isSystem = p.school_id === null;
          const isActivated = isSystem ? activated.has(p.id) : p.is_active;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            sport: p.sport,
            version: p.version,
            is_system: isSystem,
            activated: isActivated,
            // ¿Sus ejercicios salen hoy en la biblioteca?
            visible: isSystem ? (vis.mode === 'todos' || isActivated) : p.is_active,
            exercise_count: counts.get(p.id) ?? 0,
            updated_at: p.updated_at,
          };
        })
        .sort((a, b) =>
          Number(b.is_system) - Number(a.is_system)
          || (a.is_system ? sportOrder(a.sport) - sportOrder(b.sport) : 0)
          || (a.is_system ? a.name.localeCompare(b.name, 'es') : String(b.updated_at).localeCompare(String(a.updated_at))));

      res.json({
        mode: vis.mode,
        can_manage: (PACK_MANAGE_ROLES as readonly string[]).includes(req.role),
        loose_own_count: Math.min(looseOwn, MAX_PACK_EXERCISES),
        packs: out,
      });
    } catch (err) {
      fail(req, res, err);
    }
  },
);

// GET /api/v1/school/exercise-packs/mine/export — los ejercicios propios que no
// están en ningún paquete (lo guardado desde la pizarra), como un paquete.
// Va ANTES de /:id/export.
router.get(
  '/exercise-packs/mine/export',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const base = () => supabase
        .from('training_exercises')
        .select(EXPORT_COLUMNS)
        .eq('school_id', schoolId)
        .eq('is_active', true);
      let { data, error } = await base().is('pack_id', null).order('created_at', { ascending: true }).limit(MAX_PACK_EXERCISES);
      // Migración M2 sin aplicar (sin pack_id): todos los propios.
      if (error && isMissingPacksSchema(error)) {
        ({ data, error } = await base().order('created_at', { ascending: true }).limit(MAX_PACK_EXERCISES));
      }
      if (error) throw error;
      const rows = (data ?? []) as ExportableExercise[];
      if (rows.length === 0) return res.status(404).json({ error: 'Tu escuela no tiene ejercicios propios para exportar.' });

      const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
      // Deporte del paquete: el que más se repite (empate → orden del catálogo).
      const freq = new Map<string, number>();
      for (const r of rows) freq.set(r.sport, (freq.get(r.sport) ?? 0) + 1);
      const sport = [...freq.entries()].sort((a, b) => b[1] - a[1] || sportOrder(a[0]) - sportOrder(b[0]))[0][0];
      const name = `Ejercicios de ${String((school as { name?: string } | null)?.name ?? 'mi escuela').slice(0, 100)}`;

      const file = buildPackFile({ name, description: null, sport, version: 1 }, rows);
      res.setHeader('Content-Disposition', `attachment; filename="${packFileName(name)}"`);
      res.json(file);
    } catch (err) {
      fail(req, res, err);
    }
  },
);

// GET /api/v1/school/exercise-packs/:id/export
router.get(
  '/exercise-packs/:id/export',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = paramId(req);
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido.' });
      const pack = await loadPack(id);
      const allowed: string[] = pack?.school_id === null ? await loadSchoolLibrarySports(req.schoolId) : [];
      if (!pack || !packVisibleTo(pack, req.schoolId, allowed)) {
        return res.status(404).json({ error: 'Paquete no encontrado.' });
      }

      let q = supabase
        .from('training_exercises')
        .select(EXPORT_COLUMNS)
        .eq('pack_id', pack.id)
        .eq('is_active', true);
      // Solo los ejercicios de la MISMA escuela del paquete (o del sistema).
      q = pack.school_id === null ? q.is('school_id', null) : q.eq('school_id', req.schoolId);
      const { data, error } = await q.order('created_at', { ascending: true }).limit(MAX_PACK_EXERCISES);
      if (error) throw error;

      const file = buildPackFile(pack, (data ?? []) as ExportableExercise[]);
      res.setHeader('Content-Disposition', `attachment; filename="${packFileName(pack.name)}"`);
      res.json(file);
    } catch (err) {
      fail(req, res, err);
    }
  },
);

// POST /api/v1/school/exercise-packs/import[?dry_run=true]
// Body: el archivo tal cual ({ format, version, pack, exercises }).
//   dry_run → 200 { valid, errors, summary } sin escribir nada (vista previa).
//   import  → 201 { pack_id, exercises, summary } | 422 { error, details, summary }
router.post(
  '/exercise-packs/import',
  requireAuth,
  requireRole(...PACK_MANAGE_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const declared = Number(req.headers['content-length'] ?? 0);
      if (Number.isFinite(declared) && declared > MAX_IMPORT_BYTES) {
        return res.status(413).json({ error: 'El archivo pesa más de 4 MB.' });
      }
      const allowed: string[] = await loadSchoolLibrarySports(req.schoolId);
      const { errors, value, summary } = validatePackFile(req.body, allowed);

      if (isTrue(req.query.dry_run)) {
        return res.json({ valid: errors.length === 0, errors, summary });
      }
      if (errors.length || !value) {
        return res.status(422).json({ error: 'El paquete no se puede importar: revisa los errores.', details: errors, summary });
      }

      const { data, error } = await userClient(req).rpc('import_exercise_pack', {
        p_school_id: req.schoolId,
        p_payload: { pack: value.pack, exercises: value.exercises },
      });
      if (error) {
        if (isMissingPacksSchema(error) || error.code === 'PGRST202') return res.status(503).json(NOT_READY);
        if (rpcError(res, error)) return;
        throw error;
      }
      res.status(201).json({ ...(data as object), summary });
    } catch (err) {
      fail(req, res, err);
    }
  },
);

async function toggle(req: AuthenticatedRequest, res: Response, activate: boolean) {
  try {
    const id = paramId(req);
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido.' });
    const pack = await loadPack(id);
    if (!pack || (pack.school_id !== null && pack.school_id !== req.schoolId) || (pack.school_id === null && !pack.is_active)) {
      return res.status(404).json({ error: 'Paquete no encontrado.' });
    }
    if (activate && pack.school_id === null) {
      const allowed: string[] = await loadSchoolLibrarySports(req.schoolId);
      if (!allowed.includes(pack.sport)) {
        return res.status(422).json({ error: 'Ese paquete es de un deporte que tu escuela no tiene.' });
      }
    }
    const fn = activate ? 'activate_exercise_pack' : 'deactivate_exercise_pack';
    const { data, error } = await userClient(req).rpc(fn, { p_school_id: req.schoolId, p_pack_id: id });
    if (error) {
      if (isMissingPacksSchema(error) || error.code === 'PGRST202') return res.status(503).json(NOT_READY);
      if (rpcError(res, error)) return;
      throw error;
    }
    res.json(data);
  } catch (err) {
    fail(req, res, err);
  }
}

router.post('/exercise-packs/:id/activate', requireAuth, requireRole(...PACK_MANAGE_ROLES),
  (req: AuthenticatedRequest, res: Response) => toggle(req, res, true));
router.post('/exercise-packs/:id/deactivate', requireAuth, requireRole(...PACK_MANAGE_ROLES),
  (req: AuthenticatedRequest, res: Response) => toggle(req, res, false));

export default router;
