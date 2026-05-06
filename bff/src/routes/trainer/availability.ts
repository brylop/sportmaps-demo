import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// GET /api/v1/trainer/availability/schedule
// Retorna agenda del día: slots disponibles + sesiones agendadas combinadas
router.get('/availability/schedule', async (req: Request, res: Response) => {
  try {
    const trainerId = req.user.id;
    const schoolId  = req.schoolId;
    const date      = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // Día de semana ISO (1=Lun ... 7=Dom) desde la fecha solicitada
    const dateObj    = new Date(date + 'T12:00:00');
    const dayOfWeek  = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // JS: 0=Dom → ISO: 7

    // ── 1. Slots disponibles del PT para ese día ──────────────────────
    const { data: staffRow } = await supabase
      .from('school_staff')
      .select('id')
      .eq('coach_auth_id', trainerId)
      .eq('school_id', schoolId)
      .maybeSingle();

    const staffId = staffRow?.id ?? null;

    const { data: availSlots } = await supabase
      .from('coach_availability')
      .select('id, start_time, end_time, available_for_personal_classes, available_for_group_classes')
      .eq('coach_id', staffId ?? trainerId)
      .eq('school_id', schoolId)
      .eq('day_of_week', dayOfWeek)
      .order('start_time');

    // ── 2. Sesiones ya agendadas para ese día ─────────────────────────
    const { data: sessions, error } = await supabase
      .from('trainer_session_plans')
      .select('id, name, status, session_date, session_time, client_id, client_type, enrollment_id, booked_by, booked_at, custom_notes')
      .eq('trainer_id', trainerId)
      .eq('session_date', date)
      .neq('status', 'cancelled')
      .order('session_time', { ascending: true });

    if (error) throw error;

    // Enriquecer sesiones con datos del cliente
    let enrichedSessions: any[] = [];
    if (sessions && sessions.length > 0) {
      const clientIds = sessions.map(s => s.client_id).filter(Boolean);
      const [profilesRes, childrenRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', clientIds),
        supabase.from('children').select('id, full_name, avatar_url').in('id', clientIds),
      ]);
      const clientMap = new Map();
      (profilesRes.data ?? []).forEach(p => clientMap.set(p.id, p));
      (childrenRes.data ?? []).forEach(c => clientMap.set(c.id, c));

      enrichedSessions = sessions.map(s => ({
        ...s,
        _type: 'session',
        client: clientMap.get(s.client_id) ?? { full_name: 'Cliente' },
      }));
    }

    // ── 3. Combinar: slots disponibles marcando cuáles están ocupados ──
    const bookedTimes = new Set(enrichedSessions.map(s => s.session_time?.substring(0, 5)));

    const availWithStatus = (availSlots ?? []).map(slot => {
      const slotTime = slot.start_time?.substring(0, 5);
      const booked   = enrichedSessions.find(s => s.session_time?.substring(0, 5) === slotTime);
      return {
        _type:        'availability_slot',
        availability_id: slot.id,
        start_time:   slot.start_time,
        end_time:     slot.end_time,
        available_for_personal_classes: slot.available_for_personal_classes,
        available_for_group_classes:    slot.available_for_group_classes,
        is_booked:    !!booked,
        session:      booked ?? null, // sesión que ocupa este slot si aplica
      };
    });

    // ── 4. Sesiones sin slot de disponibilidad (creadas manualmente) ──
    const manualSessions = enrichedSessions.filter(
      s => !bookedTimes.has(s.session_time?.substring(0, 5)) || !(availSlots?.length)
    );

    res.json({
      date,
      day_of_week:        dayOfWeek,
      availability_slots: availWithStatus,   // horario configurado + si está ocupado
      sessions:           enrichedSessions,  // todas las sesiones del día
      manual_sessions:    manualSessions,    // sesiones fuera del horario configurado
      has_availability:   (availSlots?.length ?? 0) > 0,
      has_sessions:       enrichedSessions.length > 0,
    });

  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error fetching trainer schedule');
    res.status(500).json({ error: 'Error al obtener la agenda del entrenador.' });
  }
});

// ==========================================
// PATCH /api/v1/trainer/availability/session/:id/attendance
// ==========================================
router.patch('/availability/session/:id/attendance', async (req: Request, res: Response) => {
  try {
    const trainerId = req.user.id;
    const sessionId = req.params.id;
    const { status } = req.body;

    if (!['completed', 'assigned'].includes(status)) {
      return res.status(400).json({ error: 'Estado de asistencia inválido. Use "completed" o "assigned".' });
    }

    // Actualizar estado en trainer_session_plans
    const { data, error } = await supabase
      .from('trainer_session_plans')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('trainer_id', trainerId) // Validar que pertenece al PT
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Sesión no encontrada o no pertenece al entrenador.' });
    }

    res.json({ success: true, session: data });

  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error updating session attendance');
    res.status(500).json({ error: 'Error al actualizar la asistencia.' });
  }
});

// ==========================================
// POST /api/v1/trainer/availability
// ==========================================
router.post('/availability', async (req: Request, res: Response) => {
  try {
    const { schoolId, user } = req;

    // Obtener staff_id del trainer
    const { data: staff } = await supabase
      .from('school_staff')
      .select('id')
      .eq('coach_auth_id', user.id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!staff) return res.status(404).json({ error: 'Perfil de coach no encontrado.' });

    const { day_of_week, start_time, end_time,
            available_for_group_classes, available_for_personal_classes,
            max_group_capacity } = req.body;

    const { data, error } = await supabase
      .from('coach_availability')
      .upsert({
        school_id: schoolId,
        coach_id:  staff.id,
        day_of_week, start_time, end_time,
        available_for_group_classes,
        available_for_personal_classes,
        max_group_capacity: max_group_capacity ?? null,
      }, { onConflict: 'coach_id,day_of_week,start_time,end_time' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error saving trainer availability');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DELETE /api/v1/trainer/availability/:id
// ==========================================
router.delete('/availability/:id', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { error } = await supabase
      .from('coach_availability')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error deleting trainer availability');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PATCH /api/v1/trainer/availability/session/:id/no-show
// ==========================================
router.patch('/availability/session/:id/no-show', async (req: Request, res: Response) => {
  try {
    const trainerId = req.user.id;
    const sessionId = req.params.id;
    const { action } = req.body as { action: 'return_credit' | 'deduct' };

    if (!['return_credit', 'deduct'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Use "return_credit" o "deduct".' });
    }

    // Verificar que la sesión existe y pertenece al trainer
    const { data: session, error: fetchErr } = await supabase
      .from('trainer_session_plans')
      .select('id, status, trainer_id, enrollment_id')
      .eq('id', sessionId)
      .eq('trainer_id', trainerId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada o no pertenece al entrenador.' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'No se puede marcar inasistencia en una sesión ya completada.' });
    }

    if (action === 'return_credit') {
      // Reutilizar RPC existente: cancela + devuelve sessions_used con GREATEST(0, ...)
      const { data, error } = await supabase
        .rpc('fn_cancel_pt_session', {
          p_plan_id:   sessionId,
          p_caller_id: trainerId,
        });

      if (error) throw error;
      if (!data?.success) {
        return res.status(400).json({ error: data?.error ?? 'Error al cancelar la sesión.' });
      }

    } else {
      // deduct: solo marcar no_show — el crédito ya fue descontado al agendar (fn_book_pt_session)
      const { error } = await supabase
        .from('trainer_session_plans')
        .update({ status: 'no_show', updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('trainer_id', trainerId);

      if (error) throw error;
    }

    res.json({ success: true, action });

  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error handling PT no-show');
    res.status(500).json({ error: 'Error al procesar la inasistencia.' });
  }
});

export default router;
