/**
 * M6b «Equipos almacenados»: CRUD de tactical_rival_teams con la base en
 * memoria (cero red). Prueba roles, aislamiento por escuela, validación,
 * duplicados y la tabla todavía sin migrar (503).
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
  inserts: [] as { table: string; row: Row }[],
}));

vi.mock('../../config/supabase', () => {
  function builder(table: string) {
    let rows: Row[] = [...(db.tables[table] ?? [])];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | null = null;
    const missing = db.missing.has(table)
      ? { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` }
      : null;
    const run = () => {
      if (missing) return { data: null, error: missing };
      if (op === 'insert') {
        const row = { id: `r0000000-0000-4000-8000-${String(db.inserts.length + 1).padStart(12, '0')}`, ...payload, created_at: 'now', updated_at: 'now' };
        const dup = (db.tables[table] ?? []).some((r) => r.school_id === row.school_id && String(r.name).toLowerCase() === String(row.name).toLowerCase());
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        db.inserts.push({ table, row });
        (db.tables[table] ??= []).push(row);
        return { data: [row], error: null };
      }
      if (op === 'update') {
        for (const r of rows) Object.assign(r, payload);
        return { data: rows, error: null };
      }
      if (op === 'delete') {
        db.tables[table] = (db.tables[table] ?? []).filter((r) => !rows.includes(r));
        return { data: rows, error: null };
      }
      return { data: rows, error: null };
    };
    const api: any = {
      select: () => api,
      insert: (p: Row) => { op = 'insert'; payload = p; return api; },
      update: (p: Row) => { op = 'update'; payload = p; return api; },
      delete: () => { op = 'delete'; return api; },
      eq: (c: string, v: any) => { rows = rows.filter((r) => r[c] === v); return api; },
      is: (c: string, v: any) => { rows = rows.filter((r) => (r[c] ?? null) === v); return api; },
      in: (c: string, vs: any[]) => { rows = rows.filter((r) => vs.includes(r[c])); return api; },
      order: () => api,
      limit: (n: number) => { rows = rows.slice(0, n); return api; },
      maybeSingle: async () => { const r = run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; },
      single: async () => { const r = run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; },
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

const { default: router } = await import('./tacticalRivalTeams');

const A = 'e0000000-0000-4000-8000-00000000000a';
const B = 'e0000000-0000-4000-8000-00000000000b';
const COACH = 'a0000000-0000-4000-8000-000000000001';
const OWNER = 'a0000000-0000-4000-8000-000000000002';
const STAFF = 'a0000000-0000-4000-8000-000000000003';
const PARENT = 'a0000000-0000-4000-8000-000000000004';
const COACH_B = 'a0000000-0000-4000-8000-000000000005';
const RIVAL_A = 'b0000000-0000-4000-8000-0000000000a1';
const RIVAL_B = 'b0000000-0000-4000-8000-0000000000b1';

const rival = (id: string, school_id: string, name: string) => ({
  id, school_id, name, short_name: null, color_primary: '#dc2626', color_secondary: '#7f1d1d', color_number: '#ffffff',
  crest: { kind: 'generated', shape: 'shield', design: 'plain', initials: 'R' }, chip_style: 'disc', roster: [], created_by: null,
});
const BODY = {
  name: 'Jaguar F.C.', short_name: 'JAG', color_primary: '#DC2626', color_secondary: '#FDE68A', color_number: '#111827',
  crest: { kind: 'generated', shape: 'shield', design: 'stripes', initials: 'JFC' }, chip_style: 'stripes_v',
  roster: [{ number: 1, alias: 'Muro' }, { number: 9, alias: 'Flaco' }],
};

let server: http.Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/school', router);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  db.missing = new Set();
  db.inserts = [];
  db.tokens = Object.fromEntries([COACH, OWNER, STAFF, PARENT, COACH_B].map((u) => [`tok-${u}`, { id: u, email: 'x@t.co' }]));
  const m = (profile_id: string, school_id: string, role: string) => ({ profile_id, school_id, role, status: 'active', branch_id: null, joined_at: '2026-01-01' });
  db.tables = {
    platform_admins: [],
    school_members: [m(COACH, A, 'coach'), m(OWNER, A, 'owner'), m(STAFF, A, 'staff'), m(PARENT, A, 'parent'), m(COACH_B, B, 'coach')],
    tactical_rival_teams: [rival(RIVAL_A, A, 'Leones'), rival(RIVAL_B, B, 'Tigres')],
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

describe('GET /tactical-rival-teams', () => {
  it('staff ve SOLO los de su escuela', async () => {
    const r = await call('GET', '/tactical-rival-teams', STAFF, A);
    expect(r.status).toBe(200);
    expect(r.body.map((x: Row) => x.name)).toEqual(['Leones']);
  });
  it('un padre no entra', async () => {
    expect((await call('GET', '/tactical-rival-teams', PARENT, A)).status).toBe(403);
  });
  it('sin la migración: 503 claro', async () => {
    db.missing.add('tactical_rival_teams');
    const r = await call('GET', '/tactical-rival-teams', COACH, A);
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/todavía no están disponibles/);
  });
});

describe('POST /tactical-rival-teams', () => {
  it('coach crea en SU escuela, firmado por él, con el payload saneado', async () => {
    const r = await call('POST', '/tactical-rival-teams', COACH, A, BODY);
    expect(r.status).toBe(201);
    const row = db.inserts[0].row;
    expect(row).toMatchObject({ school_id: A, created_by: COACH, name: 'Jaguar F.C.', color_primary: '#dc2626', chip_style: 'stripes_v' });
    expect(row.roster).toEqual([{ number: 1, alias: 'Muro' }, { number: 9, alias: 'Flaco' }]);
  });
  it('el school_id del cuerpo no se acepta (no se elige la escuela)', async () => {
    const r = await call('POST', '/tactical-rival-teams', COACH, A, { ...BODY, school_id: B });
    expect(r.status).toBe(422);
    expect(db.inserts).toHaveLength(0);
  });
  it('staff (no táctico) no crea', async () => {
    expect((await call('POST', '/tactical-rival-teams', STAFF, A, BODY)).status).toBe(403);
  });
  it('colores inválidos y plantilla con nombres completos → 422', async () => {
    const r = await call('POST', '/tactical-rival-teams', OWNER, A, { ...BODY, color_number: 'blanco', roster: [{ number: 5, alias: 'Juan Pablo Ruiz' }] });
    expect(r.status).toBe(422);
    expect(r.body.details.join(' ')).toMatch(/color_number/);
    expect(r.body.details.join(' ')).toMatch(/2 palabras/);
  });
  it('plantilla de 31 → 422', async () => {
    const roster = Array.from({ length: 31 }, (_, i) => ({ number: i }));
    expect((await call('POST', '/tactical-rival-teams', COACH, A, { ...BODY, roster })).status).toBe(422);
  });
  it('nombre repetido en la escuela → 409', async () => {
    const r = await call('POST', '/tactical-rival-teams', COACH, A, { ...BODY, name: 'leones' });
    expect(r.status).toBe(409);
  });
});

describe('PATCH / DELETE', () => {
  it('coach edita un rival de su escuela', async () => {
    const r = await call('PATCH', `/tactical-rival-teams/${RIVAL_A}`, COACH, A, { color_primary: '#000000' });
    expect(r.status).toBe(200);
    expect(db.tables.tactical_rival_teams.find((x) => x.id === RIVAL_A)!.color_primary).toBe('#000000');
  });
  it('coach de A NO edita ni borra un rival de B (404, como si no existiera)', async () => {
    expect((await call('PATCH', `/tactical-rival-teams/${RIVAL_B}`, COACH, A, { name: 'X' })).status).toBe(404);
    expect((await call('DELETE', `/tactical-rival-teams/${RIVAL_B}`, COACH, A)).status).toBe(404);
    expect(db.tables.tactical_rival_teams.find((x) => x.id === RIVAL_B)!.name).toBe('Tigres');
  });
  it('id inválido → 400', async () => {
    expect((await call('DELETE', '/tactical-rival-teams/abc', COACH, A)).status).toBe(400);
  });
  it('owner borra', async () => {
    const r = await fetch(`${base}/api/v1/school/tactical-rival-teams/${RIVAL_A}`, {
      method: 'DELETE', headers: { 'x-school-id': A, authorization: `Bearer tok-${OWNER}` },
    });
    expect(r.status).toBe(204);
    expect(db.tables.tactical_rival_teams.map((x) => x.id)).toEqual([RIVAL_B]);
  });
  it('padre no borra', async () => {
    expect((await call('DELETE', `/tactical-rival-teams/${RIVAL_A}`, PARENT, A)).status).toBe(403);
  });
});
