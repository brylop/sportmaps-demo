import { describe, it, expect } from 'vitest';
import { saldoPorCobrar, ESTADOS_PAGABLES_EN_LINEA } from './saldo-cobro';

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
