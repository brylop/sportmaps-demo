import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

function todayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

async function validatePlanForAttendance(enrollmentId: string, isSecondary: boolean = false): Promise<{
  valid: boolean;
  reason?: 'expired' | 'no_credits' | 'no_secondary_credits' | 'not_found';
  enrollment?: {
    id: string; sessions_used: number; max_sessions: number | null;
    secondary_sessions_used: number; max_secondary_sessions: number | null;
    expires_at: string | null; plan_name: string | null;
  };
}> {
  const { data: enr, error } = await supabase
    .from('enrollments')
    .select('id, sessions_used, secondary_sessions_used, expires_at, status, offering_plans!enrollments_offering_plan_id_fkey(name, max_sessions, max_secondary_sessions)')
    .eq('id', enrollmentId).eq('status', 'active').maybeSingle();

  if (error || !enr) return { valid: false, reason: 'not_found' };

  const plan = (enr as any).offering_plans;
  const today = todayString();

  if (enr.expires_at && enr.expires_at < today) return { valid: false, reason: 'expired' };

  if (isSecondary) {
    const maxSecondary: number | null = plan?.max_secondary_sessions ?? null;
    if (maxSecondary !== null && enr.secondary_sessions_used >= maxSecondary) return { valid: false, reason: 'no_secondary_credits' };
  } else {
    const maxSessions: number | null = plan?.max_sessions ?? null;
    if (maxSessions !== null && enr.sessions_used >= maxSessions) return { valid: false, reason: 'no_credits' };
  }

  return {
    valid: true,
    enrollment: {
      id: enr.id, sessions_used: enr.sessions_used, max_sessions: plan?.max_sessions ?? null,
      secondary_sessions_used: enr.secondary_sessions_used,
      max_secondary_sessions: plan?.max_secondary_sessions ?? null,
      expires_at: enr.expires_at ?? null, plan_name: plan?.name ?? null,
    },
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

      if (!['team', 'offering'].includes(contextType)) {
        return res.status(400).json({ error: 'contextType debe ser "team" o "offering".' });
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
          plan: (contextType === 'offering' && plan) ? {
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
        const { data: session, error } = await supabase.from('attendance_sessions')
          .insert({ school_id: schoolId, team_id: teamId, session_date: today, created_by: req.user?.id })
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

      for (const record of records) {
        await upsertRecord(record);
      }
      return res.json({ success: true, sessionId: finalSessionId });
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
router.post('/walk-in', requireAuth, requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { enrollmentId, teamId, sessionId, offeringId, status = 'present', childId, userId, unregisteredAthleteId, is_secondary = false } = req.body as {
        enrollmentId: string; teamId?: string; sessionId?: string; offeringId?: string; status?: string;
        childId?: string; userId?: string; unregisteredAthleteId?: string; is_secondary?: boolean;
      };
      if (!enrollmentId) return res.status(400).json({ error: 'enrollmentId es requerido.' });
      if (!childId && !userId && !unregisteredAthleteId) return res.status(400).json({ error: 'Debe especificar childId, userId o unregisteredAthleteId.' });
      if (!teamId && !sessionId && !offeringId) {
        return res.status(400).json({ error: 'teamId, sessionId u offeringId son requeridos.' });
      }

      let planCheck: any = null;
      if (status === 'present') {
        planCheck = await validatePlanForAttendance(enrollmentId, is_secondary);
        if (!planCheck.valid) {
          const messages: Record<string, string> = {
            expired:   'El plan está vencido.',
            no_credits:'El plan no tiene clases disponibles.',
            not_found: 'No se encontró un plan activo.',
            no_secondary_credits: 'El plan no tiene clases secundarias disponibles.',
          };
          return res.status(422).json({ error: messages[planCheck.reason!], reason: planCheck.reason });
        }
      } else {
        const { data: enr } = await supabase
          .from('enrollments').select('id').eq('id', enrollmentId).eq('status', 'active').maybeSingle();
        if (!enr) return res.status(422).json({ error: 'Enrollment no encontrado.', reason: 'not_found' });
      }

      const today = todayString();
      let finalSessionId = sessionId;

      if (!finalSessionId && offeringId) {
        const { data: existing } = await supabase
          .from('attendance_sessions')
          .select('id, finalized')
          .eq('school_id', schoolId)
          .eq('offering_id', offeringId)
          .eq('session_date', today)
          .eq('finalized', false)
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existing?.finalized) {
          return res.status(409).json({ error: 'La sesión de hoy ya fue finalizada.' });
        }
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
          const { data: newSession, error } = await supabase.from('attendance_sessions')
            .insert({ school_id: schoolId, team_id: teamId, session_date: today, created_by: req.user?.id })
            .select('id').single();
          if (error) throw error;
          finalSessionId = newSession.id;
        }
      } else if (finalSessionId) {
        const { data: sess } = await supabase.from('attendance_sessions').select('finalized').eq('id', finalSessionId).single();
        if (sess?.finalized) return res.status(409).json({ error: 'La sesión ya fue finalizada.' });
      }

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

      // Lógica de créditos basada en transición de estado:
      const wasPresent = previousStatus === 'present';
      const isNowPresent = status === 'present';

      if (!wasPresent && isNowPresent) {
        // Descontar crédito — primer vez presente o cambio a presente
        if (planCheck?.enrollment) {
          const fieldToDeduct = is_secondary ? 'secondary_sessions_used' : 'sessions_used';
          const currentVal    = is_secondary
            ? planCheck.enrollment.secondary_sessions_used
            : planCheck.enrollment.sessions_used;
          await supabase.from('enrollments')
            .update({ [fieldToDeduct]: currentVal + 1 })
            .eq('id', enrollmentId);
          
          if (is_secondary) planCheck.enrollment.secondary_sessions_used++;
          else planCheck.enrollment.sessions_used++;
        }
      } else if (wasPresent && !isNowPresent) {
        // Devolver crédito — cambió de presente a ausente/tarde/excusado
        const { data: enr } = await supabase
          .from('enrollments')
          .select('sessions_used, secondary_sessions_used')
          .eq('id', enrollmentId)
          .single();
        if (enr) {
          const fieldToReturn = is_secondary ? 'secondary_sessions_used' : 'sessions_used';
          const currentVal = is_secondary ? enr.secondary_sessions_used : enr.sessions_used;
          const newVal = Math.max(0, currentVal - 1);
          await supabase.from('enrollments')
            .update({ [fieldToReturn]: newVal })
            .eq('id', enrollmentId);
          
          if (planCheck?.enrollment) {
            if (is_secondary) planCheck.enrollment.secondary_sessions_used = newVal;
            else planCheck.enrollment.sessions_used = newVal;
          }
        }
      }

      const summaryEnrollment = planCheck?.enrollment;
      return res.status(201).json({
        success: true,
        sessionId: finalSessionId,
        plan_summary: summaryEnrollment ? {
          plan_name:               summaryEnrollment.plan_name,
          sessions_used:           summaryEnrollment.sessions_used, 
          max_sessions:            summaryEnrollment.max_sessions,
          sessions_remaining:      summaryEnrollment.max_sessions !== null
            ? Math.max(0, summaryEnrollment.max_sessions - summaryEnrollment.sessions_used)
            : null,
          secondary_sessions_used: summaryEnrollment.secondary_sessions_used,
          max_secondary_sessions:  summaryEnrollment.max_secondary_sessions,
          expires_at:              summaryEnrollment.expires_at,
        } : null,
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
