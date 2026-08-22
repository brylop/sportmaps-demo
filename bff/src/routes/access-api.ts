import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { invalidateDeviceCache, invalidateMappingCache, getHourBankSettings } from './access-adms';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── /debug-logs — ELIMINADO (SEG-9, 2026-08-12) ─────────────────────────────
// Gemelos de los de `access-adms.ts`, montados acá como
// `GET /api/v1/access/debug-logs` y `POST /api/v1/access/debug-logs/clear`.
// Sin `requireAuth` ni `requireRole`, en un router donde TODAS las demás rutas
// sí los llevan — el descuido se ve al comparar con la línea siguiente.
//
// Servían `debug.log`: seriales de lector, IDs de usuario del dispositivo y
// horarios de entrada/salida. Datos de asistencia de personas identificables,
// legibles y borrables por cualquiera. Ver la nota larga en access-adms.ts.

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

    // PINs de eventos "huérfanos" (sin user_id ni unregistered_athlete_id guardados)
    // que puedan tener un mapeo posterior — resuelve el caso del caché/asignación tardía.
    const orphanPins = [...new Set(
      (events || [])
        .filter((e: any) => !e.user_id && !e.unregistered_athlete_id && e.zk_user_id)
        .map((e: any) => e.zk_user_id)
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

    // Resuelve PINs huérfanos contra el mapeo actual
    const pinNameMap: Record<number, string> = {};
    if (orphanPins.length) {
      const { data: mappings } = await supabase
        .from('zk_user_mappings')
        .select('zk_pin, user_id, unregistered_athlete_id')
        .eq('school_id', schoolId)
        .in('zk_pin', orphanPins);

      const mappedUserIds = [...new Set((mappings || []).map((m: any) => m.user_id).filter(Boolean))];
      const mappedUaIds   = [...new Set((mappings || []).map((m: any) => m.unregistered_athlete_id).filter(Boolean))];

      const extraProfileMap: Record<string, string> = {};
      if (mappedUserIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', mappedUserIds);
        (profiles || []).forEach((p: any) => { extraProfileMap[p.id] = p.full_name; });
      }
      const extraUaMap: Record<string, string> = {};
      if (mappedUaIds.length) {
        const { data: uas } = await supabase.from('unregistered_athletes').select('id, full_name').in('id', mappedUaIds);
        (uas || []).forEach((u: any) => { extraUaMap[u.id] = u.full_name; });
      }

      (mappings || []).forEach((m: any) => {
        const name = m.user_id ? extraProfileMap[m.user_id] : extraUaMap[m.unregistered_athlete_id];
        if (name) pinNameMap[m.zk_pin] = name;
      });
    }

    const enriched = (events || []).map((e: any) => ({
      ...e,
      user_name:
        (e.user_id && profileMap[e.user_id])
          ? profileMap[e.user_id]
          : (e.unregistered_athlete_id && uaMap[e.unregistered_athlete_id])
            ? uaMap[e.unregistered_athlete_id]
            : (pinNameMap[e.zk_user_id] ?? `ZK#${e.zk_user_id}`),
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

    invalidateMappingCache(pin);

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
    if (mappedUaIds.size > 0) {
      uaq = uaq.not('id', 'in', `(${Array.from(mappedUaIds).join(',')})`);
    }
    if (q) uaq = uaq.ilike('full_name', `%${q}%`);
    const { data: uas } = await uaq.limit(50);
    const unregistered = (uas || [])
      .map((u: any) => ({ unregistered_athlete_id: u.id, full_name: u.full_name, role: null, type: 'unregistered' }));

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

    invalidateMappingCache(zk_pin);

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
      .select('id, serial_number, device_name, ip_address, ip_check_mode, direction, location, is_active, last_seen_at, brand, door_drive_time_seconds')
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
    const { serial_number, device_name, ip_address, ip_check_mode, direction, location, brand, door_drive_time_seconds } = req.body as {
      serial_number: string; device_name: string; ip_address?: string; ip_check_mode?: 'off' | 'warn' | 'enforce';
      direction: 'entry' | 'exit' | 'both'; location?: string; brand?: string;
      door_drive_time_seconds?: number;
    };

    if (!serial_number || !device_name || !direction) {
      return res.status(400).json({ error: 'serial_number, device_name y direction son requeridos' });
    }
    if (!['entry', 'exit', 'both'].includes(direction)) {
      return res.status(400).json({ error: 'direction debe ser entry, exit o both' });
    }
    if (ip_check_mode && !['off', 'warn', 'enforce'].includes(ip_check_mode)) {
      return res.status(400).json({ error: 'ip_check_mode debe ser off, warn o enforce' });
    }

    const { data: device, error } = await supabase
      .from('turnstile_devices')
      .insert({
        school_id:      schoolId,
        serial_number:  serial_number.trim(),
        device_name:    device_name.trim(),
        ip_address:     ip_address?.trim() || null,
        ip_check_mode:  ip_check_mode || 'off',
        direction,
        location:       location?.trim() || null,
        is_active:      true,
        brand:          brand?.trim() || 'Genérico',
        door_drive_time_seconds: door_drive_time_seconds ?? 5,
      })
      .select('id, serial_number, device_name, ip_address, ip_check_mode, direction, location, is_active, brand, door_drive_time_seconds')
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
    const { serial_number, device_name, ip_address, ip_check_mode, direction, location, is_active, brand, door_drive_time_seconds } = req.body as {
      serial_number?: string; device_name?: string; ip_address?: string | null; ip_check_mode?: 'off' | 'warn' | 'enforce';
      direction?: 'entry' | 'exit' | 'both'; location?: string; is_active?: boolean; brand?: string;
      door_drive_time_seconds?: number;
    };

    if (direction && !['entry', 'exit', 'both'].includes(direction)) {
      return res.status(400).json({ error: 'direction debe ser entry, exit o both' });
    }
    if (ip_check_mode && !['off', 'warn', 'enforce'].includes(ip_check_mode)) {
      return res.status(400).json({ error: 'ip_check_mode debe ser off, warn o enforce' });
    }

    const updates: Record<string, unknown> = {};
    if (serial_number !== undefined) updates.serial_number = serial_number.trim();
    if (device_name   !== undefined) updates.device_name   = device_name.trim();
    if (ip_address    !== undefined) updates.ip_address     = ip_address?.trim() || null;
    if (ip_check_mode !== undefined) updates.ip_check_mode  = ip_check_mode;
    if (direction     !== undefined) updates.direction      = direction;
    if (location      !== undefined) updates.location       = location?.trim() || null;
    if (is_active     !== undefined) updates.is_active       = is_active;
    if (brand         !== undefined) updates.brand          = brand.trim();
    if (door_drive_time_seconds !== undefined) updates.door_drive_time_seconds = door_drive_time_seconds;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    // Primero obtenemos el dispositivo actual (serial anterior por si cambia, e
    // ip_address actual para el guardarraíl de 'enforce' de abajo).
    const { data: oldDevice } = await supabase
      .from('turnstile_devices')
      .select('serial_number, ip_address')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle();

    // Guardarraíl: no permitir 'enforce' si no va a quedar ip_address (evita
    // bloquear al propio device sin ninguna IP contra la que comparar).
    if (updates.ip_check_mode === 'enforce') {
      const resultingIp = updates.ip_address !== undefined ? updates.ip_address : oldDevice?.ip_address;
      if (!resultingIp) {
        return res.status(400).json({ error: 'No se puede activar enforce sin ip_address' });
      }
    }

    const { data: device, error } = await supabase
      .from('turnstile_devices')
      .update(updates)
      .eq('id', id)
      .eq('school_id', schoolId) // 🔒 evita editar dispositivos de otra escuela
      .select('id, serial_number, device_name, ip_address, ip_check_mode, direction, location, is_active, brand, door_drive_time_seconds')
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

// ─── GET /api/v1/access/hour-bank-balances ───────────────────────────────────
// F6: vista agregada para owner/coach — saldo de TODOS los atletas con plan de
// horas de la escuela, de un vistazo. Mismo patrón de resolución de nombre
// (profiles / unregistered_athletes) que ya usa este archivo en /events y
// /overdue-payments — child_id no se resuelve porque el ecosistema ADMS
// (zk_user_mappings, access_events) tampoco lo maneja, ver ese patrón arriba.
router.get('/hour-bank-balances', requireAuth, requireRole('owner', 'admin', 'school_admin', 'coach'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, user_id, unregistered_athlete_id, offering_plans!inner(name, included_minutes_per_period)')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .not('offering_plans.included_minutes_per_period', 'is', null);

    if (!enrollments || enrollments.length === 0) return res.json({ balances: [] });

    const userIds = [...new Set(enrollments.map((e: any) => e.user_id).filter(Boolean))];
    const uaIds   = [...new Set(enrollments.map((e: any) => e.unregistered_athlete_id).filter(Boolean))];

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

    const balances = [];
    for (const e of enrollments as any[]) {
      const { data: periodId } = await supabase.rpc('get_or_open_hour_bank_period', { p_enrollment_id: e.id });
      if (!periodId) continue;

      const { data: period } = await supabase
        .from('hour_bank_periods')
        .select('period_start, period_end, included_minutes, reserved_minutes, consumed_minutes')
        .eq('id', periodId)
        .maybeSingle();
      if (!period) continue;

      balances.push({
        enrollment_id: e.id,
        athlete_name: e.user_id ? (profileMap[e.user_id] ?? 'Usuario') : (uaMap[e.unregistered_athlete_id] ?? 'Atleta'),
        plan_name: e.offering_plans?.name ?? 'Plan',
        period_start: period.period_start,
        period_end: period.period_end,
        included_minutes: period.included_minutes,
        reserved_minutes: period.reserved_minutes,
        consumed_minutes: period.consumed_minutes,
        available_minutes: period.included_minutes - period.reserved_minutes - period.consumed_minutes,
      });
    }

    return res.json({ balances });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al listar los saldos del banco de horas' });
  }
});

// ─── Banco de horas por torniquete (F5) — bandeja de revisión del owner ──────
// docs/specs/dreamers-banco-de-horas-torniquete.md, D-8. A propósito NO se usa
// requireRole('owner'): su PRIVILEGED_ROLES deja pasar también a admin/
// super_admin (ver authMiddleware.ts:47), y acá el negocio pidió "solo owner",
// sin excepción — por eso el chequeo de rol es manual en cada handler.

// ─── GET /api/v1/access/hour-bank-visits ─────────────────────────────────────
router.get('/hour-bank-visits', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId, role } = req;
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner de la escuela puede ver la bandeja de revisión del banco de horas' });
    }

    const status = (req.query.status as string) || 'pending_review';

    const { data: visits, error } = await supabase
      .from('hour_bank_visits')
      .select('id, enrollment_id, period_id, status, started_at, ended_at, billed_minutes, auto_closed, corrected_by, corrected_at, correction_reason')
      .eq('school_id', schoolId)
      .eq('status', status)
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: 'Error al listar visitas' });

    return res.json({ visits: visits ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al listar visitas del banco de horas' });
  }
});

// ─── PATCH /api/v1/access/hour-bank-visits/:id/correct ───────────────────────
// El owner ajusta la hora real de salida de una visita pending_review. Recién
// acá se factura — mismo cómputo de gracia que closeHourBankVisit en
// access-adms.ts (F3), pero disparado a mano en vez de por el torniquete.
router.patch('/hour-bank-visits/:id/correct', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId, role } = req;
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner de la escuela puede corregir visitas del banco de horas' });
    }

    const { id } = req.params;
    const { ended_at, reason } = req.body as { ended_at?: string; reason?: string };
    if (!ended_at || Number.isNaN(new Date(ended_at).getTime())) {
      return res.status(400).json({ error: 'ended_at (ISO) es requerido' });
    }

    const { data: visit } = await supabase
      .from('hour_bank_visits')
      .select('id, period_id, status, started_at')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });
    if (visit.status !== 'pending_review') {
      return res.status(409).json({ error: `Solo se corrigen visitas pending_review (esta está en ${visit.status})` });
    }
    if (new Date(ended_at) < new Date(visit.started_at)) {
      return res.status(400).json({ error: 'ended_at no puede ser anterior a started_at' });
    }
    if (!visit.period_id) {
      return res.status(422).json({ error: 'Visita sin período asociado — no se puede facturar' });
    }

    // Ajusta el último segmento (el que el auto-cierre cortó con su cutoff) a
    // la hora real que da el owner.
    const { data: lastSeg } = await supabase
      .from('hour_bank_visit_segments')
      .select('id, entered_at')
      .eq('visit_id', id)
      .order('entered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastSeg) return res.status(422).json({ error: 'Visita sin segmentos — dato inconsistente' });

    await supabase
      .from('hour_bank_visit_segments')
      .update({ exited_at: ended_at })
      .eq('id', lastSeg.id);

    const { data: segments } = await supabase
      .from('hour_bank_visit_segments')
      .select('entered_at, exited_at')
      .eq('visit_id', id);

    const settings = await getHourBankSettings(schoolId);
    const rawMinutes = (segments ?? []).reduce((sum: number, s: any) => {
      if (!s.exited_at) return sum;
      return sum + Math.round((new Date(s.exited_at).getTime() - new Date(s.entered_at).getTime()) / 60000);
    }, 0);
    const billedMinutes = Math.max(0, rawMinutes - settings.entryGraceMinutes - settings.exitGraceMinutes);

    const { data: moveResult } = await supabase.rpc('move_hour_bank', {
      p_period_id: visit.period_id,
      p_reserved_delta: 0,
      p_consumed_delta: billedMinutes,
    });

    await supabase
      .from('hour_bank_visits')
      .update({
        status: 'corrected',
        ended_at,
        billed_minutes: billedMinutes,
        corrected_by: req.user.id,
        corrected_at: new Date().toISOString(),
        correction_reason: reason?.trim() || null,
      })
      .eq('id', id);

    // D-10: mismo patrón de notificación que closeHourBankVisit (F3) y que
    // payment_overdue — solo avisa, sin bloqueo automático.
    const available = (moveResult as any)?.available_minutes;
    if (typeof available === 'number' && available < 0) {
      const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
      if (school?.owner_id) {
        await supabase.from('notifications').insert({
          user_id:  school.owner_id,
          school_id: schoolId,
          type:     'hour_bank_overage',
          title:    '⏱️ Banco de horas — saldo excedido',
          message:  `Corrección manual: ${billedMinutes} min facturados, banco del período en ${available} min (excedido).`,
          link:     '/school/access-control',
        });
      }
    }

    return res.json({ success: true, billed_minutes: billedMinutes, available_minutes: available });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al corregir la visita' });
  }
});

// ─── Banco de horas — reservas (F4) ──────────────────────────────────────────
// docs/specs/dreamers-banco-de-horas-torniquete.md, D-11: reserva flexible
// ("hoy voy"), sin franja horaria — tabla propia hour_bank_reservations, no
// session_bookings. Autorización: staff de la escuela, o el dueño de la
// inscripción (el atleta adulto o el padre del menor).

async function canManageHourBankEnrollment(
  req: AuthenticatedRequest,
  enrollment: { user_id: string | null; child_id: string | null }
): Promise<boolean> {
  if (['owner', 'admin', 'school_admin', 'coach'].includes(req.role)) return true;
  if (enrollment.user_id && enrollment.user_id === req.user.id) return true;
  if (enrollment.child_id) {
    const { data } = await supabase
      .from('children')
      .select('id')
      .eq('id', enrollment.child_id)
      .eq('parent_id', req.user.id)
      .maybeSingle();
    if (data) return true;
  }
  return false;
}

// ─── GET /api/v1/access/hour-bank-balance/:enrollmentId ──────────────────────
router.get('/hour-bank-balance/:enrollmentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { enrollmentId } = req.params;

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, user_id, child_id, school_id')
      .eq('id', enrollmentId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada' });
    if (!(await canManageHourBankEnrollment(req, enrollment))) {
      return res.status(403).json({ error: 'Sin permiso para ver el saldo de esta inscripción' });
    }

    const { data: periodId } = await supabase.rpc('get_or_open_hour_bank_period', { p_enrollment_id: enrollmentId });
    if (!periodId) {
      return res.json({ has_hours_plan: false });
    }

    const { data: period } = await supabase
      .from('hour_bank_periods')
      .select('id, period_start, period_end, included_minutes, reserved_minutes, consumed_minutes')
      .eq('id', periodId)
      .maybeSingle();

    if (!period) return res.status(500).json({ error: 'Error al leer el período' });

    return res.json({
      has_hours_plan: true,
      period_id: period.id,
      period_start: period.period_start,
      period_end: period.period_end,
      included_minutes: period.included_minutes,
      reserved_minutes: period.reserved_minutes,
      consumed_minutes: period.consumed_minutes,
      available_minutes: period.included_minutes - period.reserved_minutes - period.consumed_minutes,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al leer el saldo del banco de horas' });
  }
});

// ─── POST /api/v1/access/hour-bank-reservations ──────────────────────────────
router.post('/hour-bank-reservations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { enrollment_id, reservation_date } = req.body as { enrollment_id?: string; reservation_date?: string };

    if (!enrollment_id || !reservation_date || !/^\d{4}-\d{2}-\d{2}$/.test(reservation_date)) {
      return res.status(400).json({ error: 'enrollment_id y reservation_date (YYYY-MM-DD) son requeridos' });
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, user_id, child_id, school_id, status')
      .eq('id', enrollment_id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada' });
    if (enrollment.status !== 'active') return res.status(400).json({ error: 'La inscripción no está activa' });
    if (!(await canManageHourBankEnrollment(req, enrollment))) {
      return res.status(403).json({ error: 'Sin permiso para reservar sobre esta inscripción' });
    }

    const { data: result, error } = await supabase.rpc('reserve_hour_bank', {
      p_enrollment_id: enrollment_id,
      p_reservation_date: reservation_date,
      p_created_by: req.user.id,
    });

    if (error) return res.status(500).json({ error: 'Error al reservar' });

    const r = result as any;
    if (!r?.reserved) {
      // D-2: el sistema bloquea la reserva si no alcanza el saldo — el 422
      // lleva available_minutes para que el frontend muestre el saldo real
      // (D-9-bis) en vez de un mensaje genérico.
      return res.status(422).json(r);
    }

    return res.status(201).json(r);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al reservar en el banco de horas' });
  }
});

// ─── POST /api/v1/access/hour-bank-reservations/:id/cancel ───────────────────
router.post('/hour-bank-reservations/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { data: reservation } = await supabase
      .from('hour_bank_reservations')
      .select('id, school_id, enrollment_id')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!reservation) return res.status(404).json({ error: 'Reserva no encontrada' });

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, user_id, child_id')
      .eq('id', reservation.enrollment_id)
      .maybeSingle();

    if (!enrollment || !(await canManageHourBankEnrollment(req, enrollment))) {
      return res.status(403).json({ error: 'Sin permiso para cancelar esta reserva' });
    }

    const { data: result, error } = await supabase.rpc('cancel_hour_bank_reservation', { p_reservation_id: id });
    if (error) return res.status(500).json({ error: 'Error al cancelar' });

    const r = result as any;
    if (!r?.cancelled) return res.status(409).json(r);

    return res.json(r);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
});

export default router;
