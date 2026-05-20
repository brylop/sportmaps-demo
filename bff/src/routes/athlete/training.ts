import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { hydrateBlocksWithLocalTranslations } from '../trainer/wger';

const router = Router();

// GET /api/v1/athlete/training/today
router.get('/training/today', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const [sessionsRes, logsRes] = await Promise.all([
      supabase
        .from('trainer_session_plans')
        .select('id, name, status, session_date, custom_notes, blocks, trainer_id, school_id')
        .eq('client_id', athleteId)
        .eq('session_date', today)
        .or(`visible_from.is.null,visible_from.lte.${today}`)
        .order('created_at'),

      supabase
        .from('training_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .eq('training_date', today)
        .order('created_at'),
    ]);

    if (sessionsRes.error) throw sessionsRes.error;
    if (logsRes.error)     throw logsRes.error;

    const sessions = sessionsRes.data ?? [];

    // Resolver trainer_profiles en paralelo si hay sesiones
    let sessionsWithTrainer = sessions;
    if (sessions.length > 0) {
      const trainerIds = [...new Set(sessions.map((s: any) => s.trainer_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('trainer_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', trainerIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      sessionsWithTrainer = sessions.map((s: any) => ({
        ...s,
        blocks: hydrateBlocksWithLocalTranslations(s.blocks),
        trainer_profiles: profileMap.get(s.trainer_id) ?? null,
      }));
    } else {
      sessionsWithTrainer = sessions.map((s: any) => ({
        ...s,
        blocks: hydrateBlocksWithLocalTranslations(s.blocks)
      }));
    }

    res.json({
      date:          today,
      pt_sessions:   sessionsWithTrainer,
      free_activity: logsRes.data ?? [],
    });
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/v1/athlete/training/history
router.get('/training/history', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const limit     = parseInt((req.query.limit as string) ?? '20', 10);
    const from_date = req.query.from_date as string | undefined;
    const to_date   = req.query.to_date   as string | undefined;

    let sessionsQuery = supabase
      .from('trainer_session_plans')
      .select('id, name, status, session_date, completed_at, blocks, results, trainer_id, school_id')
      .eq('client_id', athleteId)
      .in('status', ['completed', 'assigned']);

    let logsQuery = supabase
      .from('training_logs')
      .select('id, exercise_type, training_date, duration_minutes, intensity, calories_burned, notes')
      .eq('athlete_id', athleteId);

    if (from_date) {
      sessionsQuery = sessionsQuery.gte('session_date', from_date);
      logsQuery     = logsQuery.gte('training_date', from_date);
    }
    if (to_date) {
      sessionsQuery = sessionsQuery.lte('session_date', to_date);
      logsQuery     = logsQuery.lte('training_date', to_date);
    }

    const [sessionsRes, logsRes] = await Promise.all([
      sessionsQuery.order('session_date', { ascending: false }).limit(limit),
      logsQuery.order('training_date',    { ascending: false }).limit(limit),
    ]);

    if (sessionsRes.error) throw sessionsRes.error;
    if (logsRes.error)     throw logsRes.error;

    // ✅ Resolver trainer_profiles y hydrate blocks para las sesiones del historial
    let sessions = sessionsRes.data ?? [];
    
    sessions = sessions.map((s: any) => ({
      ...s,
      blocks: hydrateBlocksWithLocalTranslations(s.blocks)
    }));

    if (sessions.length > 0) {
      const trainerIds = [...new Set(sessions.map((s: any) => s.trainer_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('trainer_profiles')
        .select('user_id, display_name')
        .in('user_id', trainerIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      sessions = sessions.map((s: any) => ({
        ...s,
        trainer_name: profileMap.get(s.trainer_id) ?? 'Entrenador',
      }));
    }

    const merged = [
      ...(sessions).map((s: any) => ({ ...s, _type: 'pt_session',    _date: s.session_date })),
      ...(logsRes.data    ?? []).map((l: any) => ({ ...l, _type: 'free_activity',  _date: l.training_date })),
    ]
      .sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime())
      .slice(0, limit);

    res.json(merged);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/v1/athlete/training/log
router.post('/training/log', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const { training_date, exercise_type, duration_minutes, intensity, calories_burned, notes } = req.body;

    if (!training_date || !exercise_type) {
      return res.status(400).json({ error: 'training_date y exercise_type son requeridos.' });
    }

    const { data, error } = await supabase
      .from('training_logs')
      .insert({
        athlete_id:       athleteId,
        training_date,
        exercise_type,
        duration_minutes: duration_minutes ?? null,
        intensity:        intensity        ?? null,
        calories_burned:  calories_burned  ?? null,
        notes:            notes            ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/v1/athlete/training/log/:logId
router.put('/training/log/:logId', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const { logId } = req.params;
    const allowed   = ['exercise_type','duration_minutes','intensity','calories_burned','notes','training_date'];
    const updates: Record<string, any> = {};
    for (const f of allowed) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const { data, error } = await supabase
      .from('training_logs')
      .update(updates)
      .eq('id', logId)
      .eq('athlete_id', athleteId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/v1/athlete/training/log/:logId
router.delete('/training/log/:logId', async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const athleteId = req.user.id;

    const { error } = await supabase
      .from('training_logs')
      .delete()
      .eq('id', logId)
      .eq('athlete_id', athleteId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/v1/athlete/training/session/:planId/exercise-results
router.post('/training/session/:planId/exercise-results', async (req: Request, res: Response) => {
  try {
    const athleteId  = req.user.id;
    const { planId } = req.params;
    const { results } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'results debe ser un array no vacío.' });
    }

    const { data: plan } = await supabase
      .from('trainer_session_plans')
      .select('id, status')
      .eq('id', planId)
      .eq('client_id', athleteId)
      .maybeSingle();

    if (!plan)                       return res.status(404).json({ error: 'Sesión no encontrada o no autorizada.' });
    if (plan.status === 'completed') return res.status(400).json({ error: 'No se puede editar una sesión ya completada.' });

    const rows = results.map((r: any) => ({
      session_plan_id:  planId,
      exercise_key:     r.exercise_key,
      exercise_name:    r.exercise_name,
      set_number:       r.set_number,
      reps_completed:   r.reps_completed   ?? null,
      weight_kg:        r.weight_kg        ?? null,
      duration_seconds: r.duration_seconds ?? null,
      distance_m:       r.distance_m       ?? null,
      rpe:              r.rpe              ?? null,
      notes:            r.notes            ?? null,
      recorded_by:      athleteId,
    }));

    const { data, error } = await supabase
      .from('session_exercise_results')
      .insert(rows)
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/v1/athlete/training/session/:planId/complete
router.post('/training/session/:planId/complete', async (req: Request, res: Response) => {
  try {
    const athleteId  = req.user.id;
    const { planId } = req.params;
    const { results } = req.body;

    if (!results) return res.status(400).json({ error: 'results es requerido.' });

    const { data: plan } = await supabase
      .from('trainer_session_plans')
      .select('id, trainer_id, status')
      .eq('id', planId)
      .eq('client_id', athleteId)
      .maybeSingle();

    if (!plan)                       return res.status(404).json({ error: 'Sesión no encontrada o no autorizada.' });
    if (plan.status === 'completed') return res.status(400).json({ error: 'La sesión ya fue completada.' });

    const { data, error } = await supabase.rpc('fn_complete_session_plan', {
      p_plan_id:    planId,
      p_results:    results,
      p_trainer_id: plan.trainer_id,
    });

    if (error) throw error;
    res.json(data);
    
    // ✅ Notificar al PT que el atleta completó/registró la sesión
    try {
      await supabase.from('notifications').insert({
        user_id: plan.trainer_id,
        title:   '💪 Sesión registrada por el atleta',
        message: `Un atleta registró los resultados de su sesión. Revisa el historial en Mis Clientes.`,
        type:    'info',
        link:    '/trainer/clients',
      });
    } catch (_) { /* fire and forget */ }

  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/v1/athlete/training/plan
router.get('/training/plan', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;

    const { data, error } = await supabase
      .from('athlete_training_plans')
      .select('*')
      .eq('client_id', athleteId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.json(data ?? null);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/v1/athlete/training/body-metrics
router.get('/training/body-metrics', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const limit     = parseInt((req.query.limit as string) ?? '30', 10);

    const { data, error } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('client_id', athleteId)
      .order('measured_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/v1/athlete/training/body-metrics
router.post('/training/body-metrics', async (req: Request, res: Response) => {
  try {
    const athleteId = req.user.id;
    const {
      measured_at, weight_kg, height_cm, body_fat_pct,
      muscle_mass_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, back_cm, notes,
    } = req.body;

    if (!measured_at) return res.status(400).json({ error: 'measured_at es requerido.' });

    const { data, error } = await supabase
      .from('body_metrics')
      .insert({
        client_id:      athleteId,
        client_type:    'registered',
        recorded_by:    athleteId,
        source:         'self',
        school_id:      null,
        measured_at,
        weight_kg,      height_cm,    body_fat_pct,
        muscle_mass_kg, waist_cm,     hip_cm,
        chest_cm,       arm_cm,       thigh_cm,
        back_cm,
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/v1/athlete/training/book-session [Ruta legacy descontinuada en favor de /training/book-pt-session]

// ==========================================
// GET /api/v1/athlete/training/pt-availability
// ==========================================
router.get('/training/pt-availability', async (req: Request, res: Response) => {
  try {
    const callerId     = req.user.id;
    const enrollmentId = req.query.enrollment_id as string;
    const date         = req.query.date as string;

    if (!enrollmentId) {
      return res.status(400).json({ error: 'enrollment_id es requerido.' });
    }

    // Obtener enrollment
    const { data: enrollment, error: enrErr } = await supabase
      .from('enrollments')
      .select('id, school_id, child_id, user_id, sessions_used, offering_plan_id')
      .eq('id', enrollmentId)
      .eq('status', 'active')
      .maybeSingle();

    if (enrErr || !enrollment) {
      return res.status(404).json({ error: 'Enrollment no encontrado.' });
    }

    // Validar acceso: es el atleta o el padre del hijo
    const isOwner = enrollment.user_id === callerId;
    let isParent  = false;
    if (!isOwner && enrollment.child_id) {
      const { data: child } = await supabase
        .from('children')
        .select('id')
        .eq('id', enrollment.child_id)
        .eq('parent_id', callerId)
        .maybeSingle();
      isParent = !!child;
    }
    if (!isOwner && !isParent) {
      return res.status(403).json({ error: 'Sin permisos.' });
    }

    // Max sessions del plan
    const { data: plan } = await supabase
      .from('offering_plans')
      .select('max_sessions')
      .eq('id', enrollment.offering_plan_id)
      .maybeSingle();

    const sessionsLeft = plan?.max_sessions != null
      ? Math.max(0, plan.max_sessions - (enrollment.sessions_used ?? 0))
      : null;

    // Trainer de la escuela PT
    const { data: school } = await supabase
      .from('schools')
      .select('owner_id')
      .eq('id', enrollment.school_id)
      .eq('school_type', 'personal_trainer')
      .maybeSingle();

    if (!school) {
      return res.status(404).json({ error: 'Escuela PT no encontrada.' });
    }

    // Fetch trainer profile separately to be safe
    const { data: trainerProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', school.owner_id)
      .maybeSingle();

    // Staff ID del trainer
    const { data: staffRow } = await supabase
      .from('school_staff')
      .select('id')
      .eq('coach_auth_id', school.owner_id)
      .eq('school_id', enrollment.school_id)
      .maybeSingle();

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const startDateStr = date || today;
    const daysToFetch = date ? 1 : 14;

    // Obtener días de la semana con disponibilidad configurada
    const { data: availabilityRows } = await supabase
      .from('coach_availability')
      .select('id, day_of_week, start_time, end_time, available_for_personal_classes, available_for_group_classes, max_group_capacity')
      .eq('coach_id', staffRow?.id ?? school.owner_id)
      .eq('school_id', enrollment.school_id)
      .or('available_for_personal_classes.eq.true,available_for_group_classes.eq.true')
      .order('start_time');

    const availableDaysSet = new Set((availabilityRows || []).map(d => d.day_of_week));
    const available_days = Array.from(availableDaysSet).sort();

    // Sesiones ya agendadas en el rango (hoy -> +13 días o solo la fecha pedida)
    const clientId = enrollment.child_id ?? enrollment.user_id;
    const endDateObj = new Date(startDateStr + 'T12:00:00');
    if (!date) endDateObj.setDate(endDateObj.getDate() + 13);
    const endDateStr = endDateObj.toISOString().split('T')[0];

    const { data: booked } = await supabase
      .from('trainer_session_plans')
      .select('id, session_date, session_time, status, client_id, session_type')
      .eq('trainer_id', school.owner_id)
      .gte('session_date', startDateStr)
      .lte('session_date', endDateStr)
      .neq('status', 'cancelled');

    // Agrupar reservas por "fecha_hora": { 'YYYY-MM-DD_HH:MM' -> [bookings] }
    const bookedByDateTime = new Map<string, typeof booked>();
    for (const b of (booked ?? [])) {
      const t = b.session_time?.substring(0, 5);
      if (!t || !b.session_date) continue;
      const key = `${b.session_date}_${t}`;
      if (!bookedByDateTime.has(key)) bookedByDateTime.set(key, []);
      bookedByDateTime.get(key)!.push(b);
    }

    const allEnrichedSlots = [];
    const baseDateObj = new Date(startDateStr + 'T12:00:00');

    for (let i = 0; i < daysToFetch; i++) {
      const currentLoopDate = new Date(baseDateObj);
      currentLoopDate.setDate(baseDateObj.getDate() + i);
      const loopDateStr = currentLoopDate.toISOString().split('T')[0];
      const loopDayOfWeek = currentLoopDate.getDay();

      const slotsForDay = (availabilityRows || []).filter(s => s.day_of_week === loopDayOfWeek);

      for (const slot of slotsForDay) {
        const slotTime = slot.start_time?.substring(0, 5);
        const dateTimeKey = `${loopDateStr}_${slotTime}`;
        const slotBookings = bookedByDateTime.get(dateTimeKey) ?? [];
        const myBooking = slotBookings.find(b => b.client_id === clientId);

        // ✅ Regla: mínimo 6h de anticipación (hora Colombia UTC-5)
        const slotDateTimeCO = new Date(`${loopDateStr}T${slot.start_time.substring(0, 8)}`);
        const slotUTC = new Date(slotDateTimeCO.getTime() + 5 * 60 * 60 * 1000);
        const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
        if (slotUTC < sixHoursFromNow) continue;

        let is_booked: boolean;
        if (slot.available_for_group_classes && !slot.available_for_personal_classes) {
          const activeCount = slotBookings.filter(b => b.session_type === 'group').length;
          is_booked = !myBooking && activeCount >= (slot.max_group_capacity ?? 1);
        } else {
          is_booked = slotBookings.length > 0 && !myBooking;
        }

        allEnrichedSlots.push({
          availability_id: slot.id,
          session_date: loopDateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          available_for_personal_classes: slot.available_for_personal_classes,
          available_for_group_classes: slot.available_for_group_classes,
          max_group_capacity: slot.max_group_capacity ?? null,
          current_group_bookings: slot.available_for_group_classes
            ? slotBookings.filter(b => b.session_type === 'group').length
            : undefined,
          is_booked,
          is_my_booking: !!myBooking,
          session_id: myBooking?.id ?? null,
          coach: {
            full_name: trainerProfile?.full_name || 'Entrenador',
            avatar_url: trainerProfile?.avatar_url
          }
        });
      }
    }

    res.json({
      date: date || null,
      slots: allEnrichedSlots,
      available_days,
      sessions_left: sessionsLeft,
      trainer_id: school.owner_id,
      enrollment_id: enrollmentId,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ==========================================
// POST /api/v1/athlete/training/book-pt-session
// ==========================================
router.post('/training/book-pt-session', async (req: Request, res: Response) => {
  try {
    const callerId = req.user.id;
    const { enrollment_id, session_date, session_time, notes, session_type } = req.body;

    if (!enrollment_id || !session_date || !session_time) {
      return res.status(400).json({ error: 'enrollment_id, session_date y session_time son requeridos.' });
    }

    const { data, error } = await supabase.rpc('fn_book_pt_session', {
      p_enrollment_id: enrollment_id,
      p_session_date:  session_date,
      p_session_time:  session_time,
      p_booked_by:     callerId,
      p_notes:         notes ?? null,
      p_session_type:  session_type ?? 'personal'
    });

    if (error) throw error;
    if (!data?.success) {
      return res.status(400).json({ error: data?.error ?? 'No se pudo agendar.' });
    }

    res.status(201).json(data);

    // ✅ Notificar al PT que se agendó una sesión
    try {
      // Obtener info del enrollment para saber el nombre del cliente
      const { data: enr } = await supabase
        .from('enrollments')
        .select('user_id, child_id, school_id, schools!inner(owner_id)')
        .eq('id', enrollment_id)
        .maybeSingle();

      const trainerId = (enr?.schools as any)?.owner_id;
      if (trainerId) {
        // Resolver nombre del que agenda
        let clientName = 'Un cliente';
        if (enr?.child_id) {
          const { data: child } = await supabase
            .from('children').select('full_name').eq('id', enr.child_id).maybeSingle();
          clientName = child?.full_name ?? clientName;
        } else if (enr?.user_id) {
          const { data: profile } = await supabase
            .from('profiles').select('full_name').eq('id', enr.user_id).maybeSingle();
          clientName = profile?.full_name ?? clientName;
        }

        await supabase.from('notifications').insert({
          user_id: trainerId,
          title:   '📅 Nueva sesión agendada',
          message: `${clientName} agendó una sesión para el ${session_date} a las ${session_time.substring(0, 5)}.`,
          type:    'info',
          link:    '/trainer/availability',
        });

        // ✅ Confirmar al atleta/padre que agendó
        await supabase.from('notifications').insert({
          user_id: callerId,
          title:   '📅 Sesión confirmada',
          message: `Tu sesión del ${session_date} a las ${session_time.substring(0, 5)} fue agendada correctamente.`,
          type:    'success',
          link:    '/athlete-payments',
        });
      }
    } catch (_) { /* fire and forget */ }
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ==========================================
// DELETE /api/v1/athlete/training/cancel-pt-session
// ==========================================
router.delete('/training/cancel-pt-session', async (req: Request, res: Response) => {
  try {
    const callerId = req.user.id;
    const planId   = req.query.plan_id as string;

    if (!planId) return res.status(400).json({ error: 'plan_id es requerido.' });

    // ✅ Obtener info de la sesión para validar ventana
    const { data: plan } = await supabase
      .from('trainer_session_plans')
      .select('id, session_date, session_time, trainer_id, client_id, client_type, enrollment_id, status')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) return res.status(404).json({ error: 'Sesión no encontrada.' });
    if (plan.status === 'completed') return res.status(400).json({ error: 'No se puede cancelar una sesión completada.' });

    // ✅ Validar ventana de 4h (hora Colombia UTC-5)
    if (plan.session_date && plan.session_time) {
      const sessionCO  = new Date(`${plan.session_date}T${plan.session_time.substring(0, 8)}`);
      const sessionUTC = new Date(sessionCO.getTime() + 5 * 60 * 60 * 1000);
      const hoursUntil = (sessionUTC.getTime() - Date.now()) / 3_600_000;

      if (hoursUntil < 4) {
        // Fuera de ventana → pending_review, PT decide
        await supabase
          .from('trainer_session_plans')
          .update({
            status:              'pending_review',
            cancelled_by:        callerId,
            cancelled_at:        new Date().toISOString(),
            cancelled_by_role:   plan.client_type === 'child' ? 'parent' : 'athlete',
            cancellation_reason: 'outside_window',
            updated_at:          new Date().toISOString(),
          })
          .eq('id', planId);

        // Notificar al PT para que decida
        await supabase.from('notifications').insert({
          user_id: plan.trainer_id,
          title:   '⚠️ Solicitud de cancelación tardía',
          message: `Un cliente solicitó cancelar la sesión del ${plan.session_date}${plan.session_time ? ` a las ${plan.session_time.substring(0, 5)}` : ''} con menos de 4 horas de anticipación. Decide si devolver el crédito desde el módulo de Disponibilidad.`,
          type:    'warning',
          link:    '/trainer/availability',
        });

        return res.status(400).json({
          error:   'outside_cancel_window',
          message: 'La sesión es en menos de 4 horas. Tu entrenador fue notificado y decidirá si devolver el crédito.',
        });
      }
    }

    // ✅ Dentro de ventana — cancelar y devolver crédito
    await supabase
      .from('trainer_session_plans')
      .update({
        cancelled_by:        callerId,
        cancelled_at:        new Date().toISOString(),
        cancelled_by_role:   plan.client_type === 'child' ? 'parent' : 'athlete',
        cancellation_reason: 'within_window',
      })
      .eq('id', planId);

    const { data, error } = await supabase.rpc('fn_cancel_pt_session', {
      p_plan_id:   planId,
      p_caller_id: callerId,
    });

    if (error) throw error;
    if (!data?.success) return res.status(400).json({ error: data?.error ?? 'No se pudo cancelar.' });

    // Notificar al PT de la cancelación
    try {
      let clientName = 'Un cliente';
      if (plan.client_type === 'child') {
        const { data: child } = await supabase.from('children').select('full_name').eq('id', plan.client_id).maybeSingle();
        clientName = child?.full_name ?? clientName;
      } else {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', plan.client_id).maybeSingle();
        clientName = profile?.full_name ?? clientName;
      }
      await supabase.from('notifications').insert({
        user_id: plan.trainer_id,
        title:   '❌ Sesión cancelada',
        message: `${clientName} canceló la sesión del ${plan.session_date}${plan.session_time ? ` a las ${plan.session_time.substring(0, 5)}` : ''}. El crédito fue devuelto automáticamente.`,
        type:    'warning',
        link:    '/trainer/availability',
      });
      // Confirmar al atleta/padre
      await supabase.from('notifications').insert({
        user_id: callerId,
        title:   '❌ Sesión cancelada',
        message: `Tu sesión del ${plan.session_date}${plan.session_time ? ` a las ${plan.session_time.substring(0, 5)}` : ''} fue cancelada. El crédito fue devuelto a tu plan.`,
        type:    'info',
        link:    '/athlete-payments',
      });
    } catch (_) {}

    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'athlete/training unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
