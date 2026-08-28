// frontend/src/hooks/usePwaTenantSync.ts
//
// Deja guardada la escuela del usuario para que la PWA se instale con SU marca.
//
// El script inline de index.html lee el slug de localStorage y con eso arma el
// href INICIAL del manifest para la carga siguiente (nada puede adelantarse a
// eso: el navegador ya evaluo instalabilidad con lo que habia al cargar la
// pagina). Pero la instalacion de ESTA sesion si se corrige: setLiveTenant()
// avisa a InstallBanner (que vive arriba del auth boundary, fuera de este
// contexto) apenas se sabe la escuela real, y el <link rel=manifest> se
// corrige en el mismo tick via applyTenantManifest — asi que si el usuario
// instala despues de que el banner ya muestre el logo correcto, instala bien
// en la primera visita.
//
// El schoolId sale del contexto, pero el manifest necesita el SLUG (va en el
// start_url), y SchoolContext no lo expone. Por eso la consulta puntual.

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { applyIosMetaTags, applyTenantManifest, clearPwaTenant, setLiveTenant, setPwaTenant, setTenantCache } from '@/pwa/tenant';

export function usePwaTenantSync(): void {
    const { schoolId } = useSchoolContext();
    const entitlements = useEntitlements();

    // Gate imprescindible: sin esto se guardaba el nombre de CUALQUIER escuela.
    // El manifest y el icono igual lo frenaban (el BFF valida el addon), pero el
    // <title> y apple-mobile-web-app-title son puro DOM y no pasan por el
    // servidor: una escuela sin la marca comprada terminaba con su nombre en el
    // icono de iOS, y su nombre cacheado hacia parpadear el login.
    const muestraSuMarca = entitlements.marcaPropia;

    useEffect(() => {
        // El usuario NO pertenece a una escuela con marca propia: se borra lo
        // que hubiera guardado otro usuario en este mismo navegador. Sin esto
        // la marca sobrevive al cambio de cuenta — paso de verdad: alguien
        // ajeno a la escuela agrego a inicio y se llevo su icono.
        if (!schoolId || !muestraSuMarca) {
            clearPwaTenant();
            return;
        }

        let cancelado = false;

        (async () => {
            try {
                const { data, error } = await supabase
                    .from('schools')
                    .select('slug, name, logo_url, branding_settings')
                    .eq('id', schoolId)
                    .maybeSingle();

                if (cancelado || error || !data?.slug) return;

                setPwaTenant(data.slug, data.name);

                // Cache para que la PROXIMA carga pinte el login sin parpadeo.
                setTenantCache({
                    id: schoolId,
                    slug: data.slug,
                    name: data.name,
                    logo_url: (data as any).logo_url ?? null,
                    branding_settings: ((data as any).branding_settings ?? {}) as any,
                });

                // El script del index.html corrio antes de saber quien es el
                // usuario, y en una pestaña normal NO aplica la marca guardada
                // (para no filtrarla a visitantes ajenos). Recien aca se sabe
                // que este usuario SI pertenece a una escuela con marca propia,
                // asi que se corrigen manifest e iOS para que la instalacion
                // salga con su marca.
                applyIosMetaTags(data.name, data.slug);
                applyTenantManifest(data.slug);

                // Puente para InstallBanner (vive arriba del auth boundary):
                // esto YA esta verificado (schoolId + marcaPropia del propio
                // usuario), asi que no hace falta la cautela de
                // resolveTenantSlug() pensada para visitantes anonimos.
                setLiveTenant({ slug: data.slug, name: data.name });
            } catch {
                // Sin marca propia la app funciona igual: el manifest cae al de
                // SportMaps. No vale la pena molestar al usuario con un error.
            }
        })();

        return () => { cancelado = true; };
    }, [schoolId, muestraSuMarca]);
}
