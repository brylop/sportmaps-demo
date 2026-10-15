/**
 * Adaptador de Bunny Stream (M6h) con el HTTP MOCKEADO: ninguna prueba sale a
 * la red ni necesita llaves reales. Las fórmulas se contrastan con las de la
 * documentación oficial (ver encabezado de bunny.ts).
 */
import { describe, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import {
  bunnyConfigFromEnv, bunnyEmbedToken, bunnyUploadSignature, createBunnyProvider,
  mapBunnyVideoStatus, mapBunnyWebhookStatus,
} from './bunny';
import { VideoProviderError } from './types';

const LIB = '123456';
const GUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CFG = { libraryId: LIB, apiKey: 'api-key-escritura', readOnlyApiKey: 'llave-solo-lectura', tokenKey: 'llave-token-embed' };
const NOW = new Date('2026-10-15T15:00:00Z');
const NOW_S = Math.floor(NOW.getTime() / 1000);

function mockFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  });
  return { fn, calls };
}

const sign = (body: string, key = CFG.readOnlyApiKey) => createHmac('sha256', key).update(Buffer.from(body)).digest('hex');
const hooks = (sig: string, extra: Record<string, string> = {}) => ({
  'x-bunnystream-signature': sig, 'x-bunnystream-signature-version': 'v1', 'x-bunnystream-signature-algorithm': 'hmac-sha256', ...extra,
});

describe('fórmulas de la documentación', () => {
  it('firma de subida tus = sha256(library_id + api_key + expiration_time + video_id)', () => {
    const exp = 1760540000;
    const expected = createHash('sha256').update(`${LIB}${CFG.apiKey}${exp}${GUID}`).digest('hex');
    expect(bunnyUploadSignature(LIB, CFG.apiKey, exp, GUID)).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });
  it('token del embed = SHA256_HEX(token_security_key + video_id + expiration)', () => {
    const exp = 1760540000;
    expect(bunnyEmbedToken(CFG.tokenKey, GUID, exp)).toBe(createHash('sha256').update(`${CFG.tokenKey}${GUID}${exp}`).digest('hex'));
  });
  it('estados del GET y del webhook', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(mapBunnyVideoStatus)).toEqual(
      ['uploading', 'processing', 'processing', 'processing', 'ready', 'failed', 'failed', 'processing']);
    expect(mapBunnyWebhookStatus(3)).toBe('ready');
    expect(mapBunnyWebhookStatus(5)).toBe('failed');
    expect(mapBunnyWebhookStatus(8)).toBe('failed');
    expect(mapBunnyWebhookStatus(9)).toBeNull();
  });
});

describe('createUpload', () => {
  it('crea el video con AccessKey y devuelve una autorización tus SIN la llave', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { guid: GUID, videoLibraryId: 123456 } }));
    const p = createBunnyProvider({ ...CFG, fetch: fn as any, now: () => NOW });
    const out = await p.createUpload({ videoId: 'v', schoolId: 's', title: 'Partido vs Rival', sizeBytes: 1000, mimeType: 'video/mp4', maxDurationS: 600 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://video.bunnycdn.com/library/${LIB}/videos`);
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as any).AccessKey).toBe(CFG.apiKey);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ title: 'Partido vs Rival' });

    expect(out.providerAssetId).toBe(GUID);
    const exp = NOW_S + 12 * 3600;
    expect(out.upload).toMatchObject({
      protocol: 'tus', endpoint: 'https://video.bunnycdn.com/tusupload',
      headers: { AuthorizationExpire: String(exp), VideoId: GUID, LibraryId: LIB, AuthorizationSignature: bunnyUploadSignature(LIB, CFG.apiKey, exp, GUID) },
      metadata: { filetype: 'video/mp4', title: 'Partido vs Rival' },
    });
    expect(out.upload.chunkSize % (256 * 1024)).toBe(0);
    // Nada de lo que va al navegador contiene la llave del API.
    expect(JSON.stringify(out)).not.toContain(CFG.apiKey);
    expect(JSON.stringify(out)).not.toContain(CFG.readOnlyApiKey);
  });

  it('error del proveedor → VideoProviderError con el status', async () => {
    const { fn } = mockFetch(() => ({ status: 401, body: { Message: 'Unauthorized' } }));
    const p = createBunnyProvider({ ...CFG, fetch: fn as any });
    await expect(p.createUpload({ videoId: 'v', schoolId: 's', title: 't', sizeBytes: 1, mimeType: 'video/mp4', maxDurationS: 60 }))
      .rejects.toMatchObject({ name: 'VideoProviderError', status: 401 });
  });

  it('respuesta sin guid válido → error (no se guarda basura)', async () => {
    const { fn } = mockFetch(() => ({ status: 200, body: { guid: '../../etc' } }));
    const p = createBunnyProvider({ ...CFG, fetch: fn as any });
    await expect(p.createUpload({ videoId: 'v', schoolId: 's', title: 't', sizeBytes: 1, mimeType: 'video/mp4', maxDurationS: 60 }))
      .rejects.toBeInstanceOf(VideoProviderError);
  });
});

describe('getPlaybackUrl (firmada, con TTL)', () => {
  it('URL del embed con token y expires = ahora + ttl', () => {
    const p = createBunnyProvider({ ...CFG, now: () => NOW });
    const out = p.getPlaybackUrl(GUID, { ttlS: 900 });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe(`https://iframe.mediadelivery.net/embed/${LIB}/${GUID}`);
    expect(u.searchParams.get('expires')).toBe(String(NOW_S + 900));
    expect(u.searchParams.get('token')).toBe(bunnyEmbedToken(CFG.tokenKey, GUID, NOW_S + 900));
    expect(out.kind).toBe('iframe');
    expect(out.expiresAt).toBe(new Date((NOW_S + 900) * 1000).toISOString());
    expect(out.url).not.toContain(CFG.tokenKey);
  });
  it('TTL distinto → expires y token distintos', () => {
    const p = createBunnyProvider({ ...CFG, now: () => NOW });
    const a = new URL(p.getPlaybackUrl(GUID, { ttlS: 60 }).url);
    const b = new URL(p.getPlaybackUrl(GUID, { ttlS: 3600 }).url);
    expect(Number(b.searchParams.get('expires')) - Number(a.searchParams.get('expires'))).toBe(3540);
    expect(a.searchParams.get('token')).not.toBe(b.searchParams.get('token'));
  });
  it('id inválido → error (no se arma una URL con texto del usuario)', () => {
    const p = createBunnyProvider(CFG);
    expect(() => p.getPlaybackUrl('x/../y', { ttlS: 60 })).toThrow(VideoProviderError);
  });
});

describe('getAsset / deleteAsset', () => {
  it('lee estado, duración y tamaño', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { guid: GUID, status: 4, length: 5423.4, storageSize: 987654321 } }));
    const p = createBunnyProvider({ ...CFG, fetch: fn as any });
    expect(await p.getAsset(GUID)).toEqual({ providerAssetId: GUID, status: 'ready', durationS: 5423, sizeBytes: 987654321 });
    expect(calls[0].url).toBe(`https://video.bunnycdn.com/library/${LIB}/videos/${GUID}`);
    expect(calls[0].init.method).toBe('GET');
  });
  it('borra con DELETE; 404 cuenta como borrado; 500 es error', async () => {
    let status = 200;
    const { fn, calls } = mockFetch(() => ({ status, body: {} }));
    const p = createBunnyProvider({ ...CFG, fetch: fn as any });
    await p.deleteAsset(GUID);
    expect(calls[0].init.method).toBe('DELETE');
    status = 404; await expect(p.deleteAsset(GUID)).resolves.toBeUndefined();
    status = 500; await expect(p.deleteAsset(GUID)).rejects.toBeInstanceOf(VideoProviderError);
  });
});

describe('webhook: firma', () => {
  const p = createBunnyProvider(CFG);
  const body = JSON.stringify({ VideoLibraryId: 123456, VideoGuid: GUID, Status: 3 });

  it('firma válida sobre el cuerpo crudo → true', () => {
    expect(p.webhook.verify(Buffer.from(body), hooks(sign(body)))).toBe(true);
    // Mayúsculas en el hex y en el nombre del header también valen.
    expect(p.webhook.verify(Buffer.from(body), { 'X-BunnyStream-Signature': sign(body).toUpperCase(), 'X-BunnyStream-Signature-Version': 'v1', 'X-BunnyStream-Signature-Algorithm': 'HMAC-SHA256' })).toBe(true);
  });
  it('cuerpo alterado, otra llave, sin firma, versión o algoritmo distintos → false', () => {
    const otro = body.replace('"Status":3', '"Status":5');
    expect(p.webhook.verify(Buffer.from(otro), hooks(sign(body)))).toBe(false);
    expect(p.webhook.verify(Buffer.from(body), hooks(sign(body, 'api-key-escritura')))).toBe(false);
    expect(p.webhook.verify(Buffer.from(body), {})).toBe(false);
    expect(p.webhook.verify(Buffer.from(body), hooks(sign(body), { 'x-bunnystream-signature-version': 'v2' }))).toBe(false);
    expect(p.webhook.verify(Buffer.from(body), hooks(sign(body), { 'x-bunnystream-signature-algorithm': 'hmac-sha1' }))).toBe(false);
    expect(p.webhook.verify(Buffer.from(body), hooks('zz'))).toBe(false);
  });
  it('re-serializar el JSON rompe la firma (se verifica el Buffer exacto)', () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    expect(p.webhook.verify(Buffer.from(pretty), hooks(sign(body)))).toBe(false);
  });
  it('parse: otra librería o guid raro → null; el estado es solo una pista', () => {
    expect(p.webhook.parse(Buffer.from(body))).toEqual({ providerAssetId: GUID, hintedStatus: 'ready' });
    expect(p.webhook.parse(Buffer.from(JSON.stringify({ VideoLibraryId: 999, VideoGuid: GUID, Status: 3 })))).toBeNull();
    expect(p.webhook.parse(Buffer.from(JSON.stringify({ VideoLibraryId: 123456, VideoGuid: 'nope', Status: 3 })))).toBeNull();
    expect(p.webhook.parse(Buffer.from('no-json'))).toBeNull();
  });
});

describe('configuración', () => {
  it('sin todas las variables → null (el módulo responde «no configurado»)', () => {
    expect(bunnyConfigFromEnv({} as any)).toBeNull();
    expect(bunnyConfigFromEnv({ BUNNY_STREAM_LIBRARY_ID: '1', BUNNY_STREAM_API_KEY: 'a', BUNNY_STREAM_READONLY_API_KEY: 'b' } as any)).toBeNull();
    expect(bunnyConfigFromEnv({ BUNNY_STREAM_LIBRARY_ID: 'abc', BUNNY_STREAM_API_KEY: 'a', BUNNY_STREAM_READONLY_API_KEY: 'b', BUNNY_STREAM_TOKEN_KEY: 'c' } as any)).toBeNull();
    expect(bunnyConfigFromEnv({ BUNNY_STREAM_LIBRARY_ID: '42', BUNNY_STREAM_API_KEY: 'a', BUNNY_STREAM_READONLY_API_KEY: 'b', BUNNY_STREAM_TOKEN_KEY: 'c' } as any))
      .toMatchObject({ libraryId: '42', apiKey: 'a', readOnlyApiKey: 'b', tokenKey: 'c' });
  });
});
