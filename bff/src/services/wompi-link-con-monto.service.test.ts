/**
 * Link de Wompi con el monto exacto de un cobro (wompi-link-con-monto).
 *
 * Lo que se fija:
 *   · la firma con expiration-time sigue la fórmula de la doc de Wompi
 *     (referencia + monto + moneda + expiración + secreto) y el ejemplo oficial;
 *   · la URL lleva el monto del servidor (amount + online_fee_pct), la
 *     referencia SCH-* de payment_links y vuelve a /p/:token en app.sportmaps.co;
 *   · idempotente: dos llamadas = misma referencia, una sola payment_links; y si
 *     otro BFF gana la carrera (23505) se reusa la suya;
 *   · sin credenciales, en sandbox o con llaves de ENV sin el flag → no hay link
 *     (quien llama sigue con el link estático / transferencia);
 *   · cero llamadas de red (el link es una URL firmada, no se crea nada en Wompi).
 */

import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Fila[]>,
    resolved: null as any,
    inserts: [] as { tabla: string; fila: Fila }[],
    bloqueado: false,
    /** Simula otro BFF que inserta su 'pending' justo antes que nosotros. */
    competidor: null as Fila | null,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let modo: 'select' | 'update' = 'select';
        let cambios: Fila = {};
        const resultado = () => {
            if (modo === 'update') {
                for (const f of filas) Object.assign(f, cambios);
                return { data: null, error: null };
            }
            return { data: filas, error: null };
        };
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter(f => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter(f => vs.includes(f[c])); return api; },
            gte: (c: string, v: any) => { filas = filas.filter(f => f[c] >= v); return api; },
            lt: (c: string, v: any) => { filas = filas.filter(f => f[c] < v); return api; },
            order: () => api,
            limit: () => api,
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            update: (c: Fila) => { modo = 'update'; cambios = c; return api; },
            insert: async (fila: Fila) => {
                const lista = (estado.tablas[tabla] ??= []);
                if (tabla === 'payment_links' && estado.competidor) {
                    lista.push(estado.competidor);
                    estado.competidor = null;
                }
                // uq_payment_links_one_pending_per_payment
                if (tabla === 'payment_links'
                    && lista.some(f => f.payment_id === fila.payment_id && f.status === 'pending')) {
                    return { data: null, error: { code: '23505', message: 'duplicate key' } };
                }
                estado.inserts.push({ tabla, fila });
                lista.push({ ...fila });
                return { data: null, error: null };
            },
            then: (ok: any, ko: any) => Promise.resolve(resultado()).then(ok, ko),
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (nombre: string) => {
                if (nombre === 'cobro_enlace_publico_emitir') {
                    return { data: [{ enlace_token: 'AbCdEfGhIjKlMnOpQrStUvWx', vence_en: '2026-11-03T00:00:00Z' }], error: null };
                }
                if (nombre === 'school_is_operational') return { data: true, error: null };
                if (nombre === 'is_user_payment_blocked') return { data: { blocked: estado.bloqueado }, error: null };
                return { data: null, error: null };
            },
        },
    };
});

vi.mock('./payment-provider.resolver', () => ({
    resolveProvider: vi.fn(async () => estado.resolved),
}));

import { crearLinkWompiConMonto } from './wompi-link-con-monto.service';
import { buildWebCheckoutUrl, signIntegrityWithExpiration } from './wompi.service';

const ESCUELA = '2d509571-0000-4000-8000-000000000001';
const COBRO = 'aaaaaaaa-0000-4000-8000-00000000000a';
const SECRETO = 'prod_integrity_x';

const CREDS_DIRECT = {
    provider: 'wompi', publicKey: 'pub_prod_x', accessToken: 'prv_prod_x', integritySecret: SECRETO,
    webhookSecret: 'evt', sandbox: false, isDefault: false, source: 'school_direct',
};

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Parámetros de la URL sin pasar por URLSearchParams (que decodifica el ':' igual, pero se verifica literal). */
function params(url: string): Record<string, string> {
    const q = url.split('?')[1] ?? '';
    return Object.fromEntries(q.split('&').map((kv) => {
        const i = kv.indexOf('=');
        return [kv.slice(0, i), decodeURIComponent(kv.slice(i + 1))];
    }));
}

const fetchMock = vi.fn(async () => { throw new Error('no debe haber red'); });

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    delete process.env.PAGO_PUBLICO_PERMITE_LLAVES_ENV;
    delete process.env.PAGO_PUBLICO_PERMITE_SANDBOX;
    delete process.env.FAMILIAS_APP_URL;
    estado.tablas = {
        payments: [{
            id: COBRO, school_id: ESCUELA, amount: 150000, status: 'pending', concept: 'Mensualidad',
            payment_category: 'mensualidad', due_date: '2099-10-05', payment_date: null, period_year: 2026,
            period_month: 10, child_id: 'child-1', user_id: null, parent_id: 'parent-1',
            unregistered_athlete_id: null, requires_review: false,
        }],
        school_settings: [{ school_id: ESCUELA, online_fee_pct: 5 }],
        payment_links: [],
    };
    estado.resolved = { ...CREDS_DIRECT };
    estado.inserts = [];
    estado.bloqueado = false;
    estado.competidor = null;
});

describe('firma y URL de Web Checkout', () => {
    it('firma con expiration-time = sha256(ref + monto + moneda + expiración + secreto) — ejemplo de la doc', () => {
        const creds = { publicKey: 'p', privateKey: 'k', integritySecret: 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6', eventsSecret: null, sandbox: false };
        const firma = signIntegrityWithExpiration(
            { reference: 'sk8-438k4-xmxm392-sn2m', amountInCents: 2490000, expirationTime: '2023-06-09T20:28:50.000Z' },
            creds,
        );
        expect(firma).toBe(sha('sk8-438k4-xmxm392-sn2m2490000COP2023-06-09T20:28:50.000Zprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6'));
    });

    it('sin secreto de integridad no firma', () => {
        expect(() => signIntegrityWithExpiration(
            { reference: 'r', amountInCents: 1, expirationTime: 'x' },
            { publicKey: 'p', privateKey: 'k', integritySecret: null, eventsSecret: null, sandbox: false },
        )).toThrow(/integrity_secret/);
    });

    it('la URL deja signature:integrity literal y codifica los valores', () => {
        const url = buildWebCheckoutUrl({
            publicKey: 'pub_prod_x', reference: 'SCH-A-B', amountInCents: 15750000, signature: 'abc',
            expirationTime: '2026-10-07T01:00:00.000Z',
        });
        expect(url.startsWith('https://checkout.wompi.co/p/?public-key=pub_prod_x&currency=COP&amount-in-cents=15750000&reference=SCH-A-B&signature:integrity=abc')).toBe(true);
        expect(url).toContain('expiration-time=2026-10-07T01%3A00%3A00.000Z');
        expect(url).not.toContain('redirect-url');
    });
});

describe('crearLinkWompiConMonto', () => {
    it('link con el monto del servidor (monto + recargo), referencia SCH-* y vuelta a /p/:token', async () => {
        const antes = Date.now();
        const r = await crearLinkWompiConMonto(COBRO);
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        expect(r.base).toBe(150000);
        expect(r.recargo).toBe(7500);
        expect(r.total).toBe(157500);
        expect(r.reference).toMatch(/^SCH-[A-Z0-9]+-[A-Z0-9]+$/);
        expect(r.minutos).toBe(60);
        expect(r.reused).toBe(false);

        const q = params(r.url);
        expect(r.url.startsWith('https://checkout.wompi.co/p/?')).toBe(true);
        expect(q['public-key']).toBe('pub_prod_x');
        expect(q['amount-in-cents']).toBe('15750000');
        expect(q.currency).toBe('COP');
        expect(q.reference).toBe(r.reference);
        expect(q['redirect-url']).toBe('https://app.sportmaps.co/p/AbCdEfGhIjKlMnOpQrStUvWx');
        expect(q['expiration-time']).toBe(r.venceEn);
        const vence = new Date(r.venceEn).getTime();
        expect(vence).toBeGreaterThanOrEqual(antes + 59 * 60 * 1000);
        expect(vence).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);
        expect(q['signature:integrity']).toBe(sha(`${r.reference}15750000COP${r.venceEn}${SECRETO}`));

        // Lo que concilia el webhook: payment_links con esa referencia y ese bruto.
        const links = estado.inserts.filter(i => i.tabla === 'payment_links');
        expect(links).toHaveLength(1);
        expect(links[0].fila).toMatchObject({
            payment_id: COBRO, wompi_reference: r.reference, provider_reference: r.reference,
            gross_amount: 157500, base_amount: 150000, fee_pct: 5, status: 'pending', payment_provider: 'wompi',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('idempotente: la segunda llamada reusa la misma referencia y no inserta otra fila', async () => {
        const a = await crearLinkWompiConMonto(COBRO);
        const b = await crearLinkWompiConMonto(COBRO);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) return;
        expect(b.reference).toBe(a.reference);
        expect(b.reused).toBe(true);
        expect(b.total).toBe(157500);
        expect(estado.inserts.filter(i => i.tabla === 'payment_links')).toHaveLength(1);
    });

    it('carrera entre BFF (23505): reusa la pending que insertó el otro', async () => {
        estado.competidor = {
            id: 'link-otro', payment_id: COBRO, payment_provider: 'wompi', status: 'pending',
            provider_reference: 'SCH-OTRO-BFF', wompi_reference: 'SCH-OTRO-BFF',
            gross_amount: 157500, base_amount: 150000, fee_pct: 5,
            expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        };
        const r = await crearLinkWompiConMonto(COBRO);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.reference).toBe('SCH-OTRO-BFF');
        expect(r.reused).toBe(true);
        expect(params(r.url)['amount-in-cents']).toBe('15750000');
    });

    it('una pending que vence antes del plazo del link no se reusa: se expira y se crea otra', async () => {
        estado.tablas.payment_links.push({
            id: 'link-viejo', payment_id: COBRO, payment_provider: 'wompi', status: 'pending',
            provider_reference: 'SCH-VIEJO-1', wompi_reference: 'SCH-VIEJO-1',
            gross_amount: 157500, base_amount: 150000, fee_pct: 5,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
        const r = await crearLinkWompiConMonto(COBRO);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.reference).not.toBe('SCH-VIEJO-1');
        expect(estado.tablas.payment_links.find(l => l.id === 'link-viejo')?.status).toBe('expired');
    });

    it('si cambió el monto del cobro, no reusa la sesión vieja', async () => {
        const a = await crearLinkWompiConMonto(COBRO);
        estado.tablas.payments[0].amount = 180000;
        const b = await crearLinkWompiConMonto(COBRO);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) return;
        expect(b.reference).not.toBe(a.reference);
        expect(b.total).toBe(189000);
        expect(params(b.url)['amount-in-cents']).toBe('18900000');
    });

    it('vigencia configurable', async () => {
        const r = await crearLinkWompiConMonto(COBRO, { minutos: 1440 });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(new Date(r.venceEn).getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
    });

    it('sin credenciales Wompi → no hay link (se sigue con el link estático / transferencia)', async () => {
        estado.resolved = null;
        const r = await crearLinkWompiConMonto(COBRO);
        expect(r).toMatchObject({ ok: false, code: 'sin_pago_en_linea' });
        expect(estado.inserts).toHaveLength(0);
    });

    it('sin secreto de integridad → no hay link', async () => {
        estado.resolved = { ...CREDS_DIRECT, integritySecret: null };
        expect(await crearLinkWompiConMonto(COBRO)).toMatchObject({ ok: false, code: 'sin_pago_en_linea' });
    });

    it('llaves de ENV (Dynasty, aggregator) solo con PAGO_PUBLICO_PERMITE_LLAVES_ENV=true', async () => {
        estado.resolved = { ...CREDS_DIRECT, source: 'env', isDefault: true };
        expect(await crearLinkWompiConMonto(COBRO)).toMatchObject({ ok: false, code: 'sin_pago_en_linea' });
        process.env.PAGO_PUBLICO_PERMITE_LLAVES_ENV = 'true';
        expect((await crearLinkWompiConMonto(COBRO)).ok).toBe(true);
    });

    it('nunca un checkout de sandbox a una familia', async () => {
        estado.resolved = { ...CREDS_DIRECT, sandbox: true, publicKey: 'pub_test_x' };
        expect(await crearLinkWompiConMonto(COBRO)).toMatchObject({ ok: false, code: 'sin_pago_en_linea' });
    });

    it('cobro ya pagado, en revisión o pagador bloqueado → no hay link', async () => {
        estado.tablas.payments[0].status = 'paid';
        expect(await crearLinkWompiConMonto(COBRO)).toMatchObject({ ok: false, code: 'ya_pagado' });
        estado.tablas.payments[0].status = 'pending';
        estado.tablas.payments[0].requires_review = true;
        expect(await crearLinkWompiConMonto(COBRO)).toMatchObject({ ok: false, code: 'PAYMENT_REQUIRES_REVIEW' });
        estado.tablas.payments[0].requires_review = false;
        estado.bloqueado = true;
        expect(await crearLinkWompiConMonto(COBRO)).toMatchObject({ ok: false, code: 'USER_PAYMENT_BLOCKED' });
        expect(estado.inserts).toHaveLength(0);
    });

    it('cobro inexistente → ok:false, nunca lanza', async () => {
        expect(await crearLinkWompiConMonto('no-existe')).toMatchObject({ ok: false, code: 'no_existe' });
    });
});
