/**
 * storeGuestApi — compra SIN cuenta en la tienda (D-13, mig. 20261013170553).
 *
 * BFF /api/v1/public/tienda (sin sesión). La base valida correo, límites,
 * monto y bloquea los productos school_only. El enlace /pedido/:token es la
 * credencial: el token va en el header X-Pedido-Token (nunca en la URL del
 * BFF), y la base solo guarda su sha256.
 */

import { bffClient } from '@/lib/api/bffClient';
import { supabase } from '@/integrations/supabase/client';
import type { Fulfillment } from '@/lib/store/orderStatus';
import type { PaymentMethodsResponse, StatusHistoryRow, TransferInfo } from '@/lib/api/storeApi';

export type GuestPaymentMethod = 'wompi' | 'transfer' | 'cash_pickup';
export const GUEST_TOKEN_RE = /^[0-9a-f]{64}$/;

const tokenHeader = (token: string) => ({ 'X-Pedido-Token': token });

/** Medios de la tienda sin sesión (el /api/v1/store/... exige sesión por el router de reviews). */
export async function fetchPublicPaymentMethods(vendorProfileId: string): Promise<PaymentMethodsResponse> {
    const res = await bffClient.get<{ ok: boolean; data: PaymentMethodsResponse }>(
        `/api/v1/public/tienda/medios/${vendorProfileId}`, undefined, 'public',
    );
    return res.data;
}

export interface GuestOrderInput {
    items: Array<{ productId?: string; variantId?: string; quantity: number }>;
    fulfillment: Fulfillment;
    pickupBranchId?: string | null;
    address?: { departamento: string; ciudad: string; direccion: string } | null;
    buyer: { name: string; email: string; phone?: string; document?: string; notes?: string };
    paymentMethod: GuestPaymentMethod;
    idempotencyKey: string;
    couponCode?: string | null;
    /** Trampa para bots: siempre vacío desde la UI. */
    website?: string;
}

export interface GuestCreatedOrder {
    orderId: string;
    reference: string;
    status: string;
    paymentMethod: GuestPaymentMethod;
    grossAmount: number;
    amountInCents?: number;
    expiresAt?: string | null;
    provider?: string;
    publicKey?: string | null;
    sandbox?: boolean | null;
    signature?: string | null;
    pickupCode?: string | null;
    transfer?: TransferInfo | null;
    idempotent: boolean;
    /** Se entrega UNA vez: con él se abre /pedido/:token. Null en un reintento idempotente. */
    accessToken: string | null;
    orderPath: string | null;
    emailSent: 'sent' | 'simulated' | 'failed' | null;
}

export async function createGuestStoreOrder(input: GuestOrderInput): Promise<GuestCreatedOrder> {
    const res = await bffClient.post<{ ok: boolean; data: GuestCreatedOrder }>(
        '/api/v1/public/tienda/checkout', { ...input, website: input.website ?? '' }, undefined, 'public',
    );
    return res.data;
}

export interface GuestOrderView {
    order: {
        id: string;
        reference: string | null;
        status: string;
        payment_method: string | null;
        fulfillment_mode: string | null;
        subtotal: number | null;
        discount_total: number | null;
        tax_total: number | null;
        shipping_cost: number | null;
        total_amount: number;
        expires_at: string | null;
        created_at: string;
        paid_at: string | null;
        receipt_submitted_at: string | null;
        has_receipt: boolean;
        rejection_reason: string | null;
        tracking_number: string | null;
        shipping_carrier: string | null;
        shipping_address: Record<string, string> | null;
        customer_name: string | null;
        email_masked: string;
        linked_to_account: boolean;
        vendor_profile_id: string | null;
    };
    items: Array<{
        id: string; product_id: string; variant_id: string | null; name: string; variant_name: string | null;
        image_url: string | null; quantity: number; unit_price: number; line_total: number | null;
    }>;
    history: StatusHistoryRow[];
    store: { display_name: string | null; slug: string | null; logo_url: string | null };
    pickup_branch: { id: string; name: string; address: string | null } | null;
    transfer: (TransferInfo & { amount?: number }) | null;
    pickup: { regenerations_used: number; regenerations_max: number; can_regenerate: boolean };
}

export async function fetchGuestOrder(token: string): Promise<GuestOrderView> {
    const res = await bffClient.get<{ ok: boolean; data: GuestOrderView }>(
        '/api/v1/public/tienda/pedido', tokenHeader(token), 'public',
    );
    return res.data;
}

/** URL firmada → subida al bucket privado → guest_order_submit_receipt. */
export async function uploadGuestReceipt(token: string, file: File): Promise<void> {
    const up = await bffClient.post<{ ok: boolean; data: { bucket: string; path: string; token: string } }>(
        '/api/v1/public/tienda/pedido/receipt-url', { fileName: file.name }, tokenHeader(token), 'public',
    );
    const { bucket, path, token: uploadToken } = up.data;
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, uploadToken, file, {
        contentType: file.type || undefined,
    });
    if (error) throw Object.assign(new Error('UPLOAD_FAILED'), { body: { error: 'UPLOAD_FAILED' } });
    await bffClient.post('/api/v1/public/tienda/pedido/receipt', { path }, tokenHeader(token), 'public');
}

export interface GuestRegeneratedPickupCode {
    order_id: string; status: string; pickup_code: string;
    regenerations_used: number; regenerations_left: number; regenerations_max: number;
}

export async function regenerateGuestPickupCode(token: string): Promise<GuestRegeneratedPickupCode> {
    const res = await bffClient.post<{ ok: boolean; data: GuestRegeneratedPickupCode }>(
        '/api/v1/public/tienda/pedido/pickup-code', {}, tokenHeader(token), 'public',
    );
    return res.data;
}

export async function cancelGuestOrder(token: string, reason?: string): Promise<void> {
    await bffClient.post('/api/v1/public/tienda/pedido/cancel', { reason }, tokenHeader(token), 'public');
}

export async function fetchGuestPayment(token: string): Promise<{
    paymentMethod: string; provider?: 'wompi'; publicKey?: string; reference?: string; amountInCents?: number; signature?: string;
}> {
    const res = await bffClient.post<{ ok: boolean; data: any }>('/api/v1/public/tienda/pedido/pay', {}, tokenHeader(token), 'public');
    return res.data;
}

/**
 * Pasa a la cuenta los pedidos hechos sin cuenta con el MISMO correo
 * (confirmado). La base también lo hace sola al confirmar el correo; esto
 * cubre a quien ya tenía cuenta. Nunca rompe la pantalla.
 */
export async function linkMyGuestOrders(): Promise<number> {
    try {
        const { data, error } = await supabase.rpc('link_my_guest_orders' as never);
        if (error) return 0;
        return Number((data as unknown as { linked?: number } | null)?.linked ?? 0);
    } catch {
        return 0;
    }
}

// ─── Código de retiro del invitado en ESTE dispositivo ──────────────────────
// Igual que con cuenta: la base guarda solo el hash. La clave es por pedido
// (no hay usuario); quien tiene el enlace puede generar uno nuevo una vez pagado.

const guestPickupKey = (orderId: string) => `sportmaps_pickup_guest:${orderId}`;

export function rememberGuestPickupCode(orderId: string, code: string, gen = 0): void {
    try { localStorage.setItem(guestPickupKey(orderId), JSON.stringify({ code, gen })); } catch { /* modo privado */ }
}

export function recallGuestPickupCode(orderId: string): { code: string; gen: number } | null {
    try {
        const raw = localStorage.getItem(guestPickupKey(orderId));
        if (!raw) return null;
        const v = JSON.parse(raw) as { code?: unknown; gen?: unknown };
        return typeof v.code === 'string' ? { code: v.code, gen: Number(v.gen) || 0 } : null;
    } catch { return null; }
}
