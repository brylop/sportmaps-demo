// frontend/src/hooks/usePwaTenantSync.ts
//
// Deja guardada la escuela del usuario para que la PWA se instale con SU marca.
//
// El script inline de index.html lee ese slug de localStorage y con eso arma el
// href del manifest. Como el navegador evalua el manifest al cargar la pagina,
// este hook NO cambia la instalacion de la sesion actual: prepara la siguiente.
// En la practica alcanza — entre que el padre entra por primera vez y decide
// instalar suele haber mas de una visita.
//
// El schoolId sale del contexto, pero el manifest necesita el SLUG (va en el
// start_url), y SchoolContext no lo expone. Por eso la consulta puntual.

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { applyIosMetaTags, setPwaTenant, setTenantCache } from '@/pwa/tenant';

export function usePwaTenantSync(): void {
    const { schoolId } = useSchoolContext();
    const entitlements = useEntitlements();

    // Gate imprescindible: sin esto se guardaba el nombre de CUALQUIER escuela.
    // El manifest y el icono igual lo frenaban (el BFF valida el addon), pero el
    // <title> y apple-mobile-web-app-title son puro DOM y no pasan por el
    // servidor: una escuela sin la marca comprada terminaba con su nombre en el
    // icono de iOS, y su nombre cacheado hacia parpadear el login.
    const muestraSuMarca =
        entitlements.addons.pwa_branding === true || entitlements.addons.whitelabel === true;

    useEffect(() => {
        if (!schoolId || !muestraSuMarca) return;
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

                // iOS toma el nombre y el icono de estas etiquetas al "Añadir a
                // inicio". El script del index.html corrio antes de saber a que
                // escuela pertenece el usuario, asi que sin esto quien agrega a
                // inicio despues de loguearse se lleva la marca de SportMaps.
                applyIosMetaTags(data.name, data.slug);
            } catch {
                // Sin marca propia la app funciona igual: el manifest cae al de
                // SportMaps. No vale la pena molestar al usuario con un error.
            }
        })();

        return () => { cancelado = true; };
    }, [schoolId, muestraSuMarca]);
}
