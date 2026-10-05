/**
 * Llaves restringidas a un concepto (`only_for`) en el frontend.
 * Caso Dynasty 2026-10-05: Nequi personal de la dueña, solo para inscripciones.
 */
import { describe, it, expect } from 'vitest';
import {
    accountsToLegacyColumns,
    chargeCategoryOf,
    parsePaymentAccounts,
    resolvePaymentAccounts,
    serializePaymentAccounts,
} from '@/lib/payment-accounts';

const DYNASTY = {
    nequi_number: null,
    breb_number: '0092231411',
    payment_accounts: [
        { id: 'a', type: 'breb', label: 'Bre-B', value: '0092231411', active: true },
        { id: 'n', type: 'nequi', label: 'Nequi inscripciones', value: '3204298969', active: true, only_for: ['inscripcion'] },
    ],
};

describe('only_for en las llaves de pago', () => {
    it('el parseo conserva only_for (si no, guardar el panel borraría la restricción)', () => {
        const parsed = parsePaymentAccounts(DYNASTY.payment_accounts);
        expect(parsed[1].only_for).toEqual(['inscripcion']);
        const saved = JSON.parse(JSON.stringify(serializePaymentAccounts(parsed)));
        expect(saved[1].only_for).toEqual(['inscripcion']);
        expect(saved[0].only_for).toBeUndefined();
    });

    it('al acudiente: mensualidad o sin categoría NO ve el Nequi; inscripción sí', () => {
        const valores = (cat: Parameters<typeof resolvePaymentAccounts>[1]) =>
            resolvePaymentAccounts(DYNASTY, cat).map(a => a.value);
        expect(valores({ category: 'mensualidad' })).toEqual(['0092231411']);
        expect(valores({})).toEqual(['0092231411']);
        expect(valores({ category: 'inscripcion' })).toEqual(['0092231411', '3204298969']);
    });

    it('el panel del admin (onlyActive=false) ve todas', () => {
        expect(resolvePaymentAccounts(DYNASTY, { onlyActive: false })).toHaveLength(2);
    });

    it('la llave restringida no se espeja a nequi_number', () => {
        const cols = accountsToLegacyColumns(parsePaymentAccounts(DYNASTY.payment_accounts));
        expect(cols.nequi_number).toBeNull();
        expect(cols.breb_number).toBe('0092231411');
    });

    it('categoría por concepto', () => {
        expect(chargeCategoryOf(null, 'Inscripción Anual')).toBe('inscripcion');
        expect(chargeCategoryOf(null, 'Mensualidad Octubre 2026')).toBe('mensualidad');
        expect(chargeCategoryOf('otro', 'Pago mensualidad octubre')).toBe('mensualidad');
        expect(chargeCategoryOf(null, 'Abono')).toBeNull();
    });
});
