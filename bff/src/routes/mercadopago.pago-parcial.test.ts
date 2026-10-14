/**
 * Webhook Mercado Pago, cobros de escuela (SCH-*): si el enlace se generó antes
 * de que `apply_late_fees` sumara la mora y se pagó después, lo recibido NO
 * salda el cobro. Decisión 2026-10-14: la mora nunca se condona en silencio →
 * el cobro queda 'partial' con lo recibido en amount_paid y a revisión.
 * Mismo criterio que wompi.ts. Sin red ni base: todo moqueado.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Fila[]>,
    inserts: [] as { tabla: string; fila: Fila }[],
    rpcs: [] as { nombre: string; args: any }[],
    orden: [] as string[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let modo: 'select' | 'update' = 'select';
        let cambios: Fila = {};
        const resultado = () => {
            if (modo === 'update') {
                estado.orden.push(`update:${tabla}`);
                for (const f of filas) Object.assign(f, cambios);
            }
            return { data: modo === 'update' ? null : filas, error: null };
        };
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter(f => f[c] === v); return api; },
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            update: (c: Fila) => { modo = 'update'; cambios = c; return api; },
            insert: async (fila: Fila) => {
                estado.inserts.push({ tabla, fila });
                (estado.tablas[tabla] ??= []).push({ ...fila });
                return { data: null, error: null };
            },
            then: (ok: any, ko: any) => Promise.resolve(resultado()).then(ok, ko),
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (nombre: string, args: any) => {
                estado.rpcs.push({ nombre, args });
                estado.orden.push(`rpc:${nombre}`);
                return { data: null, error: null };
            },
        },
    };
});

vi.mock('../services/store-checkout', () => ({
    findStoreOrderByReference: vi.fn(), findStoreOrderById: vi.fn(), sellerGatewayForOrder: vi.fn(),
    sellerWompiCredsForOrder: vi.fn(), amountMatchesOrder: vi.fn(), SellerGatewayError: class extends Error {},
}));
vi.mock('../services/payment-provider.resolver', () => ({
    resolveProvider: vi.fn(async () => null), loadProviderConfig: vi.fn(async () => null),
}));
vi.mock('../services/paymentFailureEmail.service', () => ({ sendPaymentAttemptFailedEmails: vi.fn() }));

import { routeMercadoPagoTransaction } from './mercadopago';

const COBRO = 'bbbbbbbb-0000-4000-8000-00000000000b';
const REF = 'SCH-MP-PARCIAL-1';

const pagoMp = (id: number) => ({
    id, status: 'approved', external_reference: REF, transaction_amount: 157500,
    payment_method_id: 'pse', payment_type_id: 'bank_transfer',
}) as any;

beforeEach(() => {
    estado.tablas = {
        payment_links: [{
            id: 'link-mp', payment_id: COBRO, school_id: 'esc', gross_amount: 157500, base_amount: 150000,
            sportmaps_fee: 7500, status: 'pending', provider_reference: REF, failed_attempts: 0,
        }],
        payments: [{ id: COBRO, status: 'pending', amount: 150000, amount_paid: 0 }],
        payment_splits: [],
    };
    estado.inserts = [];
    estado.rpcs = [];
    estado.orden = [];
});

describe('webhook Mercado Pago — cobro de escuela', () => {
    it('pago exacto: paid, sin revisión y amount_paid intacto', async () => {
        const r = await routeMercadoPagoTransaction({ payment: pagoMp(9001) });
        expect(r.body).toMatchObject({ status: 'ok', kind: 'school_payment' });
        expect(r.body).not.toHaveProperty('underpayment');
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'paid', amount_paid: 0, provider_transaction_id: '9001' });
        expect(estado.rpcs.some(x => x.nombre === 'flag_payment_for_review')).toBe(false);
        expect(estado.rpcs.map(x => x.nombre)).toEqual(expect.arrayContaining(['notify_school_payment_paid', 'notify_parent_payment_paid']));
    });

    it('faltante por mora posterior al enlace: partial, amount_paid = recibido, link pagado, split y a revisión', async () => {
        estado.tablas.payments[0] = { id: COBRO, status: 'overdue', amount: 165000, amount_paid: 0, late_fee_amount: 15000 };
        const r = await routeMercadoPagoTransaction({ payment: pagoMp(9002) });
        expect(r.body).toMatchObject({ status: 'ok', kind: 'school_payment', underpayment: 15000, partial: true });
        expect(estado.tablas.payments[0]).toMatchObject({
            status: 'partial', amount: 165000, amount_paid: 150000,
            payment_provider: 'mercadopago', provider_reference: REF, provider_transaction_id: '9002', gross_amount: 157500,
        });
        expect(estado.tablas.payment_links[0].status).toBe('paid');
        expect(estado.inserts.find(i => i.tabla === 'payment_splits')?.fila).toMatchObject({ provider_transaction_id: '9002', gross_amount: 157500 });
        const flag = estado.rpcs.find(x => x.nombre === 'flag_payment_for_review');
        expect(flag?.args).toMatchObject({ p_kind: 'payment', p_id: COBRO });
        expect(String(flag?.args.p_reason)).toContain('mp_pago_parcial');
        expect(String(flag?.args.p_reason)).toContain('Pagó $150.000; faltan $15.000');
        expect(String(flag?.args.p_reason)).toContain('recargo por mora');
        expect(estado.orden.indexOf('rpc:flag_payment_for_review')).toBeGreaterThan(estado.orden.indexOf('update:payments'));
    });

    it('sobrepago: paid con amount_paid = recibido y a revisión (mismo criterio que Wompi)', async () => {
        estado.tablas.payments[0] = { id: COBRO, status: 'pending', amount: 135000, amount_paid: 0 };
        const r = await routeMercadoPagoTransaction({ payment: pagoMp(9003) });
        expect(r.body).toMatchObject({ overpayment: 15000 });
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'paid', amount_paid: 150000 });
        expect(String(estado.rpcs.find(x => x.nombre === 'flag_payment_for_review')?.args.p_reason)).toContain('pagó de más $15.000');
    });
});
