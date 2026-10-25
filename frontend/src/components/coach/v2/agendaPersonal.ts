/**
 * Agenda de entrenador personal (`/api/v1/trainer/availability/schedule`).
 *
 * Esa ruta es solo de quien tiene workspace de `personal_trainer`
 * (requireTrainerAuth): a un coach de escuela le responde 403. Hoy y Asistencia
 * la consultaban en cada carga. Ahora el primer 403 se recuerda en la sesión
 * (memoria + sessionStorage) y no se vuelve a llamar.
 */
import { bffClient } from '@/lib/api/bffClient';

const MEMO = 'sm_coach_v2_agenda_personal';
let sinAcceso: boolean | undefined;

export function agendaPersonalSinAcceso(): boolean {
  if (sinAcceso !== undefined) return sinAcceso;
  try { sinAcceso = sessionStorage.getItem(MEMO) === 'no'; } catch { sinAcceso = false; }
  return sinAcceso;
}

/** Solo para pruebas. */
export function _olvidarAgendaPersonal() {
  sinAcceso = undefined;
  try { sessionStorage.removeItem(MEMO); } catch { /* sin sessionStorage */ }
}

/** Devuelve la agenda del día, o null si no hay acceso (o falló). Nunca lanza. */
const enVuelo = new Map<string, Promise<unknown>>();

export function agendaPersonalDelDia<T = { sessions?: Array<Record<string, unknown>> }>(fecha: string): Promise<T | null> {
  // Hoy y Asistencia la piden a la vez: una sola llamada por día.
  const previa = enVuelo.get(fecha);
  if (previa) return previa as Promise<T | null>;
  const p = pedir<T>(fecha).finally(() => enVuelo.delete(fecha));
  enVuelo.set(fecha, p);
  return p;
}

async function pedir<T>(fecha: string): Promise<T | null> {
  if (agendaPersonalSinAcceso()) return null;
  try {
    return await bffClient.get<T>(`/api/v1/trainer/availability/schedule?date=${fecha}`);
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 403) {
      sinAcceso = true;
      try { sessionStorage.setItem(MEMO, 'no'); } catch { /* sin sessionStorage */ }
    }
    return null;
  }
}
