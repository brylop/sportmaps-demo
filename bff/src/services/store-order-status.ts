/**
 * Estados de una orden de la tienda (tienda v2 F0, M-F0-3).
 *
 * La base tiene un CHECK sobre orders.status con exactamente esta lista. Todo
 * lo demás ('pending', 'processing', 'declined', 'failed', 'rejected', texto
 * libre) falla con 23514. Este módulo es la única fuente de esos valores en el
 * BFF: el PATCH del vendedor y los webhooks de Wompi/Mercado Pago pasan por acá
 * antes de escribir.
 *
 * Puro: cero red, cero base. Se prueba en store-order-status.test.ts.
 */

export const STORE_ORDER_STATUSES = [
    'pending_payment',
    'awaiting_approval',
    'payment_review',
    'paid',
    'preparing',
    'ready_for_pickup',
    'shipped',
    'delivered',
    'expired',
    'cancelled',
    'refunded',
    'partially_refunded',
] as const;

export type StoreOrderStatus = typeof STORE_ORDER_STATUSES[number];

/** Valores viejos que todavía puede mandar un cliente (o tener una fila vieja). */
const LEGACY_STATUS_MAP: Record<string, StoreOrderStatus> = {
    pending: 'pending_payment',
    processing: 'preparing',
    declined: 'cancelled',
    rejected: 'cancelled',
    failed: 'cancelled',
    completed: 'delivered',
};

export function isStoreOrderStatus(value: unknown): value is StoreOrderStatus {
    return typeof value === 'string' && (STORE_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Lleva un valor (nuevo o legacy) a un estado válido del CHECK.
 * Devuelve null si no es un estado reconocible: el llamador responde 400.
 */
export function normalizeOrderStatus(value: unknown): StoreOrderStatus | null {
    if (typeof value !== 'string') return null;
    const s = value.trim().toLowerCase();
    if (isStoreOrderStatus(s)) return s;
    return LEGACY_STATUS_MAP[s] ?? null;
}

/** La orden todavía espera el pago (incluye el 'pending' legacy). */
export function isAwaitingPayment(status: unknown): boolean {
    return normalizeOrderStatus(status) === 'pending_payment';
}

/** Estados previos a un pago confirmado. */
const PRE_PAYMENT: readonly StoreOrderStatus[] = ['pending_payment', 'awaiting_approval', 'payment_review'];

/** Estados con plata cobrada. */
const PAID_LIKE: readonly StoreOrderStatus[] = [
    'paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'partially_refunded',
];

/**
 * Lo que un vendedor puede hacer con su pedido. Conservador a propósito:
 *  - Cancelar un pedido pagado NO está acá: eso es un reembolso
 *    (request_order_refund / approve_order_refund), que devuelve plata y stock.
 *  - Nada antes de 'paid': confirmar un pago no lo decide el vendedor por esta ruta.
 */
export const VENDOR_TRANSITIONS: Readonly<Partial<Record<StoreOrderStatus, readonly StoreOrderStatus[]>>> = {
    paid: ['preparing'],
    preparing: ['ready_for_pickup', 'shipped'],
    ready_for_pickup: ['delivered'],
    shipped: ['delivered'],
};

export type VendorTransitionCheck =
    | { ok: true; from: StoreOrderStatus | null; to: StoreOrderStatus; changed: boolean }
    | { ok: false; http: 400 | 409; error: 'INVALID_STATUS' | 'TRANSITION_NOT_ALLOWED'; from: StoreOrderStatus | null; to: StoreOrderStatus | null };

/**
 * ¿Puede el vendedor pasar la orden de `current` a `requested`?
 *  - `requested` irreconocible → 400 INVALID_STATUS.
 *  - Mismo estado → ok sin cambio (sirve para actualizar la guía de envío).
 *  - Transición fuera de la matriz → 409 TRANSITION_NOT_ALLOWED.
 */
export function checkVendorTransition(current: unknown, requested: unknown): VendorTransitionCheck {
    const to = normalizeOrderStatus(requested);
    const from = normalizeOrderStatus(current);
    if (!to) return { ok: false, http: 400, error: 'INVALID_STATUS', from, to: null };
    if (from === to) return { ok: true, from, to, changed: false };
    const allowed = from ? VENDOR_TRANSITIONS[from] ?? [] : [];
    if (!allowed.includes(to)) {
        return { ok: false, http: 409, error: 'TRANSITION_NOT_ALLOWED', from, to };
    }
    return { ok: true, from, to, changed: true };
}

/** Estado interno que devuelven mapWompiStatus / mapMpStatus. */
export type WebhookInternalStatus = 'paid' | 'rejected' | 'refunded' | 'failed' | 'pending';

/**
 * Estado a escribir en la orden cuando el webhook NO trae un pago aprobado
 * ('paid' va por confirm_order_payment, no por acá).
 *
 * Devuelve null = no tocar orders.status (solo se guarda el id de la transacción):
 *  - 'pending': el pago sigue en curso.
 *  - Rechazo/fallo sobre una orden que ya no espera pago (pagada, cancelada,
 *    vencida…): un intento fallido posterior no deshace un pago bueno.
 *  - Anulación sobre una orden ya cerrada (cancelada/vencida/reembolsada).
 */
export function cartWebhookFailureStatus(
    currentStatus: unknown,
    internalStatus: WebhookInternalStatus | string,
): StoreOrderStatus | null {
    const current = normalizeOrderStatus(currentStatus);
    switch (internalStatus) {
        case 'pending':
        case 'paid':
            return null;
        case 'rejected':
        case 'failed':
            return current === null || PRE_PAYMENT.includes(current) ? 'cancelled' : null;
        case 'refunded':
            if (current !== null && PAID_LIKE.includes(current)) return 'refunded';
            // Anulación de un pago que nunca se confirmó en la orden.
            if (current === null || PRE_PAYMENT.includes(current)) return 'cancelled';
            return null;
        default:
            return null;
    }
}
