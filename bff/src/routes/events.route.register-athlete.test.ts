/**
 * POST /school-tournaments/:id/register-athlete — la escuela inscribe a un atleta.
 * Spec docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md.
 * Cero red: auth, supabase y la RPC mockeados.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const h = vi.hoisted(() => ({
    schoolId: 'school-1' as string | null,
    owned: true,
    rpc: { data: null as any, error: null as any },
    rpcCalls: [] as any[],
    notifs: [] as any[],
}));

vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => { req.user = { id: 'admin-1' }; req.schoolId = h.schoolId; next(); },
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../utils/userClient', () => ({
    userClient: () => ({
        rpc: (fn: string, args: any) => { h.rpcCalls.push({ fn, args }); return Promise.resolve(h.rpc); },
    }),
}));
vi.mock('../config/supabase', () => {
    const builder = (table: string) => {
        const b: any = { _s: '' };
        for (const m of ['eq', 'neq', 'in', 'order', 'limit']) b[m] = () => b;
        b.select = (s: string) => { b._s = s; return b; };
        b.maybeSingle = () => Promise.resolve(
            table === 'events' && b._s === 'id' ? { data: h.owned ? { id: 'ev-1' } : null, error: null }
                : table === 'events' && b._s === 'title' ? { data: { title: 'Liga Sub-10' }, error: null }
                    : { data: null, error: null });
        b.insert = (rows: any[]) => { if (table === 'notifications') h.notifs.push(...rows); return Promise.resolve({ error: null }); };
        return b;
    };
    return { supabase: { from: (t: string) => builder(t) } };
});

const { default: router } = await import('./events.route');

const EVENTO = '11111111-1111-4111-8111-111111111111';
const CATEGORIA = '22222222-2222-4222-8222-222222222222';
const NINO = '33333333-3333-4333-8333-333333333333';
const PADRE = '44444444-4444-4444-8444-444444444444';
const cuerpo = { category_id: CATEGORIA, child_id: NINO };

let server: http.Server;
let base: string;
beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/events', router);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
    h.schoolId = 'school-1';
    h.owned = true;
    h.rpc = { data: null, error: null };
    h.rpcCalls = [];
    h.notifs = [];
});

const post = (body: unknown) => fetch(`${base}/api/v1/events/school-tournaments/${EVENTO}/register-athlete`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /school-tournaments/:id/register-athlete', () => {
    it('inscripción nueva con cobro → 201, llama la RPC con los ids y avisa al acudiente', async () => {
        h.rpc = { data: { registration_id: 'r1', already_registered: false, parent_id: PADRE, payment_id: 'p1', amount: 50000, is_paid: true }, error: null };
        const res = await post(cuerpo);
        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({ registration_id: 'r1', amount: 50000 });
        expect(h.rpcCalls).toEqual([{ fn: 'school_register_athlete_for_tournament',
            args: { p_event_id: EVENTO, p_category_id: CATEGORIA, p_child_id: NINO } }]);
        expect(h.notifs).toHaveLength(1);
        expect(h.notifs[0]).toMatchObject({ user_id: PADRE, category: 'tournament' });
        expect(h.notifs[0].message).toContain('cobro pendiente');
    });

    it('torneo gratis → el aviso no menciona cobro', async () => {
        h.rpc = { data: { registration_id: 'r2', already_registered: false, parent_id: PADRE, payment_id: null, amount: null, is_paid: false }, error: null };
        const res = await post(cuerpo);
        expect(res.status).toBe(201);
        expect(h.notifs[0].message).not.toContain('cobro');
    });

    it('ya inscrito → 200 y NO se vuelve a avisar', async () => {
        h.rpc = { data: { registration_id: 'r1', already_registered: true, parent_id: PADRE, is_paid: true }, error: null };
        const res = await post(cuerpo);
        expect(res.status).toBe(200);
        expect(h.notifs).toHaveLength(0);
    });

    it('atleta sin acudiente (torneo gratis) → inscribe pero no hay a quién avisar', async () => {
        h.rpc = { data: { registration_id: 'r3', already_registered: false, parent_id: null, payment_id: null, is_paid: false }, error: null };
        const res = await post(cuerpo);
        expect(res.status).toBe(201);
        expect(h.notifs).toHaveLength(0);
    });

    it('la RPC rechaza por permisos (42501) → 403 y sin aviso', async () => {
        h.rpc = { data: null, error: { code: '42501', message: 'No autorizado: este torneo no es de tu escuela.' } };
        const res = await post(cuerpo);
        expect(res.status).toBe(403);
        expect((await res.json()).error).toContain('No autorizado');
        expect(h.notifs).toHaveLength(0);
    });

    it('la RPC rechaza por regla de negocio (sin pagador) → 400 con el mensaje', async () => {
        h.rpc = { data: null, error: { code: 'P0001', message: 'El atleta no tiene un acudiente (pagador) asignado: asígnalo antes de inscribirlo a un torneo con cobro.' } };
        const res = await post(cuerpo);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('pagador');
        expect(h.notifs).toHaveLength(0);
    });

    it('torneo que no es de la escuela → 404 sin llamar la RPC', async () => {
        h.owned = false;
        const res = await post(cuerpo);
        expect(res.status).toBe(404);
        expect(h.rpcCalls).toHaveLength(0);
    });

    it('cuerpo inválido (child_id no es uuid) → 400 sin llamar la RPC', async () => {
        const res = await post({ category_id: CATEGORIA, child_id: 'no-es-uuid' });
        expect(res.status).toBe(400);
        expect(h.rpcCalls).toHaveLength(0);
    });

    it('sin escuela resuelta → 403', async () => {
        h.schoolId = null;
        const res = await post(cuerpo);
        expect(res.status).toBe(403);
        expect(h.rpcCalls).toHaveLength(0);
    });
});
