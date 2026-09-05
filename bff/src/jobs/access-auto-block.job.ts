import { supabase } from '../config/supabase';
import { getAccessBlockMechanism, buildBlockCommand, computeIsBlocked, BLOCK_COMMAND_TYPES } from '../utils/accessBlockMechanism';

/**
 * Bloqueo automático por mora — school_settings.access_auto_block_overdue_enabled
 * (migración 20260905111458). El mecanismo real (Grupo vs deshabilitar
 * usuario) depende de la escuela — ver bff/src/utils/accessBlockMechanism.ts.
 * Probado en campo con Grupo en GYM RM; Dreamers (MB360/ID sin Grupos,
 * confirmado 2026-09-05) usa deshabilitar.
 *
 * Señal: payments.status='overdue' (ya respeta payment_grace_days vía
 * apply_late_fees(), pg_cron 07:00 UTC). Deliberadamente NO usa
 * enrollments.expires_at/status — esa vía tiene dos bugs conocidos
 * (fn_expire_overdue_enrollments cancela sin gracia; el trigger de
 * reactivación tiene un punto ciego de 77 inscripciones en 3 rutas de cobro,
 * ver docs/specs/vigencia-cobranza-y-sesiones-unificado.md §1.7/§2) —
 * automatizar un bloqueo FÍSICO sobre esa señal arriesgaría dejar a alguien
 * bloqueado en la puerta después de haber pagado.
 *
 * Reconciliación completa cada corrida (no un hook por evento de pago): lee
 * el estado actual completo (quién debe, quién está bloqueado hoy) y encola
 * solo los cambios — bloquear a quien debe y no está bloqueado, desbloquear
 * a quien está bloqueado y ya no debe. Cada 15 min (maintenance.job.ts),
 * mismo ritmo que el auto-cierre del banco de horas. No-op de costo casi
 * cero para toda escuela con el flag en false.
 */

interface QueuedCommand {
  school_id: string;
  device_id: string;
  command_type: string;
  direction: 'entry' | 'exit';
  status: 'pending';
  issued_by: null;
  expires_at: string;
  metadata: Record<string, unknown>;
}

async function reconcileSchool(schoolId: string): Promise<{ blocked: number; unblocked: number }> {
  const { data: devices } = await supabase
    .from('turnstile_devices')
    .select('id, direction')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (!devices?.length) return { blocked: 0, unblocked: 0 }; // sin lectores, nada que hacer

  const { data: mappings } = await supabase
    .from('zk_user_mappings')
    .select('zk_pin, user_id, unregistered_athlete_id')
    .eq('school_id', schoolId);
  if (!mappings?.length) return { blocked: 0, unblocked: 0 }; // sin huellas mapeadas, nada que hacer

  const pinByKey: Record<string, number> = {};
  mappings.forEach((m: any) => {
    const key = m.user_id ? `u:${m.user_id}` : `a:${m.unregistered_athlete_id}`;
    pinByKey[key] = m.zk_pin;
  });

  const { data: overduePayments } = await supabase
    .from('payments')
    .select('user_id, unregistered_athlete_id')
    .eq('school_id', schoolId)
    .eq('status', 'overdue');

  const overduePins = new Set<number>();
  (overduePayments ?? []).forEach((p: any) => {
    const key = p.user_id ? `u:${p.user_id}` : `a:${p.unregistered_athlete_id}`;
    const pin = pinByKey[key];
    if (pin !== undefined) overduePins.add(pin);
  });

  // "Bloqueado" exige que TODOS los dispositivos activos coincidan en el
  // último comando ejecutado — no basta con uno solo (mismo cómputo que GET
  // /overdue en access-api.ts). Sin esto, un PIN bloqueado solo en un
  // dispositivo (ej. el otro lector con IP mala) se daba por "ya bloqueado"
  // y este job dejaba de reintentarlo en el que faltaba.
  const mechanism = await getAccessBlockMechanism(schoolId);
  const activeDeviceIds = devices.map((d: any) => d.id as string);

  const { data: lastCmds } = await supabase
    .from('device_commands')
    .select('device_id, command_type, metadata, executed_at')
    .eq('school_id', schoolId)
    .in('command_type', BLOCK_COMMAND_TYPES)
    .eq('status', 'executed')
    .order('executed_at', { ascending: false });

  const isBlocked = computeIsBlocked(mechanism, lastCmds || [], activeDeviceIds);

  const allPins = new Set<number>([...overduePins, ...Object.values(pinByKey)]);
  const pinBlocked: Record<number, boolean> = {};
  allPins.forEach(pin => { pinBlocked[pin] = isBlocked(pin); });

  const toBlock: number[] = [];
  overduePins.forEach(pin => { if (!pinBlocked[pin]) toBlock.push(pin); });

  const toUnblock: number[] = [];
  Object.keys(pinBlocked).forEach(pinStr => {
    const pin = Number(pinStr);
    if (pinBlocked[pin] && !overduePins.has(pin)) toUnblock.push(pin);
  });

  if (!toBlock.length && !toUnblock.length) return { blocked: 0, unblocked: 0 };

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const commandsFor = (pin: number, action: 'block' | 'unblock'): QueuedCommand[] => {
    const { command_type, metadata } = buildBlockCommand(mechanism, pin, action, { reason: 'overdue_auto' });
    return devices.map((d: any) => ({
      school_id: schoolId, device_id: d.id,
      command_type, direction: d.direction === 'both' ? 'entry' : d.direction,
      status: 'pending', issued_by: null, expires_at: expiresAt,
      metadata,
    }));
  };

  const commands: QueuedCommand[] = [
    ...toBlock.flatMap(pin => commandsFor(pin, 'block')),
    ...toUnblock.flatMap(pin => commandsFor(pin, 'unblock')),
  ];
  await supabase.from('device_commands').insert(commands);

  if (toBlock.length || toUnblock.length) {
    const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (school?.owner_id) {
      await supabase.from('notifications').insert({
        user_id: school.owner_id,
        school_id: schoolId,
        type: 'access_auto_block',
        title: '🔒 Bloqueo automático por mora',
        message: `${toBlock.length} atleta(s) bloqueado(s) por pago vencido, ${toUnblock.length} desbloqueado(s) al ponerse al día.`,
        link: '/school/access-control',
      });
    }
  }

  return { blocked: toBlock.length, unblocked: toUnblock.length };
}

export async function runAccessAutoBlockCycle(): Promise<void> {
  const { data: schools, error } = await supabase
    .from('school_settings')
    .select('school_id')
    .eq('access_auto_block_overdue_enabled', true);
  if (error) {
    console.error('[CRON] bloqueo automático por mora — error listando escuelas:', error.message);
    return;
  }
  if (!schools?.length) return;

  for (const s of schools) {
    try {
      const r = await reconcileSchool(s.school_id);
      if (r.blocked > 0 || r.unblocked > 0) {
        console.log(`[CRON] bloqueo automático por mora — escuela ${s.school_id}: bloqueados=${r.blocked} desbloqueados=${r.unblocked}`);
      }
    } catch (err: any) {
      console.error(`[CRON] bloqueo automático por mora — error en escuela ${s.school_id}:`, err?.message || err);
    }
  }
}
