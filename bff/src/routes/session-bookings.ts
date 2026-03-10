import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const BookSessionSchema = z.object({
    enrollment_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    child_id: z.string().uuid().optional(),
    is_secondary: z.boolean().default(false),
    booking_type: z.enum(['reservation', 'drop_in', 'walk_in']).default('reservation'),
}).refine(
    (data) => (data.user_id && !data.child_id) || (!data.user_id && data.child_id),
    { message: 'Debe especificar user_id o child_id, no ambos' }
);

// ── GET /api/v1/sessions/:id/availability ────────────────────────────────────

router.get('/:id/availability', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { schoolId } = req;

        const { data: session, error } = await supabase
            .from('attendance_sessions')
            .select('id, max_capacity, current_bookings, requires_capacity_check, finalized, session_date, team_id')
            .eq('id', id)
            .eq('school_id', schoolId)
            .single();

        if (error || !session) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        const available = session.max_capacity
            ? Math.max(0, session.max_capacity - session.current_bookings)
            : null;

        res.json({
            session_id: session.id,
            session_date: session.session_date,
            team_id: session.team_id,
            max_capacity: session.max_capacity,
            current_bookings: session.current_bookings,
            available_spots: available,
            requires_capacity_check: session.requires_capacity_check,
            is_full: session.max_capacity ? session.current_bookings >= session.max_capacity : false,
            finalized: session.finalized,
        });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching availability');
        res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
});

// ── POST /api/v1/sessions/:id/book ──────────────────────────────────────────

router.post('/:id/book', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id: sessionId } = req.params;
        const { schoolId } = req;

        const parsed = BookSessionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }

        const { enrollment_id, user_id, child_id, is_secondary, booking_type } = parsed.data;

        // El trigger fn_process_session_booking valida aforo, créditos y concurrencia
        const { data, error } = await supabase
            .from('session_bookings')
            .insert({
                school_id: schoolId,
                session_id: sessionId,
                enrollment_id,
                user_id: user_id || null,
                child_id: child_id || null,
                is_secondary,
                booking_type,
                status: 'confirmed',
            })
            .select()
            .single();

        if (error) {
            const msg = error.message || '';
            if (msg.includes('Sesión llena')) {
                return res.status(409).json({ error: 'Sesión llena', code: 'SESSION_FULL' });
            }
            if (msg.includes('Sesiones agotadas') || msg.includes('secundarias agotadas')) {
                return res.status(409).json({ error: 'Sesiones agotadas en tu plan', code: 'SESSIONS_EXHAUSTED' });
            }
            if (msg.includes('plan ha expirado')) {
                return res.status(409).json({ error: 'Tu plan ha expirado', code: 'PLAN_EXPIRED' });
            }
            if (msg.includes('finalizada')) {
                return res.status(409).json({ error: 'Sesión ya finalizada', code: 'SESSION_FINALIZED' });
            }
            if (msg.includes('enrollment no está activo')) {
                return res.status(409).json({ error: 'Tu inscripción no está activa', code: 'ENROLLMENT_INACTIVE' });
            }
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Ya tienes una reserva en esta sesión', code: 'ALREADY_BOOKED' });
            }
            throw error;
        }

        res.status(201).json({ booking: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error creating booking');
        res.status(500).json({ error: 'Error al crear reserva' });
    }
});

// ── GET /api/v1/sessions/:id/bookings ───────────────────────────────────────

router.get('/:id/bookings',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'coach'),
    async (req: Request, res: Response) => {
        try {
            const { id: sessionId } = req.params;
            const { schoolId } = req;

            const { data, error } = await supabase
                .from('session_bookings')
                .select(`
                    id, status, booking_type, is_secondary, booked_at,
                    cancelled_at, user_id, child_id, enrollment_id
                `)
                .eq('session_id', sessionId)
                .eq('school_id', schoolId)
                .neq('status', 'cancelled')
                .order('booked_at', { ascending: true });

            if (error) throw error;
            if (!data || data.length === 0) {
                return res.json({ bookings: [] });
            }

            // ── 3 queries en paralelo en lugar de N×3 ──────────────────────
            const userIds = [...new Set(data.filter(b => b.user_id).map(b => b.user_id))];
            const childIds = [...new Set(data.filter(b => b.child_id).map(b => b.child_id))];
            const enrollIds = [...new Set(data.map(b => b.enrollment_id))];

            const [profilesRes, childrenRes, enrollmentsRes] = await Promise.all([
                userIds.length
                    ? supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url')
                        .in('id', userIds)
                    : Promise.resolve({ data: [], error: null }),
                childIds.length
                    ? supabase
                        .from('children')
                        .select('id, full_name, avatar_url')
                        .in('id', childIds)
                    : Promise.resolve({ data: [], error: null }),
                supabase
                    .from('enrollments')
                    .select(`
                        id, sessions_used, secondary_sessions_used, offering_plan_id,
                        plan:offering_plans(name, max_sessions, max_secondary_sessions)
                    `)
                    .in('id', enrollIds),
            ]);

            if (enrollmentsRes.error) throw enrollmentsRes.error;

            // ── Mapas para lookup O(1) ──────────────────────────────────────
            const profileMap = Object.fromEntries(
                (profilesRes.data || []).map(p => [p.id, p])
            );
            const childMap = Object.fromEntries(
                (childrenRes.data || []).map(c => [c.id, c])
            );
            const enrollmentMap = Object.fromEntries(
                (enrollmentsRes.data || []).map(e => [e.id, e])
            );

            const enriched = data.map(booking => ({
                ...booking,
                person: booking.user_id
                    ? (profileMap[booking.user_id as string] ?? null)
                    : (childMap[booking.child_id as string] ?? null),
                enrollment: booking.enrollment_id ? (enrollmentMap[booking.enrollment_id] ?? null) : null,
            }));

            res.json({ bookings: enriched });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error listing bookings');
            res.status(500).json({ error: 'Error al listar reservas' });
        }
    }
);

// ── DELETE /api/v1/sessions/bookings/:id (cancel booking) ───────────────────

router.delete('/bookings/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { schoolId } = req;
        const userId = req.user.id;

        const { data: booking, error: fetchErr } = await supabase
            .from('session_bookings')
            .select('id, user_id, child_id, status, session_id')
            .eq('id', id)
            .eq('school_id', schoolId)
            .single();

        if (fetchErr || !booking) {
            return res.status(404).json({ error: 'Reserva no encontrada' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ error: 'Solo se pueden cancelar reservas confirmadas' });
        }

        // Verificar ownership
        const isOwner = booking.user_id === userId;
        let isParent = false;
        if (booking.child_id) {
            const { data: child } = await supabase
                .from('children')
                .select('parent_id')
                .eq('id', booking.child_id)
                .single();
            isParent = child?.parent_id === userId;
        }

        if (!isOwner && !isParent && !['owner', 'admin', 'super_admin', 'school_admin'].includes(req.role)) {
            return res.status(403).json({ error: 'No tienes permiso para cancelar esta reserva' });
        }

        // Cancelar — trigger trg_decrement_bookings_on_cancel decrementa current_bookings
        const { error: updateErr } = await supabase
            .from('session_bookings')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_reason: 'Cancelado por usuario',
            })
            .eq('id', id);

        if (updateErr) throw updateErr;

        res.json({ success: true });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error cancelling booking');
        res.status(500).json({ error: 'Error al cancelar reserva' });
    }
});

// ── GET /api/v1/sessions/my-bookings ────────────────────────────────────────

router.get('/my-bookings', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const userId = req.user.id;
        const { child_id, status: statusFilter } = req.query;

        let query = supabase
            .from('session_bookings')
            .select(`
                id, status, booking_type, is_secondary, booked_at, session_id,
                session:attendance_sessions(id, session_date, team_id, finalized)
            `)
            .eq('school_id', schoolId)
            .order('booked_at', { ascending: false })
            .limit(50);

        if (child_id) {
            query = query.eq('child_id', child_id as string);
        } else {
            query = query.eq('user_id', userId);
        }

        if (statusFilter) {
            query = query.eq('status', statusFilter as string);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ bookings: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching my bookings');
        res.status(500).json({ error: 'Error al obtener mis reservas' });
    }
});

export default router;
