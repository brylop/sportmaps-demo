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
    for (const token of Object.keys(TOKENS)) {
        if (new RegExp(`\\b${token}\\b`).test(text)) {
            return { status: TOKENS[token].status, code: token, message: TOKENS[token].message };
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
