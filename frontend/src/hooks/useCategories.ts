import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
            // Lectura directa via Supabase client. La tabla product_categories
            // tiene RLS publica para SELECT. Esto evita depender del BFF y
            // de eventuales colisiones de rutas (/categories en dos routers).
            const { data, error } = await supabase
                .from('product_categories')
                .select('id, parent_id, slug, name, icon, sport, attribute_schema, sort_order, is_active')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('useCategories error:', error);
                return [];
            }

            // Construir arbol jerarquico: hijos bajo su parent.
            type Row = ProductCategory & { children?: Row[] };
            const byId = new Map<string, Row>();
            const roots: Row[] = [];

            for (const row of (data || []) as Row[]) {
                byId.set(row.id, { ...row, children: [] });
            }
            for (const row of byId.values()) {
                if (row.parent_id && byId.has(row.parent_id)) {
                    byId.get(row.parent_id)!.children!.push(row);
                } else {
                    roots.push(row);
                }
            }
            return roots;
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
            const { data, error } = await supabase
                .from('product_categories')
                .select('*')
                .eq('slug', slug!)
                .eq('is_active', true)
                .maybeSingle();

            if (error) {
                console.error('useCategory error:', error);
                return null;
            }
            return (data as ProductCategory) || null;
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
            const { data, error } = await supabase
                .from('product_brands')
                .select('id, slug, name, logo_url, is_official')
                .eq('is_active', true)
                .order('is_official', { ascending: false })
                .order('name', { ascending: true });

            if (error) {
                console.error('useBrands error:', error);
                return [];
            }
            return (data as ProductBrand[]) || [];
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
