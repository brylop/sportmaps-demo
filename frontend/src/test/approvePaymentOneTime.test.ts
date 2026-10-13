/**
 * F0 cobros únicos (migración 20261010143132, cobros-multiples I15): aprobar un
 * cobro ÚNICO (torneo, inscripción, seguro…) nunca activa una inscripción
 * pendiente; solo la mensualidad (categoría NULL o 'mensualidad') lo hace.
 * También: isOneOffCharge (solo para mostrar) sigue la regla única cuando hay
 * categoría explícita.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
    paymentRow: { id: 'pay-1', payment_category: null as string | null } as Record<string, unknown> | null,
    enrollmentUpdates: [] as Array<{ cambios: unknown; filtros: Array<[string, string, unknown]> }>,
    rpcCalls: [] as string[],
}));

vi.mock('@/integrations/supabase/client', () => {
    function builder(tabla: string) {
        let cambios: unknown = null;
        const filtros: Array<[string, string, unknown]> = [];
        const api: any = {
            update: (c: unknown) => { cambios = c; return api; },
            eq: (c: string, v: unknown) => { filtros.push(['eq', c, v]); return api; },
            in: (c: string, v: unknown) => { filtros.push(['in', c, v]); return api; },
            is: (c: string, v: unknown) => { filtros.push(['is', c, v]); return api; },
            select: () => Promise.resolve({ data: st.paymentRow ? [st.paymentRow] : [], error: null }),
            then: (ok: any, ko: any) => {
                if (tabla === 'enrollments') st.enrollmentUpdates.push({ cambios, filtros });
                return Promise.resolve({ data: null, error: null }).then(ok, ko);
            },
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: (fn: string) => { st.rpcCalls.push(fn); return Promise.resolve({ data: null, error: null }); },
        },
    };
});

const { approvePayment } = await import('@/lib/approvePayment');
const { isOneOffCharge } = await import('@/lib/payment-accounts');

const PAGO = {
    id: 'pay-1', amount: 100000, amount_paid: 0, concept: 'Cobro',
    child_id: 'kid-1', parent_id: 'par-1', team_id: 'team-1',
};
const OPTS = { userId: 'admin-1', schoolId: 'esc-1', schoolName: 'Escuela' };

beforeEach(() => {
    st.enrollmentUpdates = [];
    st.rpcCalls = [];
    st.paymentRow = { id: 'pay-1', payment_category: null };
});

describe('approvePayment — activar inscripción solo con mensualidad', () => {
    it('mensualidad completa (categoría NULL) → activa la inscripción pendiente del equipo', async () => {
        const r = await approvePayment(PAGO, OPTS);
        expect(r.ok).toBe(true);
        expect(st.enrollmentUpdates).toHaveLength(1);
        expect(st.enrollmentUpdates[0].cambios).toEqual({ status: 'active' });
        expect(st.enrollmentUpdates[0].filtros).toContainEqual(['eq', 'team_id', 'team-1']);
    });

    it("mensualidad explícita ('mensualidad') → activa", async () => {
        st.paymentRow = { id: 'pay-1', payment_category: 'mensualidad' };
        await approvePayment(PAGO, OPTS);
        expect(st.enrollmentUpdates).toHaveLength(1);
    });

    it.each(['torneo', 'inscripcion', 'seguro', 'articulos', 'viaje', 'excedente', 'otro', 'categoria_futura'])(
        'cobro único %s completo → NO activa (pero sí se aprueba y se avisa)', async (cat) => {
            st.paymentRow = { id: 'pay-1', payment_category: cat };
            const r = await approvePayment(PAGO, OPTS);
            expect(r.ok).toBe(true);
            expect(st.enrollmentUpdates).toHaveLength(0);
            expect(st.rpcCalls).toContain('notify_user');
        },
    );

    it('la categoría de la base manda sobre la del llamador', async () => {
        st.paymentRow = { id: 'pay-1', payment_category: 'torneo' };
        await approvePayment({ ...PAGO, payment_category: 'mensualidad' }, OPTS);
        expect(st.enrollmentUpdates).toHaveLength(0);
    });

    it('si la fila no trae la columna, se usa la del llamador', async () => {
        st.paymentRow = { id: 'pay-1' };
        await approvePayment({ ...PAGO, payment_category: 'torneo' }, OPTS);
        expect(st.enrollmentUpdates).toHaveLength(0);
    });

    it('abono de mensualidad → no activa (como antes)', async () => {
        await approvePayment(PAGO, { ...OPTS, abonoAmount: 40000 });
        expect(st.enrollmentUpdates).toHaveLength(0);
    });

    it('cobro ya manejado → already_handled y no activa', async () => {
        st.paymentRow = null;
        const r = await approvePayment(PAGO, OPTS);
        expect(r).toMatchObject({ ok: false, reason: 'already_handled' });
        expect(st.enrollmentUpdates).toHaveLength(0);
    });
});

describe('isOneOffCharge (solo para mostrar)', () => {
    it('con categoría explícita sigue la regla única: torneo/viaje/otro son únicos, mensualidad no', () => {
        expect(isOneOffCharge({ payment_category: 'torneo', concept: 'Torneo regional' })).toBe(true);
        expect(isOneOffCharge({ payment_category: 'viaje', concept: null })).toBe(true);
        expect(isOneOffCharge({ payment_category: 'otro', concept: 'Mensualidad octubre' })).toBe(true);
        expect(isOneOffCharge({ payment_category: 'mensualidad', concept: 'Inscripción' })).toBe(false);
    });

    it('sin categoría (fila vieja) mira el concepto', () => {
        expect(isOneOffCharge({ payment_category: null, concept: 'Inscripción — Plan X' })).toBe(true);
        expect(isOneOffCharge({ payment_category: null, concept: 'Mensualidad 10/2026' })).toBe(false);
        expect(isOneOffCharge({ payment_category: null, concept: null })).toBe(false);
    });
});
