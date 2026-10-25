/**
 * Hooks compartidos de Asistencia y Sesiones V2 del entrenador:
 *  - useWakeLock: pantalla encendida (mismo mecanismo que LiveScorer.tsx).
 *  - useEnLinea: señal del navegador (online/offline).
 *  - useColaAsistencia: la cola de listas sin señal, con un turno cada 2 s (cada
 *    lista respeta su propia espera) y al volver la red, igual que el marcador.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { safeStorage } from '@/lib/tournamentActionQueue';
import {
  ColaAsistencia, candadoNavegador, clasificarError, type EventoCola, type ListaEnCola, type ResultadoEnvio,
} from './colaAsistencia';

type WakeLockSentinelLike = { release: () => Promise<void> };
type NavigatorConWakeLock = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };

export function wakeLockDisponible(): boolean {
  try { return typeof navigator !== 'undefined' && !!(navigator as NavigatorConWakeLock).wakeLock; } catch { return false; }
}

/** Mantiene la pantalla encendida mientras `activo` (con respaldo silencioso si no hay soporte). */
export function useWakeLock(activo: boolean): { soportado: boolean; encendida: boolean } {
  const [encendida, setEncendida] = useState(false);
  const soportado = wakeLockDisponible();
  useEffect(() => {
    if (!activo) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const nav = navigator as NavigatorConWakeLock;
        if (!nav.wakeLock || document.visibilityState !== 'visible') return;
        const l = await nav.wakeLock.request('screen');
        if (cancelled) { void l.release().catch(() => undefined); return; }
        lock = l;
        setEncendida(true);
      } catch { /* sin permiso o sin soporte */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      setEncendida(false);
      document.removeEventListener('visibilitychange', onVis);
      try { void lock?.release().catch(() => undefined); } catch { /* ya liberado */ }
    };
  }, [activo]);
  return { soportado, encendida };
}

export function useEnLinea(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Envío real: el mismo endpoint que CoachAttendancePage (equipo o sesión, todo en un request). */
export async function enviarLista(item: ListaEnCola): Promise<ResultadoEnvio> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'retry', message: 'Sin señal' };
  try {
    const body = await bffClient.post('/api/v1/attendance/session', item.payload, { 'x-school-id': item.schoolId });
    return { kind: 'ok', body };
  } catch (e) {
    const r = clasificarError(e);
    // Sin red, refrescar el token falla con 401 «sin sesión»: eso es falta de señal, no sesión vencida.
    if (r.kind === 'auth' && typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'retry', message: r.message };
    return r;
  }
}

// Una sola cola por usuario en esta pestaña: la pantalla de Asistencia y el
// sincronizador global (CoachListasSync) comparten la MISMA instancia. Entre
// pestañas (PWA + Chrome) la cola relee y fusiona el localStorage en cada
// escritura, escucha el evento `storage` y envía una sola pestaña a la vez.
const colas = new Map<string, { cola: ColaAsistencia; oyentes: Set<() => void> }>();

export function obtenerCola(userId: string) {
  let e = colas.get(userId);
  if (!e) {
    const oyentes = new Set<() => void>();
    const key = `sm_coach_v2_listas:${userId}`;
    const storage = safeStorage();
    const cola = new ColaAsistencia({
      key,
      send: enviarLista,
      storage,
      candado: candadoNavegador(`${key}:envio`, storage),
      onChange: () => oyentes.forEach((f) => f()),
    });
    e = { cola, oyentes };
    colas.set(userId, e);
    try {
      // Otra pestaña cambió la cola: se recarga (y se notifica a la pantalla).
      window.addEventListener('storage', (ev) => {
        if (ev.key === key || ev.key === null) cola.recargar();
      });
    } catch { /* sin window */ }
  }
  return e;
}

export function useColaAsistencia(userId: string | null | undefined, onEventos?: (ev: EventoCola[]) => void) {
  const [, setTick] = useState(0);
  const online = useEnLinea();
  const onEventosRef = useRef(onEventos);
  onEventosRef.current = onEventos;

  const entrada = userId ? obtenerCola(userId) : null;
  const cola = entrada?.cola ?? null;
  useEffect(() => {
    if (!entrada) return;
    const f = () => setTick((t) => t + 1);
    entrada.oyentes.add(f);
    return () => { entrada.oyentes.delete(f); };
  }, [entrada]);

  const flush = useCallback(async (force = false) => {
    if (!cola) return;
    const ev = await cola.flush(force);
    if (ev.length) onEventosRef.current?.(ev);
  }, [cola]);

  useEffect(() => {
    if (!cola) return;
    void flush(true);
    const iv = setInterval(() => { void flush(); }, 2000);
    const on = () => { void flush(true); };
    // Al volver a la pestaña (PWA en segundo plano), se relee lo que hicieron las otras.
    const vis = () => { if (document.visibilityState === 'visible') { cola.recargar(); void flush(); } };
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); window.removeEventListener('online', on); document.removeEventListener('visibilitychange', vis); };
  }, [cola, flush]);

  return { cola, online, flush };
}
