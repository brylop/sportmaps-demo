import { supabase } from '../config/supabase';
import { wakeSchool } from '../services/bridgeWsHub';
import { getAccessBlockMechanism, buildBlockCommand, computeIsBlocked, athleteKey, BLOCK_COMMAND_TYPES } from '../utils/accessBlockMechanism';
import { FILTRO_SOLO_MENSUALIDAD } from '../services/payment-accounts';

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
 * Comprobantes (F-D, migración 20261005214253): un comprobante enviado mueve
 * la MISMA fila de payments a 'awaiting_approval' (o 'glosado' si la escuela
 * lo objeta), así que deja de ser 'overdue' y este job lo DESBLOQUEA en la
 * siguiente corrida — sin lógica extra acá, para todas las escuelas. Si la
 * escuela lo rechaza ('rejected'), en escuelas con
 * school_settings.pending_proof_counts_as_paid apply_late_fees() lo devuelve a
 * 'overdue' (hueco C) cuando ya pasó due_date + gracia, y el bloqueo vuelve
 * solo. En escuelas sin ese flag, un rechazado no vuelve a mora (como antes).
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
    .select('zk_pin, user_id, unregistered_athlete_id, child_id')
    .eq('school_id', schoolId);
  if (!mappings?.length) return { blocked: 0, unblocked: 0 }; // sin huellas mapeadas, nada que hacer

  const pinByKey: Record<string, number> = {};
  mappings.forEach((m: any) => {
    const key = athleteKey(m);
    if (key) pinByKey[key] = m.zk_pin;
  });

  const { data: overduePayments } = await supabase
    .from('payments')
    .select('user_id, unregistered_athlete_id, child_id')
    .eq('school_id', schoolId)
    .eq('status', 'overdue')
    // F0 (migración 20261010143132): solo la mensualidad vencida bloquea. Un
    // cobro único (torneo, artículo, inscripción…) ya no pasa a 'overdue', y
    // los que quedaron 'overdue' de antes tampoco deben bloquear.
    .or(FILTRO_SOLO_MENSUALIDAD);

  const overduePins = new Set<number>();
  (overduePayments ?? []).forEach((p: any) => {
    const key = athleteKey(p);
    const pin = key ? pinByKey[key] : undefined;
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

  // Excepción manual de UN día: si un admin habilitó a alguien hoy (hora de
  // Colombia) desde Control de acceso, el job no lo vuelve a bloquear hasta que
  // termine el día. Al día siguiente, si sigue vencido, se bloquea de nuevo.
  // Los comandos del job llevan issued_by = null; los manuales, el id del admin.
  const bogotaNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const dayStartUtc = new Date(Date.UTC(bogotaNow.getUTCFullYear(), bogotaNow.getUTCMonth(), bogotaNow.getUTCDate(), 5, 0, 0));
  const { data: manualCmds } = await supabase
    .from('device_commands')
    .select('command_type, metadata')
    .eq('school_id', schoolId)
    .in('command_type', BLOCK_COMMAND_TYPES)
    .not('issued_by', 'is', null)
    // device_commands no tiene created_at: con esa columna la consulta fallaba en
    // silencio y la excepción manual nunca aplicaba (se re-bloqueaba a los 15 min).
    .gte('issued_at', dayStartUtc.toISOString());
  const manuallyEnabledToday = new Set<number>();
  (manualCmds ?? []).forEach((c: any) => {
    const isUnblock = c.command_type === 'enable_user' || (c.command_type === 'set_group' && c.metadata?.group === 1);
    if (isUnblock && c.metadata?.pin !== undefined) manuallyEnabledToday.add(Number(c.metadata.pin));
  });

  const toBlock: number[] = [];
  overduePins.forEach(pin => { if (!pinBlocked[pin] && !manuallyEnabledToday.has(pin)) toBlock.push(pin); });

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

  // Comandos EN VUELO: si el puente tarda en ejecutar (PC dormida, lector ocupado)
  // el estado "bloqueado" —que solo cuenta comandos ejecutados— no cambia, y cada
  // corrida de 15 min volvía a encolar lo mismo (93 comandos duplicados y una
  // notificación al owner por corrida el 2026-10-06). Se omite el comando si ya hay
  // uno igual (mismo tipo, PIN y lector) encolado en los últimos 30 min.
  const nowIso = new Date().toISOString();
  const inFlightSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Pendientes del job que ya no van a ejecutarse liberan su lugar en el índice
  // único (uq_device_commands_bloqueo_job_pendiente, migración 20261014105326):
  //  · vencidos — el puente por WS no los expira (solo lo hace el sondeo ADMS);
  //  · reclamados por el puente hace >30 min y nunca confirmados (el puente murió
  //    a mitad) — antes se reintentaban insertando otro igual; ahora el viejo
  //    pasa a 'expired' y el reintento entra limpio.
  // Solo issued_by NULL: los comandos manuales no se tocan. Ambos UPDATE son
  // idempotentes, da igual si corren en las 3 instancias a la vez.
  await supabase
    .from('device_commands')
    .update({ status: 'expired' })
    .eq('school_id', schoolId)
    .in('command_type', BLOCK_COMMAND_TYPES)
    .eq('status', 'pending')
    .is('issued_by', null)
    .lt('expires_at', nowIso);
  await supabase
    .from('device_commands')
    .update({ status: 'expired', error_message: 'reclamado por el puente y sin confirmar en 30 min' })
    .eq('school_id', schoolId)
    .in('command_type', BLOCK_COMMAND_TYPES)
    .eq('status', 'pending')
    .is('issued_by', null)
    .lt('claimed_at', inFlightSince);

  const { data: inFlight } = await supabase
    .from('device_commands')
    .select('device_id, command_type, metadata')
    .eq('school_id', schoolId)
    .in('command_type', BLOCK_COMMAND_TYPES)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .gte('issued_at', inFlightSince);
  const inFlightKeys = new Set((inFlight ?? []).map((c: any) => cmdKey(c.device_id, c.command_type, c.metadata)));

  const commands: QueuedCommand[] = [
    ...toBlock.flatMap(pin => commandsFor(pin, 'block')),
    ...toUnblock.flatMap(pin => commandsFor(pin, 'unblock')),
  ].filter(c => !inFlightKeys.has(cmdKey(c.device_id, c.command_type, c.metadata)));

  if (!commands.length) return { blocked: 0, unblocked: 0 };

  // El mismo cron corre a la vez en los 3 BFF (dev/stg/prod) contra una sola
  // base: los tres leen "no hay nada en vuelo" en el mismo segundo. El índice
  // único parcial deja entrar solo al primero; se cuenta y se avisa SOLO por lo
  // que esta instancia insertó de verdad.
  const inserted = await insertIgnoringDuplicates(commands);
  if (!inserted.length) return { blocked: 0, unblocked: 0 };

  // El puente por WebSocket no sondea: hay que avisarle que revise (antes los
  // bloqueos esperaban a la reconexión de las 3 am — cuatro horas de retraso el
  // 2026-10-06). No-op si no hay un puente conectado a esta instancia.
  wakeSchool(schoolId);

  const blockedPins = new Set<number>();
  const unblockedPins = new Set<number>();
  inserted.forEach((c) => {
    const pin = Number(c.metadata?.pin);
    if (isBlockCommand(c.command_type, c.metadata)) blockedPins.add(pin);
    else unblockedPins.add(pin);
  });

  const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
  if (school?.owner_id) {
    await supabase.from('notifications').insert({
      user_id: school.owner_id,
      school_id: schoolId,
      type: 'access_auto_block',
      title: '🔒 Bloqueo automático por mora',
      message: `${blockedPins.size} atleta(s) bloqueado(s) por pago vencido, ${unblockedPins.size} desbloqueado(s) al ponerse al día.`,
      link: '/school/access-control',
    });
  }

  return { blocked: blockedPins.size, unblocked: unblockedPins.size };
}

const cmdKey = (deviceId: string, type: string, md: any) =>
  `${deviceId}:${type}:${md?.pin}:${md?.group ?? ''}`;

const isBlockCommand = (type: string, md: any) =>
  type === 'disable_user' || (type === 'set_group' && Number(md?.group) === 2);

type InsertedCommand = Pick<QueuedCommand, 'device_id' | 'command_type' | 'metadata'>;

/**
 * Inserta los comandos y devuelve SOLO los que entraron. Un 23505 contra
 * uq_device_commands_bloqueo_job_pendiente significa que otra instancia ya
 * encoló ese mismo comando: no es error. Primero intenta el lote completo (caso
 * normal, un viaje); si choca, reintenta fila por fila para quedarse con las
 * que no chocaron. Sin el índice (migración aún no aplicada) se comporta igual
 * que antes: todo entra.
 */
async function insertIgnoringDuplicates(commands: QueuedCommand[]): Promise<InsertedCommand[]> {
  const cols = 'device_id, command_type, metadata';
  const { data, error } = await supabase.from('device_commands').insert(commands).select(cols);
  if (!error) return (data ?? []) as InsertedCommand[];
  if (error.code !== '23505') {
    console.error('[CRON] bloqueo automático por mora — error encolando comandos:', error.message);
    return [];
  }

  const inserted: InsertedCommand[] = [];
  for (const cmd of commands) {
    const r = await supabase.from('device_commands').insert(cmd).select(cols);
    if (!r.error) inserted.push(...((r.data ?? []) as InsertedCommand[]));
    else if (r.error.code !== '23505') {
      console.error('[CRON] bloqueo automático por mora — error encolando comando:', r.error.message);
    }
  }
  return inserted;
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
