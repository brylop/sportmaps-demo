// bff/src/services/bridgeWsServer.ts
//
// Servidor WS para bridges locales (ver bridgeWsHub.ts para el porqué).
// Protocolo, todo JSON sobre la misma conexión:
//   cliente -> servidor  {type:'auth', school_id, api_key}   -- primer mensaje, obligatorio
//   servidor -> cliente  {type:'auth_ok'} | {type:'auth_failed'}
//   servidor -> cliente  {type:'wake'}                        -- "revisa ahora" (bridgeWsHub.wakeSchool)
//   cliente -> servidor  {type:'poll'}                        -- "dame lo que haya pendiente"
//   servidor -> cliente  {type:'commands', commands:[...]}    -- resultado de un poll (o al autenticar, si ya había algo)
//   cliente -> servidor  {type:'heartbeat'}                   -- cada ~60s, mantiene bridge_heartbeats vivo
//
// El ack de un comando ejecutado NO pasa por acá -- sigue siendo el mismo
// POST /bridge/door-commands/:id/ack de siempre (es infrecuente, no aporta
// nada mudarlo a WS y mantiene un solo lugar para esa lógica).

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { supabase } from '../config/supabase';
import { claimAndMapCommands, apiKeyMatches } from '../routes/bridge.routes';
import { registerConnection, unregisterConnection } from './bridgeWsHub';

// Si no llega un heartbeat en este tiempo, se asume que el bridge del otro
// lado murió de forma sucia (proceso matado sin cerrar el socket limpio) y
// se corta -- sin esto un socket "zombie" se queda registrado para siempre
// y wakeSchool() le seguiría mandando avisos a la nada.
const HEARTBEAT_STALE_MS = 90_000;
const STALE_CHECK_INTERVAL_MS = 30_000;
const AUTH_TIMEOUT_MS = 10_000;

interface BridgeSocket extends WebSocket {
  schoolId?: string;
  authed?: boolean;
  lastHeartbeat?: number;
}

function touchHeartbeat(schoolId: string) {
  // Best-effort, mismo patrón que el endpoint HTTP viejo: un fallo acá no
  // debe tumbar la conexión ni el reclamo de comandos.
  supabase.from('bridge_heartbeats').upsert(
    { school_id: schoolId, bridge_name: 'door-bridge', last_seen_at: new Date().toISOString(), alerted_at: null },
    { onConflict: 'school_id,bridge_name' },
  ).then(() => {}, () => {});
}

async function pushPending(ws: BridgeSocket, schoolId: string) {
  try {
    const commands = await claimAndMapCommands(schoolId, ['open_door']);
    if (commands.length > 0 && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'commands', commands }));
    }
  } catch {
    // best-effort -- el cliente puede volver a mandar 'poll' si esto falla
  }
}

export function attachBridgeWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/bridge/ws' });

  wss.on('connection', (socket: WebSocket) => {
    const ws = socket as BridgeSocket;
    ws.authed = false;

    const authTimeout = setTimeout(() => {
      if (!ws.authed) {
        try { ws.close(4001, 'auth timeout'); } catch { /* noop */ }
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // mensaje no-JSON, se ignora
      }

      if (msg.type === 'auth') {
        clearTimeout(authTimeout);
        const schoolId = String(msg.school_id || '');
        if (!schoolId || !apiKeyMatches(msg.api_key)) {
          try { ws.send(JSON.stringify({ type: 'auth_failed' })); } catch { /* noop */ }
          try { ws.close(4003, 'unauthorized'); } catch { /* noop */ }
          return;
        }
        ws.schoolId = schoolId;
        ws.authed = true;
        ws.lastHeartbeat = Date.now();
        registerConnection(schoolId, ws);
        try { ws.send(JSON.stringify({ type: 'auth_ok' })); } catch { /* noop */ }
        touchHeartbeat(schoolId);
        pushPending(ws, schoolId);
        return;
      }

      if (!ws.authed || !ws.schoolId) return; // nada más se procesa sin auth

      if (msg.type === 'heartbeat') {
        ws.lastHeartbeat = Date.now();
        touchHeartbeat(ws.schoolId);
        return;
      }

      if (msg.type === 'poll') {
        pushPending(ws, ws.schoolId);
        return;
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (ws.schoolId) unregisterConnection(ws.schoolId, ws);
    });

    ws.on('error', () => {
      // 'close' se dispara igual después de 'error' -- no hace falta
      // desregistrar acá también.
    });
  });

  const staleCheck = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as BridgeSocket;
      if (ws.authed && ws.lastHeartbeat && Date.now() - ws.lastHeartbeat > HEARTBEAT_STALE_MS) {
        try { ws.terminate(); } catch { /* noop */ }
      }
    });
  }, STALE_CHECK_INTERVAL_MS);
  staleCheck.unref();

  return wss;
}
