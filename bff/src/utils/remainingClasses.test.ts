import { describe, expect, it } from 'vitest';
import {
  calcRemainingClassesPayment,
  classesPerPeriod,
  remainingClassesEligibility,
  RemainingClassesError,
} from './remainingClasses';

// Planes reales de Dreamers (offering_plans, 2026-10-05).
const PGC8x3  = { price: 723000, included_minutes_per_period: 1440, session_block_minutes: 180, max_sessions: 8,  duration_days: 30 };
const PGA12x2 = { price: 457000, included_minutes_per_period: 1440, session_block_minutes: 120, max_sessions: 12, duration_days: 30 };
// PGR6x2 en la base: 720 min con bloque 160 → 4,5 clases (no entero) → cae a max_sessions = 6.
const PGR6x2  = { price: 387000, included_minutes_per_period: 720,  session_block_minutes: 160, max_sessions: 6,  duration_days: 30 };
const PGN12x3 = { price: 964000, included_minutes_per_period: null, session_block_minutes: null, max_sessions: 12, duration_days: 30 };

describe('classesPerPeriod', () => {
  it('minutos ÷ bloque del plan cuando da entero (PGC8x3 = 1440/180 = 8)', () => {
    expect(classesPerPeriod(PGC8x3, 120)).toEqual({ classes: 8, source: 'minutes' });
  });

  it('PGA12x2 = 1440/120 = 12', () => {
    expect(classesPerPeriod(PGA12x2, null)).toEqual({ classes: 12, source: 'minutes' });
  });

  it('no entero (PGR6x2 720/160 = 4,5) → max_sessions', () => {
    expect(classesPerPeriod(PGR6x2, 120)).toEqual({ classes: 6, source: 'max_sessions' });
  });

  it('720 con bloque 180 sí da entero (4): la regla es "si da entero", no el nombre del plan', () => {
    expect(classesPerPeriod({ ...PGR6x2, session_block_minutes: 180 }, null)).toEqual({ classes: 4, source: 'minutes' });
  });

  it('sin bloque propio hereda el de la escuela', () => {
    expect(classesPerPeriod({ included_minutes_per_period: 960, session_block_minutes: null, max_sessions: null }, 120))
      .toEqual({ classes: 8, source: 'minutes' });
  });

  it('minutos NULL → max_sessions', () => {
    expect(classesPerPeriod(PGN12x3, 120)).toEqual({ classes: 12, source: 'max_sessions' });
  });

  it('nada definido → null (la opción no se ofrece)', () => {
    expect(classesPerPeriod({ included_minutes_per_period: null, session_block_minutes: null, max_sessions: null }, 120)).toBeNull();
    expect(classesPerPeriod({ included_minutes_per_period: 700, session_block_minutes: null, max_sessions: null }, 120)).toBeNull();
  });
});

describe('calcRemainingClassesPayment', () => {
  const base = { cutoffDay: 5, today: '2026-08-24' };

  it('ejemplo de Dreamers: PGC8x3, alta 24/08 con 2 clases = 723.000 ÷ 8 × 2 = 180.750', () => {
    const [partial, next] = calcRemainingClassesPayment({
      ...base, startDate: '2026-08-24', monthlyFee: 723000, classesRemaining: 2, classesPerPeriod: 8,
    });
    expect(partial).toMatchObject({ kind: 'partial', amount: 180750, dueDate: '2026-08-24', periodYear: 2026, periodMonth: 8 });
    expect(next).toMatchObject({ kind: 'next_month', amount: 723000, dueDate: '2026-09-05', periodYear: 2026, periodMonth: 9 });
  });

  it('diciembre → enero del año siguiente', () => {
    const [partial, next] = calcRemainingClassesPayment({
      cutoffDay: 10, today: '2026-12-20', startDate: '2026-12-20', monthlyFee: 457000, classesRemaining: 3, classesPerPeriod: 12,
    });
    expect(partial).toMatchObject({ periodYear: 2026, periodMonth: 12, amount: Math.round(3 * 457000 / 12) });
    expect(next).toMatchObject({ periodYear: 2027, periodMonth: 1, dueDate: '2027-01-10' });
  });

  it('D14b: parcial con vencimiento el 1 del mes siguiente', () => {
    const [partial, next] = calcRemainingClassesPayment({
      ...base, startDate: '2026-08-24', monthlyFee: 723000, classesRemaining: 2, classesPerPeriod: 8,
      partialDue: 'next_month_first',
    });
    expect(partial.dueDate).toBe('2026-09-01');
    expect(partial.periodMonth).toBe(8);          // el período sigue siendo agosto
    expect(next.dueDate).toBe('2026-09-05');
  });

  it('el descuento del primer mes solo toca la fila parcial', () => {
    const [partial, next] = calcRemainingClassesPayment({
      ...base, startDate: '2026-08-24', monthlyFee: 723000, classesRemaining: 2, classesPerPeriod: 8, discountPct: 10,
    });
    expect(partial.amount).toBe(Math.round(180750 * 0.9));
    expect(next.amount).toBe(723000);
  });

  it('alta con fecha pasada: el parcial vence hoy, no nace vencido', () => {
    const [partial] = calcRemainingClassesPayment({
      cutoffDay: 5, today: '2026-08-27', startDate: '2026-08-24', monthlyFee: 723000, classesRemaining: 2, classesPerPeriod: 8,
    });
    expect(partial.dueDate).toBe('2026-08-27');
  });

  it('corte mayor que el último día del mes siguiente se acota (febrero)', () => {
    const [, next] = calcRemainingClassesPayment({
      cutoffDay: 31, today: '2027-01-20', startDate: '2027-01-20', monthlyFee: 100000, classesRemaining: 1, classesPerPeriod: 4,
    });
    expect(next.dueDate).toBe('2027-02-28');
  });

  it('valida 1 ≤ clases restantes < clases del período', () => {
    const args = { ...base, startDate: '2026-08-24', monthlyFee: 723000, classesPerPeriod: 8 };
    expect(() => calcRemainingClassesPayment({ ...args, classesRemaining: 0 })).toThrow(RemainingClassesError);
    expect(() => calcRemainingClassesPayment({ ...args, classesRemaining: 8 })).toThrow(RemainingClassesError);
    expect(() => calcRemainingClassesPayment({ ...args, classesRemaining: 2.5 })).toThrow(RemainingClassesError);
    expect(() => calcRemainingClassesPayment({ ...args, classesRemaining: 7 })).not.toThrow();
  });
});

describe('remainingClassesEligibility', () => {
  const ok = { flagEnabled: true, cycleType: 'fixed_calendar', plan: PGC8x3, schoolBlockMinutes: 120 };

  it('elegible con flag + plan mensual con clases definidas', () => {
    expect(remainingClassesEligibility(ok)).toEqual({ eligible: true, classes: 8, source: 'minutes' });
  });

  it('flag apagado → no', () => {
    expect(remainingClassesEligibility({ ...ok, flagEnabled: false }).eligible).toBe(false);
  });

  it('sin plan → no', () => {
    expect(remainingClassesEligibility({ ...ok, plan: null }).eligible).toBe(false);
  });

  it('plan no mensual (duration_days < 28) → no', () => {
    expect(remainingClassesEligibility({ ...ok, plan: { ...PGC8x3, duration_days: 1 } }).eligible).toBe(false);
  });

  it('rolling_30 → no', () => {
    expect(remainingClassesEligibility({ ...ok, cycleType: 'rolling_30' }).eligible).toBe(false);
  });

  it('plan sin clases por período → no', () => {
    const r = remainingClassesEligibility({
      ...ok, plan: { included_minutes_per_period: null, session_block_minutes: null, max_sessions: null, duration_days: 30 },
    });
    expect(r.eligible).toBe(false);
  });
});
