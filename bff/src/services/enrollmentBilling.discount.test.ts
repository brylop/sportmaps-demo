import { describe, it, expect, vi } from 'vitest';

// El cliente de Supabase se crea al importar; aquí solo se prueba lógica pura.
vi.mock('../config/supabase', () => ({ supabase: {} }));

import { amountWithDiscount, impliedDiscountPct } from './enrollmentBilling';
import { buildAltaPayments } from '../routes/students-create-one.route';

describe('amountWithDiscount', () => {
    it('sin descuento devuelve la cuota completa', () => {
        expect(amountWithDiscount(245000, null)).toBe(245000);
        expect(amountWithDiscount(245000, undefined)).toBe(245000);
        expect(amountWithDiscount(245000, 0)).toBe(245000);
    });

    it('aplica el descuento del cobro (caso Zoe: 5 % de 245.000)', () => {
        expect(amountWithDiscount(245000, 5)).toBe(232750);
        expect(amountWithDiscount(245000, '5.00')).toBe(232750);
    });

    it('ignora porcentajes fuera de rango', () => {
        expect(amountWithDiscount(100000, 100)).toBe(100000);
        expect(amountWithDiscount(100000, -5)).toBe(100000);
    });
});

describe('impliedDiscountPct', () => {
    it('usa el % guardado al registrar', () => {
        expect(impliedDiscountPct({ discount_pct: '5.00', amount: 232750 })).toBe(5);
    });

    it('sin % guardado, deduce el de hermanos a partir del valor descontado', () => {
        // 10 % sobre 200.000 = 20.000 de descuento, monto 180.000.
        expect(impliedDiscountPct({ sibling_discount_applied: 20000, amount: 180000 })).toBeCloseTo(10, 5);
    });

    it('sin ningún descuento devuelve 0', () => {
        expect(impliedDiscountPct({ amount: 245000 })).toBe(0);
        expect(impliedDiscountPct({ discount_pct: null, sibling_discount_applied: null, amount: 1000 })).toBe(0);
    });

    it('al cambiar la cuota, el hermano conserva su proporción', () => {
        const pct = impliedDiscountPct({ sibling_discount_applied: 20000, amount: 180000 });
        expect(amountWithDiscount(250000, pct)).toBe(225000);
    });
});

describe('buildAltaPayments: el descuento viaja con el cobro', () => {
    const base = {
        schoolId: 's1', athleteCol: 'child_id' as const, athleteId: 'c1', branchId: null, teamId: null,
        offeringPlanId: 'p1', baseFee: 245000, startDate: '2026-10-10',
        cycleType: 'fixed_calendar' as const, cutoffDay: 5,
        conceptName: 'Plan PGP8x1', personName: 'Zoe', remaining: null, today: '2026-10-10',
    };

    it('mes completo con 5 %: monto descontado, % y precio de lista guardados', () => {
        const [row] = buildAltaPayments({ ...base, discountPct: 5 });
        expect(row.amount).toBe(232750);
        expect(row.discount_pct).toBe(5);
        expect(row.list_amount).toBe(245000);
    });

    it('sin descuento no agrega los campos', () => {
        const [row] = buildAltaPayments(base);
        expect(row.amount).toBe(245000);
        expect(row.discount_pct).toBeUndefined();
        expect(row.list_amount).toBeUndefined();
    });
});
