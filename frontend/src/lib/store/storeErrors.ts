/**
 * Mensajes amables para los errores de la tienda tras Tienda v2 F0.
 */

interface PgLikeError {
    code?: string | null;
    message?: string | null;
}

function asPgError(err: unknown): PgLikeError {
    if (err && typeof err === 'object') return err as PgLikeError;
    if (typeof err === 'string') return { message: err };
    return {};
}

/**
 * `rpc('enable_school_store', { p_school_id })` → mensaje para la escuela.
 * Errores conocidos: 42501 (no es dueño/admin), ADDON_REQUIRED,
 * OWNER_HAS_OTHER_VENDOR_PROFILE.
 */
export function enableSchoolStoreErrorMessage(err: unknown): {
    title: string;
    description: string;
    addonRequired: boolean;
} {
    const { code, message } = asPgError(err);
    const msg = message ?? '';

    if (msg.includes('ADDON_REQUIRED')) {
        return {
            title: 'Falta el adicional de Tienda',
            description: 'Para abrir la tienda escolar primero activa el adicional "Tienda" en Mi plan.',
            addonRequired: true,
        };
    }
    if (msg.includes('OWNER_HAS_OTHER_VENDOR_PROFILE')) {
        return {
            title: 'El dueño ya tiene otra tienda',
            description: 'La cuenta dueña de la escuela ya tiene una tienda personal. Escríbenos a soporte para unificarla con la tienda escolar.',
            addonRequired: false,
        };
    }
    if (code === '42501') {
        return {
            title: 'Sin permiso',
            description: 'Solo el dueño o un administrador de la escuela puede activar la tienda escolar.',
            addonRequired: false,
        };
    }
    return {
        title: 'No se pudo activar la tienda',
        description: 'Intenta de nuevo en unos minutos. Si el problema sigue, escríbenos a soporte.',
        addonRequired: false,
    };
}

/** Mensaje cuando el borrado directo de un producto no procede. */
export const PRODUCT_DELETE_NOT_ALLOWED =
    'Solo se pueden eliminar productos en borrador o rechazados. Para retirarlo de la tienda, archívalo desde Mis productos.';

export function productDeleteErrorMessage(err: unknown): string {
    const { code } = asPgError(err);
    if (code === '42501') return PRODUCT_DELETE_NOT_ALLOWED;
    const msg = asPgError(err).message;
    return msg || 'No se pudo eliminar el producto.';
}

/** La compra de productos por el checkout viejo quedó deshabilitada (T15). */
export const PRODUCT_PURCHASE_UNAVAILABLE = 'La compra de productos no está disponible por ahora.';

// ─── Checkout y órdenes de la tienda v2 (contrato docs/specs/tienda-v2-contrato-checkout.md §4) ───

/** Qué puede hacer la pantalla después del error. */
export type StoreErrorAction =
    | 'review_cart'        // volver al carrito: stock, producto, talla
    | 'choose_other_method'
    | 'fix_delivery'
    | 'login'
    | 'store_off'
    | 'reload_order'
    | 'retry'
    | 'none';

export interface StoreErrorView {
    code: string;
    title: string;
    description: string;
    action: StoreErrorAction;
}

export interface StockShortage { product_id?: string; variant_id?: string | null; requested?: number; available?: number }

const STORE_ERRORS: Record<string, Omit<StoreErrorView, 'code'>> = {
    STORE_DISABLED: { title: 'La tienda no está disponible', description: 'Por ahora no se pueden hacer compras. Tu carrito queda guardado para cuando vuelva a abrir.', action: 'store_off' },
    SELLER_NOT_ALLOWED: { title: 'Esta tienda no está vendiendo', description: 'La tienda no está recibiendo pedidos en este momento. Intenta más tarde.', action: 'none' },
    MULTIPLE_SELLERS: { title: 'Una tienda a la vez', description: 'Paga por separado los productos de cada tienda.', action: 'review_cart' },
    PRODUCT_NOT_FOUND: { title: 'Un producto ya no existe', description: 'Revisa tu carrito y quita el producto que ya no está.', action: 'review_cart' },
    PRODUCT_NOT_AVAILABLE: { title: 'Un producto ya no está disponible', description: 'Revisa tu carrito: uno de los productos dejó de venderse.', action: 'review_cart' },
    VARIANT_REQUIRED: { title: 'Falta elegir talla o color', description: 'Abre el producto y elige la talla o el color antes de pagar.', action: 'review_cart' },
    INSUFFICIENT_STOCK: { title: 'No hay unidades suficientes', description: 'Alguien compró antes que tú. Ajustamos tu carrito con lo que queda.', action: 'review_cart' },
    INVALID_QTY: { title: 'Cantidad no válida', description: 'Puedes llevar de 1 a 20 unidades por producto.', action: 'review_cart' },
    EMPTY_CART: { title: 'Tu carrito está vacío', description: 'Agrega productos antes de pagar.', action: 'review_cart' },
    COUPONS_NOT_AVAILABLE: { title: 'Cupones no disponibles', description: 'Todavía no recibimos cupones de descuento.', action: 'none' },
    PAYMENT_METHOD_NOT_ACCEPTED: { title: 'Medio de pago no disponible', description: 'Esta tienda no recibe ese medio de pago. Elige otro.', action: 'choose_other_method' },
    GATEWAY_NOT_CONFIGURED: { title: 'Pago en línea no disponible', description: 'La tienda todavía no tiene su pasarela lista. Elige transferencia o efectivo.', action: 'choose_other_method' },
    SELLER_GATEWAY_NOT_CONFIGURED: { title: 'Pago en línea no disponible', description: 'La tienda no tiene su pasarela lista. Tu pedido quedó reservado: cancélalo desde Mis compras o elige otro medio.', action: 'choose_other_method' },
    NO_TRANSFER_ACCOUNTS: { title: 'Transferencia no disponible', description: 'La tienda no tiene cuentas registradas para transferencia. Elige otro medio.', action: 'choose_other_method' },
    INVALID_PAYMENT_METHOD: { title: 'Medio de pago no válido', description: 'Elige uno de los medios que ofrece la tienda.', action: 'choose_other_method' },
    CASH_REQUIRES_PICKUP: { title: 'Efectivo solo al retirar', description: 'El pago en efectivo es solo con retiro en sede.', action: 'fix_delivery' },
    ADDRESS_REQUIRED: { title: 'Falta la dirección', description: 'Escribe el departamento, la ciudad y la dirección de envío.', action: 'fix_delivery' },
    INVALID_PICKUP_BRANCH: { title: 'Sede no válida', description: 'Elige otra sede para retirar.', action: 'fix_delivery' },
    INVALID_FULFILLMENT: { title: 'Entrega no válida', description: 'Elige retiro en sede o envío.', action: 'fix_delivery' },
    SHIPPING_ZONE_NOT_FOUND: { title: 'No hay envío a ese departamento', description: 'Esta tienda no envía a ese departamento. Elige retiro en sede u otra dirección.', action: 'fix_delivery' },
    SHIPPING_NOT_OFFERED: { title: 'Solo retiro en sede', description: 'Esta tienda no hace envíos a domicilio. Elige retiro en sede para seguir.', action: 'fix_delivery' },
    NOT_AUTHENTICATED: { title: 'Inicia sesión', description: 'Para comprar necesitas iniciar sesión.', action: 'login' },
    INVALID_STATE: { title: 'El pedido cambió de estado', description: 'Actualizamos el pedido para que veas cómo va.', action: 'reload_order' },
    ORDER_EXPIRED: { title: 'La reserva venció', description: 'El tiempo para pagar este pedido se acabó y los productos se liberaron. Haz un pedido nuevo.', action: 'reload_order' },
    TRANSITION_NOT_ALLOWED: { title: 'Cambio no permitido', description: 'El pedido no admite ese paso desde su estado actual.', action: 'reload_order' },
    INVALID_PICKUP_CODE: { title: 'Código de retiro incorrecto', description: 'Pide al comprador el código de 6 dígitos que recibió al hacer el pedido.', action: 'none' },
    NOT_A_PICKUP_ORDER: { title: 'Este pedido no se retira en sede', description: 'Los pedidos con envío no usan código de retiro.', action: 'reload_order' },
    PICKUP_CODE_LIMIT: { title: 'Ya no puedes generar más códigos', description: 'Generaste el máximo de códigos para este pedido. Escríbele a la tienda para retirarlo.', action: 'none' },
    RATE_LIMITED: { title: 'Demasiadas solicitudes', description: 'Demasiadas solicitudes, intenta en un minuto.', action: 'retry' },
    NOT_OWNER: { title: 'Sin permiso', description: 'Solo el dueño o un administrador de la tienda puede hacer esto.', action: 'none' },
    FORBIDDEN: { title: 'Sin permiso', description: 'No tienes permiso para esta acción.', action: 'none' },
    NOT_FOUND: { title: 'Pedido no encontrado', description: 'No encontramos ese pedido.', action: 'none' },
    REASON_REQUIRED: { title: 'Falta el motivo', description: 'Escribe por qué rechazas el comprobante (mínimo 3 letras).', action: 'none' },
    INVALID_RECEIPT_PATH: { title: 'Comprobante no válido', description: 'Vuelve a subir el comprobante.', action: 'retry' },
    INVALID_FILE: { title: 'Archivo no permitido', description: 'Sube una foto (jpg, png, webp, heic) o un PDF de máximo 5 MB.', action: 'none' },
    NOT_A_TRANSFER_ORDER: { title: 'No es un pedido por transferencia', description: 'Este pedido no se paga con comprobante.', action: 'reload_order' },
    NOT_A_CASH_ORDER: { title: 'No es un pedido en efectivo', description: 'Este pedido no se cobra en efectivo al retirar.', action: 'reload_order' },
    USER_PAYMENT_BLOCKED: { title: 'Pagos bloqueados', description: 'Tu cuenta tiene los pagos en línea bloqueados. Escribe a soporte.', action: 'none' },
    RPC_NOT_AVAILABLE: { title: 'La tienda se está actualizando', description: 'Intenta de nuevo en unos minutos.', action: 'retry' },
};

/** Extrae el código del contrato de un error del BFF (`{ok:false, error:CODE}`) o de una RPC. */
export function storeErrorCode(err: unknown): string {
    const e = err as { body?: { error?: unknown }; message?: unknown } | null;
    const fromBody = e?.body && typeof e.body.error === 'string' ? e.body.error : null;
    if (fromBody && /^[A-Z_]+$/.test(fromBody)) return fromBody;
    const msg = typeof e?.message === 'string' ? e.message : typeof err === 'string' ? err : '';
    const token = Object.keys(STORE_ERRORS).find((k) => new RegExp(`\\b${k}\\b`).test(msg));
    if (token) return token;
    return 'UNKNOWN';
}

/** Detalle de INSUFFICIENT_STOCK: `[{product_id, variant_id, requested, available}]`. */
export function stockShortages(err: unknown): StockShortage[] {
    const details = (err as { body?: { details?: unknown } } | null)?.body?.details;
    return Array.isArray(details) ? (details as StockShortage[]) : [];
}

/** Error del contrato → texto en español y qué ofrecer. Nunca muestra el código crudo. */
export function storeErrorView(err: unknown): StoreErrorView {
    const code = storeErrorCode(err);
    const known = STORE_ERRORS[code];
    if (known) {
        if (code === 'INSUFFICIENT_STOCK') {
            const s = stockShortages(err);
            if (s.length === 1 && typeof s[0].available === 'number') {
                return {
                    code, ...known,
                    description: s[0].available > 0
                        ? `Solo quedan ${s[0].available} unidades de uno de tus productos. Ajusta la cantidad para seguir.`
                        : 'Uno de tus productos se agotó mientras comprabas. Quítalo para seguir.',
                };
            }
        }
        return { code, ...known };
    }
    const status = (err as { status?: number } | null)?.status;
    if (status === 401) return { code: 'NOT_AUTHENTICATED', ...STORE_ERRORS.NOT_AUTHENTICATED };
    // Límite de operaciones del BFF (lecturas y escrituras de la tienda, por cliente).
    if (status === 429) return { code: 'RATE_LIMITED', ...STORE_ERRORS.RATE_LIMITED };
    if (status === 503) return { code: 'STORE_DISABLED', ...STORE_ERRORS.STORE_DISABLED };
    if (err instanceof TypeError) {
        return { code: 'NETWORK', title: 'Sin conexión', description: 'No pudimos comunicarnos. Revisa tu internet e intenta de nuevo.', action: 'retry' };
    }
    return { code, title: 'Algo salió mal', description: 'No pudimos completar la acción. Intenta de nuevo en un momento.', action: 'retry' };
}

/** ¿Vale la pena reintentar con la MISMA idempotency key? (red caída, 5xx). */
export function isRetryableWithSameKey(err: unknown): boolean {
    if (err instanceof TypeError) return true;
    const status = (err as { status?: number } | null)?.status;
    if (status === 429) return true; // rechazado antes de crear nada; la misma key es segura
    return typeof status === 'number' && status >= 500 && status !== 503;
}

/**
 * Por qué no se pudo leer un pedido. Un 429 (límite de operaciones) o una caída
 * NO son "no existe": la pantalla debe decir "intenta en un minuto" y no
 * "Pedido no encontrado" (el comprador creía haber perdido su compra).
 */
export type OrderLoadError = 'rate_limited' | 'not_found' | 'network' | 'other';

export function orderLoadError(err: unknown): OrderLoadError {
    if (err instanceof TypeError) return 'network';
    const status = (err as { status?: number } | null)?.status;
    if (status === 429) return 'rate_limited';
    if (status === 404 || status === 400) return 'not_found';
    return 'other';
}
