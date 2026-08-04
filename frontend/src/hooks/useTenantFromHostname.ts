// frontend/src/hooks/useTenantFromHostname.ts
//
// Detecta si la URL actual es de un subdominio de escuela (slug.sportmaps.co)
// y resuelve los datos publicos de esa escuela (name + branding) via RPC
// get_school_by_slug. Permite pintar el header con el branding correcto
// incluso ANTES del login — para usuarios que llegan via link "<escuela>.sportmaps.co".
//
// Si la URL no es un subdomain de tenant (es app.sportmaps.co, localhost,
// preview Vercel, etc.) devuelve null.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ROOT_HOSTNAMES = new Set([
    'sportmaps.co',
    'app.sportmaps.co',
    'www.sportmaps.co',
    'dev.sportmaps.co',
    'staging.sportmaps.co',
]);
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'blog', 'docs', 'admin', 'dev', 'staging', 'preview']);

function extractSlugFromHostname(host: string): string | null {
    const clean = host.split(':')[0].toLowerCase().trim();
    if (!clean) return null;
    if (clean === 'localhost' || clean === '127.0.0.1') return null;
    if (ROOT_HOSTNAMES.has(clean)) return null;
    if (!clean.endsWith('.sportmaps.co')) return null;

    const parts = clean.split('.');
    if (parts.length !== 3) return null;
    const slug = parts[0];
    if (RESERVED_SUBDOMAINS.has(slug)) return null;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) return null;

    return slug;
}

export interface SubdomainTenant {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    branding_settings: {
        primary_color: string;
        secondary_color: string;
        show_sportmaps_watermark: boolean;
    };
}

export function useTenantFromHostname(): {
    tenant: SubdomainTenant | null;
    slug: string | null;
    isLoading: boolean;
    error: Error | null;
} {
    const [tenant, setTenant] = useState<SubdomainTenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const slug = typeof window !== 'undefined' ? extractSlugFromHostname(window.location.hostname) : null;

    useEffect(() => {
        if (!slug) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const { data, error: rpcError } = await supabase.rpc('get_school_by_slug', { p_slug: slug });
                if (cancelled) return;

                if (rpcError) throw rpcError;
                const payload = data as any;
                if (!payload?.ok) {
                    setTenant(null);
                    return;
                }
                setTenant(payload.school as SubdomainTenant);
            } catch (e: any) {
                if (!cancelled) setError(e);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    return { tenant, slug, isLoading, error };
}
