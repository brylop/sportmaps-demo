/**
 * Traduce los errores de las RPC de la tienda (tienda v2 F0) a HTTP.
 *
 * Las RPC hacen RAISE EXCEPTION '<TOKEN>' USING ERRCODE = '<sqlstate>', y
 * PostgREST devuelve { code: sqlstate, message: '<TOKEN>…' }. Se decide primero
 * por el TOKEN (más específico) y después por el sqlstate.
 *
 * Puro: se prueba en store-rpc-errors.test.ts.
 */

export interface RpcErrorLike {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
}

export interface MappedRpcError {
    status: number;
    code: string;
    message: string;
    /** DETAIL de la RPC cuando es JSON (p.ej. INSUFFICIENT_STOCK trae [{product_id, variant_id, available}]). */
    details?: unknown;
}

function parseDetails(details: string | null | undefined): unknown {
    if (!details) return undefined;
    try {
        return JSON.parse(details);
    } catch {
        return undefined;
    }
}

const TOKENS: Record<string, { status: number; message: string }> = {
    NOT_OWNER: { status: 403, message: 'No puedes gestionar esta tienda.' },
    NOT_DELIVERED: { status: 403, message: 'Solo compradores con una orden entregada pueden reseñar este producto.' },
    INVALID_QTY: { status: 400, message: 'Cantidad inválida.' },
    INVALID_TEXT: { status: 400, message: 'Texto inválido.' },
    PRODUCT_HAS_VARIANTS: { status: 400, message: 'El producto tiene variantes: ajusta el stock de cada variante.' },
    BELOW_RESERVED: { status: 400, message: 'El stock no puede quedar por debajo de lo reservado en pedidos abiertos.' },
    NOT_FOUND: { status: 404, message: 'No encontrado.' },
    ALREADY_REVIEWED: { status: 409, message: 'Ya dejaste una review para este producto.' },
    PAID_WITHOUT_PROOF: { status: 409, message: 'No se puede marcar como pagada sin prueba de pago.' },
    // ── Motor de la orden (M-F0-4 / M-F0-7) ──
    NOT_AUTHENTICATED: { status: 401, message: 'Inicia sesión para continuar.' },
    STORE_DISABLED: { status: 503, message: 'La tienda no está disponible en este momento.' },
    SELLER_NOT_ALLOWED: { status: 403, message: 'Esta tienda no está vendiendo en este momento.' },
    MULTIPLE_SELLERS: { status: 400, message: 'Se paga una tienda por checkout.' },
    PRODUCT_NOT_FOUND: { status: 404, message: 'Producto no encontrado.' },
    PRODUCT_NOT_AVAILABLE: { status: 409, message: 'Uno de los productos ya no está disponible.' },
    VARIANT_REQUIRED: { status: 400, message: 'Elige talla/color del producto.' },
    INSUFFICIENT_STOCK: { status: 409, message: 'No hay unidades suficientes.' },
    COUPONS_NOT_AVAILABLE: { status: 422, message: 'Los cupones todavía no están disponibles.' },
    INVALID_PAYMENT_METHOD: { status: 400, message: 'Medio de pago inválido.' },
    PAYMENT_METHOD_NOT_ACCEPTED: { status: 409, message: 'La tienda no acepta este medio de pago.' },
    GATEWAY_NOT_CONFIGURED: { status: 409, message: 'La tienda no tiene configurada esa pasarela.' },
    NO_TRANSFER_ACCOUNTS: { status: 409, message: 'La tienda no tiene cuentas para transferencia.' },
    INVALID_FULFILLMENT: { status: 400, message: 'Modalidad de entrega inválida.' },
    CASH_REQUIRES_PICKUP: { status: 400, message: 'El pago en efectivo es solo con retiro en sede.' },
    INVALID_PICKUP_BRANCH: { status: 400, message: 'Sede de retiro inválida.' },
    ADDRESS_REQUIRED: { status: 400, message: 'Falta la dirección de envío.' },
    SHIPPING_ZONE_NOT_FOUND: { status: 422, message: 'No hay envío a ese departamento.' },
    EMPTY_CART: { status: 400, message: 'El carrito está vacío.' },
    TOO_MANY_ITEMS: { status: 400, message: 'Demasiados productos en un checkout.' },
    EMPTY_TOTAL: { status: 400, message: 'El total debe ser mayor a cero.' },
    INVALID_STATE: { status: 409, message: 'La orden no está en un estado que permita esta acción.' },
    ORDER_EXPIRED: { status: 409, message: 'La reserva de esta orden venció.' },
    INVALID_RECEIPT_PATH: { status: 400, message: 'Ruta de comprobante inválida.' },
    NOT_A_TRANSFER_ORDER: { status: 409, message: 'La orden no es por transferencia.' },
    NOT_A_CASH_ORDER: { status: 409, message: 'La orden no es de pago en efectivo.' },
    INVALID_PICKUP_CODE: { status: 403, message: 'Código de retiro inválido.' },
    REASON_REQUIRED: { status: 400, message: 'Escribe el motivo.' },
    TRANSITION_NOT_ALLOWED: { status: 409, message: 'Cambio de estado no permitido.' },
    INVALID_STATUS: { status: 400, message: 'Estado inválido.' },
    ACTOR_WITHOUT_PROFILE: { status: 403, message: 'Tu usuario no tiene perfil.' },
    INVALID_SETTINGS: { status: 400, message: 'Configuración inválida.' },
    FORBIDDEN: { status: 403, message: 'Sin permiso.' },
};

const SQLSTATES: Record<string, { status: number; code: string; message: string }> = {
    '42501': { status: 403, code: 'FORBIDDEN', message: 'Sin permiso.' },
    P0002: { status: 404, code: 'NOT_FOUND', message: 'No encontrado.' },
    '22023': { status: 400, code: 'INVALID_PARAMETER', message: 'Parámetro inválido.' },
    '23514': { status: 400, code: 'CHECK_VIOLATION', message: 'Datos inválidos.' },
    '23505': { status: 409, code: 'DUPLICATE', message: 'Ya existe.' },
    '22P02': { status: 400, code: 'INVALID_PARAMETER', message: 'Parámetro inválido.' },
    // Función inexistente: la migración todavía no está aplicada.
    '42883': { status: 503, code: 'RPC_NOT_AVAILABLE', message: 'Función no disponible todavía.' },
    PGRST202: { status: 503, code: 'RPC_NOT_AVAILABLE', message: 'Función no disponible todavía.' },
};

export function mapStoreRpcError(err: RpcErrorLike | null | undefined): MappedRpcError {
    const text = `${err?.message ?? ''} ${err?.details ?? ''}`;
    // Primero el MENSAJE (el token de la RPC): el DETAIL puede traer JSON con otras palabras.
    for (const source of [err?.message ?? '', text]) {
        for (const token of Object.keys(TOKENS)) {
            if (new RegExp(`\\b${token}\\b`).test(source)) {
                const details = parseDetails(err?.details);
                return {
                    status: TOKENS[token].status, code: token, message: TOKENS[token].message,
                    ...(details !== undefined ? { details } : {}),
                };
            }
        }
    }
    const bySqlstate = err?.code ? SQLSTATES[err.code] : undefined;
    if (bySqlstate) return { ...bySqlstate };
    return { status: 500, code: 'INTERNAL', message: 'Error interno.' };
}

/**
 * Las RPC de reembolso de órdenes no lanzan: devuelven {ok:false, error}.
 */
export function refundErrorStatus(error: string | null | undefined): number {
    switch (error) {
        case 'unauthenticated': return 401;
        case 'forbidden': return 403;
        case 'not_found': return 404;
        case 'refund_already_open':
        case 'invalid_state':
        case 'order_not_eligible':
            return 409;
        default:
            return 400;
    }
}
