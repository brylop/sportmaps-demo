/**
 * Descuentos: «Quitar descuento» e informe (spec cobros-multiples §7.5, §9.4, F2).
 * Contador: 200 en el informe, 403 en revertir. Revertir dos veces → 409.
 * Cero red: base en memoria y RPC moqueada.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import type { EstadoFalso } from '../services/charge-batches.test-helpers';

const estado = vi.hoisted(() => ({ ref: null as unknown as EstadoFalso }));
vi.mock('../config/supabase', async () => {
    const h = await import('../services/charge-batches.test-helpers');
    estado.ref = h.estadoVacio();
    return { supabase: h.supabaseFalso(new Proxy({} as EstadoFalso, { get: (_t, k) => (estado.ref as any)[k] })) };
});
vi.mock('../utils/authCache', () => ({
    getCachedUser: (_t: string, resolve: any) => resolve(),
    getCachedMembership: (_u: string, _s: any, _t: string, resolve: any) => resolve(),
    invalidateUserAuthCache: () => { },
}));

const { default: router } = await import('./payment-adjustments.routes');
const { cobrosRateLimit } = await import('../middlewares/cobrosRateLimit');

const ESCUELA = 'e0000000-0000-4000-8000-000000000001';
const DUENO = 'a0000000-0000-4000-8000-000000000001';
const CONTADOR = 'a0000000-0000-4000-8000-000000000004';
const COACH = 'a0000000-0000-4000-8000-000000000005';
const AJUSTE = '70000000-0000-4000-8000-000000000001';
const NINO = 'c0000000-0000-4000-8000-000000000001';

let server: http.Server;
let base: string;
beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/payment-adjustments', router);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(async () => {
    await cobrosRateLimit.reset();
    estado.ref.tokens = Object.fromEntries([DUENO, CONTADOR, COACH].map((u) => [`tok-${u}`, { id: u, email: 'x@t.co' }]));
    estado.ref.erroresTabla = {};
    estado.ref.llamadasRpc = [];
    const m = (profile_id: string, role: string) => ({ profile_id, role, school_id: ESCUELA, status: 'active', branch_id: null, joined_at: '2026-01-01' });
    estado.ref.tablas = {
        schools: [{ id: ESCUELA, owner_id: DUENO }],
        school_members: [m(CONTADOR, 'accountant'), m(COACH, 'coach'), m(DUENO, 'owner')],
        platform_admins: [],
        profiles: [{ id: DUENO, full_name: 'Dueña' }],
        children: [{ id: NINO, full_name: 'Niño Uno', parent_id: null }],
        payments: [{ id: 'pay-1', school_id: ESCUELA, child_id: NINO, concept: 'Mensualidad octubre', payment_category: 'mensualidad', period_year: 2026, period_month: 10, status: 'pending', amount: 300000, list_amount: 723000, discount_amount: 423000 }],
        payment_adjustments: [
            { id: AJUSTE, school_id: ESCUELA, payment_id: 'pay-1', kind: 'descuento', origin: 'modal', reason_code: 'beca', basis: 'porcentaje', pct: 10, amount: 72300, created_by: DUENO, created_at: '2026-10-10T15:00:00Z' },
            { id: 'aj-2', school_id: ESCUELA, payment_id: 'pay-1', kind: 'condonacion_recargo', origin: 'modal', reason_code: 'condonacion_mora', basis: 'valor', pct: null, amount: 36150, created_by: DUENO, created_at: '2026-10-10T15:00:00Z' },
            { id: 'aj-otra', school_id: 'e0000000-0000-4000-8000-000000000002', payment_id: 'x', kind: 'descuento', reason_code: 'beca', amount: 1, created_at: '2026-10-10T15:00:00Z' },
        ],
    };
    estado.ref.rpc = {
        revert_payment_adjustment: () => ({ data: { reverted: AJUSTE, amount: 723000 } }),
    };
});

async function llamar(metodo: string, ruta: string, u: string, cuerpo?: unknown) {
    const r = await fetch(`${base}/api/v1/payment-adjustments${ruta}`, {
        method: metodo,
        headers: { 'content-type': 'application/json', 'x-school-id': ESCUELA, authorization: `Bearer tok-${u}` },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) as any };
}

describe('POST /:id/revert', () => {
    it('dueño: llama la RPC con la firma de §7.5', async () => {
        const r = await llamar('POST', `/${AJUSTE}/revert`, DUENO, { reason: 'Se aplicó por error' });
        expect(r.status).toBe(200);
        expect(estado.ref.llamadasRpc[0]).toEqual({
            nombre: 'revert_payment_adjustment',
            args: { p_school_id: ESCUELA, p_actor: DUENO, p_adjustment_id: AJUSTE, p_reason: 'Se aplicó por error' },
        });
    });

    it('contador y coach → 403', async () => {
        expect((await llamar('POST', `/${AJUSTE}/revert`, CONTADOR, { reason: 'motivo' })).status).toBe(403);
        expect((await llamar('POST', `/${AJUSTE}/revert`, COACH, { reason: 'motivo' })).status).toBe(403);
        expect(estado.ref.llamadasRpc).toHaveLength(0);
    });

    it('ya revertido (UNIQUE reverts_id) → 409 en español', async () => {
        estado.ref.rpc.revert_payment_adjustment = () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "payment_adjustments_reverts_id_key"' } });
        const r = await llamar('POST', `/${AJUSTE}/revert`, DUENO, { reason: 'otra vez' });
        expect(r.status).toBe(409);
        expect(r.body).toMatchObject({ code: 'YA_REVERTIDO', error: 'Ese descuento ya se quitó antes.' });
    });

    it('PAGO_EN_CURSO → 409; motivo corto → 422', async () => {
        estado.ref.rpc.revert_payment_adjustment = () => ({ error: { code: 'P0001', message: 'PAGO_EN_CURSO' } });
        expect((await llamar('POST', `/${AJUSTE}/revert`, DUENO, { reason: 'motivo' })).status).toBe(409);
        expect((await llamar('POST', `/${AJUSTE}/revert`, DUENO, { reason: 'x' })).status).toBe(422);
    });
});

describe('GET / (informe)', () => {
    it('contador: 200 con etiquetas, totales y solo la escuela propia', async () => {
        const r = await llamar('GET', '/?from=2026-10-01&to=2026-10-31', CONTADOR);
        expect(r.status).toBe(200);
        expect(r.body.items.map((i: any) => i.id).sort()).toEqual([AJUSTE, 'aj-2'].sort());
        const beca = r.body.items.find((i: any) => i.id === AJUSTE);
        expect(beca).toMatchObject({ label: 'Beca −10 %', created_by_name: 'Dueña', athlete_name: 'Niño Uno', over_50: true });
        expect(beca.payment.label).toBe('Mensualidad octubre 2026');
        expect(r.body.totals).toMatchObject({ descuentos: 72300, recargo_condonado: 36150 });
        expect(r.body.highlights).toContain(AJUSTE);
    });

    it('coach → 403', async () => {
        expect((await llamar('GET', '/', COACH)).status).toBe(403);
    });

    it('rango invertido → 422', async () => {
        expect((await llamar('GET', '/?from=2026-10-31&to=2026-10-01', DUENO)).status).toBe(422);
    });
});

describe('cupos por usuario (cobrosRateLimit)', () => {
    it('informe → lectura 120/min; quitar descuento → escritura 20/min', async () => {
        const h = { 'content-type': 'application/json', 'x-school-id': ESCUELA, authorization: `Bearer tok-${DUENO}` };
        const inf = await fetch(`${base}/api/v1/payment-adjustments`, { headers: h });
        expect(inf.status).toBe(200);
        expect(inf.headers.get('ratelimit-limit')).toBe('120');
        const rev = await fetch(`${base}/api/v1/payment-adjustments/${AJUSTE}/revert`, { method: 'POST', headers: h, body: JSON.stringify({ reason: 'Se aplicó por error' }) });
        expect(rev.status).toBe(200);
        expect(rev.headers.get('ratelimit-limit')).toBe('20');
    });
});
