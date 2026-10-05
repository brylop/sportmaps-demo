/**
 * Checkout de la tienda (tienda v2 F0, M-F0-4 / M-F0-7).
 *
 * El BFF ya no arma la orden: la crea la RPC create_cart_order en UNA
 * transacción (precio, IVA, envío, reserva y total salen de la base). Acá solo
 * vive lo que la base no puede hacer:
 *   - traducir el body HTTP (contrato nuevo y el legacy de CartCheckoutModal)
 *     a los argumentos de la RPC;
 *   - firmar Wompi / exponer la llave pública con la pasarela PROPIA del
 *     vendedor de la orden (orders.seller_gateway_id). Nunca llaves de ENV
 *     (D-5 = A: las de ENV son de una escuela real, Dynasty);
 *   - comparar el monto que reporta la pasarela con orders.total_amount.
 *
 * Contrato para el frontend: docs/specs/tienda-v2-contrato-checkout.md.
 */

import { z } from 'zod';
import { supabase } from '../config/supabase';
import { resolveSellerGateway, type ResolvedProvider } from './payment-provider.resolver';
import { signIntegrity, wompiCredsFrom, copToCents, type WompiCreds } from './wompi.service';

export const STORE_PAYMENT_METHODS = ['wompi', 'mercadopago', 'transfer', 'cash_pickup'] as const;
export type StorePaymentMethod = typeof STORE_PAYMENT_METHODS[number];

// 8-4-4-4-12 hex. Uuid de zod v4 exige versión/variante RFC y
// rechaza ids válidos de Postgres (p.ej. los UUID fijos del gemelo).
const Uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'uuid');

const ItemSchema = z.object({
    productId: Uuid.optional(),
    variantId: Uuid.optional(),
    quantity: z.number().int().min(1).max(20),
}).refine((i) => !!(i.productId || i.variantId), { message: 'productId o variantId' });

/**
 * Body de POST /checkout/cart. Acepta el contrato nuevo (fulfillment,
 * paymentMethod, buyer, idempotencyKey) y el legacy del CartCheckoutModal
 * (shippingAddress + contact* + preferredProvider). Ningún precio entra: si
 * el cliente manda unitPrice/total se descartan acá y la base los ignora igual.
 */
export const StoreCheckoutSchema = z.object({
    items: z.array(ItemSchema).min(1).max(50),
    fulfillment: z.enum(['pickup', 'shipping']).optional(),
    pickupBranchId: Uuid.optional().nullable(),
    address: z.object({
        departamento: z.string().min(2).optional(),
        department: z.string().min(2).optional(),
        ciudad: z.string().optional(),
        city: z.string().optional(),
        direccion: z.string().optional(),
        line1: z.string().optional(),
        line2: z.string().optional(),
        postalCode: z.string().optional(),
    }).optional().nullable(),
    buyer: z.object({
        name: z.string().max(200).optional(),
        document: z.string().max(40).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(40).optional(),
        notes: z.string().max(1000).optional(),
    }).optional().nullable(),
    paymentMethod: z.enum(STORE_PAYMENT_METHODS).optional(),
    couponCode: z.string().max(60).optional().nullable(),
    idempotencyKey: Uuid.optional().nullable(),
    // ── legacy (CartCheckoutModal) ──
    shippingAddress: z.object({
        line1: z.string().min(1),
        line2: z.string().optional(),
        city: z.string().min(1),
        department: z.string().min(1),
        postalCode: z.string().optional(),
    }).optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    customerName: z.string().optional(),
    customerDocument: z.string().optional(),
    notes: z.string().optional(),
    preferredProvider: z.enum(['wompi', 'mercadopago']).optional(),
});

export type StoreCheckoutBody = z.infer<typeof StoreCheckoutSchema>;

export interface CreateCartOrderArgs {
    p_items: Array<{ product_id?: string; variant_id?: string; quantity: number }>;
    p_fulfillment: 'pickup' | 'shipping';
    p_pickup_branch: string | null;
    p_address: Record<string, unknown> | null;
    p_buyer: Record<string, unknown>;
    p_payment_method: StorePaymentMethod;
    p_coupon_code: string | null;
    p_buyer_id: string;
    p_idempotency_key: string | null;
}

/** Body HTTP → argumentos de create_cart_order. Puro. */
export function toCreateCartOrderArgs(body: StoreCheckoutBody, buyerId: string): CreateCartOrderArgs {
    const legacyAddr = body.shippingAddress;
    const address = body.address ?? (legacyAddr ? {
        departamento: legacyAddr.department,
        ciudad: legacyAddr.city,
        direccion: [legacyAddr.line1, legacyAddr.line2].filter(Boolean).join(' '),
        postalCode: legacyAddr.postalCode,
    } : null);
    const fulfillment = body.fulfillment ?? (address ? 'shipping' : 'pickup');
    const buyer = {
        name: body.buyer?.name ?? body.customerName,
        document: body.buyer?.document ?? body.customerDocument,
        email: body.buyer?.email ?? body.contactEmail,
        phone: body.buyer?.phone ?? body.contactPhone,
        notes: body.buyer?.notes ?? body.notes,
    };
    return {
        p_items: body.items.map((i) => ({
            ...(i.variantId ? { variant_id: i.variantId } : {}),
            ...(i.productId ? { product_id: i.productId } : {}),
            quantity: i.quantity,
        })),
        p_fulfillment: fulfillment,
        p_pickup_branch: fulfillment === 'pickup' ? body.pickupBranchId ?? null : null,
        p_address: fulfillment === 'shipping' ? (address as Record<string, unknown> | null) : null,
        p_buyer: Object.fromEntries(Object.entries(buyer).filter(([, v]) => v !== undefined && v !== '')),
        p_payment_method: body.paymentMethod ?? body.preferredProvider ?? 'wompi',
        p_coupon_code: body.couponCode ?? null,
        p_buyer_id: buyerId,
        p_idempotency_key: body.idempotencyKey ?? null,
    };
}

/** Lo que la pasarela cobró (COP o centavos) == orders.total_amount, al peso. */
export function amountMatchesOrder(orderTotalCop: number | string, paid: { cop?: number; cents?: number }): boolean {
    const total = Number(orderTotalCop);
    if (!Number.isFinite(total) || total <= 0) return false;
    if (typeof paid.cents === 'number') return Number.isFinite(paid.cents) && copToCents(total) === Math.round(paid.cents);
    if (typeof paid.cop === 'number') return Number.isFinite(paid.cop) && Math.round(paid.cop * 100) === copToCents(total);
    return false;
}

export class SellerGatewayError extends Error {
    readonly code = 'SELLER_GATEWAY_NOT_CONFIGURED';
    constructor(message = 'El vendedor no tiene su pasarela configurada para este medio.') {
        super(message);
    }
}

export interface OrderGatewayRow {
    id: string;
    reference: string | null;
    total_amount: number | string;
    payment_method: string | null;
    seller_gateway_id: string | null;
    seller_gateway_kind: string | null;
}

/** Credenciales del vendedor de la orden, o error (nunca ENV). */
export async function sellerGatewayForOrder(order: OrderGatewayRow): Promise<ResolvedProvider> {
    const resolved = await resolveSellerGateway({
        gatewayId: order.seller_gateway_id,
        gatewayKind: order.seller_gateway_kind,
    });
    if (!resolved || resolved.source === 'env') throw new SellerGatewayError();
    if (order.payment_method && resolved.provider !== order.payment_method) throw new SellerGatewayError();
    return resolved;
}

/** Credenciales Wompi del vendedor (para validar webhooks/reconsultar). Null = no verificable. */
export async function sellerWompiCredsForOrder(order: OrderGatewayRow): Promise<WompiCreds | null> {
    try {
        const g = await sellerGatewayForOrder(order);
        return g.provider === 'wompi' ? wompiCredsFrom(g) : null;
    } catch {
        return null;
    }
}

export interface GatewayPayload {
    provider: 'wompi' | 'mercadopago';
    publicKey: string;
    sandbox: boolean;
    reference: string;
    amountInCents: number;
    /** Solo Wompi: firma de integridad con el integrity secret DEL VENDEDOR. */
    signature?: string;
}

/** Datos para abrir el widget (Wompi) o el Brick (MP) con las llaves del vendedor. */
export async function gatewayPayloadForOrder(order: OrderGatewayRow): Promise<GatewayPayload> {
    if (order.payment_method !== 'wompi' && order.payment_method !== 'mercadopago') {
        throw new SellerGatewayError('La orden no se paga por pasarela.');
    }
    if (!order.reference) throw new SellerGatewayError('Orden sin referencia.');
    const g = await sellerGatewayForOrder(order);
    const amountInCents = copToCents(Number(order.total_amount));
    if (g.provider === 'wompi') {
        const creds = wompiCredsFrom(g);
        if (!creds?.integritySecret) throw new SellerGatewayError();
        return {
            provider: 'wompi',
            publicKey: creds.publicKey,
            sandbox: creds.sandbox,
            reference: order.reference,
            amountInCents,
            signature: signIntegrity({ reference: order.reference, amountInCents, currency: 'COP' }, creds),
        };
    }
    return { provider: 'mercadopago', publicKey: g.publicKey, sandbox: g.sandbox, reference: order.reference, amountInCents };
}

const ORDER_GATEWAY_COLUMNS = 'id, reference, total_amount, payment_method, seller_gateway_id, seller_gateway_kind, status, user_id';

/** Orden de tienda por referencia de pasarela (CART-…): reference, wompi_reference o provider_reference. */
export async function findStoreOrderByReference(reference: string): Promise<(OrderGatewayRow & { status: string; user_id: string | null }) | null> {
    for (const col of ['reference', 'wompi_reference', 'provider_reference'] as const) {
        const { data } = await supabase.from('orders').select(ORDER_GATEWAY_COLUMNS).eq(col, reference).maybeSingle();
        if (data) return data as any;
    }
    return null;
}

export async function findStoreOrderById(orderId: string): Promise<(OrderGatewayRow & { status: string; user_id: string | null }) | null> {
    const { data } = await supabase.from('orders').select(ORDER_GATEWAY_COLUMNS).eq('id', orderId).maybeSingle();
    return (data as any) ?? null;
}
