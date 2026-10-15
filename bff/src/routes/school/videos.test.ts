/**
 * /api/v1/school/videos (M6h): permisos por rol, flag apagado, tipos/tamaños,
 * cupo con concurrencia, URL firmada con TTL, clips y webhook con firma.
 *
 * La base va MOCKEADA en memoria (services/video/db): las RPCs reproducen la
 * lógica de la migración 20261015145434, incluido el FOR UPDATE (un candado
 * por escuela) para probar que 20 subidas en paralelo no pasan el cupo. El
 * proveedor es el adaptador REAL de Bunny con el HTTP mockeado, o uno falso.
 * Nada sale a la red ni a la base.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { createHmac } from 'node:crypto';

type Fila = Record<string, any>;
const SCHOOL = '00000000-0000-4000-8000-00000000a001';
const OTHER = '00000000-0000-4000-8000-00000000b001';
const TEAM = '00000000-0000-4000-8000-00000000c001';

// Sin tope por minuto en las pruebas (el limitador es global al módulo).
vi.hoisted(() => { process.env.VIDEO_UPLOADS_PER_MINUTE = '100000'; });

const st = vi.hoisted(() => ({
  settings: [] as Record<string, any>[],
  videos: [] as Record<string, any>[],
  clips: [] as Record<string, any>[],
  rpcs: [] as { name: string; args: any; as: string }[],
  seq: 0,
  locks: new Map<string, Promise<void>>(),
}));

/** Candado por escuela: lo que hace SELECT … FOR UPDATE sobre school_video_settings. */
async function withSchoolLock<T>(school: string, fn: () => Promise<T>): Promise<T> {
  const prev = st.locks.get(school) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => { release = r; });
  st.locks.set(school, prev.then(() => mine));
  await prev;
  try { return await fn(); } finally { release(); }
}
const tick = () => new Promise((r) => setTimeout(r, 1));

function pgErr(message: string, code: string) { return { data: null, error: { message, code } }; }

vi.mock('../../services/video/db', () => {
  const tables = () => ({ school_video_settings: st.settings, school_videos: st.videos, school_video_clips: st.clips } as Record<string, Fila[]>);

  function builder(table: string, actor: { id: string; role: string }) {
    let rows: Fila[] = [...(tables()[table] ?? [])];
    let op: 'select' | 'update' | 'delete' | 'insert' = 'select';
    let payload: any = null;
    const filters: ((f: Fila) => boolean)[] = [];
    const run = () => {
      const all = tables()[table];
      let target = all.filter((f) => filters.every((fn) => fn(f)));
      if (op === 'update') {
        // RLS simulada de school_videos/clips: escribe solo táctico de la escuela.
        if (!['coach', 'owner', 'super_admin'].includes(actor.role)) target = [];
        target.forEach((f) => Object.assign(f, payload));
      } else if (op === 'delete') {
        target = target.filter((f) => f.created_by === actor.id || ['owner', 'admin', 'school_admin', 'super_admin'].includes(actor.role));
        for (const f of target) all.splice(all.indexOf(f), 1);
      } else if (op === 'insert') {
        const row = { id: `00000000-0000-4000-8000-${String(++st.seq).padStart(12, '0')}`, ...payload };
        all.push(row);
        target = [row];
      }
      rows = target;
      return rows;
    };
    const api: any = {
      select: () => api,
      eq: (c: string, v: any) => { filters.push((f) => f[c] === v); return api; },
      neq: (c: string, v: any) => { filters.push((f) => f[c] !== v); return api; },
      order: () => api, limit: () => api,
      insert: (p: any) => { op = 'insert'; payload = p; return api; },
      update: (p: any) => { op = 'update'; payload = p; return api; },
      delete: () => { op = 'delete'; return api; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => { const r = run(); return r[0] ? { data: r[0], error: null } : pgErr('no rows', 'PGRST116'); },
      then: (ok: any, ko: any) => Promise.resolve({ data: run(), error: null }).then(ok, ko),
    };
    return api;
  }

  async function rpc(name: string, args: any, actor: { id: string; role: string; school: string }) {
    st.rpcs.push({ name, args, as: actor.role });
    const settingsOf = (s: string) => st.settings.find((x) => x.school_id === s);
    if (name === 'begin_school_video_upload') {
      if (!['coach', 'owner', 'super_admin'].includes(actor.role) || args.p_school_id !== actor.school) return pgErr('No tienes permiso para subir videos en esta escuela.', '42501');
      return withSchoolLock(args.p_school_id, async () => {
        const s = settingsOf(args.p_school_id);
        if (!s || !s.enabled) return pgErr('VIDEOS_DISABLED: apagado', '42501');
        await tick(); // ventana de carrera si no hubiera candado
        if (s.used_seconds + args.p_max_duration_s > s.quota_seconds || s.used_bytes + args.p_size_bytes > s.quota_bytes) {
          return pgErr('QUOTA_EXCEEDED: sin cupo', '54000');
        }
        const id = `00000000-0000-4000-8000-${String(++st.seq).padStart(12, '0')}`;
        st.videos.push({ id, school_id: args.p_school_id, team_id: args.p_team_id, provider: args.p_provider, provider_asset_id: null,
          status: 'uploading', title: args.p_title, counted_seconds: args.p_max_duration_s, counted_bytes: args.p_size_bytes,
          duration_s: null, size_bytes: null, created_by: actor.id, source: args.p_source });
        s.used_seconds += args.p_max_duration_s; s.used_bytes += args.p_size_bytes;
        return { data: { video_id: id, quota_seconds: s.quota_seconds, quota_bytes: s.quota_bytes, used_seconds: s.used_seconds, used_bytes: s.used_bytes }, error: null };
      });
    }
    if (name === 'attach_school_video_asset') {
      const v = st.videos.find((x) => x.id === args.p_video_id && x.created_by === actor.id && x.status === 'uploading' && !x.provider_asset_id);
      if (!v) return pgErr('Video no encontrado.', 'P0002');
      v.provider_asset_id = args.p_provider_asset_id;
      return { data: true, error: null };
    }
    if (name === 'soft_delete_school_video') {
      const v = st.videos.find((x) => x.id === args.p_video_id && x.status !== 'deleted');
      if (!v) return pgErr('Video no encontrado.', 'P0002');
      const isAdmin = ['owner', 'admin', 'school_admin', 'super_admin'].includes(actor.role) && v.school_id === actor.school;
      const isAuthor = v.created_by === actor.id && actor.role === 'coach' && v.school_id === actor.school;
      if (!isAdmin && !isAuthor) return pgErr('Solo quien subió el video o un administrador de la escuela puede borrarlo.', '42501');
      return withSchoolLock(v.school_id, async () => {
        const s = settingsOf(v.school_id)!;
        s.used_seconds -= v.counted_seconds; s.used_bytes -= v.counted_bytes;
        Object.assign(v, { status: 'deleted', counted_seconds: 0, counted_bytes: 0 });
        return { data: { video_id: v.id, provider: v.provider, provider_asset_id: v.provider_asset_id }, error: null };
      });
    }
    if (name === 'settle_school_video') {
      if (actor.role !== 'service_role') return pgErr('permission denied for function settle_school_video', '42501');
      const v = st.videos.find((x) => x.provider === args.p_provider && x.provider_asset_id === args.p_provider_asset_id);
      if (!v) return { data: { ok: false, reason: 'unknown_asset' }, error: null };
      return withSchoolLock(v.school_id, async () => {
        const s = settingsOf(v.school_id)!;
        const secs = args.p_status === 'failed' ? 0 : args.p_status === 'ready' ? (args.p_duration_s ?? v.counted_seconds) : v.counted_seconds;
        const byts = args.p_status === 'failed' ? 0 : args.p_status === 'ready' ? (args.p_size_bytes ?? v.counted_bytes) : v.counted_bytes;
        s.used_seconds += secs - v.counted_seconds; s.used_bytes += byts - v.counted_bytes;
        Object.assign(v, { status: args.p_status, counted_seconds: secs, counted_bytes: byts,
          duration_s: args.p_status === 'ready' ? args.p_duration_s : v.duration_s, size_bytes: args.p_status === 'ready' ? args.p_size_bytes : v.size_bytes });
        return { data: { ok: true, video_id: v.id, status: args.p_status }, error: null };
      });
    }
    return pgErr(`Could not find the function ${name}`, 'PGRST202');
  }

  const actorOf = (req: any) => ({ id: req.user?.id, role: req.role, school: req.schoolId });
  return {
    bearerToken: () => 'tok',
    userDb: (req: any) => ({ from: (t: string) => builder(t, actorOf(req)), rpc: (n: string, a: any) => rpc(n, a, actorOf(req)) }),
    serviceDb: () => ({ from: (t: string) => builder(t, { id: '', role: 'service_role' }), rpc: (n: string, a: any) => rpc(n, a, { id: '', role: 'service_role', school: '' }) }),
  };
});

vi.mock('../../middlewares/authMiddleware', async () => {
  const actual = await vi.importActual<any>('../../middlewares/authMiddleware');
  return {
    ...actual,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = { id: String(req.headers['x-user'] || 'coach-1') };
      req.schoolId = String(req.headers['x-school'] || SCHOOL);
      req.role = String(req.headers['x-role'] || 'coach');
      next();
    },
  };
});

const { default: router, videoWebhookRouter } = await import('./videos');
const { __setVideoProviderForTests } = await import('../../services/video');
const { createBunnyProvider, bunnyEmbedToken } = await import('../../services/video/bunny');

const LIB = '777';
const GUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CFG = { libraryId: LIB, apiKey: 'k-escritura', readOnlyApiKey: 'k-lectura', tokenKey: 'k-token' };
const bunnyHttp = vi.hoisted(() => ({ calls: [] as { url: string; method: string }[], asset: { status: 4, length: 95, storageSize: 123456 } as any, createStatus: 200, guidSeq: 0 }));
const fakeFetch = async (url: string, init: RequestInit = {}) => {
  bunnyHttp.calls.push({ url, method: String(init.method) });
  if (init.method === 'POST') {
    if (bunnyHttp.createStatus !== 200) return new Response('{}', { status: bunnyHttp.createStatus });
    const n = ++bunnyHttp.guidSeq;
    return new Response(JSON.stringify({ guid: `a1b2c3d4-e5f6-4a7b-8c9d-${String(n).padStart(12, '0')}` }), { status: 200 });
  }
  if (init.method === 'GET') return new Response(JSON.stringify({ guid: GUID, ...bunnyHttp.asset }), { status: 200 });
  return new Response('{}', { status: 200 });
};
const NOW = new Date('2026-10-15T15:00:00Z');
const bunny = createBunnyProvider({ ...CFG, fetch: fakeFetch as any, now: () => NOW });

let base = '';
let server: http.Server;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
  app.use('/api/v1/school', router);
  app.use('/api/v1/webhooks/video', videoWebhookRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { __setVideoProviderForTests(undefined); await new Promise((r) => server.close(r)); });

const GB = 1024 ** 3;
function resetDb(settings: Partial<Record<string, any>> | null = {}) {
  st.settings.length = 0; st.videos.length = 0; st.clips.length = 0; st.rpcs.length = 0; st.locks.clear();
  bunnyHttp.calls.length = 0; bunnyHttp.createStatus = 200; bunnyHttp.asset = { status: 4, length: 95, storageSize: 123456 };
  if (settings) {
    st.settings.push({ school_id: SCHOOL, enabled: true, quota_seconds: 36000, quota_bytes: 25 * GB, used_seconds: 0, used_bytes: 0,
      max_upload_bytes: 4 * GB, max_duration_s: 10800, ...settings });
  }
}
beforeEach(() => { resetDb(); __setVideoProviderForTests(bunny); });

async function call(method: string, path: string, opts: { role?: string; user?: string; school?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-role': opts.role ?? 'coach', 'x-user': opts.user ?? 'coach-1', 'x-school': opts.school ?? SCHOOL, ...(opts.headers ?? {}) },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  let json: any = null; try { json = await res.json(); } catch { /* vacío */ }
  return { status: res.status, json, headers: res.headers };
}

const upload = (over: Record<string, unknown> = {}, as: { role?: string; user?: string } = {}) =>
  call('POST', '/api/v1/school/videos/uploads', { ...as, body: { title: 'Partido sábado', mime_type: 'video/mp4', size_bytes: 300 * 1024 ** 2, duration_s: 540, team_id: TEAM, source: 'phone', ...over } });

describe('flag por escuela', () => {
  it('sin fila de settings: settings dice enabled=false y todo lo demás 403 VIDEOS_DISABLED', async () => {
    resetDb(null);
    const s = await call('GET', '/api/v1/school/videos/settings');
    expect(s.status).toBe(200);
    expect(s.json).toMatchObject({ enabled: false, school_flag: false, provider_configured: true });
    const l = await call('GET', '/api/v1/school/videos');
    expect(l.status).toBe(403);
    expect(l.json.code).toBe('VIDEOS_DISABLED');
    const u = await upload();
    expect(u.status).toBe(403);
    expect(bunnyHttp.calls).toHaveLength(0); // nunca se llama al proveedor
  });
  it('flag prendido pero proveedor sin configurar → enabled=false; subir → 503', async () => {
    __setVideoProviderForTests(null);
    const s = await call('GET', '/api/v1/school/videos/settings');
    expect(s.json).toMatchObject({ enabled: false, school_flag: true, provider_configured: false });
    expect((await upload()).status).toBe(503);
  });
});

describe('permisos por rol', () => {
  it('padre y atleta: 403 en TODO (leer, subir, reproducir, clips)', async () => {
    for (const role of ['parent', 'athlete']) {
      expect((await call('GET', '/api/v1/school/videos/settings', { role })).status).toBe(403);
      expect((await call('GET', '/api/v1/school/videos', { role })).status).toBe(403);
      expect((await upload({}, { role })).status).toBe(403);
      expect((await call('GET', `/api/v1/school/videos/${GUID}/playback`, { role })).status).toBe(403);
      expect((await call('POST', `/api/v1/school/videos/${GUID}/clips`, { role, body: {} })).status).toBe(403);
    }
    expect(st.rpcs).toHaveLength(0);
  });
  it('admin/school_admin/staff leen pero NO suben (requireRole de edición táctica)', async () => {
    expect((await call('GET', '/api/v1/school/videos', { role: 'school_admin' })).status).toBe(200);
    expect((await call('GET', '/api/v1/school/videos', { role: 'staff' })).status).toBe(200);
    expect((await upload({}, { role: 'school_admin' })).status).toBe(403);
    expect((await upload({}, { role: 'staff' })).status).toBe(403);
  });
  it('coach sube; el borrado de otro coach rebota, el admin sí borra', async () => {
    const u = await upload();
    expect(u.status).toBe(201);
    const id = u.json.video_id;
    const otro = await call('DELETE', `/api/v1/school/videos/${id}`, { role: 'coach', user: 'coach-2' });
    expect(otro.status).toBe(403);
    const admin = await call('DELETE', `/api/v1/school/videos/${id}`, { role: 'school_admin', user: 'admin-1' });
    expect(admin.status).toBe(200);
    expect(bunnyHttp.calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect(st.settings[0].used_seconds).toBe(0);
  });
  it('un video de otra escuela no se ve ni se reproduce', async () => {
    st.videos.push({ id: '00000000-0000-4000-8000-0000000000ff', school_id: OTHER, provider: 'bunny', provider_asset_id: GUID, status: 'ready', duration_s: 90, title: 'ajeno' });
    const p = await call('GET', '/api/v1/school/videos/00000000-0000-4000-8000-0000000000ff/playback');
    expect(p.status).toBe(404);
  });
});

describe('subida: tipos, tamaños y flujo', () => {
  it('201: reserva, crea en Bunny, guarda el asset y devuelve la autorización tus (sin llaves)', async () => {
    const r = await upload();
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.json.upload).toMatchObject({ protocol: 'tus', endpoint: 'https://video.bunnycdn.com/tusupload' });
    expect(r.json.upload.headers.LibraryId).toBe(LIB);
    expect(JSON.stringify(r.json)).not.toContain(CFG.apiKey);
    expect(st.rpcs.map((x) => x.name)).toEqual(['begin_school_video_upload', 'attach_school_video_asset']);
    expect(st.rpcs[0].args).toMatchObject({ p_school_id: SCHOOL, p_provider: 'bunny', p_max_duration_s: 600, p_size_bytes: 300 * 1024 ** 2 });
    expect(st.videos[0]).toMatchObject({ status: 'uploading', provider_asset_id: expect.stringMatching(/^a1b2c3d4-/) });
  });
  it('tipo no permitido 415, archivo > 4 GB 413, sin título 422 — sin tocar base ni proveedor', async () => {
    expect((await upload({ mime_type: 'video/x-matroska' })).status).toBe(415);
    expect((await upload({ size_bytes: 4 * GB + 1 })).status).toBe(413);
    expect((await upload({ title: '' })).status).toBe(422);
    expect(st.rpcs).toHaveLength(0);
    expect(bunnyHttp.calls).toHaveLength(0);
  });
  it('el máximo de la ESCUELA (menor que el de plataforma) lo aplica la RPC → 413', async () => {
    resetDb({ max_upload_bytes: 100 });
    st.settings[0].max_upload_bytes = 100;
    // La RPC simulada no mira max_upload_bytes: probamos el mapeo del error de la RPC real.
    const { mapDbError } = await import('./videos');
    expect(mapDbError({ message: 'FILE_TOO_LARGE: el archivo supera el máximo permitido.', code: '22023' }).status).toBe(413);
    expect(mapDbError({ message: 'QUOTA_EXCEEDED: no queda cupo', code: '54000' })).toMatchObject({ status: 409, body: { code: 'QUOTA_EXCEEDED' } });
    expect(mapDbError({ message: 'VIDEOS_DISABLED: x', code: '42501' }).status).toBe(403);
  });
  it('si Bunny falla al crear: 502 y la reserva se devuelve (cupo intacto)', async () => {
    bunnyHttp.createStatus = 500;
    const r = await upload();
    expect(r.status).toBe(502);
    expect(st.rpcs.map((x) => x.name)).toEqual(['begin_school_video_upload', 'soft_delete_school_video']);
    expect(st.settings[0]).toMatchObject({ used_seconds: 0, used_bytes: 0 });
  });
});

describe('cupo con concurrencia (FOR UPDATE)', () => {
  it('20 subidas en paralelo con cupo para 15 → exactamente 15 entran y el cupo no se pasa', async () => {
    // 15 × 600 s = 9000 s de cupo.
    resetDb({ quota_seconds: 9000 });
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => upload({ title: `Video ${i}` }, { user: `coach-${i}` })));
    const codes = rs.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(15);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
    expect(rs.find((r) => r.status === 409)!.json.code).toBe('QUOTA_EXCEEDED');
    expect(st.settings[0].used_seconds).toBe(9000);
    expect(st.videos.filter((v) => v.status === 'uploading')).toHaveLength(15);
  });
  it('borrar devuelve cupo y deja subir otra vez', async () => {
    resetDb({ quota_seconds: 600 });
    const a = await upload();
    expect(a.status).toBe(201);
    expect((await upload({}, { user: 'coach-9' })).status).toBe(409);
    expect((await call('DELETE', `/api/v1/school/videos/${a.json.video_id}`)).status).toBe(200);
    expect((await upload({}, { user: 'coach-9' })).status).toBe(201);
  });
});

describe('reproducción firmada', () => {
  async function readyVideo() {
    const u = await upload();
    const v = st.videos.find((x) => x.id === u.json.video_id)!;
    Object.assign(v, { status: 'ready', duration_s: 95 });
    return v;
  }
  it('procesando → 409; listo → URL del embed con token y TTL acotado', async () => {
    const u = await upload();
    expect((await call('GET', `/api/v1/school/videos/${u.json.video_id}/playback`)).status).toBe(409);
    const v = st.videos[0];
    Object.assign(v, { status: 'ready', duration_s: 95 });
    const p = await call('GET', `/api/v1/school/videos/${v.id}/playback?ttl=300`, { role: 'school_admin' });
    expect(p.status).toBe(200);
    expect(p.headers.get('cache-control')).toBe('no-store');
    const url = new URL(p.json.url);
    const expires = Number(url.searchParams.get('expires'));
    expect(expires).toBe(Math.floor(NOW.getTime() / 1000) + 300);
    expect(url.searchParams.get('token')).toBe(bunnyEmbedToken(CFG.tokenKey, v.provider_asset_id, expires));
    expect(p.json).toMatchObject({ kind: 'iframe', ttl_s: 300, duration_s: 95 });
  });
  it('ttl fuera de rango se acota (5 s → 60 s; 1 día → 6 h)', async () => {
    const v = await readyVideo();
    const a = await call('GET', `/api/v1/school/videos/${v.id}/playback?ttl=5`);
    const b = await call('GET', `/api/v1/school/videos/${v.id}/playback?ttl=86400`);
    expect(a.json.ttl_s).toBe(60);
    expect(b.json.ttl_s).toBe(21600);
  });
});

describe('clips', () => {
  it('crear (vinculado a una jugada), listar, editar y borrar', async () => {
    const u = await upload();
    Object.assign(st.videos[0], { status: 'ready', duration_s: 95 });
    const lineup = '00000000-0000-4000-8000-0000000001aa';
    const c = await call('POST', `/api/v1/school/videos/${u.json.video_id}/clips`, { body: { title: 'Presión alta', start_s: 10, end_s: 18.5, lineup_id: lineup } });
    expect(c.status).toBe(201);
    expect(c.json.clip).toMatchObject({ video_id: u.json.video_id, start_s: 10, end_s: 18.5, lineup_id: lineup, created_by: 'coach-1' });
    const l = await call('GET', `/api/v1/school/videos/${u.json.video_id}/clips`, { role: 'staff' });
    expect(l.json.clips).toHaveLength(1);
    const e = await call('PATCH', `/api/v1/school/video-clips/${c.json.clip.id}`, { body: { end_s: 20 } });
    expect(e.status).toBe(200);
    expect(e.json.clip.end_s).toBe(20);
    const ajeno = await call('DELETE', `/api/v1/school/video-clips/${c.json.clip.id}`, { user: 'coach-2' });
    expect(ajeno.status).toBe(404);
    expect((await call('DELETE', `/api/v1/school/video-clips/${c.json.clip.id}`)).status).toBe(200);
  });
  it('clip que termina después del video → 422', async () => {
    const u = await upload();
    Object.assign(st.videos[0], { status: 'ready', duration_s: 95 });
    const c = await call('POST', `/api/v1/school/videos/${u.json.video_id}/clips`, { body: { title: 'x', start_s: 90, end_s: 200 } });
    expect(c.status).toBe(422);
  });
});

describe('webhook del proveedor', () => {
  const sign = (b: string, key = CFG.readOnlyApiKey) => createHmac('sha256', key).update(b).digest('hex');
  const hdr = (sig: string) => ({ 'x-bunnystream-signature': sig, 'x-bunnystream-signature-version': 'v1', 'x-bunnystream-signature-algorithm': 'hmac-sha256' });

  async function uploaded() {
    await upload();
    return st.videos[0];
  }

  it('firma válida → relee el asset en Bunny y asienta lo REAL (no lo que dice el payload)', async () => {
    const v = await uploaded();
    // El payload dice «falló» (5), pero el API dice terminado (4) con 95 s y 123456 bytes.
    const body = JSON.stringify({ VideoLibraryId: Number(LIB), VideoGuid: v.provider_asset_id, Status: 5 });
    const r = await call('POST', '/api/v1/webhooks/video/bunny', { raw: body, headers: hdr(sign(body)) });
    expect(r.status).toBe(200);
    expect(v).toMatchObject({ status: 'ready', duration_s: 95, size_bytes: 123456, counted_seconds: 95 });
    expect(st.settings[0]).toMatchObject({ used_seconds: 95, used_bytes: 123456 });
    const settle = st.rpcs.find((x) => x.name === 'settle_school_video')!;
    expect(settle.as).toBe('service_role');
  });
  it('repetir el mismo webhook no cambia el cupo (idempotente)', async () => {
    const v = await uploaded();
    const body = JSON.stringify({ VideoLibraryId: Number(LIB), VideoGuid: v.provider_asset_id, Status: 3 });
    await call('POST', '/api/v1/webhooks/video/bunny', { raw: body, headers: hdr(sign(body)) });
    await call('POST', '/api/v1/webhooks/video/bunny', { raw: body, headers: hdr(sign(body)) });
    expect(st.settings[0].used_seconds).toBe(95);
  });
  it('firma inválida, cuerpo alterado o sin firma → 401 y no se toca nada', async () => {
    const v = await uploaded();
    const body = JSON.stringify({ VideoLibraryId: Number(LIB), VideoGuid: v.provider_asset_id, Status: 3 });
    const malos = [
      { raw: body, headers: hdr(sign(body, 'otra-llave')) },
      { raw: body.replace('"Status":3', '"Status":4'), headers: hdr(sign(body)) },
      { raw: body, headers: {} },
    ];
    for (const m of malos) expect((await call('POST', '/api/v1/webhooks/video/bunny', m)).status).toBe(401);
    expect(st.rpcs.some((x) => x.name === 'settle_school_video')).toBe(false);
    expect(bunnyHttp.calls.filter((c) => c.method === 'GET')).toHaveLength(0);
  });
  it('otro proveedor en la URL → 404; otra librería → 200 ignorado', async () => {
    expect((await call('POST', '/api/v1/webhooks/video/mux', { raw: '{}' })).status).toBe(404);
    const body = JSON.stringify({ VideoLibraryId: 1, VideoGuid: GUID, Status: 3 });
    const r = await call('POST', '/api/v1/webhooks/video/bunny', { raw: body, headers: hdr(sign(body)) });
    expect(r.json).toMatchObject({ ok: true, ignored: true });
  });
  it('falla de transcodificación → failed y devuelve la reserva', async () => {
    const v = await uploaded();
    bunnyHttp.asset = { status: 5, length: 0, storageSize: 0 };
    const body = JSON.stringify({ VideoLibraryId: Number(LIB), VideoGuid: v.provider_asset_id, Status: 5 });
    await call('POST', '/api/v1/webhooks/video/bunny', { raw: body, headers: hdr(sign(body)) });
    expect(v.status).toBe('failed');
    expect(st.settings[0]).toMatchObject({ used_seconds: 0, used_bytes: 0 });
  });
  it('«Actualizar estado» (sync) sin webhook asienta igual', async () => {
    const v = await uploaded();
    const r = await call('POST', `/api/v1/school/videos/${v.id}/sync`);
    expect(r.json.status).toBe('ready');
    expect(v.status).toBe('ready');
  });
});
