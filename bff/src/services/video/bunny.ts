/**
 * Adaptador de Bunny Stream (proveedor recomendado en el spec M6h, §3).
 * Escrito contra la documentación oficial (consultada 2026-10-15):
 *
 *   · API:      https://video.bunnycdn.com, header `AccessKey: <API key de la librería>`
 *               POST   /library/{libraryId}/videos            { title } → { guid, … }
 *               GET    /library/{libraryId}/videos/{videoId}  → { guid, status, length, storageSize, … }
 *               DELETE /library/{libraryId}/videos/{videoId}
 *               https://bunny.net/docs/stream/http-api
 *   · Subida directa (tus): POST https://video.bunnycdn.com/tusupload con headers
 *               AuthorizationSignature = sha256(library_id + api_key + expiration_time + video_id) (hex),
 *               AuthorizationExpire (unix s), VideoId, LibraryId; metadatos filetype y title.
 *               La firma se calcula en el servidor: la llave nunca llega al navegador.
 *               https://docs.bunny.net/stream/tus-resumable-uploads
 *   · Reproducción privada: «Embed view token authentication» de la librería:
 *               https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token=…&expires=…
 *               token = SHA256_HEX(token_security_key + video_id + expiration).
 *               https://docs.bunny.net/stream/token-authentication
 *   · Webhook:  headers X-BunnyStream-Signature (HMAC-SHA256 hex del cuerpo crudo con la
 *               API key de SOLO LECTURA de la librería), X-BunnyStream-Signature-Version = v1,
 *               X-BunnyStream-Signature-Algorithm = hmac-sha256. Cuerpo
 *               { VideoLibraryId, VideoGuid, Status 0..10 }. Sin timestamp: el payload es
 *               solo un aviso; el estado de verdad se relee con GET (getAsset), así que
 *               repetir un webhook no cambia nada.
 *               https://bunny.net/docs/stream/webhooks
 *
 * Campos del GET de video (`status`, `length`, `storageSize`): según la referencia
 * del API (https://docs.bunny.net/api-reference/stream/manage-videos/get-video);
 * verificarlos con la primera subida real antes de abrir el flag a escuelas.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CreateUploadInput, type CreateUploadResult, type FetchLike, type PlaybackOptions, type PlaybackUrl,
  type ProviderAsset, type ProviderAssetStatus, type VideoProvider, type WebhookEvent, VideoProviderError,
} from './types';

export interface BunnyConfig {
  libraryId: string;
  /** API key de la librería (escritura). Solo en el BFF. */
  apiKey: string;
  /** API key de SOLO LECTURA de la librería: secreto de la firma del webhook. */
  readOnlyApiKey: string;
  /** «Token authentication key» de la librería (Embed view token authentication). */
  tokenKey: string;
  apiBase?: string;
  tusEndpoint?: string;
  embedBase?: string;
  /** Vida de la autorización de subida (s). Un archivo de 4 GB en 4G puede tardar horas. */
  uploadAuthTtlS?: number;
  fetch?: FetchLike;
  now?: () => Date;
}

export const BUNNY_DEFAULTS = {
  apiBase: 'https://video.bunnycdn.com',
  tusEndpoint: 'https://video.bunnycdn.com/tusupload',
  embedBase: 'https://iframe.mediadelivery.net/embed',
  uploadAuthTtlS: 12 * 3600,
  /** 8 MiB: múltiplo de 256 KiB, cabe en redes móviles sin reintentos largos. */
  chunkSize: 8 * 1024 * 1024,
} as const;

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/** Firma de la subida tus (doc oficial): sha256(library_id + api_key + expiration_time + video_id). */
export function bunnyUploadSignature(libraryId: string, apiKey: string, expires: number, videoId: string): string {
  return sha256Hex(`${libraryId}${apiKey}${expires}${videoId}`);
}

/** Token del embed (doc oficial): SHA256_HEX(token_security_key + video_id + expiration). */
export function bunnyEmbedToken(tokenKey: string, videoId: string, expires: number): string {
  return sha256Hex(`${tokenKey}${videoId}${expires}`);
}

/** Estado del GET de video → nuestro estado. 0 creado, 1 subido, 2 procesando, 3 transcodificando,
 *  4 terminado, 5 error, 6 falló la subida; 7/8 (JIT) siguen en proceso. */
export function mapBunnyVideoStatus(s: unknown): ProviderAssetStatus {
  switch (Number(s)) {
    case 0: return 'uploading';
    case 4: return 'ready';
    case 5: case 6: return 'failed';
    default: return 'processing';
  }
}

/** Status del WEBHOOK (otra numeración, doc de webhooks) → pista de estado. */
export function mapBunnyWebhookStatus(s: unknown): ProviderAssetStatus | null {
  switch (Number(s)) {
    case 0: case 1: case 2: case 4: case 7: return 'processing';
    case 3: return 'ready';
    case 5: case 8: return 'failed';
    case 6: return 'uploading';
    default: return null; // 9 subtítulos, 10 título generado: no cambian el estado
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  const v = key ? headers[key] : undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function createBunnyProvider(cfg: BunnyConfig): VideoProvider {
  const apiBase = (cfg.apiBase ?? BUNNY_DEFAULTS.apiBase).replace(/\/+$/, '');
  const tusEndpoint = cfg.tusEndpoint ?? BUNNY_DEFAULTS.tusEndpoint;
  const embedBase = (cfg.embedBase ?? BUNNY_DEFAULTS.embedBase).replace(/\/+$/, '');
  const uploadTtl = cfg.uploadAuthTtlS ?? BUNNY_DEFAULTS.uploadAuthTtlS;
  const doFetch: FetchLike = cfg.fetch ?? ((u, i) => fetch(u, i));
  const now = cfg.now ?? (() => new Date());
  const lib = encodeURIComponent(cfg.libraryId);

  const assertGuid = (id: string) => {
    if (!GUID_RE.test(id)) throw new VideoProviderError('Id de video de Bunny inválido.');
  };

  async function api(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await doFetch(`${apiBase}${path}`, {
      method,
      headers: {
        AccessKey: cfg.apiKey,
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  return {
    name: 'bunny',

    async createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
      const res = await api('POST', `/library/${lib}/videos`, { title: input.title.slice(0, 120) });
      if (!res.ok) throw new VideoProviderError(`Bunny no creó el video (${res.status}).`, res.status);
      const data: any = await res.json().catch(() => null);
      const guid = String(data?.guid ?? data?.videoId ?? '');
      assertGuid(guid);

      const expires = Math.floor(now().getTime() / 1000) + uploadTtl;
      return {
        providerAssetId: guid,
        upload: {
          protocol: 'tus',
          endpoint: tusEndpoint,
          headers: {
            AuthorizationSignature: bunnyUploadSignature(cfg.libraryId, cfg.apiKey, expires, guid),
            AuthorizationExpire: String(expires),
            VideoId: guid,
            LibraryId: String(cfg.libraryId),
          },
          metadata: { filetype: input.mimeType, title: input.title.slice(0, 120) },
          expiresAt: new Date(expires * 1000).toISOString(),
          chunkSize: BUNNY_DEFAULTS.chunkSize,
        },
      };
    },

    getPlaybackUrl(providerAssetId: string, opts: PlaybackOptions): PlaybackUrl {
      assertGuid(providerAssetId);
      const nowS = Math.floor((opts.now ?? now()).getTime() / 1000);
      const expires = nowS + Math.max(1, Math.floor(opts.ttlS));
      const token = bunnyEmbedToken(cfg.tokenKey, providerAssetId, expires);
      const qs = new URLSearchParams({ token, expires: String(expires), autoplay: 'false', preload: 'true', responsive: 'true' });
      return {
        kind: 'iframe',
        url: `${embedBase}/${lib}/${providerAssetId}?${qs.toString()}`,
        // Miniaturas por la CDN exigen el token de la Pull Zone (fase 2): la UI
        // usa una tarjeta genérica, nunca una foto de un menor sin firmar.
        thumbnailUrl: null,
        expiresAt: new Date(expires * 1000).toISOString(),
      };
    },

    async getAsset(providerAssetId: string): Promise<ProviderAsset> {
      assertGuid(providerAssetId);
      const res = await api('GET', `/library/${lib}/videos/${providerAssetId}`);
      if (!res.ok) throw new VideoProviderError(`Bunny no devolvió el video (${res.status}).`, res.status);
      const v: any = await res.json();
      const len = Number(v?.length);
      const size = Number(v?.storageSize);
      return {
        providerAssetId,
        status: mapBunnyVideoStatus(v?.status),
        durationS: Number.isFinite(len) && len > 0 ? Math.round(len) : null,
        sizeBytes: Number.isFinite(size) && size > 0 ? Math.round(size) : null,
      };
    },

    async deleteAsset(providerAssetId: string): Promise<void> {
      assertGuid(providerAssetId);
      const res = await api('DELETE', `/library/${lib}/videos/${providerAssetId}`);
      // 404 = ya no está: el objetivo (que no exista) se cumplió.
      if (!res.ok && res.status !== 404) {
        throw new VideoProviderError(`Bunny no borró el video (${res.status}).`, res.status);
      }
    },

    webhook: {
      verify(rawBody: Buffer, headers): boolean {
        if (!Buffer.isBuffer(rawBody) || !cfg.readOnlyApiKey) return false;
        const sig = header(headers, 'x-bunnystream-signature');
        const version = header(headers, 'x-bunnystream-signature-version');
        const algo = header(headers, 'x-bunnystream-signature-algorithm');
        if (version !== 'v1' || (algo ?? '').toLowerCase() !== 'hmac-sha256') return false;
        if (!sig || !/^[0-9a-f]{64}$/i.test(sig)) return false;
        const expected = createHmac('sha256', Buffer.from(cfg.readOnlyApiKey, 'utf8')).update(rawBody).digest();
        const got = Buffer.from(sig.toLowerCase(), 'hex');
        return got.length === expected.length && timingSafeEqual(got, expected);
      },

      parse(rawBody: Buffer): WebhookEvent | null {
        let body: any;
        try { body = JSON.parse(rawBody.toString('utf8')); } catch { return null; }
        if (String(body?.VideoLibraryId ?? '') !== String(cfg.libraryId)) return null;
        const guid = String(body?.VideoGuid ?? '');
        if (!GUID_RE.test(guid)) return null;
        return { providerAssetId: guid, hintedStatus: mapBunnyWebhookStatus(body?.Status) };
      },
    },
  };
}

/** Lee la configuración del entorno. null = falta algo: el módulo responde «no configurado». */
export function bunnyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): BunnyConfig | null {
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID?.trim();
  const apiKey = env.BUNNY_STREAM_API_KEY?.trim();
  const readOnlyApiKey = env.BUNNY_STREAM_READONLY_API_KEY?.trim();
  const tokenKey = env.BUNNY_STREAM_TOKEN_KEY?.trim();
  if (!libraryId || !apiKey || !readOnlyApiKey || !tokenKey) return null;
  if (!/^\d{1,12}$/.test(libraryId)) return null;
  return {
    libraryId, apiKey, readOnlyApiKey, tokenKey,
    embedBase: env.BUNNY_STREAM_EMBED_BASE?.trim() || undefined,
  };
}
