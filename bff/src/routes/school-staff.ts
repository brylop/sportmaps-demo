import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';

const router = Router();

const STAFF_ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'school_admin'] as const;

// Permite administradores de la escuela O al propio coach gestionando su
// propio registro/disponibilidad. Sin esto, cualquier miembro activo de la
// escuela (padre, atleta, etc.) podía crear/editar/borrar disponibilidad de
// CUALQUIER coach — el BFF corre con service role y bypasea RLS, así que
// requireRole/esta verificación de dueño son la única barrera real.
async function requireStaffAdminOrOwner(req: Request, res: Response, next: NextFunction) {
  if ((STAFF_ADMIN_ROLES as readonly string[]).includes(req.role)) return next();

  const { coachId } = req.params;
  const { schoolId } = req;

  const { data: staff, error } = await supabase
    .from('school_staff')
    .select('id')
    .eq('id', coachId)
    .eq('school_id', schoolId)
    .eq('coach_auth_id', req.user?.id)
    .maybeSingle();

  if (error || !staff) {
    return res.status(403).json({ error: 'No tienes permiso para gestionar la disponibilidad de este coach.' });
  }
  next();
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const CreateStaffSchema = z.object({
  full_name:       z.string().min(2, 'Nombre requerido'),
  email:           z.string().email('Email inválido'),
  phone:           z.string().optional(),
  // specialty queda deprecado (ver COMMENT en la migración) — se sigue
  // aceptando por compatibilidad, pero sports es la fuente de verdad nueva.
  specialty:       z.string().optional(),
  sports:          z.array(z.string()).optional().default([]),
  // 1=Principiante, 2=Intermedio, 3=Avanzado, 4=Elite/Alto rendimiento.
  taught_levels:   z.array(z.number().int().min(1).max(4)).optional().default([]),
  certifications:  z.array(z.string()).optional().default([]),
  branch_id:       z.string().uuid('branch_id inválido').optional().nullable(),
  status:          z.enum(['active', 'inactive']).optional().default('active'),
});

const UpdateStaffSchema = CreateStaffSchema.partial();

/**
 * sports es la fuente de verdad nueva; specialty se sincroniza con su primer
 * elemento para no romper a los lectores viejos (StaffPage.tsx badge, etc.)
 * mientras se migran. Si el caller no manda `sports`, no se toca specialty.
 */
function withSpecialtySync<T extends { sports?: string[] }>(data: T): T & { specialty?: string | null } {
  if (data.sports === undefined) return data;
  return { ...data, specialty: data.sports[0] ?? null };
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

// Listar staff de la escuela
router.get('/', requireAuth, requireRole(...STAFF_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('school_staff')
      .select('*')
      .eq('school_id', schoolId)
      .order('full_name');

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Obtener un miembro del staff por ID
router.get('/:id', requireAuth, requireRole(...STAFF_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { data, error } = await supabase
      .from('school_staff')
      .select('*')
      .eq('id', id)
      .eq('school_id', schoolId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Staff no encontrado' });
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Crear staff
router.post('/', requireAuth, requireRole(...STAFF_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const parsed = CreateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }

    // El trigger trg_sync_coach_auth_id se encargará de buscar el auth_id
    const { data, error } = await supabase
      .from('school_staff')
      .insert({ ...withSpecialtySync(parsed.data), school_id: schoolId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Actualizar staff
router.patch('/:id', requireAuth, requireRole(...STAFF_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const parsed = UpdateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }

    const { data, error } = await supabase
      .from('school_staff')
      .update(withSpecialtySync(parsed.data))
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Actualizar solo el estado del staff
router.patch('/:id/status', requireAuth, requireRole(...STAFF_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const { data, error } = await supabase
      .from('school_staff')
      .update({ status })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Eliminar staff
router.delete('/:id', requireAuth, requireRole(...STAFF_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { error } = await supabase
      .from('school_staff')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── Disponibilidad del Coach ──────────────────────────────────────────────────

// GET /api/v1/school-staff/:coachId/availability
router.get('/:coachId/availability', requireAuth, requireStaffAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { coachId }  = req.params;

    const { data, error } = await supabase
      .from('coach_availability')
      .select('*')
      .eq('coach_id', coachId)
      .eq('school_id', schoolId)
      .order('day_of_week, start_time');

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/v1/school-staff/:coachId/availability
router.post('/:coachId/availability', requireAuth, requireStaffAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { coachId }  = req.params;
    const { 
      day_of_week, 
      start_time, 
      end_time,
      available_for_group_classes, 
      available_for_personal_classes,
      max_group_capacity 
    } = req.body;

    const { data, error } = await supabase
      .from('coach_availability')
      .upsert({
        school_id: schoolId,
        coach_id: coachId,
        day_of_week,
        start_time,
        end_time,
        available_for_group_classes,
        available_for_personal_classes,
        max_group_capacity: max_group_capacity ?? null,
      }, { onConflict: 'coach_id,day_of_week,start_time,end_time' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/v1/school-staff/:coachId/availability/:availId
router.delete('/:coachId/availability/:availId', requireAuth, requireStaffAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { coachId, availId } = req.params;

    const { error } = await supabase
      .from('coach_availability')
      .delete()
      .eq('id', availId)
      .eq('coach_id', coachId)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error({ err }, 'school-staff unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
