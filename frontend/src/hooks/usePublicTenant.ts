// frontend/src/hooks/usePublicTenant.ts
//
// Resuelve la escuela "duenia" de la pantalla actual ANTES de que exista sesion,
// para poder pintar el login con su logo y sus colores.
//
// Generaliza useTenantFromHostname, que solo miraba el subdominio. Ahora el
// tenant puede venir de tres lados, en este orden:
//
//   1. ?t=<slug> de la URL — es el start_url que quedo grabado en la app
//      instalada, asi que al abrirla desde su icono siempre gana.
//   2. El slug que dejo la app en localStorage (usePwaTenantSync).
//   3. Subdominio <escuela>.sportmaps.co.
//
// El gate NO esta aca: get_school_by_slug solo devuelve datos si la escuela
// tiene el addon de marca (school_shows_own_brand). Un slug inventado o de una
// escuela sin la marca comprada devuelve not_found y no se pinta nada.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applyIosMetaTags, getTenantCache, isIos as esIos, resolveTenantSlug, setTenantCache } from '@/pwa/tenant';

export interface PublicTenant {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    branding_settings: {
        primary_color?: string;
        secondary_color?: string;
        show_sportmaps_watermark?: boolean;
    };
}

// La resolucion vive en pwa/tenant.ts y NO se duplica aca. Tener la regla
// escrita en dos lados ya costo un escape: se corrigio el script del
// index.html y este hook siguio leyendo localStorage sin condicion, asi que
// abrir el link con ?t= una sola vez dejaba el navegador marcado con esa
// escuela para cualquier visitante posterior.

export function usePublicTenant(): { tenant: PublicTenant | null; slug: string | null; isLoading: boolean } {
    const slug = resolveTenantSlug();

    // Estado inicial desde el cache, SINCRONO. Sin esto el primer render no
    // tiene escuela y el login se pinta con la marca de SportMaps durante el
    // ~1s que tarda la RPC, saltando despues a la marca correcta. El parpadeo
    // se notaba y quedaba pesimo justo en la pantalla de entrada.
    const [tenant, setTenant] = useState<PublicTenant | null>(
        () => (getTenantCache(slug) as PublicTenant | null) ?? null,
    );
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!slug) {
            setTenant(null);
            setIsLoading(false);
            return;
        }

        let cancelado = false;
        (async () => {
            try {
                const { data, error } = await supabase.rpc('get_school_by_slug', { p_slug: slug });
                if (cancelado) return;

                const payload = data as any;
                // not_found = la escuela no existe o no tiene la marca comprada.
                // En ambos casos se muestra SportMaps, que es lo correcto.
                if (error || !payload?.ok) {
                    // El servidor manda: si dice que no, se limpia lo cacheado.
                    setTenant(null);
                    setTenantCache(null);
                    return;
                }

                const escuela = payload.school as PublicTenant;
                const habiaCache = getTenantCache(slug) !== null;

                setTenant(escuela);
                setTenantCache(escuela as any);
                applyIosMetaTags(escuela.name, escuela.slug);

                // ── iOS: una recarga, una sola vez ───────────────────────────
                // Safari lee apple-mobile-web-app-title AL PARSEAR la pagina e
                // ignora lo que se escriba despues. En la PRIMERA visita de un
                // dispositivo el nombre todavia no estaba cacheado cuando corrio
                // el script del <head>, asi que "Añadir a inicio" ofreceria el
                // icono de la escuela con el nombre "SportMaps".
                //
                // Ya cacheado el nombre, una recarga hace que el script lo tome
                // durante el parseo y el nombre quede bien. Se hace solo en iOS
                // (Android lee el manifest y no lo necesita), solo si NO habia
                // cache, y se marca en sessionStorage para no repetirla nunca:
                // un bucle de recargas en la pantalla de login seria mucho peor
                // que un nombre equivocado.
                //
                // Es seguro en este punto: la pagina acaba de cargar y el
                // usuario todavia no escribio credenciales.
                if (!habiaCache && esIos()) {
                    try {
                        const YA = 'sm_ios_reload_marca';
                        if (!sessionStorage.getItem(YA)) {
                            sessionStorage.setItem(YA, '1');
                            window.location.reload();
                        }
                    } catch { /* modo privado: se queda con el nombre generico */ }
                }
            } catch {
                if (!cancelado) setTenant(null);
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        })();

        return () => { cancelado = true; };
    }, [slug]);

    return { tenant, slug, isLoading };
}
