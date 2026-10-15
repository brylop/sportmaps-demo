/**
 * Abstracción del proveedor de video — M6h (docs/specs/pizarra-m6h-videos-subidos.md).
 *
 * El archivo NUNCA pasa por el BFF ni por Supabase Storage: el BFF solo
 *   1. pide al proveedor un «hueco» de subida y le entrega al navegador una
 *      autorización de subida directa y temporal (tus resumable);
 *   2. firma URLs de reproducción que vencen (nunca públicas);
 *   3. borra el asset;
 *   4. verifica la firma de los webhooks del proveedor.
 *
 * Cambiar de proveedor = escribir otro adaptador con esta interfaz
 * (bunny.ts es el recomendado; Cloudflare Stream y Mux están mapeados en el spec).
 */

export type VideoProviderName = 'bunny' | 'cloudflare' | 'mux' | 'apivideo';

/** Estado del asset tal como lo reporta el proveedor, ya normalizado. */
export type ProviderAssetStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface CreateUploadInput {
  /** Nuestro id (school_videos.id). Va en los metadatos del proveedor. */
  videoId: string;
  schoolId: string;
  title: string;
  sizeBytes: number;
  mimeType: string;
  /** Tope de duración reservado en el cupo (segundos). */
  maxDurationS: number;
}

/**
 * Lo que necesita el navegador para subir directo al proveedor con tus 1.0.0.
 * El cliente (frontend/src/lib/school/resumableUpload.ts) hace el POST de
 * creación a `endpoint` con estos headers y metadatos, y luego PATCH por trozos.
 */
export interface DirectUpload {
  protocol: 'tus';
  endpoint: string;
  /** Headers de autorización temporales (nunca la llave del API). */
  headers: Record<string, string>;
  /** Upload-Metadata (el cliente los codifica en base64). */
  metadata: Record<string, string>;
  /** Hasta cuándo sirve la autorización (ISO). */
  expiresAt: string;
  /** Tamaño de trozo sugerido (bytes). */
  chunkSize: number;
}

export interface CreateUploadResult {
  providerAssetId: string;
  upload: DirectUpload;
}

export interface PlaybackOptions {
  /** Segundos de vida de la URL firmada (ya acotados por policy.clampTtl). */
  ttlS: number;
  /** Para abrir directo en un clip. */
  startS?: number;
  now?: Date;
}

export interface PlaybackUrl {
  /** 'iframe' = reproductor del proveedor; 'video' = archivo/HLS para <video>. */
  kind: 'iframe' | 'video';
  url: string;
  thumbnailUrl?: string | null;
  expiresAt: string;
}

export interface ProviderAsset {
  providerAssetId: string;
  status: ProviderAssetStatus;
  durationS: number | null;
  sizeBytes: number | null;
}

export interface WebhookEvent {
  providerAssetId: string;
  /** Lo que dice el payload. NO se confía: el BFF relee el asset con getAsset. */
  hintedStatus: ProviderAssetStatus | null;
}

export interface VideoProvider {
  readonly name: VideoProviderName;
  createUpload(input: CreateUploadInput): Promise<CreateUploadResult>;
  getPlaybackUrl(providerAssetId: string, opts: PlaybackOptions): PlaybackUrl;
  getAsset(providerAssetId: string): Promise<ProviderAsset>;
  deleteAsset(providerAssetId: string): Promise<void>;
  webhook: {
    /** Firma válida sobre el cuerpo CRUDO (Buffer exacto, sin re-serializar). */
    verify(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
    parse(rawBody: Buffer): WebhookEvent | null;
  };
}

export class VideoProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'VideoProviderError';
  }
}

/** fetch inyectable (las pruebas lo mockean; nada sale a la red). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
