/**
 * Interruptor temporal de «Cobros y pagos» (docs/specs/cobros-multiples.md F3).
 *
 * El spec (D15) dice que el modal es general, sin flag ni addon. Este interruptor
 * NO es un gate de producto: existe solo porque el BFF (F2) y las RPCs (F1) se
 * construyen en paralelo y no están desplegados. Mientras esté apagado, todos los
 * puntos de entrada siguen abriendo el «Registrar pago» de siempre
 * (RegisterCashPaymentModal) y producción no cambia. Se borra —junto con el modal
 * viejo— cuando F1+F2 estén vivos.
 *
 * Encendido si:
 *   - `VITE_COBROS_Y_PAGOS` = on | true | 1 en el build (dev/staging), o
 *   - en ESTE navegador, localStorage['sportmaps:cobros-y-pagos'] = 'on'
 *     (QA en un ambiente sin redeploy). El BFF sigue siendo el gate real: sin
 *     F2 desplegado el modal muestra «todavía no está disponible».
 */

export const COBROS_Y_PAGOS_FLAG_ENV = 'VITE_COBROS_Y_PAGOS';
export const COBROS_Y_PAGOS_FLAG_STORAGE_KEY = 'sportmaps:cobros-y-pagos';

const ON = /^(on|true|1|si|sí)$/i;

export function isCobrosYPagosEnabled(
    env: Record<string, unknown> = import.meta.env as unknown as Record<string, unknown>,
    storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? safeLocalStorage() : null,
): boolean {
    const fromEnv = env?.[COBROS_Y_PAGOS_FLAG_ENV];
    if (typeof fromEnv === 'string' && ON.test(fromEnv.trim())) return true;
    try {
        const v = storage?.getItem(COBROS_Y_PAGOS_FLAG_STORAGE_KEY);
        return typeof v === 'string' && ON.test(v.trim());
    } catch {
        return false;
    }
}

function safeLocalStorage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}
