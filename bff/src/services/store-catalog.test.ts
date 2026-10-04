import { describe, it, expect } from 'vitest';
import { shapeCatalogProduct, shapeStoreCatalog, canSeeSchoolOnly, type CatalogProductRow } from './store-catalog';

const SCHOOL = '00000000-0000-4000-b000-000000000001';

function product(over: Partial<CatalogProductRow> = {}): CatalogProductRow {
    return {
        id: 'p1', name: 'Camiseta', description: null, price: 65000, image_url: 'a.png', category: null,
        stock: 0, reserved: 0, visibility: 'public', school_id: null, tax_rate: 0.19, min_stock_alert: 5,
        product_variants: [], product_images: [], ...over,
    };
}

describe('store-catalog — disponibilidad (B3)', () => {
    it('producto con variantes NO está agotado si alguna variante tiene stock, aunque products.stock sea 0', () => {
        const p = shapeCatalogProduct(product({
            stock: 0,
            product_variants: [
                { id: 'v1', name: 'S', attributes: { talla: 'S' }, price_override: null, stock: 5, reserved: 1, image_url: null, is_active: true, sort_order: 1 },
                { id: 'v2', name: 'L', attributes: { talla: 'L' }, price_override: null, stock: 0, reserved: 0, image_url: null, is_active: true, sort_order: 2 },
            ],
        }));
        expect(p.sold_out).toBe(false);
        expect(p.available).toBe(4);
        expect(p.variants.map((v) => v.available)).toEqual([4, 0]);
        expect(p.has_variants).toBe(true);
    });

    it('agotado solo si TODAS las variantes activas están en 0 (reservado cuenta)', () => {
        const p = shapeCatalogProduct(product({
            stock: 10,
            product_variants: [
                { id: 'v1', name: 'S', attributes: {}, price_override: null, stock: 2, reserved: 2, image_url: null, is_active: true, sort_order: 1 },
                { id: 'v2', name: 'M', attributes: {}, price_override: null, stock: 9, reserved: 0, image_url: null, is_active: false, sort_order: 2 },
            ],
        }));
        expect(p.sold_out).toBe(true);
        expect(p.variants).toHaveLength(1);
    });

    it('sin variantes usa stock - reserved del producto', () => {
        expect(shapeCatalogProduct(product({ stock: 1, reserved: 1 })).sold_out).toBe(true);
        expect(shapeCatalogProduct(product({ stock: 3, reserved: 1 })).available).toBe(2);
    });

    it('precio de la variante = price_override o el del producto; atributos en minúscula', () => {
        const p = shapeCatalogProduct(product({
            product_variants: [
                { id: 'v1', name: 'XL', attributes: { Talla: 'XL', Color: 'Azul' }, price_override: 70000, stock: 1, reserved: 0, image_url: null, is_active: true, sort_order: 1 },
                { id: 'v2', name: 'S', attributes: { Talla: 'S' }, price_override: null, stock: 1, reserved: 0, image_url: null, is_active: true, sort_order: 0 },
            ],
        }));
        expect(p.variants[0].id).toBe('v2');
        expect(p.variants[0].price).toBe(65000);
        expect(p.variants[1].price).toBe(70000);
        expect(p.variants[1].attributes).toEqual({ talla: 'XL', color: 'Azul' });
    });
});

describe('store-catalog — school_only (B4)', () => {
    const rows = [
        product({ id: 'pub', visibility: 'public', stock: 1 }),
        product({ id: 'so', visibility: 'school_only', school_id: SCHOOL, stock: 1 }),
        product({ id: 'so-otra', visibility: 'school_only', school_id: 'otra', stock: 1 }),
        product({ id: 'priv', visibility: 'private', stock: 1 }),
    ];

    it('anónimo o ajeno: solo public', () => {
        expect(shapeStoreCatalog(rows, { storeSchoolId: SCHOOL, memberSchoolIds: [] }).map((p) => p.id)).toEqual(['pub']);
        expect(shapeStoreCatalog(rows, { storeSchoolId: SCHOOL, memberSchoolIds: ['otra'] }).map((p) => p.id)).toEqual(['pub']);
    });

    it('miembro de la escuela de la tienda: public + school_only de ESA escuela', () => {
        expect(shapeStoreCatalog(rows, { storeSchoolId: SCHOOL, memberSchoolIds: [SCHOOL] }).map((p) => p.id)).toEqual(['pub', 'so']);
    });

    it('tienda sin escuela (vendedor externo): nunca school_only', () => {
        expect(canSeeSchoolOnly(null, [SCHOOL])).toBe(false);
    });
});
