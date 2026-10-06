/**
 * Link de pago genérico (type 'payment_link') en el frontend.
 * Caso Dynasty 2026-10-06: link de Wompi https://checkout.wompi.co/l/Hj5s7R.
 * Lo que se vigila: guardar el panel no lo borra, no se ofrece como llave para
 * copiar, no se espeja a columnas viejas y solo vale si es https.
 */
import { describe, it, expect } from 'vitest';
import {
    accountsToLegacyColumns,
    isValidPaymentLinkUrl,
    parsePaymentAccounts,
    resolvePaymentAccounts,
    resolvePaymentLink,
    serializePaymentAccounts,
} from '@/lib/payment-accounts';

const LINK = 'https://checkout.wompi.co/l/Hj5s7R';
const RAW = [
    { id: 'a', type: 'breb', label: 'Bre-B', value: '0092231411', active: true },
    { id: 'w', type: 'payment_link', label: 'Pagar con tarjeta, PSE o Nequi (Wompi)', value: LINK, active: true },
];

describe('payment_link', () => {
    it('parsePaymentAccounts lo conserva (guardar el panel no lo borra)', () => {
        const parsed = parsePaymentAccounts(RAW);
        expect(parsed.map(a => a.type)).toEqual(['breb', 'payment_link']);
        expect(serializePaymentAccounts(parsed).find(a => a.type === 'payment_link')?.value).toBe(LINK);
        // El panel (onlyActive=false) lo ve para editarlo.
        expect(resolvePaymentAccounts({ payment_accounts: RAW }, { onlyActive: false })).toHaveLength(2);
    });

    it('al acudiente no se le lista como llave; sale por resolvePaymentLink', () => {
        const llaves = resolvePaymentAccounts({ payment_accounts: RAW });
        expect(llaves.map(a => a.value)).toEqual(['0092231411']);
        expect(resolvePaymentLink({ payment_accounts: RAW })).toBe(LINK);
        expect(resolvePaymentLink({ payment_accounts: [{ ...RAW[1], active: false }] })).toBeNull();
        expect(resolvePaymentLink({ payment_accounts: [{ ...RAW[1], only_for: ['inscripcion'] }] }, { category: 'mensualidad' })).toBeNull();
    });

    it('una lista con solo el link no esconde las columnas viejas', () => {
        const llaves = resolvePaymentAccounts({ payment_accounts: [RAW[1]], nequi_number: '3001234567' });
        expect(llaves.map(a => a.value)).toEqual(['3001234567']);
    });

    it('no se espeja a columnas legacy', () => {
        const cols = accountsToLegacyColumns(parsePaymentAccounts([RAW[1]]));
        expect(Object.values(cols).every(v => v === null)).toBe(true);
    });

    it('solo https', () => {
        expect(isValidPaymentLinkUrl(LINK)).toBe(true);
        expect(isValidPaymentLinkUrl('http://checkout.wompi.co/l/x')).toBe(false);
        expect(isValidPaymentLinkUrl('checkout.wompi.co/l/x')).toBe(false);
        expect(isValidPaymentLinkUrl('javascript:alert(1)')).toBe(false);
        expect(resolvePaymentLink({ payment_accounts: [{ ...RAW[1], value: 'http://x.co' }] })).toBeNull();
    });
});
