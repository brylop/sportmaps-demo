import { describe, it, expect } from 'vitest';
import {
    productStockView, stockLevel, parseVariantSpecs, comboKey, cartesian, variantDisplayName,
    buildSalesInsights, parsePeriodDays,
} from './store-inventory';

describe('productStockView', () => {
    it('con variantes: suma solo las activas y descuenta lo reservado', () => {
        const v = productStockView({
            stock: 0, min_stock_alert: 3,
            product_variants: [
                { stock: 10, reserved: 1, is_active: true },
                { stock: 2, reserved: 0, is_active: true },
                { stock: 0, reserved: 0, is_active: true },
                { stock: 50, reserved: 0, is_active: false },
            ],
        });
        expect(v.has_variants).toBe(true);
        expect(v.stock_total).toBe(12);
        expect(v.reserved_total).toBe(1);
        expect(v.available_total).toBe(11);
        expect(v.stock_level).toBe('ok');
        expect(v.low_stock_variants).toBe(1);      // 2 <= 3
        expect(v.out_of_stock_variants).toBe(1);   // 0
    });

    it('sin variantes: usa products.stock y el umbral del producto (no 20 fijo)', () => {
        expect(productStockView({ stock: 15, min_stock_alert: 5 }).stock_level).toBe('ok');
        expect(productStockView({ stock: 5, min_stock_alert: 5 }).stock_level).toBe('low');
        expect(productStockView({ stock: 0, min_stock_alert: 5 }).stock_level).toBe('out');
        expect(productStockView({ stock: 4, reserved: 4, min_stock_alert: 1 }).stock_level).toBe('out');
    });

    it('umbral nulo → 5 por defecto; umbral 0 → solo alerta al agotarse', () => {
        expect(productStockView({ stock: 5, min_stock_alert: null }).min_stock_alert).toBe(5);
        expect(productStockView({ stock: 1, min_stock_alert: 0 }).stock_level).toBe('ok');
    });

    it('stockLevel', () => {
        expect(stockLevel(-1, 3)).toBe('out');
        expect(stockLevel(3, 3)).toBe('low');
        expect(stockLevel(4, 3)).toBe('ok');
    });
});

describe('parseVariantSpecs', () => {
    it('lista explícita: cada talla con su stock', () => {
        const r = parseVariantSpecs({
            variants: [
                { attributes: { talla: 'S' }, stock: 12 },
                { attributes: { talla: 'M' }, stock: 7 },
                { attributes: { talla: 'L' }, stock: '3' },
            ],
        });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.variants.map((v) => v.stock)).toEqual([12, 7, 3]);
    });

    it('matrix legacy: mismo stock para todas', () => {
        const r = parseVariantSpecs({ matrix: { talla: ['S', 'M'], color: ['Negro'] }, defaults: { stock: 4 } });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.variants).toHaveLength(2);
            expect(r.variants.every((v) => v.stock === 4)).toBe(true);
        }
    });

    it('rechaza stock negativo, decimal, combinaciones repetidas y vacías', () => {
        expect(parseVariantSpecs({ variants: [{ attributes: { talla: 'S' }, stock: -1 }] }).ok).toBe(false);
        expect(parseVariantSpecs({ variants: [{ attributes: { talla: 'S' }, stock: 1.5 }] }).ok).toBe(false);
        expect(parseVariantSpecs({
            variants: [{ attributes: { talla: 'S', color: 'Azul' }, stock: 1 }, { attributes: { color: 'azul', talla: 's' }, stock: 2 }],
        }).ok).toBe(false);
        expect(parseVariantSpecs({ variants: [{ attributes: {}, stock: 1 }] }).ok).toBe(false);
        expect(parseVariantSpecs({ variants: [{ attributes: { talla: '  ' }, stock: 1 }] }).ok).toBe(false);
        expect(parseVariantSpecs({}).ok).toBe(false);
        expect(parseVariantSpecs({ matrix: { talla: [] } }).ok).toBe(false);
    });

    it('tope de 200 combinaciones', () => {
        const tallas = Array.from({ length: 21 }, (_, i) => `T${i}`);
        const colores = Array.from({ length: 10 }, (_, i) => `C${i}`);
        expect(parseVariantSpecs({ matrix: { talla: tallas, color: colores } }).ok).toBe(false);
    });
});

describe('helpers de matriz', () => {
    it('comboKey no depende del orden ni de mayúsculas', () => {
        expect(comboKey({ talla: 'S', color: 'Azul' })).toBe(comboKey({ color: 'azul', talla: 's ' }));
    });
    it('cartesian', () => {
        expect(cartesian({ talla: ['S', 'M'], color: ['A', 'B'] })).toHaveLength(4);
    });
    it('variantDisplayName', () => {
        expect(variantDisplayName({ talla: 'M', color: 'Negro' })).toBe('M / Negro');
    });
});

describe('buildSalesInsights', () => {
    const orders = [
        { id: 'o1', status: 'paid', total_amount: 100000 },
        { id: 'o2', status: 'delivered', total_amount: '50000' },
        { id: 'o3', status: 'pending_payment', total_amount: 999999 },
        { id: 'o4', status: 'cancelled', total_amount: 70000 },
    ];
    const items = [
        { order_id: 'o1', product_id: 'p1', quantity: 2, line_total: 60000 },
        { order_id: 'o1', product_id: 'p2', quantity: 1, line_total: 40000 },
        { order_id: 'o2', product_id: 'p2', quantity: 1, line_total: 50000 },
        { order_id: 'o3', product_id: 'p1', quantity: 9, line_total: 999999 },
    ];

    it('solo cuenta pedidos pagados en adelante', () => {
        const r = buildSalesInsights(orders, items, { p1: 'Proteína', p2: 'Licra' });
        expect(r.revenue).toBe(150000);
        expect(r.orders).toBe(2);
        expect(r.avg_ticket).toBe(75000);
        expect(r.units).toBe(4);
        // Empate en unidades → primero el de más ingresos.
        expect(r.top_products[0]).toEqual({ product_id: 'p2', name: 'Licra', units: 2, revenue: 90000 });
        expect(r.top_products[1]).toEqual({ product_id: 'p1', name: 'Proteína', units: 2, revenue: 60000 });
    });

    it('sin ventas: ceros, sin dividir por cero', () => {
        const r = buildSalesInsights([], [], {});
        expect(r).toEqual({ revenue: 0, orders: 0, avg_ticket: 0, units: 0, top_products: [] });
    });

    it('parsePeriodDays', () => {
        expect(parsePeriodDays('7')).toBe(7);
        expect(parsePeriodDays('15')).toBe(30);
        expect(parsePeriodDays(undefined)).toBe(30);
    });
});
