/**
 * Videos subidos (M6h): subida reanudable (progreso, cancelar, se cae la red y
 * sigue), pestaña «Subir video», flag apagado («Disponible pronto»), clips y
 * puente player.js. El BFF va mockeado (bffClient) y el proveedor es un
 * servidor tus FALSO en memoria: nada sale a la red.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/bffClient', () => {
  class BFFError extends Error {
    constructor(public status: number, message: string, public body?: unknown) { super(message); }
  }
  return { bffClient: { get: api.get, post: api.post, patch: api.patch, delete: api.delete }, BFFError };
});

import { BFFError } from '@/lib/api/bffClient';
import {
  ResumableUpload, UploadCancelledError, UploadFailedError, b64utf8, encodeMetadata, normalizeChunk, type UploadStatus,
} from '@/lib/school/resumableUpload';
import { formatClock, parseClock, validateVideoFile, videoMimeOf, playbackTtlFor, quotaLabel } from '@/lib/school/schoolVideos';
import { createPlayerBridge } from '@/lib/school/playerJsBridge';
import { SchoolVideosPanel } from '@/components/school/schoolVideos/SchoolVideosDialog';
import { VideoClipsPlayer } from '@/components/school/schoolVideos/VideoClipsPlayer';

const KIB = 1024;
const ENDPOINT = 'https://video.bunnycdn.com/tusupload';

/** Servidor tus en memoria. `failPatch(n)` hace fallar la red en el n-ésimo PATCH. */
function tusServer(opts: { failPatchAt?: number[]; hangPatchAt?: number; patchStatus?: number; onFail?: () => void } = {}) {
  let offset = 0;
  let patches = 0;
  const calls: { method: string; url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = String(init.method);
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method, url, headers });
    if (method === 'POST') return new Response(null, { status: 201, headers: { Location: '/tusupload/abc123' } });
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Upload-Offset': String(offset) } });
    if (method === 'PATCH') {
      patches += 1;
      if (opts.hangPatchAt === patches) {
        return new Promise<Response>((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')));
        });
      }
      if (opts.failPatchAt?.includes(patches)) { opts.onFail?.(); throw new TypeError('Failed to fetch'); }
      if (opts.patchStatus) return new Response(null, { status: opts.patchStatus });
      if (Number(headers['Upload-Offset']) !== offset) return new Response(null, { status: 409 });
      offset += (init.body as Blob).size;
      return new Response(null, { status: 204, headers: { 'Upload-Offset': String(offset) } });
    }
    return new Response(null, { status: 405 });
  });
  return { fetchImpl, calls, get offset() { return offset; } };
}

const bytes = (n: number, type = 'video/mp4', name = 'partido.mp4') => new File([new Uint8Array(n)], name, { type });
const noSleep = () => Promise.resolve();

describe('ResumableUpload (tus)', () => {
  it('crea, sube por trozos múltiplos de 256 KiB y reporta progreso hasta 100 %', async () => {
    const srv = tusServer();
    const file = bytes(700 * KIB);
    const seen: number[] = [];
    const up = new ResumableUpload({
      file, endpoint: ENDPOINT, chunkSize: 300 * KIB, fetchImpl: srv.fetchImpl as any,
      headers: { AuthorizationSignature: 'firma', VideoId: 'v1', LibraryId: '1', AuthorizationExpire: '9' },
      metadata: { filetype: 'video/mp4', title: 'Final sub 13 — niños' }, onProgress: (p) => seen.push(p.percent),
    });
    await up.start();
    expect(up.currentStatus).toBe('done');
    expect(srv.offset).toBe(file.size);
    const post = srv.calls[0];
    expect(post.method).toBe('POST');
    expect(post.headers['Upload-Length']).toBe(String(file.size));
    expect(post.headers['Tus-Resumable']).toBe('1.0.0');
    expect(post.headers.AuthorizationSignature).toBe('firma');
    // Tildes y raya: base64 de UTF-8.
    expect(post.headers['Upload-Metadata']).toContain(`title ${b64utf8('Final sub 13 — niños')}`);
    const patchUrls = srv.calls.filter((c) => c.method === 'PATCH');
    expect(patchUrls).toHaveLength(3); // 256 + 256 + 188 KiB
    expect(patchUrls[0].url).toBe('https://video.bunnycdn.com/tusupload/abc123');
    expect(patchUrls.every((c) => c.headers.AuthorizationSignature === 'firma')).toBe(true);
    expect(seen.at(-1)).toBe(100);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('se cae la red: queda «offline», espera que vuelva, pregunta con HEAD y sigue SIN reenviar lo ya subido', async () => {
    let online = true;
    const srv = tusServer({ failPatchAt: [2], onFail: () => { online = false; } });
    let wake: (() => void) | null = null;
    const statuses: UploadStatus[] = [];
    const file = bytes(768 * KIB);
    const up = new ResumableUpload({
      file, endpoint: ENDPOINT, chunkSize: 256 * KIB, fetchImpl: srv.fetchImpl as any, sleep: noSleep,
      isOnline: () => online, onOnline: (cb) => { wake = cb; return () => { wake = null; }; },
      onStatus: (s) => { statuses.push(s); if (s === 'offline') setTimeout(() => { online = true; wake?.(); }, 5); },
    });
    // Al fallar el 2.º PATCH el navegador dice «sin red»; a los 5 ms vuelve.
    await up.start();
    expect(statuses).toContain('offline');
    expect(statuses.at(-1)).toBe('done');
    expect(srv.calls.some((c) => c.method === 'HEAD')).toBe(true);
    expect(srv.offset).toBe(file.size);
    // 3 trozos buenos + 1 fallido = 4 PATCH; ninguno con un offset repetido después del HEAD.
    const offs = srv.calls.filter((c) => c.method === 'PATCH').map((c) => c.headers['Upload-Offset']);
    expect(offs).toEqual(['0', String(256 * KIB), String(256 * KIB), String(512 * KIB)]);
  });

  it('error del servidor 5xx: reintenta con espera y termina', async () => {
    const srv = tusServer({ failPatchAt: [1, 2] });
    const sleeps: number[] = [];
    const up = new ResumableUpload({
      file: bytes(300 * KIB), endpoint: ENDPOINT, chunkSize: 256 * KIB, fetchImpl: srv.fetchImpl as any,
      isOnline: () => true, sleep: async (ms) => { sleeps.push(ms); }, retryDelays: [10, 20, 30],
    });
    await up.start();
    expect(sleeps).toEqual([10, 20]);
    expect(up.currentStatus).toBe('done');
  });

  it('cancelar a mitad: aborta lo que está en vuelo, rechaza con UploadCancelledError y no manda más', async () => {
    const srv = tusServer({ hangPatchAt: 2 });
    const up = new ResumableUpload({ file: bytes(800 * KIB), endpoint: ENDPOINT, chunkSize: 256 * KIB, fetchImpl: srv.fetchImpl as any });
    const p = up.start();
    await waitFor(() => expect(srv.calls.filter((c) => c.method === 'PATCH')).toHaveLength(2));
    up.cancel();
    await expect(p).rejects.toBeInstanceOf(UploadCancelledError);
    expect(up.currentStatus).toBe('cancelled');
    const n = srv.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(srv.calls.length).toBe(n);
  });

  it('401/403 (autorización vencida) no se reintenta: UploadFailedError', async () => {
    const srv = tusServer({ patchStatus: 403 });
    const up = new ResumableUpload({ file: bytes(10 * KIB), endpoint: ENDPOINT, fetchImpl: srv.fetchImpl as any });
    await expect(up.start()).rejects.toBeInstanceOf(UploadFailedError);
    expect(up.currentStatus).toBe('error');
  });

  it('metadatos y trozos', () => {
    expect(encodeMetadata({ filetype: 'video/mp4', 'mal clave': 'x' })).toBe(`filetype ${btoa('video/mp4')}`);
    expect(normalizeChunk(300 * KIB)).toBe(256 * KIB);
    expect(normalizeChunk(1)).toBe(256 * KIB);
    expect(normalizeChunk(undefined)).toBe(8 * 1024 * KIB);
  });
});

describe('reglas del archivo y relojes', () => {
  it('tipos: mp4, mov, webm; Android sin tipo → por extensión; resto no', () => {
    expect(videoMimeOf({ type: 'video/quicktime', name: 'IMG_0001.MOV' })).toBe('video/quicktime');
    expect(videoMimeOf({ type: '', name: 'VID_2026.mp4' })).toBe('video/mp4');
    expect(videoMimeOf({ type: 'video/x-matroska', name: 'a.mkv' })).toBeNull();
    expect(videoMimeOf({ type: 'image/jpeg', name: 'foto.jpg' })).toBeNull();
    expect(validateVideoFile({ type: 'video/mp4', name: 'a.mp4', size: 5 * 1024 ** 3 }, 4 * 1024 ** 3)).toMatchObject({ ok: false });
    expect(validateVideoFile({ type: 'video/mp4', name: 'a.mp4', size: 0 }, 4 * 1024 ** 3)).toMatchObject({ ok: false });
    expect(validateVideoFile({ type: 'video/webm', name: 'a.webm', size: 10 }, 4 * 1024 ** 3)).toEqual({ ok: true, mime: 'video/webm' });
  });
  it('mm:ss ida y vuelta', () => {
    expect(formatClock(83)).toBe('1:23');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(parseClock('1:23')).toBe(83);
    expect(parseClock('1:02:03')).toBe(3723);
    expect(parseClock('95')).toBe(95);
    expect(parseClock('1:23,5')).toBe(83.5);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('hola')).toBeNull();
  });
  it('TTL pedido = duración + 30 min (mínimo 15 min) y etiqueta del cupo', () => {
    expect(playbackTtlFor(null)).toBe(1800);
    expect(playbackTtlFor(5400)).toBe(7200);
    expect(quotaLabel({ used_seconds: 5400, quota_seconds: 36000, used_bytes: 2 * 1024 ** 3, quota_bytes: 25 * 1024 ** 3 })).toBe('1,5 de 10 h · 2,0 GB de 25,0 GB');
  });
});

const SETTINGS_ON = {
  enabled: true, school_flag: true, provider_configured: true, quota_seconds: 36000, quota_bytes: 25 * 1024 ** 3,
  used_seconds: 0, used_bytes: 0, max_upload_bytes: 4 * 1024 ** 3, max_duration_s: 10800,
};

describe('flag por escuela', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); });

  it('apagado → «Disponible pronto» en Subir y en Videos; la guía de importación sigue visible', async () => {
    api.get.mockResolvedValue({ ...SETTINGS_ON, enabled: false, school_flag: false });
    render(<SchoolVideosPanel teamId="t1" canEdit />);
    expect(await screen.findByTestId('videos-coming-soon')).toBeTruthy();
    expect(screen.getByText('Disponible pronto')).toBeTruthy();
    expect(screen.queryByTestId('video-input-camera')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalledTimes(1); // solo settings: no lista nada
  });

  it('BFF caído o sin ruta → se trata como apagado, sin romper', async () => {
    api.get.mockRejectedValue(new BFFError(404, 'Not found'));
    render(<SchoolVideosPanel teamId="t1" canEdit />);
    expect(await screen.findByTestId('videos-coming-soon')).toBeTruthy();
  });

  it('sin rol de edición: no hay pestaña «Subir video»', async () => {
    api.get.mockImplementation(async (path: string) => (path.endsWith('/settings') ? SETTINGS_ON : { videos: [] }));
    render(<SchoolVideosPanel teamId="t1" canEdit={false} />);
    await screen.findByRole('tab', { name: 'Videos de la escuela' });
    expect(screen.queryByRole('tab', { name: 'Subir video' })).toBeNull();
  });
});

describe('pestaña «Subir video» (con el proveedor falso)', () => {
  const realFetch = globalThis.fetch;
  let srv: ReturnType<typeof tusServer>;

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.get.mockImplementation(async (path: string) => (path.endsWith('/settings') ? SETTINGS_ON : { videos: [] }));
    api.post.mockImplementation(async (path: string) => {
      if (path.endsWith('/videos/uploads')) {
        return { video_id: 'vid-1', upload: { protocol: 'tus', endpoint: ENDPOINT, headers: { AuthorizationSignature: 's', VideoId: 'g', LibraryId: '1', AuthorizationExpire: '9' }, metadata: { filetype: 'video/mp4', title: 'x' }, expiresAt: '2026-10-15T20:00:00Z', chunkSize: 256 * KIB } };
      }
      return { status: 'processing' };
    });
    api.delete.mockResolvedValue({ ok: true });
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  async function chooseFile(file: File) {
    render(<SchoolVideosPanel teamId="t1" lineupId="l1" canEdit />);
    const input = await screen.findByTestId('video-input-file');
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
  }

  it('elige del celular → título sugerido → sube con progreso hasta 100 % → «Video subido»', async () => {
    srv = tusServer();
    globalThis.fetch = srv.fetchImpl as any;
    await chooseFile(bytes(600 * KIB, 'video/mp4', 'final_sub_13.mp4'));
    expect((screen.getByLabelText('Título del video') as HTMLInputElement).value).toBe('final sub 13');
    expect(screen.getByTestId('video-input-camera').getAttribute('capture')).toBe('environment');
    expect(screen.getByTestId('video-input-camera').getAttribute('accept')).toBe('video/*');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Subir video$/ })); });
    expect(await screen.findByText('Video subido')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/school/videos/uploads', expect.objectContaining({
      title: 'final sub 13', mime_type: 'video/mp4', size_bytes: 600 * KIB, team_id: 't1', source: 'phone',
    }));
    expect(srv.offset).toBe(600 * KIB);
    expect(api.post).toHaveBeenCalledWith('/api/v1/school/videos/vid-1/sync', {});
  });

  it('archivo no permitido → mensaje y no se pide nada al BFF', async () => {
    await chooseFile(bytes(10, 'image/png', 'foto.png'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no es un video compatible/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('cancelar a mitad → aborta y borra el video en el BFF (devuelve el cupo)', async () => {
    srv = tusServer({ hangPatchAt: 2 });
    globalThis.fetch = srv.fetchImpl as any;
    await chooseFile(bytes(900 * KIB));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Subir video$/ })); });
    await waitFor(() => expect(screen.getByTestId('upload-progress')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('upload-percent').textContent).toBe('28%'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Cancelar subida/ })); });
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/school/videos/vid-1'));
    expect(screen.queryByText('Video subido')).toBeNull();
    expect(screen.getByRole('button', { name: /Subir video$/ })).toBeTruthy();
  });

  it('cupo agotado → mensaje claro', async () => {
    api.post.mockRejectedValueOnce(new BFFError(409, 'x', { code: 'QUOTA_EXCEEDED', error: 'x' }));
    await chooseFile(bytes(100 * KIB));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Subir video$/ })); });
    expect((await screen.findByRole('alert')).textContent).toMatch(/cupo de videos/);
  });
});

describe('clips', () => {
  const video = { id: 'vid-9', school_id: 's', team_id: 't1', provider: 'bunny', status: 'ready' as const, duration_s: 120, size_bytes: 1, title: 'Partido', recorded_at: null, source: 'veo' as const, created_by: 'u', created_at: '' };
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/playback')) return { kind: 'video', url: 'blob:fake', expiresAt: '', ttl_s: 900, duration_s: 120 };
      if (path.endsWith('/clips')) return { clips: [{ id: 'c0', video_id: 'vid-9', start_s: 5, end_s: 9, title: 'Viejo', lineup_id: null, preset_id: null, exercise_id: null, created_by: 'u', created_at: '' }] };
      return {};
    });
    api.post.mockImplementation(async (_p: string, body: any) => ({ clip: { id: 'c1', video_id: 'vid-9', created_by: 'u', created_at: '', preset_id: null, exercise_id: null, ...body } }));
    api.patch.mockImplementation(async (_p: string, body: any) => ({ clip: { id: 'c0', video_id: 'vid-9', start_s: 5, end_s: 9, title: 'Viejo', preset_id: null, exercise_id: null, created_by: 'u', created_at: '', ...body } }));
  });

  it('pide la URL firmada con TTL = duración + 30 min; crea un clip vinculado a la jugada', async () => {
    render(<VideoClipsPlayer video={video} lineupId="lin-1" canEdit onBack={() => undefined} />);
    await screen.findByTestId('clip-form');
    expect(api.get).toHaveBeenCalledWith('/api/v1/school/videos/vid-9/playback?ttl=1920');
    fireEvent.change(screen.getByLabelText('Inicio del clip'), { target: { value: '0:12' } });
    fireEvent.change(screen.getByLabelText('Fin del clip'), { target: { value: '0:20' } });
    fireEvent.change(screen.getByLabelText('Nombre del clip'), { target: { value: 'Presión alta' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar clip/ })); });
    expect(api.post).toHaveBeenCalledWith('/api/v1/school/videos/vid-9/clips', { title: 'Presión alta', start_s: 12, end_s: 20, lineup_id: 'lin-1' });
    expect(await screen.findByText('Presión alta')).toBeTruthy();
    expect(screen.getAllByText('En esta jugada')).toHaveLength(1);
  });

  it('«Vincular a esta jugada» en un clip existente; fin antes del inicio → error sin llamar', async () => {
    render(<VideoClipsPlayer video={video} lineupId="lin-1" canEdit onBack={() => undefined} />);
    await screen.findByText('Viejo');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Vincular a esta jugada/ })); });
    expect(api.patch).toHaveBeenCalledWith('/api/v1/school/video-clips/c0', { lineup_id: 'lin-1' });
    fireEvent.change(screen.getByLabelText('Inicio del clip'), { target: { value: '1:00' } });
    fireEvent.change(screen.getByLabelText('Fin del clip'), { target: { value: '0:30' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar clip/ })); });
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/después del inicio/);
  });

  it('sin jugada guardada: el vínculo está deshabilitado y lo explica', async () => {
    render(<VideoClipsPlayer video={video} lineupId={null} canEdit onBack={() => undefined} />);
    await screen.findByTestId('clip-form');
    expect(screen.getByText(/guarda la jugada primero/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Vincular a esta jugada/ })).toBeNull();
  });
});

describe('puente player.js', () => {
  it('pide el segundo actual por postMessage y lee la respuesta del iframe', async () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://iframe.mediadelivery.net/embed/1/abc';
    document.body.appendChild(iframe);
    const sent: any[] = [];
    vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation((m: any) => { sent.push(JSON.parse(m)); });
    const b = createPlayerBridge(iframe);
    const from = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin: 'https://iframe.mediadelivery.net', source: iframe.contentWindow }));
    const p = b.getCurrentTime(500);
    // Se manda de una (el «ready» pudo llegar antes de crear el puente) y se reenvía al llegar «ready».
    expect(sent[0]).toMatchObject({ context: 'player.js', method: 'getCurrentTime' });
    from({ context: 'player.js', event: 'ready', value: {} });
    expect(sent[1]).toMatchObject({ method: 'getCurrentTime', listener: sent[0].listener });
    from({ context: 'player.js', event: 'getCurrentTime', listener: sent[0].listener, value: 42.5 });
    expect(await p).toBe(42.5);
    // Mensaje de otro origen: se ignora.
    const q = b.getCurrentTime(50);
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ context: 'player.js', listener: sent.at(-1).listener, value: 1 }), origin: 'https://malo.example', source: iframe.contentWindow }));
    expect(await q).toBeNull();
    b.dispose();
  });
});
