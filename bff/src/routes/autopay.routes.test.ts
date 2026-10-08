/**
 * Rutas del débito automático F3 (familia y escuela).
 *
 * Las reglas de negocio las prueban las RPC en el gemelo (supabase/tests/autopay
 * A01-A06). Aquí se fija lo que es del BFF:
 *   · cálculos que la UI muestra (total con recargo = la misma cuenta de la base,
 *     tope sugerido, etiqueta y vencimiento de la tarjeta, HMAC del celular);
 *   · guardas: solo familias de la escuela piden setup; solo el admin ve el panel;
 *     no se ofrece sin pasarela conectada; Nequi sin llave HMAC no arranca;
 *   · traducción de respuestas de las RPC a HTTP y a español;
 *   · consentId 'reuse' toma el consentimiento del medio y falla si no hay.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import crypto from 'crypto';

type Fila = Record<string, any>;
const st = vi.hoisted(() => ({
    tablas: {} as Record<string, Fila[]>,
    rpc: {} as Record<string, (args: any) => any>,
    rpcCalls: [] as { fn: string; args: any }[],
    inserts: [] as { tabla: string; fila: Fila }[],
    creds: null as any,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(st.tablas[tabla] ?? [])];
        let modo: 'select' | 'update' | 'insert' = 'select';
        let cambios: Fila = {};
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { if (!c.includes('.')) filas = filas.filter(f => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter(f => vs.includes(f[c])); return api; },
            neq: (c: string, v: any) => { filas = filas.filter(f => f[c] !== v); return api; },
            not: () => api, is: () => api, or: () => api, gte: () => api,
            order: () => api, limit: () => api,
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            single: async () => ({ data: modo === 'insert' ? { id: 'nuevo-id' } : filas[0] ?? null, error: null }),
            update: (c: Fila) => { modo = 'update'; cambios = c; return api; },
            insert: (fila: Fila) => { modo = 'insert'; st.inserts.push({ tabla, fila }); return api; },
            then: (ok: any, ko: any) => {
                if (modo === 'update') for (const f of filas) Object.assign(f, cambios);
                return Promise.resolve({ data: modo === 'select' ? filas : null, error: null }).then(ok, ko);
            },
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (fn: string, args: any) => {
                st.rpcCalls.push({ fn, args });
                const h = st.rpc[fn];
                return { data: h ? h(args) : { ok: true }, error: null };
            },
        },
    };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        const id = req.header('x-test-user');
        if (!id) return res.status(401).json({ error: 'no' });
        req.user = { id, email: `${id}@qa.co` };
        next();
    },
}));

vi.mock('../services/payment-provider.resolver', () => ({
    resolveProvider: async () => st.creds,
}));

vi.mock('../services/wompi.service', async (orig) => {
    const real: any = await orig();
    return {
        ...real,
        wompiCredsFrom: (r: any) => r,
        fetchAcceptanceTokens: async () => ({ ok: true, tokens: { acceptanceToken: 'acc', personalDataAuthToken: 'pda', acceptancePermalink: 'https://x/a.pdf', personalDataPermalink: 'https://x/b.pdf', fetchedAt: 0 } }),
        fetchMerchantId: async () => 'M1',
        createPaymentSource: async () => ({ ok: true, paymentSourceId: 55, status: 'AVAILABLE' }),
        voidPaymentSource: async () => ({ ok: true }),
        createNequiToken: async () => ({ ok: true, tokenId: 'nequi_test_1', status: 'PENDING' }),
        getNequiTokenStatus: async () => 'PENDING',
    };
});

import router, { totalConRecargo, topeSugerido, etiquetaTarjeta, vencimientoTarjeta, phoneHmac, hoyBogota } from './autopay.routes';

const SCHOOL = '11111111-1111-4111-8111-111111111111';
const PADRE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EXTRANO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const HIJO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TOKEN = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SUB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

let base = '';
let server: http.Server;
beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/autopay', router);
    server = http.createServer(app);
    await new Promise<void>(r => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/autopay`;
});
afterAll(() => server.close());

beforeEach(() => {
    st.tablas = {
        children: [{ id: HIJO, full_name: 'Sofía Gómez', parent_id: PADRE }],
        enrollments: [{ school_id: SCHOOL, user_id: null, child_id: HIJO, status: 'active' }],
        school_settings: [{ school_id: SCHOOL, autopay_enabled: true, autopay_debits_paused: false, autopay_surcharge_mode: 'same_as_online', autopay_days_before_due: 3, online_fee_pct: 5 }],
        schools: [{ id: SCHOOL, name: 'Club Demo', owner_id: 'own' }],
        profiles: [{ id: PADRE, email: 'padre@qa.co', full_name: 'Padre QA' }],
        payment_consents: [],
        payment_tokens: [],
    };
    st.rpc = { autopay_admin_school_ids_for: ({ p_user }) => (p_user === 'admin' ? [SCHOOL] : []) };
    st.rpcCalls = [];
    st.inserts = [];
    st.creds = { publicKey: 'pub_test_x', privateKey: 'prv_test_x', integritySecret: 'i', eventsSecret: 'e', sandbox: true };
    delete process.env.AUTOPAY_PHONE_HMAC_KEY;
});

const pedir = (path: string, user: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'x-test-user': user, ...(init.headers ?? {}) } });

describe('cálculos que ve la familia', () => {
    it('total con recargo = autopay_payment_total (redondeo y default 3 %)', () => {
        expect(totalConRecargo(150000, { surchargeMode: 'same_as_online', feePct: 5 })).toBe(157500);
        expect(totalConRecargo(150000, { surchargeMode: 'none', feePct: 5 })).toBe(150000);
        expect(totalConRecargo(150001, {})).toBe(154501);
    });
    it('tope sugerido: +20 % redondeado a miles hacia arriba', () => {
        expect(topeSugerido(157500)).toBe(189000);
        expect(topeSugerido(154501)).toBe(186000);
        expect(topeSugerido(null)).toBeNull();
    });
    it('etiqueta y vencimiento de tarjeta', () => {
        expect(etiquetaTarjeta('VISA', '4242')).toBe('Visa •••• 4242');
        expect(etiquetaTarjeta('MASTERCARD', '8812')).toBe('Mastercard •••• 8812');
        expect(etiquetaTarjeta(undefined, '1111')).toBe('Tarjeta •••• 1111');
        expect(vencimientoTarjeta('2', '28')).toBe('2028-02-29');
        expect(vencimientoTarjeta('13', '29')).toBeNull();
    });
    it('el celular se guarda como HMAC, no como sha256 pelado (prueba 13)', () => {
        const h = phoneHmac('3001234567', 'k');
        expect(h).not.toBe(crypto.createHash('sha256').update('3001234567').digest('hex'));
        expect(h).toBe(phoneHmac('3001234567', 'k'));
    });
    it('hoy en Bogotá (UTC-5)', () => {
        expect(hoyBogota(new Date('2026-10-08T03:00:00Z'))).toBe('2026-10-07');
    });
});

describe('familia', () => {
    it('setup: solo familias de la escuela', async () => {
        expect((await pedir(`/setup?schoolId=${SCHOOL}`, EXTRANO)).status).toBe(403);
        const r = await pedir(`/setup?schoolId=${SCHOOL}`, PADRE);
        expect(r.status).toBe(200);
        expect(await r.json()).toMatchObject({ publicKey: 'pub_test_x', sandbox: true, acceptance: { acceptanceToken: 'acc' } });
    });

    it('setup: sin pasarela de la escuela → 409, nunca llaves de otro', async () => {
        st.creds = null;
        const r = await pedir(`/setup?schoolId=${SCHOOL}`, PADRE);
        expect(r.status).toBe(409);
        expect((await r.json()).code).toBe('gateway_unavailable');
    });

    it('setup: la escuela no lo ofrece → 409', async () => {
        st.tablas.school_settings[0].autopay_enabled = false;
        expect((await pedir(`/setup?schoolId=${SCHOOL}`, PADRE)).status).toBe(409);
    });

    it('nequi: número inválido → 400; sin llave HMAC → 503 (fail-closed)', async () => {
        const body = { schoolId: SCHOOL, acceptanceToken: 'acc-0123456789', personalDataAuthToken: 'pda-0123456789' };
        expect((await pedir('/nequi', PADRE, { method: 'POST', body: JSON.stringify({ ...body, phone: '12345' }) })).status).toBe(400);
        expect((await pedir('/nequi', PADRE, { method: 'POST', body: JSON.stringify({ ...body, phone: '300 123 4567' }) })).status).toBe(503);
    });

    it('nequi: registra el token pendiente con últimos 4 y HMAC (nunca el número)', async () => {
        process.env.AUTOPAY_PHONE_HMAC_KEY = 'llave-qa';
        st.rpc.autopay_register_token = () => ({ ok: true, token_id: TOKEN });
        const r = await pedir('/nequi', PADRE, { method: 'POST', body: JSON.stringify({ schoolId: SCHOOL, phone: '300 123 4567', acceptanceToken: 'acc-0123456789', personalDataAuthToken: 'pda-0123456789' }) });
        expect(r.status).toBe(201);
        expect(await r.json()).toMatchObject({ tokenId: TOKEN, label: 'Nequi •••• 4567', status: 'pending_authorization' });
        const reg = st.rpcCalls.find(c => c.fn === 'autopay_register_token')!.args;
        expect(reg).toMatchObject({ p_payment_method_type: 'NEQUI', p_status: 'pending_authorization', p_last_four: '4567', p_provider_token_id: 'nequi_test_1' });
        expect(JSON.stringify(reg)).not.toContain('3001234567');
        expect(reg.p_phone_hmac).toBe(phoneHmac('3001234567', 'llave-qa'));
        const consent = st.inserts.find(i => i.tabla === 'payment_consents')!.fila;
        expect(consent).toMatchObject({ user_id: PADRE, acceptance_token: 'acc-0123456789' });
    });

    it('tarjeta: crea la fuente y la registra disponible con comercio y etiqueta', async () => {
        st.rpc.autopay_register_token = () => ({ ok: true, token_id: TOKEN });
        const r = await pedir('/cards', PADRE, { method: 'POST', body: JSON.stringify({ schoolId: SCHOOL, cardToken: 'tok_test_123456', brand: 'VISA', lastFour: '4242', expMonth: '12', expYear: '29', acceptanceToken: 'acc-0123456789', personalDataAuthToken: 'pda-0123456789' }) });
        expect(r.status).toBe(201);
        const reg = st.rpcCalls.find(c => c.fn === 'autopay_register_token')!.args;
        expect(reg).toMatchObject({ p_status: 'available', p_provider_payment_source_id: 55, p_provider_merchant_id: 'M1', p_display_label: 'Visa •••• 4242', p_expires_at: '2029-12-31' });
    });

    it('alta: acepta ids que Postgres acepta aunque no sean RFC 4122 (bug hallado en el E2E)', async () => {
        st.tablas.payment_consents = [{ id: 'f0000000-0000-4000-8000-000000000001', user_id: PADRE, payment_token_id: TOKEN }];
        st.rpc.autopay_create_subscription = () => ({ ok: true, subscription_id: SUB });
        const r = await pedir('/subscriptions', PADRE, { method: 'POST', body: JSON.stringify({ schoolId: SCHOOL, tokenId: TOKEN, consentId: 'reuse', athletes: [{ childId: '00000000-0000-4000-c000-000000000001', maxAmount: 189000 }] }) });
        expect(r.status).toBe(201);
    });

    it('alta: consentId reuse sin consentimiento previo → 409', async () => {
        const r = await pedir('/subscriptions', PADRE, { method: 'POST', body: JSON.stringify({ schoolId: SCHOOL, tokenId: TOKEN, consentId: 'reuse', athletes: [{ childId: HIJO, maxAmount: 189000 }] }) });
        expect(r.status).toBe(409);
    });

    it('alta: un resultado por deportista con el código de la RPC', async () => {
        st.tablas.payment_consents = [{ id: 'f0000000-0000-4000-8000-000000000001', user_id: PADRE, payment_token_id: TOKEN }];
        const OTRO = '99999999-9999-4999-8999-999999999999';
        st.rpc.autopay_create_subscription = (a: any) => (a.p_child_id === HIJO ? { ok: true, subscription_id: SUB } : { ok: false, error: 'already_subscribed' });
        const r = await pedir('/subscriptions', PADRE, { method: 'POST', body: JSON.stringify({ schoolId: SCHOOL, tokenId: TOKEN, consentId: 'reuse', includeCurrentPeriod: true, athletes: [{ childId: HIJO, maxAmount: 189000 }, { childId: OTRO, maxAmount: 189000 }] }) });
        expect(r.status).toBe(201);
        expect((await r.json()).results).toEqual([
            { key: `child:${HIJO}`, ok: true, subscriptionId: SUB },
            { key: `child:${OTRO}`, ok: false, error: 'already_subscribed' },
        ]);
        const call = st.rpcCalls.find(c => c.fn === 'autopay_create_subscription')!.args;
        expect(call).toMatchObject({ p_user_id: PADRE, p_consent_id: 'f0000000-0000-4000-8000-000000000001', p_include_current_period: true });
    });

    it('cambio: cobro doble → 409 con el motivo en español', async () => {
        st.rpc.autopay_update_subscription = () => ({ ok: false, error: 'suspended_duplicate_charge' });
        const r = await pedir(`/subscriptions/${SUB}`, PADRE, { method: 'PATCH', body: JSON.stringify({ maxAmount: 300000 }) });
        expect(r.status).toBe(409);
        expect((await r.json()).error).toContain('pago doble');
    });

    it('«ya pagué» de un débito en proceso → 409', async () => {
        st.rpc.autopay_parent_skip = () => ({ ok: false, error: 'cycle_not_skippable', state: 'in_progress' });
        expect((await pedir(`/cycles/${SUB}/skip`, PADRE, { method: 'POST', body: '{}' })).status).toBe(409);
    });

    it('cancelar: si la fuente quedó sin uso se anula', async () => {
        st.rpc.autopay_cancel_subscription = () => ({ ok: true, token_id: TOKEN, token_unused: true });
        st.tablas.payment_tokens = [{ id: TOKEN, school_id: SCHOOL, status: 'available', provider_payment_source_id: 55 }];
        expect((await pedir(`/subscriptions/${SUB}/cancel`, PADRE, { method: 'POST', body: '{}' })).status).toBe(200);
        expect(st.rpcCalls.find(c => c.fn === 'autopay_mark_token')!.args).toMatchObject({ p_token_id: TOKEN, p_status: 'voided' });
    });
});

describe('escuela', () => {
    it('panel: solo la administración de la escuela', async () => {
        expect((await pedir(`/school/${SCHOOL}/panel`, PADRE)).status).toBe(403);
    });

    it('ajustes: no se ofrece sin pasarela conectada', async () => {
        st.tablas.school_settings[0].autopay_enabled = false;
        st.creds = null;
        const r = await pedir(`/school/${SCHOOL}/settings`, 'admin', { method: 'POST', body: JSON.stringify({ offered: true, paused: false, surchargeMode: 'none', daysBeforeDue: 3 }) });
        expect(r.status).toBe(409);
    });

    it('ajustes: pausar avisa a cada familia activa una vez', async () => {
        st.tablas.recurring_subscriptions = [
            { school_id: SCHOOL, status: 'active', payer_user_id: PADRE },
            { school_id: SCHOOL, status: 'active', payer_user_id: PADRE },
            { school_id: SCHOOL, status: 'active', payer_user_id: EXTRANO },
        ];
        const r = await pedir(`/school/${SCHOOL}/settings`, 'admin', { method: 'POST', body: JSON.stringify({ offered: true, paused: true, surchargeMode: 'same_as_online', daysBeforeDue: 3 }) });
        expect(await r.json()).toEqual({ ok: true, notified: 2 });
        expect(st.inserts.filter(i => i.tabla === 'notifications')).toHaveLength(2);
    });
});
