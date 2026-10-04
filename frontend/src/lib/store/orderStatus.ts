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

// ─── Tienda v2: comprador y vendedor (contrato §1–§2.4) ─────────────────────

export type StorePaymentMethod = 'wompi' | 'mercadopago' | 'transfer' | 'cash_pickup';
export type Fulfillment = 'pickup' | 'shipping';

export const PAYMENT_METHOD_LABELS: Record<StorePaymentMethod, string> = {
    wompi: 'Tarjeta, PSE o Nequi (Wompi)',
    mercadopago: 'Mercado Pago',
    transfer: 'Transferencia bancaria',
    cash_pickup: 'Efectivo al retirar',
};

export function paymentMethodLabel(raw: string | null | undefined): string {
    return raw && raw in PAYMENT_METHOD_LABELS ? PAYMENT_METHOD_LABELS[raw as StorePaymentMethod] : (raw || 'Sin medio');
}

/** Lo mínimo de una orden para decidir qué mostrar. */
export interface OrderLike {
    status: string | null;
    payment_method?: string | null;
    fulfillment_mode?: string | null;
    expires_at?: string | null;
    rejection_reason?: string | null;
}

/** El comprador puede cancelar mientras no haya pagado (cancel_my_order). */
export function buyerCanCancel(o: OrderLike): boolean {
    const s = normalizeOrderStatus(o.status);
    return s === 'pending_payment' || s === 'awaiting_approval';
}

/** Transferencia esperando comprobante (o rechazado: puede reenviar). */
export function buyerCanUploadReceipt(o: OrderLike, now: Date = new Date()): boolean {
    if (o.payment_method !== 'transfer') return false;
    if (normalizeOrderStatus(o.status) !== 'pending_payment') return false;
    return !o.expires_at || new Date(o.expires_at).getTime() > now.getTime();
}

/** Pago por pasarela que todavía se puede reabrir. */
export function buyerCanRetryGateway(o: OrderLike, now: Date = new Date()): boolean {
    if (o.payment_method !== 'wompi' && o.payment_method !== 'mercadopago') return false;
    if (normalizeOrderStatus(o.status) !== 'pending_payment') return false;
    return !o.expires_at || new Date(o.expires_at).getTime() > now.getTime();
}

export function buyerCanConfirmReceived(o: OrderLike): boolean {
    return normalizeOrderStatus(o.status) === 'shipped';
}

/** Frase que explica al padre en qué va su pedido y qué sigue. */
export function buyerStatusMessage(o: OrderLike): string {
    const s = normalizeOrderStatus(o.status);
    const pickup = o.fulfillment_mode !== 'shipping';
    switch (s) {
        case 'pending_payment':
            if (o.payment_method === 'transfer') {
                return o.rejection_reason
                    ? `La tienda rechazó tu comprobante: ${o.rejection_reason}. Sube uno nuevo.`
                    : 'Transfiere a la cuenta de la tienda y sube el comprobante.';
            }
            if (o.payment_method === 'cash_pickup') return 'Paga en efectivo cuando retires, con tu código de retiro.';
            return 'Falta completar el pago.';
        case 'awaiting_approval': return 'Recibimos tu comprobante. La tienda lo está revisando.';
        case 'payment_review': return 'Tu pago está en revisión. Te avisamos apenas se resuelva.';
        case 'paid': return 'Pago confirmado. La tienda va a preparar tu pedido.';
        case 'preparing': return 'La tienda está preparando tu pedido.';
        case 'ready_for_pickup': return 'Tu pedido está listo. Retíralo en la sede con tu código de retiro.';
        case 'shipped': return 'Tu pedido va en camino.';
        case 'delivered': return pickup ? 'Retiraste tu pedido.' : 'Tu pedido fue entregado.';
        case 'expired': return 'La reserva venció sin pago y los productos se liberaron.';
        case 'cancelled': return 'El pedido fue cancelado.';
        case 'refunded': return 'El pedido fue reembolsado.';
        case 'partially_refunded': return 'Parte del pedido fue reembolsada.';
        default: return '';
    }
}

export interface TimelineStep { status: OrderStatus; label: string; state: 'done' | 'current' | 'todo' }

/** Camino feliz para la línea de tiempo del comprador (los laterales se muestran aparte). */
export function buyerTimeline(o: OrderLike): TimelineStep[] {
    const pickup = o.fulfillment_mode !== 'shipping';
    const steps: OrderStatus[] = ['pending_payment', 'paid', 'preparing', pickup ? 'ready_for_pickup' : 'shipped', 'delivered'];
    const s = normalizeOrderStatus(o.status);
    const at = s === 'awaiting_approval' || s === 'payment_review' ? 0 : s ? steps.indexOf(s) : -1;
    return steps.map((st, i) => ({
        status: st,
        label: st === 'pending_payment' ? (s === 'awaiting_approval' ? 'Comprobante en revisión' : 'Pago')
            : st === 'delivered' ? (pickup ? 'Retirado' : 'Entregado') : ORDER_STATUS_LABELS[st],
        state: at < 0 ? 'todo' : i < at ? 'done' : i === at ? (st === 'delivered' ? 'done' : 'current') : 'todo',
    }));
}

/** Acciones de la tienda sobre una orden, en el orden en que se ofrecen. */
export type SellerAction =
    | { kind: 'approve_receipt'; label: string }
    | { kind: 'reject_receipt'; label: string }
    | { kind: 'confirm_cash'; label: string; needsPickupCode: true }
    | { kind: 'transition'; to: OrderStatus; label: string; needsPickupCode?: boolean; needsTracking?: boolean }
    | { kind: 'cancel'; label: string };

export function sellerActions(o: OrderLike): SellerAction[] {
    const s = normalizeOrderStatus(o.status);
    const pickup = o.fulfillment_mode !== 'shipping';
    switch (s) {
        case 'awaiting_approval':
            return [
                { kind: 'approve_receipt', label: 'Aprobar pago' },
                { kind: 'reject_receipt', label: 'Rechazar comprobante' },
            ];
        case 'pending_payment':
            return o.payment_method === 'cash_pickup'
                ? [{ kind: 'confirm_cash', label: 'Cobrar y entregar', needsPickupCode: true }, { kind: 'cancel', label: 'Cancelar pedido' }]
                : [{ kind: 'cancel', label: 'Cancelar pedido' }];
        case 'paid':
            return [{ kind: 'transition', to: 'preparing', label: 'Preparar pedido' }];
        case 'preparing':
            return pickup
                ? [{ kind: 'transition', to: 'ready_for_pickup', label: 'Listo para retirar' }]
                : [{ kind: 'transition', to: 'shipped', label: 'Marcar enviado', needsTracking: true }];
        case 'ready_for_pickup':
            return [{ kind: 'transition', to: 'delivered', label: 'Entregar con código', needsPickupCode: true }];
        case 'shipped':
            return [{ kind: 'transition', to: 'delivered', label: 'Marcar entregado' }];
        default:
            return [];
    }
}

/** Código de retiro: 6 dígitos (el BFF lo vuelve a validar). */
export function isValidPickupCode(code: string): boolean {
    return /^[0-9]{6}$/.test(code.trim());
}

/** Referencia corta para mostrar: la del contrato (CART-…) o el id. */
export function orderShortRef(o: { reference?: string | null; id: string }): string {
    return o.reference || `ORD-${o.id.slice(0, 8).toUpperCase()}`;
}
