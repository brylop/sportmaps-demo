import { describe, it, expect } from 'vitest';
import { describirLinea, type FeeLine } from './EnrollmentFeesSection';

const line = (over: Partial<FeeLine>): FeeLine => ({
  kind: 'inscripcion', plan_amount: 120000, state: 'por_cobrar', payment: null, previously_cancelled: false, can_charge: true, ...over,
});

describe('describirLinea', () => {
  it('plan sin valor', () => {
    expect(describirLinea(line({ state: 'sin_valor', can_charge: false, plan_amount: 0 }))).toContain('no tiene este valor configurado');
  });
  it('inscripción pendiente muestra monto y estado', () => {
    const t = describirLinea(line({ state: 'cobrado', can_charge: false, payment: { id: 'x', amount: 120000, status: 'pending', due_date: '2026-10-19' } }));
    expect(t).toContain('pendiente');
    expect(t).toContain('120.000');
  });
  it('inscripción pagada', () => {
    expect(describirLinea(line({ state: 'pagado', can_charge: false, payment: { id: 'x', amount: 120000, status: 'paid', due_date: '2026-10-19' } }))).toContain('pagada');
  });
  it('seguro vigente', () => {
    expect(describirLinea(line({ kind: 'seguro', state: 'vigente', can_charge: false, payment: { id: 'x', amount: 150000, status: 'paid', due_date: '2026-03-02' } }))).toContain('vigente');
  });
});
