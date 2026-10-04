/**
 * Estados de pedido de la tienda (Tienda v2 F0, M-F0-3).
 *
 * La base solo admite estos valores (`orders_status_check`). Los legacy
 * `pending` y `processing` se migraron a `pending_payment` y `preparing`, pero
 * se toleran aquí por si llega una fila vieja o un BFF desactualizado: se
 * muestran con la etiqueta del estado nuevo, nunca como "Desconocido".
 *
 * El vendedor NO escribe `orders` con su JWT (42501 tras M-F0-3): las
 * transiciones van por PATCH /api/v1/marketplace/orders/vendor/:id/status.
 */

export const ORDER_STATUSES = [
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

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    pending_payment: 'Pendiente de pago',
    awaiting_approval: 'Esperando aprobación',
    payment_review: 'En revisión',
    paid: 'Pagado',
    preparing: 'En preparación',
    ready_for_pickup: 'Listo para retirar',
    shipped: 'Enviado',
    delivered: 'Entregado',
    expired: 'Vencido',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    partially_refunded: 'Reembolso parcial',
};

/** Valores viejos que pueden seguir apareciendo y a qué estado nuevo equivalen. */
const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
    pending: 'pending_payment',
    processing: 'preparing',
    // La M-F0-3 mapeó estos a `cancelled`; se toleran por si quedó alguno.
    declined: 'cancelled',
    failed: 'cancelled',
};

export function isOrderStatus(value: unknown): value is OrderStatus {
    return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Lleva cualquier valor (nuevo o legacy) al estado vigente; `null` si no se reconoce. */
export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus | null {
    if (!raw) return null;
    const value = raw.trim().toLowerCase();
    if (isOrderStatus(value)) return value;
    return LEGACY_STATUS_MAP[value] ?? null;
}

/** Etiqueta en español. Un valor desconocido se muestra tal cual, no se inventa. */
export function orderStatusLabel(raw: string | null | undefined): string {
    const status = normalizeOrderStatus(raw);
    if (status) return ORDER_STATUS_LABELS[status];
    return raw ? raw : 'Sin estado';
}

/**
 * Transiciones que el vendedor puede pedir al BFF
 * (PATCH /api/v1/marketplace/orders/vendor/:id/status).
 */
export const VENDOR_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
    paid: ['preparing'],
    preparing: ['ready_for_pickup', 'shipped'],
    ready_for_pickup: ['delivered'],
    shipped: ['delivered'],
};

export function vendorNextStatuses(raw: string | null | undefined): OrderStatus[] {
    const status = normalizeOrderStatus(raw);
    if (!status) return [];
    return VENDOR_TRANSITIONS[status] ?? [];
}

/** Texto del botón que lleva al estado `to`. */
export const VENDOR_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
    preparing: 'Preparar',
    ready_for_pickup: 'Listo para retirar',
    shipped: 'Marcar enviado',
    delivered: 'Marcar entregado',
};

// ─── Filtros de la pantalla de pedidos del vendedor ─────────────────────────

export type OrderStatusGroup =
    | 'awaiting_payment'
    | 'to_prepare'
    | 'in_progress'
    | 'delivered'
    | 'closed';

export const ORDER_STATUS_GROUPS: Record<OrderStatusGroup, { label: string; statuses: OrderStatus[] }> = {
    awaiting_payment: {
        label: 'Por cobrar',
        statuses: ['pending_payment', 'awaiting_approval', 'payment_review'],
    },
    to_prepare: { label: 'Pagados', statuses: ['paid'] },
    in_progress: { label: 'En curso', statuses: ['preparing', 'ready_for_pickup', 'shipped'] },
    delivered: { label: 'Entregados', statuses: ['delivered'] },
    closed: {
        label: 'Cerrados',
        statuses: ['expired', 'cancelled', 'refunded', 'partially_refunded'],
    },
};

export function orderStatusGroup(raw: string | null | undefined): OrderStatusGroup | null {
    const status = normalizeOrderStatus(raw);
    if (!status) return null;
    for (const [group, def] of Object.entries(ORDER_STATUS_GROUPS) as [OrderStatusGroup, { statuses: OrderStatus[] }][]) {
        if (def.statuses.includes(status)) return group;
    }
    return null;
}

/** Pedidos que el vendedor tiene que atender (pagados o en curso, sin entregar). */
export function isOrderPendingForVendor(raw: string | null | undefined): boolean {
    const group = orderStatusGroup(raw);
    return group === 'to_prepare' || group === 'in_progress';
}

/** Pedidos que cuentan como venta (el dinero entró). */
export function isOrderPaidLike(raw: string | null | undefined): boolean {
    const group = orderStatusGroup(raw);
    return group === 'to_prepare' || group === 'in_progress' || group === 'delivered';
}
