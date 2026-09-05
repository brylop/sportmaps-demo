import { Router, Response, Request } from 'express';
import express from 'express';
import { supabase } from '../config/supabase';
import fs from 'fs';
import path from 'path';
import { checkInPresenceFromEvent } from './attendance';

const router = Router();



// Filtro de backlog: el F22 re-vuelca eventos viejos en loop (flood) hasta que se
// le mueva el cursor (handshake/power-cycle). Saltamos eventos más viejos que esto:
// ya están en la BD (dedup) y reprocesarlos solo gasta validateAccess + ruido.
// Override con ADMS_BACKLOG_SKIP_HOURS. Los eventos reales llegan con segundos.
const BACKLOG_SKIP_MS = (parseInt(process.env.ADMS_BACKLOG_SKIP_HOURS || '3', 10) || 3) * 3600_000;

const VERIFY_METHOD: Record<number, string> = {
  1: 'fingerprint', 2: 'card', 3: 'pin', 4: 'fingerprint', 15: 'fingerprint',
};

// ─── Allowlist de IP del/los lector(es) ──────────────────────────────────────
// Fallback GLOBAL: opt-in, si ACCESS_DEVICE_IP_ALLOWLIST está vacío no se aplica
// (no rompe dev). Solo se usa cuando el device no tiene ip_check_mode propio
// activo (ver abajo) — o sea, hoy, para TODOS los devices existentes.
// El protocolo /iclock no soporta auth por header, así que la IP es la barrera
// práctica.
const IP_ALLOWLIST = (process.env.ACCESS_DEVICE_IP_ALLOWLIST || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function clientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return (xff.split(',')[0] || req.socket?.remoteAddress || '').trim();
}

// ─── express.text() SOLO para rutas /iclock/* (+ allowlist por device) ───────
// Allowlist POR DISPOSITIVO (turnstile_devices.ip_address + ip_check_mode,
// migración 20260821112428): cada escuela configura su propia IP pública
// desde el panel Access Control, sin tocar Render. Modos:
//   'off'     → no se chequea nada acá, cae al fallback global de arriba.
//   'warn'    → si no matchea, se loguea + se registra en adms_device_log,
//               pero NO bloquea (para validar la IP real antes de exigirla).
//   'enforce' → si no matchea, 403 (igual que el fallback global, pero acotado
//               a este device — un error de IP no tumba a otras escuelas).
// TODOS los devices existentes están en 'off' por default de la migración,
// así que este cambio no altera nada hasta que alguien active warn/enforce
// por escuela. Ver docs/specs/adms-ip-allowlist-per-device.md.
router.use('/iclock', async (req, res, next) => {
  const sn = (req.query.SN || req.query.sn) as string;
  const ip = clientIp(req);
  const device = sn ? await getDeviceBySerial(sn) : null;

  if (device && device.ipCheckMode !== 'off' && device.ipAddress) {
    const matches = ip === device.ipAddress;
    if (!matches) {
      console.warn(`[ADMS] IP no coincide (SN:${sn}, modo:${device.ipCheckMode}): recibido ${ip}, esperado ${device.ipAddress}`);
      logDevice('ip_mismatch', { expected: device.ipAddress, received: ip, mode: device.ipCheckMode }, sn, device.schoolId);
      if (device.ipCheckMode === 'enforce') {
        return res.type('text/plain').status(403).send('');
      }
      // 'warn': sigue de largo, no bloquea.
    }
  } else if (IP_ALLOWLIST.length) {
    if (!IP_ALLOWLIST.includes(ip)) {
      console.warn(`[ADMS] IP no autorizada en /iclock (SN:${sn || '?'}): ${ip}`);
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

// ─── /debug-logs — ELIMINADO (SEG-9, 2026-08-12) ─────────────────────────────
// Había aquí un GET y un POST /debug-logs{,/clear} SIN auth, y este router se
// monta en la RAÍZ (`app.use('/', admsRouter)`), así que quedaban expuestos como
// `GET /debug-logs` y `POST /debug-logs/clear` a cualquiera en internet.
//
// Lo que servían: `debug.log`, que `logDebug()` llena con seriales de lector,
// IDs de usuario del dispositivo y timestamps de entrada/salida — datos de
// asistencia de personas identificables. Y el `clear` dejaba que cualquiera
// borrara la traza del control de acceso.
//
// La allowlist de IP que sí existe cubre solo `/iclock/*` y es opt-in (vacía =
// desactivada), así que no los cubría.
//
// Se ELIMINAN en vez de ponerles auth: nadie los consumía (cero referencias en
// bff y frontend) y el disco de Render es efímero, así que como herramienta de
// diagnóstico servían de poco. `logDebug()` sigue escribiendo igual — se usa en
// 8 sitios y no se toca; lo que desaparece es la forma de leerlo por HTTP.
// Para diagnosticar, los logs de Render (pino) ya están y son el camino bueno.



// Persiste tráfico de PROTOCOLO ADMS (bajo volumen) en adms_device_log para la
// vista super-admin. Fire-and-forget: no bloquea ni rompe el flujo del lector.
function logDevice(eventType: string, detail: Record<string, unknown>, sn?: string, schoolId?: string): void {
  void supabase
    .from('adms_device_log')
    .insert({ school_id: schoolId ?? null, sn: sn ?? null, event_type: eventType, detail })
    .then(() => {}, () => {});
}

// ─── Cache de dispositivos por serial (multi-tenant, perf) ───────────────────
type DeviceInfo = {
  id: string;
  schoolId: string;
  direction: 'entry' | 'exit';
  ipAddress: string | null;
  ipCheckMode: 'off' | 'warn' | 'enforce';
  hasLocalBridge: boolean;
};
const DEVICE_CACHE_TTL_MS = 5 * 60 * 1000;
const deviceCache = new Map<string, { value: DeviceInfo | null; at: number }>();

export function invalidateDeviceCache(sn?: string): void {
  if (sn) deviceCache.delete(sn);
  else deviceCache.clear();
}

async function getDeviceBySerial(sn: string): Promise<DeviceInfo | null> {
  const cached = deviceCache.get(sn);
  if (cached && Date.now() - cached.at < DEVICE_CACHE_TTL_MS) return cached.value;

  const { data } = await supabase
    .from('turnstile_devices')
    .select('id, school_id, direction, ip_address, ip_check_mode, has_local_bridge')
    .eq('serial_number', sn)
    .eq('is_active', true)
    .maybeSingle();

  const value: DeviceInfo | null = data
    ? {
        id: data.id,
        schoolId: data.school_id,
        direction: data.direction as 'entry' | 'exit',
        ipAddress: data.ip_address ?? null,
        ipCheckMode: (data.ip_check_mode as 'off' | 'warn' | 'enforce') ?? 'off',
        hasLocalBridge: !!data.has_local_bridge,
      }
    : null;

  deviceCache.set(sn, { value, at: Date.now() });
  return value;
}

async function touchDevice(sn: string): Promise<void> {
  await supabase
    .from('turnstile_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('serial_number', sn);
}

// ─── Stamp dinámico — max(occurred_at) del serial como Unix timestamp ─────────
// El F22 solo envía eventos POSTERIORES al Stamp que le damos en el handshake.
// Con Stamp=0 vuelca todo el histórico; con el valor real solo manda lo nuevo.
async function getLastStamp(deviceId: string): Promise<number> {
  try {
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
const mappingCache = new Map<string, { value: Mapping | null; at: number }>();

export function invalidateMappingCache(pin?: number): void {
  mappingCache.clear(); // simple: si necesitas invalidar 1 solo pin, pasa también schoolId
}

async function resolveMapping(schoolId: string, pin: number): Promise<Mapping | null> {
  const key = `${schoolId}:${pin}`;
  const cached = mappingCache.get(key);
  if (cached && Date.now() - cached.at < MAPPING_TTL_MS) return cached.value;

  const { data } = await supabase
    .from('zk_user_mappings')
    .select('user_id, unregistered_athlete_id')
    .eq('school_id', schoolId)
    .eq('zk_pin', pin)
    .maybeSingle();

  const value: Mapping | null =
    data && (data.user_id || data.unregistered_athlete_id)
      ? { userId: data.user_id ?? null, unregisteredAthleteId: data.unregistered_athlete_id ?? null }
      : null;

  mappingCache.set(key, { value, at: Date.now() });
  return value;
}

// ¿El usuario es staff de la escuela? (owner/admin/coach) → acceso sin enrollment.
const staffCache = new Map<string, { value: boolean; at: number }>();

async function isStaff(schoolId: string, userId: string): Promise<boolean> {
  const key = `${schoolId}:${userId}`;
  const cached = staffCache.get(key);
  if (cached && Date.now() - cached.at < MAPPING_TTL_MS) return cached.value;

  const { data: school } = await supabase
    .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();

  let value = school?.owner_id === userId;
  if (!value) {
    const { data: member } = await supabase
      .from('school_members')
      .select('role')
      .eq('school_id', schoolId)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'school_admin', 'coach', 'staff'])
      .limit(1)
      .maybeSingle();
    value = !!member;
  }

  staffCache.set(key, { value, at: Date.now() });
  return value;
}

async function validateAccess(schoolId: string, zkPin: string): Promise<{
  granted: boolean;
  reason?: string;
  userId?: string;
  unregisteredAthleteId?: string;
  userName?: string;
  enrollmentId?: string;
}> {
  const pin = parseInt(zkPin) || 0;

  // 1. Resolver mapeo PIN → user/atleta (con cache)
  const mapping = await resolveMapping(schoolId, pin);

  if (!mapping) {
    return { granted: false, reason: 'unknown_user' };
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const isRegistered = !!mapping.userId;

  // 1.b STAFF (owner/admin/coach): concede sin enrollment ni pago.
  if (isRegistered && await isStaff(schoolId, mapping.userId!)) {
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
    .eq('school_id', schoolId)
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
      enrollmentId: enrollment.id,
    };
  }

  // 3. Verificar pago al día
  const payQuery = supabase
    .from('payments')
    .select('status')
    .eq('school_id', schoolId)
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
      enrollmentId: enrollment.id,
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
    enrollmentId: enrollment.id,
  };
}

// ─── Banco de horas (F3, docs/specs/dreamers-banco-de-horas-torniquete.md) ────
// Trackea la visita real independiente de `access_granted`: el F22 decide el
// acceso físico con su propia base local de huellas/PIN, el BFF nunca abre ni
// cierra la puerta — así que alguien puede estar físicamente adentro aunque
// nuestra capa de negocio lo haya marcado `payment_overdue`. Medir tiempo real
// es honesto con la escuela; el gate real es simplemente "¿hay inscripción con
// plan de horas?", que resuelve get_or_open_hour_bank_period devolviendo NULL
// cuando no aplica.
//
// Dos capas de aislamiento de otras escuelas (GYM RM no debe ver NADA nuevo):
//   1. hours_plan_enabled en caché — corta antes de tocar la base para el 99%
//      de los eventos de escuelas que no usan esto.
//   2. get_or_open_hour_bank_period devuelve NULL si la inscripción no tiene
//      offering_plans.included_minutes_per_period — solo Dreamers lo tiene.

type HourBankSettings = {
  enabled: boolean;
  entryGraceMinutes: number;
  exitGraceMinutes: number;
  reentryMergeMinutes: number;
};
const hourBankSettingsCache = new Map<string, { value: HourBankSettings; at: number }>();

export async function getHourBankSettings(schoolId: string): Promise<HourBankSettings> {
  const cached = hourBankSettingsCache.get(schoolId);
  if (cached && Date.now() - cached.at < DEVICE_CACHE_TTL_MS) return cached.value;

  const { data } = await supabase
    .from('school_settings')
    .select('hours_plan_enabled, hours_entry_grace_minutes, hours_exit_grace_minutes, hours_reentry_merge_minutes')
    .eq('school_id', schoolId)
    .maybeSingle();

  const value: HourBankSettings = {
    enabled:              data?.hours_plan_enabled ?? false,
    entryGraceMinutes:    data?.hours_entry_grace_minutes ?? 15,
    exitGraceMinutes:     data?.hours_exit_grace_minutes ?? 15,
    reentryMergeMinutes:  data?.hours_reentry_merge_minutes ?? 15,
  };

  hourBankSettingsCache.set(schoolId, { value, at: Date.now() });
  return value;
}

export function invalidateHourBankSettingsCache(schoolId?: string): void {
  if (schoolId) hourBankSettingsCache.delete(schoolId);
  else hourBankSettingsCache.clear();
}

// Cierra una visita 'open': suma sus segmentos, aplica gracia de entrada/salida
// (D-9: los minutos de gracia NO se facturan, "sin que coma del banco"), y hace
// el único UPDATE real vía move_hour_bank (F2, FOR UPDATE). No toca
// reserved_minutes todavía — F4 (reservas) no existe aún, así que hoy no hay
// nada que liberar.
async function closeHourBankVisit(
  visitId: string,
  schoolId: string,
  entryGraceMinutes: number,
  exitGraceMinutes: number,
  athleteName: string
): Promise<void> {
  const { data: visit } = await supabase
    .from('hour_bank_visits')
    .select('id, enrollment_id, period_id, status, started_at')
    .eq('id', visitId)
    .maybeSingle();

  if (!visit || visit.status !== 'open' || !visit.period_id) return;

  const { data: segments } = await supabase
    .from('hour_bank_visit_segments')
    .select('entered_at, exited_at')
    .eq('visit_id', visitId)
    .order('entered_at', { ascending: true });

  if (!segments || segments.length === 0) return;

  const rawMinutes = segments.reduce((sum, s) => {
    if (!s.exited_at) return sum; // segmento sin cerrar — defensivo, no debería pasar acá
    return sum + Math.round((new Date(s.exited_at).getTime() - new Date(s.entered_at).getTime()) / 60000);
  }, 0);

  const billedMinutes = Math.max(0, rawMinutes - entryGraceMinutes - exitGraceMinutes);
  const lastExit = segments[segments.length - 1].exited_at;
  if (!lastExit) return; // el último segmento sigue abierto — no hay nada que cerrar todavía

  // F4: si había una reserva confirmada para el día de esta visita, se libera
  // junto con el consumo real en la misma llamada a move_hour_bank — evita que
  // el saldo quede "reservado" de más una vez que la visita ya lo cubrió.
  const visitDate = new Date(visit.started_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const { data: reservation } = await supabase
    .from('hour_bank_reservations')
    .select('id, minutes')
    .eq('enrollment_id', visit.enrollment_id)
    .eq('reservation_date', visitDate)
    .eq('status', 'confirmed')
    .limit(1)
    .maybeSingle();

  const { data: moveResult } = await supabase.rpc('move_hour_bank', {
    p_period_id: visit.period_id,
    p_reserved_delta: reservation ? -reservation.minutes : 0,
    p_consumed_delta: billedMinutes,
  });

  if (reservation) {
    await supabase
      .from('hour_bank_reservations')
      .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
      .eq('id', reservation.id);
  }

  await supabase
    .from('hour_bank_visits')
    .update({ status: 'closed', ended_at: lastExit, billed_minutes: billedMinutes })
    .eq('id', visitId);

  console.log(`[ADMS] banco de horas: visita ${visitId} cerrada — ${billedMinutes} min facturados`);

  // D-10: sin bloqueo automático de excedente, solo notificación — mismo
  // patrón que ya usa payment_overdue más arriba en este archivo.
  const available = (moveResult as any)?.available_minutes;
  if (typeof available === 'number' && available < 0) {
    const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (school?.owner_id) {
      await supabase.from('notifications').insert({
        user_id:  school.owner_id,
        school_id: schoolId,
        type:     'hour_bank_overage',
        title:    '⏱️ Banco de horas — saldo excedido',
        message:  `${athleteName} consumió ${billedMinutes} min y dejó el banco del período en ${available} min (excedido).`,
        link:     '/school/access-control',
      });
    }
  }
}

async function trackHourBankVisit(
  schoolId: string,
  enrollmentId: string,
  direction: 'entry' | 'exit',
  occurredAt: string,
  eventId: string,
  athleteName: string
): Promise<void> {
  const settings = await getHourBankSettings(schoolId);
  if (!settings.enabled) return;

  const { data: periodId } = await supabase.rpc('get_or_open_hour_bank_period', { p_enrollment_id: enrollmentId });
  if (!periodId) return; // esta inscripción no tiene un plan de horas (offering_plans.included_minutes_per_period NULL)

  const { data: openVisit } = await supabase
    .from('hour_bank_visits')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'open')
    .maybeSingle();

  if (direction === 'entry') {
    if (openVisit) {
      const { data: lastSeg } = await supabase
        .from('hour_bank_visit_segments')
        .select('id, entered_at, exited_at')
        .eq('visit_id', openVisit.id)
        .order('entered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSeg && !lastSeg.exited_at) {
        const gapMinutes = (new Date(occurredAt).getTime() - new Date(lastSeg.entered_at).getTime()) / 60000;
        if (gapMinutes <= settings.reentryMergeMinutes) {
          return; // ya está adentro (entrada duplicada/glitch de lector) — no crear nada
        }
        // La huella de salida nunca sonó y ya pasó la ventana de gracia — no
        // sabemos la hora real de salida (pudo irse por otra puerta, el lector
        // de salida pudo fallar). Antes de este fix, cualquier reentrada acá se
        // ignoraba sin mirar el hueco, así que una ausencia real de horas
        // quedaba fusionada en silencio y se facturaba completa al cerrar. Se
        // manda a pending_review (mismo criterio que auto_close_stale_hour_bank_visits
        // para "nunca marcó salida", migración 20260827174032) — sin facturar a
        // ciegas — y esta entrada abre una visita nueva más abajo.
        await supabase
          .from('hour_bank_visits')
          .update({
            status: 'pending_review',
            auto_closed: true,
            ended_at: lastSeg.entered_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', openVisit.id);

        const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
        if (school?.owner_id) {
          await supabase.from('notifications').insert({
            user_id:  school.owner_id,
            school_id: schoolId,
            type:     'hour_bank_pending_review',
            title:    '⏱️ Banco de horas — visita a revisar',
            message:  `${athleteName} volvió a marcar entrada sin haber marcado salida la vez anterior. Revisa y ajusta la hora real de salida.`,
            link:     '/school/access-control',
          });
        }
        // No return: sigue abajo y abre una visita nueva con esta entrada.
      } else if (lastSeg && lastSeg.exited_at) {
        const gapMinutes = (new Date(occurredAt).getTime() - new Date(lastSeg.exited_at).getTime()) / 60000;
        if (gapMinutes <= settings.reentryMergeMinutes) {
          // D-6: reentrada corta — nuevo segmento en la MISMA visita, no se cierra nada
          await supabase.from('hour_bank_visit_segments').insert({
            visit_id: openVisit.id, school_id: schoolId, enrollment_id: enrollmentId,
            entry_event_id: eventId, entered_at: occurredAt,
          });
          return;
        }
        // Fuera de la ventana: esa visita ya terminó de verdad — cerrarla (con
        // billing) antes de abrir la nueva.
        await closeHourBankVisit(openVisit.id, schoolId, settings.entryGraceMinutes, settings.exitGraceMinutes, athleteName);
      }
    }

    // Nueva visita. Si dos entradas llegan a la vez para la misma inscripción,
    // el índice único parcial de F1 (hour_bank_visits_one_open_per_enrollment)
    // rechaza la segunda — el try/catch del caller la absorbe sin romper el
    // ATTLOG en vivo.
    const { data: newVisit } = await supabase
      .from('hour_bank_visits')
      .insert({ school_id: schoolId, enrollment_id: enrollmentId, period_id: periodId, started_at: occurredAt })
      .select('id')
      .maybeSingle();

    if (newVisit) {
      await supabase.from('hour_bank_visit_segments').insert({
        visit_id: newVisit.id, school_id: schoolId, enrollment_id: enrollmentId,
        entry_event_id: eventId, entered_at: occurredAt,
      });
    }
  } else {
    if (!openVisit) return; // salida sin entrada trackeada — nada que cerrar acá

    const { data: openSeg } = await supabase
      .from('hour_bank_visit_segments')
      .select('id')
      .eq('visit_id', openVisit.id)
      .is('exited_at', null)
      .order('entered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openSeg) {
      await supabase.from('hour_bank_visit_segments')
        .update({ exited_at: occurredAt, exit_event_id: eventId })
        .eq('id', openSeg.id);
    }
    // La visita queda 'open' — el cierre con billing pasa en la próxima entrada
    // fuera de la ventana de gracia, o en el cron de auto-cierre (F5).
  }
}

// ─── GET /iclock/cdata — Handshake inicial ────────────────────────────────────
router.get('/iclock/cdata', async (req: Request, res: Response) => {
  const sn = (req.query.SN || req.query.sn) as string;
  logDebug(`GET /iclock/cdata | SN: ${sn}`);

  const device = sn ? await getDeviceBySerial(sn) : null;
  if (!device) {
    console.warn(`[ADMS] Handshake serial desconocido: ${sn}`);
    return res.type('text/plain').status(200).send('');
  }

  await touchDevice(sn);
  console.log(`[ADMS] Handshake OK — ${sn} (${device.direction}) school:${device.schoolId}`);
  logDevice('handshake', { direction: device.direction, ip: clientIp(req) }, sn, device.schoolId);

  const stamp = await getLastStamp(device.id);
  logDebug(`Handshake ${sn} → Stamp=${stamp}`);

  const config = [
    `GET OPTION FROM: ${sn}`,
    // Stamp dinámico: Unix timestamp del último evento recibido de este serial.
    // El F22 solo enviará ATTLOGs con occurred_at > Stamp → sin backlog histórico.
    // La línea de seguridad ZKTeco (F22) usa los nombres ATTLOGStamp/OPERLOGStamp;
    // los firmwares viejos usan Stamp/OpStamp. Mandamos ambos para que el cursor
    // sea reconocido y no re-vuelque el backlog (causa raíz del flood de 128).
    `Stamp=${stamp}`,
    `OpStamp=${stamp}`,
    `ATTLOGStamp=${stamp}`,
    `OPERLOGStamp=${stamp}`,
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

  const device = sn ? await getDeviceBySerial(sn) : null;
  if (!device) {
    return res.type('text/plain').status(200).send('OK');
  }

  await touchDevice(sn);
  const direction = device.direction;
  const schoolId  = device.schoolId;
  const deviceId  = device.id;
  const body      = typeof req.body === 'string' ? req.body : '';

  // Diagnóstico temporal: captura CUALQUIER tabla no reconocida (posibles pushes
  // de plantilla biométrica: FP, BIODATA, FACE, etc.) que hoy caen en el 'OK' silencioso.
  if (table !== 'ATTLOG' && table !== 'OPERLOG') {
    console.log(`[ADMS] ⚠️ Tabla no manejada: "${table}" | SN: ${sn} | Body (primeros 500 chars): ${body.substring(0, 500)}`);
    logDebug(`TABLA NO MANEJADA: "${table}" | SN: ${sn} | Body length: ${body.length} | Preview: ${body.substring(0, 500)}`);
    logDevice('unhandled_table', { table, bodyPreview: body.substring(0, 500), bodyLength: body.length }, sn, schoolId);
  }

  if (table === 'ATTLOG') {
    const lines    = body.trim().split('\n').filter(Boolean);

    console.log(`[ADMS] ATTLOG ${sn} (${direction}) — ${lines.length} evento(s)`);
    // Log primeras 3 líneas para diagnóstico
    logDebug(`ATTLOG ${sn} (${direction}) | ${lines.length} líneas | primeras: ${lines.slice(0,3).join(' || ')}`);
    logDevice('attlog_batch', { count: lines.length, direction, table }, sn, schoolId);

    let skipped = 0;
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

      let occurredAt: string;
      try {
        occurredAt = new Date(attTime.replace(' ', 'T') + '-05:00').toISOString();
      } catch {
        occurredAt = new Date().toISOString();
      }

      // Salta el backlog re-volcado: ya está en BD (dedup) y solo gasta recursos.
      if (Date.now() - new Date(occurredAt).getTime() > BACKLOG_SKIP_MS) {
        skipped++;
        continue;
      }

      const validation = await validateAccess(schoolId, zkPin);

      // Dedup: índice único (device_id, zk_user_id, occurred_at). Si el lector
      // reenvía el backlog, ON CONFLICT DO NOTHING evita inflar access_events.
      // .select('id') sin .maybeSingle(): un duplicado devuelve [] con 200
      // (no 406). Con .maybeSingle() el Accept es object y 0 filas => 406 (ruido).
      const { data: inserted } = await supabase
        .from('access_events')
        .upsert({
          school_id:               schoolId,
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
          .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();

        if (school?.owner_id) {
          // notifications: columnas user_id, school_id, title, message, type, read, link
          await supabase.from('notifications').insert({
            user_id:  school.owner_id,
            school_id: schoolId,
            type:     'access_denied',
            title:    '⚠️ Acceso denegado — Pago vencido',
            message:  `${validation.userName ?? 'Un miembro'} intentó ingresar pero tiene el pago vencido.`,
            link:     '/school/access-control',
          });
        }
      }

      // Banco de horas (F3): trackea la visita real, sin importar access_granted
      // (ver comentario en trackHourBankVisit). Nunca debe romper el ATTLOG en
      // vivo — cualquier error acá se loguea y se sigue de largo.
      if (eventRecord && validation.enrollmentId) {
        try {
          await trackHourBankVisit(
            schoolId,
            validation.enrollmentId,
            eventDirection,
            occurredAt,
            eventRecord.id,
            validation.userName ?? 'Atleta'
          );
        } catch (err) {
          console.error('[ADMS] banco de horas: error trackeando visita', err);
        }
      }

      // Puente ZKTeco → asistencia (Fase 2, docs/specs/asistencia-rapida-checkin.md
      // §2.2/§5): solo en la ENTRADA — es "llegó", no "se fue". Mismo criterio que
      // el banco de horas arriba: no importa access_granted (payment_overdue/
      // enrollment_expired igual quedan registrados — D4 del spec, la asistencia
      // nunca bloquea). checkInPresenceFromEvent decide adentro si hay a qué
      // sesión hacer check-in; si no puede, no marca nada. Nunca debe romper el
      // ATTLOG en vivo.
      if (eventRecord && validation.enrollmentId && eventDirection === 'entry') {
        try {
          const outcome = await checkInPresenceFromEvent({
            schoolId,
            athlete: { userId: validation.userId, unregisteredId: validation.unregisteredAthleteId },
            enrollmentId: validation.enrollmentId,
            occurredAt,
            checkInMethod: 'turnstile',
          });
          logDevice('attendance_checkin', { outcome: outcome.outcome, sessionId: outcome.sessionId }, sn, schoolId);
        } catch (err) {
          console.error('[ADMS] asistencia: error en check-in por torniquete', err);
        }
      }

      console.log(`[ADMS] PIN:${zkPin} | ${eventDirection} (device:${direction}) | granted:${validation.granted} | ${validation.reason || 'ok'}`);
    }

    if (skipped > 0) {
      console.log(`[ADMS] ATTLOG ${sn} — ${skipped}/${lines.length} saltados (backlog viejo > ${BACKLOG_SKIP_MS / 3600_000}h)`);
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

  const device = sn ? await getDeviceBySerial(sn) : null;
  if (!device) {
    return res.type('text/plain').status(200).send('OK');
  }

  await touchDevice(sn);
  const deviceId = device.id;

  let pendingQuery = supabase
    .from('device_commands')
    .select('id, cmd_seq, command_type, metadata')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('issued_at', { ascending: true })
    .limit(5);

  // `open_door` en dispositivos con bridge local (pyzk) NO se manda por acá:
  // el F22ID acepta CONTROL DEVICE con Return:0 sin mover el relé, y de acá
  // abajo se marcaría `executed` en falso por ese mismo Return code, ganándole
  // la carrera a GET /bridge/door-commands (que sí lo ejecuta de verdad).
  // Ver scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md, hallazgo 1.
  if (device.hasLocalBridge) {
    pendingQuery = pendingQuery.neq('command_type', 'open_door');
  }

  const { data: commands } = await pendingQuery;

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
      const fields = [`PIN=${meta.pin}`, `Name=${meta.name}`, `Pri=0`, `Grp=1`];
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
      // CONTROL DEVICE <AA><BB><CC><DD><EE>: AA=01 (control de salida), BB=00 (todas las puertas/self),
      // CC=01 (relé de cerradura), DD=FF (abrir), EE=05 (duración en segundos).
      // Reemplaza a 'UNLOCK', que no es un comando ADMS válido (causaba Return: -1002 el 100% de las veces).
      return `C:${cmd.cmd_seq}:CONTROL DEVICE 000101FF05`;
    }
    if (cmd.command_type === 'reboot') {
      // Fuerza al F22 a re-registrarse: tras el reboot hace GET /iclock/cdata
      // (handshake) y recibe el Stamp dinámico → resetea su puntero de subida.
      return `C:${cmd.cmd_seq}:REBOOT`;
    }
    if (cmd.command_type === 'set_drive_time') {
      return `C:${cmd.cmd_seq}:SET OPTIONS Door1Drivertime=${meta.seconds}`;
    }
    if (cmd.command_type === 'set_group') {
      return `C:${cmd.cmd_seq}:DATA UPDATE USERINFO PIN=${meta.pin}\tGrp=${meta.group}`;
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

  const device = sn ? await getDeviceBySerial(sn) : null;
  if (!device) {
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
