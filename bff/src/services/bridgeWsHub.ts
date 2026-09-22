// bff/src/services/bridgeWsHub.ts
//
// Registro en memoria de conexiones WebSocket activas de bridges locales
// (ver scripts/gymrm-door-bridge/door_bridge.py, migración 2026-09-21 de
// long-polling a WS). El long-polling anterior (bridge.routes.ts,
// GET /bridge/door-commands?wait_seconds=20) reabría una conexión HTTP
// cada ~20s para siempre -- funciona, pero es tráfico constante contra
// Render. Con WS el bridge abre UNA conexión y la mantiene viva; el
// backend le empuja un aviso por esa misma conexión apenas se crea un
// comando, en vez de que el bridge tenga que volver a preguntar.
//
// Vive en memoria de proceso a propósito (no en la base): si el proceso
// del BFF se reinicia (deploy, crash), las conexiones se cortan solas y
// cada bridge reconecta por su cuenta (tiene su propio reintento con
// backoff) -- no hace falta persistir nada para que esto se autocorrija.
// En un futuro con más de una instancia del BFF corriendo a la vez esto
// dejaría de alcanzar (el insert puede pasar por una instancia distinta a
// la que tiene la conexión) -- hoy Render corre una sola instancia de
// sportmaps-bff-dev, así que no es un problema real todavía. Si se escala
// a multi-instancia, hace falta un pub/sub (ej. Postgres LISTEN/NOTIFY o
// Redis) en vez de este Map en memoria.

import type WebSocket from 'ws';

const connectionsBySchool = new Map<string, Set<WebSocket>>();

export function registerConnection(schoolId: string, ws: WebSocket): void {
  let set = connectionsBySchool.get(schoolId);
  if (!set) {
    set = new Set();
    connectionsBySchool.set(schoolId, set);
  }
  set.add(ws);
}

export function unregisterConnection(schoolId: string, ws: WebSocket): void {
  const set = connectionsBySchool.get(schoolId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connectionsBySchool.delete(schoolId);
}

// Avisa a cualquier bridge conectado de esta escuela que revise comandos
// pendientes ahora mismo -- no manda los comandos en sí (el cliente los
// reclama por el mismo mecanismo atómico de siempre, ver
// claimPendingCommands en bridge.routes.ts), solo lo despierta. Evita
// duplicar la lógica de reclamo atómico en dos lugares.
export function wakeSchool(schoolId: string): void {
  const set = connectionsBySchool.get(schoolId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({ type: 'wake' });
  for (const ws of set) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    } catch {
      // conexión rota -- el propio handler de 'close'/'error' del socket
      // se encarga de desregistrarla, acá no hace falta hacer nada más.
    }
  }
}

export function hasConnection(schoolId: string): boolean {
  const set = connectionsBySchool.get(schoolId);
  return !!set && set.size > 0;
}
