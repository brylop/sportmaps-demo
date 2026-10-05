/**
 * Lógica pura del carrito de la tienda (tienda v2 §2.4).
 *
 * Reglas:
 *  - El carrito guarda SOLO qué y cuánto (product_id / variant_id + cantidad).
 *    El precio que se ve es "el último que dijo el servidor" y se usa solo
 *    para pintar; al checkout nunca viaja (regla de oro del contrato).
 *  - Persiste por usuario (la clave lleva el user_id; gotcha conocido de
 *    localStorage compartido entre usuarios del mismo dispositivo).
 *  - Se agrupa por tienda: un checkout por vendedor (D-2).
 *  - Tope por línea: 1–20 (INVALID_QTY del contrato) y lo disponible.
 *
 * Se prueba en src/test/storeCart.test.ts.
 */

export const MAX_QTY_PER_LINE = 20;
export const CART_STORAGE_PREFIX = 'sportmaps_cart';
/** Clave vieja (un solo carrito para todos los usuarios del dispositivo). */
export const LEGACY_CART_STORAGE_KEY = 'sportmaps_cart';

export interface CartLineMeta {
    productId?: string;
    variantId?: string;
    variantName?: string;
    vendorProfileId?: string;
    vendorName?: string;
    vendorSlug?: string;
    [key: string]: string | undefined;
}

export interface CartLineLike {
    id: string;
    type: string;
    name: string;
    price: number;
    quantity: number;
    stock?: number;
    image?: string;
    metadata: CartLineMeta;
}

export function cartStorageKey(userId: string | null | undefined): string {
    return userId ? `${CART_STORAGE_PREFIX}:u:${userId}` : `${CART_STORAGE_PREFIX}:guest`;
}

/** Id estable de una línea de producto: misma variante = misma línea. */
export function productLineId(productId: string, variantId?: string | null): string {
    return variantId ? `product-${productId}:${variantId}` : `product-${productId}`;
}

/** Cantidad válida para una línea. `available` = lo que el servidor dijo que queda. */
export function clampQuantity(quantity: number, available?: number | null): number {
    const q = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
    const cap = Math.min(MAX_QTY_PER_LINE, available === undefined || available === null ? MAX_QTY_PER_LINE : Math.max(available, 0));
    if (cap <= 0) return 0;
    return Math.min(Math.max(q, 1), cap);
}

export interface AddResult<T> {
    items: T[];
    /** La cantidad pedida no cupo completa (tope 20 o stock). */
    clamped: boolean;
    added: number;
}

export function addLine<T extends CartLineLike>(items: T[], line: Omit<T, 'quantity'>, quantity = 1): AddResult<T> {
    const idx = items.findIndex((i) => i.id === line.id);
    const available = line.stock;
    if (idx >= 0) {
        const current = items[idx];
        const wanted = current.quantity + quantity;
        const next = clampQuantity(wanted, available ?? current.stock);
        const updated = [...items];
        updated[idx] = { ...current, ...line, quantity: next } as T;
        return { items: updated, clamped: next < wanted, added: next - current.quantity };
    }
    const next = clampQuantity(quantity, available);
    if (next <= 0) return { items, clamped: true, added: 0 };
    return { items: [...items, { ...line, quantity: next } as T], clamped: next < quantity, added: next };
}

export function setLineQuantity<T extends CartLineLike>(items: T[], id: string, quantity: number): T[] {
    if (quantity < 1) return items.filter((i) => i.id !== id);
    return items.map((i) => (i.id === id ? { ...i, quantity: clampQuantity(quantity, i.stock) || i.quantity } : i));
}

/** Carrito del invitado + carrito del usuario (al iniciar sesión): suma por línea con tope. */
export function mergeCarts<T extends CartLineLike>(userItems: T[], guestItems: T[]): T[] {
    let out = [...userItems];
    for (const g of guestItems) {
        const { quantity, ...rest } = g;
        out = addLine(out, rest as Omit<T, 'quantity'>, quantity).items;
    }
    return out;
}

/** Lectura segura de lo guardado (localStorage puede traer basura de versiones viejas). */
export function parseStoredCart(raw: string | null): CartLineLike[] {
    if (!raw) return [];
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        return data.filter((i) =>
            i && typeof i === 'object' && typeof i.id === 'string' && typeof i.type === 'string'
            && typeof i.quantity === 'number' && i.quantity > 0 && i.metadata && typeof i.metadata === 'object');
    } catch {
        return [];
    }
}

export interface StoreGroup<T extends CartLineLike> {
    /** null = producto viejo sin tienda conocida (se resuelve con la cotización). */
    vendorProfileId: string | null;
    vendorName: string;
    vendorSlug?: string;
    items: T[];
}

/** Agrupa las líneas de producto por tienda (D-2: se paga una tienda por checkout). */
export function groupByStore<T extends CartLineLike>(items: T[]): StoreGroup<T>[] {
    const groups = new Map<string, StoreGroup<T>>();
    for (const it of items) {
        if (it.type !== 'product') continue;
        const key = it.metadata.vendorProfileId ?? '__sin_tienda__';
        const g = groups.get(key);
        if (g) {
            g.items.push(it);
            if (!g.vendorSlug && it.metadata.vendorSlug) g.vendorSlug = it.metadata.vendorSlug;
        } else {
            groups.set(key, {
                vendorProfileId: it.metadata.vendorProfileId ?? null,
                vendorName: it.metadata.vendorName || 'Tienda',
                vendorSlug: it.metadata.vendorSlug,
                items: [it],
            });
        }
    }
    return [...groups.values()];
}

/** Ítems para `quote_cart` (RPC): snake_case, sin precio. */
export function toQuoteItems(items: CartLineLike[]): Array<{ product_id?: string; variant_id?: string; quantity: number }> {
    return items
        .filter((i) => i.type === 'product' && (i.metadata.variantId || i.metadata.productId))
        .map((i) => (i.metadata.variantId
            ? { variant_id: i.metadata.variantId, quantity: i.quantity }
            : { product_id: i.metadata.productId!, quantity: i.quantity }));
}

/** Ítems para POST /checkout/cart (contrato): camelCase, sin precio. */
export function toCheckoutItems(items: CartLineLike[]): Array<{ productId?: string; variantId?: string; quantity: number }> {
    return items
        .filter((i) => i.type === 'product' && (i.metadata.variantId || i.metadata.productId))
        .map((i) => (i.metadata.variantId
            ? { variantId: i.metadata.variantId, quantity: i.quantity }
            : { productId: i.metadata.productId!, quantity: i.quantity }));
}

// ─── Cotización del servidor (quote_cart) ─────────────────────────────────────

export type QuoteLineError =
    | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'PRODUCT_NOT_AVAILABLE'
    | 'VARIANT_REQUIRED' | 'PRODUCT_NOT_FOUND' | 'INVALID_QTY';

export interface QuoteLine {
    product_id: string | null;
    variant_id: string | null;
    name?: string;
    vendor_profile_id?: string | null;
    quantity: number | null;
    available?: number;
    adjusted_quantity?: number;
    unit_price?: number;
    tax_rate?: number;
    line_total?: number;
    line_base?: number;
    line_tax?: number;
    error: QuoteLineError | null;
}

export interface CartQuote {
    lines: QuoteLine[];
    subtotal: number;
    tax_total: number;
    shipping: number | null;
    shipping_error: string | null;
    discount_total: number;
    total: number;
    coupon_error: string | null;
    multiple_sellers: boolean;
    store_enabled: boolean;
}

export type CartNoticeKind = 'price_changed' | 'qty_adjusted' | 'out_of_stock' | 'unavailable' | 'variant_required';

export interface CartNotice {
    kind: CartNoticeKind;
    lineId: string;
    message: string;
}

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

function quoteLineFor(line: CartLineLike, quote: CartQuote): QuoteLine | undefined {
    const v = line.metadata.variantId ?? null;
    const p = line.metadata.productId ?? null;
    return quote.lines.find((q) => (v ? q.variant_id === v : (!q.variant_id && q.product_id === p)));
}

export interface AppliedQuote<T extends CartLineLike> {
    items: T[];
    notices: CartNotice[];
    /** Hay líneas que no se pueden pagar (agotadas / no disponibles / sin talla). */
    blocked: boolean;
}

/**
 * Aplica lo que dijo el servidor: precio vigente, disponible, ajuste de
 * cantidad. No borra líneas solo (el usuario decide); las marca y bloquea el pago.
 */
export function applyQuote<T extends CartLineLike>(items: T[], quote: CartQuote): AppliedQuote<T> {
    const notices: CartNotice[] = [];
    let blocked = false;
    const out = items.map((line) => {
        if (line.type !== 'product') return line;
        const q = quoteLineFor(line, quote);
        if (!q) return line;
        if (q.error === 'PRODUCT_NOT_AVAILABLE' || q.error === 'PRODUCT_NOT_FOUND') {
            blocked = true;
            notices.push({ kind: 'unavailable', lineId: line.id, message: `${line.name} ya no está disponible. Quítalo para continuar.` });
            return { ...line, stock: 0 };
        }
        if (q.error === 'VARIANT_REQUIRED') {
            blocked = true;
            notices.push({ kind: 'variant_required', lineId: line.id, message: `Elige talla o color de ${line.name}.` });
            return line;
        }
        let next = { ...line } as T;
        // Ítems viejos sin tienda (agregados desde Explorar): la base dice de quién son.
        if (q.vendor_profile_id && !line.metadata.vendorProfileId) {
            next = { ...next, metadata: { ...next.metadata, vendorProfileId: q.vendor_profile_id } };
        }
        if (typeof q.unit_price === 'number' && q.unit_price !== line.price) {
            notices.push({ kind: 'price_changed', lineId: line.id, message: `El precio de ${line.name} cambió a ${fmt(q.unit_price)}.` });
            next = { ...next, price: q.unit_price };
        }
        if (typeof q.available === 'number') {
            next = { ...next, stock: q.available };
            if (q.available <= 0) {
                blocked = true;
                notices.push({ kind: 'out_of_stock', lineId: line.id, message: `${line.name} se agotó. Quítalo para continuar.` });
            } else if (q.available < line.quantity) {
                notices.push({ kind: 'qty_adjusted', lineId: line.id, message: `Quedan ${q.available} de ${line.name}; ajustamos la cantidad.` });
                next = { ...next, quantity: q.available };
            }
        }
        return next;
    });
    return { items: out, notices, blocked };
}

/** ¿Cambió algo que valga la pena guardar en el carrito? */
export function cartChanged(a: CartLineLike[], b: CartLineLike[]): boolean {
    if (a.length !== b.length) return true;
    return a.some((x, i) => x.id !== b[i].id || x.quantity !== b[i].quantity || x.price !== b[i].price
        || x.stock !== b[i].stock || x.metadata.vendorProfileId !== b[i].metadata.vendorProfileId);
}
