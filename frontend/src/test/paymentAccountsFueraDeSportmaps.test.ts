/**
 * Cuentas que la escuela acepta «por fuera de SportMaps» (2026-10-13): el
 * Nequi de un entrenador para los torneos. Datos inventados.
 */
import { describe, it, expect } from 'vitest';
import {
    parsePaymentAccounts, resolvePaymentAccounts, resolvePaymentLink, accountsToLegacyColumns, serializePaymentAccounts,
} from '@/lib/payment-accounts';

const raw = [
    { id: 'a', type: 'nequi', label: 'Club', value: '3001112222', active: true },
    { id: 'b', type: 'nequi', label: 'Entrenador', value: '3009998888', active: true, fuera_de_sportmaps: true },
    { id: 'c', type: 'payment_link', label: 'Link', value: 'https://checkout.wompi.co/l/abc', active: true, fuera_de_sportmaps: true },
];

describe('fuera_de_sportmaps', () => {
    it('el parseo conserva la marca (guardar el panel no la borra)', () => {
        const cuentas = parsePaymentAccounts(raw);
        expect(cuentas.find((c) => c.id === 'b')?.fuera_de_sportmaps).toBe(true);
        expect(cuentas.find((c) => c.id === 'a')?.fuera_de_sportmaps).toBeUndefined();
        expect(serializePaymentAccounts(cuentas).find((c) => c.id === 'b')?.fuera_de_sportmaps).toBe(true);
    });

    it('no se le muestra al acudiente (ni como cuenta ni como link); el panel sí la ve', () => {
        expect(resolvePaymentAccounts({ payment_accounts: raw }).map((c) => c.id)).toEqual(['a']);
        expect(resolvePaymentAccounts({ payment_accounts: raw }, { category: 'torneo' }).map((c) => c.id)).toEqual(['a']);
        expect(resolvePaymentLink({ payment_accounts: raw })).toBeNull();
        expect(resolvePaymentAccounts({ payment_accounts: raw }, { onlyActive: false }).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('no se espeja a las columnas viejas (las leen caminos que no conocen la marca)', () => {
        const soloFuera = parsePaymentAccounts([raw[1]]);
        expect(accountsToLegacyColumns(soloFuera).nequi_number).toBeNull();
        expect(accountsToLegacyColumns(parsePaymentAccounts(raw)).nequi_number).toBe('3001112222');
    });
});
