import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { todayInZone } from '../../utils/businessDate';

const router = Router();

// ── Helper: insertar notificación directamente (service role bypasea RLS) ──────
async function insertNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string,
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    link: link ?? null,
  });
}

async function notifySessionClient(
  sessionId: string,
  title: string,
  message: string,
  type: string,
): Promise<void> {
  const { data: plan } = await supabase
    .from('trainer_session_plans')
    .select('client_id, client_type, enrollment_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!plan) return;

  let recipientId: string | null = null;
  if (plan.client_type === 'child') {
    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', plan.client_id).maybeSingle();
    recipientId = child?.parent_id ?? null;
  } else {
    recipientId = plan.client_id;
  }

  if (!recipientId) return;
  await insertNotification(recipientId, title, message, type, '/athlete-payments');
}

// GET /api/v1/trainer/availability/schedule
// Retorna agenda del día: slots disponibles + sesiones agendadas combinadas
router.get('/availability/schedule', async (req: Request, res: Response) => {
  try {
    const trainerId = req.user.id;
    const schoolId  = req.schoolId;
    const date      = (req.query.date as string) || todayInZone();

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
      return res.status(400).json({ error: 'Estado inválido. Use "completed" o "assigned".' });
    }

    if (status === 'completed') {
      // Llamar fn_complete_session_plan para garantizar:
      // - stats en athlete_stats / children_stats
      // - sessions_used++ si fue sesión manual (booked_by IS NULL)
      // - status='completed' en trainer_session_plans
      const { data, error } = await supabase.rpc('fn_complete_session_plan', {
        p_plan_id:    sessionId,
        p_trainer_id: trainerId,
        p_results:    {},
      });

      if (error) throw error;
      if (!data?.success) {
        return res.status(400).json({ error: data?.error ?? 'No se pudo completar la sesión.' });
      }

      // ✅ Notificar al cliente que su sesión fue completada
      supabase.from('trainer_session_plans')
        .select('session_date')
        .eq('id', sessionId)
        .maybeSingle()
        .then(({ data: s }) => {
          notifySessionClient(
            sessionId as string,
            '✅ Sesión completada',
            `Tu entrenador marcó tu sesión del ${s?.session_date ?? 'día'} como completada. ¡Buen trabajo!`,
            'success',
          ).catch(() => {});
        });

      return res.json({ success: true });

    } else {
      // status='assigned' → desmarcar, UPDATE directo está bien
      const { data, error } = await supabase
        .from('trainer_session_plans')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('trainer_id', trainerId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Sesión no encontrada.' });
      return res.json({ success: true, session: data });
    }

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
      .select('id, status, trainer_id, enrollment_id, session_date')
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

    // ✅ Notificar al cliente según la acción
    const sessionDate = (session as any).session_date ?? 'día';
    if (action === 'return_credit') {
      notifySessionClient(
        sessionId as string,
        '📋 Sesión cancelada — crédito devuelto',
        `No asististe a tu sesión del ${sessionDate}. Se devolvió el crédito a tu plan.`,
        'info',
      ).catch(() => {});
    } else {
      notifySessionClient(
        sessionId as string,
        '⚠️ Inasistencia registrada',
        `Tu entrenador registró inasistencia en la sesión del ${sessionDate}. El crédito fue descontado.`,
        'warning',
      ).catch(() => {});
    }

    res.json({ success: true, action });

  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error handling PT no-show');
    res.status(500).json({ error: 'Error al procesar la inasistencia.' });
  }
});

// ==========================================
// DELETE /api/v1/trainer/availability/session/:id
// PT cancela una sesión — siempre devuelve crédito
// ==========================================
router.delete('/availability/session/:id', async (req: Request, res: Response) => {
  try {
    const trainerId = req.user.id;
    const sessionId = req.params.id;

    const { data: session, error: fetchErr } = await supabase
      .from('trainer_session_plans')
      .select('id, status, trainer_id, client_id, client_type, session_date, session_time')
      .eq('id', sessionId)
      .eq('trainer_id', trainerId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });
    if (session.status === 'completed') return res.status(400).json({ error: 'No se puede cancelar una sesión completada.' });

    // Siempre devuelve crédito al atleta
    const { data, error } = await supabase.rpc('fn_cancel_pt_session', {
      p_plan_id:   sessionId,
      p_caller_id: trainerId,
    });

    if (error) throw error;

    // Guardar metadata de cancelación
    await supabase
      .from('trainer_session_plans')
      .update({
        cancelled_by:        trainerId,
        cancelled_at:        new Date().toISOString(),
        cancelled_by_role:   'trainer',
        cancellation_reason: 'trainer_cancelled',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Notificar al atleta/padre — mensaje especial
    await notifySessionClient(
      sessionId as string,
      '🚫 Sesión cancelada por tu entrenador',
      `Tu sesión del ${session.session_date}${session.session_time ? ` a las ${session.session_time.substring(0, 5)}` : ''} fue cancelada por tu entrenador. El crédito fue devuelto a tu plan automáticamente.`,
      'warning',
    ).catch(() => {});

    res.json({ success: true });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error cancelling PT session');
    res.status(500).json({ error: 'Error al cancelar la sesión.' });
  }
});

export default router;
