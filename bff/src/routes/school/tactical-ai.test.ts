/**
 * POST /api/v1/school/tactical/analyze — permisos, caché, cupo y fallas del
 * modelo. Supabase y llm.service van MOCKEADOS: ninguna prueba llama al modelo
 * ni a la base. La respuesta "del modelo" es el fixture grabado de fútbol.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Fila = Record<string, any>;
const st = vi.hoisted(() => ({
  tablas: {} as Record<string, Fila[]>,
  rpcs: [] as { name: string; args: any }[],
  balance: { used: 0, free_quota: 15, purchased: 0 },
  inserts: [] as { tabla: string; fila: Fila }[],
}));

vi.mock('../../config/supabase', () => {
  function builder(tabla: string) {
    let filas: Fila[] = [...(st.tablas[tabla] ?? [])];
    const api: any = {
      select: () => api,
      eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
      maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
      insert: async (fila: Fila) => { st.inserts.push({ tabla, fila }); return { error: null }; },
      then: (ok: any, ko: any) => Promise.resolve({ data: filas, error: null }).then(ok, ko),
    };
    return api;
  }
  const json = (ok: boolean) => {
    const b = st.balance;
    const free = Math.max(b.free_quota - b.used, 0);
    const paid = Math.max(b.purchased - Math.max(b.used - b.free_quota, 0), 0);
    return { ok, remaining: free + paid, free_remaining: free, paid_remaining: paid, used: b.used, free_quota: b.free_quota, period: '2026-10', needs_purchase: free + paid === 0 };
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async (name: string, args: any) => {
        st.rpcs.push({ name, args });
        const b = st.balance;
        if (name === 'consume_tactical_ai_credit') {
          const free = b.free_quota - b.used;
          const paid = b.purchased - Math.max(b.used - b.free_quota, 0);
          if (free > 0 || paid > 0) { b.used += 1; return { data: json(true), error: null }; }
          return { data: json(false), error: null };
        }
        if (name === 'refund_tactical_ai_credit') { b.used = Math.max(0, b.used - 1); return { data: json(true), error: null }; }
        if (name === 'tactical_ai_balance') return { data: json(true), error: null };
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      },
    },
  };
});

vi.mock('../../middlewares/authMiddleware', async () => {
  const actual = await vi.importActual<any>('../../middlewares/authMiddleware');
  return {
    ...actual,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = { id: String(req.headers['x-user'] || 'coach-1') };
      req.schoolId = String(req.headers['x-school'] || 'esc-1');
      req.role = String(req.headers['x-role'] || 'coach');
      next();
    },
  };
});

const llm = vi.hoisted(() => ({ calls: [] as any[], impl: null as null | ((p: any) => Promise<any>) }));
vi.mock('../../services/llm.service', () => ({
  generarJsonEstructurado: async (p: any) => { llm.calls.push(p); return llm.impl!(p); },
  fallasDeError: (err: any) => (Array.isArray(err?.fallas) ? err.fallas : []),
}));

const { default: router } = await import('./tactical-ai');
const { samplePlay, FAKE_ROSTER_NAMES, fakeKey } = await import('./__fixtures__/tacticalAiPlays');
const { anonymizePlay, boardHash, parseAnalyzeInput, validateAiResult } = await import('./tacticalAiShapes');

const recorded = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'tacticalAi.recorded.json'), 'utf8'));
const TEAM = '11111111-2222-4333-8444-555555555555';

let base = '';
let server: http.Server;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/v1/school', router);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server?.close(); });

beforeEach(() => {
  st.tablas = {
    teams: [{ id: TEAM, school_id: 'esc-1' }, { id: '99999999-2222-4333-8444-555555555555', school_id: 'esc-2' }],
    school_athletes: FAKE_ROSTER_NAMES.map((full_name) => ({ school_id: 'esc-1', enrolled_team_id: TEAM, full_name })),
    tactical_ai_analyses: [],
  };
  st.rpcs = [];
  st.inserts = [];
  st.balance = { used: 0, free_quota: 15, purchased: 0 };
  llm.calls = [];
  llm.impl = async () => ({ texto: recorded.futbol.texto, provider: 'claude', model: 'claude-sonnet-5-5', tokens: { input: 1400, output: 5900, cacheRead: 0, cacheWrite: 3600 } });
});

let ipSeq = 0;
async function post(body: unknown, headers: Record<string, string> = {}) {
  // Usuario distinto por petición: el rate limit por usuario no interfiere.
  const res = await fetch(`${base}/api/v1/school/tactical/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user': `u-${++ipSeq}`, ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() as any };
}

describe('permisos', () => {
  it('padre (rol sin permiso táctico) → 403 y no se toca cupo ni modelo', async () => {
    const r = await post(samplePlay('futbol'), { 'x-role': 'parent' });
    expect(r.status).toBe(403);
    expect(st.rpcs).toEqual([]);
    expect(llm.calls).toHaveLength(0);
  });
  it('atleta → 403', async () => {
    expect((await post(samplePlay('futbol'), { 'x-role': 'athlete' })).status).toBe(403);
  });
  it('coach de OTRA escuela con un equipo ajeno → 403', async () => {
    const r = await post(samplePlay('futbol'), { 'x-school': 'esc-2' });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/no es de tu escuela/);
    expect(llm.calls).toHaveLength(0);
  });
  it('jugada inválida → 422 sin llamar al modelo', async () => {
    const r = await post({ ...samplePlay('futbol'), frames: 'x' });
    expect(r.status).toBe(422);
    expect(llm.calls).toHaveLength(0);
  });
});

describe('análisis', () => {
  it('éxito: descuenta 1, guarda la caché anónima y devuelve claves reales', async () => {
    const r = await post(samplePlay('futbol'));
    expect(r.status).toBe(200);
    expect(r.body.cached).toBe(false);
    expect(r.body.balance.remaining).toBe(14);
    expect(st.rpcs.map((x) => x.name)).toEqual(['consume_tactical_ai_credit']);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0].uso).toEqual({ schoolId: 'esc-1', feature: 'pizarra_ia' });
    // Nada de atletas en lo que se mandó al modelo.
    const sent = `${llm.calls[0].system}\n${llm.calls[0].user}`;
    expect(sent).not.toMatch(/athlete:|aaaa-4bbb/);
    for (const n of FAKE_ROSTER_NAMES) expect(sent).not.toContain(n);
    expect(sent).not.toContain('Sofi');
    // Caché: anónima (p1/r1), con tokens.
    const ins = st.inserts.find((i) => i.tabla === 'tactical_ai_analyses')!;
    expect(ins.fila.board_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ins.fila.result)).not.toMatch(/athlete:/);
    expect(ins.fila.input_tokens).toBe(5000);
    expect(ins.fila.output_tokens).toBe(5900);
    const keys = r.body.result.contraataques.flatMap((s: any) => s.frames.flatMap((f: any) => f.players.map((p: any) => p.key)));
    expect(keys.some((k: string) => k === fakeKey(0))).toBe(true);
    expect(keys.some((k: string) => k.startsWith('rival:'))).toBe(true);
  });

  it('caché por hash: misma jugada → no llama al modelo NI descuenta cupo', async () => {
    const body = samplePlay('futbol');
    const { input } = parseAnalyzeInput(body);
    const { play, keyMap } = anonymizePlay(input!, new Set());
    const { result } = validateAiResult(recorded.futbol.texto, { sport: 'futbol', ownKeys: new Set(keyMap.keys()) });
    st.tablas.tactical_ai_analyses = [{ school_id: 'esc-1', board_hash: boardHash(play), result }];
    const r = await post(body);
    expect(r.status).toBe(200);
    expect(r.body.cached).toBe(true);
    expect(llm.calls).toHaveLength(0);
    expect(st.rpcs.map((x) => x.name)).toEqual(['tactical_ai_balance']);
    expect(st.balance.used).toBe(0);
  });

  it('la caché es por escuela: el mismo hash de otra escuela no sirve', async () => {
    const body = samplePlay('futbol');
    const { play } = anonymizePlay(parseAnalyzeInput(body).input!, new Set());
    st.tablas.tactical_ai_analyses = [{ school_id: 'esc-2', board_hash: boardHash(play), result: { lectura: 'ajena' } }];
    const r = await post(body);
    expect(r.body.cached).toBe(false);
    expect(llm.calls).toHaveLength(1);
  });

  it('cupo agotado → 402 needs_purchase SIN llamar al modelo', async () => {
    st.balance = { used: 15, free_quota: 15, purchased: 0 };
    const r = await post(samplePlay('futbol'));
    expect(r.status).toBe(402);
    expect(r.body.needs_purchase).toBe(true);
    expect(r.body.balance.remaining).toBe(0);
    expect(llm.calls).toHaveLength(0);
  });

  it('con paquete comprado sigue después del cupo gratis', async () => {
    st.balance = { used: 15, free_quota: 15, purchased: 50 };
    const r = await post(samplePlay('futbol'));
    expect(r.status).toBe(200);
    expect(r.body.balance.paid_remaining).toBe(49);
  });

  it('el modelo falla → 502, se devuelve el análisis (refund)', async () => {
    llm.impl = async () => { const e: any = new Error('todos fallaron'); e.fallas = [{ proveedor: 'claude', error: 'claude_500', ms: 10 }]; throw e; };
    const r = await post(samplePlay('futbol'));
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/No se descontó/);
    expect(st.rpcs.map((x) => x.name)).toEqual(['consume_tactical_ai_credit', 'refund_tactical_ai_credit']);
    expect(st.balance.used).toBe(0);
  });

  it('timeout de todos los proveedores → 504', async () => {
    llm.impl = async () => { const e: any = new Error('x'); e.fallas = [{ proveedor: 'claude', error: 'Request timed out.', ms: 75000 }]; throw e; };
    const r = await post(samplePlay('futbol'));
    expect(r.status).toBe(504);
    expect(r.body.error).toMatch(/tardó demasiado/);
    expect(st.balance.used).toBe(0);
  });

  it('salida inválida del modelo → 502 con refund y sin caché', async () => {
    llm.impl = async () => ({ texto: 'lo siento, no puedo', provider: 'claude', model: 'm', tokens: null });
    const r = await post(samplePlay('futbol'));
    expect(r.status).toBe(502);
    expect(r.body.detalle).toBe('json_invalido');
    expect(st.balance.used).toBe(0);
    expect(st.inserts).toHaveLength(0);
  });

  it('migración sin aplicar (RPC inexistente) → 503 claro', async () => {
    const real = (await import('../../config/supabase')).supabase as any;
    const orig = real.rpc;
    real.rpc = async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.consume_tactical_ai_credit' } });
    try {
      const r = await post(samplePlay('futbol'));
      expect(r.status).toBe(503);
      expect(llm.calls).toHaveLength(0);
    } finally { real.rpc = orig; }
  });
});

describe('rate limit por usuario', () => {
  it('el 7.º análisis del mismo usuario en un minuto → 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${base}/api/v1/school/tactical/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': 'mismo' }, body: JSON.stringify({ team_id: 'x' }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 6).every((s) => s === 422)).toBe(true);
    expect(statuses[6]).toBe(429);
  });
});
