import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del attribute_schema
// ─────────────────────────────────────────────────────────────────────────────
export type AttributeFieldType = 'select' | 'multiselect' | 'color' | 'number' | 'text';
export type AttributeAppliesTo = 'product' | 'variant';

export interface AttributeField {
    key:         string;
    label:       string;
    type:        AttributeFieldType;
    required:    boolean;
    options?:    string[];
    applies_to:  AttributeAppliesTo;
    unit?:       string;
}

export interface ProductCategory {
    id:                string;
    parent_id:         string | null;
    slug:              string;
    name:              string;
    icon:              string | null;
    sport:             string | null;
    attribute_schema:  AttributeField[];
    sort_order:        number;
    children?:         ProductCategory[];
}

export interface ProductBrand {
    id:          string;
    slug:        string;
    name:        string;
    logo_url:    string | null;
    is_official: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// useCategories — arbol completo (cacheado 10 min porque cambia poco)
// ─────────────────────────────────────────────────────────────────────────────
export function useCategories() {
    return useQuery({
        queryKey: ['marketplace', 'categories'],
        staleTime: 10 * 60_000,
        queryFn: async (): Promise<ProductCategory[]> => {
            const res = await fetch(`${API_URL}/api/v1/marketplace/categories`);
            if (!res.ok) throw new Error('Error cargando categorias.');
            const json = await res.json();
            // Defensive: si el endpoint cambia el shape (objeto en vez de array),
            // no crashear el .map del consumer.
            return Array.isArray(json.data) ? (json.data as ProductCategory[]) : [];
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// useCategory — categoria por slug con attribute_schema
// ─────────────────────────────────────────────────────────────────────────────
export function useCategory(slug: string | undefined) {
    return useQuery({
        queryKey: ['marketplace', 'category', slug],
        enabled: !!slug,
        staleTime: 10 * 60_000,
        queryFn: async (): Promise<ProductCategory | null> => {
            const res = await fetch(`${API_URL}/api/v1/marketplace/categories/${slug}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error('Error cargando categoria.');
            const json = await res.json();
            return (json.data as ProductCategory) || null;
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// useBrands — marcas activas
// ─────────────────────────────────────────────────────────────────────────────
export function useBrands() {
    return useQuery({
        queryKey: ['marketplace', 'brands'],
        staleTime: 10 * 60_000,
        retry: 1,
        queryFn: async (): Promise<ProductBrand[]> => {
            const res = await fetch(`${API_URL}/api/v1/marketplace/brands`);
            if (!res.ok) {
                // 401/404 → tratar como "sin marcas disponibles" sin tirar error visible
                return [];
            }
            const json = await res.json();
            return Array.isArray(json.data) ? (json.data as ProductBrand[]) : [];
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para el wizard
// ─────────────────────────────────────────────────────────────────────────────
export function productAttributes(schema: AttributeField[]): AttributeField[] {
    return schema.filter(f => f.applies_to === 'product');
}

export function variantAttributes(schema: AttributeField[]): AttributeField[] {
    return schema.filter(f => f.applies_to === 'variant');
}

/**
 * Para cada attribute_field marcado required en applies_to=product,
 * valida que values[key] esta presente.
 */
export function validateProductAttributes(
    schema: AttributeField[],
    values: Record<string, unknown>,
): string[] {
    const errors: string[] = [];
    for (const f of productAttributes(schema)) {
        if (!f.required) continue;
        const v = values[f.key];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
            errors.push(`${f.label} es requerido.`);
        }
    }
    return errors;
}
