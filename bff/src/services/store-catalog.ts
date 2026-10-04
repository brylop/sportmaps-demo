/**
 * Catálogo de la vitrina (/tienda/:slug) — tienda v2 F0.
 *
 * Arregla B3/B4 del informe docs/qa/tienda-baseline-padre-2026-10-03.md:
 *   - B3: la vitrina miraba products.stock (0 cuando el stock vive en las
 *     variantes) y mostraba "Agotado" una camiseta con tallas disponibles.
 *     Acá la disponibilidad se calcula por variante (stock - reserved) y el
 *     producto está agotado SOLO si todas sus variantes activas están en 0.
 *   - B4: los productos `school_only` no los veía nadie. Se incluyen cuando el
 *     usuario de la sesión es miembro activo (o staff/dueño) de la escuela de
 *     la tienda. Un anónimo o un ajeno solo ve `public`.
 *
 * Puro: se prueba en store-catalog.test.ts. Ningún dato de dinero sale de acá
 * hacia el checkout: el precio que se cobra lo pone create_cart_order.
 */

export interface CatalogVariantRow {
    id: string;
    name: string | null;
    attributes: Record<string, unknown> | null;
    price_override: number | string | null;
    stock: number | null;
    reserved: number | null;
    image_url: string | null;
    is_active: boolean | null;
    sort_order: number | null;
}

export interface CatalogImageRow {
    image_url: string;
    alt_text: string | null;
    sort_order: number | null;
    is_primary: boolean | null;
}

export interface CatalogProductRow {
    id: string;
    name: string;
    description: string | null;
    price: number | string;
    image_url: string | null;
    category: string | null;
    stock: number | null;
    reserved: number | null;
    visibility: string | null;
    school_id: string | null;
    tax_rate: number | string | null;
    min_stock_alert: number | null;
    product_variants?: CatalogVariantRow[] | null;
    product_images?: CatalogImageRow[] | null;
}

export interface CatalogVariant {
    id: string;
    name: string;
    attributes: Record<string, string>;
    price: number;
    available: number;
    image_url: string | null;
}

export interface CatalogProduct {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    images: string[];
    category: string | null;
    visibility: 'public' | 'school_only';
    tax_rate: number;
    low_stock_threshold: number;
    /** Unidades disponibles (suma de variantes activas, o el producto si no tiene). */
    available: number;
    /** Compat con la vitrina vieja: igual a `available`. */
    stock: number;
    sold_out: boolean;
    has_variants: boolean;
    variants: CatalogVariant[];
}

function avail(stock: number | null | undefined, reserved: number | null | undefined): number {
    return Math.max(Number(stock ?? 0) - Number(reserved ?? 0), 0);
}

function attrs(raw: Record<string, unknown> | null | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
        if (v === null || v === undefined || typeof v === 'object') continue;
        out[k.toLowerCase()] = String(v);
    }
    return out;
}

/**
 * ¿Qué visibilidades puede ver este usuario en esta tienda?
 * `memberSchoolIds` = escuelas donde el usuario es miembro activo / staff / dueño.
 */
export function canSeeSchoolOnly(storeSchoolId: string | null | undefined, memberSchoolIds: readonly string[]): boolean {
    return !!storeSchoolId && memberSchoolIds.includes(storeSchoolId);
}

export function shapeCatalogProduct(p: CatalogProductRow): CatalogProduct {
    const basePrice = Number(p.price);
    const rawVariants = (p.product_variants ?? []).filter((v) => v && v.is_active !== false);
    const hasVariants = (p.product_variants ?? []).length > 0;
    const variants: CatalogVariant[] = rawVariants
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((v) => ({
            id: v.id,
            name: v.name ?? '',
            attributes: attrs(v.attributes),
            price: v.price_override !== null && v.price_override !== undefined ? Number(v.price_override) : basePrice,
            available: avail(v.stock, v.reserved),
            image_url: v.image_url ?? null,
        }));
    const available = hasVariants
        ? variants.reduce((s, v) => s + v.available, 0)
        : avail(p.stock, p.reserved);
    const images = (p.product_images ?? [])
        .slice()
        .sort((a, b) => Number(!!b.is_primary) - Number(!!a.is_primary) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i) => i.image_url)
        .filter(Boolean);
    if (p.image_url && !images.includes(p.image_url)) images.unshift(p.image_url);
    return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: basePrice,
        image_url: p.image_url ?? images[0] ?? null,
        images,
        category: p.category,
        visibility: p.visibility === 'school_only' ? 'school_only' : 'public',
        tax_rate: Number(p.tax_rate ?? 0),
        low_stock_threshold: Number(p.min_stock_alert ?? 5) || 5,
        available,
        stock: available,
        sold_out: available <= 0,
        has_variants: hasVariants,
        variants,
    };
}

/** Filtra por visibilidad (public siempre; school_only solo a miembros) y da forma. */
export function shapeStoreCatalog(
    rows: CatalogProductRow[],
    opts: { storeSchoolId: string | null; memberSchoolIds: readonly string[] },
): CatalogProduct[] {
    const seeSchoolOnly = canSeeSchoolOnly(opts.storeSchoolId, opts.memberSchoolIds);
    return rows
        .filter((p) => p.visibility === 'public'
            || (p.visibility === 'school_only' && seeSchoolOnly && p.school_id === opts.storeSchoolId))
        .map(shapeCatalogProduct);
}
