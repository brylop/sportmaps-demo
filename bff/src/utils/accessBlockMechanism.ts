import { supabase } from '../config/supabase';

/**
 * Bloqueo por mora — dos mecanismos posibles, elegido por escuela
 * (school_settings.access_block_mechanism, migración 20260905135210):
 *
 *   'group'   → mueve el PIN a Grupo 2 (DATA UPDATE USERINFO Grp=2). Requiere
 *               que el torniquete soporte Zonas Horarias/Grupos. Probado en
 *               campo en GYM RM (F22ID) — Grp=2 sí bloquea el paso ahí.
 *   'disable' → apaga el bit 0 de USERINFO.Privilege (Enable=0/1 en términos
 *               ADMS). Universal en cualquier ZKTeco, no requiere Grupos.
 *               Usado por Dreamers (MB360/ID, confirmado 2026-09-05 que no
 *               tiene Zonas Horarias/Grupos ni en el menú local ni por el
 *               bridge — el firmware no parece consultar group_id para
 *               decidir acceso, aunque la escritura no dé error).
 *
 * Este módulo centraliza: qué mecanismo usa una escuela, qué comando emitir
 * para bloquear/desbloquear, y cómo saber si un PIN está bloqueado de verdad
 * (TODOS los dispositivos activos con el último comando ejecutado en el
 * sentido de "bloqueado" — no basta con uno solo, ver caso Edna 2026-09-05).
 */

export type AccessBlockMechanism = 'group' | 'disable';

const mechanismCache = new Map<string, { value: AccessBlockMechanism; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAccessBlockMechanism(schoolId: string): Promise<AccessBlockMechanism> {
  const cached = mechanismCache.get(schoolId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const { data } = await supabase
    .from('school_settings')
    .select('access_block_mechanism')
    .eq('school_id', schoolId)
    .maybeSingle();

  const value = (data?.access_block_mechanism === 'disable' ? 'disable' : 'group') as AccessBlockMechanism;
  mechanismCache.set(schoolId, { value, at: Date.now() });
  return value;
}

export function invalidateAccessBlockMechanismCache(schoolId?: string): void {
  if (schoolId) mechanismCache.delete(schoolId);
  else mechanismCache.clear();
}

/** Tipos de comando que este módulo considera al calcular "¿está bloqueado?". */
export const BLOCK_COMMAND_TYPES = ['set_group', 'disable_user', 'enable_user'] as const;

/**
 * Arma el device_command (sin school_id/device_id/direction/status/expires_at
 * — el caller los agrega al hacer fan-out por dispositivo) para bloquear
 * (action='block') o restaurar (action='unblock') un PIN, según el mecanismo
 * de la escuela.
 */
export function buildBlockCommand(
  mechanism: AccessBlockMechanism,
  pin: number,
  action: 'block' | 'unblock',
  extraMetadata?: Record<string, unknown>
): { command_type: string; metadata: Record<string, unknown> } {
  if (mechanism === 'disable') {
    return {
      command_type: action === 'block' ? 'disable_user' : 'enable_user',
      metadata: { pin, ...extraMetadata },
    };
  }
  return {
    command_type: 'set_group',
    metadata: { pin, group: action === 'block' ? 2 : 1, ...extraMetadata },
  };
}

/**
 * Dado el historial de comandos EJECUTADOS de bloqueo (cualquiera de los 3
 * tipos) y la lista de dispositivos activos de la escuela, arma una función
 * `isBlocked(pin)` que exige que TODOS los dispositivos activos coincidan en
 * "bloqueado" según su último comando ejecutado — no uno solo.
 */
export function computeIsBlocked(
  mechanism: AccessBlockMechanism,
  commands: Array<{ device_id: string | null; command_type: string; metadata: any; executed_at: string }>,
  activeDeviceIds: string[]
): (pin: number) => boolean {
  // Último comando relevante ejecutado por (pin, device_id) — el primero que
  // aparece, ya vienen ordenados por executed_at desc.
  const lastByPinDevice: Record<string, { command_type: string; group?: number }> = {};
  commands.forEach((c) => {
    const pin = c.metadata?.pin;
    if (pin === undefined || !c.device_id) return;
    const key = `${pin}:${c.device_id}`;
    if (key in lastByPinDevice) return;
    lastByPinDevice[key] = { command_type: c.command_type, group: c.metadata?.group };
  });

  const isDeviceBlocked = (pin: number, deviceId: string): boolean => {
    const last = lastByPinDevice[`${pin}:${deviceId}`];
    if (!last) return false;
    if (mechanism === 'disable') return last.command_type === 'disable_user';
    return last.command_type === 'set_group' && last.group === 2;
  };

  return (pin: number): boolean =>
    activeDeviceIds.length > 0 && activeDeviceIds.every((deviceId) => isDeviceBlocked(pin, deviceId));
}
