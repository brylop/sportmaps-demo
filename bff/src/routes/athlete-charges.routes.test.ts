/**
 * Cobros de un atleta para el modal «Cobros y pagos» (spec cobros-multiples §9.1, F2):
 * open-charges y charge-suggestions. Cero red: base en memoria.
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

const { default: router } = await import('./athlete-charges.routes');
const { cobrosRateLimit } = await import('../middlewares/cobrosRateLimit');
const { todayInZone } = await import('../utils/businessDate');

const ESCUELA = 'e0000000-0000-4000-8000-000000000001';
const OTRA = 'e0000000-0000-4000-8000-000000000002';
const ADMIN = 'a0000000-0000-4000-8000-000000000002';
const COACH = 'a0000000-0000-4000-8000-000000000005';
const CONTADOR = 'a0000000-0000-4000-8000-000000000004';
const NINO = 'c0000000-0000-4000-8000-000000000001';
const NINO_OTRA = 'c0000000-0000-4000-8000-000000000002';
const PLAN = '50000000-0000-4000-8000-000000000001';
const HOY = todayInZone();

let server: http.Server;
let base: string;
beforeAll(async () => {
    const app = express();
    app.use('/api/v1/athletes', router);
    // Otra ruta bajo el mismo prefijo (bulkUpload): este router no debe interceptarla.
    app.get('/api/v1/athletes/otra-cosa', (_req, res) => { res.json({ ok: true }); });
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(async () => {
    await cobrosRateLimit.reset();
    estado.ref.tokens = Object.fromEntries([ADMIN, COACH, CONTADOR].map((u) => [`tok-${u}`, { id: u, email: 'x@t.co' }]));
    estado.ref.erroresTabla = {};
    estado.ref.llamadasRpc = [];
    const m = (profile_id: string, role: string) => ({ profile_id, role, school_id: ESCUELA, status: 'active', branch_id: null, joined_at: '2026-01-01' });
    estado.ref.tablas = {
        schools: [{ id: ESCUELA, owner_id: 'nadie' }],
        school_members: [m(ADMIN, 'admin'), m(COACH, 'coach'), m(CONTADOR, 'accountant')],
        platform_admins: [],
        children: [{ id: NINO, school_id: ESCUELA, full_name: 'Niño', parent_id: null }, { id: NINO_OTRA, school_id: OTRA }],
        enrollments: [{ id: 'en-1', school_id: ESCUELA, child_id: NINO, team_id: null, offering_plan_id: PLAN, monthly_fee: null, status: 'active', paused_at: null }],
        offering_plans: [{ id: PLAN, name: 'Plan Mensual', price: 723000, included_minutes_per_period: null }],
        teams: [],
        school_settings: [{ school_id: ESCUELA, early_payment_discount_enabled: true, early_payment_discount_days: 10, early_payment_discount_percentage: 10 }],
        payments: [
            { id: 'p-oct', school_id: ESCUELA, child_id: NINO, parent_id: null, status: 'pending', amount: 723000, amount_paid: 0, payment_category: 'mensualidad', period_year: Number(HOY.slice(0, 4)), period_month: Number(HOY.slice(5, 7)), due_date: HOY, created_at: `${HOY}T10:00:00Z`, period_uniqueness_exempt: false },
            { id: 'p-rev', school_id: ESCUELA, child_id: NINO, parent_id: null, status: 'awaiting_approval', amount: 80000, payment_category: 'torneo', concept: 'Torneo — Niño', due_date: HOY, created_at: '2026-01-01T00:00:00Z' },
            { id: 'p-desc', school_id: ESCUELA, child_id: NINO, parent_id: null, status: 'pending', amount: 300000, list_amount: 723000, discount_amount: 423000, payment_category: 'otro', concept: 'Uniforme — Niño', due_date: HOY, created_at: '2026-01-01T00:00:00Z' },
            { id: 'p-pagado', school_id: ESCUELA, child_id: NINO, status: 'paid', amount: 1 },
        ],
        payment_links: [{ payment_id: 'p-desc', status: 'pending', base_amount: 300000, expires_at: '2999-01-01T00:00:00Z' }],
        payment_installments: [],
        payment_adjustments: [],
        hour_bank_overage_charges: [],
        enrollment_categories: [],
    };
});

async function get(ruta: string, u: string) {
    const r = await fetch(`${base}/api/v1/athletes${ruta}`, { headers: { 'x-school-id': ESCUELA, authorization: `Bearer tok-${u}` } });
    return { status: r.status, body: await r.json().catch(() => null) as any };
}

describe('open-charges', () => {
    it('cobros abiertos con saldo, en revisión, pago en curso, aviso 50 % y pronto pago sugerido', async () => {
        const r = await get(`/child/${NINO}/open-charges`, ADMIN);
        expect(r.status).toBe(200);
        const porId = Object.fromEntries(r.body.items.map((i: any) => [i.id, i]));
        expect(Object.keys(porId).sort()).toEqual(['p-desc', 'p-oct', 'p-rev']);
        expect(porId['p-oct']).toMatchObject({ saldo: 723000, en_revision: false, seleccionable: true, label: expect.stringContaining('Mensualidad') });
        expect(porId['p-oct'].suggested_discount).toEqual({ basis: 'porcentaje', value: 10, reason_code: 'pronto_pago' });
        expect(porId['p-oct'].warnings).toContain('sin_acudiente');
        expect(porId['p-rev']).toMatchObject({ en_revision: true, seleccionable: false });
        expect(porId['p-desc']).toMatchObject({ pago_en_curso: true, seleccionable: false });
        expect(porId['p-desc'].warnings).toContain('descuento_total_mayor_50');
    });

    it('atleta de otra escuela → 404; tipo inválido → 422', async () => {
        expect((await get(`/child/${NINO_OTRA}/open-charges`, ADMIN)).status).toBe(404);
        expect((await get(`/perro/${NINO}/open-charges`, ADMIN)).status).toBe(422);
    });

    it('coach y contador → 403', async () => {
        expect((await get(`/child/${NINO}/open-charges`, COACH)).status).toBe(403);
        expect((await get(`/child/${NINO}/open-charges`, CONTADOR)).status).toBe(403);
    });

    it('no intercepta otras rutas del prefijo /athletes', async () => {
        const r = await fetch(`${base}/api/v1/athletes/otra-cosa`);
        expect(r.status).toBe(200);
    });
});

describe('charge-suggestions', () => {
    it('monto sugerido por plan (D4) y próximo mes libre', async () => {
        const r = await get(`/child/${NINO}/charge-suggestions`, ADMIN);
        expect(r.status).toBe(200);
        expect(r.body.enrollments[0]).toMatchObject({ enrollment_id: 'en-1', suggested_monthly_amount: 723000, amount_source: 'plan' });
        // El mes en curso ya tiene mensualidad → el siguiente.
        const y = Number(HOY.slice(0, 4)); const m = Number(HOY.slice(5, 7));
        expect(r.body.next_free_period).toEqual(m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 });
        expect(r.body.one_time_fees).toEqual([]);
    });

    it('la tarifa del atleta manda sobre el plan', async () => {
        estado.ref.tablas.enrollments[0].monthly_fee = 650000;
        const r = await get(`/child/${NINO}/charge-suggestions`, ADMIN);
        expect(r.body.enrollments[0]).toMatchObject({ suggested_monthly_amount: 650000, amount_source: 'tarifa_del_atleta' });
    });
});

describe('cupo de lectura por usuario (cobrosRateLimit)', () => {
    it('open-charges y charge-suggestions → 120/min; la ruta hermana (bulkUpload) no gasta cupo', async () => {
        const h = { 'x-school-id': ESCUELA, authorization: `Bearer tok-${ADMIN}` };
        const a = await fetch(`${base}/api/v1/athletes/child/${NINO}/open-charges`, { headers: h });
        expect(a.headers.get('ratelimit-limit')).toBe('120');
        const b = await fetch(`${base}/api/v1/athletes/child/${NINO}/charge-suggestions`, { headers: h });
        expect(b.headers.get('ratelimit-remaining')).toBe('118');
        const otra = await fetch(`${base}/api/v1/athletes/otra-cosa`, { headers: h });
        expect(otra.status).toBe(200);
        expect(otra.headers.get('ratelimit-limit')).toBeNull();
    });
});
