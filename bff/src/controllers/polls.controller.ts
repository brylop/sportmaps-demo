import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface CreatePollBody {
  title: string;
  poll_date: string;       // 'YYYY-MM-DD'
  sessions: {
    title: string;
    start_time: string;    // 'HH:MM'
    end_time: string;
    max_capacity?: number;
    coach_id?: string;
    team_id?: string;
  }[];
}

interface ConfirmAttendanceBody {
  session_id: string;
  // Atleta registrado
  user_id?: string;
  enrollment_id?: string;
  // Invitado
  guest_name?: string;
  guest_phone?: string;
  poll_token?: string;     // generado en el frontend, guardado en localStorage
}

interface ManualConfirmationBody {
  user_id?: string;
  enrollment_id?: string;
  unregistered_athlete_id?: string;
  guest_name?: string;
  guest_phone?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function err(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLADOR
// ─────────────────────────────────────────────────────────────────────────────

export const pollsController = {

  // ── GET /polls ─────────────────────────────────────────────────────────────
  // Lista todos los polls de la escuela con resumen de sesiones
  async listPolls(req: Request, res: Response) {
    const schoolId = req.schoolId;
    const { status, date } = req.query;

    let query = supabase
      .from('attendance_polls')
      .select(`
        id, title, poll_date, status, created_at,
        created_by:profiles!attendance_polls_created_by_fkey(id, full_name),
        attendance_sessions(
          id, title, start_time, end_time, max_capacity, current_bookings,
          coach:school_staff(id, full_name)
        )
      `)
      .eq('school_id', schoolId)
      .order('poll_date', { ascending: false });

    if (status) query = query.eq('status', status as string);
    if (date)   query = query.eq('poll_date', date as string);

    const { data, error } = await query;
    if (error) return err(res, 500, error.message);
    return res.json(data);
  },

  // ── GET /polls/:pollId/public ──────────────────────────────────────────────
  // Ruta pública — devuelve el poll con sus sesiones y conteo de confirmados
  // No expone datos personales de los confirmados
  async getPublicPoll(req: Request, res: Response) {
    const { pollId } = req.params;

    const { data: poll, error } = await supabase
      .from('attendance_polls')
      .select(`
        id, title, poll_date, status,
        school:schools(id, name, logo_url),
        attendance_sessions(
          id, title, start_time, end_time, max_capacity, current_bookings,
          team:teams(id, name, sport)
        )
      `)
      .eq('id', pollId)
      .eq('status', 'open')
      .single();

    if (error || !poll) return err(res, 404, 'Poll no encontrado o ya cerrado');

    // Agregar conteo de confirmados por sesión sin exponer nombres
    const sessionsWithCount = await Promise.all(
      (poll.attendance_sessions as any[]).map(async (session) => {
        const { count } = await supabase
          .from('session_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('status', 'confirmed');

        return { ...session, confirmed_count: count ?? 0 };
      })
    );

    return res.json({ ...poll, attendance_sessions: sessionsWithCount });
  },

  // ── POST /polls ────────────────────────────────────────────────────────────
  // Crea el poll y sus sesiones en una sola operación
  async createPoll(req: Request, res: Response) {
    const schoolId = req.schoolId;
    const userId   = req.user.id;
    const body     = req.body as CreatePollBody;

    if (!body.title)      return err(res, 400, 'El título es requerido');
    if (!body.poll_date)  return err(res, 400, 'La fecha es requerida');
    if (!body.sessions?.length) return err(res, 400, 'Debes incluir al menos una sesión');

    // 1. Crear el poll
    const { data: poll, error: pollError } = await supabase
      .from('attendance_polls')
      .insert({
        school_id:  schoolId,
        title:      body.title,
        poll_date:  body.poll_date,
        created_by: userId,
        status:     'open',
      })
      .select()
      .single();

    if (pollError) return err(res, 500, pollError.message);

    // 2. Crear las sesiones vinculadas al poll
    const sessionsToInsert = body.sessions.map((s) => ({
      school_id:    schoolId,
      poll_id:      poll.id,
      session_date: body.poll_date,
      title:        s.title,
      start_time:   s.start_time,
      end_time:     s.end_time,
      max_capacity: s.max_capacity ?? 20,
      is_bookable:  true,
      coach_id:     s.coach_id ?? null,
      team_id:      s.team_id  ?? null,
      created_by:   userId,
    }));

    const { data: sessions, error: sessionsError } = await supabase
      .from('attendance_sessions')
      .insert(sessionsToInsert)
      .select();

    if (sessionsError) {
      // Rollback manual del poll si fallan las sesiones
      await supabase.from('attendance_polls').delete().eq('id', poll.id);
      return err(res, 500, sessionsError.message);
    }

    return res.status(201).json({ poll, sessions });
  },

  // ── POST /polls/:pollId/confirm ────────────────────────────────────────────
  // Confirma asistencia desde el link público
  // Maneja tanto atletas registrados como invitados
  async confirmAttendance(req: Request, res: Response) {
    const { pollId }  = req.params;
    const body        = req.body as ConfirmAttendanceBody;

    if (!body.session_id) return err(res, 400, 'session_id es requerido');

    // 1. Verificar que el poll existe y está abierto
    const { data: poll } = await supabase
      .from('attendance_polls')
      .select('id, status, school_id')
      .eq('id', pollId)
      .single();

    if (!poll || poll.status !== 'open') {
      return err(res, 400, 'El poll no existe o ya fue cerrado');
    }

    // 2. Verificar que la sesión pertenece al poll
    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('id, max_capacity, current_bookings')
      .eq('id', body.session_id)
      .eq('poll_id', pollId)
      .single();

    if (!session) return err(res, 404, 'Sesión no encontrada en este poll');

    // 3. Verificar cupo disponible
    if (session.current_bookings >= (session.max_capacity ?? 20)) {
      return err(res, 409, 'Esta clase ya alcanzó su cupo máximo');
    }

    // ── Caso A: Atleta registrado ──────────────────────────────────────────
    if (body.user_id && body.enrollment_id) {

      // Verificar que el enrollment tiene plan activo
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id, status, sessions_used, offering_plan:offering_plans(max_sessions)')
        .eq('id', body.enrollment_id)
        .eq('user_id', body.user_id)
        .eq('school_id', poll.school_id)
        .single();

      if (!enrollment || enrollment.status !== 'active') {
        return err(res, 403, 'No tienes un plan activo en esta escuela');
      }

      // Verificar que no confirmó ya esta sesión
      const { count: alreadyBooked } = await supabase
        .from('session_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', body.session_id)
        .eq('user_id', body.user_id)
        .eq('status', 'confirmed');

      if (alreadyBooked && alreadyBooked > 0) {
        return err(res, 409, 'Ya confirmaste asistencia a esta clase');
      }

      const { data: booking, error: bookingError } = await supabase
        .from('session_bookings')
        .insert({
          school_id:    poll.school_id,
          session_id:   body.session_id,
          enrollment_id: body.enrollment_id,
          user_id:      body.user_id,
          status:       'confirmed',
          booking_type: 'reservation',
        })
        .select()
        .single();

      if (bookingError) return err(res, 500, bookingError.message);
      return res.status(201).json({ booking, type: 'registered' });
    }

    // ── Caso B: Invitado ───────────────────────────────────────────────────
    if (body.guest_name && body.poll_token) {

      // Verificar anti doble-voto por token
      const { data: existingGuest } = await supabase
        .from('unregistered_athletes')
        .select('id')
        .eq('poll_token', body.poll_token)
        .eq('school_id', poll.school_id)
        .single();

      // Si el invitado ya existe, verificar que no confirmó esta sesión
      if (existingGuest) {
        const { count: alreadyBooked } = await supabase
          .from('session_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', body.session_id)
          .eq('unregistered_athlete_id', existingGuest.id)
          .eq('status', 'confirmed');

        if (alreadyBooked && alreadyBooked > 0) {
          return err(res, 409, 'Ya confirmaste asistencia a esta clase');
        }

        // Crear booking para invitado existente
        const { data: booking, error: bookingError } = await supabase
          .from('session_bookings')
          .insert({
            school_id:               poll.school_id,
            session_id:              body.session_id,
            unregistered_athlete_id: existingGuest.id,
            status:                  'confirmed',
            booking_type:            'reservation',
          })
          .select()
          .single();

        if (bookingError) return err(res, 500, bookingError.message);
        return res.status(201).json({ booking, type: 'guest' });
      }

      // Invitado nuevo — crear en unregistered_athletes
      const { data: newGuest, error: guestError } = await supabase
        .from('unregistered_athletes')
        .insert({
          school_id:  poll.school_id,
          full_name:  body.guest_name,
          phone:      body.guest_phone ?? null,
          poll_token: body.poll_token,
          is_active:  true,
        })
        .select()
        .single();

      if (guestError) return err(res, 500, guestError.message);

      const { data: booking, error: bookingError } = await supabase
        .from('session_bookings')
        .insert({
          school_id:               poll.school_id,
          session_id:              body.session_id,
          unregistered_athlete_id: newGuest.id,
          status:                  'confirmed',
          booking_type:            'reservation',
        })
        .select()
        .single();

      if (bookingError) return err(res, 500, bookingError.message);
      return res.status(201).json({ booking, guest: newGuest, type: 'guest' });
    }

    return err(res, 400, 'Debes proveer datos de atleta registrado o de invitado');
  },

  // ── GET /polls/:pollId/results ─────────────────────────────────────────────
  // Resultados completos del poll para admin y coach
  // Incluye lista de confirmados por sesión con datos del atleta
  async getPollResults(req: Request, res: Response) {
    const { pollId } = req.params;
    const schoolId   = req.schoolId;

    const { data: poll, error } = await supabase
      .from('attendance_polls')
      .select(`
        id, title, poll_date, status,
        attendance_sessions(
          id, title, start_time, end_time, max_capacity, current_bookings,
          team:teams(id, name, sport),
          coach:school_staff(id, full_name),
          session_bookings(
            id, status, booked_at, booking_type,
            user:profiles(id, full_name, phone, avatar_url),
            unregistered:unregistered_athletes(id, full_name, phone),
            enrollment:enrollments(
              id, status,
              offering_plan:offering_plans(id, name, max_sessions)
            )
          )
        )
      `)
      .eq('id', pollId)
      .eq('school_id', schoolId)
      .single();

    if (error || !poll) return err(res, 404, 'Poll no encontrado');

    return res.json(poll);
  },

  // ── PATCH /polls/:pollId/close ─────────────────────────────────────────────
  // Cierra el poll — no elimina nada, solo cambia el status
  async closePoll(req: Request, res: Response) {
    const { pollId } = req.params;
    const schoolId   = req.schoolId;
    const userId     = req.user.id;

    const { data, error } = await supabase
      .from('attendance_polls')
      .update({
        status:    'closed',
        closed_at: new Date().toISOString(),
        closed_by: userId,
      })
      .eq('id', pollId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) return err(res, 500, error.message);
    if (!data)  return err(res, 404, 'Poll no encontrado');

    return res.json(data);
  },

  // ── DELETE /polls/:pollId ──────────────────────────────────────────────────
  // Elimina el poll solo si está abierto y sin confirmaciones
  async deletePoll(req: Request, res: Response) {
    const { pollId } = req.params;
    const schoolId   = req.schoolId;

    // Verificar que no tiene confirmaciones
    const { data: pollSessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('poll_id', pollId);

    const sessionIds = (pollSessions || []).map(s => s.id);

    if (sessionIds.length > 0) {
      const { count } = await supabase
        .from('session_bookings')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds);

      if (count && count > 0) {
        return err(res, 409, 'No puedes eliminar un poll que ya tiene confirmaciones. Ciérralo en su lugar.');
      }
    }

    const { error } = await supabase
      .from('attendance_polls')
      .delete()
      .eq('id', pollId)
      .eq('school_id', schoolId);

    if (error) return err(res, 500, error.message);
    return res.status(204).send();
  },

  // ── POST /polls/:pollId/sessions/:sessionId/confirmations ─────────────────
  // Admin agrega manualmente un atleta a una clase (sin poll, o editando)
  async addManualConfirmation(req: Request, res: Response) {
    const { pollId, sessionId } = req.params;
    const schoolId              = req.schoolId;
    const body                  = req.body as ManualConfirmationBody;

    // Verificar que la sesión existe y pertenece al poll
    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('id, max_capacity, current_bookings')
      .eq('id', sessionId)
      .eq('poll_id', pollId)
      .single();

    if (!session) return err(res, 404, 'Sesión no encontrada');

    if (session.current_bookings >= (session.max_capacity ?? 20)) {
      return err(res, 409, 'La clase ya alcanzó su cupo máximo');
    }

    let unregisteredId = body.unregistered_athlete_id ?? null;

    // Si es invitado nuevo sin cuenta
    if (!body.user_id && !unregisteredId && body.guest_name) {
      const { data: newGuest, error: guestError } = await supabase
        .from('unregistered_athletes')
        .insert({
          school_id: schoolId,
          full_name: body.guest_name,
          phone:     body.guest_phone ?? null,
          is_active: true,
        })
        .select()
        .single();

      if (guestError) return err(res, 500, guestError.message);
      unregisteredId = newGuest.id;
    }

    const { data: booking, error } = await supabase
      .from('session_bookings')
      .insert({
        school_id:               schoolId,
        session_id:              sessionId,
        enrollment_id:           body.enrollment_id ?? null,
        user_id:                 body.user_id ?? null,
        unregistered_athlete_id: unregisteredId,
        status:                  'confirmed',
        booking_type:            'reservation',
      })
      .select()
      .single();

    if (error) return err(res, 500, error.message);
    return res.status(201).json(booking);
  },

  // ── PATCH /polls/:pollId/sessions/:sessionId/confirmations/:bookingId ──────
  // Edita una confirmación (cambiar de sesión, corregir datos de invitado)
  async updateConfirmation(req: Request, res: Response) {
    const { bookingId } = req.params;
    const schoolId      = req.schoolId;
    const userId        = req.user.id;
    const { status, session_id } = req.body;

    const updates: Record<string, any> = {
      is_corrected:     true,
      corrected_by:     userId,
      corrected_at:     new Date().toISOString(),
      correction_reason: req.body.correction_reason ?? 'Corrección manual por admin',
    };

    if (status)     updates.status     = status;
    if (session_id) updates.session_id = session_id;

    const { data, error } = await supabase
      .from('session_bookings')
      .update(updates)
      .eq('id', bookingId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) return err(res, 500, error.message);
    if (!data)  return err(res, 404, 'Confirmación no encontrada');

    return res.json(data);
  },

  // ── DELETE /polls/:pollId/sessions/:sessionId/confirmations/:bookingId ─────
  // Elimina una confirmación (admin o coach)
  async deleteConfirmation(req: Request, res: Response) {
    const { bookingId } = req.params;
    const schoolId      = req.schoolId;

    const { error } = await supabase
      .from('session_bookings')
      .delete()
      .eq('id', bookingId)
      .eq('school_id', schoolId);

    if (error) return err(res, 500, error.message);
    return res.status(204).send();
  },
};
