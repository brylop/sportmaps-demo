// bff/src/routes/bridge.routes.ts
//
// Canal para scripts locales (SDK pyzk por LAN, ej. scripts/gymrm-door-bridge/)
// que ejecutan físicamente comandos `open_door` que el firmware del F22ID
// acepta por ADMS (Return:0) pero no mueve el relé. Separado a propósito del
// canal ADMS (`/iclock/*`, ver access-adms.ts): ese habla el protocolo de
// texto plano del dispositivo; este es JSON para un proceso desatendido que
// actúa POR el dispositivo, no ES el dispositivo.
//
// NO usa JWT de usuario — es un proceso sin sesión corriendo en una PC del
// gym. Se valida con `X-Bridge-Api-Key` contra BRIDGE_API_KEY (mismo patrón
// fail-closed que internal-notifications.routes.ts: sin la env var, 401
// siempre, nunca se acepta sin secreto configurado).
//
// Ver scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md y BACKEND_ENDPOINT_SPEC.md
// para el diseño completo y los hallazgos que este archivo resuelve.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';

const router = Router();

function apiKeyOk(req: Request): boolean {
  const key = process.env.BRIDGE_API_KEY;
  if (!key) return false; // fail-closed: sin key en env, no se acepta nada
  const got = String(req.header('x-bridge-api-key') || '');
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── GET /bridge/door-commands?school_id=<uuid> ──────────────────────────────
// Reclama atómicamente los `open_door` pendientes y no expirados de la
// escuela (UPDATE ... WHERE claimed_at IS NULL, en una sola sentencia — dos
// llamadas concurrentes o un reintento de red no pueden reclamar la misma
// fila dos veces). No se usa un valor 'claimed' de `status` porque no hay
// certeza sobre un eventual CHECK constraint aplicado a mano en Supabase
// (ver hallazgo 2 de la validación); `claimed_at` es una columna nueva y no
// cambia el significado de `status` para nadie más que lo lea.
router.get('/door-commands', async (req: Request, res: Response) => {
  if (!apiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const schoolId = req.query.school_id as string;
  if (!schoolId) return res.status(400).json({ error: 'school_id requerido' });

  // Latido: cada sondeo exitoso del bridge (haya o no comandos) prueba que
  // sigue vivo y llegando al backend. alerted_at: null para que, si venia de
  // una caida ya avisada, el proximo chequeo del cron la vea sana de nuevo y
  // una caida futura pueda alertar otra vez. Best-effort -- un fallo acá no
  // debe tumbar el reclamo real de comandos.
  supabase.from('bridge_heartbeats').upsert(
    { school_id: schoolId, bridge_name: 'door-bridge', last_seen_at: new Date().toISOString(), alerted_at: null },
    { onConflict: 'school_id,bridge_name' },
  ).then(() => {}, () => {});

  try {
    const { data: claimed, error } = await supabase
      .from('device_commands')
      .update({ claimed_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('command_type', 'open_door')
      .eq('status', 'pending')
      .is('claimed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id, device_id, direction');

    if (error) throw error;
    if (!claimed || claimed.length === 0) return res.json({ commands: [] });

    // Sin FK declarada entre device_commands.device_id y turnstile_devices
    // (device_id es un uuid suelto) — PostgREST no puede embeber el join, así
    // que se resuelve en dos pasos y se mergea acá.
    const deviceIds = [...new Set(claimed.map((c: any) => c.device_id))];
    const { data: devices } = await supabase
      .from('turnstile_devices')
      .select('id, serial_number')
      .in('id', deviceIds);

    const deviceById = new Map((devices || []).map((d: any) => [d.id, d]));

    const commands = claimed.map((c: any) => ({
      id: c.id,
      device_serial: deviceById.get(c.device_id)?.serial_number ?? null,
      direction: c.direction,
      // NO se manda door_drive_time_seconds: el bridge dejo de usarlo (ver
      // scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md, punto 6-bis del
      // 2026-08-26) -- ese campo trabaja en segundos enteros (CHECK 1-60) y
      // el torniquete de GYM RM necesita un pulso de decimas de segundo, una
      // granularidad que ese campo no puede expresar. El bridge trae su
      // propio valor fijo (PULSE_DECISECONDS).
    }));

    return res.json({ commands });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al reclamar comandos' });
  }
});

// ─── POST /bridge/door-commands/:id/ack ──────────────────────────────────────
router.post('/door-commands/:id/ack', async (req: Request, res: Response) => {
  if (!apiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.params;
  const { success, error_message } = req.body as { success?: boolean; error_message?: string };
  if (typeof success !== 'boolean') {
    return res.status(400).json({ error: 'success (boolean) requerido' });
  }

  try {
    const { error } = await supabase
      .from('device_commands')
      .update({
        status: success ? 'executed' : 'failed',
        executed_at: new Date().toISOString(),
        error_message: success ? null : String(error_message || 'Fallo reportado por door_bridge local').slice(0, 500),
      })
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al confirmar comando' });
  }
});

export default router;
