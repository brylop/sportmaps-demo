/**
 * Webhook Wompi, cobros de escuela (SCH-*): el link con monto
 * (wompi-link-con-monto) se aplica solo, y un segundo pago del mismo cobro NO
 * pisa el primero (va a revisión). Sin red ni base: todo moqueado.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Fila[]>,
    updates: [] as { tabla: string; cambios: Fila }[],
    inserts: [] as { tabla: string; fila: Fila }[],
    rpcs: [] as { nombre: string; args: any }[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let modo: 'select' | 'update' = 'select';
        let cambios: Fila = {};
        const resultado = () => {
            if (modo === 'update') {
                estado.updates.push({ tabla, cambios });
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
                return { data: null, error: null };
            },
        },
    };
});

vi.mock('../services/store-checkout', () => ({
    findStoreOrderByReference: vi.fn(), sellerWompiCredsForOrder: vi.fn(), amountMatchesOrder: vi.fn(),
}));
vi.mock('../services/payment-provider.resolver', () => ({ resolveProvider: vi.fn(async () => null) }));
vi.mock('../services/paymentFailureEmail.service', () => ({ sendPaymentAttemptFailedEmails: vi.fn() }));

import { routeWompiTransaction } from './wompi';

const COBRO = 'aaaaaaaa-0000-4000-8000-00000000000a';
const REF = 'SCH-MUVK4FOX-6D4982';

const tx = (id: string) => ({
    id, status: 'APPROVED', reference: REF, amount_in_cents: 15750000, currency: 'COP', payment_method_type: 'NEQUI',
});

beforeEach(() => {
    estado.tablas = {
        payment_links: [{
            id: 'link-1', payment_id: COBRO, school_id: 'esc', gross_amount: 157500, base_amount: 150000,
            sportmaps_fee: 7500, status: 'pending', wompi_reference: REF, failed_attempts: 0,
        }],
        payments: [{ id: COBRO, status: 'pending', wompi_transaction_id: null }],
        payment_splits: [],
    };
    estado.updates = [];
    estado.inserts = [];
    estado.rpcs = [];
});

describe('webhook Wompi — cobro de escuela', () => {
    it('APPROVED del link con monto: aplica el pago y avisa a escuela y acudiente', async () => {
        const r = await routeWompiTransaction({ realTx: tx('1298966-1-1') });
        expect(r.body).toMatchObject({ status: 'ok', kind: 'school_payment' });
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'paid', wompi_transaction_id: '1298966-1-1', payment_method: 'transfer' });
        expect(estado.rpcs.map(x => x.nombre)).toEqual(expect.arrayContaining(['notify_school_payment_paid', 'notify_parent_payment_paid']));
    });

    it('el cobro ya estaba pagado (transferencia u otra referencia): no lo pisa, registra el dinero y lo manda a revisión', async () => {
        estado.tablas.payments[0] = { id: COBRO, status: 'paid', wompi_transaction_id: null, payment_date: '2026-10-01', payment_channel: 'transfer' };
        const r = await routeWompiTransaction({ realTx: tx('1298966-2-2') });
        expect(r.body).toMatchObject({ duplicate_payment: true });
        expect(estado.updates.some(u => u.tabla === 'payments')).toBe(false);
        expect(estado.tablas.payments[0]).toMatchObject({ payment_date: '2026-10-01', payment_channel: 'transfer' });
        expect(estado.inserts.find(i => i.tabla === 'payment_splits')?.fila).toMatchObject({ wompi_transaction_id: '1298966-2-2', gross_amount: 157500 });
        const flag = estado.rpcs.find(x => x.nombre === 'flag_payment_for_review');
        expect(flag?.args).toMatchObject({ p_kind: 'payment', p_id: COBRO });
        expect(String(flag?.args.p_reason)).toContain('doble_pago');
        expect(estado.rpcs.some(x => x.nombre === 'notify_parent_payment_paid')).toBe(false);
    });
});
