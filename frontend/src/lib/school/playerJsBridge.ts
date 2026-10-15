/**
 * Puente mínimo con un reproductor en iframe que habla el protocolo player.js
 * (https://github.com/embedly/player.js/blob/master/SPEC.rst) — el que usa el
 * reproductor de Bunny Stream (https://docs.bunny.net/stream/playback-api).
 * Sirve para «Marcar inicio / fin» de un clip leyendo el segundo actual, y
 * para saltar al inicio de un clip. Sin scripts de terceros: solo postMessage.
 *
 * Si el reproductor no responde (otro proveedor, red lenta), getCurrentTime
 * devuelve null y la UI deja escribir el minuto a mano.
 */

const CONTEXT = 'player.js';
const VERSION = '0.0.11';

export interface PlayerBridge {
  getCurrentTime(timeoutMs?: number): Promise<number | null>;
  setCurrentTime(sec: number): void;
  play(): void;
  pause(): void;
  readonly ready: boolean;
  dispose(): void;
}

interface Msg { context?: string; event?: string; method?: string; value?: unknown; listener?: string }

function parse(data: unknown): Msg | null {
  try {
    const m = typeof data === 'string' ? JSON.parse(data) : data;
    return m && typeof m === 'object' && (m as Msg).context === CONTEXT ? (m as Msg) : null;
  } catch { return null; }
}

export function createPlayerBridge(iframe: HTMLIFrameElement, win: Window = window): PlayerBridge {
  let origin = '*';
  try { origin = new URL(iframe.src).origin; } catch { /* src relativo o vacío */ }
  let ready = false;
  let seq = 0;
  const pending = new Map<string, (v: number | null) => void>();
  const queue: Msg[] = [];

  // Se manda YA aunque no haya llegado «ready»: el reproductor puede haberlo
  // emitido antes de que existiera este puente (carga rápida). Si «ready» llega
  // después, se reenvía lo pendiente (una respuesta repetida se ignora).
  const post = (m: Msg) => {
    const msg = { context: CONTEXT, version: VERSION, ...m };
    if (!ready) queue.push(msg);
    iframe.contentWindow?.postMessage(JSON.stringify(msg), origin);
  };

  const onMessage = (ev: MessageEvent) => {
    if (ev.source !== iframe.contentWindow) return;
    if (origin !== '*' && ev.origin !== origin) return;
    const m = parse(ev.data);
    if (!m) return;
    if (m.event === 'ready') {
      ready = true;
      for (const q of queue.splice(0)) iframe.contentWindow?.postMessage(JSON.stringify(q), origin);
      return;
    }
    const id = m.listener;
    if (id && pending.has(id)) {
      const n = Number(m.value);
      pending.get(id)!(Number.isFinite(n) ? n : null);
      pending.delete(id);
    }
  };
  win.addEventListener('message', onMessage);

  return {
    get ready() { return ready; },
    getCurrentTime(timeoutMs = 1500) {
      return new Promise<number | null>((resolve) => {
        const id = String(++seq);
        const t = setTimeout(() => { pending.delete(id); resolve(null); }, timeoutMs);
        pending.set(id, (v) => { clearTimeout(t); resolve(v); });
        post({ method: 'getCurrentTime', listener: id });
      });
    },
    setCurrentTime(sec: number) { post({ method: 'setCurrentTime', value: Math.max(0, sec) }); },
    play() { post({ method: 'play' }); },
    pause() { post({ method: 'pause' }); },
    dispose() {
      win.removeEventListener('message', onMessage);
      for (const r of pending.values()) r(null);
      pending.clear();
    },
  };
}
