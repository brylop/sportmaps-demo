import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const CreateStaffSchema = z.object({
  full_name:       z.string().min(2, 'Nombre requerido'),
  email:           z.string().email('Email inválido'),
  phone:           z.string().optional(),
  specialty:       z.string().optional(),
  certifications:  z.array(z.string()).optional().default([]),
  branch_id:       z.string().uuid('branch_id inválido').optional().nullable(),
  status:          z.enum(['active', 'inactive']).optional().default('active'),
});

const UpdateStaffSchema = CreateStaffSchema.partial();

// ── Rutas ─────────────────────────────────────────────────────────────────────

// Listar staff de la escuela
router.get('/', requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: err.message });
  }
});

// Obtener un miembro del staff por ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: err.message });
  }
});

// Crear staff
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const parsed = CreateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }

    // El trigger trg_sync_coach_auth_id se encargará de buscar el auth_id
    const { data, error } = await supabase
      .from('school_staff')
      .insert({ ...parsed.data, school_id: schoolId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar staff
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const parsed = UpdateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }

    const { data, error } = await supabase
      .from('school_staff')
      .update(parsed.data)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar solo el estado del staff
router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: err.message });
  }
});

// Eliminar staff
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
