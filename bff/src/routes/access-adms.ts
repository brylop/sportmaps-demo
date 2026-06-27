import { Router, Response, Request } from 'express';
import express from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// ─── Whitelist de seriales reales ────────────────────────────────────────────
const DEVICE_MAP: Record<string, 'entry' | 'exit'> = {
  'JJA1254900898': 'exit',  // Lector Salida GYM RM — 192.168.1.5
  'JJA1254900899': 'entry', // Lector Entrada  GYM RM — 192.168.1.4
};

const SCHOOL_ID = '2137182d-a695-4695-8e5a-61151fc59196';

const VERIFY_METHOD: Record<number, string> = {
  1: 'fingerprint', 2: 'card', 3: 'pin', 4: 'fingerprint', 15: 'fingerprint',
};

// ─── express.text() SOLO para rutas /iclock/* ────────────────────────────────
router.use('/iclock', (req, res, next) => {
  if (req.method === 'GET') return next();
  express.text({ type: '*/*' })(req, res, next);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

async function validateAccess(zkPin: string): Promise<{
  granted: boolean;
  reason?: string;
  userId?: string;
  unregisteredAthleteId?: string;
  userName?: string;
}> {
  const pin = parseInt(zkPin) || 0;

  // 1. Buscar mapeo PIN → user en zk_user_mappings
  const { data: mapping } = await supabase
    .from('zk_user_mappings')
    .select('user_id, unregistered_athlete_id')
    .eq('school_id', SCHOOL_ID)
    .eq('zk_pin', pin)
    .maybeSingle();

  if (!mapping || (!mapping.user_id && !mapping.unregistered_athlete_id)) {
    return { granted: false, reason: 'unknown_user' };
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const isRegistered = !!mapping.user_id;

  // 2. Verificar enrollment activo — filtra por user_id o unregistered_athlete_id
  const enrollQuery = supabase
    .from('enrollments')
    .select('id, status, expires_at')
    .eq('school_id', SCHOOL_ID)
    .eq('status', 'active');

  const { data: enrollment } = await (isRegistered
    ? enrollQuery.eq('user_id', mapping.user_id).maybeSingle()
    : enrollQuery.eq('unregistered_athlete_id', mapping.unregistered_athlete_id).maybeSingle()
  );

  if (!enrollment) {
    return {
      granted: false,
      reason: 'no_enrollment',
      userId: mapping.user_id ?? undefined,
      unregisteredAthleteId: mapping.unregistered_athlete_id ?? undefined,
    };
  }

  if (enrollment.expires_at && enrollment.expires_at < today) {
    return {
      granted: false,
      reason: 'enrollment_expired',
      userId: mapping.user_id ?? undefined,
      unregisteredAthleteId: mapping.unregistered_athlete_id ?? undefined,
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
    ? payQuery.eq('user_id', mapping.user_id).maybeSingle()
    : payQuery.eq('unregistered_athlete_id', mapping.unregistered_athlete_id).maybeSingle()
  );

  if (payment?.status === 'overdue') {
    return {
      granted: false,
      reason: 'payment_overdue',
      userId: mapping.user_id ?? undefined,
      unregisteredAthleteId: mapping.unregistered_athlete_id ?? undefined,
    };
  }

  // 4. Obtener nombre del atleta para el log
  let userName = 'Usuario';

  if (isRegistered) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', mapping.user_id)
      .maybeSingle();
    userName = profile?.full_name ?? 'Usuario';
  } else {
    const { data: ua } = await supabase
      .from('unregistered_athletes')
      .select('full_name')
      .eq('id', mapping.unregistered_athlete_id)
      .maybeSingle();
    userName = ua?.full_name ?? 'Atleta';
  }

  return {
    granted: true,
    userId: mapping.user_id ?? undefined,
    unregisteredAthleteId: mapping.unregistered_athlete_id ?? undefined,
    userName,
  };
}

// ─── GET /iclock/cdata — Handshake inicial ────────────────────────────────────
router.get('/iclock/cdata', async (req: Request, res: Response) => {
  const sn = (req.query.SN || req.query.sn) as string;

  if (!sn || !DEVICE_MAP[sn]) {
    console.warn(`[ADMS] Handshake serial desconocido: ${sn}`);
    return res.type('text/plain').status(200).send('');
  }

  await touchDevice(sn);
  console.log(`[ADMS] Handshake OK — ${sn} (${DEVICE_MAP[sn]})`);

  const config = [
    `GET OPTION FROM: ${sn}`,
    `Stamp=9999`,
    `OpStamp=9999`,
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

    for (const line of lines) {
      const parts      = line.trim().split('\t');
      const zkPin      = parts[0]?.trim() || '';
      const attTime    = parts[1]?.trim() || '';
      const attState   = parseInt(parts[2] || '0');
      const verifyCode = parseInt(parts[3]) || 1;
      const checkInMethod = VERIFY_METHOD[verifyCode] || 'fingerprint';

      // Dirección basada en AttState del F22
      // 0 = Check-In (entrada), 1 = Check-Out (salida)
      // Fallback al serial del dispositivo si AttState no es 0 ni 1
      const eventDirection: 'entry' | 'exit' =
        attState === 0 ? 'entry' :
        attState === 1 ? 'exit' :
        direction;

      const validation = await validateAccess(zkPin);

      let occurredAt: string;
      try {
        occurredAt = new Date(attTime.replace(' ', 'T') + '-05:00').toISOString();
      } catch {
        occurredAt = new Date().toISOString();
      }

      const { data: eventRecord } = await supabase
        .from('access_events')
        .insert({
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
        })
        .select('id')
        .single();

      if (!validation.granted && validation.reason === 'payment_overdue' && validation.userId) {
        const { data: school } = await supabase
          .from('schools').select('owner_id').eq('id', SCHOOL_ID).maybeSingle();

        if (school?.owner_id) {
          await supabase.from('notifications').insert({
            user_id:  school.owner_id,
            type:     'access_denied',
            title:    '⚠️ Acceso denegado — Pago vencido',
            body:     `${validation.userName ?? 'Un miembro'} intentó ingresar pero tiene el pago vencido.`,
            metadata: { access_event_id: eventRecord?.id, user_id: validation.userId, direction: eventDirection },
          });
        }
      }

      console.log(`[ADMS] PIN:${zkPin} | ${eventDirection} (device:${direction}) | granted:${validation.granted} | ${validation.reason || 'ok'}`);
    }
  }

  if (table === 'OPERLOG') {
    console.log(`[ADMS] OPERLOG ${sn}:`, body.substring(0, 200));
  }

  return res.type('text/plain').status(200).send('OK');
});

// ─── GET /iclock/getrequest — F22 consulta comandos pendientes ────────────────
router.get('/iclock/getrequest', async (req: Request, res: Response) => {
  const sn = (req.query.SN || req.query.sn) as string;

  if (!sn || !DEVICE_MAP[sn]) {
    return res.type('text/plain').status(200).send('OK');
  }

  await touchDevice(sn);
  const deviceId = await getDeviceId(sn);
  if (!deviceId) return res.type('text/plain').status(200).send('OK');

  const { data: commands } = await supabase
    .from('device_commands')
    .select('id, command_type, metadata')
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
      return `C:${cmd.id}:DATA UPDATE USERINFO ${fields.join('\t')}`;
    }
    if (cmd.command_type === 'delete_user') {
      return `C:${cmd.id}:DATA DELETE USERINFO PIN=${meta.pin}`;
    }
    if (cmd.command_type === 'disable_user') {
      return `C:${cmd.id}:DATA UPDATE USERINFO PIN=${meta.pin}\tEnable=0`;
    }
    if (cmd.command_type === 'enable_user') {
      return `C:${cmd.id}:DATA UPDATE USERINFO PIN=${meta.pin}\tEnable=1`;
    }
    if (cmd.command_type === 'open_door') {
      return `C:${cmd.id}:UNLOCK`;
    }
    return null;
  }).filter(Boolean).join('\r\n');

  console.log(`[ADMS] getrequest ${sn} — ${commands.length} comando(s)`);
  return res.type('text/plain').status(200).send(commandLines);
});

// ─── POST /iclock/devicecmd — F22 confirma ejecución ─────────────────────────
router.post('/iclock/devicecmd', async (req: Request, res: Response) => {
  const sn   = (req.query.SN || req.query.sn) as string;
  const body = typeof req.body === 'string' ? req.body : '';

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

  if (cmdId) {
    const success = returnCode === 0;
    await supabase
      .from('device_commands')
      .update({
        status:        success ? 'executed' : 'failed',
        executed_at:   new Date().toISOString(),
        error_message: success ? null : `Return code: ${returnCode}`,
      })
      .eq('id', cmdId);

    if (returnCode === -1002) {
      console.error(`[ADMS] ⚠️ Error -1002 — Usar DATA UPDATE/DELETE USERINFO, no USER ADD/DEL`);
    }
  }

  return res.type('text/plain').status(200).send('OK');
});

export default router;
