// bff/src/utils/tenantLink.ts
//
// Agrega `?t=<slug>` a los links que la escuela le manda a las familias (QR de
// inscripcion, invitaciones), para que al abrirlos vean su marca y, si instalan
// la app, quede instalada con su logo y su nombre.
//
// ── La restriccion es el punto ───────────────────────────────────────────────
// SOLO se agrega si la escuela tiene la marca activa (addon pwa_branding o
// whitelabel). Una escuela sin eso comprado manda exactamente el mismo link de
// siempre: el parametro no aparece. Sin este gate, `?t=` viajaria en los correos
// de TODAS las escuelas y el que lo abriera terminaria pidiendo un manifest
// brandeado que el BFF le va a negar igual — ruido y confusion a cambio de nada.
//
// La regla vive UNICAMENTE aca. Cuando estuvo escrita en varios lugares ya se
// escapo una vez (se corrigio un lector y quedaron dos con la version vieja).

import { supabase } from '../config/supabase';

interface Entrada {
    valor: string;
    expiraEn: number;
}

// Los correos masivos generan cientos de links de la misma escuela en segundos;
// sin cache serian cientos de consultas identicas.
const cache = new Map<string, Entrada>();
const TTL_MS = 5 * 60 * 1000;

export function invalidarCacheTenantLink(schoolId?: string) {
    if (schoolId) cache.delete(schoolId);
    else cache.clear();
}

/**
 * Devuelve `?t=<slug>` si la escuela tiene marca propia, o '' si no.
 *
 * Nunca lanza: ante cualquier error devuelve '' y el link sale como siempre.
 * Un correo de invitacion que no se envia es mucho peor que uno sin branding.
 */
export async function sufijoMarcaEscuela(schoolId: string | null | undefined): Promise<string> {
    if (!schoolId) return '';

    const cacheado = cache.get(schoolId);
    if (cacheado && cacheado.expiraEn > Date.now()) return cacheado.valor;

    try {
        const { data: muestra, error: errGate } = await supabase.rpc('school_shows_own_brand', {
            p_school_id: schoolId,
        });
        if (errGate || !muestra) {
            cache.set(schoolId, { valor: '', expiraEn: Date.now() + TTL_MS });
            return '';
        }

        const { data: escuela } = await supabase
            .from('schools')
            .select('slug')
            .eq('id', schoolId)
            .maybeSingle();

        const slug = (escuela?.slug || '').toLowerCase().trim();
        const valor = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)
            ? `?t=${encodeURIComponent(slug)}`
            : '';

        cache.set(schoolId, { valor, expiraEn: Date.now() + TTL_MS });
        return valor;
    } catch {
        return '';
    }
}

/** Une una URL con el sufijo, respetando si ya trae query string. */
export function conMarca(url: string, sufijo: string): string {
    if (!sufijo) return url;
    return url.includes('?') ? `${url}&${sufijo.slice(1)}` : `${url}${sufijo}`;
}
