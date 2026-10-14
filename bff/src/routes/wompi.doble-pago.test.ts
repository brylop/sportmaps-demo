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
    orden: [] as string[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let modo: 'select' | 'update' = 'select';
        let cambios: Fila = {};
        const resultado = () => {
            if (modo === 'update') {
                estado.updates.push({ tabla, cambios });
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
    estado.orden = [];
});

describe('webhook Wompi — cobro de escuela', () => {
    it('APPROVED del link con monto: aplica el pago y avisa a escuela y acudiente', async () => {
        const r = await routeWompiTransaction({ realTx: tx('1298966-1-1') });
        expect(r.body).toMatchObject({ status: 'ok', kind: 'school_payment' });
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'paid', wompi_transaction_id: '1298966-1-1', payment_method: 'transfer' });
        expect(estado.rpcs.map(x => x.nombre)).toEqual(expect.arrayContaining(['notify_school_payment_paid', 'notify_parent_payment_paid']));
    });

    it('sobrepago (I35): el cobro bajó por un descuento después de firmar el enlace → paid, amount_paid = recibido y a revisión', async () => {
        // El enlace firmó 150.000 (+ 7.500 de recargo); la escuela descontó a 135.000 entretanto.
        estado.tablas.payments[0] = { id: COBRO, status: 'pending', wompi_transaction_id: null, amount: 135000, amount_paid: 0 };
        const r = await routeWompiTransaction({ realTx: tx('1298966-3-3') });
        expect(r.body).toMatchObject({ status: 'ok', kind: 'school_payment', overpayment: 15000 });
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'paid', amount: 135000, amount_paid: 150000 });
        const flag = estado.rpcs.find(x => x.nombre === 'flag_payment_for_review');
        expect(flag?.args).toMatchObject({ p_kind: 'payment', p_id: COBRO });
        expect(String(flag?.args.p_reason)).toContain('sobrepago');
        expect(String(flag?.args.p_reason)).toContain('pagó de más $15.000');
    });

    it('sin descuento de por medio no hay sobrepago ni revisión', async () => {
        estado.tablas.payments[0] = { id: COBRO, status: 'pending', wompi_transaction_id: null, amount: 150000, amount_paid: 0 };
        const r = await routeWompiTransaction({ realTx: tx('1298966-4-4') });
        expect(r.body).not.toHaveProperty('overpayment');
        expect(estado.tablas.payments[0].amount_paid).toBe(0);
        expect(estado.rpcs.some(x => x.nombre === 'flag_payment_for_review')).toBe(false);
    });

    it('faltante (mora, 2026-10-14): el enlace se generó antes del recargo → partial, amount_paid = recibido y a revisión con lo que falta', async () => {
        // El enlace firmó 150.000 (+ 7.500 de recargo online); apply_late_fees subió el cobro a 165.000.
        estado.tablas.payments[0] = { id: COBRO, status: 'overdue', wompi_transaction_id: null, amount: 165000, amount_paid: 0, late_fee_amount: 15000 };
        const r = await routeWompiTransaction({ realTx: tx('1298966-5-5') });
        expect(r.body).toMatchObject({ status: 'ok', kind: 'school_payment', underpayment: 15000, partial: true });
        expect(r.body).not.toHaveProperty('overpayment');
        // No queda 'paid': la mora no se condona. Sí conserva el rastro de la pasarela.
        expect(estado.tablas.payments[0]).toMatchObject({
            status: 'partial', amount: 165000, amount_paid: 150000,
            wompi_transaction_id: '1298966-5-5', wompi_reference: REF, gross_amount: 157500,
            payment_provider: 'wompi', payment_channel: 'online',
        });
        // El enlace sí queda pagado y el split registra la plata que entró.
        expect(estado.tablas.payment_links[0].status).toBe('paid');
        expect(estado.inserts.find(i => i.tabla === 'payment_splits')?.fila).toMatchObject({ wompi_transaction_id: '1298966-5-5', gross_amount: 157500 });
        const flag = estado.rpcs.find(x => x.nombre === 'flag_payment_for_review');
        expect(flag?.args).toMatchObject({ p_kind: 'payment', p_id: COBRO });
        expect(String(flag?.args.p_reason)).toContain('pago_parcial');
        expect(String(flag?.args.p_reason)).toContain('Pagó $150.000; faltan $15.000');
        expect(String(flag?.args.p_reason)).toContain('recargo por mora');
        // La marca va después del UPDATE (el trigger la bajaría al entrar a 'partial').
        expect(estado.orden.indexOf('rpc:flag_payment_for_review')).toBeGreaterThan(estado.orden.indexOf('update:payments'));
    });

    it('faltante con abono previo: amount_paid acumula y el faltante es sobre el saldo', async () => {
        // Cobro 200.000 con 40.000 ya abonados → saldo 160.000; entran 150.000 → faltan 10.000.
        estado.tablas.payments[0] = { id: COBRO, status: 'pending', wompi_transaction_id: null, amount: 200000, amount_paid: 40000 };
        const r = await routeWompiTransaction({ realTx: tx('1298966-6-6') });
        expect(r.body).toMatchObject({ underpayment: 10000, partial: true });
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'partial', amount_paid: 190000 });
        expect(String(estado.rpcs.find(x => x.nombre === 'flag_payment_for_review')?.args.p_reason)).toContain('el cobro subió');
    });

    it('lo recibido salda el resto de un abono previo: paid y amount_paid = total, sin revisión', async () => {
        estado.tablas.payments[0] = { id: COBRO, status: 'pending', wompi_transaction_id: null, amount: 190000, amount_paid: 40000 };
        const r = await routeWompiTransaction({ realTx: tx('1298966-7-7') });
        expect(r.body).not.toHaveProperty('underpayment');
        expect(r.body).not.toHaveProperty('overpayment');
        expect(estado.tablas.payments[0]).toMatchObject({ status: 'paid', amount_paid: 190000 });
        expect(estado.rpcs.some(x => x.nombre === 'flag_payment_for_review')).toBe(false);
    });

    it('diferencia de 1 peso (redondeo) no es faltante', async () => {
        estado.tablas.payments[0] = { id: COBRO, status: 'pending', wompi_transaction_id: null, amount: 150001, amount_paid: 0 };
        const r = await routeWompiTransaction({ realTx: tx('1298966-8-8') });
        expect(r.body).not.toHaveProperty('underpayment');
        expect(estado.tablas.payments[0].status).toBe('paid');
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
