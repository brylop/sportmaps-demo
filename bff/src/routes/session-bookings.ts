import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayInBogota(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

async function validateChildAccess(childId: string, parentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();
  return !error && !!data;
}

/**
 * Verifica que un enrollment pertenece al atleta autenticado.
 * Para adulto: enrollment.user_id === userId
 * Para hijo:   enrollment.child_id === childId (y childId ya fue validado contra parent)
 */
async function validateEnrollmentOwnership(
  enrollmentId: string,
  userId: string,
  childId?: string
): Promise<{ valid: boolean; schoolId?: string }> {
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select('id, user_id, child_id, school_id, status')
    .eq('id', enrollmentId)
    .maybeSingle();

  if (error || !enrollment || enrollment.status !== 'active') {
    return { valid: false };
  }

  const belongs = childId
    ? enrollment.child_id === childId
    : enrollment.user_id === userId;

  return { valid: belongs, schoolId: enrollment.school_id };
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

const AthleteBookSchema = z.object({
  session_id: z.string().uuid(),
  enrollment_id: z.string().uuid(),
  is_secondary: z.boolean().optional().default(false),
  child_id: z.string().uuid().optional(),
});

const BookSecondarySchema = z.object({
  enrollment_id: z.string().uuid(),
  facility_id: z.string().uuid(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
  })).min(1).max(2),
  notes: z.string().optional(),
  child_id: z.string().uuid().optional(),
});

// ── ADMIN / SCHOOL STAFF ROUTES ──────────────────────────────────────────────

router.get('/:id/availability', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { schoolId } = req;
    const { data: s, error: e } = await supabase
      .from('attendance_sessions')
      .select('id, max_capacity, current_bookings, requires_capacity_check, finalized, session_date')
      .eq('id', id).eq('school_id', schoolId).single();

    if (e || !s) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({
      ...s,
      available_spots: s.max_capacity ? Math.max(0, s.max_capacity - s.current_bookings) : null,
      is_full: s.max_capacity ? s.current_bookings >= s.max_capacity : false,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/book', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const { schoolId } = req;
    const parsed = BookSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

    const { enrollment_id, user_id, child_id, is_secondary, booking_type } = parsed.data;

    const { data, error } = await supabase.from('session_bookings').insert({
      school_id: schoolId, session_id: sessionId, enrollment_id,
      user_id: user_id || null, child_id: child_id || null,
      is_secondary, booking_type, status: 'confirmed',
    }).select().single();

    if (error) return res.status(409).json({ error: error.message });

    const f = is_secondary ? 'secondary_sessions_used' : 'sessions_used';
    const { data: enr } = await supabase.from('enrollments').select(f).eq('id', enrollment_id).single();
    if (enr) await supabase.from('enrollments').update({ [f]: ((enr as any)[f] || 0) + 1 }).eq('id', enrollment_id);

    res.status(201).json({ booking: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/bookings', requireAuth, requireRole('owner', 'admin', 'school_admin', 'coach'), async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const { schoolId } = req;
    const { data, error } = await supabase.from('session_bookings')
      .select('id, status, booking_type, is_secondary, booked_at, user_id, child_id, enrollment_id')
      .eq('session_id', sessionId).eq('school_id', schoolId).neq('status', 'cancelled');

    if (error) throw error;
    if (!data?.length) return res.json({ bookings: [] });

    const uIds = [...new Set(data.map(b => b.user_id).filter(Boolean))];
    const cIds = [...new Set(data.map(b => b.child_id).filter(Boolean))];
    const eIds = [...new Set(data.map(b => b.enrollment_id))];

    const [pRes, cRes, eRes] = await Promise.all([
      uIds.length ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', uIds) : Promise.resolve({ data: [] }),
      cIds.length ? supabase.from('children').select('id, full_name, avatar_url').in('id', cIds) : Promise.resolve({ data: [] }),
      supabase.from('enrollments').select('id, sessions_used, plan:offering_plans(name)').in('id', eIds),
    ]);

    const pM = Object.fromEntries((pRes.data || []).map(p => [p.id, p]));
    const cM = Object.fromEntries((cRes.data || []).map(c => [c.id, c]));
    const eM = Object.fromEntries((eRes.data || []).map(e => [e.id, e]));

    res.json({
      bookings: data.map(b => ({
        ...b,
        person: b.user_id ? pM[b.user_id as string] : cM[b.child_id as string],
        enrollment: eM[b.enrollment_id],
      }))
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { data: b, error } = await supabase
      .from('session_bookings')
      .select('id, user_id, child_id, status, session_id, enrollment_id, is_secondary')
      .eq('id', id).single();

    if (error || !b) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (b.status !== 'confirmed') return res.status(400).json({ error: 'Solo reservas confirmadas' });

    if (b.user_id !== userId && !['owner', 'admin', 'school_admin'].includes(req.role)) {
      let isParent = false;
      if (b.child_id) {
        const { data: child } = await supabase.from('children').select('parent_id').eq('id', b.child_id).single();
        isParent = child?.parent_id === userId;
      }
      if (!isParent) return res.status(403).json({ error: 'Sin permiso' });
    }

    await supabase.from('session_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);

    const f = b.is_secondary ? 'secondary_sessions_used' : 'sessions_used';
    const { data: enr } = await supabase.from('enrollments').select(f).eq('id', b.enrollment_id).single();
    if (enr) await supabase.from('enrollments')
      .update({ [f]: Math.max(0, ((enr as any)[f] || 0) - 1) })
      .eq('id', b.enrollment_id);

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/my-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'No autorizado' });

    let query = supabase.from('session_bookings')
      .select(`id, status, booked_at, session:attendance_sessions(id, session_date)`)
      .order('booked_at', { ascending: false });
    if (child_id) query = query.eq('child_id', child_id);
    else query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ bookings: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── ATHLETE / PARENT ROUTES ──────────────────────────────────────────────────

router.get('/athlete/available', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'No autorizado' });

    // ── Fetch enrollments separados por tipo ──────────────────────────────
    let q = supabase.from('enrollments').select(`
      id, school_id, team_id, offering_plan_id, sessions_used,
      offering_plans!enrollments_offering_plan_id_fkey(max_sessions, offering_id)
    `).eq('status', 'active');
    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data: enrs, error: eErr } = await q;
    if (eErr || !enrs?.length) return res.json({ sessions: [] });

    const sId = enrs[0].school_id;

    // Enrollments de EQUIPO: tienen team_id y NO tienen offering_plan_id
    const teamEnrollments = enrs.filter(e => e.team_id && !e.offering_plan_id);
    // Enrollments de PLAN:   tienen offering_plan_id (con o sin team_id — arquitectura desacoplada)
    const planEnrollments = enrs.filter(e => e.offering_plan_id);

    const tIds = teamEnrollments.map(e => e.team_id).filter(Boolean);
    const oIds = planEnrollments
      .map(e => (e.offering_plans as any)?.offering_id)
      .filter(Boolean);

    const today = todayInBogota();

    const [tRes, oRes] = await Promise.all([
      tIds.length
        ? supabase.from('attendance_sessions')
          .select(`
              id, team_id, session_date, start_time, end_time,
              max_capacity, current_bookings,
              team:teams!attendance_sessions_team_id_fkey(id, name, sport),
              coach:school_staff!attendance_sessions_coach_id_fkey(id, full_name, specialty)
            `)
          .eq('school_id', sId)
          .in('team_id', tIds)
          .eq('is_bookable', true)
          .eq('finalized', false)
          .gte('session_date', today)
        : Promise.resolve({ data: [] }),
      oIds.length
        ? supabase.from('attendance_sessions')
          .select(`
              id, offering_id, session_date, start_time, end_time,
              max_capacity, current_bookings,
              coach:school_staff!attendance_sessions_coach_id_fkey(id, full_name, specialty)
            `)
          .eq('school_id', sId)
          .in('offering_id', oIds)
          .eq('is_bookable', true)
          .eq('finalized', false)
          .gte('session_date', today)
        : Promise.resolve({ data: [] }),
    ]);

    const teamSessions = (tRes.data || []).map((s: any) => ({ ...s, session_type: 'team' as const }));
    const offeringSessions = (oRes.data || []).map((s: any) => ({ ...s, session_type: 'offering' as const }));
    const allSessions = [...teamSessions, ...offeringSessions];

    if (!allSessions.length) return res.json({ sessions: [] });

    // ── Bookings del atleta para marcar already_booked ────────────────────
    const sIds = allSessions.map(s => s.id);
    let bQ = supabase.from('session_bookings')
      .select('session_id')
      .in('session_id', sIds)
      .neq('status', 'cancelled');
    if (child_id) bQ = bQ.eq('child_id', child_id);
    else bQ = bQ.eq('user_id', userId);

    const { data: booked } = await bQ;
    const bookedSet = new Set((booked || []).map(b => b.session_id));

    // ── Mapear manteniendo teams y offerings separados ────────────────────
    const sessions = allSessions.map((s: any) => {
      const availableSpots = Math.max(0, s.max_capacity - s.current_bookings);
      const alreadyBooked = bookedSet.has(s.id);
      const isFull = s.current_bookings >= s.max_capacity;

      if (s.session_type === 'team') {
        // Enrollment del equipo correspondiente
        const enrollment = teamEnrollments.find(e => e.team_id === s.team_id);
        return {
          id: s.id,
          session_type: 'team',
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          max_capacity: s.max_capacity,
          current_bookings: s.current_bookings,
          available_spots: availableSpots,
          already_booked: alreadyBooked,
          // Datos del equipo — nunca offering
          team: s.team ?? null,
          team_id: s.team_id,
          offering_id: null,
          coach: s.coach ?? null,
          // Créditos: equipos no tienen límite de sesiones
          sessions_left: null,
          enrollment_id: enrollment?.id ?? null,
          booking_status: alreadyBooked ? 'already_booked' : isFull ? 'full' : 'open',
        };
      }

      // session_type === 'offering'
      const enrollment = planEnrollments.find(
        e => (e.offering_plans as any)?.offering_id === s.offering_id
      );
      const plan = (enrollment as any)?.offering_plans ?? null;
      const maxSess = plan?.max_sessions ?? null;
      const used = enrollment?.sessions_used ?? 0;
      const sessLeft = maxSess !== null ? Math.max(0, maxSess - used) : null;
      const noCredits = sessLeft !== null && sessLeft <= 0;

      return {
        id: s.id,
        session_type: 'offering',
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        max_capacity: s.max_capacity,
        current_bookings: s.current_bookings,
        available_spots: availableSpots,
        already_booked: alreadyBooked,
        // Datos del offering — nunca team
        team: null,
        team_id: null,
        offering_id: s.offering_id,
        coach: s.coach ?? null,
        // Créditos del plan
        sessions_left: sessLeft,
        enrollment_id: enrollment?.id ?? null,
        booking_status: alreadyBooked ? 'already_booked'
          : isFull ? 'full'
            : noCredits ? 'no_credits'
              : 'open',
      };
    });

    res.json({ sessions });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/athlete/book-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const parsed = AthleteBookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid' });
    const { session_id, enrollment_id, child_id, is_secondary } = parsed.data;

    // ── 1. Validar ownership del child_id ─────────────────────────────────
    if (child_id && !(await validateChildAccess(child_id, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // ── 2. Validar que el enrollment pertenece al atleta ──────────────────
    const { valid: enrollmentValid, schoolId: enrollmentSchoolId } =
      await validateEnrollmentOwnership(enrollment_id, userId, child_id);
    if (!enrollmentValid)
      return res.status(403).json({ error: 'enrollment_unauthorized' });

    // ── 3. Validar sesión y capacidad ─────────────────────────────────────
    const { data: s } = await supabase
      .from('attendance_sessions')
      .select('school_id, max_capacity, current_bookings')
      .eq('id', session_id)
      .single();
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.current_bookings >= s.max_capacity)
      return res.status(409).json({ error: 'session_full' });

    // ── 4. Insertar booking ───────────────────────────────────────────────
    const { data: b, error } = await supabase.from('session_bookings').insert({
      school_id: s.school_id,
      session_id,
      enrollment_id,
      is_secondary: !!is_secondary,
      user_id: child_id ? null : userId,
      child_id: child_id || null,
      status: 'confirmed',
    }).select().single();

    if (error) return res.status(409).json({ error: error.message });

    // ── 5. Incrementar contador de sesiones usadas ────────────────────────
    const f = is_secondary ? 'secondary_sessions_used' : 'sessions_used';
    const { data: enr } = await supabase
      .from('enrollments').select(f).eq('id', enrollment_id).single();
    if (enr) await supabase.from('enrollments')
      .update({ [f]: ((enr as any)[f] || 0) + 1 })
      .eq('id', enrollment_id);

    res.status(201).json({ booking: b });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/athlete/my-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // ── Fetch bookings con sesión y enrollment ────────────────────────────
    // No anidamos offering_plans y teams en el mismo join para no mezclarlos.
    // Los resolvemos en paralelo por separado.
    let q = supabase.from('session_bookings').select(`
      id, status, booked_at, is_secondary, enrollment_id,
      attendance_sessions(
        id, session_date, start_time, end_time, finalized,
        coach:school_staff!attendance_sessions_coach_id_fkey(id, full_name)
      )
    `)
      .neq('status', 'cancelled')
      .order('booked_at', { ascending: false });

    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data: bookings, error } = await q;
    if (error) throw error;
    if (!bookings?.length) return res.json([]);

    // ── Resolver enrollments por tipo (team vs plan) ──────────────────────
    const enrollmentIds = [...new Set(bookings.map(b => b.enrollment_id).filter(Boolean))];
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, team_id, offering_plan_id')
      .in('id', enrollmentIds);

    const enrollmentMap = Object.fromEntries((enrollments || []).map(e => [e.id, e]));

    // IDs de teams y plans referenciados
    const teamIds = [...new Set(
      (enrollments || []).map(e => e.team_id).filter(Boolean)
    )];
    const planIds = [...new Set(
      (enrollments || []).map(e => e.offering_plan_id).filter(Boolean)
    )];

    const [teamsRes, plansRes] = await Promise.all([
      teamIds.length
        ? supabase.from('teams').select('id, name').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      planIds.length
        ? supabase.from('offering_plans').select('id, name').in('id', planIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teamMap = Object.fromEntries((teamsRes.data || []).map(t => [t.id, t]));
    const planMap = Object.fromEntries((plansRes.data || []).map(p => [p.id, p]));

    // ── Mapear respuesta con tipos separados ──────────────────────────────
    const result = bookings.map((b: any) => {
      const enrollment = enrollmentMap[b.enrollment_id] ?? null;
      const isTeamBooking = enrollment?.team_id && !enrollment?.offering_plan_id;

      return {
        id: b.id,
        status: b.status,
        booked_at: b.booked_at,
        is_secondary: b.is_secondary,
        booking_type: isTeamBooking ? 'team' : 'offering',
        enrollment_id: b.enrollment_id,
        attendance_sessions: b.attendance_sessions,
        // Nombre de contexto sin mezclar fuentes
        enrollments: isTeamBooking
          ? { teams: teamMap[enrollment.team_id] ?? null, offering_plans: null }
          : { teams: null, offering_plans: planMap[enrollment?.offering_plan_id] ?? null },
      };
    });

    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/athlete/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { child_id } = req.query;

    // ── 1. Validar ownership del child_id ─────────────────────────────────
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // ── 2. Fetch booking ──────────────────────────────────────────────────
    const { data: b } = await supabase
      .from('session_bookings')
      .select('id, user_id, child_id, session_id, enrollment_id, is_secondary, status')
      .eq('id', id)
      .maybeSingle();

    if (!b) return res.status(404).json({ error: 'not_found' });
    if (b.status === 'cancelled') return res.status(400).json({ error: 'already_cancelled' });

    // ── 3. Verificar que el booking pertenece al usuario autenticado ───────
    const bookingBelongsToUser = child_id
      ? b.child_id === child_id
      : b.user_id === userId;

    if (!bookingBelongsToUser)
      return res.status(403).json({ error: 'unauthorized' });

    // ── 4. Cancelar y decrementar ─────────────────────────────────────────
    await supabase.from('session_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);

    const f = b.is_secondary ? 'secondary_sessions_used' : 'sessions_used';
    const { data: enr } = await supabase
      .from('enrollments').select(f).eq('id', b.enrollment_id).single();
    if (enr) await supabase.from('enrollments')
      .update({ [f]: Math.max(0, ((enr as any)[f] || 0) - 1) })
      .eq('id', b.enrollment_id);

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/athlete/upcoming', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    let q = supabase.from('session_bookings').select(`
      id,
      attendance_sessions!inner(
        id, session_date, start_time, end_time,
        team:teams!attendance_sessions_team_id_fkey(name),
        coach:school_staff!attendance_sessions_coach_id_fkey(full_name)
      )
    `)
      .neq('status', 'cancelled')
      .gte('attendance_sessions.session_date', todayInBogota())
      .order('session_date', { ascending: true, referencedTable: 'attendance_sessions' })
      .limit(5);

    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data } = await q;
    res.json({ sessions: (data || []).map((d: any) => d.attendance_sessions) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/athlete/book-secondary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const parsed = BookSecondarySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid' });
    const { enrollment_id, facility_id, reservation_date, slots, child_id } = parsed.data;

    // ── 1. Validar ownership del child_id ─────────────────────────────────
    if (child_id && !(await validateChildAccess(child_id, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // ── 2. Validar que el enrollment pertenece al atleta ──────────────────
    const { valid: enrollmentValid } =
      await validateEnrollmentOwnership(enrollment_id, userId, child_id);
    if (!enrollmentValid)
      return res.status(403).json({ error: 'enrollment_unauthorized' });

    // ── 3. Insertar reserva ───────────────────────────────────────────────
    const { data: b, error } = await supabase.from('facility_reservations').insert({
      facility_id,
      school_id: req.schoolId,
      user_id: child_id ? null : userId,
      child_id: child_id || null,
      enrollment_id,
      reservation_date,
      start_time: slots[0].start_time,
      end_time: slots[slots.length - 1].end_time,
      status: 'confirmed',
      resv_type: 'secondary_class',
    }).select().single();

    if (error) throw error;

    // ── 4. Incrementar secundarias usadas ─────────────────────────────────
    const { data: enr } = await supabase
      .from('enrollments')
      .select('secondary_sessions_used')
      .eq('id', enrollment_id)
      .single();
    if (enr) await supabase.from('enrollments')
      .update({ secondary_sessions_used: ((enr as any).secondary_sessions_used || 0) + 1 })
      .eq('id', enrollment_id);

    res.status(201).json({ reservation: b });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/athlete/secondary-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    let q = supabase.from('facility_reservations')
      .select('id, status, reservation_date, start_time, end_time, facilities(name, id)')
      .eq('resv_type', 'secondary_class')
      .neq('status', 'cancelled')
      .order('reservation_date', { ascending: false });

    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data } = await q;
    res.json(data || []);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/athlete/secondary/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { child_id } = req.query;

    // ── 1. Validar ownership del child_id ─────────────────────────────────
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // ── 2. Fetch reserva ──────────────────────────────────────────────────
    const { data: r } = await supabase
      .from('facility_reservations')
      .select('id, user_id, child_id, enrollment_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!r) return res.status(404).json({ error: 'not_found' });
    if (r.status === 'cancelled') return res.status(400).json({ error: 'already_cancelled' });

    // ── 3. Verificar que la reserva pertenece al usuario autenticado ───────
    const reservationBelongsToUser = child_id
      ? r.child_id === child_id
      : r.user_id === userId;

    if (!reservationBelongsToUser)
      return res.status(403).json({ error: 'unauthorized' });

    // ── 4. Cancelar y decrementar ─────────────────────────────────────────
    await supabase.from('facility_reservations')
      .update({ status: 'cancelled' })
      .eq('id', id);

    const { data: enr } = await supabase
      .from('enrollments')
      .select('secondary_sessions_used')
      .eq('id', r.enrollment_id)
      .single();
    if (enr) await supabase.from('enrollments')
      .update({ secondary_sessions_used: Math.max(0, ((enr as any).secondary_sessions_used || 0) - 1) })
      .eq('id', r.enrollment_id);

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/athlete/facilities', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    let q = supabase.from('enrollments')
      .select('school_id')
      .eq('status', 'active');
    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data: enrs } = await q;
    const sIds = [...new Set((enrs || []).map(e => e.school_id))];
    if (!sIds.length) return res.json({ facilities: [] });

    const { data: facs } = await supabase
      .from('facilities')
      .select('id, name, type, school_id')
      .in('school_id', sIds)
      .eq('status', 'available')
      .eq('booking_enabled', true);

    res.json({ facilities: facs || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/facility/:id/slots', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, child_id } = req.query;
    const userId = req.user?.id;

    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    const dStr = (date as string) || todayInBogota();

    const { data: f } = await supabase.from('facilities').select('*').eq('id', id).single();
    if (!f) return res.status(404).json({ error: 'not_found' });

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dName = days[new Date(dStr + 'T12:00:00').getDay()];
    const hs = (f.available_hours as any)?.[dName] || [];

    let slots: { start: string; end: string }[] = [];
    if (hs.length > 0) {
      const [start, end] = hs[0].split('-').map((h: string) => parseInt(h));
      for (let i = start; i < end; i++) {
        slots.push({
          start: `${String(i).padStart(2, '0')}:00`,
          end: `${String(i + 1).padStart(2, '0')}:00`,
        });
      }
    }

    const { data: booked } = await supabase
      .from('facility_reservations')
      .select('start_time, user_id, child_id')
      .eq('facility_id', id)
      .eq('reservation_date', dStr)
      .neq('status', 'cancelled');

    const bookedSet = new Set((booked || []).map(b => b.start_time.slice(0, 5)));
    const mySet = new Set(
      (booked || [])
        .filter(b => child_id ? b.child_id === child_id : b.user_id === userId)
        .map(b => b.start_time.slice(0, 5))
    );

    res.json({
      facility_name: f.name,
      slots: slots.map(s => ({
        ...s,
        available: !bookedSet.has(s.start),
        already_booked: mySet.has(s.start),
      })),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── UTILITY ROUTES ────────────────────────────────────────────────────────────

router.post('/generate-sessions', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { team_id, weeks } = req.body;
    const { data, error } = await supabase.rpc('fn_generate_bookable_sessions', {
      p_school_id: req.schoolId, p_team_id: team_id, p_weeks: weeks || 2,
    });
    if (error) throw error;
    res.json({ message: 'success', sessions: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/generate-offering-sessions', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { offering_id, weeks } = req.body;
    const { data, error } = await supabase.rpc('fn_generate_offering_sessions', {
      p_school_id: req.schoolId, p_offering_id: offering_id, p_weeks: weeks || 2,
    });
    if (error) throw error;
    res.json({ message: 'success', sessions: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/extend-horizon', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.rpc('fn_extend_session_horizon', {
      p_school_id: req.schoolId, p_min_weeks: 2, p_target_weeks: 4,
    });
    if (error) throw error;
    res.json({ sessions_created: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;