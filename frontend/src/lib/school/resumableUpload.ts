/**
 * Subida reanudable con tus 1.0.0 (core + creation), directo del navegador al
 * proveedor de video — M6h (docs/specs/pizarra-m6h-videos-subidos.md).
 *
 * Por qué uno propio y no tus-js-client: el repo no lo tiene instalado y lo que
 * hace falta es poco y se prueba entero con un fetch falso:
 *   · POST de creación (Upload-Length + Upload-Metadata) → Location;
 *   · PATCH por trozos con Upload-Offset;
 *   · si se cae la red: espera a que vuelva (evento `online`) o reintenta con
 *     espera creciente, y antes de seguir pregunta con HEAD por dónde iba (el
 *     servidor manda: nunca se reenvía desde cero);
 *   · cancelar = abortar lo que esté en vuelo y no seguir.
 * Las cabeceras de autorización las da el BFF (temporales, firmadas por él):
 * van en TODAS las peticiones. El archivo nunca toca el BFF ni Supabase.
 */

export type UploadStatus = 'idle' | 'uploading' | 'offline' | 'retrying' | 'done' | 'error' | 'cancelled';

export interface UploadProgress {
  sent: number;
  total: number;
  /** 0–100, entero. */
  percent: number;
}

export interface ResumableUploadOptions {
  file: Blob;
  endpoint: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  /** Bytes por PATCH. Se redondea a múltiplo de 256 KiB. */
  chunkSize?: number;
  onProgress?: (p: UploadProgress) => void;
  onStatus?: (s: UploadStatus, detail?: string) => void;
  /** Esperas entre reintentos (ms). Agotadas → error. */
  retryDelays?: number[];
  fetchImpl?: typeof fetch;
  /** Detección de red (inyectable en pruebas). */
  isOnline?: () => boolean;
  /** Suscribe a «volvió la red»; devuelve el des-suscriptor. */
  onOnline?: (cb: () => void) => () => void;
  /** Espera (inyectable en pruebas). */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export class UploadCancelledError extends Error {
  constructor() { super('Subida cancelada.'); this.name = 'UploadCancelledError'; }
}
export class UploadFailedError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = 'UploadFailedError'; }
}

const TUS_VERSION = '1.0.0';
const KIB256 = 256 * 1024;
export const DEFAULT_CHUNK = 8 * 1024 * 1024;
export const DEFAULT_RETRY_DELAYS = [1000, 3000, 5000, 10000, 20000, 30000, 60000];

/** base64 de UTF-8 (títulos con tildes y eñes). */
export function b64utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export function encodeMetadata(meta: Record<string, string>): string {
  return Object.entries(meta)
    .filter(([k]) => /^[A-Za-z0-9_.-]+$/.test(k))
    .map(([k, v]) => `${k} ${b64utf8(String(v))}`)
    .join(',');
}

export function normalizeChunk(n?: number): number {
  const c = Number(n) > 0 ? Number(n) : DEFAULT_CHUNK;
  return Math.max(KIB256, Math.floor(c / KIB256) * KIB256);
}

const defaultSleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new UploadCancelledError()); return; }
  const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(t); reject(new UploadCancelledError()); };
  signal.addEventListener('abort', onAbort, { once: true });
});

/** Error de red (sin respuesta) o del servidor que vale la pena reintentar. */
const retryableStatus = (s: number) => s >= 500 || s === 409 || s === 423 || s === 429 || s === 460;

export class ResumableUpload {
  private readonly o: Required<Omit<ResumableUploadOptions, 'onProgress' | 'onStatus' | 'headers' | 'metadata'>> & ResumableUploadOptions;
  private readonly ctrl = new AbortController();
  private uploadUrl: string | null = null;
  private offset = 0;
  private status: UploadStatus = 'idle';

  constructor(opts: ResumableUploadOptions) {
    this.o = {
      ...opts,
      chunkSize: normalizeChunk(opts.chunkSize),
      retryDelays: opts.retryDelays ?? DEFAULT_RETRY_DELAYS,
      fetchImpl: opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
      isOnline: opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)),
      onOnline: opts.onOnline ?? ((cb: () => void) => {
        if (typeof window === 'undefined') return () => undefined;
        window.addEventListener('online', cb);
        return () => window.removeEventListener('online', cb);
      }),
      sleep: opts.sleep ?? defaultSleep,
    };
  }

  get url(): string | null { return this.uploadUrl; }
  get bytesSent(): number { return this.offset; }
  get currentStatus(): UploadStatus { return this.status; }

  private setStatus(s: UploadStatus, detail?: string) {
    this.status = s;
    this.o.onStatus?.(s, detail);
  }

  private progress() {
    const total = this.o.file.size;
    this.o.onProgress?.({ sent: this.offset, total, percent: total ? Math.min(100, Math.floor((this.offset / total) * 100)) : 100 });
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { ...(this.o.headers ?? {}), 'Tus-Resumable': TUS_VERSION, ...extra };
  }

  private async req(url: string, init: RequestInit): Promise<Response> {
    if (this.ctrl.signal.aborted) throw new UploadCancelledError();
    try {
      return await this.o.fetchImpl(url, { ...init, signal: this.ctrl.signal });
    } catch (err) {
      if (this.ctrl.signal.aborted) throw new UploadCancelledError();
      throw Object.assign(new Error('Sin conexión.'), { network: true, cause: err });
    }
  }

  private async create(): Promise<void> {
    const res = await this.req(this.o.endpoint, {
      method: 'POST',
      headers: this.headers({
        'Upload-Length': String(this.o.file.size),
        ...(this.o.metadata ? { 'Upload-Metadata': encodeMetadata(this.o.metadata) } : {}),
      }),
    });
    if (res.status !== 201 && res.status !== 200) {
      if (retryableStatus(res.status)) throw Object.assign(new Error(`El servidor respondió ${res.status}.`), { network: true });
      throw new UploadFailedError(`El servicio de video rechazó la subida (${res.status}).`, res.status);
    }
    const loc = res.headers.get('Location') ?? res.headers.get('location');
    if (!loc) throw new UploadFailedError('El servicio de video no devolvió la dirección de subida.');
    this.uploadUrl = new URL(loc, this.o.endpoint).toString();
    this.offset = 0;
  }

  /** HEAD: ¿por qué byte va el servidor? */
  private async resync(): Promise<void> {
    if (!this.uploadUrl) return;
    const res = await this.req(this.uploadUrl, { method: 'HEAD', headers: this.headers() });
    if (res.status === 404 || res.status === 410) {
      // El servidor ya no conoce la subida: se empieza otra.
      this.uploadUrl = null;
      this.offset = 0;
      return;
    }
    if (!res.ok) {
      if (retryableStatus(res.status)) throw Object.assign(new Error(`El servidor respondió ${res.status}.`), { network: true });
      throw new UploadFailedError(`No se pudo reanudar la subida (${res.status}).`, res.status);
    }
    const off = Number(res.headers.get('Upload-Offset'));
    if (Number.isFinite(off) && off >= 0 && off <= this.o.file.size) this.offset = off;
  }

  private async patchChunk(): Promise<void> {
    const end = Math.min(this.offset + this.o.chunkSize, this.o.file.size);
    const chunk = this.o.file.slice(this.offset, end);
    const res = await this.req(this.uploadUrl!, {
      method: 'PATCH',
      headers: this.headers({ 'Upload-Offset': String(this.offset), 'Content-Type': 'application/offset+octet-stream' }),
      body: chunk,
    });
    if (res.status !== 204 && res.status !== 200) {
      if (retryableStatus(res.status)) throw Object.assign(new Error(`El servidor respondió ${res.status}.`), { network: true });
      throw new UploadFailedError(`El servicio de video rechazó un trozo (${res.status}).`, res.status);
    }
    const next = Number(res.headers.get('Upload-Offset'));
    this.offset = Number.isFinite(next) && next > this.offset ? Math.min(next, this.o.file.size) : end;
    this.progress();
  }

  /** Espera a que vuelva la red (o a que cancelen). */
  private waitOnline(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.ctrl.signal.aborted) { reject(new UploadCancelledError()); return; }
      const off = this.o.onOnline(() => { cleanup(); resolve(); });
      const onAbort = () => { cleanup(); reject(new UploadCancelledError()); };
      const cleanup = () => { off(); this.ctrl.signal.removeEventListener('abort', onAbort); };
      this.ctrl.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async start(): Promise<void> {
    if (this.status === 'uploading' || this.status === 'done') return;
    this.setStatus('uploading');
    this.progress();
    let attempt = 0;
    for (;;) {
      try {
        if (!this.uploadUrl) await this.create();
        while (this.offset < this.o.file.size) {
          await this.patchChunk();
          attempt = 0; // un trozo que entra reinicia los reintentos
          if (this.currentStatus !== 'uploading') this.setStatus('uploading');
        }
        this.setStatus('done');
        return;
      } catch (err: any) {
        if (err instanceof UploadCancelledError || this.ctrl.signal.aborted) {
          this.setStatus('cancelled');
          throw new UploadCancelledError();
        }
        if (!err?.network) {
          this.setStatus('error', err?.message);
          throw err instanceof UploadFailedError ? err : new UploadFailedError(String(err?.message ?? err));
        }
        if (!this.o.isOnline()) {
          this.setStatus('offline');
          await this.waitOnline().catch((e) => { this.setStatus('cancelled'); throw e; });
        } else {
          if (attempt >= this.o.retryDelays.length) {
            this.setStatus('error', 'Sin conexión estable con el servicio de video.');
            throw new UploadFailedError('Se perdió la conexión demasiadas veces. Intenta de nuevo con mejor señal.');
          }
          this.setStatus('retrying');
          await this.o.sleep(this.o.retryDelays[attempt++], this.ctrl.signal).catch((e) => { this.setStatus('cancelled'); throw e; });
        }
        // Antes de seguir: ¿hasta dónde llegó de verdad?
        try { await this.resync(); } catch (e: any) {
          if (e instanceof UploadCancelledError) { this.setStatus('cancelled'); throw e; }
          if (!e?.network) { this.setStatus('error', e?.message); throw e; }
          // red todavía mala: el próximo giro del bucle reintenta.
        }
      }
    }
  }

  /** Cancela lo que esté en vuelo. start() rechaza con UploadCancelledError. */
  cancel(): void {
    if (this.status === 'done') return;
    this.ctrl.abort();
    if (this.status === 'idle') this.setStatus('cancelled');
  }
}
