/**
 * Inventario y métricas de la tienda del lado del vendedor (puro, sin base).
 *
 *  - Stock de un producto: si tiene variantes, la suma de sus variantes activas
 *    (spec tienda v2 §4.1; la base lo cachea en products.stock con el trigger
 *    diferido de 20261008163938). Sin variantes, products.stock.
 *  - "Stock bajo": disponible (stock − reservado) <= products.min_stock_alert
 *    (el umbral de cada producto, no un número fijo) y > 0. Agotado: 0.
 *  - Matriz de variantes: combinaciones talla × color con su stock inicial.
 *  - Métricas de ventas: solo pedidos en los que el dinero entró.
 *
 * Se prueba en store-inventory.test.ts.
 */

export const DEFAULT_MIN_STOCK_ALERT = 5;

/** Estados de orden que cuentan como venta (mismo criterio que el panel: isOrderPaidLike). */
export const PAID_LIKE_STATUSES = ['paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered'] as const;

export interface VariantStockRow {
    id?: string;
    stock?: number | null;
    reserved?: number | null;
    is_active?: boolean | null;
}

export interface ProductStockRow {
    stock?: number | null;
    reserved?: number | null;
    min_stock_alert?: number | null;
    product_variants?: VariantStockRow[] | null;
}

export type StockLevel = 'ok' | 'low' | 'out';

export interface ProductStockView {
    has_variants: boolean;
    stock_total: number;
    reserved_total: number;
    available_total: number;
    min_stock_alert: number;
    stock_level: StockLevel;
    low_stock_variants: number;
    out_of_stock_variants: number;
}

const int = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const isActive = (v: VariantStockRow) => v.is_active !== false;

export function stockLevel(available: number, threshold: number): StockLevel {
    if (available <= 0) return 'out';
    if (available <= threshold) return 'low';
    return 'ok';
}

export function productStockView(p: ProductStockRow): ProductStockView {
    const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
    const threshold = p.min_stock_alert === null || p.min_stock_alert === undefined
        ? DEFAULT_MIN_STOCK_ALERT
        : Math.max(0, int(p.min_stock_alert));

    if (variants.length === 0) {
        const stock = Math.max(0, int(p.stock));
        const reserved = Math.max(0, int(p.reserved));
        const available = Math.max(0, stock - reserved);
        return {
            has_variants: false,
            stock_total: stock,
            reserved_total: reserved,
            available_total: available,
            min_stock_alert: threshold,
            stock_level: stockLevel(available, threshold),
            low_stock_variants: 0,
            out_of_stock_variants: 0,
        };
    }

    const active = variants.filter(isActive);
    let stock = 0;
    let reserved = 0;
    let low = 0;
    let out = 0;
    for (const v of active) {
        const s = Math.max(0, int(v.stock));
        const r = Math.max(0, int(v.reserved));
        stock += s;
        reserved += r;
        const lvl = stockLevel(s - r, threshold);
        if (lvl === 'low') low += 1;
        if (lvl === 'out') out += 1;
    }
    const available = Math.max(0, stock - reserved);
    return {
        has_variants: true,
        stock_total: stock,
        reserved_total: reserved,
        available_total: available,
        min_stock_alert: threshold,
        stock_level: stockLevel(available, threshold),
        low_stock_variants: low,
        out_of_stock_variants: out,
    };
}

// ─── Matriz de variantes ─────────────────────────────────────────────────────

export interface VariantSpec {
    attributes: Record<string, string>;
    stock: number;
    price_override: number | null;
}

/** Clave estable de una combinación (independiente del orden de los ejes y de mayúsculas). */
export function comboKey(attrs: Record<string, unknown>): string {
    return Object.keys(attrs)
        .sort()
        .map((k) => `${k}=${String(attrs[k] ?? '').trim().toLowerCase()}`)
        .join('|');
}

/** Producto cartesiano de los ejes: { talla: [S,M], color: [Azul] } → [{talla:S,color:Azul}, …]. */
export function cartesian(matrix: Record<string, string[]>): Record<string, string>[] {
    const keys = Object.keys(matrix);
    return keys.reduce<Record<string, string>[]>((acc, key) => {
        const values = matrix[key];
        if (acc.length === 0) return values.map((v) => ({ [key]: v }));
        const next: Record<string, string>[] = [];
        for (const prev of acc) for (const v of values) next.push({ ...prev, [key]: v });
        return next;
    }, []);
}

export type ParseVariantsResult =
    | { ok: true; variants: VariantSpec[] }
    | { ok: false; error: string };

const MAX_VARIANTS = 200;

/**
 * Lee el body de POST /:id/variants/bulk. Dos formas:
 *  - `variants: [{ attributes, stock, price_override? }]` — cada combinación con SU stock.
 *  - `matrix` + `defaults` (legacy): producto cartesiano con el mismo stock.
 * Rechaza stock no entero o negativo, combinaciones repetidas y más de 200.
 */
export function parseVariantSpecs(body: unknown): ParseVariantsResult {
    const b = (body ?? {}) as Record<string, unknown>;
    let raw: { attributes: unknown; stock: unknown; price_override: unknown }[];

    if (Array.isArray(b.variants)) {
        raw = (b.variants as Record<string, unknown>[]).map((v) => ({
            attributes: v?.attributes, stock: v?.stock ?? 0, price_override: v?.price_override ?? null,
        }));
    } else if (b.matrix && typeof b.matrix === 'object' && Object.keys(b.matrix as object).length > 0) {
        const matrix = b.matrix as Record<string, unknown>;
        if (Object.values(matrix).some((a) => !Array.isArray(a) || a.length === 0)) {
            return { ok: false, error: 'Cada eje del matrix debe ser un array no vacio.' };
        }
        const defaults = (b.defaults ?? {}) as Record<string, unknown>;
        raw = cartesian(matrix as Record<string, string[]>).map((attributes) => ({
            attributes, stock: defaults.stock ?? 0, price_override: defaults.price_override ?? null,
        }));
    } else {
        return { ok: false, error: 'Envía variants (lista) o matrix con al menos 1 eje.' };
    }

    if (raw.length === 0) return { ok: false, error: 'No hay variantes para crear.' };
    if (raw.length > MAX_VARIANTS) {
        return { ok: false, error: 'La matriz genera mas de 200 variantes. Reducir ejes.' };
    }

    const seen = new Set<string>();
    const out: VariantSpec[] = [];
    for (const r of raw) {
        if (!r.attributes || typeof r.attributes !== 'object' || Array.isArray(r.attributes)
            || Object.keys(r.attributes as object).length === 0) {
            return { ok: false, error: 'Cada variante necesita atributos (ej. talla y color).' };
        }
        const attributes: Record<string, string> = {};
        for (const [k, v] of Object.entries(r.attributes as Record<string, unknown>)) {
            const s = String(v ?? '').trim();
            if (!s) return { ok: false, error: `El atributo ${k} está vacío.` };
            attributes[k] = s;
        }
        const n = typeof r.stock === 'number' ? r.stock : r.stock === '' ? 0 : Number(r.stock);
        if (!Number.isInteger(n) || n < 0) {
            return { ok: false, error: 'El stock de cada variante debe ser un entero mayor o igual a 0.' };
        }
        let price: number | null = null;
        if (r.price_override !== null && r.price_override !== undefined && r.price_override !== '') {
            price = Number(r.price_override);
            if (!Number.isFinite(price) || price < 0) {
                return { ok: false, error: 'price_override debe ser un número mayor o igual a 0.' };
            }
        }
        const key = comboKey(attributes);
        if (seen.has(key)) return { ok: false, error: 'Hay combinaciones repetidas.' };
        seen.add(key);
        out.push({ attributes, stock: n, price_override: price });
    }
    return { ok: true, variants: out };
}

/** Nombre visible de la variante: "S / Azul" (valores en el orden de los ejes). */
export function variantDisplayName(attrs: Record<string, string>): string {
    return Object.values(attrs).join(' / ');
}

// ─── Métricas de ventas ──────────────────────────────────────────────────────

export interface SalesOrderRow {
    id: string;
    status: string;
    total_amount: number | string | null;
}

export interface SalesItemRow {
    order_id: string;
    product_id: string | null;
    quantity: number | null;
    line_total?: number | string | null;
    subtotal?: number | string | null;
    unit_price?: number | string | null;
}

export interface TopProduct {
    product_id: string;
    name: string;
    units: number;
    revenue: number;
}

export interface SalesInsights {
    revenue: number;
    orders: number;
    avg_ticket: number;
    units: number;
    top_products: TopProduct[];
}

const money = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export function buildSalesInsights(
    orders: SalesOrderRow[],
    items: SalesItemRow[],
    productNames: Record<string, string>,
    topN = 5,
): SalesInsights {
    const paid = new Set<string>();
    let revenue = 0;
    for (const o of orders) {
        if (!(PAID_LIKE_STATUSES as readonly string[]).includes(o.status)) continue;
        paid.add(o.id);
        revenue += money(o.total_amount);
    }

    const byProduct = new Map<string, TopProduct>();
    let units = 0;
    for (const it of items) {
        if (!paid.has(it.order_id) || !it.product_id) continue;
        const q = Math.max(0, int(it.quantity));
        const line = it.line_total !== null && it.line_total !== undefined
            ? money(it.line_total)
            : it.subtotal !== null && it.subtotal !== undefined
                ? money(it.subtotal)
                : money(it.unit_price) * q;
        units += q;
        const cur = byProduct.get(it.product_id)
            ?? { product_id: it.product_id, name: productNames[it.product_id] ?? 'Producto', units: 0, revenue: 0 };
        cur.units += q;
        cur.revenue += line;
        byProduct.set(it.product_id, cur);
    }

    const top = [...byProduct.values()]
        .sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.name.localeCompare(b.name))
        .slice(0, topN)
        .map((t) => ({ ...t, revenue: Math.round(t.revenue) }));

    const count = paid.size;
    return {
        revenue: Math.round(revenue),
        orders: count,
        avg_ticket: count > 0 ? Math.round(revenue / count) : 0,
        units,
        top_products: top,
    };
}

/** Periodo del panel: 7, 30 o 90 días (30 por defecto). */
export function parsePeriodDays(raw: unknown): number {
    const n = Number(raw);
    return [7, 30, 90, 365].includes(n) ? n : 30;
}
