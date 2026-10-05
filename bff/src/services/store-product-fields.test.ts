/**
 * Campos editables de producto / variante (tienda v2 F0, M-F0-2).
 * El BFF usa service role: la lista blanca y la regla "stock no se escribe por
 * PATCH" viven acá, no solo en los GRANT de la base.
 */

import { describe, it, expect } from 'vitest';
import {
    PRODUCT_EDITABLE_FIELDS,
    VARIANT_EDITABLE_FIELDS,
    parseStock,
    pickEditable,
    buildDuplicateRow,
} from './store-product-fields';

describe('listas blancas', () => {
    it.each(['stock', 'vendor_id', 'vendor_profile_id', 'school_id', 'id', 'created_at'])(
        'producto: %s no es editable por PATCH',
        (f) => expect(PRODUCT_EDITABLE_FIELDS as readonly string[]).not.toContain(f),
    );
    it.each(['stock', 'product_id', 'id', 'created_at'])(
        'variante: %s no es editable por PATCH',
        (f) => expect(VARIANT_EDITABLE_FIELDS as readonly string[]).not.toContain(f),
    );
});

describe('pickEditable', () => {
    it('descarta stock y las llaves de dueño', () => {
        const body = {
            name: 'Camiseta', price: 50000, stock: 999, vendor_id: 'x', vendor_profile_id: 'y',
            school_id: 'z', id: 'w', status: 'draft',
        };
        expect(pickEditable(body, PRODUCT_EDITABLE_FIELDS)).toEqual({ name: 'Camiseta', price: 50000, status: 'draft' });
    });

    it('variante: solo campos de variante', () => {
        expect(pickEditable({ name: 'M', stock: 3, product_id: 'p', is_active: false }, VARIANT_EDITABLE_FIELDS))
            .toEqual({ name: 'M', is_active: false });
    });

    it('body vacío / nulo', () => {
        expect(pickEditable(null, PRODUCT_EDITABLE_FIELDS)).toEqual({});
        expect(pickEditable({ price: undefined }, PRODUCT_EDITABLE_FIELDS)).toEqual({});
    });
});

describe('parseStock', () => {
    it('ausente', () => {
        expect(parseStock({})).toEqual({ present: false });
        expect(parseStock({ stock: null })).toEqual({ present: false });
        expect(parseStock(undefined)).toEqual({ present: false });
    });
    it.each([[0, 0], [5, 5], ['12', 12]])('%s → %i', (raw, value) => {
        expect(parseStock({ stock: raw })).toEqual({ present: true, valid: true, value });
    });
    it.each([-1, 1.5, 'abc', true, {}])('%s es inválido', (raw) => {
        expect(parseStock({ stock: raw as any })).toEqual({ present: true, valid: false });
    });
});

describe('buildDuplicateRow', () => {
    it('no copia dueño, escuela, stock, id ni sku; queda en borrador', () => {
        const row = buildDuplicateRow({
            id: 'p1', name: 'Balón', price: 1, vendor_id: 'u1', school_id: 's1', vendor_profile_id: 'vp1',
            stock: 40, sku: 'SKU-1', status: 'active', created_at: 't', product_variants: [{}],
        });
        expect(row).toEqual({ name: 'Balón (copia)', price: 1, vendor_profile_id: 'vp1', status: 'draft', stock: 0 });
    });
});
