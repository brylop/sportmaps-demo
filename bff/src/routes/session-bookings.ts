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
  session_id: z.string(), // Permite UUID real o avail_ pseudo-id
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/:id/bookings', requireAuth, requireRole('owner', 'admin', 'school_admin', 'coach'), async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const { schoolId } = req;
    const { data, error } = await supabase.from('session_bookings')
      .select('id, status, booking_type, is_secondary, booked_at, user_id, child_id, unregistered_athlete_id, enrollment_id')
      .eq('session_id', sessionId).eq('school_id', schoolId).neq('status', 'cancelled');

    if (error) throw error;
    if (!data?.length) return res.json({ bookings: [] });

    const uIds = [...new Set(data.map(b => b.user_id).filter(Boolean))];
    const cIds = [...new Set(data.map(b => b.child_id).filter(Boolean))];
    const urIds = [...new Set(data.map(b => (b as any).unregistered_athlete_id).filter(Boolean))];
    const eIds = [...new Set(data.map(b => b.enrollment_id))];

    const [pRes, cRes, urRes, eRes] = await Promise.all([
      uIds.length ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', uIds) : Promise.resolve({ data: [] }),
      cIds.length ? supabase.from('children').select('id, full_name, avatar_url').in('id', cIds) : Promise.resolve({ data: [] }),
      urIds.length ? supabase.from('unregistered_athletes').select('id, full_name').in('id', urIds) : Promise.resolve({ data: [] }),
      supabase.from('enrollments').select('id, sessions_used, plan:offering_plans(name)').in('id', eIds),
    ]);

    const pM = Object.fromEntries((pRes.data || []).map(p => [p.id, p]));
    const cM = Object.fromEntries((cRes.data || []).map(c => [c.id, c]));
    const urM = Object.fromEntries((urRes.data || []).map((u: any) => [u.id, u]));
    const eM = Object.fromEntries((eRes.data || []).map(e => [e.id, e]));

    res.json({
      bookings: data.map(b => {
        const urId = (b as any).unregistered_athlete_id;
        const person = b.user_id
          ? pM[b.user_id as string]
          : b.child_id
            ? cM[b.child_id as string]
            : urM[urId];
        return { ...b, person, enrollment: eM[b.enrollment_id] };
      })
    });
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/my-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'No autorizado' });

    let query = supabase.from('session_bookings')
      .select(`id, status, booked_at, session:attendance_sessions(id, session_date)`)
      .eq('school_id', req.schoolId)
      .order('booked_at', { ascending: false });
    if (child_id) query = query.eq('child_id', child_id);
    else query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ bookings: data });
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
      id, school_id, team_id, offering_plan_id, offering_id, sessions_used,
      offering_plans!enrollments_offering_plan_id_fkey(max_sessions, offering_id)
    `).eq('status', 'active');
    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data: enrs, error: eErr } = await q;
    if (eErr || !enrs?.length) return res.json({ sessions: [] });

    const allSchoolIds = [...new Set(enrs.map((e: any) => e.school_id))];

    // Enrollments de EQUIPO: tienen team_id y NO tienen offering_plan_id
    const teamEnrollments = enrs.filter(e => e.team_id && !e.offering_plan_id);
    // Enrollments de PLAN:   tienen offering_plan_id
    const planEnrollments = enrs.filter(e => e.offering_plan_id);

    const tIds = teamEnrollments.map(e => e.team_id).filter(Boolean);
    
    // Extracción robusta de offering_id (puede venir en el enrollment o en el join)
    const getOfferingId = (e: any) => {
      if (e.offering_id) return e.offering_id;
      const op = e.offering_plans;
      if (Array.isArray(op)) return op[0]?.offering_id;
      return op?.offering_id;
    };

    const oIds = planEnrollments.map(getOfferingId).filter(Boolean);

    const today = todayInBogota();

    // ── Coaches asignados por offering (si los hay) ──────────────────────────
    const offeringCoachMap: Record<string, string[]> = {};
    if (oIds.length) {
      const { data: offeringCoaches } = await supabase
        .from('offering_coaches')
        .select('offering_id, coach_id')
        .in('offering_id', oIds);

      (offeringCoaches || []).forEach(oc => {
        if (!offeringCoachMap[oc.offering_id]) offeringCoachMap[oc.offering_id] = [];
        offeringCoachMap[oc.offering_id].push(oc.coach_id);
      });
    }

    // Recopilar todos los coaches asignados de todos los planes activos
    const assignedCoachIds = [...new Set(
      planEnrollments.flatMap(e => offeringCoachMap[getOfferingId(e)] ?? [])
    )];
    const hasAssignedCoaches = assignedCoachIds.length > 0;

    const [tRes, oRes] = await Promise.all([
      tIds.length
        ? supabase.from('attendance_sessions')
          .select(`
              id, team_id, session_date, start_time, end_time,
              max_capacity, current_bookings, coach_availability_id,
              team:teams!attendance_sessions_team_id_fkey(id, name, sport),
              coach:school_staff!attendance_sessions_coach_id_fkey(id, full_name, specialty)
            `)
          .in('school_id', allSchoolIds)
          .in('team_id', tIds)
          .eq('is_bookable', true)
          .eq('finalized', false)
          .gte('session_date', today)
        : Promise.resolve({ data: [] }),
      oIds.length
        ? (() => {
          let q = supabase.from('attendance_sessions')
            .select(`
                id, offering_id, session_date, start_time, end_time,
                max_capacity, current_bookings, coach_availability_id,
                coach:school_staff!attendance_sessions_coach_id_fkey(id, full_name, specialty)
              `)
            .in('school_id', allSchoolIds)
            .in('offering_id', oIds)
            .eq('is_bookable', true)
            .eq('finalized', false)
            .gte('session_date', today);

          // ✅ Solo filtrar por coach si hay coaches asignados
          if (hasAssignedCoaches) {
            q = q.in('coach_id', assignedCoachIds);
          }

          return q;
        })()
        : Promise.resolve({ data: [] }),
    ]);

    // ── Fetch coach availability para generar pseudo-sessions ────────────────
    const { data: availData } = await supabase
      .from('coach_availability')
      .select(`id, school_id, coach_id, day_of_week, start_time, end_time, available_for_group_classes, available_for_personal_classes, max_group_capacity, coach:school_staff!coach_availability_coach_id_fkey(id, full_name, specialty)`)
      .in('school_id', allSchoolIds);

    // ── Fetch facility availability (agendamiento principal sin coach) ───────
    // A diferencia del coach: NO se filtra por offering/plan asignado.
    // Cualquier enrollment activo con credito primario puede reservar aqui.
    const { data: facilityAvailData } = await supabase
      .from('facility_availability')
      .select(`id, school_id, facility_id, day_of_week, start_time, end_time, max_group_capacity,
               facility:facilities(id, name, type, min_booking_advance_hours, min_cancellation_hours)`)
      .in('school_id', allSchoolIds);

    const coachIds = [...new Set((availData || []).map(a => a.coach_id))];
    const availIds = (availData || []).map(a => a.id);

    // Fetch attendance_sessions vinculadas a estos slots para:
    // (a) marcar el slot como ocupado si el coach tiene otra clase a esa hora
    // (b) obtener current_bookings POR FECHA (no acumulado entre semanas)
    const { data: existingSessions } = await supabase
      .from('attendance_sessions')
      .select('id, coach_id, facility_id, session_date, start_time, coach_availability_id, facility_availability_id, current_bookings, max_capacity')
      .in('school_id', allSchoolIds)
      .gte('session_date', today);

    const busySet = new Set(
      (existingSessions || [])
        .filter((s: any) => !s.coach_availability_id) // solo sesiones sin vínculo de disponibilidad bloquean
        .map((s: any) => `${s.coach_id}_${s.session_date}_${s.start_time.substring(0, 5)}`)
    );

    // Mapa: "availId_fecha" → { current_bookings, max_capacity }
    // Esto garantiza que cada ocurrencia semanal cuenta independientemente
    const sessionCapacityMap: Record<string, { current: number; max: number | null }> = {};
    (existingSessions || []).forEach((s: any) => {
      if (!s.coach_availability_id) return;
      const key = `${s.coach_availability_id}_${s.session_date}`;
      sessionCapacityMap[key] = {
        current: s.current_bookings ?? 0,
        max: s.max_capacity,
      };
    });

    // Mapa equivalente para instalaciones
    const facilityCapacityMap: Record<string, { current: number; max: number | null }> = {};
    (existingSessions || []).forEach((s: any) => {
      if (!s.facility_availability_id) return;
      const key = `${s.facility_availability_id}_${s.session_date}`;
      facilityCapacityMap[key] = {
        current: s.current_bookings ?? 0,
        max: s.max_capacity,
      };
    });

    // We bind the generated slots to the first offering plan they have.
    const defaultPlanEnrollment = planEnrollments.find(
      (e: any) => allSchoolIds.includes(e.school_id)
    ) ?? planEnrollments[0];
    const generatedSessions: any[] = [];

    if (defaultPlanEnrollment && availData) {
      const defaultOfferingId = (defaultPlanEnrollment.offering_plans as any)?.offering_id;
      const [year, month, day] = today.split('-').map(Number);
      const DAYS_AHEAD = 14;

      // Si hay coaches asignados al plan, usar solo esos; si no, todos
      const filteredAvailData = assignedCoachIds.length > 0
        ? availData.filter((a: any) => assignedCoachIds.includes(a.coach_id))
        : availData;

      for (let i = 0; i < DAYS_AHEAD; i++) {
        const d = new Date(Date.UTC(year, month - 1, day + i));
        const dateStr = d.toISOString().split('T')[0];
        const dbDay = d.getUTCDay();

        if (dateStr < today) continue;

        const slotsForDay = (filteredAvailData || []).filter(
          (a: any) => a.day_of_week === dbDay
        );

        for (const avail of slotsForDay) {
          const slotStart = avail.start_time.substring(0, 5); // "HH:MM"
          const slotMaxCapacity = (avail as any).max_group_capacity ?? (avail.available_for_personal_classes ? 1 : 10);
          
          // Buscar el enrollment que corresponde a la escuela de este slot de disponibilidad
          const matchingEnrollment = planEnrollments.find(e => e.school_id === (avail as any).school_id) || defaultPlanEnrollment;
          const offeringIdForSlot = getOfferingId(matchingEnrollment);

          // Bloquear si el coach tiene una sesión manual (sin coach_availability_id) a esa hora
          const busyKey = `${avail.coach_id}_${dateStr}_${slotStart}`;
          if (busySet.has(busyKey)) continue;

          // Capacidad por fecha específica (de la sesión ya creada para esa fecha)
          const capacityKey = `${avail.id}_${dateStr}`;
          const existing = sessionCapacityMap[capacityKey];
          const currentBookings = existing?.current ?? 0;
          const maxCapacity = existing?.max ?? slotMaxCapacity;
          const isFull = currentBookings >= maxCapacity;

          // Generar una entrada por cada tipo disponible (Personal / Grupal)
          if (avail.available_for_personal_classes) {
            generatedSessions.push({
              id: `avail_p_${avail.id}_${dateStr}`, // Prefijo p_ para personal
              session_type: 'offering',
              session_date: dateStr,
              start_time: `${slotStart}:00`,
              end_time: avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time,
              max_capacity: 1,
              current_bookings: currentBookings,
              available_spots: Math.max(0, 1 - currentBookings),
              already_booked: false,
              team: null,
              team_id: null,
              offering_id: offeringIdForSlot,
              coach: avail.coach,
              sessions_left: null,
              enrollment_id: matchingEnrollment.id,
              booking_status: currentBookings >= 1 ? 'full' : 'open',
              is_pseudo: true,
              available_for_personal_classes: true,
              available_for_group_classes: false,
            });
          }

          if (avail.available_for_group_classes) {
            generatedSessions.push({
              id: `avail_g_${avail.id}_${dateStr}`, // Prefijo g_ para grupal
              session_type: 'offering',
              session_date: dateStr,
              start_time: `${slotStart}:00`,
              end_time: avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time,
              max_capacity: maxCapacity,
              current_bookings: currentBookings,
              available_spots: Math.max(0, maxCapacity - currentBookings),
              already_booked: false,
              team: null,
              team_id: null,
              offering_id: offeringIdForSlot,
              coach: avail.coach,
              sessions_left: null,
              enrollment_id: matchingEnrollment.id,
              booking_status: isFull ? 'full' : 'open',
              is_pseudo: true,
              available_for_personal_classes: false,
              available_for_group_classes: true,
            });
          }
      }
    }
  }

    // ── Generación de pseudo-sesiones de INSTALACIÓN (agendamiento principal sin coach) ──
    // Regla clave: NO se filtra por offering. Cualquier plan activo con crédito
    // primario del atleta puede reservar. Siempre modo grupal (sin variante personal).
    const facilityGeneratedSessions: any[] = [];
    const nowMs = Date.now();

    if (facilityAvailData && facilityAvailData.length && planEnrollments.length) {
      const [year, month, day] = today.split('-').map(Number);
      const DAYS_AHEAD = 14;

      for (let i = 0; i < DAYS_AHEAD; i++) {
        const d = new Date(Date.UTC(year, month - 1, day + i));
        const dateStr = d.toISOString().split('T')[0];
        const dbDay = d.getUTCDay();
        if (dateStr < today) continue;

        const slotsForDay = facilityAvailData.filter((a: any) => a.day_of_week === dbDay);

        for (const avail of slotsForDay) {
          const facility = (avail as any).facility;
          if (!facility) continue;

          // Ventana de anticipación mínima de la instalación
          const slotStart = avail.start_time.substring(0, 5);
          const slotMs = new Date(`${dateStr}T${avail.start_time.substring(0, 8)}-05:00`).getTime();
          const advanceMs = (facility.min_booking_advance_hours ?? 0) * 60 * 60 * 1000;
          if (slotMs - nowMs < advanceMs) continue;

          // Elegir el mejor enrollment del atleta para esta escuela con crédito disponible
          const candidateEnrollments = planEnrollments.filter((e: any) => e.school_id === avail.school_id);
          if (!candidateEnrollments.length) continue;

          let bestEnrollment: any = null;
          let bestSessLeft: number | null = null;
          for (const e of candidateEnrollments) {
            const plan = (e as any).offering_plans;
            const maxSess = plan?.max_sessions ?? null;
            const used = e.sessions_used ?? 0;
            const sessLeft = maxSess !== null ? Math.max(0, maxSess - used) : null; // null = ilimitado
            const hasCredit = sessLeft === null || sessLeft > 0;
            if (hasCredit && (bestEnrollment === null || (sessLeft ?? Infinity) > (bestSessLeft ?? -1))) {
              bestEnrollment = e; bestSessLeft = sessLeft;
            }
          }
          // Si ninguno tiene crédito, igual mostramos el slot con no_credits usando el primero
          const chosenEnrollment = bestEnrollment ?? candidateEnrollments[0];
          const chosenPlan = (chosenEnrollment as any).offering_plans;
          const chosenMaxSess = chosenPlan?.max_sessions ?? null;
          const chosenUsed = chosenEnrollment.sessions_used ?? 0;
          const chosenSessLeft = chosenMaxSess !== null ? Math.max(0, chosenMaxSess - chosenUsed) : null;
          const noCredits = chosenSessLeft !== null && chosenSessLeft <= 0;

          const capacityKey = `${avail.id}_${dateStr}`;
          const existingCap = facilityCapacityMap[capacityKey];
          const currentBookings = existingCap?.current ?? 0;
          const maxCapacity = existingCap?.max ?? avail.max_group_capacity ?? 10;
          const isFull = currentBookings >= maxCapacity;

          facilityGeneratedSessions.push({
            id: `favail_${avail.id}_${dateStr}`,
            session_type: 'facility',
            session_date: dateStr,
            start_time: `${slotStart}:00`,
            end_time: avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time,
            max_capacity: maxCapacity,
            current_bookings: currentBookings,
            available_spots: Math.max(0, maxCapacity - currentBookings),
            already_booked: false, // se resuelve mas abajo igual que el resto
            team: null, team_id: null, offering_id: null,
            facility: { id: facility.id, name: facility.name, type: facility.type },
            coach: null,
            sessions_left: chosenSessLeft,
            enrollment_id: chosenEnrollment.id,
            booking_status: isFull ? 'full' : noCredits ? 'no_credits' : 'open',
            is_pseudo: true,
            min_cancellation_hours: facility.min_cancellation_hours ?? 0,
            available_for_personal_classes: false,
            available_for_group_classes: true,
          });
        }
      }
    }

    const availMap = Object.fromEntries((availData || []).map(a => [a.id, a]));

    const enrichRealSession = (s: any) => {
      const avail = s.coach_availability_id ? availMap[s.coach_availability_id] : null;
      return {
        ...s,
        available_for_personal_classes: avail ? avail.available_for_personal_classes : false,
        available_for_group_classes: avail ? avail.available_for_group_classes : (s.max_capacity > 1),
      };
    };

    const teamSessions = (tRes.data || []).map((s: any) => enrichRealSession({ ...s, session_type: 'team' as const }));
    const offeringSessions = (oRes.data || []).map((s: any) => enrichRealSession({ ...s, session_type: 'offering' as const }));

    // Deduplicar: las sesiones REALES tienen prioridad sobre las pseudo-sesiones.
    // Si un coach ya aparece en teamSessions/offeringSessions a la misma hora+fecha,
    // la pseudo-sesión de coach_availability se descarta.
    const realSlotKeys = new Set<string>();
    [...teamSessions, ...offeringSessions].forEach((s: any) => {
      const coachId = s.coach?.id ?? s.coach_id ?? '';
      realSlotKeys.add(`${coachId}_${s.session_date}_${s.start_time.substring(0, 5)}`);
    });

    // También deduplicar entre pseudo-sesiones por coach+fecha+hora+tipo (quedar con la de mayor cupo para el mismo tipo)
    const dedupedGenerated: any[] = [];
    const seenPseudoKey = new Set<string>();
    generatedSessions.sort((a, b) => (b.max_capacity ?? 0) - (a.max_capacity ?? 0));
    for (const gs of generatedSessions) {
      const coachId = gs.coach?.id ?? '';
      const typeStr = gs.id.startsWith('avail_p_') ? 'p' : 'g';
      const key = `${coachId}_${gs.session_date}_${gs.start_time.substring(0, 5)}_${typeStr}`;
      
      const generalSlotKey = `${coachId}_${gs.session_date}_${gs.start_time.substring(0, 5)}`;
      
      if (!realSlotKeys.has(generalSlotKey) && !seenPseudoKey.has(key)) {
        seenPseudoKey.add(key);
        dedupedGenerated.push(gs);
      }
    }

    const baseSessions = [...teamSessions, ...offeringSessions, ...dedupedGenerated, ...facilityGeneratedSessions];
    const allSessions: any[] = [];

    baseSessions.forEach((s: any) => {
      // Si la sesión permite ambos y está vacía, la desdoblamos para que el usuario elija modalidad
      const isDual = s.available_for_personal_classes && s.available_for_group_classes;
      const isEmpty = (s.current_bookings ?? 0) === 0;

      if (s.session_type !== 'facility' && isDual && isEmpty) {
        // Opción Personal
        allSessions.push({
          ...s,
          id: `${s.id}_p`,
          max_capacity: 1,
          available_for_personal_classes: true,
          available_for_group_classes: false,
        });
        // Opción Grupal
        allSessions.push({
          ...s,
          id: `${s.id}_g`,
          max_capacity: s.max_capacity,
          available_for_personal_classes: false,
          available_for_group_classes: true,
        });
      } else {
        allSessions.push(s);
      }
    });

    // Ordenar por fecha y hora
    allSessions.sort((a, b) => {
      const dateCmp = a.session_date.localeCompare(b.session_date);
      if (dateCmp !== 0) return dateCmp;
      return a.start_time.localeCompare(b.start_time);
    });

    if (!allSessions.length) return res.json({ sessions: [] });

    // ── Bookings del atleta para marcar already_booked ────────────────────
    // IMPORTANTE: limpiar IDs de desdoblamiento (_p, _g) para consultar DB
    const sIds = allSessions
      .filter(s => !s.is_pseudo)
      .map(s => s.id.includes('_p') || s.id.includes('_g') ? s.id.slice(0, -2) : s.id);

    let bQ = supabase.from('session_bookings')
      .select('session_id')
      .in('session_id', sIds.length ? sIds : ['00000000-0000-0000-0000-000000000000'])
      .neq('status', 'cancelled');
    if (child_id) bQ = bQ.eq('child_id', child_id);
    else bQ = bQ.eq('user_id', userId);

    const { data: booked } = await bQ;
    const bookedSet = new Set((booked || []).map(b => b.session_id));

    // ── Mapear manteniendo teams y offerings separados ────────────────────
    const sessions = allSessions.map((s: any) => {
      const availableSpots = Math.max(0, s.max_capacity - s.current_bookings);
      const cleanIdForBooked = s.id.includes('_p') || s.id.includes('_g') ? s.id.slice(0, -2) : s.id;
      const alreadyBooked = bookedSet.has(cleanIdForBooked);
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

      if (s.session_type === 'facility') {
        return {
          id: s.id,
          session_type: 'facility',
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          max_capacity: s.max_capacity,
          current_bookings: s.current_bookings,
          available_spots: availableSpots,
          already_booked: alreadyBooked,
          team: null, team_id: null, offering_id: null,
          facility: s.facility ?? null,
          coach: null,
          sessions_left: s.sessions_left,
          enrollment_id: s.enrollment_id,
          booking_status: alreadyBooked ? 'already_booked' : isFull ? 'full' : s.booking_status,
          min_cancellation_hours: s.min_cancellation_hours ?? 0,
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
        available_for_personal_classes: (s as any).available_for_personal_classes ?? null,
        available_for_group_classes: (s as any).available_for_group_classes ?? null,
      };
    });

    res.json({ sessions });
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
    let actualSessionId = session_id;
    let s: any = null;

    if (session_id.startsWith('favail_')) {
      // Formato: favail_{availId}_{YYYY-MM-DD}
      const dateStr = session_id.slice(-10);
      const availId = session_id.slice('favail_'.length, -11);

      if (!availId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return res.status(400).json({ error: 'invalid_favail_format' });

      const { data: avail } = await supabase
        .from('facility_availability')
        .select('facility_id, start_time, end_time, max_group_capacity, facility:facilities(min_booking_advance_hours)')
        .eq('id', availId)
        .single();

      if (!avail) return res.status(404).json({ error: 'facility_avail_not_found' });

      // Revalidar ventana de anticipación en servidor (nunca confiar en el cliente)
      const advanceHours = (avail as any).facility?.min_booking_advance_hours ?? 0;
      const slotMs = new Date(`${dateStr}T${avail.start_time.substring(0, 8)}-05:00`).getTime();
      const hoursUntil = (slotMs - Date.now()) / 3_600_000;
      if (hoursUntil < advanceHours) {
        return res.status(400).json({
          error: `Este horario requiere al menos ${advanceHours}h de anticipación para reservarse.`,
          reason: 'outside_booking_advance_window',
        });
      }

      const start_time = avail.start_time.length === 5 ? `${avail.start_time}:00` : avail.start_time;
      const end_time = avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time;

      const { data: existS } = await supabase
        .from('attendance_sessions')
        .select('id, school_id, max_capacity, current_bookings')
        .eq('facility_availability_id', availId)
        .eq('session_date', dateStr)
        .maybeSingle();

      if (existS) {
        s = existS;
        actualSessionId = s.id;
      } else {
        const { data: newS, error: newErr } = await supabase.from('attendance_sessions')
          .insert({
            school_id: enrollmentSchoolId,
            facility_id: avail.facility_id,
            facility_availability_id: availId,
            coach_id: null,
            offering_id: null, // clave: instalacion no pertenece a un solo plan
            session_date: dateStr,
            start_time, end_time,
            max_capacity: avail.max_group_capacity ?? 10,
            current_bookings: 0,
            is_bookable: true,
            finalized: false,
          }).select('id, school_id, max_capacity, current_bookings').single();

        if (newErr && newErr.code === '23505') {
          const { data: retryS, error: retryErr } = await supabase
            .from('attendance_sessions')
            .select('id, school_id, max_capacity, current_bookings')
            .eq('facility_availability_id', availId)
            .eq('session_date', dateStr)
            .single();
          if (retryErr || !retryS) return res.status(500).json({ error: 'No se pudo resolver el bloque.' });
          s = retryS;
        } else if (newErr) {
          return res.status(500).json({ error: 'failed_creating_session' });
        } else {
          s = newS;
        }
        actualSessionId = s.id;
      }
    } else if (session_id.startsWith('avail_')) {
      // Formato: avail_p_{availId}_{YYYY-MM-DD} o avail_g_{availId}_{YYYY-MM-DD}
      const isPersonal = session_id.includes('_p_');
      const isGroup = session_id.includes('_g_');
      const prefixLen = isPersonal ? 'avail_p_'.length : (isGroup ? 'avail_g_'.length : 'avail_'.length);

      const dateStr = session_id.slice(-10);          // últimos 10: "YYYY-MM-DD"
      const availId = session_id.slice(prefixLen, -11); // entre el prefijo y "_YYYY-MM-DD"

      if (!availId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return res.status(400).json({ error: 'invalid_avail_format' });

      // Obtener detalles del slot de disponibilidad
      const { data: avail } = await supabase
        .from('coach_availability')
        .select('coach_id, start_time, end_time, available_for_group_classes, available_for_personal_classes, max_group_capacity')
        .eq('id', availId)
        .single();

      if (!avail) return res.status(404).json({ error: 'avail_not_found' });

      const coach_id = avail.coach_id;
      const start_time = avail.start_time.length === 5 ? `${avail.start_time}:00` : avail.start_time;
      const end_time = avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time;
      const maxCap = isPersonal ? 1 : (avail.max_group_capacity ?? 10);

      // Buscar si ya existe una attendance_session para esta fecha exacta vinculada a este slot
      const { data: existS } = await supabase
        .from('attendance_sessions')
        .select('id, school_id, max_capacity, current_bookings')
        .eq('coach_availability_id', availId)
        .eq('session_date', dateStr)
        .maybeSingle();

      if (existS) {
        s = existS;
        actualSessionId = s.id;
      } else {
        const { data: eData } = await supabase.from('enrollments')
          .select('offering_plans(offering_id)')
          .eq('id', enrollment_id)
          .single();

        const offering_id = eData?.offering_plans
          ? (eData.offering_plans as any).offering_id
          : null;

        const { data: newS, error: newErr } = await supabase.from('attendance_sessions')
          .insert({
            school_id: enrollmentSchoolId,
            coach_id,
            session_date: dateStr,
            start_time,
            end_time,
            offering_id,
            max_capacity: maxCap,
            current_bookings: 0,
            is_bookable: true,
            finalized: false,
            coach_availability_id: availId,   // ← vínculo clave para conteo por fecha
          }).select('id, school_id, max_capacity, current_bookings').single();

        if (newErr && newErr.code === '23505') {
          const { data: retryS, error: retryErr } = await supabase
            .from('attendance_sessions')
            .select('id, school_id, max_capacity, current_bookings')
            .eq('coach_availability_id', availId)
            .eq('session_date', dateStr)
            .single();
          if (retryErr || !retryS) return res.status(500).json({ error: 'No se pudo resolver el bloque.' });
          s = retryS;
        } else if (newErr) {
          return res.status(500).json({ error: 'failed_creating_session' });
        } else {
          s = newS;
        }
        actualSessionId = s.id;
      }
    } else {
      // Manejar IDs con sufijo _p o _g para sesiones reales (desdoblamiento universal)
      const isPersonal = session_id.endsWith('_p');
      const isGroup = session_id.endsWith('_g');
      const cleanSessionId = (isPersonal || isGroup) ? session_id.slice(0, -2) : session_id;
      actualSessionId = cleanSessionId;

      const { data: fetchS } = await supabase
        .from('attendance_sessions')
        .select('school_id, max_capacity, current_bookings')
        .eq('id', cleanSessionId)
        .single();
      s = fetchS;

      // VALIDACIÓN de exclusividad sin modificar DB:
      if (isPersonal) {
        // Personal solo puede reservar si nadie más ha reservado ese slot
        const { count: existingCount } = await supabase
          .from('session_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', actualSessionId)
          .neq('status', 'cancelled');

        if ((existingCount ?? 0) > 0) {
          return res.status(409).json({
            error: 'Este horario ya tiene una reserva. No puede agendarse como clase personal.',
            reason: 'capacity_full',
          });
        }
      }
    }

    if (!s) return res.status(404).json({ error: 'not_found' });

    // Validar cupo con conteo real de session_bookings (fuente de verdad)
    // Evita falsos "llena" cuando current_bookings se desincroniza por cancel+re-book
    if (s.max_capacity !== null && s.max_capacity !== undefined) {
      const { count: activeCount } = await supabase
        .from('session_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', actualSessionId)
        .neq('status', 'cancelled');

      if ((activeCount ?? 0) >= s.max_capacity) {
        return res.status(409).json({
          error: 'Esta clase ya alcanzó su cupo máximo.',
          reason: 'capacity_full',
          capacity: s.max_capacity,
          current: activeCount,
        });
      }
    }

    // ── 3b. Verificar que el atleta no tenga ya una reserva activa ────────
    {
      let dupQ = supabase
        .from('session_bookings')
        .select('id, status')
        .eq('session_id', actualSessionId)
        .neq('status', 'cancelled');
      if (child_id) dupQ = dupQ.eq('child_id', child_id);
      else dupQ = dupQ.eq('user_id', userId);

      const { data: existingBooking } = await dupQ.maybeSingle();
      if (existingBooking) {
        return res.status(409).json({
          error: 'Ya tienes una reserva activa para esta clase.',
          reason: 'already_booked',
          booking_id: existingBooking.id,
        });
      }
    }

    // ── 4. Insertar booking ───────────────────────────────────────────────
    const { data: b, error } = await supabase.from('session_bookings').insert({
      school_id: s.school_id,
      session_id: actualSessionId,
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/athlete/my-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // Resolver todas las escuelas activas del atleta
    let schoolEnrQ = supabase.from('enrollments').select('school_id').eq('status', 'active');
    if (child_id) schoolEnrQ = schoolEnrQ.eq('child_id', child_id as string);
    else schoolEnrQ = schoolEnrQ.eq('user_id', userId);
    const { data: schoolEnrs } = await schoolEnrQ;
    const athleteSchoolIds = [...new Set((schoolEnrs || []).map((e: any) => e.school_id).filter(Boolean))];
    const schoolFilter = athleteSchoolIds.length ? athleteSchoolIds : [req.schoolId];

    // ── 1. Fetch de regular bookings (session_bookings) ────────────────────
    let q = supabase.from('session_bookings').select(`
      id, status, booked_at, is_secondary, enrollment_id,
      attendance_sessions(
        id, session_date, start_time, end_time, finalized,
        coach:school_staff!attendance_sessions_coach_id_fkey(id, full_name)
      )
    `)
      .in('school_id', schoolFilter)
      .neq('status', 'cancelled')
      .order('booked_at', { ascending: false });

    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data: bookingsReq } = await q;
    const bookings = bookingsReq || [];

    // ── 2. Fetch de PT bookings (trainer_session_plans) ───────────────────
    // Obtener enrollment IDs activos del atleta
    let enrQ = supabase.from('enrollments').select('id').eq('status', 'active');
    if (child_id) enrQ = enrQ.eq('child_id', child_id);
    else enrQ = enrQ.eq('user_id', userId);
    const { data: activeEnrs } = await enrQ;
    const activeEnrIds = (activeEnrs || []).map(e => e.id);

    // PT sessions solo de enrollments activos
    let ptQ = supabase.from('trainer_session_plans').select(`
      id, status, booked_at, enrollment_id, trainer_id,
      session_date, session_time, name
    `)
      .in('enrollment_id', activeEnrIds.length ? activeEnrIds : ['00000000-0000-0000-0000-000000000000'])
      .neq('status', 'cancelled')
      .order('booked_at', { ascending: false });
    
    if (child_id) ptQ = ptQ.eq('client_id', child_id);
    else ptQ = ptQ.eq('client_id', userId);

    const { data: ptSessionsReq } = await ptQ;
    const ptSessions = ptSessionsReq || [];

    // ── 3. Resolver enrollments, contexto y perfiles de trainer ────────────
    const enrollmentIds = [...new Set([
      ...bookings.map(b => b.enrollment_id),
      ...ptSessions.map(s => s.enrollment_id)
    ].filter(Boolean))];

    const trainerIds = [...new Set(ptSessions.map(s => s.trainer_id).filter(Boolean))];

    const [enrollmentsRes, trainersRes] = await Promise.all([
      enrollmentIds.length 
        ? supabase.from('enrollments').select('id, team_id, offering_plan_id, school_id').in('id', enrollmentIds)
        : Promise.resolve({ data: [] }),
      trainerIds.length
        ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', trainerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const enrollments = enrollmentsRes.data || [];
    const trainers    = trainersRes.data || [];

    const enrollmentMap = Object.fromEntries(enrollments.map(e => [e.id, e]));
    const trainerMap    = Object.fromEntries(trainers.map(t => [t.id, t]));

    const teamIds   = [...new Set(enrollments.map(e => e.team_id).filter(Boolean))];
    const planIds   = [...new Set(enrollments.map(e => e.offering_plan_id).filter(Boolean))];
    const schoolIds = [...new Set(enrollments.map(e => e.school_id).filter(Boolean))];

    const [teamsRes, plansRes, schoolsRes] = await Promise.all([
      teamIds.length   ? supabase.from('teams').select('id, name').in('id', teamIds) : Promise.resolve({ data: [] }),
      planIds.length   ? supabase.from('offering_plans').select('id, name').in('id', planIds) : Promise.resolve({ data: [] }),
      schoolIds.length ? supabase.from('schools').select('id, name, city, school_type').in('id', schoolIds) : Promise.resolve({ data: [] }),
    ]);

    const teamMap   = Object.fromEntries((teamsRes.data || []).map(t => [t.id, t]));
    const planMap   = Object.fromEntries((plansRes.data || []).map(p => [p.id, p]));
    const schoolMap = Object.fromEntries((schoolsRes.data || []).map(s => [s.id, s]));

    // ── 4. Mapear respuesta unificada ──────────────────────────────────────
    const mappedRegular = bookings.map((b: any) => {
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
        school_type: enrollment?.school_id ? (schoolMap[enrollment.school_id]?.school_type || 'academy') : 'academy',
        enrollments: isTeamBooking
          ? { teams: teamMap[enrollment.team_id] ?? null, offering_plans: null }
          : { teams: null, offering_plans: planMap[enrollment?.offering_plan_id] ?? null },
      };
    });

    const mappedPT = ptSessions.map((s: any) => {
      const enrollment = enrollmentMap[s.enrollment_id] ?? null;
      const trainer    = trainerMap[s.trainer_id] ?? null;
      return {
        id: s.id,
        status: s.status === 'assigned' ? 'confirmed' : s.status,
        booked_at: s.booked_at,
        is_secondary: false,
        booking_type: 'pt_session',
        enrollment_id: s.enrollment_id,
        session_type: s.session_type || 'personal',
        attendance_sessions: {
          id: s.id,
          session_date: s.session_date,
          start_time: s.session_time,
          end_time: s.session_time, // Placeholder
          finalized: s.status === 'completed',
          coach: trainer ? { id: trainer.id, full_name: trainer.full_name } : null
        },
        school_type: enrollment?.school_id ? (schoolMap[enrollment.school_id]?.school_type || 'academy') : 'academy',
        enrollments: {
          teams: null,
          offering_plans: planMap[enrollment?.offering_plan_id] ?? (s.name ? { name: s.name } : null)
        },
      };
    });

    const result = [...mappedRegular, ...mappedPT].sort((a, b) => 
      new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()
    );

    res.json(result);
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


// ── Static route BEFORE dynamic /athlete/:id/cancel ─────────────────────────
router.delete('/athlete/cancel-booking', requireAuth, async (req: Request, res: Response) => {
  try {
    const { booking_id, child_id } = req.query as { booking_id: string; child_id?: string };

    // ── 1. Intentar en session_bookings (Regular/Grupales) ────────────────
    const { data: booking } = await supabase
      .from('session_bookings')
      .select(`id, status, user_id, child_id, enrollment_id, is_secondary,
        attendance_sessions ( session_date, start_time, facility_id, facilities ( min_cancellation_hours ) )`)
      .eq('id', booking_id)
      .maybeSingle();

    if (booking) {
      const isOwner = booking.user_id === req.user?.id;
      const isChild = child_id && booking.child_id === child_id;

      if (!isOwner && !isChild) return res.status(403).json({ error: 'unauthorized' });
      if (booking.status === 'cancelled') return res.status(400).json({ error: 'Ya cancelada' });
      if (booking.status !== 'confirmed') {
        return res.status(400).json({
          error: 'Esta clase ya fue registrada y no se puede cancelar.',
          reason: 'not_cancellable',
        });
      }

      const sessInfo: any = Array.isArray((booking as any).attendance_sessions)
        ? (booking as any).attendance_sessions[0]
        : (booking as any).attendance_sessions;
      if (sessInfo?.facility_id) {
        const cancelHours = sessInfo.facilities?.min_cancellation_hours ?? 0;
        if (cancelHours > 0 && sessInfo.session_date && sessInfo.start_time) {
          const sessionCO = new Date(`${sessInfo.session_date}T${sessInfo.start_time.substring(0, 8)}`);
          const sessionUTC = new Date(sessionCO.getTime() + 5 * 60 * 60 * 1000);
          const hoursUntil = (sessionUTC.getTime() - Date.now()) / 3_600_000;
          if (hoursUntil < cancelHours) {
            return res.status(400).json({
              error: `Faltan menos de ${cancelHours}h para tu reserva. No se puede cancelar.`,
              reason: 'outside_cancellation_window',
            });
          }
        }
      }

      const { error: updateError } = await supabase
        .from('session_bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_reason: 'Cancelado por el atleta' })
        .eq('id', booking_id);

      if (updateError) throw updateError;

      // Reembolso de crédito
      const f = booking.is_secondary ? 'secondary_sessions_used' : 'sessions_used';
      const { data: enr } = await supabase.from('enrollments').select(f).eq('id', booking.enrollment_id).single();
      if (enr) {
        await supabase.from('enrollments')
          .update({ [f]: Math.max(0, ((enr as any)[f] || 0) - 1) })
          .eq('id', booking.enrollment_id);
      }

      return res.json({ success: true });
    }

    // ── 2. Intentar en trainer_session_plans (PT) ─────────────────────────
    const { data: ptBooking } = await supabase
      .from('trainer_session_plans')
      .select('id, status, client_id')
      .eq('id', booking_id)
      .maybeSingle();

    if (ptBooking) {
      // Validar acceso (client_id es o el usuario o el hijo)
      const isMyPT = ptBooking.client_id === req.user?.id;
      let isMyChildPT = false;
      if (!isMyPT && child_id) {
        const { data: c } = await supabase.from('children').select('id').eq('id', ptBooking.client_id).eq('parent_id', req.user?.id).maybeSingle();
        isMyChildPT = !!c;
      }

      if (!isMyPT && !isMyChildPT) return res.status(403).json({ error: 'unauthorized' });
      if (ptBooking.status === 'cancelled') return res.status(400).json({ error: 'Ya cancelada' });

      // Usar el RPC para cancelar (maneja créditos)
      const { data: cancelRes, error: cancelError } = await supabase.rpc('fn_cancel_pt_session', {
        p_plan_id: booking_id,
        p_caller_id: req.user?.id
      });

      if (cancelError) throw cancelError;
      if (!cancelRes?.success) return res.status(400).json({ error: cancelRes?.error || 'No se pudo cancelar' });

      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Reserva no encontrada' });

    res.json({ success: true });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
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
      .select(`id, user_id, child_id, session_id, enrollment_id, is_secondary, status,
        attendance_sessions ( session_date, start_time, facility_id, facilities ( min_cancellation_hours ) )`)
      .eq('id', id)
      .maybeSingle();

    if (!b) return res.status(404).json({ error: 'not_found' });
    if (b.status === 'cancelled') return res.status(400).json({ error: 'already_cancelled' });
    if (b.status !== 'confirmed') {
      // 'attended' / 'no_show' -> la sesion ya paso, no se puede cancelar ni devolver credito
      return res.status(400).json({
        error: 'Esta clase ya fue registrada y no se puede cancelar.',
        reason: 'not_cancellable',
      });
    }

    // Ventana de cancelación de la instalación (bloqueo duro — sin excepción,
    // a diferencia del PT donde el entrenador decide si faltan menos de 4h)
    const sessInfo: any = Array.isArray((b as any).attendance_sessions)
      ? (b as any).attendance_sessions[0]
      : (b as any).attendance_sessions;
    if (sessInfo?.facility_id) {
      const cancelHours = sessInfo.facilities?.min_cancellation_hours ?? 0;
      if (cancelHours > 0 && sessInfo.session_date && sessInfo.start_time) {
        const sessionCO = new Date(`${sessInfo.session_date}T${sessInfo.start_time.substring(0, 8)}`);
        const sessionUTC = new Date(sessionCO.getTime() + 5 * 60 * 60 * 1000);
        const hoursUntil = (sessionUTC.getTime() - Date.now()) / 3_600_000;
        if (hoursUntil < cancelHours) {
          return res.status(400).json({
            error: `Faltan menos de ${cancelHours}h para tu reserva. No se puede cancelar para no quitarle el cupo a otra persona.`,
            reason: 'outside_cancellation_window',
          });
        }
      }
    }

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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/athlete/upcoming', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // Resolver todas las escuelas e inscripciones activas del atleta
    let schoolEnrQ = supabase.from('enrollments').select('id, school_id').eq('status', 'active');
    if (child_id) schoolEnrQ = schoolEnrQ.eq('child_id', child_id as string);
    else schoolEnrQ = schoolEnrQ.eq('user_id', userId);
    const { data: schoolEnrs } = await schoolEnrQ;
    const athleteSchoolIds = [...new Set((schoolEnrs || []).map((e: any) => e.school_id).filter(Boolean))];
    const activeEnrIds = (schoolEnrs || []).map(e => e.id);
    const schoolFilter = athleteSchoolIds.length ? athleteSchoolIds : [req.schoolId];

    const today = todayInBogota();

    // ── 1. Fetch de regular bookings futuros ───────────────────────────────
    let q = supabase.from('session_bookings').select(`
      id,
      attendance_sessions!inner(
        id, session_date, start_time, end_time,
        team:teams!attendance_sessions_team_id_fkey(name, school_id),
        coach:school_staff!attendance_sessions_coach_id_fkey(full_name)
      )
    `)
      .in('school_id', schoolFilter)
      .neq('status', 'cancelled')
      .gte('attendance_sessions.session_date', today)
      .order('session_date', { ascending: true, referencedTable: 'attendance_sessions' })
      .limit(10);

    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data: regularData } = await q;

    // ── 2. Fetch de PT bookings futuros ───────────────────────────────────
    let ptQ = supabase.from('trainer_session_plans').select(`
      id, session_date, session_time, status, name, trainer_id
    `)
      .in('enrollment_id', activeEnrIds.length ? activeEnrIds : ['00000000-0000-0000-0000-000000000000'])
      .neq('status', 'cancelled')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(10);

    if (child_id) ptQ = ptQ.eq('client_id', child_id);
    else ptQ = ptQ.eq('client_id', userId);

    const { data: ptData } = await ptQ;

    // ── 3. Unificar y Enriquecer ──────────────────────────────────────────
    const trainerIds = [...new Set((ptData || []).map(s => s.trainer_id).filter(Boolean))];
    const { data: trainers } = trainerIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', trainerIds)
      : { data: [] };
    const trainerMap = Object.fromEntries((trainers || []).map(t => [t.id, t]));

    const rawSessions = (regularData || []).map((d: any) => ({
      ...d.attendance_sessions,
      _type: 'regular'
    }));

    const ptSessions = (ptData || []).map((s: any) => {
      const trainer = trainerMap[s.trainer_id];
      return {
        id: s.id,
        session_date: s.session_date,
        start_time: s.session_time,
        end_time: s.session_time,
        team: { 
          name: s.name || 'Sesión PT', 
          school_id: null
        },
        coach: trainer ? { full_name: trainer.full_name } : null,
        _type: 'pt'
      };
    });

    const combined = [...rawSessions, ...ptSessions];

    if (!combined.length) return res.json({ sessions: [] });

    // Resolver tipos de escuela
    const schoolIds = [...new Set(combined.map((s: any) => s.team?.school_id).filter(Boolean))];
    const { data: schools } = await supabase
      .from('schools')
      .select('id, school_type')
      .in('id', schoolIds);
    
    const schoolMap = Object.fromEntries((schools || []).map(s => [s.id, s]));

    const enriched = combined.map((s: any) => ({
      ...s,
      school_type: s.team?.school_id ? (schoolMap[s.team.school_id]?.school_type || 'academy') : 'academy'
    })).sort((a, b) => {
      const dateA = a.session_date + 'T' + a.start_time;
      const dateB = b.session_date + 'T' + b.start_time;
      return dateA.localeCompare(dateB);
    }).slice(0, 5);

    res.json({ sessions: enriched });
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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

    if (error) {
      // Trigger fn_check_facility_reservation_overlap (DB) rechaza choques de horario
      if (error.message?.includes('facility_slot_conflict')) {
        return res.status(409).json({
          error: 'Ese horario ya fue reservado por otra persona. Elige otro horario.',
          reason: 'facility_slot_conflict',
        });
      }
      throw error;
    }

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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/athlete/secondary-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { child_id } = req.query;
    if (child_id && !(await validateChildAccess(child_id as string, userId)))
      return res.status(403).json({ error: 'unauthorized' });

    // Resolver todas las escuelas activas del atleta
    let schoolEnrQ = supabase.from('enrollments').select('school_id').eq('status', 'active');
    if (child_id) schoolEnrQ = schoolEnrQ.eq('child_id', child_id as string);
    else schoolEnrQ = schoolEnrQ.eq('user_id', userId);
    const { data: schoolEnrs } = await schoolEnrQ;
    const athleteSchoolIds = [...new Set((schoolEnrs || []).map((e: any) => e.school_id).filter(Boolean))];
    const schoolFilter = athleteSchoolIds.length ? athleteSchoolIds : [req.schoolId];

    let q = supabase.from('facility_reservations')
      .select('id, status, reservation_date, start_time, end_time, enrollment_id, facilities(name, id)')
      .in('school_id', schoolFilter)
      .eq('resv_type', 'secondary_class')
      .neq('status', 'cancelled')
      .order('reservation_date', { ascending: false });

    if (child_id) q = q.eq('child_id', child_id);
    else q = q.eq('user_id', userId);

    const { data } = await q;
    if (!data?.length) return res.json([]);

    const enrollmentIds = [...new Set(data.map((r: any) => r.enrollment_id).filter(Boolean))];
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, school_id')
      .in('id', enrollmentIds);

    const enrMap = Object.fromEntries((enrollments || []).map(e => [e.id, e]));
    const schoolIds = [...new Set((enrollments || []).map(e => e.school_id).filter(Boolean))];

    const { data: schools } = await supabase
      .from('schools')
      .select('id, school_type')
      .in('id', schoolIds);

    const schoolMap = Object.fromEntries((schools || []).map(s => [s.id, s]));

    const enriched = data.map((r: any) => {
      const enr = enrMap[r.enrollment_id];
      const schoolType = enr?.school_id ? (schoolMap[enr.school_id]?.school_type || 'academy') : 'academy';
      return { ...r, school_type: schoolType };
    });

    res.json(enriched);
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
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
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/generate-offering-sessions', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { offering_id, weeks } = req.body;
    const { data, error } = await supabase.rpc('fn_generate_offering_sessions', {
      p_school_id: req.schoolId, p_offering_id: offering_id, p_weeks: weeks || 2,
    });
    if (error) throw error;
    res.json({ message: 'success', sessions: data });
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/extend-horizon', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.rpc('fn_extend_session_horizon', {
      p_school_id: req.schoolId, p_min_weeks: 2, p_target_weeks: 4,
    });
    if (error) throw error;
    res.json({ sessions_created: data });
  } catch (err: any) {
    req.log?.error({ err }, 'session-bookings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Las rutas legacy de PT (GET /athlete/pt-availability, POST /athlete/book-pt-session, DELETE /athlete/cancel-pt-session) fueron eliminadas por ser código muerto. El frontend ahora llama a las rutas correspondientes en training.ts.

export default router;