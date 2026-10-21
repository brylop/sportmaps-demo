import { describe, it, expect } from 'vitest';
import { estadoDeConcepto, type FeePaymentRow } from './enrollment-fees-edit.service';

const HOY = '2026-10-20';
const row = (over: Partial<FeePaymentRow>): FeePaymentRow => ({
    id: 'p1', payment_category: 'inscripcion', amount: 120000, status: 'pending', due_date: '2026-10-19', ...over,
});

describe('estadoDeConcepto', () => {
    it('plan sin valor: no se puede cobrar', () => {
        const r = estadoDeConcepto('inscripcion', 0, [], HOY);
        expect(r.state).toBe('sin_valor');
        expect(r.can_charge).toBe(false);
    });

    it('sin cobros y con valor en el plan: por cobrar', () => {
        const r = estadoDeConcepto('inscripcion', 120000, [], HOY);
        expect(r.state).toBe('por_cobrar');
        expect(r.can_charge).toBe(true);
        expect(r.previously_cancelled).toBe(false);
    });

    it('inscripción ya cobrada (abierta): no se repite', () => {
        for (const status of ['pending', 'overdue', 'partial', 'awaiting_approval']) {
            const r = estadoDeConcepto('inscripcion', 120000, [row({ status })], HOY);
            expect(r.state).toBe('cobrado');
            expect(r.can_charge).toBe(false);
        }
    });

    it('inscripción pagada: queda como pagada, aunque sea de hace años', () => {
        const r = estadoDeConcepto('inscripcion', 120000, [row({ status: 'paid', due_date: '2024-01-05' })], HOY);
        expect(r.state).toBe('pagado');
        expect(r.can_charge).toBe(false);
    });

    it('inscripción cancelada (p. ej. desmarcada por error): se puede cobrar de nuevo', () => {
        const r = estadoDeConcepto('inscripcion', 120000, [row({ status: 'cancelled' })], HOY);
        expect(r.state).toBe('por_cobrar');
        expect(r.can_charge).toBe(true);
        expect(r.previously_cancelled).toBe(true);
        expect(r.payment).toBeNull();
    });

    it('seguro pagado hace menos de 12 meses: vigente, no se repite', () => {
        const r = estadoDeConcepto('seguro', 150000, [row({ payment_category: 'seguro', status: 'paid', due_date: '2026-03-02' })], HOY);
        expect(r.state).toBe('vigente');
        expect(r.can_charge).toBe(false);
    });

    it('seguro de hace más de 12 meses: se puede cobrar otro', () => {
        const r = estadoDeConcepto('seguro', 150000, [row({ payment_category: 'seguro', status: 'paid', due_date: '2025-09-01' })], HOY);
        expect(r.state).toBe('por_cobrar');
        expect(r.can_charge).toBe(true);
    });

    it('seguro pendiente: ya cobrado', () => {
        const r = estadoDeConcepto('seguro', 150000, [row({ payment_category: 'seguro', status: 'pending' })], HOY);
        expect(r.state).toBe('cobrado');
    });

    it('no mezcla conceptos: una inscripción no cuenta como seguro', () => {
        const r = estadoDeConcepto('seguro', 150000, [row({ payment_category: 'inscripcion', status: 'paid' })], HOY);
        expect(r.state).toBe('por_cobrar');
    });
});
