import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

// ── Helper ──────────────────────────────────────────────────────────────────
function todayInBogota(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // 'YYYY-MM-DD'
}

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

// MOVED athlete routes here to avoid path collision with /:id/availability and /:id/book

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

// ═══════════════════════════════════════════════════════════════════════════
// AGREGAR al final de bff/src/routes/session-bookings.ts
// ANTES de: export default router;
//
// Nuevos endpoints (9 total):
//   GET  /athlete/available          — sesiones bookables del atleta
//   POST /athlete/book               — reservar sesión principal
//   GET  /athlete/my-bookings        — reservas activas del atleta
//   DELETE /athlete/:id/cancel       — cancelar reserva principal
//   POST /generate-sessions          — generar sesiones (owner/coach)
//   GET  /athlete/upcoming           — sesiones panel lateral "Clases Programadas"
//   POST /athlete/book-secondary     — reservar clase GYM (secundaria)
//   GET  /athlete/secondary-bookings — reservas GYM del atleta
//   DELETE /athlete/secondary/:id/cancel — cancelar reserva GYM
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /athlete/available ────────────────────────────────────────────────────
router.get('/athlete/available', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    // Enrollments activos — con offering_id resuelto desde offering_plans
    const { data: enrollments, error: enrollErr } = await supabase
      .from('enrollments')
      .select(`
        id, school_id, team_id, offering_plan_id,
        sessions_used, expires_at,
        offering_plans!enrollments_offering_plan_id_fkey(
          max_sessions, offering_id
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (enrollErr) throw enrollErr;
    if (!enrollments?.length) return res.json({ sessions: [] });

    const resolvedSchoolId = (enrollments[0] as any).school_id;

    // Separar enrollments por tipo
    const planEnrollments  = enrollments.filter((e: any) => e.offering_plan_id);
    const teamEnrollments  = enrollments.filter((e: any) => e.team_id && !e.offering_plan_id);

    const offeringIds = [...new Set(
      planEnrollments.map((e: any) => (e.offering_plans as any)?.offering_id).filter(Boolean)
    )];
    const teamIds = [...new Set(
      teamEnrollments.map((e: any) => e.team_id).filter(Boolean)
    )];

    // Buscar sesiones por offering_id (planes desacoplados)
    const offeringSessions = offeringIds.length
      ? await supabase
          .from('attendance_sessions')
          .select(`
            id, team_id, offering_id, session_date, start_time, end_time,
            max_capacity, current_bookings, finalized, is_bookable,
            school_staff!attendance_sessions_coach_id_fkey(id, full_name, specialty)
          `)
          .eq('school_id', resolvedSchoolId)
          .eq('is_bookable', true).eq('finalized', false)
          .in('offering_id', offeringIds)
          .gte('session_date', todayInBogota())
          .lte('session_date', new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0])
          .order('session_date', { ascending: true }).order('start_time', { ascending: true })
      : { data: [] };

    // Buscar sesiones por team_id (equipos sin plan)
    const teamSessions = teamIds.length
      ? await supabase
          .from('attendance_sessions')
          .select(`
            id, team_id, offering_id, session_date, start_time, end_time,
            max_capacity, current_bookings, finalized, is_bookable,
            teams(id, name, sport),
            school_staff!attendance_sessions_coach_id_fkey(id, full_name, specialty)
          `)
          .eq('school_id', resolvedSchoolId)
          .eq('is_bookable', true).eq('finalized', false)
          .in('team_id', teamIds)
          .gte('session_date', todayInBogota())
          .lte('session_date', new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0])
          .order('session_date', { ascending: true }).order('start_time', { ascending: true })
      : { data: [] };

    const allSessions = [
      ...((offeringSessions as any).data ?? []),
      ...((teamSessions as any).data ?? []),
    ];

    if (!allSessions.length) return res.json({ sessions: [] });

    // Bookings existentes del atleta
    const sessionIds = allSessions.map((s: any) => s.id);
    const { data: myBookings } = await supabase
      .from('session_bookings').select('session_id')
      .eq('user_id', userId).in('session_id', sessionIds).neq('status', 'cancelled');
    const bookedIds = new Set((myBookings ?? []).map((b: any) => b.session_id));

    // Enriquecer sesiones
    const enriched = allSessions.map((s: any) => {
      // Resolver enrollment y nombre del contexto
      let enrollment: any = null;
      let contextName = '';

      if (s.offering_id) {
        enrollment = planEnrollments.find(
          (e: any) => (e.offering_plans as any)?.offering_id === s.offering_id
        );
        // Nombre del plan (se puede mejorar con join al offering)
        contextName = 'Plan';
      } else if (s.team_id) {
        enrollment = teamEnrollments.find((e: any) => e.team_id === s.team_id);
        contextName = (s.teams as any)?.name ?? 'Equipo';
      }

      const plan = (enrollment as any)?.offering_plans as any;
      const sessionsLeft = plan?.max_sessions != null
        ? Math.max(0, plan.max_sessions - ((enrollment as any)?.sessions_used ?? 0))
        : null;

      return {
        id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        max_capacity: s.max_capacity,
        current_bookings: s.current_bookings,
        available_spots: Math.max(0, s.max_capacity - s.current_bookings),
        // team puede ser null para sesiones de offering
        team: s.teams
          ? { id: (s.teams as any).id, name: (s.teams as any).name, sport: (s.teams as any).sport }
          : { id: s.offering_id, name: contextName, sport: '' },
        coach: (s.school_staff as any)
          ? { id: (s.school_staff as any).id, name: (s.school_staff as any).full_name, specialty: (s.school_staff as any).specialty }
          : null,
        enrollment_id: enrollment?.id ?? null,
        offering_id: s.offering_id ?? null,
        sessions_left: sessionsLeft,
        booking_status: bookedIds.has(s.id) ? 'already_booked'
          : s.current_bookings >= s.max_capacity ? 'full'
          : (sessionsLeft !== null && sessionsLeft <= 0) ? 'no_credits'
          : 'open',
        already_booked: bookedIds.has(s.id),
      };
    });

    return res.json({ sessions: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /athlete/book ────────────────────────────────────────────────────────
const AthleteBookSchema = z.object({
  session_id:    z.string().uuid(),
  enrollment_id: z.string().uuid(),
  is_secondary:  z.boolean().optional().default(false),
});

router.post('/athlete/book-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const parsed = AthleteBookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const { session_id, enrollment_id, is_secondary } = parsed.data;

    // Validar sesión
    const { data: session, error: sErr } = await supabase
      .from('attendance_sessions')
      .select('id, team_id, offering_id, school_id, is_bookable, max_capacity, current_bookings, finalized')
      .eq('id', session_id).single();

    if (sErr || !session) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!session.is_bookable) return res.status(400).json({ error: 'Sesión no permite reservas' });
    if (session.finalized) return res.status(400).json({ error: 'Sesión ya finalizada' });
    if (session.current_bookings >= session.max_capacity) return res.status(409).json({ error: 'Sesión llena', code: 'SESSION_FULL' });

    // Validar enrollment
    const { data: enrollment, error: eErr } = await supabase
      .from('enrollments')
      .select('id, user_id, team_id, offering_plan_id, status, sessions_used, secondary_sessions_used, expires_at, offering_plans!enrollments_offering_plan_id_fkey(max_sessions, max_secondary_sessions)')
      .eq('id', enrollment_id).eq('user_id', userId).eq('status', 'active').single();

    if (eErr || !enrollment) return res.status(403).json({ error: 'Inscripción no válida' });
    const sessionIsForOffering = !!session.offering_id;
    const sessionIsForTeam = !!session.team_id && !session.offering_id;

    if (sessionIsForOffering) {
      // Validar que el enrollment tiene acceso a ese offering
      const { data: ep } = await supabase
        .from('offering_plans')
        .select('offering_id')
        .eq('id', (enrollment as any).offering_plan_id)
        .single();
      if (!ep || ep.offering_id !== session.offering_id)
        return res.status(403).json({ error: 'Sesión no pertenece a tu plan' });
    } else if (sessionIsForTeam) {
      if ((enrollment as any).team_id !== session.team_id)
        return res.status(403).json({ error: 'Sesión no pertenece a tu equipo' });
    }
    if ((enrollment as any).expires_at && (enrollment as any).expires_at < todayInBogota()) {
      return res.status(400).json({ error: 'Tu plan ha expirado', code: 'PLAN_EXPIRED' });
    }

    const plan = (enrollment as any).offering_plans as any;
    if (!is_secondary && plan?.max_sessions != null && (enrollment as any).sessions_used >= plan.max_sessions) {
      return res.status(400).json({ error: 'Sin sesiones disponibles en tu plan', code: 'NO_CREDITS' });
    }

    // Verificar duplicado
    const { data: existing } = await supabase
      .from('session_bookings').select('id')
      .eq('session_id', session_id).eq('user_id', userId).neq('status', 'cancelled').maybeSingle();
    if (existing) return res.status(409).json({ error: 'Ya tienes reserva para esta sesión', code: 'ALREADY_BOOKED' });

    // Crear booking
    const { data: booking, error: bErr } = await supabase
      .from('session_bookings')
      .insert({ school_id: session.school_id, session_id, enrollment_id, user_id: userId, status: 'confirmed', booking_type: 'reservation', is_secondary })
      .select().single();
    if (bErr) throw bErr;

    // Incrementar contadores
    const field = is_secondary ? 'secondary_sessions_used' : 'sessions_used';
    await supabase.from('enrollments').update({ [field]: ((enrollment as any)[field] ?? 0) + 1 }).eq('id', enrollment_id);

    return res.status(201).json({ booking, message: 'Reserva confirmada' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /athlete/my-bookings ──────────────────────────────────────────────────
router.get('/athlete/my-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('school_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1);

    const resolvedSchoolId = (enrollments?.[0] as any)?.school_id ?? schoolId;

    const { data, error } = await supabase
      .from('session_bookings')
      .select(`
        id, status, booking_type, is_secondary, booked_at, enrollment_id,
        attendance_sessions(
          id, session_date, start_time, end_time, finalized,
          school_staff!attendance_sessions_coach_id_fkey(id, full_name)
        ),
        enrollments(
          offering_plans!enrollments_offering_plan_id_fkey(name),
          teams(name)
        )
      `)
      .eq('user_id', userId)
      .eq('school_id', resolvedSchoolId)
      .neq('status', 'cancelled')
      .order('booked_at', { ascending: false });

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /athlete/:id/cancel ────────────────────────────────────────────────
router.delete('/athlete/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const { data: booking, error: fErr } = await supabase
      .from('session_bookings')
      .select('id, session_id, enrollment_id, is_secondary, status, attendance_sessions(session_date, finalized)')
      .eq('id', id).eq('user_id', userId).single();

    if (fErr || !booking) return res.status(404).json({ error: 'Reserva no encontrada' });
    if ((booking as any).status === 'cancelled') return res.status(400).json({ error: 'Ya cancelada' });
    if (((booking as any).attendance_sessions as any)?.finalized) return res.status(400).json({ error: 'Sesión ya finalizada' });

    await supabase.from('session_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);
    await supabase.rpc('decrement_session_bookings', { p_session_id: (booking as any).session_id });

    const field = (booking as any).is_secondary ? 'secondary_sessions_used' : 'sessions_used';
    const { data: enr } = await supabase.from('enrollments').select(field).eq('id', (booking as any).enrollment_id).single();
    if (enr) {
      await supabase.from('enrollments').update({ [field]: Math.max(0, ((enr as any)[field] ?? 1) - 1) }).eq('id', (booking as any).enrollment_id);
    }

    return res.json({ success: true, message: 'Reserva cancelada y crédito devuelto' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /generate-sessions ───────────────────────────────────────────────────
router.post('/generate-sessions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const parsed = z.object({
      team_id: z.string().uuid(),
      weeks:   z.number().int().min(1).max(8).optional().default(2),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

    const { data, error } = await supabase.rpc('fn_generate_bookable_sessions', {
      p_school_id: schoolId,
      p_team_id:   parsed.data.team_id,
      p_weeks:     parsed.data.weeks,
    });
    if (error) throw error;

    const created = (data ?? []).filter((r: any) => r.was_created);
    return res.json({ message: `${created.length} sesiones creadas`, sessions: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /athlete/upcoming ─────────────────────────────────────────────────────
router.get('/athlete/upcoming', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('team_id, school_id, offering_plan_id, offering_plans!enrollments_offering_plan_id_fkey(offering_id)')
      .eq('user_id', userId).eq('status', 'active');

    if (!enrollments?.length) return res.json({ sessions: [] });

    const resolvedSchoolId = (enrollments[0] as any).school_id;
    const today = todayInBogota();
    const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const teamIds = [...new Set(
      enrollments.filter((e: any) => e.team_id && !e.offering_plan_id)
        .map((e: any) => e.team_id).filter(Boolean)
    )];
    const offeringIds = [...new Set(
      enrollments.filter((e: any) => e.offering_plan_id)
        .map((e: any) => (e.offering_plans as any)?.offering_id).filter(Boolean)
    )];

    const [teamRes, offeringRes] = await Promise.all([
      teamIds.length
        ? supabase.from('attendance_sessions')
            .select('id, session_date, start_time, end_time, current_bookings, max_capacity, teams:team_id(id, name, sport), coach:coach_id(id, full_name, specialty)')
            .eq('school_id', resolvedSchoolId).in('team_id', teamIds)
            .eq('is_bookable', true).eq('finalized', false)
            .gte('session_date', today).lte('session_date', in14)
            .order('session_date', { ascending: true }).order('start_time', { ascending: true }).limit(5)
        : Promise.resolve({ data: [] }),
      offeringIds.length
        ? supabase.from('attendance_sessions')
            .select('id, session_date, start_time, end_time, current_bookings, max_capacity, offering_id, coach:coach_id(id, full_name, specialty)')
            .eq('school_id', resolvedSchoolId).in('offering_id', offeringIds)
            .eq('is_bookable', true).eq('finalized', false)
            .gte('session_date', today).lte('session_date', in14)
            .order('session_date', { ascending: true }).order('start_time', { ascending: true }).limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    const allSessions = [
      ...((teamRes as any).data ?? []),
      ...((offeringRes as any).data ?? []),
    ].sort((a: any, b: any) =>
      a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time)
    ).slice(0, 10);

    const sIds = allSessions.map((s: any) => s.id);
    const { data: booked } = sIds.length
      ? await supabase.from('session_bookings').select('session_id')
          .eq('user_id', userId).in('session_id', sIds).in('status', ['confirmed', 'attended'])
      : { data: [] };
    const bookedSet = new Set((booked ?? []).map((b: any) => b.session_id));

    return res.json({
      sessions: allSessions.map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        available_spots: Math.max(0, (s.max_capacity ?? 20) - (s.current_bookings ?? 0)),
        max_capacity: s.max_capacity ?? 20,
        current_bookings: s.current_bookings ?? 0,
        already_booked: bookedSet.has(s.id),
        team: s.teams ?? (s.offering_id ? { id: s.offering_id, name: 'Plan', sport: '' } : null),
        coach: s.coach ? { id: s.coach.id, name: s.coach.full_name, specialty: s.coach.specialty } : null,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /athlete/book-secondary ──────────────────────────────────────────────
const BookSecondarySchema = z.object({
  enrollment_id:    z.string().uuid(),
  facility_id:      z.string().uuid(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(z.object({
    start_time:       z.string().regex(/^\d{2}:\d{2}$/),
    end_time:         z.string().regex(/^\d{2}:\d{2}$/),
  })).min(1).max(2),
  notes:            z.string().optional(),
});

router.post('/athlete/book-secondary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const parsed = BookSecondarySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const { enrollment_id, facility_id, reservation_date, slots, notes } = parsed.data;

    // Validar enrollment y créditos secundarios
    const { data: enrollment, error: eErr } = await supabase
      .from('enrollments')
      .select('id, user_id, status, secondary_sessions_used, expires_at, offering_plans!enrollments_offering_plan_id_fkey(max_secondary_sessions, metadata)')
      .eq('id', enrollment_id).single();

    if (eErr || !enrollment) return res.status(404).json({ error: 'Inscripción no encontrada' });
    if ((enrollment as any).user_id !== userId) return res.status(403).json({ error: 'No autorizado' });
    if ((enrollment as any).status !== 'active') return res.status(400).json({ error: 'Inscripción no activa' });
    if ((enrollment as any).expires_at && (enrollment as any).expires_at < todayInBogota()) {
      return res.status(400).json({ error: 'Tu plan ha expirado' });
    }

    const plan = (enrollment as any).offering_plans as any;
    const maxSec = plan?.max_secondary_sessions ?? 0;
    const currentUsed = (enrollment as any).secondary_sessions_used ?? 0;

    if (maxSec === 0) return res.status(400).json({ error: 'Tu plan no incluye clases secundarias' });

    // Calcular créditos a descontar
    let creditsToDeduct = slots.length;
    if (slots.length === 2) {
      const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
      if (sorted[0].end_time === sorted[1].start_time) {
        creditsToDeduct = 1;
      }
    }

    if (currentUsed + creditsToDeduct > maxSec) {
      return res.status(400).json({ error: 'No tienes suficientes clases secundarias disponibles' });
    }

    // Validar instalación
    const { data: facility, error: fErr } = await supabase
      .from('facilities').select('id, school_id, capacity, name').eq('id', facility_id).single();
    if (fErr || !facility) return res.status(404).json({ error: 'Instalación no encontrada' });

    // Verificar cupo y duplicados para cada slot
    for (const slot of slots) {
      const { count: slotCount } = await supabase
        .from('facility_reservations').select('*', { count: 'exact', head: true })
        .eq('facility_id', facility_id).eq('reservation_date', reservation_date)
        .eq('start_time', `${slot.start_time}:00`).neq('status', 'cancelled');

      if ((slotCount ?? 0) >= ((facility as any).capacity ?? 20)) {
        return res.status(409).json({ error: `No hay cupo disponible a las ${slot.start_time}` });
      }

      const { data: existing } = await supabase
        .from('facility_reservations').select('id')
        .eq('facility_id', facility_id).eq('user_id', userId).eq('reservation_date', reservation_date)
        .eq('start_time', `${slot.start_time}:00`).neq('status', 'cancelled').maybeSingle();

      if (existing) {
        return res.status(409).json({ error: `Ya tienes agendada esta clase a las ${slot.start_time}.` });
      }
    }

    // Crear reservas
    const createdReservations = [];
    for (const slot of slots) {
      const { data: reservation, error: rErr } = await supabase
        .from('facility_reservations')
        .insert({
          facility_id, user_id: userId, reservation_date,
          start_time: `${slot.start_time}:00`, end_time: `${slot.end_time}:00`,
          status: 'confirmed', school_id: (facility as any).school_id,
          notes: notes ?? `Clase ${plan?.metadata?.secondary_session_label ?? 'GYM'}`,
          booker_type: 'athlete', resv_type: 'secondary_class', payment_status: 'paid',
        })
        .select().single();

      if (rErr) throw rErr;
      createdReservations.push(reservation);
    }

    // Descontar créditos
    const { error: uErr } = await supabase.from('enrollments')
      .update({ secondary_sessions_used: currentUsed + creditsToDeduct })
      .eq('id', enrollment_id);

    if (uErr) {
      // Rollback (cancelar reservas creadas)
      const ids = createdReservations.map(r => (r as any).id);
      await supabase.from('facility_reservations').update({ status: 'cancelled' }).in('id', ids);
      throw uErr;
    }

    return res.status(201).json({
      reservations: createdReservations,
      secondary_sessions_remaining: maxSec - (currentUsed + creditsToDeduct),
    });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error booking secondary');
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /athlete/secondary-bookings ──────────────────────────────────────────
router.get('/athlete/secondary-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data, error } = await supabase
      .from('facility_reservations')
      .select('id, reservation_date, start_time, end_time, status, notes, facilities:facility_id(id, name, type)')
      .eq('user_id', userId).eq('resv_type', 'secondary_class')
      .neq('status', 'cancelled')
      .gte('reservation_date', todayInBogota())
      .order('reservation_date', { ascending: true }).order('start_time', { ascending: true });

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /athlete/secondary/:id/cancel ──────────────────────────────────────
router.delete('/athlete/secondary/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const { data: reservation, error: rErr } = await supabase
      .from('facility_reservations')
      .select('id, user_id, status, reservation_date, start_time')
      .eq('id', id).single();

    if (rErr || !reservation) return res.status(404).json({ error: 'Reserva no encontrada' });
    if ((reservation as any).user_id !== userId) return res.status(403).json({ error: 'No autorizado' });
    if ((reservation as any).status === 'cancelled') return res.status(400).json({ error: 'Ya cancelada' });

    // Verificar si es pasada usando solo fecha (según requerimiento de hoy vs hoy)
    if ((reservation as any).reservation_date < todayInBogota()) {
      return res.status(400).json({ error: 'No puedes cancelar una clase pasada' });
    }

    await supabase.from('facility_reservations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);

    // Devolver crédito
    const { data: enr } = await supabase
      .from('enrollments').select('id, secondary_sessions_used')
      .eq('user_id', userId).eq('status', 'active').not('offering_plan_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (enr && ((enr as any).secondary_sessions_used ?? 0) > 0) {
      await supabase.from('enrollments')
        .update({ secondary_sessions_used: (enr as any).secondary_sessions_used - 1 })
        .eq('id', (enr as any).id);
    }

    return res.json({ success: true, message: 'Reserva cancelada y crédito devuelto' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /generate-offering-sessions ─────────────────────────────────────────
// Genera attendance_sessions para el módulo de OFFERINGS/PLANES.
// El coach se resuelve desde school_staff de la escuela (no desde offering_coaches).
// Llamar desde el panel admin cuando se configure/actualice disponibilidad del coach.
router.post('/generate-offering-sessions',
  requireAuth,
  requireRole('owner', 'admin', 'school_admin'),
  async (req: Request, res: Response) => {
    try {
      const { schoolId } = req;
      const parsed = z.object({
        offering_id: z.string().uuid(),
        weeks: z.number().int().min(1).max(8).optional().default(2),
      }).safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
      }

      const { data, error } = await supabase.rpc('fn_generate_offering_sessions', {
        p_school_id:   schoolId,
        p_offering_id: parsed.data.offering_id,
        p_weeks:       parsed.data.weeks,
      });

      if (error) throw error;

      const created = (data ?? []).filter((r: any) => r.was_created);
      return res.json({
        message: `${created.length} sesiones creadas`,
        sessions: data,
      });
    } catch (err: any) {
      (req as any).log?.error({ err }, 'Error generating offering sessions');
      return res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /extend-horizon ──────────────────────────────────────────────────────
// Llamar al cargar el panel admin de sesiones o el módulo "Mis Clases" del atleta
router.get('/extend-horizon', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase.rpc('fn_extend_session_horizon', {
      p_school_id: schoolId,
      p_min_weeks: 2,
      p_target_weeks: 4,
    });
    if (error) throw error;
    res.json({ sessions_created: data });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error extending session horizon');
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/session-bookings/facility/:id/slots?date=YYYY-MM-DD
// Devuelve los slots disponibles de la facilidad para una fecha,
// generados desde available_hours y restando los ya reservados.
router.get('/facility/:id/slots', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { schoolId } = req;

    // Fecha en timezone Colombia — si no viene en query, usar hoy
    const dateStr = (req.query.date as string) || todayInBogota();

    // Obtener facilidad con available_hours
    const { data: facility, error: fErr } = await supabase
      .from('facilities')
      .select('id, name, capacity, available_hours')
      .eq('id', id)
      .single();

    if (fErr || !facility) return res.status(404).json({ error: 'Instalación no encontrada' });

    // Calcular día de la semana en Colombia
    const date = new Date(dateStr + 'T12:00:00');
    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayName = dayNames[date.getDay()];
    
    const hours = (facility.available_hours as any)?.[dayName];
    if (!hours || hours.length === 0) {
      return res.json({ slots: [], message: 'Instalación cerrada ese día' });
    }

    // Parsear rango y generar slots de 1 hora
    const [openStr, closeStr] = hours[0].split('-');
    const [openH]  = openStr.split(':').map(Number);
    const [closeH] = closeStr.split(':').map(Number);

    const allSlots: { start: string; end: string }[] = [];
    for (let h = openH; h < closeH; h++) {
      allSlots.push({
        start: `${String(h).padStart(2,'0')}:00`,
        end:   `${String(h + 1).padStart(2,'0')}:00`,
      });
    }

    // Obtener reservas activas para esa fecha y facilidad
    const { data: booked } = await supabase
      .from('facility_reservations')
      .select('start_time, user_id')
      .eq('facility_id', id)
      .eq('reservation_date', dateStr)
      .neq('status', 'cancelled');

    const bookedTimes = new Set((booked ?? []).map((b: any) => b.start_time.slice(0, 5)));
    const myBookedTimes = new Set(
      (booked ?? [])
        .filter((b: any) => b.user_id === req.user?.id)
        .map((b: any) => b.start_time.slice(0, 5))
    );

    // Enriquecer slots con disponibilidad
    const slots = allSlots.map(slot => ({
      start: slot.start,
      end:   slot.end,
      available:      !bookedTimes.has(slot.start),
      already_booked: myBookedTimes.has(slot.start),
    }));

    return res.json({ slots, facility_name: facility.name });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /athlete/facilities ───────────────────────────────────────────────────
// Devuelve las instalaciones (status=available, booking_enabled=true)
// que pertenecen a las escuelas donde el atleta tiene enrollments activos.
router.get('/athlete/facilities', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    // 1. Obtener school_ids de los enrollments activos del atleta
    const { data: enrollments, error: eErr } = await supabase
      .from('enrollments')
      .select('school_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (eErr) throw eErr;
    if (!enrollments?.length) return res.json({ facilities: [] });

    const schoolIds = [...new Set(
      enrollments.map((e: any) => e.school_id).filter(Boolean)
    )];

    // 2. Cargar instalaciones de esas escuelas
    const { data: facilities, error: fErr } = await supabase
      .from('facilities')
      .select('id, name, type, capacity, description, available_hours, booking_enabled, branch_id, school_id')
      .in('school_id', schoolIds)
      .eq('status', 'available')
      .eq('booking_enabled', true);

    if (fErr) throw fErr;
    return res.json({ facilities: facilities ?? [] });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error fetching athlete facilities');
    return res.status(500).json({ error: err.message });
  }
});

export default router;

