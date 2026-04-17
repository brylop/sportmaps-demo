import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// ==========================================
//  GET /api/v1/trainer/search-profile
// ==========================================
router.get('/search-profile', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) return res.status(400).json({ error: 'Parámetro q requerido.' });

    const isEmail = q.includes('@');

    // Solo email o teléfono — sin documento
    if (!isEmail && !/^\+?\d{7,15}$/.test(q.replace(/\s/g, ''))) {
      return res.status(400).json({ 
        error: 'Ingresa un email o número de teléfono válido.' 
      });
    }

    const cleanPhone = q.replace(/\s/g, '').replace(/^\+57/, '');

    const { data, error } = isEmail
      ? await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .eq('email', q.toLowerCase())
          .maybeSingle()
      : await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .or(`phone.eq.${cleanPhone},phone.eq.+57${cleanPhone}`)
          .maybeSingle();

    if (error) throw error;
    res.json(data ?? null);
  } catch (err) {
    (req as any).log?.error({ err }, 'Error searching profile');
    res.status(500).json({ error: 'Error al buscar atleta.' });
  }
});

// ==========================================
//  GET /api/v1/trainer/clients
// ==========================================
router.get('/clients', async (req: Request, res: Response) => {
  try {
    const schoolId = req.schoolId;

    const { data: enrollments, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, user_id, child_id, unregistered_athlete_id, status, offering_plan_id, created_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (enrollErr) throw enrollErr;
    if (!enrollments || enrollments.length === 0) return res.json([]);

    // Separar los tres tipos
    const adultIds       = enrollments.filter(e => e.user_id && !e.child_id).map(e => e.user_id!);
    const childIds       = enrollments.filter(e => e.child_id).map(e => e.child_id!);
    const unregIds       = enrollments.filter(e => e.unregistered_athlete_id).map(e => e.unregistered_athlete_id!);

    const [profilesRes, childrenRes, unregRes] = await Promise.all([
      adultIds.length > 0
        ? supabase.from('profiles').select('id, full_name, email, phone, avatar_url, date_of_birth').in('id', adultIds)
        : Promise.resolve({ data: [], error: null }),

      childIds.length > 0
        ? supabase.from('children').select('id, full_name, date_of_birth, avatar_url').in('id', childIds)
        : Promise.resolve({ data: [], error: null }),

      unregIds.length > 0
        ? supabase.from('unregistered_athletes').select('id, full_name, email, phone, date_of_birth, gender').in('id', unregIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const childrenMap = new Map((childrenRes.data ?? []).map((c: any) => [c.id, c]));
    const unregMap    = new Map((unregRes.data   ?? []).map((u: any) => [u.id, u]));

    const clients = enrollments.map((e: any) => {
      if (e.user_id && !e.child_id) {
        return {
          enrollment_id: e.id,
          athleteId:     e.user_id,
          clientType:    'adult',
          status:        e.status,
          created_at:    e.created_at,
          plan_id:       e.offering_plan_id,
          profile:       profilesMap.get(e.user_id) ?? null,
          child:         null,
        };
      } else if (e.child_id) {
        return {
          enrollment_id: e.id,
          athleteId:     e.child_id,
          clientType:    'child',
          status:        e.status,
          created_at:    e.created_at,
          plan_id:       e.offering_plan_id,
          profile:       null,
          child:         childrenMap.get(e.child_id) ?? null,
        };
      } else {
        // unregistered_athlete
        const unreg = unregMap.get(e.unregistered_athlete_id) ?? null;
        return {
          enrollment_id: e.id,
          athleteId:     e.unregistered_athlete_id,
          clientType:    'unregistered',
          status:        e.status,
          created_at:    e.created_at,
          plan_id:       e.offering_plan_id,
          profile:       unreg ? {
            full_name:     unreg.full_name,
            email:         unreg.email,
            phone:         unreg.phone,
            avatar_url:    null,
            date_of_birth: unreg.date_of_birth,
          } : null,
          child: null,
        };
      }
    });

    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
//  GET /api/v1/trainer/clients/:clientId
// ==========================================
router.get('/clients/:clientId', async (req: Request, res: Response) => {
  try {
    const schoolId = req.schoolId;
    const { clientId } = req.params;
    const type = req.query.type as string; // 'adult' | 'child'

    if (!type || !['adult', 'child', 'unregistered'].includes(type)) {
      return res.status(400).json({ error: 'Parámetro query type (adult/child/unregistered) es requerido' });
    }

    // 1. Validar que el cliente pertenece a este trainer (vía enrollment de la escuela)
    let enrollmentQuery = supabase
      .from('enrollments')
      .select('id, status, start_date, end_date, sessions_used, offering_plan_id, user_id, child_id, unregistered_athlete_id')
      .eq('school_id', schoolId)
      .eq('status', 'active');
      
    if (type === 'adult') enrollmentQuery = enrollmentQuery.eq('user_id', clientId).is('child_id', null);
    if (type === 'child') enrollmentQuery = enrollmentQuery.eq('child_id', clientId);
    if (type === 'unregistered') enrollmentQuery = enrollmentQuery.eq('unregistered_athlete_id', clientId);
    
    const athleteColumn = type === 'adult' ? 'user_id' : type === 'child' ? 'child_id' : 'unregistered_athlete_id';

    // Execute all flat queries in parallel
    const [enrollResult, paymentsResult, attendanceResult, statsResult, goalsResult] = await Promise.all([
      enrollmentQuery.order('created_at', { ascending: false }).limit(1).maybeSingle(),
      
      supabase.from('payments')
        .select('id, amount, payment_date, due_date, status, payment_method, concept')
        .eq('school_id', schoolId)
        .eq(athleteColumn, clientId)
        .not(athleteColumn, 'is', null)
        .order('payment_date', { ascending: false })
        .limit(5),
        
      supabase.from('attendance_records')
        .select('*')
        .eq('school_id', schoolId)
        .eq(athleteColumn, clientId)
        .order('attendance_date', { ascending: false })
        .limit(10),
        
      supabase.from('athlete_stats')
        .select('*')
        .eq('athlete_id', clientId)
        .order('stat_date', { ascending: false })
        .limit(30),
        
      supabase.from('athlete_goals')
        .select('*')
        .eq('athlete_id', clientId)
        .order('target_date', { ascending: true })
    ]);

    console.log('PAYMENTS DEBUG:', JSON.stringify(paymentsResult.data, null, 2));

    if (enrollResult.error) throw enrollResult.error;
    if (!enrollResult.data) return res.status(404).json({ error: 'Cliente no encontrado o no activo en tu academia' });

    const enrollment = enrollResult.data;

    // Resolve profile/child/plan separately
    const [profileRes, planRes] = await Promise.all([
      enrollment?.user_id
        ? supabase.from('profiles').select('full_name, email, phone, avatar_url, date_of_birth').eq('id', enrollment.user_id).maybeSingle()
        : enrollment?.child_id
          ? supabase.from('children').select('full_name, date_of_birth, avatar_url').eq('id', enrollment.child_id).maybeSingle()
          : enrollment?.unregistered_athlete_id
            ? supabase.from('unregistered_athletes').select('full_name, email, phone, date_of_birth').eq('id', enrollment.unregistered_athlete_id).maybeSingle()
            : Promise.resolve({ data: null }),
      enrollment?.offering_plan_id
        ? supabase.from('offering_plans').select('name, duration_days, price, max_sessions, metadata, currency').eq('id', enrollment.offering_plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const assembledEnrollment = {
      ...enrollment,
      profiles: type === 'adult' ? profileRes.data : type === 'unregistered' ? profileRes.data : null,
      children: type === 'child' ? profileRes.data : null, // profileRes holds child if it's child type
      offering_plans: planRes.data
    };

    res.json({
      enrollment: assembledEnrollment,
      payments: paymentsResult.data || [],
      attendance: attendanceResult.data || [],
      stats: statsResult.data || [],
      goals: goalsResult.data || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
//  POST/PUT/DELETE /api/v1/trainer/clients/:clientId/stats
// ==========================================
router.post('/clients/:clientId/stats', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { stat_type, value, unit, notes, stat_date } = req.body;
    
    // NOTA: Como la tabla de stats no tiene school_id, dependemos de que clientId sea válido. 
    // Para simplificar asuminos que si llega acá el trainer lo conoce (podrías validar el enrollment como en GET).
    
    const { data, error } = await supabase
      .from('athlete_stats')
      .insert({
        athlete_id: clientId,
        stat_type, value, unit, notes, stat_date
      })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/clients/:clientId/stats/:statId', async (req: Request, res: Response) => {
  try {
    const { clientId, statId } = req.params;
    const { value, notes } = req.body;
    
    const { data, error } = await supabase
      .from('athlete_stats')
      .update({ value, notes })
      .eq('id', statId)
      .eq('athlete_id', clientId)
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/clients/:clientId/stats/:statId', async (req: Request, res: Response) => {
  try {
    const { clientId, statId } = req.params;
    const { error } = await supabase
      .from('athlete_stats')
      .delete()
      .eq('id', statId)
      .eq('athlete_id', clientId);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==========================================
//  POST/PUT/DELETE /api/v1/trainer/clients/:clientId/goals
// ==========================================
router.post('/clients/:clientId/goals', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { title, description, target_date, progress, status } = req.body;
    
    const { data, error } = await supabase
      .from('athlete_goals')
      .insert({
        athlete_id: clientId,
        title, description, target_date, progress, status
      })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/clients/:clientId/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { clientId, goalId } = req.params;
    const { title, description, target_date, progress, status } = req.body;
    
    const updatePayload: any = { title, description, target_date, progress, status };
    
    const { data, error } = await supabase
      .from('athlete_goals')
      .update(updatePayload)
      .eq('id', goalId)
      .eq('athlete_id', clientId)
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/clients/:clientId/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { clientId, goalId } = req.params;
    const { error } = await supabase
      .from('athlete_goals')
      .delete()
      .eq('id', goalId)
      .eq('athlete_id', clientId);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==========================================
//  POST/PUT/DELETE /api/v1/trainer/clients/:clientId/training
// ==========================================
router.post('/clients/:clientId/training', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { training_date, exercise_type, duration_minutes, intensity, calories_burned, notes } = req.body;
    
    const { data, error } = await supabase
      .from('training_logs')
      .insert({
        athlete_id: clientId,
        training_date, exercise_type, duration_minutes, intensity, calories_burned, notes
      })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/clients/:clientId/training/:logId', async (req: Request, res: Response) => {
  try {
    const { clientId, logId } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('training_logs')
      .update(updates)
      .eq('id', logId)
      .eq('athlete_id', clientId)
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/clients/:clientId/training/:logId', async (req: Request, res: Response) => {
  try {
    const { clientId, logId } = req.params;
    const { error } = await supabase
      .from('training_logs')
      .delete()
      .eq('id', logId)
      .eq('athlete_id', clientId);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==========================================
//  POST/PUT /api/v1/trainer/clients/:clientId/progress
// ==========================================
router.post('/clients/:clientId/progress', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { type } = req.query; // adult or child
    const { skill_name, skill_level, comments } = req.body;
    
    const isAdult = type === 'adult';
    
    const { data, error } = await supabase
      .from('academic_progress')
      .insert({
        user_id: isAdult ? clientId : null,
        child_id: !isAdult ? clientId : null,
        school_id: req.schoolId,
        coach_id: req.user?.id,
        skill_name,
        skill_level,
        comments
      })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/clients/:clientId/progress/:progressId', async (req: Request, res: Response) => {
  try {
    const { progressId } = req.params;
    const { skill_level, comments } = req.body;
    
    const { data, error } = await supabase
      .from('academic_progress')
      .update({ skill_level, comments })
      .eq('id', progressId)
      .eq('school_id', req.schoolId)
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
