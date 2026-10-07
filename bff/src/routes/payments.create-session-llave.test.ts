/**
 * POST /api/v1/payments/create-session — llave pública y firma de Wompi salen
 * SIEMPRE del BFF y del MISMO par de credenciales, o no hay checkout.
 *
 * Caso real (Dynasty, 'aggregator', comercio 1298966): el 2026-10-05 una familia
 * entró por dev.sportmaps.co, el BFF de dev devolvió su pub_test_ (sandbox
 * 11981889) y la Edge Function firmó con el secret de producción → Wompi creó la
 * transacción en el sandbox con "La firma es inválida".
 *
 * Cero red y cero base: Supabase, auth y el resolver están moqueados.
 */
import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const ESCUELA = '2d509571-3238-4c04-ac3f-6dfe20539226';
const COBRO = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PADRE = 'pppppppp-0000-4000-8000-00000000000p';

const h = vi.hoisted(() => {
    const state = {
        tablas: {} as Record<string, Record<string, any>[]>,
        inserts: [] as Record<string, any>[],
        resolved: null as any,
    };
    function builder(tabla: string) {
        let filas = [...(state.tablas[tabla] ?? [])];
        let esUpdate = false;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            gte: () => api,
            lt: () => api,
            update: () => { esUpdate = true; return api; },
            insert: async (fila: any) => { state.inserts.push(fila); return { data: null, error: null }; },
            single: async () => ({ data: filas[0] ?? null, error: filas[0] ? null : { message: 'no rows' } }),
            maybeSingle: async () => ({ data: esUpdate ? null : (filas[0] ?? null), error: null }),
            then: (ok: any, ko: any) => Promise.resolve({ data: esUpdate ? null : filas, error: null }).then(ok, ko),
        };
        return api;
    }
    return { state, supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _s: any, n: any) => {
        req.user = { id: 'pppppppp-0000-4000-8000-00000000000p' };
        req.role = 'parent';
        req.schoolId = '2d509571-3238-4c04-ac3f-6dfe20539226';
        n();
    },
    requireRole: () => (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../services/wompi.service', async () => {
    const real = await vi.importActual<any>('../services/wompi.service');
    return { ...real, assertUserNotBlocked: vi.fn(async () => undefined) };
});
vi.mock('../services/mercadopago.service', () => ({ generateMpReference: vi.fn() }));
vi.mock('../services/payment-provider.resolver', () => ({ resolveProvider: vi.fn(async () => h.state.resolved) }));
vi.mock('../services/ocr.service', () => ({ extractReceipt: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: null, error: null }) } }) }));

import paymentsRouter from './payments.routes';

/** Llaves de ENV de la escuela en 'aggregator' (las de Dynasty en el BFF de prod). */
const ENV_PROD = {
    provider: 'wompi', publicKey: 'pub_prod_dynasty', accessToken: 'prv_prod_dynasty',
    integritySecret: 'prod_integrity_dynasty', webhookSecret: 'evt', sandbox: false, isDefault: true, source: 'env',
};

async function crearSesion() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/payments', paymentsRouter);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as AddressInfo;
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/payments/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: COBRO, preferredProvider: 'wompi' }),
        });
        return { status: res.status, json: await res.json() as any };
    } finally {
        server.close();
    }
}

const NODE_ENV_ORIGINAL = process.env.NODE_ENV;

beforeEach(() => {
    h.state.inserts = [];
    h.state.resolved = { ...ENV_PROD };
    h.state.tablas = {
        payments: [{
            id: COBRO, amount: 150000, status: 'pending', concept: 'Mensualidad 10/2026', child_id: null,
            user_id: null, parent_id: PADRE, school_id: ESCUELA, requires_review: false,
        }],
        school_settings: [{ school_id: ESCUELA, online_fee_pct: 5, fee_payer: 'parent' }],
        payment_links: [],
    };
    process.env.NODE_ENV = 'production';
});

afterEach(() => {
    process.env.NODE_ENV = NODE_ENV_ORIGINAL;
});

describe('create-session: llave y firma del mismo comercio, del BFF', () => {
    it("aggregator (ENV) con llave de producción → firma el BFF con el integrity secret de ESA llave", async () => {
        const { status, json } = await crearSesion();
        expect(status).toBe(201);
        expect(json.publicKey).toBe('pub_prod_dynasty');
        // 150.000 + 5 % = 157.500 COP = 15.750.000 centavos
        expect(json.amountInCents).toBe(15750000);
        const esperada = crypto.createHash('sha256')
            .update(`${json.reference}${json.amountInCents}COPprod_integrity_dynasty`).digest('hex');
        // Antes era null en 'aggregator' y el frontend iba a la Edge Function.
        expect(json.signature).toBe(esperada);
        expect(h.state.inserts).toHaveLength(1);
    });

    it('aggregator (ENV) con llave pub_test_ → 503 y NO se crea payment_link (el caso del 05-10, BFF de dev)', async () => {
        process.env.NODE_ENV = 'development';
        h.state.resolved = { ...ENV_PROD, publicKey: 'pub_test_sandbox', sandbox: true };
        const { status, json } = await crearSesion();
        expect(status).toBe(503);
        expect(json.code).toBe('wompi_llave_prueba_escuela_real');
        expect(json.error).toMatch(/app\.sportmaps\.co/);
        expect(h.state.inserts).toHaveLength(0);
    });

    it('BFF de producción con llave pub_test_ de una cuenta propia → 503', async () => {
        h.state.resolved = { ...ENV_PROD, source: 'school_direct', publicKey: 'pub_test_demo', sandbox: true };
        const { status, json } = await crearSesion();
        expect(status).toBe(503);
        expect(json.code).toBe('wompi_llave_prueba_en_produccion');
        expect(h.state.inserts).toHaveLength(0);
    });

    it('cuenta propia sandbox fuera de producción (Escuela Demo en dev) → sigue funcionando', async () => {
        process.env.NODE_ENV = 'development';
        h.state.resolved = { ...ENV_PROD, source: 'school_direct', publicKey: 'pub_test_demo', integritySecret: 'test_integrity', sandbox: true };
        const { status, json } = await crearSesion();
        expect(status).toBe(201);
        expect(json.publicKey).toBe('pub_test_demo');
        expect(json.signature).toBe(crypto.createHash('sha256')
            .update(`${json.reference}${json.amountInCents}COPtest_integrity`).digest('hex'));
    });

    it('sin integrity secret → 503 (no hay firma confiable; nunca cae a la Edge Function)', async () => {
        h.state.resolved = { ...ENV_PROD, integritySecret: null };
        const { status, json } = await crearSesion();
        expect(status).toBe(503);
        expect(json.code).toBe('wompi_sin_integrity_secret');
        expect(h.state.inserts).toHaveLength(0);
    });

    it('reuso de un link vigente → también devuelve llave y firma del BFF', async () => {
        h.state.tablas.payment_links = [{
            id: 'l1', payment_id: COBRO, status: 'pending', payment_provider: 'wompi',
            provider_reference: 'SCH-REUSO-1', wompi_reference: 'SCH-REUSO-1',
            gross_amount: 157500, base_amount: 150000, sportmaps_fee: 7500, fee_pct: 5,
            expires_at: '2099-01-01T00:00:00Z',
        }];
        const { status, json } = await crearSesion();
        expect(status).toBe(200);
        expect(json.reused).toBe(true);
        expect(json.publicKey).toBe('pub_prod_dynasty');
        expect(json.signature).toBe(crypto.createHash('sha256')
            .update('SCH-REUSO-115750000COPprod_integrity_dynasty').digest('hex'));
    });
});
