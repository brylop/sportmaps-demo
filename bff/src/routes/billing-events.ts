import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

const CreateBillingEventSchema = z.object({
    enrollment_id: z.string().uuid(),
    offering_plan_id: z.string().uuid().optional(),
    event_type: z.enum(['charge', 'partial', 'refund', 'late_fee', 'adjustment']).default('charge'),
    amount_due: z.number().min(0),
    amount_paid: z.number().min(0).default(0),
    late_fee_amount: z.number().min(0).default(0),
    currency: z.string().default('COP'),
    due_date: z.string(), // YYYY-MM-DD
    parent_event_id: z.string().uuid().optional(),
    installment_number: z.number().int().positive().optional(),
    payment_id: z.string().uuid().optional(),
    gateway: z.string().optional(),
    gateway_reference: z.string().optional(),
    notes: z.string().optional(),
});

/**
 * GET /api/v1/billing-events
 * Lista billing_events. Admin ve todos de la escuela, atleta/padre solo los suyos.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { enrollment_id, status, limit: limitStr } = req.query;

        let query = supabase
            .from('billing_events')
            .select(`
                *,
                enrollment:enrollments(
                    id, child_id, user_id,
                    offering_plan:offering_plans(name, price)
                )
            `)
            .eq('school_id', schoolId)
            .order('due_date', { ascending: false });

        if (enrollment_id) query = query.eq('enrollment_id', enrollment_id as string);
        if (status) query = query.eq('status', status as string);

        const limit = parseInt(limitStr as string) || 50;
        query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ billing_events: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error listing billing events');
        res.status(500).json({ error: 'Error al listar eventos de facturación' });
    }
});

/**
 * POST /api/v1/billing-events
 * Crea billing event (solo admin).
 */
router.post('/',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const parsed = CreateBillingEventSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;

            const { data, error } = await supabase
                .from('billing_events')
                .insert({ ...parsed.data, school_id: schoolId })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ error: 'Ya existe un evento de facturación para esta combinación' });
                }
                throw error;
            }

            res.status(201).json({ billing_event: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error creating billing event');
            res.status(500).json({ error: 'Error al crear evento de facturación' });
        }
    }
);

/**
 * PATCH /api/v1/billing-events/:id
 * Actualiza billing event (registrar pago parcial, etc).
 */
router.patch('/:id',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const { schoolId } = req;
            const { id } = req.params;

            const { data, error } = await supabase
                .from('billing_events')
                .update(req.body)
                .eq('id', id)
                .eq('school_id', schoolId)
                .select()
                .single();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Evento no encontrado' });

            res.json({ billing_event: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error updating billing event');
            res.status(500).json({ error: 'Error al actualizar evento de facturación' });
        }
    }
);

export default router;
