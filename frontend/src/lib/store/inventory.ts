/**
 * Productos e inventario del lado de la tienda (panel del vendedor).
 *
 *  - Estados del producto en español.
 *  - Motivos del ajuste rápido → reason_code de inventory_adjust + nota.
 *  - Filas de stock por variante para el asistente: combinaciones de la matriz
 *    talla × color unidas con las variantes que ya existen (al editar).
 *  - Etiquetas del kardex.
 *
 * El stock "real" de cada producto lo calcula el BFF (GET /api/v1/vendor/products
 * → stock_total = suma de variantes activas, stock_level según min_stock_alert).
 *
 * Se prueba en src/test/storeInventory.test.ts.
 */

// ─── Estado del producto ─────────────────────────────────────────────────────

export const PRODUCT_STATUSES = ['active', 'draft', 'pending_review', 'archived', 'rejected'] as const;
export type ProductStatus = typeof PRODUCT_STATUSES[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
    active: 'Activo',
    draft: 'Borrador',
    pending_review: 'En revisión',
    archived: 'Archivado',
    rejected: 'Rechazado',
};

export function productStatusLabel(raw: string | null | undefined): string {
    if (!raw) return 'Sin estado';
    return (PRODUCT_STATUS_LABELS as Record<string, string>)[raw] ?? raw;
}

export function productStatusVariant(raw: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (raw) {
        case 'active': return 'default';
        case 'pending_review': return 'outline';
        case 'rejected': return 'destructive';
        default: return 'secondary';
    }
}

// ─── Nivel de stock ──────────────────────────────────────────────────────────

export type StockLevel = 'ok' | 'low' | 'out';

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
    ok: 'Con stock',
    low: 'Stock bajo',
    out: 'Agotado',
};

export function stockLevel(available: number, threshold: number): StockLevel {
    if (available <= 0) return 'out';
    if (available <= threshold) return 'low';
    return 'ok';
}

// ─── Producto como lo entrega el BFF ─────────────────────────────────────────

export interface VendorVariant {
    id: string;
    sku: string | null;
    name: string;
    attributes: Record<string, string>;
    price_override: number | null;
    stock: number;
    reserved?: number | null;
    image_url?: string | null;
    is_active: boolean | null;
    sort_order?: number | null;
}

export interface VendorProduct {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number;
    category: string | null;
    category_id: string | null;
    product_categories?: { id: string; slug: string; name: string } | null;
    image_url: string | null;
    status: string;
    visibility: string | null;
    min_stock_alert: number | null;
    product_variants: VendorVariant[];
    // calculados por el BFF
    has_variants: boolean;
    stock_total: number;
    reserved_total: number;
    available_total: number;
    stock_level: StockLevel;
    low_stock_variants: number;
    out_of_stock_variants: number;
}

/** Nombre de la categoría real del producto (la del catálogo; si no, el texto legacy). */
export function productCategoryName(p: Pick<VendorProduct, 'product_categories' | 'category'>): string {
    return p.product_categories?.name || p.category || 'Sin categoría';
}

export function variantAvailable(v: Pick<VendorVariant, 'stock' | 'reserved'>): number {
    return Math.max(0, Number(v.stock ?? 0) - Number(v.reserved ?? 0));
}

export interface InventoryFilters {
    search?: string;
    status?: string;          // 'all' | ProductStatus
    category?: string;        // 'all' | nombre de categoría
    level?: string;           // 'all' | StockLevel
}

export function filterProducts<T extends VendorProduct>(products: T[], f: InventoryFilters): T[] {
    const q = (f.search ?? '').trim().toLowerCase();
    return products.filter((p) => {
        if (f.status && f.status !== 'all' && p.status !== f.status) return false;
        if (f.category && f.category !== 'all' && productCategoryName(p) !== f.category) return false;
        if (f.level && f.level !== 'all' && p.stock_level !== f.level) return false;
        if (q) {
            const hay = [p.name, p.description ?? '', productCategoryName(p),
                ...p.product_variants.map((v) => `${v.name} ${v.sku ?? ''}`)].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

/** Categorías que la tienda realmente usa, con unidades y productos (para "Stock por categoría"). */
export function stockByCategory(products: VendorProduct[]): { category: string; units: number; products: number }[] {
    const map = new Map<string, { category: string; units: number; products: number }>();
    for (const p of products) {
        if (p.status === 'archived') continue;
        const c = productCategoryName(p);
        const cur = map.get(c) ?? { category: c, units: 0, products: 0 };
        cur.units += Number(p.stock_total ?? 0);
        cur.products += 1;
        map.set(c, cur);
    }
    return [...map.values()].sort((a, b) => b.units - a.units || a.category.localeCompare(b.category));
}

// ─── Ajuste rápido con motivo ────────────────────────────────────────────────

export type InventoryReasonCode = 'manual_adjust' | 'manual_restock';

export interface AdjustMotive {
    id: string;
    label: string;
    reason_code: InventoryReasonCode;
}

/** Motivos que ve el vendedor. La base guarda reason_code + la nota "Motivo: detalle". */
export const ADJUST_MOTIVES: AdjustMotive[] = [
    { id: 'llego_mercancia', label: 'Llegó mercancía', reason_code: 'manual_restock' },
    { id: 'conteo_fisico', label: 'Conteo físico', reason_code: 'manual_adjust' },
    { id: 'dano_perdida', label: 'Daño o pérdida', reason_code: 'manual_adjust' },
    { id: 'devolucion', label: 'Devolución de un cliente', reason_code: 'manual_restock' },
    { id: 'venta_fuera', label: 'Venta por fuera de la app', reason_code: 'manual_adjust' },
    { id: 'error_carga', label: 'Corrección de un error', reason_code: 'manual_adjust' },
];

export function buildAdjustNote(motiveId: string, detail: string | null | undefined): string {
    const m = ADJUST_MOTIVES.find((x) => x.id === motiveId);
    const label = m?.label ?? 'Ajuste';
    const d = (detail ?? '').trim();
    return (d ? `${label}: ${d}` : label).slice(0, 500);
}

export function motiveReasonCode(motiveId: string): InventoryReasonCode {
    return ADJUST_MOTIVES.find((x) => x.id === motiveId)?.reason_code ?? 'manual_adjust';
}

// ─── Kardex ──────────────────────────────────────────────────────────────────

export interface KardexEntry {
    id: string;
    variant_id: string | null;
    variant_name: string | null;
    delta: number;
    stock_before: number;
    stock_after: number;
    reason: string;
    note: string | null;
    order_id: string | null;
    actor_name: string | null;
    created_at: string;
}

const KARDEX_REASON_LABELS: Record<string, string> = {
    manual_adjust: 'Ajuste',
    manual_restock: 'Entrada',
    order_paid: 'Venta',
    order_cancelled: 'Pedido cancelado',
    returned: 'Devolución',
};

export function kardexReasonLabel(reason: string): string {
    return KARDEX_REASON_LABELS[reason] ?? reason;
}

// ─── Stock por variante en el asistente ──────────────────────────────────────

/** Clave estable de una combinación (misma regla que el BFF: claves ordenadas, valores en minúscula). */
export function comboKey(attrs: Record<string, unknown>): string {
    return Object.keys(attrs)
        .sort()
        .map((k) => `${k}=${String(attrs[k] ?? '').trim().toLowerCase()}`)
        .join('|');
}

/** Producto cartesiano siguiendo el orden de los ejes del schema. */
export function cartesian(axes: string[], matrix: Record<string, string[]>): Record<string, string>[] {
    const keys = axes.filter((k) => (matrix[k]?.length ?? 0) > 0);
    if (keys.length === 0) return [];
    return keys.reduce<Record<string, string>[]>((acc, key) => {
        const values = matrix[key];
        if (acc.length === 0) return values.map((v) => ({ [key]: v }));
        const next: Record<string, string>[] = [];
        for (const prev of acc) for (const v of values) next.push({ ...prev, [key]: v });
        return next;
    }, []);
}

export interface VariantStockRow {
    key: string;
    label: string;
    attributes: Record<string, string>;
    /** Variante que ya existe (al editar). */
    variant_id: string | null;
    current_stock: number | null;
    reserved: number;
    is_active: boolean;
    /** Stock que quedará al guardar. */
    stock: number;
}

/**
 * Filas de la tabla de stock: primero las variantes existentes (no se borran
 * ni se desactivan solas si se quita un valor de la matriz), luego las
 * combinaciones nuevas de la matriz. `stocks` guarda lo que el usuario escribió.
 */
export function buildVariantRows(
    axes: string[],
    matrix: Record<string, string[]>,
    existing: VendorVariant[],
    stocks: Record<string, number>,
    active: Record<string, boolean> = {},
    defaultStock = 0,
): VariantStockRow[] {
    const rows: VariantStockRow[] = [];
    const seen = new Set<string>();
    const label = (a: Record<string, string>) => {
        const ordered = [...axes.filter((k) => k in a), ...Object.keys(a).filter((k) => !axes.includes(k))];
        return ordered.map((k) => a[k]).join(' / ');
    };

    for (const v of existing) {
        const attrs = Object.fromEntries(Object.entries(v.attributes ?? {}).map(([k, x]) => [k, String(x)]));
        const key = Object.keys(attrs).length > 0 ? comboKey(attrs) : `id:${v.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
            key,
            label: Object.keys(attrs).length > 0 ? label(attrs) : v.name,
            attributes: attrs,
            variant_id: v.id,
            current_stock: Number(v.stock ?? 0),
            reserved: Number(v.reserved ?? 0),
            is_active: active[key] ?? v.is_active !== false,
            stock: stocks[key] ?? Number(v.stock ?? 0),
        });
    }
    for (const attrs of cartesian(axes, matrix)) {
        const key = comboKey(attrs);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
            key, label: label(attrs), attributes: attrs, variant_id: null, current_stock: null, reserved: 0,
            is_active: active[key] ?? true, stock: stocks[key] ?? defaultStock,
        });
    }
    return rows;
}

export interface VariantSavePlan {
    create: { attributes: Record<string, string>; stock: number; price_override: number | null }[];
    adjust: { variant_id: string; from: number; to: number; reason_code: InventoryReasonCode }[];
    toggle: { variant_id: string; is_active: boolean }[];
}

/** Qué hay que mandar al BFF al guardar: variantes nuevas, ajustes de stock y altas/bajas. */
export function planVariantSave(
    rows: VariantStockRow[],
    existing: VendorVariant[] = [],
    priceOverride: number | null = null,
): VariantSavePlan {
    const plan: VariantSavePlan = { create: [], adjust: [], toggle: [] };
    const before = new Map(existing.map((v) => [v.id, v.is_active !== false]));
    for (const r of rows) {
        const stock = Math.max(0, Math.trunc(Number(r.stock) || 0));
        if (!r.variant_id) {
            if (r.is_active) plan.create.push({ attributes: r.attributes, stock, price_override: priceOverride });
            continue;
        }
        if (r.current_stock !== null && stock !== r.current_stock) {
            plan.adjust.push({
                variant_id: r.variant_id, from: r.current_stock, to: stock,
                reason_code: stock > r.current_stock ? 'manual_restock' : 'manual_adjust',
            });
        }
        if (before.has(r.variant_id) && before.get(r.variant_id) !== r.is_active) {
            plan.toggle.push({ variant_id: r.variant_id, is_active: r.is_active });
        }
    }
    return plan;
}

/** Atributos obligatorios del producto que un producto viejo no tiene (no deben trabar la edición). */
export function legacyMissingRequired(
    schema: { key: string; required: boolean; applies_to: string }[],
    attrs: Record<string, unknown>,
): string[] {
    return schema
        .filter((f) => f.applies_to === 'product' && f.required)
        .filter((f) => {
            const v = attrs[f.key];
            return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
        })
        .map((f) => f.key);
}

export function formatCOP(n: number | null | undefined): string {
    return `$${Math.round(Number(n ?? 0)).toLocaleString('es-CO')}`;
}
