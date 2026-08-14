// frontend/src/pwa/tenant.ts
//
// Tenant de la PWA: con que marca se instala y se muestra la app.
//
// El slug se guarda en localStorage porque el script inline de index.html lo
// necesita ANTES de que React monte — es lo que decide el href del manifest y,
// con eso, el logo y el nombre que va a tener el icono instalado. Si esperaramos
// a que la app cargue, el navegador ya habria evaluado la instalabilidad con el
// manifest generico.

const TENANT_KEY = 'sm_pwa_tenant';
const TENANT_NAME_KEY = 'sm_pwa_tenant_name';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function getPwaTenantSlug(): string | null {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get('t');
        const slug = (fromUrl || localStorage.getItem(TENANT_KEY) || '').toLowerCase().trim();
        return slug && SLUG_RE.test(slug) ? slug : null;
    } catch {
        return null;
    }
}

export function getPwaTenantName(): string | null {
    try {
        return localStorage.getItem(TENANT_NAME_KEY) || null;
    } catch {
        return null;
    }
}

/**
 * Guarda la escuela del usuario para que la proxima carga pida el manifest
 * brandeado. Solo tiene efecto en la SIGUIENTE visita: el manifest de esta ya
 * fue leido por el navegador.
 */
export function setPwaTenant(slug: string | null | undefined, name?: string | null): void {
    try {
        const limpio = (slug || '').toLowerCase().trim();
        if (!limpio || !SLUG_RE.test(limpio)) return;

        localStorage.setItem(TENANT_KEY, limpio);
        if (name) localStorage.setItem(TENANT_NAME_KEY, name);
    } catch {
        // Safari en modo privado puede tirar en localStorage. Sin marca, pero
        // la app sigue funcionando.
    }
}

export function clearPwaTenant(): void {
    try {
        localStorage.removeItem(TENANT_KEY);
        localStorage.removeItem(TENANT_NAME_KEY);
    } catch {
        // no-op
    }
}

/**
 * Como se esta viendo la app AHORA.
 *
 * No se usa el evento `appinstalled` porque no sirve para medir: iOS nunca lo
 * dispara, solo suena en el instante de instalar (los dispositivos que ya
 * existen no lo dispararian jamas) y no hay evento equivalente al desinstalar.
 * El modo de visualizacion, en cambio, se puede leer en cada sesion y clasifica
 * retroactivamente a todo el parque.
 */
export function getDisplayMode(): 'browser' | 'standalone' | 'native' {
    try {
        // Capacitor: la app nativa.
        if ((window as any).Capacitor?.isNativePlatform?.()) return 'native';

        // Android / escritorio / Chrome.
        if (window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
        if (window.matchMedia?.('(display-mode: fullscreen)').matches) return 'standalone';
        if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return 'standalone';

        // iOS Safari: no soporta display-mode, usa una propiedad propia.
        if ((window.navigator as any).standalone === true) return 'standalone';

        return 'browser';
    } catch {
        return 'browser';
    }
}
