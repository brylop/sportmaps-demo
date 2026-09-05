import { supabase } from '../config/supabase';

/**
 * Bloqueo automático por mora — school_settings.access_auto_block_overdue_enabled
 * (migración 20260905111458). Mismo mecanismo ya probado en campo en GYM RM
 * (POST /api/v1/access/set-access-group, GET /api/v1/access/overdue en
 * bff/src/routes/access-api.ts): mover el PIN al Grupo 2 en el torniquete, un
 * segundo horario nativo del lector sin horas permitidas — bloquea sin tocar
 * la huella ni el enrollment.
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
 * el estado actual completo (quién debe, quién está bloqueado hoy según el
 * último set_group ejecutado) y encola solo los cambios — bloquear a quien
 * debe y no está bloqueado, desbloquear a quien está bloqueado y ya no debe.
 * Cada 15 min (maintenance.job.ts), mismo ritmo que el auto-cierre del banco
 * de horas. No-op de costo casi cero para toda escuela con el flag en false.
 */

type ZkGroup = 1 | 2;

interface QueuedCommand {
  school_id: string;
  device_id: string;
  command_type: 'set_group';
  direction: 'entry' | 'exit';
  status: 'pending';
  issued_by: null;
  expires_at: string;
  metadata: { pin: number; group: ZkGroup; reason: 'overdue_auto' };
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

  // Último set_group EJECUTADO por PIN → estado de bloqueo actual conocido
  // (mismo cómputo que GET /overdue en access-api.ts).
  const { data: lastGroupCmds } = await supabase
    .from('device_commands')
    .select('metadata, executed_at')
    .eq('school_id', schoolId)
    .eq('command_type', 'set_group')
    .eq('status', 'executed')
    .order('executed_at', { ascending: false });

  const pinBlocked: Record<number, boolean> = {};
  (lastGroupCmds ?? []).forEach((c: any) => {
    const pin = c.metadata?.pin;
    if (pin !== undefined && !(pin in pinBlocked)) pinBlocked[pin] = c.metadata?.group === 2;
  });

  const toBlock: number[] = [];
  overduePins.forEach(pin => { if (!pinBlocked[pin]) toBlock.push(pin); });

  const toUnblock: number[] = [];
  Object.keys(pinBlocked).forEach(pinStr => {
    const pin = Number(pinStr);
    if (pinBlocked[pin] && !overduePins.has(pin)) toUnblock.push(pin);
  });

  if (!toBlock.length && !toUnblock.length) return { blocked: 0, unblocked: 0 };

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const commandsFor = (pin: number, group: ZkGroup): QueuedCommand[] =>
    devices.map((d: any) => ({
      school_id: schoolId, device_id: d.id,
      command_type: 'set_group', direction: d.direction === 'both' ? 'entry' : d.direction,
      status: 'pending', issued_by: null, expires_at: expiresAt,
      metadata: { pin, group, reason: 'overdue_auto' },
    }));

  const commands: QueuedCommand[] = [
    ...toBlock.flatMap(pin => commandsFor(pin, 2)),
    ...toUnblock.flatMap(pin => commandsFor(pin, 1)),
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
