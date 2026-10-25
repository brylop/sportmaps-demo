import { describe, expect, it, vi } from 'vitest';

// «Hoy» fijo: 21-oct-2026 (Colombia).
vi.mock('@/lib/dateUtils', () => ({
    daysDiffFromToday: (due: string) => {
        const hoy = Date.UTC(2026, 9, 21);
        const [y, m, d] = due.split('-').map(Number);
        return Math.floor((hoy - Date.UTC(y, m - 1, d)) / 86_400_000);
    },
}));

import { getPaymentState } from './studentPaymentState';

const pend = (due: string | null) => ({ payment_status: 'pending', payment_due_date: due });

describe('getPaymentState', () => {
    it('sin cobro y estados terminales → none', () => {
        expect(getPaymentState({ payment_status: null })).toBe('none');
        for (const s of ['cancelled', 'rejected', 'failed']) expect(getPaymentState({ payment_status: s })).toBe('none');
    });
    it('pagado y aprobado → paid', () => {
        expect(getPaymentState({ payment_status: 'paid' })).toBe('paid');
        expect(getPaymentState({ payment_status: 'approved' })).toBe('paid');
    });
    it('status overdue manda siempre, con o sin gracia', () => {
        expect(getPaymentState({ payment_status: 'overdue', payment_due_date: '2026-10-20' }, 5)).toBe('overdue');
        expect(getPaymentState({ payment_status: 'overdue' })).toBe('overdue');
    });

    describe('sin gracia (comportamiento de siempre)', () => {
        it('vence hoy → pendiente (el día de vencimiento todavía se puede pagar)', () => {
            expect(getPaymentState(pend('2026-10-21'))).toBe('pending');
        });
        it('venció ayer → vencido', () => {
            expect(getPaymentState(pend('2026-10-20'))).toBe('overdue');
        });
    });

    describe('con 5 días de gracia (Dreamers)', () => {
        it('el caso de Airi: inscripción vencida ayer (20-oct) sigue PENDIENTE', () => {
            expect(getPaymentState(pend('2026-10-20'), 5)).toBe('pending');
        });
        it('vence en el futuro → pendiente', () => {
            expect(getPaymentState(pend('2026-11-01'), 5)).toBe('pending');
        });
        it('5 días de atraso todavía es gracia; el sexto ya es vencido (igual que apply_late_fees: due + gracia < hoy)', () => {
            expect(getPaymentState(pend('2026-10-16'), 5)).toBe('pending');   // 5 días
            expect(getPaymentState(pend('2026-10-15'), 5)).toBe('overdue');   // 6 días
        });
        it('en revisión (awaiting_approval) sigue la misma regla', () => {
            expect(getPaymentState({ payment_status: 'awaiting_approval', payment_due_date: '2026-10-20' }, 5)).toBe('pending');
            expect(getPaymentState({ payment_status: 'awaiting_approval', payment_due_date: '2026-10-10' }, 5)).toBe('overdue');
        });
    });

    it('una gracia inválida (negativa, NaN) se trata como 0', () => {
        expect(getPaymentState(pend('2026-10-20'), -3)).toBe('overdue');
        expect(getPaymentState(pend('2026-10-20'), Number.NaN)).toBe('overdue');
    });
    it('pending sin fecha de vencimiento → pendiente; estado desconocido → other', () => {
        expect(getPaymentState(pend(null), 5)).toBe('pending');
        expect(getPaymentState({ payment_status: 'refunded' })).toBe('other');
    });
});
