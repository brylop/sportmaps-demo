/**
 * Variantes de producto en la vitrina y la ficha (tienda v2 §2.3).
 *
 * El catálogo llega del BFF (GET /api/v1/marketplace/vendor/:slug) con la
 * disponibilidad ya calculada por variante (stock - reservado). Acá solo se
 * decide qué se pinta: ejes (talla × color), combinaciones sin stock visibles
 * pero deshabilitadas, y el texto de disponibilidad.
 *
 * Se prueba en src/test/storeVariants.test.ts.
 */

export interface StoreVariant {
    id: string;
    name: string;
    attributes: Record<string, string>;
    price: number;
    available: number;
    image_url: string | null;
}

export interface StoreProduct {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    images?: string[];
    category: string | null;
    visibility?: 'public' | 'school_only';
    tax_rate?: number;
    low_stock_threshold?: number;
    available?: number;
    stock?: number | null;
    sold_out?: boolean;
    has_variants?: boolean;
    variants?: StoreVariant[];
}

/** Sinónimos de ejes → nombre canónico. */
const AXIS_ALIASES: Record<string, string> = {
    talla: 'talla', size: 'talla', tamaño: 'talla', tamano: 'talla',
    color: 'color', colour: 'color',
};
const AXIS_LABELS: Record<string, string> = { talla: 'Talla', color: 'Color' };
const AXIS_ORDER = ['talla', 'color'];

export function canonicalAxis(key: string): string {
    const k = key.trim().toLowerCase();
    return AXIS_ALIASES[k] ?? k;
}

export function axisLabel(axis: string): string {
    return AXIS_LABELS[axis] ?? axis.charAt(0).toUpperCase() + axis.slice(1);
}

function normAttrs(v: StoreVariant): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v.attributes ?? {})) out[canonicalAxis(k)] = String(val);
    return out;
}

/** Unidades disponibles del producto: suma de variantes, o el producto si no tiene. */
export function productAvailable(p: StoreProduct): number {
    if (p.variants && p.variants.length > 0) return p.variants.reduce((s, v) => s + Math.max(v.available, 0), 0);
    return Math.max(Number(p.available ?? p.stock ?? 0), 0);
}

/** "Agotado" solo si TODAS las variantes están en 0 (B3). */
export function isSoldOut(p: StoreProduct): boolean {
    return productAvailable(p) <= 0;
}

export function hasVariants(p: StoreProduct): boolean {
    return !!p.variants && p.variants.length > 0;
}

/** Rango de precio para la tarjeta ("Desde $X" si las variantes cambian el precio). */
export function priceRange(p: StoreProduct): { min: number; max: number } {
    const prices = hasVariants(p) ? p.variants!.map((v) => v.price) : [p.price];
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

export interface VariantAxis {
    key: string;
    label: string;
    values: string[];
}

/** Ejes presentes en las variantes, talla primero y color segundo. */
export function variantAxes(variants: StoreVariant[]): VariantAxis[] {
    const map = new Map<string, string[]>();
    for (const v of variants) {
        for (const [k, val] of Object.entries(normAttrs(v))) {
            const list = map.get(k) ?? [];
            if (!list.includes(val)) list.push(val);
            map.set(k, list);
        }
    }
    const keys = [...map.keys()].sort((a, b) => {
        const ia = AXIS_ORDER.indexOf(a); const ib = AXIS_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return keys.map((key) => ({ key, label: axisLabel(key), values: map.get(key)! }));
}

export type Selection = Record<string, string | undefined>;

/** Variante que calza EXACTAMENTE con la selección (todos los ejes elegidos). */
export function findVariant(variants: StoreVariant[], selection: Selection): StoreVariant | undefined {
    const axes = variantAxes(variants);
    if (axes.some((a) => !selection[a.key])) {
        // Producto sin ejes (variantes sin atributos): solo si hay una.
        if (axes.length === 0 && variants.length === 1) return variants[0];
        return undefined;
    }
    return variants.find((v) => {
        const a = normAttrs(v);
        return axes.every((ax) => a[ax.key] === selection[ax.key]);
    });
}

export type OptionState = 'available' | 'sold_out' | 'missing';

/**
 * Estado de un valor de un eje dado lo demás elegido: `sold_out` se pinta
 * tachado y deshabilitado (como ML); `missing` = esa combinación no existe.
 */
export function optionState(variants: StoreVariant[], selection: Selection, axis: string, value: string): OptionState {
    const candidates = variants.filter((v) => {
        const a = normAttrs(v);
        if (a[axis] !== value) return false;
        return Object.entries(selection).every(([k, val]) => k === axis || !val || a[k] === val);
    });
    if (candidates.length === 0) return 'missing';
    return candidates.some((v) => v.available > 0) ? 'available' : 'sold_out';
}

/** Primera selección con stock (para no abrir la ficha en una talla agotada). */
export function defaultSelection(variants: StoreVariant[]): Selection {
    const first = variants.find((v) => v.available > 0);
    return first ? { ...normAttrs(first) } : {};
}

/** Texto de disponibilidad: nunca el número exacto si es mayor al umbral. */
export function availabilityLabel(available: number, threshold = 5): { text: string; tone: 'ok' | 'low' | 'out' } {
    if (available <= 0) return { text: 'Agotado', tone: 'out' };
    if (available === 1) return { text: '¡Última unidad!', tone: 'low' };
    if (available <= threshold) return { text: `Últimas ${available} disponibles`, tone: 'low' };
    return { text: 'Disponible', tone: 'ok' };
}

/** Nombre corto de la variante para el carrito ("Talla M · Azul"). */
export function variantLabel(v: StoreVariant): string {
    const a = normAttrs(v);
    const parts = variantAxes([v]).map((ax) => (ax.key === 'talla' ? `Talla ${a[ax.key]}` : capitalize(a[ax.key])));
    return parts.length ? parts.join(' · ') : v.name;
}

function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
