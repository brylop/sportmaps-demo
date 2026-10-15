/**
 * Paquetes de la Biblioteca (pizarra M2, D4 de docs/specs/pizarra-multideporte-3d-ia.md):
 * listado con y sin paquetes activados, activar/desactivar, exportar sin datos
 * sensibles e importar archivos válidos, inválidos y maliciosos.
 *
 * Cero red: base en memoria con un builder que filtra de verdad (incluidos los
 * `or()` anidados y `not.in` de PostgREST que usa la ruta) y las RPC simuladas
 * con el MISMO gate de la migración 20261014121142 (admin ∪ táctico).
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
  rpcCalls: [] as { fn: string; args: any; uid: string }[],
  rpcForce: null as null | { code: string; message: string },
}));

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
/** Condición de PostgREST: and(...)/or(...) anidados, eq, is, in, not.in. */
function matchCond(row: Row, cond: string): boolean {
  if (cond.startsWith('and(') && cond.endsWith(')')) return splitTop(cond.slice(4, -1)).every((c) => matchCond(row, c));
  if (cond.startsWith('or(') && cond.endsWith(')')) return splitTop(cond.slice(3, -1)).some((c) => matchCond(row, c));
  const m = /^([a-z_]+)\.(not\.in|eq|is|in)\.(.*)$/.exec(cond);
  if (!m) throw new Error(`condición no soportada: ${cond}`);
  const [, col, op, val] = m;
  const list = () => val.replace(/^\(|\)$/g, '').split(',');
  if (op === 'eq') return String(row[col]) === val;
  if (op === 'is') return val === 'null' ? (row[col] ?? null) === null : String(row[col]) === val;
  if (op === 'in') return list().includes(String(row[col]));
  return row[col] != null && !list().includes(String(row[col])); // not.in: NULL no pasa (como SQL)
}

vi.mock('../../config/supabase', () => {
  function builder(table: string) {
    let rows: Row[] = [...(db.tables[table] ?? [])];
    const missing = db.missing.has(table)
      ? { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` }
      : null;
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
      maybeSingle: async () => (missing ? { data: null, error: missing } : { data: rows[0] ?? null, error: null }),
      single: async () => (missing ? { data: null, error: missing } : { data: rows[0] ?? null, error: null }),
      then: (ok: any, ko: any) => Promise.resolve(missing ? { data: null, error: missing } : { data: rows, error: null }).then(ok, ko),
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

// RPC con el gate de la migración: admin ∪ táctico de ESA escuela.
const MANAGE = ['owner', 'admin', 'school_admin', 'super_admin', 'coach'];
let seq = 0;
async function fakeRpc(fn: string, args: any, uid: string) {
  db.rpcCalls.push({ fn, args: JSON.parse(JSON.stringify(args)), uid });
  if (db.rpcForce) return { data: null, error: db.rpcForce };
  const member = db.tables.school_members.find((m) => m.profile_id === uid && m.school_id === args.p_school_id && m.status === 'active');
  if (!member || !MANAGE.includes(member.role)) return { data: null, error: { code: '42501', message: 'No puedes gestionar los paquetes de esta escuela.' } };
  if (fn === 'import_exercise_pack') {
    const packId = `c0000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
    db.tables.exercise_packs.push({ id: packId, school_id: args.p_school_id, ...args.p_payload.pack, is_active: true, updated_at: '2026-10-14T12:00:00Z' });
    for (const ex of args.p_payload.exercises) {
      db.tables.training_exercises.push({ ...ex, id: `x-${++seq}`, school_id: args.p_school_id, created_by: uid, pack_id: packId, is_template: false, is_active: true, times_used: 0 });
    }
    return { data: { pack_id: packId, school_id: args.p_school_id, exercises: args.p_payload.exercises.length }, error: null };
  }
  const pack = db.tables.exercise_packs.find((p) => p.id === args.p_pack_id);
  if (!pack || (pack.school_id && pack.school_id !== args.p_school_id)) return { data: null, error: { code: 'P0002', message: 'Paquete no encontrado.' } };
  if (fn === 'activate_exercise_pack') {
    if (pack.school_id === null) {
      if (!db.tables.school_exercise_packs.some((a) => a.school_id === args.p_school_id && a.pack_id === pack.id)) {
        db.tables.school_exercise_packs.push({ school_id: args.p_school_id, pack_id: pack.id, activated_by: uid });
      }
    } else pack.is_active = true;
  } else if (pack.school_id === null) {
    db.tables.school_exercise_packs = db.tables.school_exercise_packs.filter((a) => !(a.school_id === args.p_school_id && a.pack_id === pack.id));
  } else pack.is_active = false;
  return { data: { pack_id: pack.id, school_id: args.p_school_id, is_system: pack.school_id === null, activated: fn === 'activate_exercise_pack' }, error: null };
}
vi.mock('../../utils/userClient', () => ({
  userClient: (req: any) => {
    const token = String(req.headers.authorization ?? '').replace('Bearer ', '');
    return { rpc: (fn: string, args: any) => fakeRpc(fn, args, db.tokens[token]?.id) };
  },
}));

const { default: packsRouter } = await import('./exercisePacks');
const { default: exercisesRouter } = await import('./exercises');

const FUT = 'e0000000-0000-4000-8000-000000000001'; // escuela de fútbol
const VB = 'e0000000-0000-4000-8000-000000000002';  // escuela de voleibol
const COACH = 'a0000000-0000-4000-8000-000000000001';
const OWNER = 'a0000000-0000-4000-8000-000000000002';
const STAFF = 'a0000000-0000-4000-8000-000000000003'; // rol 'staff': lee, no gestiona
const PARENT = 'a0000000-0000-4000-8000-000000000004';
const COACH_VB = 'a0000000-0000-4000-8000-000000000005';
const ATHLETE_ID = 'f1f1f1f1-0000-4000-8000-000000000099';

const P_FUT = '5b1c0000-0000-4000-8000-000000000001';
const P_F7 = '5b1c0000-0000-4000-8000-000000000002';
const P_VB = '5b1c0000-0000-4000-8000-000000000004';
const P_GEN = '5b1c0000-0000-4000-8000-000000000007';
const P_OWN_HIDDEN = 'd0000000-0000-4000-8000-000000000001';
const P_OTHER_SCHOOL = 'd0000000-0000-4000-8000-000000000002';

const sysPack = (id: string, sport: string, name: string) => ({
  id, school_id: null, sport, name, description: `Paquete ${name}`, version: 1, is_active: true, updated_at: '2026-10-14T00:00:00Z',
});
const BOARD = {
  players: [{ key: 'slot#0', slot_label: 'Pivote', x: 50, y: 50 }, { key: 'slot#1', slot_label: 'Ala', x: 30, y: 60 }],
  arrows: [{ type: 'arrow', x1: 50, y1: 50, x2: 60, y2: 40, color: 'white' }],
  frames: [
    { id: 'f1', duration_ms: 1200, players: [{ key: 'slot#0', x: 50, y: 50 }, { key: 'slot#1', x: 30, y: 60 }], ball: null, arrows: [] },
    { id: 'f2', duration_ms: 1200, players: [{ key: 'slot#0', x: 55, y: 45 }, { key: 'slot#1', x: 35, y: 55 }], ball: { x: 55, y: 45 }, arrows: [] },
  ],
};
const ex = (id: string, sport: string, pack_id: string | null, school_id: string | null = null, extra: Row = {}) => ({
  id, school_id, created_by: school_id ? COACH : null, pack_id, name: `Ejercicio ${id}`, objective: 'Objetivo', minutes: 15,
  age_group: null, materials: null, tags: ['rondo'], sport, description: null, board: BOARD,
  is_template: school_id === null, is_active: true, times_used: 3, created_at: '2026-10-13T00:00:00Z', ...extra,
});

let server: http.Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '5mb' })); // como bff/src/index.ts
  app.use('/api/v1/school', exercisesRouter);
  app.use('/api/v1/school', packsRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  seq = 0;
  db.missing = new Set();
  db.rpcCalls = [];
  db.rpcForce = null;
  db.tokens = Object.fromEntries([COACH, OWNER, STAFF, PARENT, COACH_VB].map((u) => [`tok-${u}`, { id: u, email: 'x@t.co' }]));
  const m = (profile_id: string, school_id: string, role: string) => ({ profile_id, school_id, role, status: 'active', branch_id: null, joined_at: '2026-01-01' });
  db.tables = {
    platform_admins: [],
    school_members: [m(COACH, FUT, 'coach'), m(OWNER, FUT, 'owner'), m(STAFF, FUT, 'staff'), m(PARENT, FUT, 'parent'), m(COACH_VB, VB, 'coach')],
    schools: [{ id: FUT, name: 'Club Fútbol QA', sports: ['Fútbol'] }, { id: VB, name: 'Vóley QA', sports: ['Voleibol'] }],
    teams: [
      { school_id: FUT, sport: 'Fútbol', name: 'Sub 12', status: 'active' },
      { school_id: VB, sport: 'Voleibol', name: 'Sub 14', status: 'active' },
    ],
    exercise_packs: [
      sysPack(P_FUT, 'futbol', 'Fútbol: fundamentos y juego'),
      sysPack(P_F7, 'futbol7', 'Fútbol 7 y fútbol 5'),
      sysPack(P_VB, 'voleibol', 'Voleibol formativo'),
      sysPack(P_GEN, 'generico', 'Preparación física'),
      { ...sysPack(P_OWN_HIDDEN, 'futbol', 'Mi paquete viejo'), school_id: FUT, is_active: false },
      { ...sysPack(P_OTHER_SCHOOL, 'voleibol', 'Paquete de otra escuela'), school_id: VB },
    ],
    school_exercise_packs: [],
    training_exercises: [
      ex('t-fut-1', 'futbol', P_FUT), ex('t-fut-2', 'futbol', P_FUT),
      ex('t-f7', 'futbol7', P_F7), ex('t-f5', 'futbol5', P_F7),
      ex('t-vb', 'voleibol', P_VB), ex('t-gen', 'generico', P_GEN),
      ex('o-suelto', 'futbol', null, FUT),                // propio, sin paquete
      ex('o-oculto', 'futbol', P_OWN_HIDDEN, FUT),        // propio, paquete desactivado
      ex('o-otra', 'voleibol', P_OTHER_SCHOOL, VB),
      // Un ejercicio de la escuela de vóley colgado (mal) del paquete del sistema: no se exporta con él.
      ex('o-intruso', 'futbol', P_FUT, VB),
    ],
  };
});

async function call(method: string, path: string, user: string, school: string, body?: unknown, rawBody?: string) {
  const r = await fetch(`${base}/api/v1/school${path}`, {
    method,
    headers: { 'x-school-id': school, authorization: `Bearer tok-${user}`, 'content-type': 'application/json' },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: r.status, headers: r.headers, body: (await r.json().catch(() => null)) as any };
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
const EXPORT_KEYS = ['age_group', 'board', 'description', 'materials', 'minutes', 'name', 'objective', 'sport', 'tags'];

describe('GET /exercise-packs', () => {
  it('escuela de fútbol sin activar nada: modo «todos», sus paquetes (11, 7/5, genérico) + los propios; nada de vóley ni de otra escuela', async () => {
    const r = await call('GET', '/exercise-packs', COACH, FUT);
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe('todos');
    expect(r.body.can_manage).toBe(true);
    expect(r.body.loose_own_count).toBe(1);
    expect(r.body.packs.map((p: any) => p.id)).toEqual([P_FUT, P_F7, P_GEN, P_OWN_HIDDEN]);
    const byId = Object.fromEntries(r.body.packs.map((p: any) => [p.id, p]));
    expect(byId[P_FUT]).toMatchObject({ is_system: true, activated: false, visible: true, exercise_count: 2, sport: 'futbol' });
    expect(byId[P_F7].exercise_count).toBe(2);
    expect(byId[P_OWN_HIDDEN]).toMatchObject({ is_system: false, activated: false, visible: false, exercise_count: 1 });
  });

  it('con un paquete activado: modo «selección», solo ese visible', async () => {
    db.tables.school_exercise_packs.push({ school_id: FUT, pack_id: P_F7 });
    const r = await call('GET', '/exercise-packs', COACH, FUT);
    expect(r.body.mode).toBe('seleccion');
    const vis = r.body.packs.filter((p: any) => p.visible).map((p: any) => p.id);
    expect(vis).toEqual([P_F7]);
  });

  it('rol staff ve la lista pero no gestiona; un padre no entra', async () => {
    expect((await call('GET', '/exercise-packs', STAFF, FUT)).body.can_manage).toBe(false);
    expect((await call('GET', '/exercise-packs', PARENT, FUT)).status).toBe(403);
  });

  it('migración sin aplicar: 503 en paquetes y la biblioteca sigue como antes', async () => {
    db.missing = new Set(['school_exercise_packs', 'exercise_packs']);
    expect((await call('GET', '/exercise-packs', COACH, FUT)).status).toBe(503);
    const lib = await call('GET', '/exercises?templates=true', COACH, FUT);
    expect(lib.status).toBe(200);
    expect(ids(lib.body)).toEqual(['t-f5', 't-f7', 't-fut-1', 't-fut-2', 't-gen']);
  });
});

describe('Biblioteca (GET /exercises) con y sin paquetes activados', () => {
  it('sin activar ninguno: todas las plantillas de sus deportes (compatibilidad)', async () => {
    const r = await call('GET', '/exercises?templates=true', COACH, FUT);
    expect(ids(r.body)).toEqual(['t-f5', 't-f7', 't-fut-1', 't-fut-2', 't-gen']);
  });

  it('activó «Fútbol 7 y 5»: solo esas plantillas; los propios sueltos siguen; los de un paquete propio desactivado no', async () => {
    db.tables.school_exercise_packs.push({ school_id: FUT, pack_id: P_F7 });
    expect(ids((await call('GET', '/exercises?templates=true', COACH, FUT)).body)).toEqual(['t-f5', 't-f7']);
    expect(ids((await call('GET', '/exercises', COACH, FUT)).body)).toEqual(['o-suelto', 't-f5', 't-f7']);
    expect(ids((await call('GET', '/exercises?templates=false', COACH, FUT)).body)).toEqual(['o-suelto']);
  });

  it('activar un paquete de un deporte que la escuela no tiene no le trae nada (D1 manda)', async () => {
    db.tables.school_exercise_packs.push({ school_id: FUT, pack_id: P_VB });
    expect(ids((await call('GET', '/exercises?templates=true', COACH, FUT)).body)).toEqual([]);
  });
});

describe('POST /exercise-packs/:id/activate|deactivate', () => {
  it('coach activa y desactiva un paquete del sistema → la biblioteca cambia', async () => {
    const a = await call('POST', `/exercise-packs/${P_FUT}/activate`, COACH, FUT);
    expect(a.status).toBe(200);
    expect(db.rpcCalls.at(-1)).toMatchObject({ fn: 'activate_exercise_pack', args: { p_school_id: FUT, p_pack_id: P_FUT }, uid: COACH });
    expect(ids((await call('GET', '/exercises?templates=true', COACH, FUT)).body)).toEqual(['t-fut-1', 't-fut-2']);
    const d = await call('POST', `/exercise-packs/${P_FUT}/deactivate`, COACH, FUT);
    expect(d.status).toBe(200);
    // Sin ninguno activado vuelve a «todos».
    expect(ids((await call('GET', '/exercises?templates=true', COACH, FUT)).body)).toHaveLength(5);
  });

  it('reactivar el paquete propio desactivado vuelve a mostrar sus ejercicios', async () => {
    expect((await call('POST', `/exercise-packs/${P_OWN_HIDDEN}/activate`, OWNER, FUT)).status).toBe(200);
    expect(ids((await call('GET', '/exercises?templates=false', COACH, FUT)).body)).toEqual(['o-oculto', 'o-suelto']);
  });

  it('paquete de otro deporte → 422; de otra escuela → 404; id inválido → 400', async () => {
    expect((await call('POST', `/exercise-packs/${P_VB}/activate`, COACH, FUT)).status).toBe(422);
    expect((await call('POST', `/exercise-packs/${P_OTHER_SCHOOL}/activate`, COACH, FUT)).status).toBe(404);
    expect((await call('POST', `/exercise-packs/${P_OTHER_SCHOOL}/deactivate`, COACH, FUT)).status).toBe(404);
    expect((await call('POST', '/exercise-packs/nope/activate', COACH, FUT)).status).toBe(400);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('rol staff y padre no pueden (403, sin llegar a la RPC)', async () => {
    expect((await call('POST', `/exercise-packs/${P_FUT}/activate`, STAFF, FUT)).status).toBe(403);
    expect((await call('POST', `/exercise-packs/${P_FUT}/activate`, PARENT, FUT)).status).toBe(403);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('la RPC es la segunda barrera: si responde 42501, el BFF da 403', async () => {
    // Coach de vóley pidiendo con x-school-id de la escuela de fútbol: el middleware no lo deja entrar.
    expect((await call('POST', `/exercise-packs/${P_FUT}/activate`, COACH_VB, FUT)).status).toBe(403);
  });
});

describe('GET /exercise-packs/:id/export', () => {
  it('archivo con formato y versión, SIN ids, school_id, created_by ni pack_id', async () => {
    const r = await call('GET', `/exercise-packs/${P_FUT}/export`, STAFF, FUT);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="paquete-futbol-fundamentos-y-juego.json"');
    expect(r.body).toMatchObject({ format: 'sportmaps-ejercicios', version: 1, pack: { name: 'Fútbol: fundamentos y juego', sport: 'futbol', version: 1 } });
    expect(r.body.exercises).toHaveLength(2); // el «intruso» de otra escuela no viaja
    // Lista blanca de campos (el único "id" que queda es el del cuadro: 'f1').
    expect(Object.keys(r.body.pack).sort()).toEqual(['description', 'name', 'sport', 'version']);
    for (const e of r.body.exercises) expect(Object.keys(e).sort()).toEqual(EXPORT_KEYS);
    const text = JSON.stringify(r.body);
    for (const k of ['school_id', 'created_by', 'pack_id', 'is_template', 'times_used', 'is_active', 'created_at']) expect(text).not.toContain(k);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(r.body.exercises[0].board.players.map((p: any) => p.key)).toEqual(['slot#0', 'slot#1']);
  });

  it('lo exportado se vuelve a importar tal cual (ida y vuelta)', async () => {
    const file = (await call('GET', `/exercise-packs/${P_F7}/export`, COACH, FUT)).body;
    const r = await call('POST', '/exercise-packs/import?dry_run=true', COACH, FUT, file);
    expect(r.body).toMatchObject({ valid: true, errors: [], summary: { exercises: 2, sports: ['futbol7', 'futbol5'] } });
  });

  it('paquete de otra escuela o de otro deporte → 404', async () => {
    expect((await call('GET', `/exercise-packs/${P_OTHER_SCHOOL}/export`, COACH, FUT)).status).toBe(404);
    expect((await call('GET', `/exercise-packs/${P_VB}/export`, COACH, FUT)).status).toBe(404);
  });

  it('«mis ejercicios»: los propios sin paquete, como paquete de la escuela', async () => {
    const r = await call('GET', '/exercise-packs/mine/export', COACH, FUT);
    expect(r.status).toBe(200);
    expect(r.body.pack.name).toBe('Ejercicios de Club Fútbol QA');
    expect(r.body.exercises.map((e: any) => e.name)).toEqual(['Ejercicio o-suelto']);
    expect(JSON.stringify(r.body)).not.toContain('created_by');
  });
});

// ── Importar ────────────────────────────────────────────────────────────────
const validFile = (over: Row = {}) => ({
  format: 'sportmaps-ejercicios',
  version: 1,
  pack: { name: 'Arqueros', description: 'Paquete del preparador', sport: 'futbol', version: 2 },
  exercises: [
    { name: 'Blocaje alto', objective: 'Atajar arriba', minutes: 10, tags: ['Arqueros'], board: BOARD },
    { name: 'Rondo de calentamiento', sport: 'generico', minutes: 8 },
  ],
  ...over,
});

describe('POST /exercise-packs/import', () => {
  it('vista previa (dry_run): cuántos y de qué deportes, sin escribir', async () => {
    const r = await call('POST', '/exercise-packs/import?dry_run=true', COACH, FUT, validFile());
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ valid: true, errors: [], summary: { name: 'Arqueros', sport: 'futbol', exercises: 2, sports: ['futbol', 'generico'] } });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('válido → 201: un paquete de la escuela con sus ejercicios, que salen en la biblioteca', async () => {
    const r = await call('POST', '/exercise-packs/import', OWNER, FUT, validFile());
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ exercises: 2, school_id: FUT, summary: { exercises: 2 } });
    const call0 = db.rpcCalls[0];
    expect(call0.fn).toBe('import_exercise_pack');
    expect(call0.args.p_school_id).toBe(FUT);
    expect(call0.args.p_payload.pack).toEqual({ name: 'Arqueros', description: 'Paquete del preparador', sport: 'futbol', version: 2 });
    expect(call0.args.p_payload.exercises[0]).toMatchObject({ name: 'Blocaje alto', sport: 'futbol', tags: ['arqueros'] });
    expect(call0.args.p_payload.exercises[1]).toMatchObject({ name: 'Rondo de calentamiento', sport: 'generico' });
    const lib = (await call('GET', '/exercises?templates=false', COACH, FUT)).body.map((e: any) => e.name).sort();
    expect(lib).toEqual(['Blocaje alto', 'Ejercicio o-suelto', 'Rondo de calentamiento']);
  });

  it('malicioso: ids, school_id, created_by, is_template y un id de atleta como key → se ignoran / se reescriben', async () => {
    const evil = validFile({
      id: 'x', school_id: VB,
      pack: { name: 'Paquete', sport: 'futbol', id: P_FUT, school_id: VB, created_by: OWNER },
      exercises: [{
        id: 't-fut-1', school_id: VB, created_by: OWNER, pack_id: P_FUT, is_template: true, times_used: 999,
        name: 'Con trampa', sport: 'futbol',
        board: {
          players: [{ key: ATHLETE_ID, slot_label: 'Arquero', x: 50, y: 90 }],
          arrows: [],
          frames: [
            { id: 'f1', duration_ms: 1000, players: [{ key: ATHLETE_ID, x: 50, y: 90 }, { key: `athlete:${ATHLETE_ID}`, x: 10, y: 10 }], ball: null, arrows: [] },
            { id: 'f2', duration_ms: 1000, players: [{ key: ATHLETE_ID, x: 50, y: 80 }], ball: null, arrows: [] },
          ],
        },
      }],
    });
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, evil);
    expect(r.status).toBe(201);
    const payload = db.rpcCalls[0].args;
    expect(payload.p_school_id).toBe(FUT); // la escuela de la sesión, nunca la del archivo
    expect(Object.keys(payload.p_payload.pack).sort()).toEqual(['description', 'name', 'sport', 'version']);
    for (const e of payload.p_payload.exercises) expect(Object.keys(e).every((k: string) => EXPORT_KEYS.includes(k))).toBe(true);
    const text = JSON.stringify(payload.p_payload);
    for (const k of ['school_id', 'created_by', 'pack_id', 'is_template', 'times_used', 't-fut-1', P_FUT, VB, OWNER]) expect(text).not.toContain(k);
    expect(text).not.toContain(ATHLETE_ID);
    const board = payload.p_payload.exercises[0].board;
    expect(board.players[0].key).toBe('slot#0');
    expect(board.frames[0].players).toEqual([{ key: 'slot#0', x: 50, y: 90 }]);
  });

  it('formato o versión desconocidos → 422 con la lista de errores', async () => {
    const a = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({ format: 'otra-app' }));
    expect(a.status).toBe(422);
    expect(a.body.details).toEqual([expect.stringMatching(/Formato desconocido/)]);
    const b = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({ version: 2 }));
    expect(b.body.details[0]).toMatch(/Versión de formato no soportada \(2\)/);
    const c = await call('POST', '/exercise-packs/import', COACH, FUT, [1, 2, 3]);
    expect(c.status).toBe(422);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('500 ejercicios → 422 (máximo 200) sin validar uno por uno', async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ name: `E${i}` }));
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({ exercises: many }));
    expect(r.status).toBe(422);
    expect(r.body.details).toEqual([expect.stringMatching(/Demasiados ejercicios \(500\): máximo 200/)]);
  });

  it('10 MB → 413 (nunca llega a validarse)', async () => {
    const huge = JSON.stringify(validFile({ pad: 'x'.repeat(10 * 1024 * 1024) }));
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, undefined, huge);
    expect(r.status).toBe(413);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('más de 4 MB declarados (bajo el límite global) → 413 de la ruta', async () => {
    const big = JSON.stringify(validFile({ pad: 'x'.repeat(4.5 * 1024 * 1024) }));
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, undefined, big);
    expect(r.status).toBe(413);
    expect(r.body.error).toMatch(/4 MB/);
  });

  it('deporte de otra escuela (voleibol en una escuela de fútbol) → 422, también por ejercicio', async () => {
    const a = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({ pack: { name: 'Vóley', sport: 'voleibol' } }));
    expect(a.status).toBe(422);
    expect(a.body.details.join('\n')).toMatch(/Voleibol, un deporte que tu escuela no tiene/);
    const b = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({
      exercises: [{ name: 'Bien' }, { name: 'Remate de vóley', sport: 'voleibol' }],
    }));
    expect(b.status).toBe(422);
    expect(b.body.details).toEqual([expect.stringMatching(/^Ejercicio 2 \(«Remate de vóley»\): es de Voleibol/)]);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('cuadros fuera de rango y deporte inexistente → 422 con cada error ubicado', async () => {
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({
      exercises: [
        { name: 'Fuera de la cancha', board: { players: [], arrows: [], frames: [{ id: 'f1', duration_ms: 50, players: [{ key: 'slot#0', x: 150, y: 20 }], ball: null, arrows: [] }] } },
        { name: 'Deporte raro', sport: 'quidditch' },
        { name: 'x'.repeat(200) },
      ],
    }));
    expect(r.status).toBe(422);
    const d = r.body.details.join('\n');
    expect(d).toMatch(/Ejercicio 1 \(«Fuera de la cancha»\): jugada: cuadro 1: duration_ms/);
    expect(d).toMatch(/Ejercicio 1 .*cuadro 1: jugador inválido/);
    expect(d).toMatch(/Ejercicio 2 .*sport inválido: quidditch/);
    expect(d).toMatch(/Ejercicio 3 .*name demasiado largo/);
    expect(r.body.summary).toMatchObject({ exercises: 3 });
  });

  it('HTML / script en los textos → 422 (nombre, objetivo, etiqueta, texto de la jugada, nombre del paquete)', async () => {
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, validFile({
      pack: { name: '<img src=x onerror=alert(1)>', sport: 'futbol' },
      exercises: [
        { name: '<script>alert(1)</script>' },
        { name: 'Link', objective: 'mira javascript:alert(1)' },
        { name: 'Etiqueta', tags: ['<b>x</b>'] },
        { name: 'Pizarra', board: { players: [{ key: 'slot#0', slot_label: '<i>9</i>', x: 1, y: 1 }], arrows: [{ type: 'text', x1: 5, y1: 5, x2: 5, y2: 5, color: 'white', text: '<svg onload=x>' }], frames: [] } },
        { name: 'Texto normal: 3 < 5 y 7 > 2' },
      ],
    }));
    expect(r.status).toBe(422);
    const d: string[] = r.body.details;
    expect(d.some((e) => /nombre del paquete trae HTML/.test(e))).toBe(true);
    expect(d.some((e) => /^Ejercicio 1 .*nombre trae HTML/.test(e))).toBe(true);
    expect(d.some((e) => /^Ejercicio 2 .*objetivo trae HTML/.test(e))).toBe(true);
    expect(d.some((e) => /^Ejercicio 3 .*etiqueta trae HTML/.test(e))).toBe(true);
    expect(d.some((e) => /^Ejercicio 4 .*texto de la jugada trae HTML/.test(e))).toBe(true);
    // Un «<» suelto en un texto normal no es HTML.
    expect(d.some((e) => /^Ejercicio 5/.test(e))).toBe(false);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('rol staff y padre no importan (403), ni siquiera la vista previa', async () => {
    expect((await call('POST', '/exercise-packs/import', STAFF, FUT, validFile())).status).toBe(403);
    expect((await call('POST', '/exercise-packs/import?dry_run=true', PARENT, FUT, validFile())).status).toBe(403);
  });

  it('errores de la RPC: 42501 → 403, CHECK de la base → 422 con su mensaje', async () => {
    db.rpcForce = { code: '42501', message: 'No puedes importar paquetes en esta escuela.' };
    expect((await call('POST', '/exercise-packs/import', COACH, FUT, validFile())).status).toBe(403);
    db.rpcForce = { code: '23514', message: 'new row violates check constraint' };
    const r = await call('POST', '/exercise-packs/import', COACH, FUT, validFile());
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/check constraint/);
    db.rpcForce = { code: 'PGRST202', message: 'Could not find the function public.import_exercise_pack' };
    expect((await call('POST', '/exercise-packs/import', COACH, FUT, validFile())).status).toBe(503);
  });
});
