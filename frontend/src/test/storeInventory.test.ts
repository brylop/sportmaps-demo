import { describe, it, expect } from 'vitest';
import {
    buildAdjustNote, buildVariantRows, comboKey, filterProducts, legacyMissingRequired, motiveReasonCode,
    planVariantSave, productCategoryName, productStatusLabel, stockByCategory, stockLevel,
    type VendorProduct, type VendorVariant,
} from '@/lib/store/inventory';

const variant = (id: string, attrs: Record<string, string>, stock: number, extra: Partial<VendorVariant> = {}): VendorVariant => ({
    id, sku: null, name: Object.values(attrs).join(' / '), attributes: attrs, price_override: null,
    stock, reserved: 0, is_active: true, ...extra,
});

const product = (over: Partial<VendorProduct>): VendorProduct => ({
    id: 'p', name: 'Producto', description: null, price: 1000, stock: 0, category: null, category_id: null,
    product_categories: null, image_url: null, status: 'active', visibility: 'public', min_stock_alert: 5,
    product_variants: [], has_variants: false, stock_total: 0, reserved_total: 0, available_total: 0,
    stock_level: 'out', low_stock_variants: 0, out_of_stock_variants: 0, ...over,
});

describe('estado y nivel', () => {
    it('estado en español', () => {
        expect(productStatusLabel('active')).toBe('Activo');
        expect(productStatusLabel('draft')).toBe('Borrador');
        expect(productStatusLabel('pending_review')).toBe('En revisión');
        expect(productStatusLabel('archived')).toBe('Archivado');
        expect(productStatusLabel(null)).toBe('Sin estado');
    });
    it('nivel de stock según el umbral del producto', () => {
        expect(stockLevel(0, 5)).toBe('out');
        expect(stockLevel(5, 5)).toBe('low');
        expect(stockLevel(6, 5)).toBe('ok');
    });
});

describe('categorías reales y filtros', () => {
    const ps = [
        product({ id: 'a', name: 'Licra mujer', product_categories: { id: '1', slug: 'ropa-deportiva', name: 'Ropa Deportiva' }, stock_total: 30, stock_level: 'ok' }),
        product({ id: 'b', name: 'Whey 2 lb', product_categories: { id: '2', slug: 'suplementos', name: 'Suplementos' }, stock_total: 3, stock_level: 'low' }),
        product({ id: 'c', name: 'Shaker', category: 'Accesorios gym', stock_total: 0, stock_level: 'out' }),
        product({ id: 'd', name: 'Viejo', status: 'archived', stock_total: 99 }),
    ];
    it('usa la categoría del catálogo o el texto legacy, nunca una lista fija', () => {
        expect(productCategoryName(ps[0])).toBe('Ropa Deportiva');
        expect(productCategoryName(ps[2])).toBe('Accesorios gym');
        expect(productCategoryName(product({}))).toBe('Sin categoría');
        expect(stockByCategory(ps).map((c) => c.category)).toEqual(['Ropa Deportiva', 'Suplementos', 'Accesorios gym']);
    });
    it('filtra por estado, categoría, nivel y texto (incluye tallas)', () => {
        expect(filterProducts(ps, { level: 'low' }).map((p) => p.id)).toEqual(['b']);
        expect(filterProducts(ps, { category: 'Suplementos' }).map((p) => p.id)).toEqual(['b']);
        expect(filterProducts(ps, { status: 'archived' }).map((p) => p.id)).toEqual(['d']);
        const conTallas = [product({ id: 'e', name: 'Camiseta', product_variants: [variant('v', { talla: 'XL' }, 1)] })];
        expect(filterProducts(conTallas, { search: 'xl' })).toHaveLength(1);
    });
});

describe('ajuste con motivo', () => {
    it('motivo → reason_code y nota', () => {
        expect(motiveReasonCode('llego_mercancia')).toBe('manual_restock');
        expect(motiveReasonCode('dano_perdida')).toBe('manual_adjust');
        expect(buildAdjustNote('conteo_fisico', '')).toBe('Conteo físico');
        expect(buildAdjustNote('dano_perdida', ' se mojó ')).toBe('Daño o pérdida: se mojó');
    });
});

describe('stock por variante en el asistente', () => {
    const axes = ['talla', 'color'];

    it('al crear: cada combinación con su propio stock', () => {
        const matrix = { talla: ['S', 'M', 'L'], color: ['Negro'] };
        const stocks = {
            [comboKey({ talla: 'S', color: 'Negro' })]: 12,
            [comboKey({ talla: 'M', color: 'Negro' })]: 7,
            [comboKey({ talla: 'L', color: 'Negro' })]: 3,
        };
        const rows = buildVariantRows(axes, matrix, [], stocks);
        expect(rows.map((r) => [r.label, r.stock])).toEqual([['S / Negro', 12], ['M / Negro', 7], ['L / Negro', 3]]);
        const plan = planVariantSave(rows);
        expect(plan.create.map((c) => c.stock)).toEqual([12, 7, 3]);
        expect(plan.adjust).toHaveLength(0);
    });

    it('al editar: muestra el stock real de cada variante, no 0', () => {
        const existing = [variant('v1', { talla: 'S', color: 'Negro' }, 12), variant('v2', { talla: 'M', color: 'Negro' }, 7)];
        const rows = buildVariantRows(axes, { talla: ['S', 'M'], color: ['Negro'] }, existing, {});
        expect(rows.map((r) => r.stock)).toEqual([12, 7]);
        expect(rows.every((r) => r.variant_id)).toBe(true);
    });

    it('al editar: cambiar stock = ajuste (entrada o salida), talla nueva = alta, apagar = toggle', () => {
        const existing = [variant('v1', { talla: 'S', color: 'Negro' }, 12), variant('v2', { talla: 'M', color: 'Negro' }, 7)];
        const kS = comboKey({ talla: 'S', color: 'Negro' });
        const kM = comboKey({ talla: 'M', color: 'Negro' });
        const kXL = comboKey({ talla: 'XL', color: 'Negro' });
        const rows = buildVariantRows(axes, { talla: ['S', 'M', 'XL'], color: ['Negro'] }, existing,
            { [kS]: 15, [kM]: 2, [kXL]: 4 }, { [kM]: false });
        const plan = planVariantSave(rows, existing);
        expect(plan.adjust).toEqual([
            { variant_id: 'v1', from: 12, to: 15, reason_code: 'manual_restock' },
            { variant_id: 'v2', from: 7, to: 2, reason_code: 'manual_adjust' },
        ]);
        expect(plan.create).toEqual([{ attributes: { talla: 'XL', color: 'Negro' }, stock: 4, price_override: null }]);
        expect(plan.toggle).toEqual([{ variant_id: 'v2', is_active: false }]);
    });

    it('quitar un valor de la matriz NO borra ni apaga una variante existente', () => {
        const existing = [variant('v1', { talla: 'S' }, 5), variant('v2', { talla: 'M' }, 5)];
        const rows = buildVariantRows(['talla'], { talla: ['S'] }, existing, {});
        expect(rows.map((r) => r.variant_id)).toEqual(['v1', 'v2']);
        const plan = planVariantSave(rows, existing);
        expect(plan.toggle).toHaveLength(0);
        expect(plan.adjust).toHaveLength(0);
    });

    it('variantes legacy sin atributos se conservan por id', () => {
        const existing = [variant('v1', {}, 3, { name: 'Única' })];
        const rows = buildVariantRows(axes, {}, existing, {});
        expect(rows).toHaveLength(1);
        expect(rows[0].label).toBe('Única');
    });
});

describe('productos viejos sin un atributo hoy obligatorio', () => {
    it('detecta "genero" faltante', () => {
        const schema = [
            { key: 'genero', required: true, applies_to: 'product' },
            { key: 'deporte', required: false, applies_to: 'product' },
            { key: 'talla', required: true, applies_to: 'variant' },
        ];
        expect(legacyMissingRequired(schema, { deporte: 'gym' })).toEqual(['genero']);
        expect(legacyMissingRequired(schema, { genero: 'mujer' })).toEqual([]);
    });
});
