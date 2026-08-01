/**
 * openExternalUrl — abre una URL FUERA del WebView de la app nativa.
 *
 * Por qué existe: las suscripciones SaaS que la escuela le paga a SportMaps
 * son un servicio digital. Google Play y App Store exigen su propia pasarela
 * (Play Billing / IAP) para lo que se compra DENTRO de la app, así que ese
 * cobro tiene que ocurrir en el navegador del sistema, no en el WebView.
 *
 * Ojo con lo que NO va por aquí: matrículas, mensualidades, clases y productos
 * físicos son servicios del mundo real prestados por la escuela, quedan exentos
 * y se cobran dentro de la app con normalidad (Wompi / Mercado Pago).
 *
 * En web mantiene el comportamiento previo (navegar la pestaña actual) para no
 * cambiar nada del flujo de escritorio.
 *
 * Historia: esto antes era un `window.location.href` directo en MiPlanPage, que
 * en nativo navegaba el propio WebView — es decir, el cobro del plan pasaba
 * dentro de la app. El comentario de capacitor.config.ts afirmaba que salía al
 * navegador externo, pero @capacitor/browser no estaba importado en ningún lado.
 */

/** true si corremos empaquetados en Capacitor (iOS/Android), no en el browser. */
export function isNativePlatform(): boolean {
    const cap = (globalThis as any).Capacitor;
    return !!cap?.isNativePlatform?.();
}

export async function openExternalUrl(url: string): Promise<void> {
    if (isNativePlatform()) {
        try {
            // Import dinámico: en web el bundle no debe arrastrar el plugin.
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url });
            return;
        } catch (err) {
            // Si el plugin falla, es preferible no cobrar dentro del WebView.
            console.error('[openExternalUrl] no se pudo abrir el navegador externo:', err);
            throw err;
        }
    }

    window.location.href = url;
}
