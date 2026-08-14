// bff/src/routes/pwa.routes.ts
//
// Manifest dinamico de la PWA: hace que al instalar la app aparezca el logo y el
// nombre de la escuela en vez de "SportMaps".
//
//   GET /api/v1/pwa/manifest?s=<slug>   (publico, sin auth)
//
// Como se sirve: Vercel reescribe /manifest.webmanifest hacia aca (ver
// frontend/vercel.json). El slug lo inyecta el script inline de index.html
// leyendo ?t= o el tenant guardado en localStorage.
//
// ── Por que el manifest cambia la identidad de la app ────────────────────────
// El navegador identifica una app instalada por el miembro `id` del manifest
// (que por defecto es el start_url). Dandole un `id` distinto por escuela,
// DOS escuelas pueden convivir instaladas en el MISMO origen sin subdominio:
// no hace falta wildcard DNS ni certificados, y la sesion de Supabase sigue
// siendo una sola para todas.
//
// Contrapartida a tener presente: quien ya instalo con el manifest viejo
// (sin `id`, identidad = "/") NO se re-brandea. Su app sigue siendo la de
// SportMaps hasta que reinstale. No se rompe nada, pero la marca solo llega a
// instalaciones nuevas.
//
// ── Regla de oro: nunca romper la instalabilidad ─────────────────────────────
// Ante CUALQUIER duda (sin slug, escuela inexistente, sin addon, sin iconos
// generados, error de DB) se devuelve el manifest de SportMaps con 200. Un
// manifest que falla o llega incompleto hace que Chrome no dispare
// `beforeinstallprompt` y el banner de instalar desaparezca sin ningun error
// visible — se pierde la instalacion entera por intentar brandearla.

import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// Iconos por defecto de SportMaps. Son los PNG reales de /icons/ del frontend:
// no apuntar a /sportmaps-logo.png ni /favicon.png, que son JPEG con extension
// .png y Chrome los rechaza como iconos invalidos.
const SPORTMAPS_ICONS = [
    { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
    { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
    { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
    { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
];

const DEFAULT_MANIFEST = {
    id: '/',
    name: 'SportMaps - Revolucionando el sistema deportivo',
    short_name: 'SportMaps',
    description: 'Plataforma integral para la gestión deportiva. Encuentra escuelas, inscribe a tus hijos y sigue su progreso.',
    theme_color: '#248223',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    categories: ['sports', 'education', 'lifestyle'],
    icons: SPORTMAPS_ICONS,
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
// Mismo formato que valida useTenantFromHostname en el frontend.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function safeHex(value: unknown, fallback: string): string {
    return typeof value === 'string' && HEX_RE.test(value) ? value : fallback;
}

/**
 * short_name se muestra bajo el icono en la pantalla de inicio. Android corta
 * alrededor de los 12 caracteres, asi que un nombre largo queda ilegible.
 * Se toma la primera palabra util; si igual no entra, se trunca.
 */
function toShortName(name: string): string {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length <= 12) return clean;

    // Descartar prefijos genericos que no distinguen a la escuela.
    const RUIDO = new Set(['club', 'academia', 'escuela', 'deportivo', 'deportiva', 'centro', 'gimnasio', 'gym']);
    const palabras = clean.split(' ').filter((w) => !RUIDO.has(w.toLowerCase()));
    const candidato = (palabras[0] || clean).trim();

    return candidato.length <= 12 ? candidato : candidato.slice(0, 12).trim();
}

// ── Cache por proceso ────────────────────────────────────────────────────────
// El manifest se pide en cada arranque de la app. Sin cache, cada apertura son
// 2 queries. TTL corto para que un cambio de logo se vea pronto.
interface CacheEntry { value: Record<string, unknown>; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export function invalidatePwaManifestCache(slug?: string) {
    if (slug) cache.delete(slug);
    else cache.clear();
}

async function buildManifest(slug: string): Promise<Record<string, unknown>> {
    const cached = cache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const { data: school, error } = await supabase
        .from('schools')
        .select('id, name, slug, logo_url, branding_settings')
        .eq('slug', slug)
        .maybeSingle();

    if (error || !school) return DEFAULT_MANIFEST;

    // Gate por ADDON (pwa_branding), no por tier. Es lo que refleja lo vendido
    // y lo que hace de allowlist del rollout: sin fila en school_addons no hay
    // marca, aunque la escuela tenga tier alto por grandfathering.
    const { data: ent } = await supabase
        .from('v_school_entitlements')
        .select('has_pwa_branding')
        .eq('school_id', school.id)
        .maybeSingle();

    if (!ent?.has_pwa_branding) return DEFAULT_MANIFEST;

    const settings = (school.branding_settings ?? {}) as Record<string, unknown>;
    const icon192 = typeof settings.pwa_icon_192 === 'string' ? settings.pwa_icon_192 : null;
    const icon512 = typeof settings.pwa_icon_512 === 'string' ? settings.pwa_icon_512 : null;

    // Sin iconos generados no se brandea: un manifest con iconos de otra escuela
    // o sin los tamanios 192/512 hace que Chrome no considere la app instalable.
    // Mejor SportMaps que un banner que nunca aparece.
    if (!icon192 || !icon512) return DEFAULT_MANIFEST;

    const value = {
        ...DEFAULT_MANIFEST,
        // `id` y `start_url` con el tenant: es lo que separa esta app instalada
        // de la de SportMaps y de la de otra escuela en el mismo dispositivo.
        id: `/?t=${school.slug}`,
        start_url: `/?t=${school.slug}`,
        name: school.name,
        short_name: toShortName(school.name),
        description: `App de ${school.name}. Inscripciones, pagos y seguimiento deportivo.`,
        theme_color: safeHex(settings.primary_color, DEFAULT_MANIFEST.theme_color),
        icons: [
            { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };

    cache.set(slug, { value, expiresAt: Date.now() + TTL_MS });
    return value;
}

router.get('/manifest', async (req: Request, res: Response) => {
    const raw = typeof req.query.s === 'string' ? req.query.s.toLowerCase().trim() : '';

    let manifest: Record<string, unknown> = DEFAULT_MANIFEST;
    if (raw && SLUG_RE.test(raw)) {
        try {
            manifest = await buildManifest(raw);
        } catch (err: any) {
            // Fail-open hacia SportMaps: un 500 aca deja la app no instalable.
            req.log?.error({ err, slug: raw }, 'pwa manifest fallback a default');
            manifest = DEFAULT_MANIFEST;
        }
    }

    // El middleware global del BFF pone no-store para no filtrar datos de perfil
    // entre usuarios. El manifest es publico y se pide en cada arranque, asi que
    // aca se sobreescribe con un cache corto.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    res.type('application/manifest+json');
    return res.json(manifest);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/pwa/icon?s=<slug>   (publico, sin auth)
//
// Redirige al PNG 192 de la escuela. Existe SOLO por iOS: Safari ignora el
// manifest por completo — el icono de "Añadir a inicio" lo saca del
// <link rel="apple-touch-icon"> y el nombre del <title>. Sin esto, en iPhone la
// app se instalaria igual pero siempre con la marca de SportMaps, que es
// justamente lo que se vendio evitar.
//
// Se resuelve por redirect en vez de servir los bytes para no proxear imagenes
// por el BFF: el archivo ya vive en Storage con su propio CDN.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/icon', async (req: Request, res: Response) => {
    const raw = typeof req.query.s === 'string' ? req.query.s.toLowerCase().trim() : '';
    const fallback = '/icons/icon-192.png';

    if (!raw || !SLUG_RE.test(raw)) return res.redirect(302, fallback);

    try {
        const manifest = await buildManifest(raw);
        const icons = (manifest as any).icons as Array<{ src: string; sizes: string }> | undefined;
        const icon192 = icons?.find((i) => i.sizes === '192x192')?.src;

        // Si buildManifest cayo al default, icon192 es la ruta relativa de
        // SportMaps y el redirect la resuelve contra el origen del frontend.
        return res.redirect(302, icon192 || fallback);
    } catch (err: any) {
        req.log?.error({ err, slug: raw }, 'pwa icon fallback a default');
        return res.redirect(302, fallback);
    }
});

export default router;
