import { Router, Response, Request } from 'express';
import express from 'express';
import { supabase } from '../config/supabase';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── Whitelist de seriales reales ────────────────────────────────────────────
const DEVICE_MAP: Record<string, 'entry' | 'exit'> = {
  'JJA1254900898': 'exit',  // Lector Salida  GYM RM — 192.168.1.5
  'JJA1254900899': 'entry', // Lector Entrada GYM RM — 192.168.1.4
};

const SCHOOL_ID = '2137182d-a695-4695-8e5a-61151fc59196';

const VERIFY_METHOD: Record<number, string> = {
  1: 'fingerprint', 2: 'card', 3: 'pin', 4: 'fingerprint', 15: 'fingerprint',
};

// ─── Allowlist de IP del/los lector(es) ──────────────────────────────────────
// Opt-in: si ACCESS_DEVICE_IP_ALLOWLIST está vacío no se aplica (no rompe dev).
// En prod: setear a la IP pública del gym (RMGYM: 181.63.24.103). El protocolo
// /iclock no soporta auth por header, así que la IP es la barrera práctica.
const IP_ALLOWLIST = (process.env.ACCESS_DEVICE_IP_ALLOWLIST || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function clientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return (xff.split(',')[0] || req.socket?.remoteAddress || '').trim();
}

// ─── express.text() SOLO para rutas /iclock/* (+ allowlist) ───────────────────
router.use('/iclock', (req, res, next) => {
  if (IP_ALLOWLIST.length) {
    const ip = clientIp(req);
    if (!IP_ALLOWLIST.includes(ip)) {
      console.warn(`[ADMS] IP no autorizada en /iclock: ${ip}`);
      return res.type('text/plain').status(403).send('');
    }
  }
  if (req.method === 'GET') return next();
  express.text({ type: '*/*' })(req, res, next);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function logDebug(msg: string) {
  try {
    const logPath = path.join(__dirname, '../../debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${msg}\n`);
  } catch (err) {
    console.error('Failed to write debug log:', err);
  }
}

// ─── GET /debug-logs (público, sin auth — solo para diagnóstico) ──────────────
router.get('/debug-logs', (req: Request, res: Response) => {
  try {
    const logPath = path.join(__dirname, '../../debug.log');
    if (!fs.existsSync(logPath)) {
      return res.type('text/plain').send('Log file does not exist yet.');
    }
    const content = fs.readFileSync(logPath, 'utf8');
    return res.type('text/plain').send(content || '(vacío)');
  } catch (err: any) {
    return res.status(500).send(`Error reading log: ${err.message}`);
  }
});

router.post('/debug-logs/clear', (req: Request, res: Response) => {
  try {
    const logPath = path.join(__dirname, '../../debug.log');
    fs.writeFileSync(logPath, '');
    return res.send('Cleared.');
  } catch (err: any) {
    return res.status(500).send(err.message);
  }
});



// Persiste tráfico de PROTOCOLO ADMS (bajo volumen) en adms_device_log para la
// vista super-admin. Fire-and-forget: no bloquea ni rompe el flujo del lector.
function logDevice(eventType: string, detail: Record<string, unknown>, sn?: string): void {
  void supabase
    .from('adms_device_log')
    .insert({ school_id: SCHOOL_ID, sn: sn ?? null, event_type: eventType, detail })
    .then(() => {}, () => {});
}

async function getDeviceId(sn: string): Promise<string | null> {
  const { data } = await supabase
    .from('turnstile_devices')
    .select('id')
    .eq('serial_number', sn)
    .eq('school_id', SCHOOL_ID)
    .maybeSingle();
  return data?.id ?? null;
}

async function touchDevice(sn: string): Promise<void> {
  await supabase
    .from('turnstile_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('serial_number', sn)
    .eq('school_id', SCHOOL_ID);
}

// ─── Stamp dinámico — max(occurred_at) del serial como Unix timestamp ─────────
// El F22 solo envía eventos POSTERIORES al Stamp que le damos en el handshake.
// Con Stamp=0 vuelca todo el histórico; con el valor real solo manda lo nuevo.
async function getLastStamp(sn: string): Promise<number> {
  try {
    const deviceId = await getDeviceId(sn);
    if (!deviceId) return 0;

    const { data } = await supabase
      .from('access_events')
      .select('occurred_at')
      .eq('device_id', deviceId)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.occurred_at) return 0;
    // Unix timestamp en segundos (el F22 usa segundos, no milisegundos)
    return Math.floor(new Date(data.occurred_at).getTime() / 1000);
  } catch {
    return 0;
  }
}

// ─── Cache de mapeo PIN → identidad (perf #6) ────────────────────────────────
// Solo se cachea la resolución PIN→user/atleta (estable). La validación de
// enrollment/pago SIEMPRE se consulta fresca más abajo.
type Mapping = { userId: string | null; unregisteredAthleteId: string | null };
const MAPPING_TTL_MS = 5 * 60 * 1000;
const mappingCache = new Map<number, { value: Mapping | null; at: number }>();

export function invalidateMappingCache(pin?: number): void {
  if (typeof pin === 'number') mappingCache.delete(pin);
  else mappingCache.clear();
}

async function resolveMapping(pin: number): Promise<Mapping | null> {
  const cached = mappingCache.get(pin);
  if (cached && Date.now() - cached.at < MAPPING_TTL_MS) return cached.value;

  const { data } = await supabase
    .from('zk_user_mappings')
    .select('user_id, unregistered_athlete_id')
    .eq('school_id', SCHOOL_ID)
    .eq('zk_pin', pin)
    .maybeSingle();

  const value: Mapping | null =
    data && (data.user_id || data.unregistered_athlete_id)
      ? { userId: data.user_id ?? null, unregisteredAthleteId: data.unregistered_athlete_id ?? null }
      : null;

  mappingCache.set(pin, { value, at: Date.now() });
  return value;
}

// ¿El usuario es staff de la escuela? (owner/admin/coach) → acceso sin enrollment.
const staffCache = new Map<string, { value: boolean; at: number }>();

async function isStaff(userId: string): Promise<boolean> {
  const cached = staffCache.get(userId);
  if (cached && Date.now() - cached.at < MAPPING_TTL_MS) return cached.value;

  const { data: school } = await supabase
    .from('schools').select('owner_id').eq('id', SCHOOL_ID).maybeSingle();

  let value = school?.owner_id === userId;
  if (!value) {
    const { data: member } = await supabase
      .from('school_members')
      .select('role')
      .eq('school_id', SCHOOL_ID)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'school_admin', 'coach', 'staff'])
      .limit(1)
      .maybeSingle();
    value = !!member;
  }

  staffCache.set(userId, { value, at: Date.now() });
  return value;
}

async function validateAccess(zkPin: string): Promise<{
  granted: boolean;
  reason?: string;
  userId?: string;
  unregisteredAthleteId?: string;
  userName?: string;
}> {
  const pin = parseInt(zkPin) || 0;

  // 1. Resolver mapeo PIN → user/atleta (con cache)
  const mapping = await resolveMapping(pin);

  if (!mapping) {
    return { granted: false, reason: 'unknown_user' };
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const isRegistered = !!mapping.userId;

  // 1.b STAFF (owner/admin/coach): concede sin enrollment ni pago.
  if (isRegistered && await isStaff(mapping.userId!)) {
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', mapping.userId).maybeSingle();
    return {
      granted: true,
      userId: mapping.userId!,
      userName: profile?.full_name ?? 'Staff',
    };
  }

  // 2. Verificar enrollment activo — filtra por user_id o unregistered_athlete_id
  const enrollQuery = supabase
    .from('enrollments')
    .select('id, status, expires_at')
    .eq('school_id', SCHOOL_ID)
    .eq('status', 'active');

  const { data: enrollment } = await (isRegistered
    ? enrollQuery.eq('user_id', mapping.userId).maybeSingle()
    : enrollQuery.eq('unregistered_athlete_id', mapping.unregisteredAthleteId).maybeSingle()
  );

  if (!enrollment) {
    return {
      granted: false,
      reason: 'no_enrollment',
      userId: mapping.userId ?? undefined,
      unregisteredAthleteId: mapping.unregisteredAthleteId ?? undefined,
    };
  }

  if (enrollment.expires_at && enrollment.expires_at < today) {
    return {
      granted: false,
      reason: 'enrollment_expired',
      userId: mapping.userId ?? undefined,
      unregisteredAthleteId: mapping.unregisteredAthleteId ?? undefined,
    };
  }

  // 3. Verificar pago al día
  const payQuery = supabase
    .from('payments')
    .select('status')
    .eq('school_id', SCHOOL_ID)
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: payment } = await (isRegistered
    ? payQuery.eq('user_id', mapping.userId).maybeSingle()
    : payQuery.eq('unregistered_athlete_id', mapping.unregisteredAthleteId).maybeSingle()
  );

  if (payment?.status === 'overdue') {
    return {
      granted: false,
      reason: 'payment_overdue',
      userId: mapping.userId ?? undefined,
      unregisteredAthleteId: mapping.unregisteredAthleteId ?? undefined,
    };
  }

  // 4. Obtener nombre del atleta para el log
  let userName = 'Usuario';

  if (isRegistered) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', mapping.userId)
      .maybeSingle();
    userName = profile?.full_name ?? 'Usuario';
  } else {
    const { data: ua } = await supabase
      .from('unregistered_athletes')
      .select('full_name')
      .eq('id', mapping.unregisteredAthleteId)
      .maybeSingle();
    userName = ua?.full_name ?? 'Atleta';
  }

  return {
    granted: true,
    userId: mapping.userId ?? undefined,
    unregisteredAthleteId: mapping.unregisteredAthleteId ?? undefined,
    userName,
  };
}

// ─── GET /iclock/cdata — Handshake inicial ────────────────────────────────────
router.get('/iclock/cdata', async (req: Request, res: Response) => {
  const sn = (req.query.SN || req.query.sn) as string;
  logDebug(`GET /iclock/cdata | SN: ${sn}`);

  if (!sn || !DEVICE_MAP[sn]) {
    console.warn(`[ADMS] Handshake serial desconocido: ${sn}`);
    return res.type('text/plain').status(200).send('');
  }

  await touchDevice(sn);
  console.log(`[ADMS] Handshake OK — ${sn} (${DEVICE_MAP[sn]})`);
  logDevice('handshake', { direction: DEVICE_MAP[sn], ip: clientIp(req) }, sn);

  const stamp = await getLastStamp(sn);
  logDebug(`Handshake ${sn} → Stamp=${stamp}`);

  const config = [
    `GET OPTION FROM: ${sn}`,
    // Stamp dinámico: Unix timestamp del último evento recibido de este serial.
    // El F22 solo enviará ATTLOGs con occurred_at > Stamp → sin backlog histórico.
    `Stamp=${stamp}`,
    `OpStamp=${stamp}`,
    `ErrorDelay=30`,
    `Delay=10`,
    `TransTimes=00:00;23:59`,
    `TransInterval=1`,
    `TransFlag=TransData AttLog OpLog EnrollUser ChgUser EnrollFP ChgFP`,
    `TimeZone=-5`,
    `Realtime=1`,
    `Encrypt=None`,
  ].join('\r\n');

  return res.type('text/plain').status(200).send(config);
});

// ─── POST /iclock/cdata — Push de eventos ATTLOG ─────────────────────────────
router.post('/iclock/cdata', async (req: Request, res: Response) => {
  const sn    = (req.query.SN    || req.query.sn)    as string;
  const table = (req.query.table || req.query.Table) as string;
  const rawBody = typeof req.body === 'string' ? req.body : '';
  logDebug(`POST /iclock/cdata | SN: ${sn} | Table: ${table} | Body length: ${rawBody.length}`);

  if (!sn || !DEVICE_MAP[sn]) {
    return res.type('text/plain').status(200).send('OK');
  }

  await touchDevice(sn);
  const direction = DEVICE_MAP[sn];
  const body      = typeof req.body === 'string' ? req.body : '';

  if (table === 'ATTLOG') {
    const lines    = body.trim().split('\n').filter(Boolean);
    const deviceId = await getDeviceId(sn);

    console.log(`[ADMS] ATTLOG ${sn} (${direction}) — ${lines.length} evento(s)`);
    // Log primeras 3 líneas para diagnóstico
    logDebug(`ATTLOG ${sn} (${direction}) | ${lines.length} líneas | primeras: ${lines.slice(0,3).join(' || ')}`);
    logDevice('attlog_batch', { count: lines.length, direction, table }, sn);

    for (const line of lines) {
      const parts      = line.trim().split('\t');
      const zkPin      = parts[0]?.trim() || '';
      const attTime    = parts[1]?.trim() || '';
      const attState   = parseInt(parts[2] || '0');
      const verifyCode = parseInt(parts[3]) || 1;
      const checkInMethod = VERIFY_METHOD[verifyCode] || 'fingerprint';

      // En torniquetes la dirección es siempre la del DEVICE_MAP (posición física).
      // AttState del F22 no es fiable: los usuarios no pulsan Check-In/Out, el valor
      // es 0 por defecto y sobreescribiría incorrectamente la dirección del dispositivo.
      void attState; // (queda parseado por si a futuro un lector es bidireccional)
      const eventDirection: 'entry' | 'exit' = direction;

      const validation = await validateAccess(zkPin);

      let occurredAt: string;
      try {
        occurredAt = new Date(attTime.replace(' ', 'T') + '-05:00').toISOString();
      } catch {
        occurredAt = new Date().toISOString();
      }

      // Dedup: índice único (device_id, zk_user_id, occurred_at). Si el lector
      // reenvía el backlog, ON CONFLICT DO NOTHING evita inflar access_events.
      // .select('id') sin .maybeSingle(): un duplicado devuelve [] con 200
      // (no 406). Con .maybeSingle() el Accept es object y 0 filas => 406 (ruido).
      const { data: inserted } = await supabase
        .from('access_events')
        .upsert({
          school_id:               SCHOOL_ID,
          device_id:               deviceId,
          user_id:                 validation.userId || null,
          unregistered_athlete_id: validation.unregisteredAthleteId || null,
          direction:               eventDirection,
          access_granted:          validation.granted,
          denial_reason:           validation.granted ? null : validation.reason,
          check_in_method:         checkInMethod,
          zk_user_id:              parseInt(zkPin) || null,
          raw_event:               { sn, line, table },
          occurred_at:             occurredAt,
        }, { onConflict: 'device_id,zk_user_id,occurred_at', ignoreDuplicates: true })
        .select('id');

      const eventRecord = Array.isArray(inserted) ? inserted[0] : null;

      // eventRecord null/undefined => era un duplicado (ya existía); no notificamos.
      if (eventRecord && !validation.granted && validation.reason === 'payment_overdue' && validation.userId) {
        const { data: school } = await supabase
          .from('schools').select('owner_id').eq('id', SCHOOL_ID).maybeSingle();

        if (school?.owner_id) {
          // notifications: columnas user_id, school_id, title, message, type, read, link
          await supabase.from('notifications').insert({
            user_id:  school.owner_id,
            school_id: SCHOOL_ID,
            type:     'access_denied',
            title:    '⚠️ Acceso denegado — Pago vencido',
            message:  `${validation.userName ?? 'Un miembro'} intentó ingresar pero tiene el pago vencido.`,
            link:     '/school/access-control',
          });
        }
      }

      console.log(`[ADMS] PIN:${zkPin} | ${eventDirection} (device:${direction}) | granted:${validation.granted} | ${validation.reason || 'ok'}`);
    }

    // ACK: este firmware F22 solo acepta "OK" plano como subida exitosa. Con
    // "OK: <n>" no reconocía la confirmación y reenviaba el backlog (re-volcado).
    // El dedup (índice único + upsert) protege igual contra duplicados.
    return res.type('text/plain').status(200).send('OK');
  }

  if (table === 'OPERLOG') {
    console.log(`[ADMS] OPERLOG ${sn}:`, body.substring(0, 200));
    logDevice('operlog', { preview: body.substring(0, 200) }, sn);
  }

  return res.type('text/plain').status(200).send('OK');
});

// ─── GET /iclock/getrequest — F22 consulta comandos pendientes ────────────────
router.get('/iclock/getrequest', async (req: Request, res: Response) => {
  const sn = (req.query.SN || req.query.sn) as string;
  logDebug(`GET /iclock/getrequest | SN: ${sn}`);

  if (!sn || !DEVICE_MAP[sn]) {
    return res.type('text/plain').status(200).send('OK');
  }

  await touchDevice(sn);
  const deviceId = await getDeviceId(sn);
  if (!deviceId) return res.type('text/plain').status(200).send('OK');

  const { data: commands } = await supabase
    .from('device_commands')
    .select('id, cmd_seq, command_type, metadata')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('issued_at', { ascending: true })
    .limit(5);

  // Limpiar expirados
  await supabase
    .from('device_commands')
    .update({ status: 'expired' })
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (!commands || commands.length === 0) {
    return res.type('text/plain').status(200).send('OK');
  }

  const commandLines = commands.map((cmd: any) => {
    const meta = cmd.metadata || {};

    if (cmd.command_type === 'enroll_user') {
      const fields = [`PIN=${meta.pin}`, `Name=${meta.name}`, `Pri=0`];
      if (meta.card) fields.push(`Card=${meta.card}`);
      return `C:${cmd.cmd_seq}:DATA UPDATE USERINFO ${fields.join('\t')}`;
    }
    if (cmd.command_type === 'delete_user') {
      return `C:${cmd.cmd_seq}:DATA DELETE USERINFO PIN=${meta.pin}`;
    }
    if (cmd.command_type === 'disable_user') {
      return `C:${cmd.cmd_seq}:DATA UPDATE USERINFO PIN=${meta.pin}\tEnable=0`;
    }
    if (cmd.command_type === 'enable_user') {
      return `C:${cmd.cmd_seq}:DATA UPDATE USERINFO PIN=${meta.pin}\tEnable=1`;
    }
    if (cmd.command_type === 'open_door') {
      return `C:${cmd.cmd_seq}:UNLOCK`;
    }
    if (cmd.command_type === 'reboot') {
      // Fuerza al F22 a re-registrarse: tras el reboot hace GET /iclock/cdata
      // (handshake) y recibe el Stamp dinámico → resetea su puntero de subida.
      return `C:${cmd.cmd_seq}:REBOOT`;
    }
    return null;
  }).filter(Boolean).join('\r\n');

  console.log(`[ADMS] getrequest ${sn} — ${commands.length} comando(s)`);
  if (commands.length) logDevice('getrequest', { count: commands.length }, sn);
  return res.type('text/plain').status(200).send(commandLines);
});

// ─── POST /iclock/devicecmd — F22 confirma ejecución ─────────────────────────
router.post('/iclock/devicecmd', async (req: Request, res: Response) => {
  const sn   = (req.query.SN || req.query.sn) as string;
  const body = typeof req.body === 'string' ? req.body : '';
  logDebug(`POST /iclock/devicecmd | SN: ${sn} | Body: ${body}`);

  if (!sn || !DEVICE_MAP[sn]) {
    return res.type('text/plain').status(200).send('OK');
  }

  const params: Record<string, string> = {};
  body.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[k.trim()] = (v || '').trim();
  });

  const cmdId      = params['ID']     || params['id'];
  const returnCode = parseInt(params['Return'] || params['return'] || '-1');
  const cmdText    = params['CMD']    || params['cmd'] || '';

  console.log(`[ADMS] devicecmd ${sn} | ID:${cmdId} | Return:${returnCode} | CMD:${cmdText}`);
  logDevice(returnCode === 0 ? 'devicecmd' : 'error', { cmdId, returnCode, cmd: cmdText }, sn);

  if (cmdId) {
    const success = returnCode === 0;

    // El F22 trunca el UUID que devuelve (buffer fijo) → un PATCH por id fallaba
    // con 22P02 y el comando quedaba 'pending' en loop infinito. Ahora enviamos
    // cmd_seq (entero corto) en C:<seq>: y confirmamos por esa columna. Si llega
    // algo no-numérico (comando viejo), caemos a id por compatibilidad.
    const trimmed = cmdId.trim();
    const seq = Number.parseInt(trimmed, 10);
    const matchBySeq = Number.isFinite(seq) && String(seq) === trimmed;

    await supabase
      .from('device_commands')
      .update({
        status:        success ? 'executed' : 'failed',
        executed_at:   new Date().toISOString(),
        error_message: success ? null : `Return code: ${returnCode}`,
      })
      .eq(matchBySeq ? 'cmd_seq' : 'id', matchBySeq ? seq : trimmed);

    if (returnCode === -1002) {
      console.error(`[ADMS] ⚠️ Error -1002 — Usar DATA UPDATE/DELETE USERINFO, no USER ADD/DEL`);
    }
  }

  return res.type('text/plain').status(200).send('OK');
});

export default router;
