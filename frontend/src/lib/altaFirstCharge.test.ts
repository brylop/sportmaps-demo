import { describe, it, expect } from 'vitest';
import { computeAltaFirstCharge, altaFeesDueDate, AltaFirstChargeInput } from './altaFirstCharge';

// Espejo de buildAltaPayments + emit_enrollment_fees (BFF / migración 20261010124934).
// Plan de Dreamers: mensualidad 245.000, inscripción 120.000, seguro 150.000.
const base: AltaFirstChargeInput = {
  startDate: '2026-10-10',
  today: '2026-10-10',
  monthlyFee: 245000,
  cycleType: 'fixed_calendar',
  cutoffDay: 5,
  registrationFee: 120000,
  insuranceFee: 150000,
};

describe('computeAltaFirstCharge — total del primer cobro', () => {
  it('sin exoneración: mensualidad + inscripción + seguro', () => {
    const r = computeAltaFirstCharge(base);
    expect(r.monthly?.amount).toBe(245000);
    expect(r.registration).toEqual({ amount: 120000, charged: 120000, status: 'charged' });
    expect(r.insurance).toEqual({ amount: 150000, charged: 150000, status: 'charged' });
    expect(r.total).toBe(245000 + 120000 + 150000);
  });

  it('«No cobrar inscripción»: la línea queda en $0 y no suma', () => {
    const r = computeAltaFirstCharge({ ...base, waiveRegistration: true });
    expect(r.registration).toEqual({ amount: 120000, charged: 0, status: 'waived' });
    expect(r.total).toBe(245000 + 150000);
  });

  it('los dos exonerados: solo la mensualidad', () => {
    const r = computeAltaFirstCharge({ ...base, waiveRegistration: true, waiveInsurance: true });
    expect(r.total).toBe(245000);
  });

  it('seguro vigente (12 meses): no se suma y queda marcado', () => {
    const r = computeAltaFirstCharge({ ...base, insuranceActiveSince: '2026-03-02' });
    expect(r.insurance).toEqual({ amount: 150000, charged: 0, status: 'active' });
    expect(r.total).toBe(245000 + 120000);
  });

  it('plan sin pagos únicos: líneas «none», total = mensualidad (regresión)', () => {
    const r = computeAltaFirstCharge({ ...base, registrationFee: null, insuranceFee: 0 });
    expect(r.registration.status).toBe('none');
    expect(r.insurance.status).toBe('none');
    expect(r.total).toBe(245000);
  });

  it('cuota < $10.000: el BFF no crea mensualidad → solo pagos únicos', () => {
    const r = computeAltaFirstCharge({ ...base, monthlyFee: 5000 });
    expect(r.monthly).toBeNull();
    expect(r.total).toBe(120000 + 150000);
  });
});

describe('computeAltaFirstCharge — mensualidad igual que el BFF', () => {
  it('prorrateo: días restantes del mes de entrada', () => {
    const r = computeAltaFirstCharge({ ...base, cycleType: 'prorated', startDate: '2026-10-10', registrationFee: 0, insuranceFee: 0 });
    // 22 de 31 días
    expect(r.monthly?.remainingDays).toBe(22);
    expect(r.monthly?.amount).toBe(Math.round((22 / 31) * 245000));
    expect(r.total).toBe(r.monthly?.amount);
  });

  it('descuento del primer mes: se aplica a la cuota ANTES del prorrateo (como buildAltaPayments)', () => {
    const r = computeAltaFirstCharge({ ...base, cycleType: 'prorated', startDate: '2026-10-10', discountPct: 10 });
    const effective = Math.round(245000 * 0.9);
    expect(r.monthly?.amount).toBe(Math.round((22 / 31) * effective));
    expect(r.monthly?.listAmount).toBe(Math.round((22 / 31) * 245000));
    // El descuento no toca inscripción ni seguro.
    expect(r.total).toBe(r.monthly!.amount + 120000 + 150000);
  });

  it('ciclo fijo con alta después del corte: vence el día del alta, en el MES DE ENTRADA', () => {
    const r = computeAltaFirstCharge({ ...base, cycleType: 'fixed_calendar', cutoffDay: 5, startDate: '2026-10-10' });
    expect(r.monthly?.dueDate).toBe('2026-10-10');
  });

  it('ciclo fijo con alta antes del corte: vence el día de corte del mismo mes', () => {
    const r = computeAltaFirstCharge({ ...base, cycleType: 'fixed_calendar', cutoffDay: 15, startDate: '2026-10-10' });
    expect(r.monthly?.dueDate).toBe('2026-10-15');
  });

  it('ciclo 30 días: alta + 30', () => {
    const r = computeAltaFirstCharge({ ...base, cycleType: 'rolling_30', startDate: '2026-10-10' });
    expect(r.monthly?.dueDate).toBe('2026-11-09');
  });
});

describe('altaFeesDueDate — vencimiento de inscripción y seguro', () => {
  it('alta futura: el día del alta', () => {
    expect(altaFeesDueDate('2026-11-01', '2026-10-10')).toBe('2026-11-01');
  });
  it('alta en el pasado: hoy (un cobro no nace vencido)', () => {
    expect(altaFeesDueDate('2026-10-01', '2026-10-10')).toBe('2026-10-10');
  });
});
