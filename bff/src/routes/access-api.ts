import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { invalidateDeviceCache } from './access-adms';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── GET /api/v1/access/debug-logs ───────────────────────────────────────────
router.get('/debug-logs', (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../debug.log');
    if (!fs.existsSync(logPath)) {
      return res.type('text/plain').send('Log file does not exist yet.');
    }
    const content = fs.readFileSync(logPath, 'utf8');
    return res.type('text/plain').send(content);
  } catch (err: any) {
    return res.status(500).send(`Error reading log: ${err.message}`);
  }
});

router.post('/debug-logs/clear', (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../debug.log');
    fs.writeFileSync(logPath, '');
    return res.send('Cleared.');
  } catch (err: any) {
    return res.status(500).send(err.message);
  }
});

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

    // Registrar el mapeo PIN→user para que validateAccess lo reconozca.
    await supabase.from('zk_user_mappings').upsert(
      { school_id: schoolId, zk_pin: pin, user_id, unregistered_athlete_id: null },
      { onConflict: 'school_id,zk_pin' },
    );

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

// ─── GET /api/v1/access/members ──────────────────────────────────────────────
router.get('/members', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const q = (req.query.q as string || '').trim();

    // PINs ya asignados — se excluyen para evitar duplicidad
    const { data: mappings } = await supabase
      .from('zk_user_mappings')
      .select('user_id, unregistered_athlete_id')
      .eq('school_id', schoolId);
    const mappedUserIds = new Set((mappings || []).map((m: any) => m.user_id).filter(Boolean));
    const mappedUaIds   = new Set((mappings || []).map((m: any) => m.unregistered_athlete_id).filter(Boolean));

    // Miembros con login
    const { data: members } = await supabase
      .from('school_members')
      .select('profile_id, role')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(500);
    const memberIds = [...new Set((members || []).map((m: any) => m.profile_id).filter(Boolean))]
      .filter((id: string) => !mappedUserIds.has(id));

    let registered: any[] = [];
    if (memberIds.length) {
      let pq = supabase.from('profiles').select('id, full_name').in('id', memberIds);
      if (q) pq = pq.ilike('full_name', `%${q}%`);
      const { data: profiles } = await pq.limit(50);
      const roleById: Record<string, string> = {};
      (members || []).forEach((m: any) => { roleById[m.profile_id] = m.role; });
      registered = (profiles || []).map((p: any) => ({
        user_id: p.id, full_name: p.full_name, role: roleById[p.id] ?? null, type: 'registered',
      }));
    }

    // Atletas sin login (la mayoría en tu caso)
    let uaq = supabase.from('unregistered_athletes').select('id, full_name').eq('school_id', schoolId);
    if (q) uaq = uaq.ilike('full_name', `%${q}%`);
    const { data: uas, error: uaError } = await uaq.limit(50);
    console.log(`[MEMBERS DEBUG] schoolId=${schoolId} q="${q}" uas_count=${uas?.length ?? 'null'} uaError=${uaError?.message ?? 'none'} mappedUaIds_size=${mappedUaIds.size}`);
    const unregistered = (uas || [])
      .filter((u: any) => !mappedUaIds.has(u.id))
      .map((u: any) => ({ unregistered_athlete_id: u.id, full_name: u.full_name, role: null, type: 'unregistered' }));
    console.log(`[MEMBERS DEBUG] unregistered después de filtro: ${unregistered.length}`);

    return res.json({ members: [...registered, ...unregistered] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al listar miembros' });
  }
});

// ─── POST /api/v1/access/assign-user ─────────────────────────────────────────
// Mapea un PIN ya existente en el lector (ZK#<pin>) a un usuario registrado o a
// un atleta no registrado. No envía comando al dispositivo (el PIN ya existe).
router.post('/assign-user', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { zk_pin, user_id, unregistered_athlete_id } = req.body as {
      zk_pin: number; user_id?: string; unregistered_athlete_id?: string;
    };

    if (!zk_pin || (!user_id && !unregistered_athlete_id)) {
      return res.status(400).json({ error: 'zk_pin y (user_id o unregistered_athlete_id) son requeridos' });
    }

    const { error } = await supabase.from('zk_user_mappings').upsert(
      {
        school_id:               schoolId,
        zk_pin,
        user_id:                 user_id ?? null,
        unregistered_athlete_id: user_id ? null : (unregistered_athlete_id ?? null),
      },
      { onConflict: 'school_id,zk_pin' },
    );
    if (error) throw error;

    return res.json({ success: true, message: `PIN ${zk_pin} asignado.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al asignar usuario al PIN' });
  }
});

// ─── GET /api/v1/access/devices ──────────────────────────────────────────────
router.get('/devices', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { data: devices, error } = await supabase
      .from('turnstile_devices')
      .select('id, serial_number, device_name, ip_address, direction, location, is_active, last_seen_at, brand, door_drive_time_seconds')
      .eq('school_id', schoolId)
      .order('direction');

    try {
      fs.appendFileSync(
        path.join(__dirname, '../../debug.log'),
        `${new Date().toISOString()} - /devices schoolId=${schoolId} role=${req.role} count=${devices?.length ?? 'null'} err=${error?.message ?? '-'}\n`,
      );
    } catch { /* no romper por el log */ }

    if (error) throw error;
    return res.json({ devices: devices || [] });
  } catch (err: any) {
    try {
      fs.appendFileSync(
        path.join(__dirname, '../../debug.log'),
        `${new Date().toISOString()} - /devices EXCEPTION: ${err?.message}\n`,
      );
    } catch { /* noop */ }
    return res.status(500).json({ error: 'Error al listar dispositivos' });
  }
});

// ─── POST /api/v1/access/devices — crear dispositivo ────────────────────────
router.post('/devices', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { serial_number, device_name, ip_address, direction, location, brand, door_drive_time_seconds } = req.body as {
      serial_number: string; device_name: string; ip_address?: string;
      direction: 'entry' | 'exit' | 'both'; location?: string; brand?: string;
      door_drive_time_seconds?: number;
    };

    if (!serial_number || !device_name || !direction) {
      return res.status(400).json({ error: 'serial_number, device_name y direction son requeridos' });
    }
    if (!['entry', 'exit', 'both'].includes(direction)) {
      return res.status(400).json({ error: 'direction debe ser entry, exit o both' });
    }

    const { data: device, error } = await supabase
      .from('turnstile_devices')
      .insert({
        school_id:      schoolId,
        serial_number:  serial_number.trim(),
        device_name:    device_name.trim(),
        ip_address:     ip_address?.trim() || null,
        direction,
        location:       location?.trim() || null,
        is_active:      true,
        brand:          brand?.trim() || 'Genérico',
        door_drive_time_seconds: door_drive_time_seconds ?? 5,
      })
      .select('id, serial_number, device_name, ip_address, direction, location, is_active, brand, door_drive_time_seconds')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ese número de serie ya está registrado' });
      }
      throw error;
    }

    // Invalida el cache al crear un nuevo dispositivo (por si acaso el serial ya estaba cacheado como null)
    invalidateDeviceCache(device.serial_number);

    if (door_drive_time_seconds) {
      await supabase.from('device_commands').insert({
        school_id: schoolId,
        device_id: device.id,
        command_type: 'set_drive_time',
        direction: device.direction === 'both' ? 'entry' : device.direction,
        status: 'pending',
        issued_by: req.user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: { seconds: door_drive_time_seconds },
      });
    }

    return res.json({ success: true, device });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al crear dispositivo' });
  }
});

// ─── PATCH /api/v1/access/devices/:id — editar dispositivo ──────────────────
router.patch('/devices/:id', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { serial_number, device_name, ip_address, direction, location, is_active, brand, door_drive_time_seconds } = req.body as {
      serial_number?: string; device_name?: string; ip_address?: string | null;
      direction?: 'entry' | 'exit' | 'both'; location?: string; is_active?: boolean; brand?: string;
      door_drive_time_seconds?: number;
    };

    if (direction && !['entry', 'exit', 'both'].includes(direction)) {
      return res.status(400).json({ error: 'direction debe ser entry, exit o both' });
    }

    const updates: Record<string, unknown> = {};
    if (serial_number !== undefined) updates.serial_number = serial_number.trim();
    if (device_name   !== undefined) updates.device_name   = device_name.trim();
    if (ip_address    !== undefined) updates.ip_address     = ip_address?.trim() || null;
    if (direction     !== undefined) updates.direction      = direction;
    if (location      !== undefined) updates.location       = location?.trim() || null;
    if (is_active     !== undefined) updates.is_active       = is_active;
    if (brand         !== undefined) updates.brand          = brand.trim();
    if (door_drive_time_seconds !== undefined) updates.door_drive_time_seconds = door_drive_time_seconds;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    // Primero obtenemos el dispositivo actual para saber su serial anterior (por si cambia)
    const { data: oldDevice } = await supabase
      .from('turnstile_devices')
      .select('serial_number')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle();

    const { data: device, error } = await supabase
      .from('turnstile_devices')
      .update(updates)
      .eq('id', id)
      .eq('school_id', schoolId) // 🔒 evita editar dispositivos de otra escuela
      .select('id, serial_number, device_name, ip_address, direction, location, is_active, brand, door_drive_time_seconds')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ese número de serie ya está registrado' });
      }
      throw error;
    }
    if (!device) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    // Invalida el cache bajo el serial anterior (por si cambió) y el nuevo
    if (oldDevice?.serial_number && oldDevice.serial_number !== device.serial_number) {
      invalidateDeviceCache(oldDevice.serial_number);
    }
    invalidateDeviceCache(device.serial_number);

    if (door_drive_time_seconds !== undefined) {
      await supabase.from('device_commands').insert({
        school_id: schoolId,
        device_id: device.id,
        command_type: 'set_drive_time',
        direction: device.direction === 'both' ? 'entry' : device.direction,
        status: 'pending',
        issued_by: req.user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: { seconds: door_drive_time_seconds },
      });
    }

    return res.json({ success: true, device });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar dispositivo' });
  }
});

// ─── POST /api/v1/access/set-access-group ───────────────────────────────────
router.post('/set-access-group', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { pin, group } = req.body as { pin: number; group: 1 | 2 };
    if (!pin || ![1, 2].includes(group)) {
      return res.status(400).json({ error: 'pin y group (1 o 2) son requeridos' });
    }
    const { data: devices } = await supabase
      .from('turnstile_devices').select('id, direction')
      .eq('school_id', schoolId).eq('is_active', true);
    if (!devices?.length) return res.status(404).json({ error: 'Sin dispositivos activos' });

    const commands = devices.map((d: any) => ({
      school_id: schoolId, device_id: d.id, command_type: 'set_group',
      direction: d.direction === 'both' ? 'entry' : d.direction,
      status: 'pending', issued_by: req.user.id,
      expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
      metadata: { pin, group },
    }));
    await supabase.from('device_commands').insert(commands);
    return res.json({ success: true, message: `PIN ${pin} movido a grupo ${group} en ${devices.length} dispositivo(s).` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al cambiar de grupo de acceso' });
  }
});

// ─── GET /api/v1/access/overdue ──────────────────────────────────────────────
// Lista atletas con pago vencido que tienen huella mapeada, para bloqueo/restauración manual.
router.get('/overdue', requireAuth, requireRole('owner', 'admin', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;

    const { data: overduePayments, error } = await supabase
      .from('payments')
      .select('id, user_id, unregistered_athlete_id, due_date, amount')
      .eq('school_id', schoolId)
      .eq('status', 'overdue');
    if (error) throw error;
    if (!overduePayments?.length) return res.json({ overdue: [] });

    const { data: mappings } = await supabase
      .from('zk_user_mappings')
      .select('zk_pin, user_id, unregistered_athlete_id')
      .eq('school_id', schoolId);

    const mapByKey: Record<string, number> = {};
    (mappings || []).forEach((m: any) => {
      const key = m.user_id ? `u:${m.user_id}` : `a:${m.unregistered_athlete_id}`;
      mapByKey[key] = m.zk_pin;
    });

    const userIds = [...new Set(overduePayments.map((p: any) => p.user_id).filter(Boolean))];
    const uaIds   = [...new Set(overduePayments.map((p: any) => p.unregistered_athlete_id).filter(Boolean))];

    const profileMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
    }
    const uaMap: Record<string, string> = {};
    if (uaIds.length) {
      const { data: uas } = await supabase.from('unregistered_athletes').select('id, full_name').in('id', uaIds);
      (uas || []).forEach((u: any) => { uaMap[u.id] = u.full_name; });
    }

    // Último comando set_group ejecutado por PIN → estado actual conocido (2 = bloqueado)
    const { data: lastGroupCmds } = await supabase
      .from('device_commands')
      .select('metadata, executed_at')
      .eq('school_id', schoolId)
      .eq('command_type', 'set_group')
      .eq('status', 'executed')
      .order('executed_at', { ascending: false });

    const pinBlocked: Record<number, boolean> = {};
    (lastGroupCmds || []).forEach((c: any) => {
      const pin = c.metadata?.pin;
      if (pin !== undefined && !(pin in pinBlocked)) pinBlocked[pin] = c.metadata?.group === 2;
    });

    const overdue = overduePayments
      .map((p: any) => {
        const key = p.user_id ? `u:${p.user_id}` : `a:${p.unregistered_athlete_id}`;
        const pin = mapByKey[key];
        if (pin === undefined) return null;
        return {
          payment_id: p.id,
          name: p.user_id ? (profileMap[p.user_id] ?? 'Usuario') : (uaMap[p.unregistered_athlete_id] ?? 'Atleta'),
          due_date: p.due_date,
          amount: p.amount,
          zk_pin: pin,
          blocked: !!pinBlocked[pin],
        };
      })
      .filter(Boolean);

    return res.json({ overdue });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al listar vencidos' });
  }
});

export default router;
