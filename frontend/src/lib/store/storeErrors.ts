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
