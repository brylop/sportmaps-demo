import { describe, it, expect } from 'vitest';
import { saldoPorCobrar, saldoDelCobro, ESTADOS_PAGABLES_EN_LINEA } from './saldo-cobro';

describe('saldoPorCobrar (= frontend/src/lib/cobrosYPagos.ts)', () => {
    it('amount − amount_paid − early_payment_discount_applied', () => {
        expect(saldoPorCobrar({ amount: '160000.00', amount_paid: '150000.00', early_payment_discount_applied: null })).toBe(10000);
        expect(saldoPorCobrar({ amount: 150000, amount_paid: 0, early_payment_discount_applied: 15000 })).toBe(135000);
        expect(saldoPorCobrar({ amount: 150000 })).toBe(150000);
    });
    it('nunca negativo ni NaN', () => {
        expect(saldoPorCobrar({ amount: 100000, amount_paid: 120000 })).toBe(0);
        expect(saldoPorCobrar({ amount: 'x' as any, amount_paid: null })).toBe(0);
    });
    it('partial es pagable en línea', () => {
        expect(ESTADOS_PAGABLES_EN_LINEA).toEqual(['pending', 'overdue', 'partial']);
    });
});


describe('saldoDelCobro', () => {
    it('amount - amount_paid - pronto pago, nunca negativo', () => {
        expect(saldoDelCobro({ amount: 165000 })).toBe(165000);
        expect(saldoDelCobro({ amount: '165000', amount_paid: '50000', early_payment_discount_applied: '10000' })).toBe(105000);
        expect(saldoDelCobro({ amount: 100000, amount_paid: 120000 })).toBe(0);
        expect(saldoDelCobro({ amount: null, amount_paid: null, early_payment_discount_applied: null })).toBe(0);
    });
});
