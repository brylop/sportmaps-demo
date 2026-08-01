import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

function todayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Créditos de sesión — docs/plan-asistencia-y-creditos-de-sesion.md
//
// Regla de fondo: los créditos viven SIEMPRE en la inscripción que tiene
// `offering_plan_id`. El equipo solo pone al atleta en el roster, así que un
// entrenador asignado únicamente al equipo descuenta del plan del atleta sin
// tener vínculo con la oferta. Por eso el crédito se resuelve POR ATLETA y no
// por la fila que mandó la pantalla.
//
// Y registrar la asistencia NUNCA falla por falta de saldo: dejar constancia de
// que el atleta vino, y cobrarle el crédito, son dos cosas distintas.
// ─────────────────────────────────────────────────────────────────────────────

type AthleteRef = { childId?: string | null; userId?: string | null; unregisteredId?: string | null };

type CreditEnrollment = {
  id: string; sessions_used: number; max_sessions: number | null;
  secondary_sessions_used: number; max_secondary_sessions: number | null;
  expires_at: string | null; plan_name: string | null;
};

/** Reserva del día que la asistencia puede consumir en vez de descontar otra clase. */
type FreeBooking = {
  source: 'session_bookings' | 'facility_reservations';
  id: string;
  session_id: string | null;
  /** Hora del bloque, para poder decírselo al entrenador. */
  start_time: string | null;
};

type CreditOutcome =
  | 'deducted'            // se descontó una clase
  | 'covered_by_booking'  // ya tenía reserva ese día: no se descuenta
  | 'returned'            // corrección a ausente: crédito devuelto
  | 'booking_released'    // corrección a ausente sobre una reserva: vuelve a confirmed
  | 'no_plan'             // equipo puro: no maneja sesiones
  | 'no_credits'          // plan agotado — la asistencia igual quedó registrada
  | 'expired'             // plan vencido — idem
  | 'unchanged';

const PLAN_JOIN = 'offering_plans!enrollments_offering_plan_id_fkey(name, max_sessions, max_secondary_sessions)';

function athleteFilter(a: AthleteRef): Record<string, string> {
  if (a.childId) return { child_id: a.childId };
  if (a.userId)  return { user_id: a.userId };
  return { unregistered_athlete_id: a.unregisteredId as string };
}

function athleteKey(a: AthleteRef): string | null {
  return a.childId ?? a.userId ?? a.unregisteredId ?? null;
}

function toCreditEnrollment(row: any): CreditEnrollment {
  const plan = row?.offering_plans;
  return {
    id: row.id,
    sessions_used: row.sessions_used ?? 0,
    max_sessions: plan?.max_sessions ?? null,
    secondary_sessions_used: row.secondary_sessions_used ?? 0,
    max_secondary_sessions: plan?.max_secondary_sessions ?? null,
    expires_at: row.expires_at ?? null,
    plan_name: plan?.name ?? null,
  };
}

/**
 * Traduce la respuesta de `move_session_credit` al shape de CreditEnrollment. Se
 * usa con spread sobre el crédito ya conocido, así que solo pisa lo que el RPC
 * devolvió con valor — un `plan_name` nulo no debe borrar el que ya teníamos.
 */
function pickCreditFields(moved: any): Partial<CreditEnrollment> {
  const out: Partial<CreditEnrollment> = {
    sessions_used: moved?.sessions_used ?? 0,
    secondary_sessions_used: moved?.secondary_sessions_used ?? 0,
  };
  if (moved?.max_sessions !== undefined && moved?.max_sessions !== null) out.max_sessions = moved.max_sessions;
  if (moved?.max_secondary_sessions !== undefined && moved?.max_secondary_sessions !== null) out.max_secondary_sessions = moved.max_secondary_sessions;
  if (moved?.expires_at) out.expires_at = moved.expires_at;
  if (moved?.plan_name) out.plan_name = moved.plan_name;
  return out;
}

/** La inscripción con plan del atleta, o null si no maneja sesiones. */
async function findCreditEnrollment(schoolId: string, athlete: AthleteRef): Promise<CreditEnrollment | null> {
  const key = athleteKey(athlete);
  if (!key || !schoolId) return null;

  const { data } = await supabase
    .from('enrollments')
    .select(`id, sessions_used, secondary_sessions_used, expires_at, ${PLAN_JOIN}`)
    .eq('school_id', schoolId)
    .match(athleteFilter(athlete))
    .eq('status', 'active')
    .not('offering_plan_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1);

  const row = (data || [])[0];
  return row ? toCreditEnrollment(row) : null;
}

/**
 * Mueve el saldo. `delta` +1 consume, -1 devuelve. Pasa por el RPC porque el
 * read-modify-write desde acá hacía que dos reservas simultáneas consumieran un
 * solo crédito (el RPC toma SELECT … FOR UPDATE sobre la inscripción).
 */
async function moveCredit(enrollmentId: string, delta: 1 | -1, isSecondary: boolean): Promise<any> {
  const { data, error } = await supabase.rpc('move_session_credit', {
    p_enrollment_id: enrollmentId,
    p_delta: delta,
    p_is_secondary: isSecondary,
  });
  if (error) throw error;
  return data;
}

/**
 * Busca una reserva de HOY que la asistencia pueda consumir. Prioridad: la de
 * esta misma sesión; si no, la más temprana libre del día en la misma bolsa.
 * Sin esto, reservar a las 6pm y ser marcado presente en la sesión de las 4pm
 * descontaba dos clases por un solo entrenamiento.
 */
async function findFreeBookingOfDay(
  schoolId: string, athlete: AthleteRef, day: string,
  isSecondary: boolean, preferSessionId?: string | null,
): Promise<FreeBooking | null> {
  if (!schoolId || !athleteKey(athlete)) return null;

  const { data: bks } = await supabase
    .from('session_bookings')
    .select('id, session_id, attendance_sessions!inner(session_date, start_time)')
    .eq('school_id', schoolId)
    .match(athleteFilter(athlete))
    .eq('status', 'confirmed')
    .eq('is_secondary', isSecondary)
    .eq('attendance_sessions.session_date', day);

  const candidates: FreeBooking[] = (bks || []).map((b: any) => ({
    source: 'session_bookings' as const,
    id: b.id,
    session_id: b.session_id,
    start_time: b.attendance_sessions?.start_time ?? null,
  }));

  // Las reservas de instalación consumen la bolsa secundaria, nunca la principal.
  if (isSecondary && !athlete.unregisteredId) {
    const { data: res } = await supabase
      .from('facility_reservations')
      .select('id, start_time')
      .eq('school_id', schoolId)
      .match(athlete.childId ? { child_id: athlete.childId } : { user_id: athlete.userId as string })
      .eq('reservation_date', day)
      .eq('status', 'confirmed');

    for (const r of res || []) {
      candidates.push({ source: 'facility_reservations', id: (r as any).id, session_id: null, start_time: (r as any).start_time ?? null });
    }
  }

  if (!candidates.length) return null;

  const exact = preferSessionId ? candidates.find(c => c.session_id === preferSessionId) : null;
  if (exact) return exact;

  return candidates.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))[0];
}

/**
 * Marca la reserva como usada. Es el candado que impide que la reserva de la
 * mañana absorba también la asistencia de la tarde: una reserva se consume una
 * sola vez.
 *
 * `facility_reservations` no se toca — su `status` es un enum/text con valores
 * propios y no admite 'attended'. Ahí el emparejamiento vale como guard pero sin
 * candado; el riesgo es acotado porque el slot de instalación es exclusivo
 * (`facility_reservations_unique_active_slot`), o sea una reserva por bloque.
 */
async function consumeBooking(booking: FreeBooking): Promise<void> {
  if (booking.source !== 'session_bookings') return;
  await supabase.from('session_bookings')
    .update({ status: 'attended', updated_at: new Date().toISOString() })
    .eq('id', booking.id);
}

/** Devuelve a 'confirmed' la reserva que esta asistencia había consumido. */
async function releaseConsumedBooking(
  schoolId: string, athlete: AthleteRef, day: string, isSecondary: boolean, sessionId?: string | null,
): Promise<boolean> {
  if (!schoolId || !athleteKey(athlete)) return false;

  let q = supabase
    .from('session_bookings')
    .select('id, session_id, attendance_sessions!inner(session_date)')
    .eq('school_id', schoolId)
    .match(athleteFilter(athlete))
    .eq('status', 'attended')
    .eq('is_secondary', isSecondary)
    .eq('attendance_sessions.session_date', day);

  if (sessionId) q = q.eq('session_id', sessionId);

  const { data } = await q.limit(1);
  const row = (data || [])[0];
  if (!row) return false;

  await supabase.from('session_bookings')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', (row as any).id);
  return true;
}

type PlanStatus = {
  /** false = la inscripción no existe o no está activa. Es lo ÚNICO que bloquea. */
  found: boolean;
  /** La inscripción que aporta los créditos. null = el atleta no maneja sesiones. */
  credit: CreditEnrollment | null;
  /** Motivo por el que no se va a descontar, aunque la asistencia sí se registre. */
  warning: 'expired' | 'no_credits' | 'no_secondary_credits' | null;
};

async function validatePlanForAttendance(
  enrollmentId: string, isSecondary: boolean = false,
  schoolId?: string, athlete: AthleteRef = {},
): Promise<PlanStatus> {
  const { data: enr, error } = await supabase
    .from('enrollments')
    .select(`id, sessions_used, secondary_sessions_used, expires_at, status, offering_plan_id, ${PLAN_JOIN}`)
    .eq('id', enrollmentId).eq('status', 'active').maybeSingle();

  if (error || !enr) return { found: false, credit: null, warning: null };

  // La fila recibida solo confirma que la inscripción existe y está activa; el
  // saldo sale de la que tiene el plan, que puede ser esta misma u otra.
  const credit = (enr as any).offering_plan_id
    ? toCreditEnrollment(enr)
    : (schoolId ? await findCreditEnrollment(schoolId, athlete) : null);

  if (!credit) return { found: true, credit: null, warning: null };

  const today = todayString();
  if (credit.expires_at && credit.expires_at < today) return { found: true, credit, warning: 'expired' };

  if (isSecondary) {
    if (credit.max_secondary_sessions !== null && credit.secondary_sessions_used >= credit.max_secondary_sessions) {
      return { found: true, credit, warning: 'no_secondary_credits' };
    }
  } else if (credit.max_sessions !== null && credit.sessions_used >= credit.max_sessions) {
    return { found: true, credit, warning: 'no_credits' };
  }

  return { found: true, credit, warning: null };
}

/** Estado del plan tal como lo consume el frontend (badge de la fila + toast). */
function planSummary(credit: CreditEnrollment | null, booking?: FreeBooking | null) {
  if (!credit) return null;
  return {
    plan_name: credit.plan_name,
    sessions_used: credit.sessions_used,
    max_sessions: credit.max_sessions,
    sessions_remaining: credit.max_sessions !== null ? Math.max(0, credit.max_sessions - credit.sessions_used) : null,
    secondary_sessions_used: credit.secondary_sessions_used,
    max_secondary_sessions: credit.max_secondary_sessions,
    expires_at: credit.expires_at,
    booking_today: booking ? { start_time: booking.start_time, source: booking.source } : null,
  };
}

// GET /session/:teamId — sesión de hoy + registros (ahora incluye unregistered_athlete_id)
router.get('/session/:teamId', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { teamId } = req.params;
      const today = todayString();
      const { data: session, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .select('id, team_id, session_date, finalized, finalized_at, created_by, created_at')
        .eq('team_id', teamId).eq('session_date', today).maybeSingle();
      if (sessionErr) throw sessionErr;
      if (!session) return res.json({ session: null, records: [] });
      const { data: records, error: recordsErr } = await supabase
        .from('attendance_records')
        .select('child_id, user_id, unregistered_athlete_id, status')
        .eq('team_id', teamId).eq('attendance_date', today);
      if (recordsErr) throw recordsErr;
      return res.json({ session, records: records || [] });
    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error consultando sesión');
      return res.status(500).json({ error: 'Error interno consultando la sesión.' });
    }
  }
);

// ── GET /roster/:contextType/:contextId ───────────────────────────────────────
router.get(
  '/roster/:contextType/:contextId',
  requireAuth,
  requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextType = req.params.contextType as string;
      const contextId = req.params.contextId as string;
      const { schoolId } = req;

      if (!['team', 'offering', 'facility_session'].includes(contextType)) {
        return res.status(400).json({ error: 'contextType debe ser "team", "offering" o "facility_session".' });
      }

      // ── Instalación: no hay "membresía" fija — el roster son las reservas ──
      // reales de ESE bloque puntual (contextId = attendance_sessions.id).
      // A diferencia de team/offering, cada persona puede venir de un plan distinto.
      if (contextType === 'facility_session') {
        const isNew = contextId.startsWith('new_');
        let bks: any[] = [];
        let favRes: any[] = [];

        if (isNew) {
          const facilityAvailabilityId = contextId.replace('new_', '');
          const queryDate = req.query.date as string;

          const { data: avail } = await supabase
            .from('facility_availability')
            .select('facility_id, start_time, end_time')
            .eq('id', facilityAvailabilityId)
            .maybeSingle();

          if (avail && queryDate) {
            const startStr = avail.start_time.substring(0, 5);
            const { data: reservations } = await supabase
              .from('facility_reservations')
              .select('id, user_id, child_id, enrollment_id, status, start_time')
              .eq('facility_id', avail.facility_id)
              .eq('school_id', schoolId)
              .eq('reservation_date', queryDate)
              .neq('status', 'cancelled');

            favRes = (reservations || []).filter((r: any) => r.start_time.substring(0, 5) === startStr);
          }
        } else {
          const { data: sess } = await supabase
            .from('attendance_sessions')
            .select('facility_id, session_date, start_time')
            .eq('id', contextId)
            .maybeSingle();

          if (sess) {
            const startStr = sess.start_time.substring(0, 5);
            const [bksRes, favResResult] = await Promise.all([
              supabase
                .from('session_bookings')
                .select('id, user_id, child_id, unregistered_athlete_id, enrollment_id, booking_type')
                .eq('session_id', contextId)
                .eq('school_id', schoolId)
                .neq('status', 'cancelled'),
              supabase
                .from('facility_reservations')
                .select('id, user_id, child_id, enrollment_id, status, start_time')
                .eq('facility_id', sess.facility_id)
                .eq('school_id', schoolId)
                .eq('reservation_date', sess.session_date)
                .neq('status', 'cancelled')
            ]);

            bks = bksRes.data || [];
            favRes = (favResResult.data || []).filter((r: any) => r.start_time.substring(0, 5) === startStr);
          }
        }

        const mergedBks = [
          ...bks.map((b: any) => ({ ...b, source: 'session_bookings' })),
          ...favRes.map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            child_id: r.child_id,
            unregistered_athlete_id: null,
            enrollment_id: r.enrollment_id,
            booking_type: 'secondary_class',
            source: 'facility_reservations'
          }))
        ];

        if (!mergedBks.length) return res.json({ athletes: [], bookings: [] });

        const enrIds = [...new Set(mergedBks.map((b: any) => b.enrollment_id).filter(Boolean))];
        const unregWithoutEnrIds = [...new Set(
          mergedBks.filter((b: any) => !b.enrollment_id && b.unregistered_athlete_id)
            .map((b: any) => b.unregistered_athlete_id)
        )];
        const [enrByIdRes, enrByUnregRes] = await Promise.all([
          enrIds.length
            ? supabase.from('enrollments')
                .select(`id, child_id, user_id, unregistered_athlete_id, expires_at, sessions_used,
                  offering_plans!enrollments_offering_plan_id_fkey(name, max_sessions, price, currency)`)
                .in('id', enrIds)
            : Promise.resolve({ data: [] }),
          unregWithoutEnrIds.length
            ? supabase.from('enrollments')
                .select(`id, unregistered_athlete_id, expires_at, sessions_used,
                  offering_plans!enrollments_offering_plan_id_fkey(name, max_sessions, price, currency)`)
                .in('unregistered_athlete_id', unregWithoutEnrIds)
                .eq('status', 'active')
            : Promise.resolve({ data: [] }),
        ]);
        const enrMap = Object.fromEntries((enrByIdRes.data || []).map((e: any) => [e.id, e]));
        const enrByUnregMap = Object.fromEntries((enrByUnregRes.data || []).map((e: any) => [e.unregistered_athlete_id, e]));

        const childIds = mergedBks.filter((b: any) => b.child_id).map((b: any) => b.child_id);
        const userIds = mergedBks.filter((b: any) => b.user_id).map((b: any) => b.user_id);
        const unregIds = mergedBks.filter((b: any) => b.unregistered_athlete_id).map((b: any) => b.unregistered_athlete_id);
        const [childRes, profileRes, unregRes] = await Promise.all([
          childIds.length ? supabase.from('children').select('id, full_name, avatar_url').in('id', childIds) : Promise.resolve({ data: [] }),
          userIds.length ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds) : Promise.resolve({ data: [] }),
          unregIds.length ? supabase.from('unregistered_athletes').select('id, full_name').in('id', unregIds) : Promise.resolve({ data: [] }),
        ]);
        const childMap = Object.fromEntries((childRes.data || []).map((x: any) => [x.id, x]));
        const profileMap = Object.fromEntries((profileRes.data || []).map((x: any) => [x.id, x]));
        const unregMap = Object.fromEntries((unregRes.data || []).map((x: any) => [x.id, x]));
        const today = new Date().toISOString().split('T')[0];

        const athletes = mergedBks.map((b: any) => {
          const athleteId = b.user_id ?? b.child_id ?? b.unregistered_athlete_id;
          const athleteType = b.child_id ? 'child' : b.user_id ? 'adult' : 'unregistered';
          const person = b.child_id ? childMap[b.child_id] : b.user_id ? profileMap[b.user_id] : unregMap[b.unregistered_athlete_id];
          const enr = enrMap[b.enrollment_id] ?? enrByUnregMap[b.unregistered_athlete_id];
          const plan = enr?.offering_plans;
          const maxSess = plan?.max_sessions ?? null;
          const used = enr?.sessions_used ?? 0;
          const expiresAt = enr?.expires_at ?? null;
          return {
            id: athleteId,
            full_name: person?.full_name ?? 'Sin nombre',
            avatar_url: person?.avatar_url ?? null,
            athlete_type: athleteType,
            enrollment_id: b.enrollment_id ?? null,
            plan: plan ? {
              name: plan.name,
              start_date: null,
              expires_at: expiresAt,
              days_left: expiresAt ? Math.ceil((new Date(expiresAt).getTime() - new Date(today).getTime()) / 86400000) : null,
              is_expired: expiresAt ? expiresAt < today : false,
              sessions_used: used,
              max_sessions: maxSess,
              sessions_remaining: maxSess !== null ? Math.max(0, maxSess - used) : null,
              secondary_sessions_used: 0,
              max_secondary_sessions: null,
              secondary_remaining: null,
              payment_status: null, payment_due_date: null,
              price: plan.price, currency: plan.currency,
            } : null,
            payment: null,
          };
        }).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));

        return res.json({ athletes, bookings: bks, context_type: 'facility_session', context_id: contextId });
      }

      const today = new Date().toISOString().split('T')[0];

      // ── 1. Resolver plan_ids del offering (solo si contextType = offering) ──
      let offeringPlanIds: string[] = [];
      if (contextType === 'offering') {
        const { data: plans, error: plansErr } = await supabase
          .from('offering_plans')
          .select('id')
          .eq('offering_id', contextId)
          .eq('is_active', true);
        if (plansErr) throw plansErr;
        offeringPlanIds = (plans || []).map((p: any) => p.id);
        if (!offeringPlanIds.length) return res.json({ athletes: [], bookings: [] });
      }

      // ── 2. Obtener enrollments activos del contexto ───────────────────────
      let enrollmentQuery = supabase
        .from('enrollments')
        .select(`
          id, child_id, user_id, unregistered_athlete_id,
          start_date, expires_at, sessions_used, secondary_sessions_used,
          offering_plan_id,
          offering_plans!enrollments_offering_plan_id_fkey(
            name, max_sessions, max_secondary_sessions, price, currency
          )
        `)
        .eq('school_id', schoolId)
        .eq('status', 'active');

      if (contextType === 'team') {
        enrollmentQuery = enrollmentQuery.eq('team_id', contextId);
      } else {
        enrollmentQuery = enrollmentQuery.in('offering_plan_id', offeringPlanIds);
      }

      const { data: enrollments, error: enrErr } = await enrollmentQuery;
      if (enrErr) throw enrErr;
      if (!enrollments?.length) return res.json({ athletes: [], bookings: [] });

      // ── 3. Resolver nombres e info de cada tipo de atleta ─────────────────
      const childIds        = enrollments.filter((e: any) => e.child_id).map((e: any) => e.child_id);
      const userIds         = enrollments.filter((e: any) => e.user_id).map((e: any) => e.user_id);
      const unregisteredIds = enrollments.filter((e: any) => e.unregistered_athlete_id).map((e: any) => e.unregistered_athlete_id);

      const [childRes, profileRes, unregRes] = await Promise.all([
        childIds.length
          ? supabase.from('children').select('id, full_name, avatar_url').in('id', childIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [] }),
        unregisteredIds.length
          ? supabase.from('unregistered_athletes').select('id, full_name').in('id', unregisteredIds)
          : Promise.resolve({ data: [] }),
      ]);

      const childMap   = Object.fromEntries((childRes.data   || []).map((x: any) => [x.id, x]));
      const profileMap = Object.fromEntries((profileRes.data || []).map((x: any) => [x.id, x]));
      const unregMap   = Object.fromEntries((unregRes.data   || []).map((x: any) => [x.id, x]));

      // ── 4. Pagos CONTEXTUALES (específicos del equipo o plan) ─────────────
      let paymentQuery = supabase
        .from('payments')
        .select('child_id, user_id, unregistered_athlete_id, status, due_date, created_at')
        .eq('school_id', schoolId);

      if (contextType === 'team') {
        paymentQuery = paymentQuery.eq('team_id', contextId);
      } else {
        paymentQuery = paymentQuery.in('offering_plan_id', offeringPlanIds);
      }

      const { data: payments } = await paymentQuery.order('created_at', { ascending: false });

      const paymentByAthlete: Record<string, { status: string; due_date: string | null }> = {};
      (payments || []).forEach((p: any) => {
        const id = p.child_id ?? p.user_id ?? p.unregistered_athlete_id;
        if (id && !paymentByAthlete[id]) {
          paymentByAthlete[id] = { status: p.status, due_date: p.due_date };
        }
      });

      // ── 4b. Reservas de hoy ───────────────────────────────────────────────
      // El entrenador tiene que ver que el atleta ya reservó: en ese caso pasar
      // lista NO le descuenta otra clase, y sin el aviso parece un error.
      const bookingByAthlete: Record<string, { start_time: string | null; status: string }> = {};
      {
        const { data: todayBks } = await supabase
          .from('session_bookings')
          .select('child_id, user_id, unregistered_athlete_id, status, attendance_sessions!inner(session_date, start_time)')
          .eq('school_id', schoolId)
          .in('status', ['confirmed', 'attended'])
          .eq('attendance_sessions.session_date', todayString());

        for (const b of todayBks || []) {
          const key = (b as any).child_id ?? (b as any).user_id ?? (b as any).unregistered_athlete_id;
          if (key && !bookingByAthlete[key]) {
            bookingByAthlete[key] = {
              start_time: (b as any).attendance_sessions?.start_time ?? null,
              status: (b as any).status,
            };
          }
        }
      }

      // ── 5. Construir athletes enriquecidos ────────────────────────────────
      const athletes = enrollments.map((e: any) => {
        const athleteId   = e.child_id ?? e.user_id ?? e.unregistered_athlete_id;
        const athleteType = e.child_id ? 'child' : e.user_id ? 'adult' : 'unregistered';
        const person      = e.child_id ? childMap[e.child_id] : e.user_id ? profileMap[e.user_id] : unregMap[e.unregistered_athlete_id];

        const plan        = (e as any).offering_plans ?? null;
        const maxSessions   = plan?.max_sessions      ?? null;
        const maxSecondary  = plan?.max_secondary_sessions ?? null;
        const used          = e.sessions_used          ?? 0;
        const usedSecondary = e.secondary_sessions_used ?? 0;
        const expiresAt     = e.expires_at             ?? null;
        const isExpired     = expiresAt ? expiresAt < today : false;
        const daysLeft      = expiresAt
          ? Math.ceil((new Date(expiresAt).getTime() - new Date(today).getTime()) / 86400000)
          : null;

        const payment = paymentByAthlete[athleteId] ?? null;

        return {
          id:           athleteId,
          full_name:    person?.full_name   ?? 'Sin nombre',
          avatar_url:   person?.avatar_url  ?? null,
          athlete_type: athleteType,
          enrollment_id: e.id,
          // Para EQUIPOS: plan null siempre — el equipo no tiene plan
          // Para PLANES:  plan con toda la info
          // Reserva de hoy: el descuento la consume en vez de cobrar otra clase.
          booking_today: bookingByAthlete[athleteId] ?? null,
          // El plan se expone en AMBOS contextos. El equipo no tiene plan propio,
          // pero el atleta sí, y es de su plan de donde sale el descuento: con
          // `plan: null` forzado por equipo el entrenador descontaba a ciegas y
          // solo se enteraba por un 422 seco. Atleta de equipo puro → plan null
          // natural, que es lo correcto: no maneja sesiones.
          plan: plan ? {
            name:                    plan.name,
            start_date:              e.start_date    ?? null,
            expires_at:              expiresAt,
            days_left:               daysLeft,
            is_expired:              isExpired,
            sessions_used:           used,
            max_sessions:            maxSessions,
            sessions_remaining:      maxSessions !== null ? Math.max(0, maxSessions - used) : null,
            secondary_sessions_used: usedSecondary,
            max_secondary_sessions:  maxSecondary,
            secondary_remaining:     maxSecondary !== null ? Math.max(0, maxSecondary - usedSecondary) : null,
            payment_status:          payment?.status   ?? null,
            payment_due_date:        payment?.due_date ?? null,
            price:                   plan.price,
            currency:                plan.currency,
          } : null,
          // Pago contextual siempre disponible (independiente del plan)
          payment: payment ?? null,
        };
      }).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));

      // ── 6. Bookings del día para offerings ────────────────────────────────
      let bookings: any[] = [];
      if (contextType === 'offering') {
        const { data: todaySessions } = await supabase
          .from('attendance_sessions')
          .select('id')
          .eq('school_id', schoolId)
          .eq('offering_id', contextId)
          .eq('session_date', today)
          .eq('finalized', false);

        if (todaySessions?.length) {
          const sessionIds = todaySessions.map((s: any) => s.id);
          const { data: bks } = await supabase
            .from('session_bookings')
            .select('id, session_id, user_id, child_id, unregistered_athlete_id, booking_type, enrollment_id')
            .in('session_id', sessionIds)
            .neq('status', 'cancelled');
          bookings = bks || [];
        }
      }

      return res.json({ athletes, bookings, context_type: contextType, context_id: contextId });
    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error cargando roster');
      return res.status(500).json({ error: 'Error interno cargando el roster.' });
    }
  }
);

// POST /session — guarda registros. Soporta child_id, user_id y unregistered_athlete_id.
router.post('/session', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { schoolId } = req;
      const { teamId, sessionId, records } = req.body as {
        teamId?: string; sessionId?: string;
        records: { childId?: string; userId?: string; unregisteredAthleteId?: string; status: string; }[];
      };
      if ((!teamId && !sessionId) || !Array.isArray(records) || records.length === 0)
        return res.status(400).json({ error: 'teamId (o sessionId) y records son requeridos.' });
      if (records.find(r => !r.childId && !r.userId && !r.unregisteredAthleteId))
        return res.status(400).json({ error: 'Cada record debe tener childId, userId o unregisteredAthleteId.' });

      const today = todayString();
      let existingSessionId = sessionId;

      if (existingSessionId) {
        const { data: existing, error } = await supabase.from('attendance_sessions').select('id, finalized').eq('id', existingSessionId).maybeSingle();
        if (error) throw error;
        if (existing?.finalized) return res.status(409).json({ error: 'La sesión ya fue finalizada y no puede modificarse.', finalized: true });
      } else if (teamId) {
        const { data: existing, error } = await supabase.from('attendance_sessions').select('id, finalized').eq('team_id', teamId).eq('session_date', today).maybeSingle();
        if (error) throw error;
        if (existing?.finalized) return res.status(409).json({ error: 'La sesión de hoy ya fue finalizada.', finalized: true });
        if (existing) existingSessionId = existing.id;
      }

      let finalSessionId = existingSessionId;
      if (!finalSessionId && teamId) {
        // Resolver staffId para el coach
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('coach_auth_id', req.user?.id)
          .eq('school_id', schoolId)
          .maybeSingle();

        const { data: session, error } = await supabase.from('attendance_sessions')
          .insert({ 
            school_id: schoolId, 
            team_id: teamId, 
            session_date: today, 
            created_by: req.user?.id, 
            coach_id: staffData?.id || null 
          })
          .select('id, finalized').single();
        if (error) throw error;
        finalSessionId = session.id;
      }
      if (!finalSessionId) return res.status(404).json({ error: 'No se pudo encontrar o crear la sesión.' });

      // Un helper para llamar el RPC por cada record
      const upsertRecord = async (record: any) => {
        const { error } = await supabase.rpc('upsert_attendance_record', {
          p_school_id:       schoolId,
          p_session_id:      finalSessionId,
          p_attendance_date: today,
          p_status:          record.status,
          p_team_id:         teamId              || null,
          p_marked_by:       req.user?.id        || null,
          p_child_id:        record.childId      || null,
          p_user_id:         record.userId       || null,
          p_unregistered_id: record.unregisteredAthleteId || null,
        });
        if (error) throw error;
      };

      // ── Estado previo, para mover créditos por transición ────────────────
      // Esta ruta no tocaba `enrollments`, así que el saldo dependía de la
      // pantalla: CoachPlansPage marcaba presente y no descontaba nada, y
      // corregir presente→ausente en un equipo quemaba la clase (la devolución
      // solo vivía en walk-in). Ahora ambas rutas comparten la misma lógica.
      const prevByAthlete: Record<string, string> = {};
      if (finalSessionId) {
        const { data: prevRecords } = await supabase
          .from('attendance_records')
          .select('status, child_id, user_id, unregistered_athlete_id')
          .eq('session_id', finalSessionId);

        for (const r of prevRecords || []) {
          const key = (r as any).child_id ?? (r as any).user_id ?? (r as any).unregistered_athlete_id;
          if (key) prevByAthlete[key] = (r as any).status;
        }
      }

      for (const record of records) {
        await upsertRecord(record);
      }

      const creditOutcomes: Record<string, CreditOutcome> = {};

      for (const record of records) {
        const athlete: AthleteRef = {
          childId: record.childId, userId: record.userId, unregisteredId: record.unregisteredAthleteId,
        };
        const key = athleteKey(athlete);
        if (!key) continue;

        const wasPresent   = prevByAthlete[key] === 'present';
        const isNowPresent = record.status === 'present';
        if (wasPresent === isNowPresent) continue;

        // `is_secondary` no viaja en esta ruta: acá solo se mueve la bolsa principal.
        const credit = await findCreditEnrollment(schoolId!, athlete);
        if (!credit) { creditOutcomes[key] = 'no_plan'; continue; }

        if (isNowPresent) {
          const freeBooking = await findFreeBookingOfDay(schoolId!, athlete, today, false, finalSessionId);
          if (freeBooking) {
            await consumeBooking(freeBooking);
            creditOutcomes[key] = 'covered_by_booking';
            continue;
          }
          if (credit.expires_at && credit.expires_at < today) { creditOutcomes[key] = 'expired'; continue; }
          if (credit.max_sessions !== null && credit.sessions_used >= credit.max_sessions) {
            creditOutcomes[key] = 'no_credits';
            continue;
          }
          const moved = await moveCredit(credit.id, 1, false);
          creditOutcomes[key] = moved?.moved ? 'deducted' : 'no_credits';
        } else {
          const released = await releaseConsumedBooking(schoolId!, athlete, today, false, finalSessionId);
          if (released) { creditOutcomes[key] = 'booking_released'; continue; }
          const moved = await moveCredit(credit.id, -1, false);
          creditOutcomes[key] = moved?.moved ? 'returned' : 'unchanged';
        }
      }

      return res.json({ success: true, sessionId: finalSessionId, credit_outcomes: creditOutcomes });
    } catch (err: any) {
      console.error('SESSION ERROR DETAIL:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        body: req.body,
      });
      req.log?.error({ err: err.message || err }, 'Error guardando sesión de asistencia');
      return res.status(500).json({ error: 'Error interno guardando la asistencia.' });
    }
  }
);

// POST /walk-in — valida plan, registra asistencia y descuenta crédito en una operación.
// POST /walk-in — valida plan, registra asistencia y descuenta crédito en una operación.
router.post('/walk-in', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { enrollmentId, teamId, sessionId, offeringId, facilityAvailabilityId, status = 'present', childId, userId, unregisteredAthleteId, is_secondary = false } = req.body as {
        enrollmentId: string; teamId?: string; sessionId?: string; offeringId?: string; facilityAvailabilityId?: string; status?: string;
        childId?: string; userId?: string; unregisteredAthleteId?: string; is_secondary?: boolean;
      };
      if (!enrollmentId) return res.status(400).json({ error: 'enrollmentId es requerido.' });
      if (!childId && !userId && !unregisteredAthleteId) return res.status(400).json({ error: 'Debe especificar childId, userId o unregisteredAthleteId.' });
      if (!teamId && !sessionId && !offeringId && !facilityAvailabilityId) {
        return res.status(400).json({ error: 'teamId, sessionId, offeringId o facilityAvailabilityId son requeridos.' });
      }

      const today = todayString();
      let finalSessionId = sessionId;

      if (!finalSessionId && facilityAvailabilityId) {
        // Anotar en un bloque de instalación que nadie reservó online todavía
        const { data: avail } = await supabase
          .from('facility_availability')
          .select('facility_id, start_time, end_time, max_group_capacity')
          .eq('id', facilityAvailabilityId)
          .single();
        if (!avail) return res.status(404).json({ error: 'Disponibilidad de instalación no encontrada.' });

        const { data: existing } = await supabase
          .from('attendance_sessions')
          .select('id, finalized')
          .eq('facility_availability_id', facilityAvailabilityId)
          .eq('session_date', today)
          .maybeSingle();

        if (existing?.finalized) return res.status(409).json({ error: 'La sesión de hoy ya fue finalizada.' });
        if (existing) {
          finalSessionId = existing.id;
        } else {
          const start_time = avail.start_time.length === 5 ? `${avail.start_time}:00` : avail.start_time;
          const end_time = avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time;
          const { data: newSession, error } = await supabase.from('attendance_sessions')
            .insert({
              school_id: schoolId,
              facility_id: avail.facility_id,
              facility_availability_id: facilityAvailabilityId,
              coach_id: null,
              offering_id: null,
              session_date: today,
              start_time, end_time,
              max_capacity: avail.max_group_capacity ?? 10,
              current_bookings: 0,
              is_bookable: true,
              finalized: false,
            })
            .select('id').single();

          if (error && error.code === '23505') {
            const { data: retryS, error: retryErr } = await supabase
              .from('attendance_sessions')
              .select('id')
              .eq('facility_availability_id', facilityAvailabilityId)
              .eq('session_date', today)
              .single();
            if (retryErr || !retryS) return res.status(500).json({ error: 'No se pudo resolver el bloque.' });
            finalSessionId = retryS.id;
          } else if (error) {
            throw error;
          } else {
            finalSessionId = newSession.id;
          }
        }
      } else if (!finalSessionId && offeringId) {
        const { data: todaySessions } = await supabase
          .from('attendance_sessions')
          .select('id, finalized, start_time')
          .eq('school_id', schoolId)
          .eq('offering_id', offeringId)
          .eq('session_date', today)
          .eq('finalized', false)
          .order('start_time', { ascending: true });

        if ((todaySessions?.length ?? 0) > 1) {
          return res.status(409).json({
            error: 'Este plan tiene varios horarios hoy. Selecciona el bloque específico antes de marcar asistencia.',
            reason: 'multiple_sessions_today',
            sessions: todaySessions,
          });
        }

        const existing = todaySessions?.[0];
        if (existing) {
          finalSessionId = existing.id;
        } else {
          return res.status(404).json({ error: 'No hay sesión activa para este plan hoy.', reason: 'no_session' });
        }
      } else if (!finalSessionId && teamId) {
        const { data: existing } = await supabase.from('attendance_sessions').select('id, finalized').eq('team_id', teamId).eq('session_date', today).maybeSingle();
        if (existing?.finalized) return res.status(409).json({ error: 'La sesión de hoy ya fue finalizada.' });
        if (existing) {
          finalSessionId = existing.id;
        } else {
          // Resolver staffId para el coach
          const { data: staffData } = await supabase
            .from('school_staff')
            .select('id')
            .eq('coach_auth_id', req.user?.id)
            .eq('school_id', schoolId)
            .maybeSingle();

          const { data: newSession, error } = await supabase.from('attendance_sessions')
            .insert({ 
              school_id: schoolId, 
              team_id: teamId, 
              session_date: today, 
              created_by: req.user?.id, 
              coach_id: staffData?.id || null 
            })
            .select('id').single();
          if (error) throw error;
          finalSessionId = newSession.id;
        }
      } else if (finalSessionId) {
        const { data: sess } = await supabase.from('attendance_sessions').select('finalized').eq('id', finalSessionId).single();
        if (sess?.finalized) return res.status(409).json({ error: 'La sesión ya fue finalizada.' });
      }

      // ── Estado del plan y reserva del día, con finalSessionId ya resuelto ──
      // Lo único que bloquea es que la inscripción no exista o no esté activa. Que
      // al atleta le falten clases o tenga el plan vencido NO impide pasar lista:
      // se registra la asistencia y se le informa al entrenador.
      const athlete: AthleteRef = { childId, userId, unregisteredId: unregisteredAthleteId };

      const planStatus = await validatePlanForAttendance(enrollmentId, is_secondary, schoolId!, athlete);
      if (!planStatus.found) {
        return res.status(422).json({ error: 'Enrollment no encontrado.', reason: 'not_found' });
      }

      // Reserva de HOY que esta asistencia puede consumir en lugar de descontar
      // otra clase. Antes se buscaba solo la reserva de ESTA sesión (o de la
      // misma hora exacta en instalaciones): quien reservaba a las 6pm y aparecía
      // en la sesión de las 4pm pagaba dos clases por un solo entrenamiento.
      const freeBooking = (status === 'present' && planStatus.credit)
        ? await findFreeBookingOfDay(schoolId!, athlete, today, is_secondary, finalSessionId)
        : null;

      // Consulta del estado previo para transición de créditos
      let previousStatus: string | null = null;
      if (finalSessionId || teamId) {
        const whereClause = childId
          ? { child_id: childId }
          : userId
            ? { user_id: userId }
            : { unregistered_athlete_id: unregisteredAthleteId };

        if (finalSessionId) {
          const { data: existing } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('session_id', finalSessionId)
            .match(whereClause)
            .maybeSingle();
          previousStatus = existing?.status ?? null;
        }

        if (!previousStatus && teamId) {
          const { data: existingTeam } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('team_id', teamId)
            .eq('attendance_date', today)
            .match(whereClause)
            .maybeSingle();
          previousStatus = existingTeam?.status ?? null;
        }
      }

      const { error: recErr } = await supabase.rpc('upsert_attendance_record', {
        p_school_id:       schoolId,
        p_session_id:      finalSessionId,
        p_attendance_date: today,
        p_status:          status,
        p_team_id:         teamId              || null,
        p_marked_by:       req.user?.id        || null,
        p_child_id:        childId             || null,
        p_user_id:         userId              || null,
        p_unregistered_id: unregisteredAthleteId || null,
      });
      if (recErr) throw recErr;

      // ── Créditos, por transición de estado ───────────────────────────────
      // créditos del día = reservas hechas + asistencias que no encontraron
      // reserva libre. Todo el movimiento del saldo pasa por move_session_credit.
      const wasPresent   = previousStatus === 'present';
      const isNowPresent = status === 'present';
      let credit  = planStatus.credit;
      let outcome: CreditOutcome = 'unchanged';

      if (!wasPresent && isNowPresent) {
        if (!credit) {
          outcome = 'no_plan';
        } else if (freeBooking) {
          // Ya pagó esta clase al reservar: se consume la reserva, no el saldo.
          await consumeBooking(freeBooking);
          outcome = 'covered_by_booking';
        } else if (planStatus.warning) {
          // Sin saldo o vencido: la asistencia queda registrada igual.
          outcome = planStatus.warning === 'expired' ? 'expired' : 'no_credits';
        } else {
          const moved = await moveCredit(credit.id, 1, is_secondary);
          if (moved?.moved) {
            credit = { ...credit, ...pickCreditFields(moved) };
            outcome = 'deducted';
          } else {
            outcome = moved?.reason === 'no_plan' ? 'no_plan' : 'no_credits';
          }
        }
      } else if (wasPresent && !isNowPresent) {
        // Corrección a ausente/tarde/excusado. Si la presencia se había cubierto
        // con una reserva, lo que se devuelve es la reserva (que seguirá viva y
        // se quemará como no-show), no el crédito: ese ya lo cobró la reserva.
        const released = await releaseConsumedBooking(schoolId!, athlete, today, is_secondary, finalSessionId);
        if (released) {
          outcome = 'booking_released';
        } else if (credit) {
          const moved = await moveCredit(credit.id, -1, is_secondary);
          if (moved?.moved) {
            credit = { ...credit, ...pickCreditFields(moved) };
            outcome = 'returned';
          }
        }
      }

      return res.status(201).json({
        success: true,
        sessionId: finalSessionId,
        credit_outcome: outcome,
        plan_summary: planSummary(credit, freeBooking),
      });
    } catch (err: any) {
      // TEMPORAL — log detallado
      console.error('WALK-IN ERROR DETAIL:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        body: req.body,
      });
      req.log?.error({ err: err.message || err }, 'Error procesando walk-in');
      return res.status(500).json({ error: 'Error interno procesando el walk-in.' });
    }
  }
);

// PATCH /session/:sessionId/finalize — finaliza la sesión (irreversible).
router.patch('/session/:sessionId/finalize', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { data: session, error: fetchErr } = await supabase.from('attendance_sessions').select('id, finalized, team_id').eq('id', sessionId).single();
      if (fetchErr || !session) return res.status(404).json({ error: 'Sesión no encontrada.' });
      if (session.finalized) return res.status(409).json({ error: 'La sesión ya estaba finalizada.' });

      const { data: bookingsPreview } = await supabase.from('session_bookings')
        .select('id, user_id, child_id, unregistered_athlete_id, is_secondary, booking_type, enrollment_id')
        .eq('session_id', sessionId).eq('status', 'confirmed');

      const { error: updateErr } = await supabase.from('attendance_sessions')
        .update({ finalized: true, finalized_at: new Date().toISOString(), finalized_by: req.user?.id })
        .eq('id', sessionId);
      if (updateErr) throw updateErr;

      return res.json({
        success: true, message: 'Sesión finalizada correctamente.',
        summary: {
          bookings_processed: bookingsPreview?.length ?? 0,
          details: (bookingsPreview || []).map((b: any) => ({ booking_id: b.id, booking_type: b.booking_type, is_secondary: b.is_secondary })),
        },
      });
    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error finalizando sesión');
      return res.status(500).json({ error: 'Error interno finalizando la sesión.' });
    }
  }
);

// GET /rate/:teamId — porcentaje de asistencia para reportes.
router.get('/rate/:teamId', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { teamId } = req.params;
      const { data, error } = await supabase.from('attendance_records').select('status').eq('team_id', teamId);
      if (error) throw error;
      const total = data?.length || 0;
      const present = data?.filter((r: any) => r.status === 'present' || r.status === 'late').length || 0;
      return res.json({ rate: total > 0 ? Math.round((present / total) * 100) : 0 });
    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error calculando asistencia');
      return res.status(500).json({ error: 'Error interno calculando asistencia.', rate: 0 });
    }
  }
);

// GET /school-roster?search=nombre — busca cualquier atleta con enrollment activo
// en la escuela, sin importar el plan/offering. Usado por el walk-in de instalaciones,
// donde cualquier persona con crédito primario puede aparecer en cualquier bloque.
router.get('/school-roster', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const search = ((req.query.search as string) ?? '').trim();
      if (search.length < 2) return res.json({ athletes: [] });

      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`id, child_id, user_id, unregistered_athlete_id, expires_at, sessions_used,
          offering_plans!enrollments_offering_plan_id_fkey(name, max_sessions, price, currency)`)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .limit(500); // filtramos por nombre en memoria tras resolver los nombres

      if (error) throw error;
      if (!enrollments?.length) return res.json({ athletes: [] });

      const childIds = enrollments.filter((e: any) => e.child_id).map((e: any) => e.child_id);
      const userIds = enrollments.filter((e: any) => e.user_id).map((e: any) => e.user_id);
      const unregIds = enrollments.filter((e: any) => e.unregistered_athlete_id).map((e: any) => e.unregistered_athlete_id);

      const [childRes, profileRes, unregRes] = await Promise.all([
        childIds.length ? supabase.from('children').select('id, full_name, avatar_url').in('id', childIds) : Promise.resolve({ data: [] }),
        userIds.length ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds) : Promise.resolve({ data: [] }),
        unregIds.length ? supabase.from('unregistered_athletes').select('id, full_name').in('id', unregIds) : Promise.resolve({ data: [] }),
      ]);
      const childMap = Object.fromEntries((childRes.data || []).map((x: any) => [x.id, x]));
      const profileMap = Object.fromEntries((profileRes.data || []).map((x: any) => [x.id, x]));
      const unregMap = Object.fromEntries((unregRes.data || []).map((x: any) => [x.id, x]));
      const today = new Date().toISOString().split('T')[0];
      const q = search.toLowerCase();

      const athletes = enrollments
        .map((e: any) => {
          const athleteId = e.child_id ?? e.user_id ?? e.unregistered_athlete_id;
          const athleteType = e.child_id ? 'child' : e.user_id ? 'adult' : 'unregistered';
          const person = e.child_id ? childMap[e.child_id] : e.user_id ? profileMap[e.user_id] : unregMap[e.unregistered_athlete_id];
          const plan = e.offering_plans;
          const maxSess = plan?.max_sessions ?? null;
          const used = e.sessions_used ?? 0;
          return {
            id: athleteId,
            full_name: person?.full_name ?? 'Sin nombre',
            avatar_url: person?.avatar_url ?? null,
            athlete_type: athleteType,
            enrollment_id: e.id,
            plan: plan ? {
              name: plan.name,
              expires_at: e.expires_at ?? null,
              is_expired: e.expires_at ? e.expires_at < today : false,
              sessions_used: used,
              max_sessions: maxSess,
              sessions_remaining: maxSess !== null ? Math.max(0, maxSess - used) : null,
              price: plan.price, currency: plan.currency,
            } : null,
          };
        })
        .filter((a: any) => a.full_name.toLowerCase().includes(q))
        .slice(0, 20);

      return res.json({ athletes });
    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error buscando school-roster');
      return res.status(500).json({ error: 'Error interno buscando atletas.' });
    }
  }
);

// POST /quick-guest — crea un unregistered_athletes nuevo desde el panel del owner.
// IMPORTANTE (alcance real): esto SOLO crea el registro de la persona para que exista
// en el sistema y pueda buscarse en /school-roster. NO crea una inscripcion/plan ni
// hace walk-in inmediato, porque /walk-in requiere un enrollmentId con credito activo
// y crear una inscripcion implica flujo de pago/plan que excede el modulo de asistencia.
// El owner debe inscribirla en un plan (flujo de inscripcion ya existente) antes de
// poder marcarle asistencia con descuento de credito.
router.post('/quick-guest', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { fullName, phone, docNumber } = req.body as { fullName: string; phone?: string; docNumber?: string };
      if (!fullName?.trim()) return res.status(400).json({ error: 'fullName es requerido.' });

      const { data, error } = await supabase
        .from('unregistered_athletes')
        .insert({
          school_id: schoolId,
          full_name: fullName.trim(),
          phone: phone || null,
          doc_number: docNumber || null,
        })
        .select('id, full_name')
        .single();

      if (error) throw error;
      return res.status(201).json({
        success: true,
        athlete: data,
        message: 'Invitado creado. Debe inscribirse en un plan antes de poder registrarle asistencia con crédito.',
      });
    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error creando invitado rápido');
      return res.status(500).json({ error: 'Error interno creando el invitado.' });
    }
  }
);

// POST /api/v1/attendance/link-unregistered
// Migración manual: enlaza un atleta no registrado a su perfil ya registrado.
// Útil cuando el atleta se registró sin usar el link de invitación.
router.post(
  '/link-unregistered',
  requireAuth,
  requireRole('owner', 'super_admin', 'admin', 'school_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { unregisteredAthleteId, targetUserId, targetChildId } = req.body as {
        unregisteredAthleteId: string;
        targetUserId?: string;
        targetChildId?: string;
      };

      if (!unregisteredAthleteId || (!targetUserId && !targetChildId)) {
        return res.status(400).json({
          error: 'Se requiere unregisteredAthleteId y targetUserId o targetChildId.',
        });
      }

      const { data, error } = await supabase.rpc('link_unregistered_to_profile', {
        p_unregistered_id:  unregisteredAthleteId,
        p_target_user_id:   targetUserId  ?? null,
        p_target_child_id:  targetChildId ?? null,
      });

      if (error) throw error;

      return res.json({ success: true, migration: data });
    } catch (err: any) {
      // El RPC ya valida permisos y lanza excepciones descriptivas
      const isPermission = err.message?.includes('permisos');
      return res
        .status(isPermission ? 403 : 500)
        .json({ error: err.message || 'Error enlazando atleta.' });
    }
  }
);

export default router;
