/**
 * «Videos guardados» (pizarra M6c): CRUD con la base simulada en memoria.
 * Roles: leer = staff; guardar/borrar = owner/coach/super_admin. Padres, atletas
 * y otra escuela no. Con la tabla sin aplicar: GET vacío + available=false, POST 503.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  tokens: {} as Record<string, { id: string; email: string }>,
  missing: new Set<string>(),
  inserts: [] as Row[],
  seq: 0,
}));

vi.mock('../../config/supabase', () => {
  function builder(table: string) {
    let rows: Row[] = [...(db.tables[table] ?? [])];
    let op: 'select' | 'insert' | 'delete' = 'select';
    let payload: Row | null = null;
    let head = false;
    let countMode = false;
    const missing = db.missing.has(table)
      ? { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` }
      : null;
    const run = () => {
      if (missing) return { data: null, error: missing, count: null };
      if (op === 'insert') {
        const row = { id: `00000000-0000-4000-8000-${String(++db.seq).padStart(12, '0')}`, created_at: '2026-10-14T12:00:00Z', ...payload };
        const dup = (db.tables[table] ?? []).some((r) => r.school_id === row.school_id && r.provider === row.provider
          && (r.video_id ?? r.url) === (row.video_id ?? row.url) && r.start_s === row.start_s);
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        (db.tables[table] ??= []).push(row);
        db.inserts.push(row);
        return { data: row, error: null };
      }
      if (op === 'delete') {
        const ids = new Set(rows.map((r) => r.id));
        db.tables[table] = (db.tables[table] ?? []).filter((r) => !ids.has(r.id));
        return { data: rows.map((r) => ({ id: r.id })), error: null };
      }
      return { data: head ? null : rows, error: null, count: countMode ? rows.length : null };
    };
    const api: any = {
      select: (_c?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count) countMode = true;
        if (opts?.head) head = true;
        return api;
      },
      insert: (p: Row) => { op = 'insert'; payload = p; return api; },
      delete: () => { op = 'delete'; return api; },
      eq: (c: string, v: any) => { rows = rows.filter((r) => r[c] === v); return api; },
      in: (c: string, vs: any[]) => { rows = rows.filter((r) => vs.includes(r[c])); return api; },
      is: (c: string, v: any) => { rows = rows.filter((r) => (r[c] ?? null) === v); return api; },
      order: () => api,
      limit: (n: number) => { rows = rows.slice(0, n); return api; },
      maybeSingle: async () => { const r = run(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; },
      single: async () => { const r = run(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; },
      then: (ok: any, ko: any) => Promise.resolve(run()).then(ok, ko),
    };
    return api;
  }
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async () => ({ data: null, error: null }),
      auth: {
        getUser: async (token: string) => {
          const user = db.tokens[token];
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid token' } };
        },
      },
    },
  };
});
vi.mock('../../utils/authCache', () => ({
  getCachedUser: (_t: string, resolve: any) => resolve(),
  getCachedMembership: (_u: string, _s: any, _t: string, resolve: any) => resolve(),
  invalidateUserAuthCache: () => { },
}));

const { default: videosRouter } = await import('./tacticalVideos');

const A = 'e0000000-0000-4000-8000-000000000001';
const B = 'e0000000-0000-4000-8000-000000000002';
const COACH = 'a0000000-0000-4000-8000-000000000001';
const OWNER = 'a0000000-0000-4000-8000-000000000002';
const ADMIN = 'a0000000-0000-4000-8000-000000000003';
const PARENT = 'a0000000-0000-4000-8000-000000000004';
const ATHLETE = 'a0000000-0000-4000-8000-000000000005';
const COACH_B = 'a0000000-0000-4000-8000-000000000006';
const V_A = 'b0000000-0000-4000-8000-000000000001';
const V_B = 'b0000000-0000-4000-8000-000000000002';

let server: http.Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/school', videosRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  db.missing = new Set();
  db.inserts = [];
  db.seq = 0;
  db.tokens = Object.fromEntries([COACH, OWNER, ADMIN, PARENT, ATHLETE, COACH_B].map((u) => [`tok-${u}`, { id: u, email: 'x@t.co' }]));
  const m = (profile_id: string, school_id: string, role: string) => ({ profile_id, school_id, role, status: 'active', branch_id: null, joined_at: '2026-01-01' });
  db.tables = {
    platform_admins: [],
    school_members: [m(COACH, A, 'coach'), m(OWNER, A, 'owner'), m(ADMIN, A, 'school_admin'), m(PARENT, A, 'parent'), m(ATHLETE, A, 'athlete'), m(COACH_B, B, 'coach')],
    schools: [{ id: A, name: 'A' }, { id: B, name: 'B' }],
    tactical_saved_videos: [
      { id: V_A, school_id: A, provider: 'youtube', video_id: 'dQw4w9WgXcQ', hash: null, url: null, asset_id: null, title: 'Salida', start_s: 90, end_s: null, is_private: false, created_by: COACH, created_at: '2026-10-14T10:00:00Z' },
      { id: V_B, school_id: B, provider: 'veo', video_id: null, hash: null, url: 'https://app.veo.co/matches/x', asset_id: null, title: 'De B', start_s: 0, end_s: null, is_private: true, created_by: COACH_B, created_at: '2026-10-14T10:00:00Z' },
    ],
  };
});

async function call(method: string, path: string, user: string, school: string, body?: unknown) {
  const r = await fetch(`${base}/api/v1/school${path}`, {
    method,
    headers: { 'x-school-id': school, authorization: `Bearer tok-${user}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

const NEW = { provider: 'youtube', video_id: 'aBcDeFgHiJk', title: 'Presión alta', start_s: 30, end_s: 75, is_private: false };

describe('GET /tactical/videos', () => {
  it('staff (coach, admin) lee SOLO los de su escuela', async () => {
    for (const u of [COACH, ADMIN, OWNER]) {
      const r = await call('GET', '/tactical/videos', u, A);
      expect(r.status).toBe(200);
      expect(r.body.available).toBe(true);
      expect(r.body.videos.map((v: any) => v.id)).toEqual([V_A]);
    }
  });
  it('padre y atleta → 403', async () => {
    expect((await call('GET', '/tactical/videos', PARENT, A)).status).toBe(403);
    expect((await call('GET', '/tactical/videos', ATHLETE, A)).status).toBe(403);
  });
  it('coach de B pidiendo la escuela A → 403 (no es miembro)', async () => {
    expect((await call('GET', '/tactical/videos', COACH_B, A)).status).toBe(403);
  });
  it('tabla sin aplicar → lista vacía con available=false', async () => {
    db.missing.add('tactical_saved_videos');
    const r = await call('GET', '/tactical/videos', COACH, A);
    expect(r).toEqual({ status: 200, body: { videos: [], available: false } });
  });
});

describe('POST /tactical/videos', () => {
  it('coach guarda: la escuela y el autor salen de la sesión, no del body', async () => {
    const r = await call('POST', '/tactical/videos', COACH, A, { ...NEW, school_id: B, created_by: OWNER, id: V_B });
    expect(r.status).toBe(201);
    expect(db.inserts[0]).toMatchObject({ school_id: A, created_by: COACH, provider: 'youtube', video_id: 'aBcDeFgHiJk', start_s: 30, end_s: 75 });
    expect(db.inserts[0].id).not.toBe(V_B);
  });
  it('enlace de cámara (Veo) se guarda como url normalizada', async () => {
    const r = await call('POST', '/tactical/videos', OWNER, A, { provider: 'veo', url: 'https://app.veo.co/matches/abc-123/', title: 'Final', start_s: 0, is_private: true });
    expect(r.status).toBe(201);
    expect(db.inserts[0]).toMatchObject({ provider: 'veo', url: 'https://app.veo.co/matches/abc-123/', video_id: null, is_private: true });
  });
  it('admin sin rol táctico, padre y atleta → 403', async () => {
    for (const u of [ADMIN, PARENT, ATHLETE]) expect((await call('POST', '/tactical/videos', u, A, NEW)).status).toBe(403);
    expect(db.inserts).toEqual([]);
  });
  it('video malicioso o inválido → 422 y nada guardado', async () => {
    for (const bad of [
      { ...NEW, video_id: '<script>' },
      { ...NEW, provider: 'dailymotion' },
      { provider: 'veo', url: 'javascript:alert(1)', title: 'x', start_s: 0 },
      { provider: 'hudl', url: 'https://hudl.com.evil.io/x', title: 'x', start_s: 0 },
      { ...NEW, title: '<img src=x>' },
      { ...NEW, start_s: 100, end_s: 10 },
    ]) {
      expect((await call('POST', '/tactical/videos', COACH, A, bad)).status).toBe(422);
    }
    expect(db.inserts).toEqual([]);
  });
  it("'sportmaps' (M6h) todavía no se acepta", async () => {
    const r = await call('POST', '/tactical/videos', COACH, A, { provider: 'sportmaps', asset_id: 'b0000000-0000-4000-8000-000000000009', title: 'x', start_s: 0 });
    expect(r.status).toBe(422);
  });
  it('repetido → 409; tope por escuela → 409', async () => {
    expect((await call('POST', '/tactical/videos', COACH, A, { ...NEW, video_id: 'dQw4w9WgXcQ', start_s: 90, end_s: null })).status).toBe(409);
    db.tables.tactical_saved_videos.push(...Array.from({ length: 300 }, (_, i) => ({ id: `x${i}`, school_id: A, provider: 'youtube', video_id: `v${i}`, start_s: 0 })));
    expect((await call('POST', '/tactical/videos', COACH, A, NEW)).status).toBe(409);
  });
  it('tabla sin aplicar → 503', async () => {
    db.missing.add('tactical_saved_videos');
    expect((await call('POST', '/tactical/videos', COACH, A, NEW)).status).toBe(503);
  });
});

describe('DELETE /tactical/videos/:id', () => {
  it('coach borra uno de su escuela', async () => {
    expect((await call('DELETE', `/tactical/videos/${V_A}`, COACH, A)).status).toBe(204);
    expect(db.tables.tactical_saved_videos.map((v) => v.id)).toEqual([V_B]);
  });
  it('uno de otra escuela → 404 (no lo toca)', async () => {
    expect((await call('DELETE', `/tactical/videos/${V_B}`, COACH, A)).status).toBe(404);
    expect(db.tables.tactical_saved_videos).toHaveLength(2);
  });
  it('admin no táctico → 403; id inválido → 400', async () => {
    expect((await call('DELETE', `/tactical/videos/${V_A}`, ADMIN, A)).status).toBe(403);
    expect((await call('DELETE', '/tactical/videos/no-es-uuid', COACH, A)).status).toBe(400);
  });
});
