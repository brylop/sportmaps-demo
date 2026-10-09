/**
 * Llamadas del panel de la tienda al BFF (/api/v1/vendor/products).
 * El stock NUNCA se escribe directo: todo ajuste va por
 * POST /:id/inventory (inventory_adjust con kardex y motivo).
 */
import type { InventoryReasonCode, KardexEntry, VendorProduct } from './inventory';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const BASE = `${API_URL}/api/v1/vendor/products`;

export class VendorApiError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) {
        super(message);
    }
}

async function call<T>(token: string | undefined, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token ?? ''}`,
            ...(init.headers ?? {}),
        },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
        throw new VendorApiError(json?.error || `Error ${res.status}`, res.status, json?.code);
    }
    return json as T;
}

export async function listMyProducts(token: string | undefined): Promise<VendorProduct[]> {
    const json = await call<{ data: VendorProduct[] }>(token, '?limit=500');
    return json.data ?? [];
}

export interface AdjustInput {
    variant_id?: string | null;
    new_stock: number;
    reason_code: InventoryReasonCode;
    note: string;
}

export async function adjustStock(token: string | undefined, productId: string, input: AdjustInput) {
    return call<{ data: { stock_before: number; stock_after: number; delta: number; noop?: boolean } }>(
        token, `/${productId}/inventory`, { method: 'POST', body: JSON.stringify(input) });
}

export async function getKardex(token: string | undefined, productId: string): Promise<KardexEntry[]> {
    const json = await call<{ data: KardexEntry[] }>(token, `/${productId}/inventory`);
    return json.data ?? [];
}

export interface VariantCreate {
    attributes: Record<string, string>;
    stock: number;
    price_override: number | null;
}

export async function createVariants(token: string | undefined, productId: string, variants: VariantCreate[]) {
    return call<{ data: unknown[]; count: number }>(token, `/${productId}/variants/bulk`, {
        method: 'POST', body: JSON.stringify({ variants }),
    });
}

export async function setVariantActive(token: string | undefined, productId: string, variantId: string, isActive: boolean) {
    return call(token, `/${productId}/variants/${variantId}`, {
        method: 'PATCH', body: JSON.stringify({ is_active: isActive }),
    });
}

export interface SalesInsights {
    revenue: number;
    orders: number;
    avg_ticket: number;
    units: number;
    top_products: { product_id: string; name: string; units: number; revenue: number }[];
    days: number;
    since: string;
}

export async function getSalesInsights(token: string | undefined, days = 30): Promise<SalesInsights> {
    const json = await call<{ data: SalesInsights }>(token, `/insights?days=${days}`);
    return json.data;
}
