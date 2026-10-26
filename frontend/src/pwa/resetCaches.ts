/**
 * Recuperación de la PWA cuando una pantalla no carga (chunk que falla) o el
 * caché del service worker quedó en mal estado.
 *
 * Dos síntomas reales:
 *  · 2026-10-15, después de un despliegue grande: el login no carga, la consola dice
 *    «Cannot read properties of undefined (reading 'default')» con 404 en los chunks,
 *    y el botón «Recargar» solo volvía a recargar. Hay usuarios con un service worker
 *    de una versión anterior (las primeras versiones del sw.js servían assets desde
 *    caché) que siguen corriendo una build vieja: recargar a secas no los saca.
 *  · SIN SEÑAL: abrir una pantalla que aún no se había descargado hace fallar su chunk;
 *    el ErrorBoundary recargaba y la app terminaba en la página de error del navegador
 *    (o en «Sin conexión» del sw.js). Recargar sin red NUNCA arregla un chunk que falta,
 *    y borrar el caché sin red es peor: se pierde el shell que sí funcionaba offline.
 *
 * Por eso:
 *  · Sin conexión NO se limpia ni se recarga: se espera al evento `online`.
 *  · `resetPwaCaches()` — borra solo el Cache Storage. Es el intento AUTOMÁTICO: el
 *    service worker sigue registrado (no se pierde la suscripción a push) y vuelve a
 *    pedir a la red lo que no tenga.
 *  · `resetPwaCaches({ unregister: true })` — además desregistra el service worker. Es la
 *    reparación COMPLETA, solo cuando la persona la pide con el botón «Recargar».
 *
 * Nunca lanza: en un navegador sin Cache Storage o sin service worker no hace nada.
 */

/** true solo si el navegador AFIRMA que no hay red (`navigator.onLine === false`). */
export function estaSinConexion(): boolean {
    try {
        return typeof navigator !== 'undefined' && navigator.onLine === false;
    } catch {
        return false;
    }
}

/** Resuelve de inmediato si hay red; si no, cuando llegue el evento `online`. */
export function esperarConexion(): Promise<void> {
    if (!estaSinConexion()) return Promise.resolve();
    return new Promise((resolve) => {
        window.addEventListener('online', () => resolve(), { once: true });
    });
}

export async function resetPwaCaches(opts: { unregister?: boolean } = {}): Promise<void> {
    // Sin red, borrar el caché deja a la persona sin la app que sí abría offline.
    if (estaSinConexion()) return;

    try {
        if (typeof caches !== 'undefined') {
            const claves = await caches.keys();
            await Promise.all(claves.map((k) => caches.delete(k)));
        }
    } catch {
        /* sin Cache Storage: nada que limpiar */
    }

    if (!opts.unregister) return;
    try {
        const registros = await navigator.serviceWorker?.getRegistrations?.();
        await Promise.all((registros ?? []).map((r) => r.unregister()));
    } catch {
        /* sin service worker */
    }
}

/**
 * Limpia el caché y recarga. `unregister: true` = reparación completa (botón del usuario).
 * Sin conexión espera a que vuelva la señal antes de tocar nada: recargar sin red deja la
 * app en la página de error del navegador.
 */
export async function resetPwaCachesAndReload(opts: { unregister?: boolean } = {}): Promise<void> {
    await esperarConexion();
    await resetPwaCaches(opts);
    window.location.reload();
}
