// bff/src/utils/schoolBrandingResolver.ts
//
// Resuelve el branding "efectivo" para emails / PDFs / push notifications
// de una escuela. Aplica el feature gate por tier:
//   - tier free  -> branding SportMaps default (sin importar lo que tenga la DB)
//   - tier pro+  -> branding propio (logo, colores, watermark toggle)
//
// Se usa desde el BFF (corre con service_role). NO requiere caller logueado.
// Sanitiza el nombre de escuela para uso en HTML/PDF.
//
// Diseño:
//   - 1 query a v_school_entitlements + schools (join lazy).
//   - Cache por proceso (LRU simple) de 60s para reducir hits a DB en
//     bursts de notificaciones (ej. recordatorios masivos).

import { supabase } from '../config/supabase';

export interface SchoolBrandingForEmail {
    schoolId: string;
    schoolName: string;         // ya sanitizado para HTML
    logoUrl: string | null;
    primaryColor: string;       // hex validado
    secondaryColor: string;     // hex validado
    showWatermark: boolean;
    hasWhitelabel: boolean;     // true si tier pro+ activo
}

// Defaults SportMaps (Green / Orange). Deben mantenerse en sync con
// frontend/src/contexts/ThemeContext.tsx > DEFAULT_BRANDING.
const SPORTMAPS_DEFAULTS = {
    primaryColor: '#248223',
    secondaryColor: '#FB9F1E',
    showWatermark: true,
    schoolName: 'SportMaps',
    logoUrl: null,
} as const;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function safeHex(value: unknown, fallback: string): string {
    return typeof value === 'string' && HEX_RE.test(value) ? value : fallback;
}

// Escape HTML para uso seguro en plantillas email.
// Critical: el nombre de escuela puede contener < > & ' " si la escuela se
// llama p.ej. "Mike's <Cool> Academy & Spa". Sin escape, podriamos meter
// HTML malicioso en mails que pasan filtros porque vienen de nosotros.
function escapeHtml(str: string): string {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Cache simple por proceso ───────────────────────────────────────────
// Las pull-reminders pueden enviar 100+ emails de la misma escuela en
// segundos; este cache evita 100 SELECT identicos.
interface CacheEntry {
    value: SchoolBrandingForEmail;
    expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 1000;

function cacheGet(key: string): SchoolBrandingForEmail | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
    }
    return hit.value;
}
function cacheSet(key: string, value: SchoolBrandingForEmail) {
    if (cache.size > 200) {
        // Evict mas viejas (simple, no LRU real)
        const cutoff = Date.now();
        for (const [k, v] of cache.entries()) {
            if (v.expiresAt < cutoff) cache.delete(k);
        }
    }
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

/**
 * Devuelve el branding efectivo para una escuela (post feature gate).
 * Si schoolId es null/invalido → defaults SportMaps. Nunca lanza.
 */
export async function resolveSchoolBranding(
    schoolId: string | null,
): Promise<SchoolBrandingForEmail> {
    if (!schoolId) {
        return {
            schoolId: '',
            schoolName: SPORTMAPS_DEFAULTS.schoolName,
            logoUrl: SPORTMAPS_DEFAULTS.logoUrl,
            primaryColor: SPORTMAPS_DEFAULTS.primaryColor,
            secondaryColor: SPORTMAPS_DEFAULTS.secondaryColor,
            showWatermark: SPORTMAPS_DEFAULTS.showWatermark,
            hasWhitelabel: false,
        };
    }

    const cached = cacheGet(schoolId);
    if (cached) return cached;

    // 1. Datos basicos de la escuela
    const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('id, name, logo_url, branding_settings')
        .eq('id', schoolId)
        .maybeSingle();

    if (schoolErr || !school) {
        // Fallback silencioso a defaults. Errores se loguean en el caller.
        const fallback: SchoolBrandingForEmail = {
            schoolId,
            schoolName: SPORTMAPS_DEFAULTS.schoolName,
            logoUrl: null,
            primaryColor: SPORTMAPS_DEFAULTS.primaryColor,
            secondaryColor: SPORTMAPS_DEFAULTS.secondaryColor,
            showWatermark: SPORTMAPS_DEFAULTS.showWatermark,
            hasWhitelabel: false,
        };
        cacheSet(schoolId, fallback);
        return fallback;
    }

    // 2. Feature gate via RPC (mismo que usa el frontend)
    const { data: hasFeature } = await supabase.rpc('school_has_branding_feature', {
        p_school_id: schoolId,
    });

    const useWhitelabel = !!hasFeature;
    const settings = (school.branding_settings ?? {}) as Record<string, unknown>;

    const value: SchoolBrandingForEmail = {
        schoolId,
        schoolName: escapeHtml(school.name || SPORTMAPS_DEFAULTS.schoolName),
        logoUrl: useWhitelabel ? (school.logo_url ?? null) : null,
        primaryColor: useWhitelabel
            ? safeHex(settings.primary_color, SPORTMAPS_DEFAULTS.primaryColor)
            : SPORTMAPS_DEFAULTS.primaryColor,
        secondaryColor: useWhitelabel
            ? safeHex(settings.secondary_color, SPORTMAPS_DEFAULTS.secondaryColor)
            : SPORTMAPS_DEFAULTS.secondaryColor,
        showWatermark: useWhitelabel
            ? (settings.show_sportmaps_watermark ?? true) === true
            : true, // free tier siempre con watermark
        hasWhitelabel: useWhitelabel,
    };

    cacheSet(schoolId, value);
    return value;
}

/** Permite invalidar el cache al guardar branding (called from PUT endpoint) */
export function invalidateBrandingCache(schoolId: string) {
    cache.delete(schoolId);
}

/** Export del helper de sanitizacion para uso desde templates */
export { escapeHtml };
