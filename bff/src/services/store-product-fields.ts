/**
 * Qué campos de un producto / variante puede editar el vendedor por PATCH
 * (tienda v2 F0, M-F0-2). Lista blanca, igual a los GRANT UPDATE por columna
 * de la migración: el BFF usa service role y la base no lo frena, así que la
 * lista vive acá también.
 *
 * `stock` NO se edita por PATCH: se mueve con la RPC inventory_adjust (deja
 * rastro en inventory_logs y respeta lo reservado). vendor_id / school_id /
 * vendor_profile_id tampoco: los fija el trigger desde el vendor_profile.
 *
 * Puro: se prueba en store-product-fields.test.ts.
 */

export const PRODUCT_EDITABLE_FIELDS = [
    'name', 'description', 'price', 'category', 'category_id', 'brand_id', 'image_url',
    'active', 'visibility', 'status', 'sku', 'attributes', 'weight_grams', 'is_digital',
    'min_stock_alert', 'tax_rate',
] as const;

export const VARIANT_EDITABLE_FIELDS = [
    'sku', 'name', 'attributes', 'price_override', 'image_url', 'is_active', 'sort_order',
] as const;

export type StockParse =
    | { present: false }
    | { present: true; valid: true; value: number }
    | { present: true; valid: false };

/** Lee `stock` del body: entero >= 0, o ausente. */
export function parseStock(body: Record<string, unknown> | null | undefined): StockParse {
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'stock')) return { present: false };
    const raw = body.stock;
    if (raw === undefined || raw === null || raw === '') return { present: false };
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 0) return { present: true, valid: false };
    return { present: true, valid: true, value: n };
}

/** Copia solo los campos permitidos del body (ignora el resto, incluido stock). */
export function pickEditable(
    body: Record<string, unknown> | null | undefined,
    fields: readonly string[],
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!body) return out;
    for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(body, f) && body[f] !== undefined) out[f] = body[f];
    }
    return out;
}

/** Campos de un producto original que el duplicado NO debe copiar. */
export const DUPLICATE_OMIT_FIELDS = [
    'id', 'created_at', 'updated_at', 'sku', 'reviewed_at', 'reviewed_by', 'rejection_reason',
    'product_variants', 'vendor_id', 'school_id', 'stock', 'status',
    // contadores / agregados propios del original
    'avg_rating', 'reviews_count', 'sales_count', 'views_count',
] as const;

/** Arma la fila del duplicado a partir del original (sin dueño ni stock). */
export function buildDuplicateRow(original: Record<string, unknown>): Record<string, unknown> {
    const row: Record<string, unknown> = { ...original };
    for (const f of DUPLICATE_OMIT_FIELDS) delete row[f];
    row.name = `${String(original.name ?? '')} (copia)`;
    row.status = 'draft';
    row.stock = 0;
    return row;
}
