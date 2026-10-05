/**
 * storeApi — llamadas de la tienda v2 (contrato docs/specs/tienda-v2-contrato-checkout.md).
 *
 * Regla de oro: el cliente nunca manda precios, totales, IVA ni estados.
 * Manda variant_id/product_id + cantidad, la entrega y el medio de pago.
 *
 * - Catálogo: BFF GET /api/v1/marketplace/vendor/:slug (variantes con
 *   disponibilidad; school_only solo a miembros).
 * - Cotización: RPC `quote_cart` DIRECTA con el JWT (contrato §3). Decide
 *   `school_only` con auth.uid(); el BFF la llamaba con service role y a un
 *   miembro le salía PRODUCT_NOT_AVAILABLE (arreglado en el BFF también).
 * - Crear orden y todo lo demás: BFF (firma de pasarela y URLs firmadas solo
 *   existen ahí).
 */

import { bffClient } from '@/lib/api/bffClient';
import { supabase } from '@/integrations/supabase/client';
import type { StoreProduct } from '@/lib/store/variants';
import type { CartQuote } from '@/lib/store/cart';
import type { Fulfillment, StorePaymentMethod } from '@/lib/store/orderStatus';

// ─── Vitrina ─────────────────────────────────────────────────────────────────

export interface StoreVendor {
    id: string;
    user_id: string;
    display_name: string;
    slug: string | null;
    description: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    city: string | null;
    vendor_type: string | null;
    verification_status?: string | null;
    school_id?: string | null;
}

export interface StoreCatalog {
    vendor: StoreVendor;
    /** false = la tienda existe pero hoy no vende. */
    selling: boolean;
    products: StoreProduct[];
}

/**
 * `withSession`: con sesión el BFF ve al usuario (school_only para miembros).
 * Sin sesión se llama en modo 'public': en anónimo `getSession()` puede
 * quedarse esperando el candado de auth y la vitrina no cargaba nunca.
 */
export async function fetchStoreCatalog(slug: string, withSession = true): Promise<StoreCatalog> {
    const res = await bffClient.get<{ ok: boolean; data: StoreCatalog & { selling?: boolean } }>(
        `/api/v1/marketplace/vendor/${encodeURIComponent(slug)}`,
        undefined,
        withSession ? 'optional' : 'public',
    );
    return { vendor: res.data.vendor, selling: res.data.selling !== false, products: res.data.products ?? [] };
}

// ─── Cotización ──────────────────────────────────────────────────────────────

export interface QuoteInput {
    items: Array<{ product_id?: string; variant_id?: string; quantity: number }>;
    fulfillment: Fulfillment;
    address?: { departamento: string; ciudad?: string; direccion?: string } | null;
}

export async function quoteCart(input: QuoteInput): Promise<CartQuote> {
    // `quote_cart` aún no está en los tipos generados.
    const { data, error } = await supabase.rpc('quote_cart' as never, {
        p_items: input.items,
        p_fulfillment: input.fulfillment,
        p_address: input.fulfillment === 'shipping' ? (input.address ?? null) : null,
        p_coupon_code: null,
    } as never);
    if (error) throw error;
    return data as unknown as CartQuote;
}

// ─── Medios de pago del vendedor ─────────────────────────────────────────────

export type PublicPaymentMethod =
    | { method: 'wompi' | 'mercadopago'; provider?: string; public_key: string | null; sandbox: boolean | null }
    | { method: 'transfer'; hold_hours: number; requires_receipt?: boolean }
    | { method: 'cash_pickup'; hold_hours: number; requires_pickup?: boolean };

export interface PaymentMethodsResponse {
    vendor_profile_id: string;
    allowed: boolean;
    methods: PublicPaymentMethod[];
}

export async function fetchPaymentMethods(vendorProfileId: string): Promise<PaymentMethodsResponse> {
    const res = await bffClient.get<{ ok: boolean; data: PaymentMethodsResponse }>(
        // 'optional' y no 'public': en el BFF el reviewsRouter (montado en /api/v1
        // antes que /api/v1/store) exige sesión a todo lo que pasa por él, así que
        // esta ruta "pública" responde 401 sin token. Con sesión funciona.
        `/api/v1/store/payment-methods/${vendorProfileId}`, undefined, 'optional',
    );
    return res.data;
}

// ─── Crear la orden ──────────────────────────────────────────────────────────

export interface CreateOrderInput {
    items: Array<{ productId?: string; variantId?: string; quantity: number }>;
    fulfillment: Fulfillment;
    pickupBranchId?: string | null;
    address?: { departamento: string; ciudad: string; direccion: string } | null;
    buyer?: { name?: string; document?: string; email?: string; phone?: string; notes?: string };
    paymentMethod: StorePaymentMethod;
    idempotencyKey: string;
}

export interface TransferAccount {
    type?: string;
    label?: string;
    value: string;
    bank?: string;
    account_type?: string;
    holder?: string;
    holder_id?: string;
}

export interface TransferInfo {
    order_id?: string;
    reference?: string;
    amount?: number;
    expires_at?: string | null;
    status?: string;
    accounts: TransferAccount[];
    instructions?: string | null;
}

export interface CreatedOrder {
    orderId: string;
    reference: string;
    status: string;
    paymentMethod: StorePaymentMethod;
    subtotal: number;
    taxTotal: number;
    shippingCost: number;
    grossAmount: number;
    amountInCents: number;
    expiresAt: string | null;
    items: Array<{ product_id: string; variant_id: string | null; name: string; quantity: number; unit_price: number; line_total: number }>;
    provider: string;
    publicKey: string | null;
    sandbox: boolean | null;
    signature: string | null;
    transfer: TransferInfo | null;
    pickupCode: string | null;
    idempotent: boolean;
}

export async function createStoreOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const res = await bffClient.post<{ ok: boolean; data: CreatedOrder }>('/api/v1/marketplace/checkout/cart', input);
    return res.data;
}

// ─── Comprador ───────────────────────────────────────────────────────────────

export interface BuyerOrderItem {
    id: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit_price: number;
    tax_amount?: number | null;
    products?: { id: string; name: string; image_url: string | null } | null;
    product_variants?: { id: string; name: string; attributes?: Record<string, string> | null } | null;
}

export interface StoreOrder {
    id: string;
    reference: string | null;
    status: string;
    payment_method: string | null;
    fulfillment_mode: string | null;
    pickup_branch_id: string | null;
    shipping_address: Record<string, string> | null;
    subtotal: number | null;
    tax_total: number | null;
    shipping_cost: number | null;
    total_amount: number;
    expires_at: string | null;
    created_at: string;
    paid_at?: string | null;
    receipt_path?: string | null;
    receipt_submitted_at?: string | null;
    rejection_reason?: string | null;
    tracking_number?: string | null;
    shipping_carrier?: string | null;
    customer_name?: string | null;
    customer_document?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    buyer_snapshot?: Record<string, string> | null;
    notes?: string | null;
    vendor_profile_id: string | null;
    user_id?: string;
    order_items?: BuyerOrderItem[];
}

export async function fetchMyOrders(): Promise<StoreOrder[]> {
    const res = await bffClient.get<{ ok: boolean; data: StoreOrder[] }>('/api/v1/marketplace/orders?limit=50');
    // Solo las de la tienda v2 (las legacy sin tienda no tienen flujo que seguir).
    return (res.data ?? []).filter((o) => !!o.vendor_profile_id);
}

export async function fetchMyOrder(orderId: string): Promise<StoreOrder> {
    const res = await bffClient.get<{ ok: boolean; data: StoreOrder }>(`/api/v1/marketplace/orders/${orderId}`);
    return res.data;
}

export interface StatusHistoryRow {
    id: string;
    from_status: string | null;
    to_status: string;
    actor_role: string | null;
    note: string | null;
    created_at: string;
}

/** Línea de tiempo (order_status_history, lectura directa con el JWT). */
export async function fetchOrderHistory(orderId: string): Promise<StatusHistoryRow[]> {
    const { data, error } = await supabase
        .from('order_status_history' as never)
        .select('id, from_status, to_status, actor_role, note, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as StatusHistoryRow[];
}

export async function fetchOrderPayment(orderId: string): Promise<{
    paymentMethod: string;
    transfer?: TransferInfo;
    provider?: 'wompi' | 'mercadopago';
    publicKey?: string;
    sandbox?: boolean;
    reference?: string;
    amountInCents?: number;
    signature?: string;
}> {
    const res = await bffClient.get<{ ok: boolean; data: any }>(`/api/v1/store/orders/${orderId}/payment`);
    return res.data;
}

const RECEIPT_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf'];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function receiptFileProblem(file: { name: string; size: number }): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!RECEIPT_EXT.includes(ext)) return 'Sube una foto (jpg, png, webp, heic) o un PDF.';
    if (file.size > RECEIPT_MAX_BYTES) return 'El archivo pesa más de 5 MB.';
    return null;
}

/** URL firmada → subida al bucket privado → submit_order_receipt. */
export async function uploadOrderReceipt(orderId: string, file: File): Promise<void> {
    const up = await bffClient.post<{ ok: boolean; data: { bucket: string; path: string; token: string } }>(
        `/api/v1/store/orders/${orderId}/receipt-url`, { fileName: file.name },
    );
    const { bucket, path, token } = up.data;
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {
        contentType: file.type || undefined,
    });
    if (error) throw Object.assign(new Error('UPLOAD_FAILED'), { body: { error: 'UPLOAD_FAILED' } });
    await bffClient.post(`/api/v1/store/orders/${orderId}/receipt`, { path });
}

export async function cancelMyOrder(orderId: string, reason?: string): Promise<void> {
    await bffClient.post(`/api/v1/store/orders/${orderId}/cancel`, { reason });
}

export async function confirmReceived(orderId: string): Promise<void> {
    await bffClient.post(`/api/v1/store/orders/${orderId}/received`, {});
}

// ─── Tienda (quien la administra) ────────────────────────────────────────────

export const SELLER_ORDER_COLUMNS = `id, reference, status, payment_method, fulfillment_mode, pickup_branch_id, shipping_address,
  subtotal, tax_total, shipping_cost, total_amount, expires_at, created_at, paid_at, receipt_path, receipt_submitted_at,
  rejection_reason, tracking_number, shipping_carrier, customer_name, customer_document, contact_email, contact_phone,
  buyer_snapshot, notes, vendor_profile_id, user_id,
  order_items (id, product_id, variant_id, quantity, unit_price, line_total,
    products (id, name, image_url))`;

/**
 * Pedidos de las tiendas que el usuario administra (RLS orders_select_vendor =
 * can_manage_store). Se excluyen sus compras propias y las órdenes legacy sin tienda.
 */
export async function fetchSellerOrders(userId: string): Promise<StoreOrder[]> {
    const { data, error } = await supabase
        .from('orders')
        .select(SELLER_ORDER_COLUMNS)
        .not('vendor_profile_id', 'is', null)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(300);
    if (error) throw error;
    const orders = (data ?? []) as unknown as StoreOrder[];
    // order_items.variant_id no tiene FK a product_variants (PostgREST no
    // puede embeber): la talla/color se trae aparte.
    const variantIds = [...new Set(orders.flatMap((o) => (o.order_items ?? []).map((i) => i.variant_id)).filter(Boolean))] as string[];
    if (variantIds.length) {
        const { data: variants } = await supabase.from('product_variants').select('id, name, attributes').in('id', variantIds);
        const byId = new Map((variants ?? []).map((v) => [v.id as string, v]));
        for (const o of orders) {
            for (const it of o.order_items ?? []) {
                it.product_variants = it.variant_id ? (byId.get(it.variant_id) as BuyerOrderItem['product_variants']) ?? null : null;
            }
        }
    }
    return orders;
}

export async function sellerReceiptUrl(orderId: string): Promise<string> {
    const res = await bffClient.get<{ ok: boolean; data: { signedUrl: string } }>(`/api/v1/store/vendor/orders/${orderId}/receipt-url`);
    return res.data.signedUrl;
}

export async function approveReceipt(orderId: string): Promise<void> {
    await bffClient.post(`/api/v1/store/vendor/orders/${orderId}/approve-receipt`, {});
}

export async function rejectReceipt(orderId: string, reason: string): Promise<void> {
    await bffClient.post(`/api/v1/store/vendor/orders/${orderId}/reject-receipt`, { reason });
}

export async function confirmCash(orderId: string, pickupCode: string): Promise<void> {
    await bffClient.post(`/api/v1/store/vendor/orders/${orderId}/confirm-cash`, { pickupCode: pickupCode.trim() });
}

export async function sellerTransition(orderId: string, body: {
    to: string; note?: string; trackingNumber?: string; carrier?: string; pickupCode?: string;
}): Promise<void> {
    const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== ''));
    await bffClient.post(`/api/v1/store/vendor/orders/${orderId}/transition`, clean);
}

// ─── Código de retiro (se muestra una sola vez; se guarda en ESTE dispositivo) ──

const pickupKey = (userId: string, orderId: string) => `sportmaps_pickup:${userId}:${orderId}`;

export function rememberPickupCode(userId: string, orderId: string, code: string): void {
    try { localStorage.setItem(pickupKey(userId, orderId), code); } catch { /* modo privado */ }
}

export function recallPickupCode(userId: string, orderId: string): string | null {
    try { return localStorage.getItem(pickupKey(userId, orderId)); } catch { return null; }
}
