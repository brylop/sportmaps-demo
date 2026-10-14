import { describe, expect, it } from 'vitest';
import { saldoDelCobro } from './saldo-cobro';

describe('saldoDelCobro', () => {
    it('amount - amount_paid - pronto pago, nunca negativo', () => {
        expect(saldoDelCobro({ amount: 165000 })).toBe(165000);
        expect(saldoDelCobro({ amount: '165000', amount_paid: '50000', early_payment_discount_applied: '10000' })).toBe(105000);
        expect(saldoDelCobro({ amount: 100000, amount_paid: 120000 })).toBe(0);
        expect(saldoDelCobro({ amount: null, amount_paid: null, early_payment_discount_applied: null })).toBe(0);
    });
});
