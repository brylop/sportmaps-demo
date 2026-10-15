/**
 * Proveedor de video activo (M6h). `VIDEO_PROVIDER` elige el adaptador; hoy
 * solo existe `bunny`. Sin variables completas → null y las rutas responden
 * 503 «todavía no configurado» (nunca se cae el resto del BFF).
 */
import { bunnyConfigFromEnv, createBunnyProvider } from './bunny';
import type { VideoProvider } from './types';

export * from './types';

let cached: { key: string; provider: VideoProvider | null } | null = null;
let override: VideoProvider | null | undefined;

export function getVideoProvider(env: NodeJS.ProcessEnv = process.env): VideoProvider | null {
  if (override !== undefined) return override;
  const name = (env.VIDEO_PROVIDER || 'bunny').trim().toLowerCase();
  const key = `${name}|${env.BUNNY_STREAM_LIBRARY_ID ?? ''}`;
  if (cached?.key === key) return cached.provider;
  let provider: VideoProvider | null = null;
  if (name === 'bunny') {
    const cfg = bunnyConfigFromEnv(env);
    provider = cfg ? createBunnyProvider(cfg) : null;
  }
  cached = { key, provider };
  return provider;
}

/** Solo pruebas: fija el proveedor (null = no configurado; undefined = volver al entorno). */
export function __setVideoProviderForTests(p: VideoProvider | null | undefined): void {
  override = p;
  cached = null;
}
