/**
 * Biblioteca de ejercicios filtrada por los deportes de la escuela (D1, M1 de
 * docs/specs/pizarra-multideporte-3d-ia.md): las plantillas SportMaps de
 * deportes que la escuela NO tiene no salen del BFF; las genéricas
 * («Preparación física») siempre; los ejercicios propios de la escuela, siempre.
 * Cero red: base en memoria con un builder que filtra de verdad (incluido el
 * `.or()` de PostgREST que usa la ruta).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, tokens: {} as Record<string, { id: string; email: string }> }));

/** Condición de PostgREST `col.op.valor` (eq, is, in) sobre una fila. */
function matchCond(row: Row, cond: string): boolean {
  if (cond.startsWith('and(') && cond.endsWith(')')) return splitTop(cond.slice(4, -1)).every((c) => matchCond(row, c));
  const m = /^([a-z_]+)\.(eq|is|in)\.(.*)$/.exec(cond);
  if (!m) throw new Error(`condición no soportada: ${cond}`);
  const [, col, op, val] = m;
  if (op === 'eq') return String(row[col]) === val;
  if (op === 'is') return val === 'null' ? (row[col] ?? null) === null : String(row[col]) === val;
  return val.replace(/^\(|\)$/g, '').split(',').includes(String(row[col]));
}
/** Parte por comas de primer nivel (respeta paréntesis). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

vi.mock('../../config/supabase', () => {
  function builder(table: string) {
    let rows: Row[] = [...(db.tables[table] ?? [])];
    const api: any = {
      select: () => api,
      eq: (c: string, v: any) => { rows = rows.filter((r) => r[c] === v); return api; },
      neq: (c: string, v: any) => { rows = rows.filter((r) => r[c] !== v); return api; },
      is: (c: string, v: any) => { rows = rows.filter((r) => (r[c] ?? null) === v); return api; },
      in: (c: string, vs: any[]) => { rows = rows.filter((r) => vs.includes(r[c])); return api; },
      contains: (c: string, vs: any[]) => { rows = rows.filter((r) => vs.every((v) => (r[c] ?? []).includes(v))); return api; },
      or: (expr: string) => { rows = rows.filter((r) => splitTop(expr).some((c) => matchCond(r, c))); return api; },
      order: () => api,
      limit: (n: number) => { rows = rows.slice(0, n); return api; },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then: (ok: any, ko: any) => Promise.resolve({ data: rows, error: null }).then(ok, ko),
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

const { default: router } = await import('./exercises');

const FUTBOL = 'e0000000-0000-4000-8000-000000000001'; // solo fútbol (11 y 7)
const MULTI = 'e0000000-0000-4000-8000-000000000002'; // voleibol + baloncesto + natación
const NATACION = 'e0000000-0000-4000-8000-000000000003'; // sin deportes de pizarra
const COACH_F = 'a0000000-0000-4000-8000-000000000001';
const COACH_M = 'a0000000-0000-4000-8000-000000000002';
const COACH_N = 'a0000000-0000-4000-8000-000000000003';

const tpl = (id: string, sport: string) => ({
  id, school_id: null, created_by: null, name: `Plantilla ${sport} ${id}`, objective: null, sport, tags: [],
  is_template: true, is_active: true, times_used: 0, created_at: '2026-10-13T00:00:00Z', board: null,
});
const own = (id: string, school_id: string, sport: string) => ({
  ...tpl(id, sport), school_id, created_by: 'x', is_template: false, name: `Propio ${sport} ${id}`,
});

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
  db.tokens = Object.fromEntries([COACH_F, COACH_M, COACH_N].map((u) => [`tok-${u}`, { id: u, email: 'c@t.co' }]));
  const m = (profile_id: string, school_id: string) => ({ profile_id, school_id, role: 'coach', status: 'active', branch_id: null, joined_at: '2026-01-01' });
  db.tables = {
    platform_admins: [],
    school_members: [m(COACH_F, FUTBOL), m(COACH_M, MULTI), m(COACH_N, NATACION)],
    schools: [
      { id: FUTBOL, sports: ['Fútbol'] },
      { id: MULTI, sports: ['Multideporte'] },
      { id: NATACION, sports: ['Natación'] },
    ],
    teams: [
      { school_id: FUTBOL, sport: 'Fútbol', name: 'Sub 12', status: 'active' },
      { school_id: FUTBOL, sport: 'Fútbol', name: 'F7 Sub 9', status: 'active' },
      // Equipo INACTIVO de vóley: no suma.
      { school_id: FUTBOL, sport: 'Voleibol', name: 'Vóley viejo', status: 'inactive' },
      { school_id: MULTI, sport: 'Voleibol', name: 'Sub 14', status: 'active' },
      { school_id: MULTI, sport: 'Baloncesto', name: 'Mayores', status: 'active' },
      { school_id: MULTI, sport: 'Natación', name: 'Iniciación', status: 'active' },
      { school_id: NATACION, sport: 'Natación', name: 'Iniciación', status: 'active' },
    ],
    training_exercises: [
      tpl('t-fut', 'futbol'), tpl('t-f7', 'futbol7'), tpl('t-f5', 'futbol5'), tpl('t-fs', 'futsal'),
      tpl('t-vb', 'voleibol'), tpl('t-bk', 'baloncesto'), tpl('t-bm', 'balonmano'), tpl('t-gen', 'generico'),
      own('o-fut', FUTBOL, 'futbol'),
      // La escuela de fútbol guardó alguna vez un ejercicio de vóley: es SUYO, se lista.
      own('o-vb', FUTBOL, 'voleibol'),
      own('o-multi', MULTI, 'baloncesto'),
    ],
  };
});

async function get(path: string, school: string, user: string) {
  const r = await fetch(`${base}/api/v1/school${path}`, { headers: { 'x-school-id': school, authorization: `Bearer tok-${user}` } });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe('GET /exercises/sports', () => {
  it('escuela de fútbol: Fútbol 11 y 7 (tiene equipo F7) + genérico; el vóley inactivo no cuenta', async () => {
    expect((await get('/exercises/sports', FUTBOL, COACH_F)).body).toEqual({ sports: ['futbol', 'futbol7', 'generico'] });
  });
  it('multideporte: voleibol y baloncesto (natación no tiene pizarra)', async () => {
    expect((await get('/exercises/sports', MULTI, COACH_M)).body).toEqual({ sports: ['voleibol', 'baloncesto', 'generico'] });
  });
  it('sin deportes de pizarra: solo genérico', async () => {
    expect((await get('/exercises/sports', NATACION, COACH_N)).body).toEqual({ sports: ['generico'] });
  });
});

describe('GET /exercises (plantillas filtradas por los deportes de la escuela)', () => {
  it('escuela de fútbol: no recibe plantillas de voleibol ni de otros deportes; genérico sí', async () => {
    const r = await get('/exercises?templates=true', FUTBOL, COACH_F);
    expect(r.status).toBe(200);
    expect(ids(r.body)).toEqual(['t-f7', 't-fut', 't-gen']);
  });

  it('escuela de fútbol pidiendo voleibol explícitamente: nada', async () => {
    const r = await get('/exercises?templates=true&sport=voleibol&include_generic=true', FUTBOL, COACH_F);
    expect(ids(r.body)).toEqual(['t-gen']);
    const solo = await get('/exercises?templates=true&sport=voleibol', FUTBOL, COACH_F);
    expect(solo.body).toEqual([]);
  });

  it('multideporte: recibe las suyas (vóley, básquet) y genérico, nunca fútbol', async () => {
    const r = await get('/exercises?templates=true', MULTI, COACH_M);
    expect(ids(r.body)).toEqual(['t-bk', 't-gen', 't-vb']);
    const vb = await get('/exercises?templates=true&sport=voleibol&include_generic=true', MULTI, COACH_M);
    expect(ids(vb.body)).toEqual(['t-gen', 't-vb']);
  });

  it('genérico siempre, aun sin deportes de pizarra', async () => {
    expect(ids((await get('/exercises?templates=true', NATACION, COACH_N)).body)).toEqual(['t-gen']);
  });

  it('sin `templates` (propios + plantillas): propios de cualquier deporte + plantillas de sus deportes', async () => {
    const r = await get('/exercises', FUTBOL, COACH_F);
    expect(ids(r.body)).toEqual(['o-fut', 'o-vb', 't-f7', 't-fut', 't-gen']);
    const vb = await get('/exercises?sport=voleibol', FUTBOL, COACH_F);
    expect(ids(vb.body)).toEqual(['o-vb']);
  });

  it('«De mi escuela» (templates=false): solo los propios, sin filtro de deporte de escuela', async () => {
    expect(ids((await get('/exercises?templates=false', FUTBOL, COACH_F)).body)).toEqual(['o-fut', 'o-vb']);
    expect(ids((await get('/exercises?templates=false', MULTI, COACH_M)).body)).toEqual(['o-multi']);
  });

  it('GET /exercises/:id de una plantilla de otro deporte → 404', async () => {
    const uuid = 'b0000000-0000-4000-8000-000000000009';
    db.tables.training_exercises.push({ ...tpl(uuid, 'voleibol') });
    expect((await get(`/exercises/${uuid}`, FUTBOL, COACH_F)).status).toBe(404);
    expect((await get(`/exercises/${uuid}`, MULTI, COACH_M)).status).toBe(200);
  });
});
