// bff/src/services/bridgeWsServer.ts
//
// Servidor WS para bridges locales (ver bridgeWsHub.ts para el porqué).
// Protocolo, todo JSON sobre la misma conexión:
//   cliente -> servidor  {type:'auth', school_id, api_key, command_types?}  -- primer mensaje, obligatorio
//                        command_types: coma-separado, default 'open_door' (igual que el
//                        GET /door-commands viejo) -- Dreamers manda 'open_door,set_group'
//                        porque sus lectores no procesan set_group nativo por ADMS.
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

// Tope de tamaño de frame -- sin esto el default de `ws` es ~100 MiB y un
// frame así, aun antes de autenticar, va directo a JSON.parse(). El
// protocolo real (auth/heartbeat/poll) nunca pasa de un par de líneas.
const MAX_PAYLOAD_BYTES = 8 * 1024;

// Fuerza bruta de BRIDGE_API_KEY por reconexión: sin esto, cada conexión
// nueva es un intento gratis (AUTH_TIMEOUT_MS no limita reintentos en OTRA
// conexión). Ventana simple en memoria, por IP -- alcanza para esto porque
// el proceso del BFF hoy es una sola instancia (mismo supuesto que
// bridgeWsHub.ts documenta para el registro de conexiones).
const AUTH_FAIL_WINDOW_MS = 5 * 60_000;
const AUTH_FAIL_MAX = 20;
const authFailuresByIp = new Map<string, { count: number; windowStart: number }>();

function registerAuthFailure(ip: string) {
  const now = Date.now();
  const entry = authFailuresByIp.get(ip);
  if (!entry || now - entry.windowStart > AUTH_FAIL_WINDOW_MS) {
    authFailuresByIp.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

function isRateLimited(ip: string): boolean {
  const entry = authFailuresByIp.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > AUTH_FAIL_WINDOW_MS) {
    authFailuresByIp.delete(ip);
    return false;
  }
  return entry.count >= AUTH_FAIL_MAX;
}

// Mismo criterio que access-adms.ts::clientIp (ver ese archivo para el porqué
// completo): Render pone a Cloudflare de borde SIEMPRE, dos saltos de proxy
// (cliente -> Cloudflare -> Render -> app), no uno. `CF-Connecting-IP` es el
// header que Cloudflare mismo fija con la IP real que vio en el socket -- el
// cliente no puede falsificarlo. El upgrade de un WS no pasa por el
// `trust proxy` de Express (eso solo aplica a requests que Express mismo
// enruta), así que se resuelve a mano acá; el fallback de X-Forwarded-For
// queda solo para local/dev sin Cloudflare por delante.
function requestIp(req: import('http').IncomingMessage): string {
  const cfIp = (req.headers['cf-connecting-ip'] as string) || '';
  if (cfIp) return cfIp.trim();
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : (req.socket?.remoteAddress || '');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El WS solo debe aceptar el school_id que el propio cliente declara si esa
// escuela de verdad tiene un bridge local dado de alta -- sin esto, la key
// (compartida entre escuelas, ver bridge.routes.ts) autentica la conexión
// pero CUALQUIER school_id pasaba, incluido el de una escuela ajena o uno
// inventado. No resuelve el key global compartido (eso requeriría una key
// por escuela, evaluado y descartado por ahora por el costo operativo de
// rotarla en cada PC física) pero cierra la suplantación de escuela.
async function schoolHasLocalBridge(schoolId: string): Promise<boolean> {
  const { data } = await supabase
    .from('turnstile_devices')
    .select('id')
    .eq('school_id', schoolId)
    .eq('has_local_bridge', true)
    .limit(1)
    .maybeSingle();
  return !!data;
}

interface BridgeSocket extends WebSocket {
  schoolId?: string;
  authed?: boolean;
  lastHeartbeat?: number;
  commandTypes?: string[];
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
    const commands = await claimAndMapCommands(schoolId, ws.commandTypes || ['open_door']);
    if (commands.length > 0 && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'commands', commands }));
    }
  } catch {
    // best-effort -- el cliente puede volver a mandar 'poll' si esto falla
  }
}

export function attachBridgeWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/bridge/ws', maxPayload: MAX_PAYLOAD_BYTES });

  wss.on('connection', (socket: WebSocket, req: import('http').IncomingMessage) => {
    const ws = socket as BridgeSocket;
    ws.authed = false;
    const ip = requestIp(req);

    if (isRateLimited(ip)) {
      try { ws.close(4029, 'too many auth failures'); } catch { /* noop */ }
      return;
    }

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
        // Un socket ya autenticado no puede re-autenticarse con OTRO
        // school_id: sin este freno, una sola conexión se registraba en N
        // escuelas a la vez (amplifica la suplantación de más abajo) y
        // `close` solo desregistraba la última.
        if (ws.authed) return;

        clearTimeout(authTimeout);
        const schoolId = String(msg.school_id || '');
        if (!UUID_RE.test(schoolId) || !apiKeyMatches(msg.api_key)) {
          registerAuthFailure(ip);
          try { ws.send(JSON.stringify({ type: 'auth_failed' })); } catch { /* noop */ }
          try { ws.close(4003, 'unauthorized'); } catch { /* noop */ }
          return;
        }

        schoolHasLocalBridge(schoolId).then((hasBridge) => {
          if (ws.readyState !== ws.OPEN) return;
          if (!hasBridge) {
            registerAuthFailure(ip);
            try { ws.send(JSON.stringify({ type: 'auth_failed' })); } catch { /* noop */ }
            try { ws.close(4003, 'unauthorized'); } catch { /* noop */ }
            return;
          }
          const commandTypes = String(msg.command_types || 'open_door')
            .split(',').map((t: string) => t.trim()).filter(Boolean);
          ws.schoolId = schoolId;
          ws.authed = true;
          ws.commandTypes = commandTypes;
          ws.lastHeartbeat = Date.now();
          registerConnection(schoolId, ws);
          try { ws.send(JSON.stringify({ type: 'auth_ok' })); } catch { /* noop */ }
          touchHeartbeat(schoolId);
          pushPending(ws, schoolId);
        }, () => {
          // fallo de DB al verificar -- no autenticar por las dudas.
          try { ws.close(1011, 'internal error'); } catch { /* noop */ }
        });
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
