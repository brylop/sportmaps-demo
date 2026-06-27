import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

const SCHOOL_ID = '2137182d-a695-4695-8e5a-61151fc59196';

// ─── GET /api/v1/access/events ───────────────────────────────────────────────
router.get('/events', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const date   = req.query.date as string;

    let query = supabase
      .from('access_events')
      .select(`
        id, direction, access_granted, denial_reason,
        check_in_method, zk_user_id, occurred_at, user_id, unregistered_athlete_id,
        turnstile_devices!access_events_device_id_fkey(device_name, direction)
      `)
      .eq('school_id', schoolId)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (date) {
      const startUTC = `${date}T05:00:00+00:00`;
      const endUTC   = new Date(new Date(startUTC).getTime() + 86400000).toISOString();
      query = query.gte('occurred_at', startUTC).lt('occurred_at', endUTC);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    // IDs de perfiles registrados
    const userIds = [...new Set(
      (events || []).map((e: any) => e.user_id).filter(Boolean)
    )];

    // IDs de atletas no registrados
    const uaIds = [...new Set(
      (events || []).map((e: any) => e.unregistered_athlete_id).filter(Boolean)
    )];

    const profileMap: Record<string, string> = {};
    const uaMap: Record<string, string> = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
    }

    if (uaIds.length) {
      const { data: uas } = await supabase
        .from('unregistered_athletes')
        .select('id, full_name')
        .in('id', uaIds);
      (uas || []).forEach((ua: any) => { uaMap[ua.id] = ua.full_name; });
    }

    const enriched = (events || []).map((e: any) => ({
      ...e,
      user_name:
        (e.user_id && profileMap[e.user_id])
          ? profileMap[e.user_id]
          : (e.unregistered_athlete_id && uaMap[e.unregistered_athlete_id])
            ? uaMap[e.unregistered_athlete_id]
            : `ZK#${e.zk_user_id}`,
    }));

    return res.json({ events: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener eventos de acceso' });
  }
});

// ─── GET /api/v1/access/stats ────────────────────────────────────────────────
router.get('/stats', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const today    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const startUTC = `${today}T05:00:00+00:00`;
    const endUTC   = new Date(new Date(startUTC).getTime() + 86400000).toISOString();

    const { data: events, error } = await supabase
      .from('access_events')
      .select('direction, access_granted')
      .eq('school_id', schoolId)
      .gte('occurred_at', startUTC)
      .lt('occurred_at', endUTC);

    if (error) throw error;

    const granted  = (events || []).filter((e: any) =>  e.access_granted);
    const denied   = (events || []).filter((e: any) => !e.access_granted);
    const entries  = granted.filter((e: any) => e.direction === 'entry');
    const exits    = granted.filter((e: any) => e.direction === 'exit');

    return res.json({
      today,
      entries_count:     entries.length,
      exits_count:       exits.length,
      denied_count:      denied.length,
      current_occupancy: Math.max(0, entries.length - exits.length),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});

// ─── POST /api/v1/access/manual-open ────────────────────────────────────────
router.post('/manual-open', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { direction } = req.body as { direction: 'entry' | 'exit' };

    if (!direction || !['entry', 'exit'].includes(direction)) {
      return res.status(400).json({ error: 'direction debe ser entry o exit' });
    }

    const { data: device } = await supabase
      .from('turnstile_devices')
      .select('id, ip_address, device_name')
      .eq('school_id', schoolId)
      .eq('direction', direction)
      .eq('is_active', true)
      .maybeSingle();

    if (!device) {
      return res.status(404).json({ error: `Sin dispositivo activo para ${direction}` });
    }

    if (!device.ip_address) {
      return res.status(422).json({
        error: 'IP pública no configurada. Contacta al administrador.',
        code: 'NO_IP_CONFIGURED',
      });
    }

    const { data: command } = await supabase
      .from('device_commands')
      .insert({
        school_id:    schoolId,
        device_id:    device.id,
        command_type: 'open_door',
        direction,
        status:       'pending',
        issued_by:    req.user.id,
        expires_at:   new Date(Date.now() + 30_000).toISOString(),
        metadata:     {},
      })
      .select('id')
      .single();

    await supabase.from('access_events').insert({
      school_id:       schoolId,
      device_id:       device.id,
      user_id:         req.user.id,
      direction,
      access_granted:  true,
      check_in_method: 'manual',
      occurred_at:     new Date().toISOString(),
      raw_event:       { issued_by: req.user.id, command_id: command?.id },
    });

    return res.json({
      success:    true,
      command_id: command?.id,
      message:    `Comando enviado a ${device.device_name}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al enviar comando de apertura' });
  }
});

// ─── POST /api/v1/access/enroll ──────────────────────────────────────────────
router.post('/enroll', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { user_id, pin, name, card } = req.body as {
      user_id: string; pin: number; name: string; card?: string;
    };

    if (!user_id || !pin || !name) {
      return res.status(400).json({ error: 'user_id, pin y name son requeridos' });
    }

    const { data: devices } = await supabase
      .from('turnstile_devices')
      .select('id, direction, device_name')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Sin dispositivos activos' });
    }

    const commands = devices.map((device: any) => ({
      school_id:    schoolId,
      device_id:    device.id,
      command_type: 'enroll_user',
      direction:    device.direction,
      status:       'pending',
      issued_by:    req.user.id,
      expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata:     { pin, name, card: card || null, user_id },
    }));

    const { error } = await supabase.from('device_commands').insert(commands);
    if (error) throw error;

    console.log(`[ENROLL] ${name} (PIN:${pin}) encolado en ${devices.length} dispositivo(s)`);

    return res.json({
      success: true,
      message: `Usuario encolado en ${devices.length} dispositivo(s). Se activará en el próximo polling.`,
      devices: devices.map((d: any) => d.device_name),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al encolar enrolamiento' });
  }
});

// ─── POST /api/v1/access/revoke ──────────────────────────────────────────────
router.post('/revoke', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { pin } = req.body as { pin: number };

    if (!pin) return res.status(400).json({ error: 'pin es requerido' });

    const { data: devices } = await supabase
      .from('turnstile_devices')
      .select('id, device_name')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Sin dispositivos activos' });
    }

    const commands = devices.map((device: any) => ({
      school_id:    schoolId,
      device_id:    device.id,
      command_type: 'delete_user',
      direction:    'entry',
      status:       'pending',
      issued_by:    req.user.id,
      expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata:     { pin },
    }));

    await supabase.from('device_commands').insert(commands);

    return res.json({
      success: true,
      message: `Revocación encolada en ${devices.length} dispositivo(s).`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al encolar revocación' });
  }
});

// ─── GET /api/v1/access/devices ──────────────────────────────────────────────
router.get('/devices', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { data: devices, error } = await supabase
      .from('turnstile_devices')
      .select('id, serial_number, device_name, ip_address, port, direction, location, is_active, last_seen_at')
      .eq('school_id', schoolId)
      .order('direction');

    if (error) throw error;
    return res.json({ devices: devices || [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al listar dispositivos' });
  }
});

export default router;
