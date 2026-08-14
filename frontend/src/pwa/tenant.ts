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
const TENANT_DATA_KEY = 'sm_pwa_tenant_data';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** Marca cacheada de la escuela, para pintar sin esperar al servidor. */
export interface TenantCache {
    id?: string;
    slug: string;
    name: string;
    logo_url: string | null;
    branding_settings: {
        primary_color?: string;
        secondary_color?: string;
        show_sportmaps_watermark?: boolean;
    };
}

/**
 * Marca guardada de la visita anterior.
 *
 * Existe por el parpadeo: resolver la escuela contra el servidor tarda ~1s, y
 * en ese lapso el login se pintaba con la marca de SportMaps y despues saltaba
 * a la de la escuela. Con el cache el PRIMER render ya sale correcto y la
 * respuesta del servidor solo confirma o corrige.
 *
 * Es solo presentacion (nombre, logo, colores). Nada de esto autoriza nada: el
 * gate real lo hace get_school_by_slug en el servidor.
 */
export function getTenantCache(slug: string | null): TenantCache | null {
    if (!slug) return null;
    try {
        const raw = localStorage.getItem(TENANT_DATA_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as TenantCache;
        // Si el cache es de OTRA escuela se descarta: mejor un parpadeo que
        // mostrarle a un padre la marca del club equivocado.
        return parsed?.slug === slug ? parsed : null;
    } catch {
        return null;
    }
}

export function setTenantCache(data: TenantCache | null): void {
    try {
        if (!data?.slug) return;
        localStorage.setItem(TENANT_DATA_KEY, JSON.stringify(data));
    } catch {
        // Safari en modo privado. Se pierde el cache, vuelve el parpadeo, nada mas.
    }
}

/**
 * Reescribe las etiquetas que iOS usa para "Añadir a inicio".
 *
 * Hace falta ademas del script inline del index.html porque ese corre UNA sola
 * vez al cargar la pagina: si la escuela se conoce despues (al iniciar sesion),
 * los meta ya quedaron escritos con SportMaps y el usuario que agrega a inicio
 * en ese momento se lleva el icono y el nombre equivocados.
 *
 * iOS ignora el manifest por completo: el nombre sale de
 * apple-mobile-web-app-title y el icono del apple-touch-icon.
 */
export function applyIosMetaTags(name: string | null, slug: string | null): void {
    try {
        if (name) {
            const meta = document.getElementById('sm-ios-title');
            if (meta) meta.setAttribute('content', name);
            document.title = name;
        }
        if (slug && SLUG_RE.test(slug)) {
            const icono = document.querySelector('link[rel="apple-touch-icon"]');
            if (icono) icono.setAttribute('href', `/app-icon.png?s=${encodeURIComponent(slug)}`);
        }
    } catch {
        // DOM no disponible (SSR/tests). No es critico.
    }
}

/** True si corre en iOS/iPadOS, donde no existe `beforeinstallprompt`. */
export function isIos(): boolean {
    try {
        const ua = window.navigator.userAgent;
        // iPadOS 13+ se presenta como Mac; se lo distingue por el touch.
        const esIpadModerno = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
        return /iPad|iPhone|iPod/.test(ua) || esIpadModerno;
    } catch {
        return false;
    }
}

/**
 * UNICA fuente de verdad para "¿de que escuela es esta pantalla?".
 *
 * Todos los lectores tienen que pasar por aca. Cuando la regla estuvo escrita
 * en varios lados paso esto: se arreglo el script del index.html pero
 * usePublicTenant seguia leyendo localStorage sin condicion, asi que bastaba
 * abrir el link con ?t= UNA vez para que el navegador quedara marcado con esa
 * escuela para siempre, incluso para otro usuario y sin sesion iniciada.
 *
 * La regla:
 *   1. ?t= en la URL → siempre vale. Es el start_url de la app instalada y es
 *      explicito: quien abre ese link esta pidiendo esa escuela.
 *   2. localStorage → SOLO si la app corre instalada (standalone). Ahi no hay
 *      ambiguedad: ese dispositivo instalo deliberadamente la app de esa
 *      escuela. En una pestaña normal NO se usa, porque localStorage es del
 *      NAVEGADOR y sobrevive al cierre de sesion y al cambio de cuenta.
 *   3. Subdominio <escuela>.sportmaps.co.
 *
 * Si el usuario resulta ser miembro de la escuela, usePwaTenantSync corrige el
 * manifest y las etiquetas despues del login, que es cuando recien se sabe
 * quien es.
 */
export function resolveTenantSlug(): string | null {
    if (typeof window === 'undefined') return null;

    const valido = (s: string | null | undefined): string | null => {
        const limpio = (s || '').toLowerCase().trim();
        return limpio && SLUG_RE.test(limpio) ? limpio : null;
    };

    try {
        const deUrl = valido(new URLSearchParams(window.location.search).get('t'));
        if (deUrl) return deUrl;
    } catch { /* URL rara */ }

    if (getDisplayMode() !== 'browser') {
        try {
            const guardado = valido(localStorage.getItem(TENANT_KEY));
            if (guardado) return guardado;
        } catch { /* modo privado */ }
    }

    try {
        const host = window.location.hostname.split(':')[0].toLowerCase();
        const partes = host.split('.');
        const reservados = new Set(['www', 'app', 'api', 'blog', 'docs', 'admin', 'dev', 'staging', 'preview']);
        if (partes.length === 3 && host.endsWith('.sportmaps.co') && !reservados.has(partes[0])) {
            return valido(partes[0]);
        }
    } catch { /* no-op */ }

    return null;
}

export function getPwaTenantSlug(): string | null {
    return resolveTenantSlug();
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

/**
 * Borra todo rastro de la marca de una escuela en este navegador.
 *
 * Se llama al cerrar sesion y cuando el usuario logueado NO pertenece a la
 * escuela guardada. Es imprescindible: localStorage es del NAVEGADOR, no del
 * usuario, asi que sin esto la marca de una escuela sobrevive al cambio de
 * cuenta y se la lleva puesta el siguiente que entre en ese telefono.
 */
export function clearPwaTenant(): void {
    try {
        localStorage.removeItem(TENANT_KEY);
        localStorage.removeItem(TENANT_NAME_KEY);
        localStorage.removeItem(TENANT_DATA_KEY);
    } catch {
        // no-op
    }
    resetIosMetaTags();
}

/** Devuelve las etiquetas de iOS y el manifest a la marca SportMaps. */
export function resetIosMetaTags(): void {
    try {
        const meta = document.getElementById('sm-ios-title');
        if (meta) meta.setAttribute('content', 'SportMaps');

        const icono = document.querySelector('link[rel="apple-touch-icon"]');
        if (icono) icono.setAttribute('href', '/icons/icon-192.png');

        const manifest = document.getElementById('sm-manifest');
        if (manifest) manifest.setAttribute('href', '/app.webmanifest');
    } catch {
        // DOM no disponible.
    }
}

/**
 * Apunta el <link rel="manifest"> a la escuela.
 *
 * Hace falta ademas del script inline porque ese corre antes de saber quien es
 * el usuario: en una pestaña normal no aplica la marca guardada (ver
 * index.html), asi que si el que entra resulta ser miembro de la escuela hay
 * que corregir el manifest aca para que la instalacion salga con su marca.
 */
export function applyTenantManifest(slug: string | null): void {
    try {
        if (!slug || !SLUG_RE.test(slug)) return;
        const manifest = document.getElementById('sm-manifest');
        if (manifest) manifest.setAttribute('href', `/app.webmanifest?s=${encodeURIComponent(slug)}`);
    } catch {
        // DOM no disponible.
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
