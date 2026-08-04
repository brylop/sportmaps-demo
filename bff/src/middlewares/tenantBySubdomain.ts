// bff/src/middlewares/tenantBySubdomain.ts
//
// Middleware que resuelve el tenant (schoolId) desde el subdominio del
// hostname del request. Si la URL es `<slug>.sportmaps.co`, llama a
// get_school_id_by_slug y, si existe escuela Pro+ con ese slug, planta
// req.subdomainSchoolId disponible para handlers downstream.
//
// NO reemplaza al authMiddleware. El authMiddleware sigue siendo la
// fuente de verdad de "que escuela puede tocar este user". Este middleware
// solo agrega contexto del subdomain para que el frontend pueda saber
// "estoy en el portal de tal escuela" sin login.

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

declare global {
    namespace Express {
        interface Request {
            /** schoolId resuelto desde el subdomain del Host, si lo hay y es Pro+ */
            subdomainSchoolId?: string;
            /** slug del subdomain extraido del Host */
            subdomainSlug?: string;
        }
    }
}

// Hostnames considerados "el root domain" (sin subdomain). Cualquier otro
// host bajo *.sportmaps.co se considera subdomain del tenant.
const ROOT_HOSTNAMES = new Set([
    'sportmaps.co',
    'app.sportmaps.co',
    'www.sportmaps.co',
    // Dev/staging usan dev.sportmaps.co como root del ambiente
    'dev.sportmaps.co',
    'staging.sportmaps.co',
]);

// Reservados que NO se interpretan como tenant slug (api, www, blog, etc.)
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'blog', 'docs', 'admin', 'dev', 'staging', 'preview']);

// Cache simple: slug → schoolId | null. TTL 60s.
const tenantCache = new Map<string, { value: string | null; expiresAt: number }>();
const TTL_MS = 60 * 1000;

function extractSubdomain(host: string): string | null {
    // Quitar puerto y normalizar
    const clean = (host || '').split(':')[0].toLowerCase().trim();
    if (!clean) return null;
    if (ROOT_HOSTNAMES.has(clean)) return null;
    if (!clean.endsWith('.sportmaps.co')) return null;

    const parts = clean.split('.');
    // <slug>.sportmaps.co -> 3 parts
    if (parts.length !== 3) return null;
    const slug = parts[0];

    if (RESERVED_SUBDOMAINS.has(slug)) return null;
    // Validar slug format (similar a generate_school_slug en SQL)
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) return null;

    return slug;
}

export async function tenantBySubdomain(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const slug = extractSubdomain(host);

    if (!slug) {
        return next();
    }

    req.subdomainSlug = slug;

    // Cache
    const cached = tenantCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
        if (cached.value) req.subdomainSchoolId = cached.value;
        return next();
    }

    try {
        const { data, error } = await supabase.rpc('get_school_id_by_slug', { p_slug: slug });
        if (error) {
            req.log?.warn({ err: error, slug }, 'get_school_id_by_slug failed');
        }
        const schoolId = (data as string | null) ?? null;

        tenantCache.set(slug, { value: schoolId, expiresAt: Date.now() + TTL_MS });
        if (schoolId) {
            req.subdomainSchoolId = schoolId;
        }
    } catch (err: any) {
        req.log?.warn({ err, slug }, 'tenantBySubdomain unexpected error');
    }

    next();
}
