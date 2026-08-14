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

const TENANT_KEY = 'sm_pwa_tenant';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVADOS = new Set(['www', 'app', 'api', 'blog', 'docs', 'admin', 'dev', 'staging', 'preview']);

function resolverSlug(): string | null {
    if (typeof window === 'undefined') return null;

    try {
        const deUrl = new URLSearchParams(window.location.search).get('t');
        if (deUrl && SLUG_RE.test(deUrl.toLowerCase().trim())) {
            return deUrl.toLowerCase().trim();
        }
    } catch { /* URL rara: se sigue con las otras fuentes */ }

    try {
        const guardado = window.localStorage.getItem(TENANT_KEY);
        if (guardado && SLUG_RE.test(guardado)) return guardado;
    } catch { /* Safari en modo privado */ }

    const host = window.location.hostname.split(':')[0].toLowerCase();
    const partes = host.split('.');
    if (partes.length === 3 && host.endsWith('.sportmaps.co') && !RESERVADOS.has(partes[0])) {
        if (SLUG_RE.test(partes[0])) return partes[0];
    }

    return null;
}

export function usePublicTenant(): { tenant: PublicTenant | null; slug: string | null; isLoading: boolean } {
    const [tenant, setTenant] = useState<PublicTenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const slug = resolverSlug();

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
                    setTenant(null);
                    return;
                }
                setTenant(payload.school as PublicTenant);
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
