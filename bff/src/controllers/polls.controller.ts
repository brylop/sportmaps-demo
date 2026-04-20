import { Request, Response } from 'express';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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
    offering_id?: string;
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
  poll_token?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

export const pollsController = {
  /**
   * Listar todos los polls de la escuela
   */
  listPolls: async (req: Request, res: Response) => {
    try {
      const schoolId = req.headers['x-school-id'] as string;
      const { status, date } = req.query;

      if (!schoolId) {
        return res.status(400).json({ error: 'Falta x-school-id en headers' });
      }

      let query = supabase
        .from('attendance_polls')
        .select(`
          *,
          attendance_sessions (
            *,
            team:teams!team_id(id, name, sport),
            coach:school_staff!coach_id(id, full_name)
          )
        `)
        .eq('school_id', schoolId)
        .order('poll_date', { ascending: false });

      if (status) query = query.eq('status', status);
      if (date) query = query.eq('poll_date', date);

      const { data, error } = await query;

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('[listPolls] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Crear un nuevo poll con sus sesiones
   */
  createPoll: async (req: Request, res: Response) => {
    try {
      const schoolId = req.headers['x-school-id'] as string;
      const createdBy = (req as any).user?.id;
      const { title, poll_date, sessions }: CreatePollBody = req.body;

      // Cliente con JWT para respetar RLS
      const token = req.headers.authorization?.replace('Bearer ', '');
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });

      if (!schoolId || !title || !poll_date || !sessions?.length) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }

      // 1. Crear el poll
      const { data: poll, error: pollErr } = await userClient
        .from('attendance_polls')
        .insert({
          title,
          poll_date,
          school_id: schoolId,
          created_by: createdBy,
          status: 'open'
        })
        .select()
        .single();

      if (pollErr) {
        console.error('[createPoll] pollErr:', pollErr);
        throw pollErr;
      }

      // 2. Crear las sesiones asociadas con campos requeridos por RLS / NOT NULL
      const sessionsToInsert = sessions.map(s => ({
        poll_id: poll.id,
        school_id: schoolId,
        session_date: poll_date,
        title: s.title,
        start_time: s.start_time,
        end_time: s.end_time,
        max_capacity: s.max_capacity || 20,
        coach_id: s.coach_id || null,
        team_id: s.team_id || null,
        offering_id: s.offering_id || null,
        is_bookable: true,
      }));

      const { data: createdSessions, error: sessErr } = await userClient
        .from('attendance_sessions')
        .insert(sessionsToInsert)
        .select();

      if (sessErr) {
        console.error('[createPoll] sessErr:', sessErr);
        throw sessErr;
      }

      return res.status(201).json({ poll, sessions: createdSessions });
    } catch (error: any) {
      console.error('[createPoll] Error:', error.message, error.details);
      return res.status(500).json({ error: error.message, details: error.details });
    }
  },

  /**
   * Obtener datos públicos de un poll
   */
  getPublicPoll: async (req: Request, res: Response) => {
    try {
      const { pollId } = req.params;

      const { data, error } = await supabase
        .from('attendance_polls')
        .select(`
          id, title, poll_date, status,
          school:schools(id, name, logo_url),
          attendance_sessions (
            id, title, start_time, end_time, max_capacity,
            current_bookings:session_bookings(count),
            team:teams!team_id(id, name, sport),
            coach:school_staff!coach_id(id, full_name)
          )
        `)
        .eq('id', pollId)
        .eq('status', 'open')
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Poll no encontrado o cerrado' });
      }

      const sessions = (data.attendance_sessions as any[]).map(s => ({
        ...s,
        current_bookings: s.current_bookings?.[0]?.count || 0
      }));

      return res.status(200).json({ ...data, attendance_sessions: sessions });
    } catch (error: any) {
      console.error('[getPublicPoll] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Confirmar asistencia (Público o Autenticado)
   */
  confirmAttendance: async (req: Request, res: Response) => {
    try {
      const { session_id, user_id, enrollment_id, guest_name, guest_phone, poll_token }: ConfirmAttendanceBody = req.body;

      if (!session_id || (!user_id && !guest_name)) {
        return res.status(400).json({ error: 'Datos insuficientes para confirmar' });
      }

      // Cliente Supabase. Si es público, usamos el global (service_role para saltar RLS de inserción de invitados si es necesario, 
      // o preferiblemente el anon si las políticas están abiertas). 
      // Dado que el usuario pidió usar JWT, si hay token lo usamos.
      const token = req.headers.authorization?.replace('Bearer ', '');
      const client = token 
        ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
        : supabase; // fallback a service_role si es público y no hay token

      // 1. Verificar capacidad y obtener school_id
      const { data: session, error: sessErr } = await supabase
        .from('attendance_sessions')
        .select('max_capacity, poll_id, school_id')
        .eq('id', session_id)
        .single();

      if (sessErr || !session) throw new Error('Sesión no válida');

      const { count } = await supabase
        .from('session_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session_id)
        .eq('status', 'confirmed');

      if ((count || 0) >= session.max_capacity) {
        return res.status(409).json({ error: 'Sesión llena' });
      }

      // 2. Registrar Invitado si no viene user_id
      let finalUserId = user_id;
      let finalUnregisteredId = null;

      if (!user_id && guest_name) {
        const { data: guest, error: guestErr } = await supabase
          .from('unregistered_athletes')
          .insert({
            full_name: guest_name,
            phone: guest_phone,
            school_id: session.school_id, // ✅ Fix: school_id requerido
            poll_token: poll_token || uuidv4()
          })
          .select()
          .single();
        
        if (guestErr) {
          console.error('[confirmAttendance] guestErr:', guestErr);
          throw guestErr;
        }
        finalUnregisteredId = guest.id;
      }

      // 3. Crear el booking — solo incluir campos con valor real
      const bookingData: Record<string, any> = {
        school_id: session.school_id,
        session_id,
        status: 'confirmed',
        booking_type: 'reservation',
      };

      if (finalUserId) bookingData.user_id = finalUserId;
      if (finalUnregisteredId) bookingData.unregistered_athlete_id = finalUnregisteredId;
      if (enrollment_id) bookingData.enrollment_id = enrollment_id;

      console.log('[confirmAttendance] Inserting booking:', JSON.stringify(bookingData));

      const { data: booking, error: bookErr } = await client
        .from('session_bookings')
        .insert(bookingData)
        .select()
        .single();

      if (bookErr) {
        console.error('[confirmAttendance] bookErr:', bookErr);
        throw bookErr;
      }

      return res.status(201).json(booking);
    } catch (error: any) {
      console.error('[confirmAttendance] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Ver resultados (Solo Admin/Coach)
   */
  getPollResults: async (req: Request, res: Response) => {
    try {
      const { pollId } = req.params;

      const { data, error } = await supabase
        .from('attendance_polls')
        .select(`
          *,
          attendance_sessions (
            *,
            team:teams!team_id(id, name, sport),
            coach:school_staff!coach_id(id, full_name),
            session_bookings (
              *,
              user:profiles(id, full_name, avatar_url),
              enrollment:enrollments(id, status, offering_plan:offering_plans(id, name))
            )
          )
        `)
        .eq('id', pollId)
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('[getPollResults] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Cerrar poll
   */
  closePoll: async (req: Request, res: Response) => {
    try {
      const { pollId } = req.params;
      const { data, error } = await supabase
        .from('attendance_polls')
        .update({ status: 'closed' })
        .eq('id', pollId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Eliminar poll
   */
  deletePoll: async (req: Request, res: Response) => {
    try {
      const { pollId } = req.params;
      
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('poll_id', pollId);
      
      const sessionIds = sessions?.map(s => s.id) || [];

      if (sessionIds.length > 0) {
        const { count } = await supabase
          .from('session_bookings')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds);

        if (count && count > 0) {
          return res.status(400).json({ error: 'No se puede eliminar un poll con asistencias registradas' });
        }
      }

      const { error } = await supabase.from('attendance_polls').delete().eq('id', pollId);
      if (error) throw error;

      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Registro manual de asistencia (Admin/Coach)
   */
  addManualConfirmation: async (req: Request, res: Response) => {
    try {
      const { session_id, user_id, guest_name, guest_phone } = req.body;
      const schoolId = req.headers['x-school-id'] as string;

      if (!session_id || (!user_id && !guest_name)) {
        return res.status(400).json({ error: 'Datos insuficientes' });
      }

      let finalUserId = user_id;
      let finalUnregisteredId = null;

      if (!user_id && guest_name) {
        const { data: guest, error: guestErr } = await supabase
          .from('unregistered_athletes')
          .insert({
            full_name: guest_name,
            phone: guest_phone,
            school_id: schoolId,
            poll_token: 'manual-' + uuidv4()
          })
          .select()
          .single();
        
        if (guestErr) throw guestErr;
        finalUnregisteredId = guest.id;
      }

      const { data, error } = await supabase
        .from('session_bookings')
        .insert({
          school_id: schoolId,
          session_id,
          user_id: finalUserId,
          unregistered_athlete_id: finalUnregisteredId,
          status: 'confirmed',
          booking_type: 'reservation'
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Actualizar estado de asistencia
   */
  updateConfirmation: async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .from('session_bookings')
        .update({ status })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * Eliminar asistencia
   */
  deleteConfirmation: async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const { error } = await supabase.from('session_bookings').delete().eq('id', bookingId);
      if (error) throw error;

      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
};
