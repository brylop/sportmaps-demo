// bff/src/routes/schools.routes.ts
//
// Endpoints relacionados con la escuela activa del usuario.
// Hoy: branding (white-label). Futuro: settings, custom domains.
//
// Seguridad:
//  - requireAuth: valida JWT + membresia en school_members
//  - requireRole: solo owner/admin/school_admin/super_admin
//  - requireCsrfHeader: previene CSRF para state-changing routes
//  - rate-limit dedicado: 10/hora por escuela (anti-abuse)
//  - validacion server-side con zod (hex strict, logo_url whitelisted)
//  - RPC seguro update_school_branding (audit log automatico)
//  - auditLog adicional en security_audit_log (correlacion cross-action)

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, auditLog } from '../middlewares/authMiddleware';
import { requireCsrfHeader } from '../middlewares/csrfHeader';
import { validateLogoUrl } from '../utils/logoValidator';
import { invalidateBrandingCache } from '../utils/schoolBrandingResolver';

const router = Router();

// ── Rate limit especifico para branding ──────────────────────────────────────
// Espejo del rate-limit del RPC SQL (max 10/hora). El doble-cap (BFF + DB)
// protege incluso si alguien bypassea el BFF llamando al RPC directo.
const brandingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: process.env.NODE_ENV === 'production' ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Cap por escuela, no por IP (varios admins desde misma red).
        const schoolId = (req as any).params?.id || (req as any).schoolId;
        return schoolId ? `branding-school-${schoolId}` : `branding-ip-${req.ip}`;
    },
    message: {
        error: 'rate_limited',
        message: 'Demasiados cambios de marca recientes. Intenta en 1 hora.',
    },
});

// ── Schema de validacion ─────────────────────────────────────────────────────
// Regex hex estricto: anti-XSS via CSS var injection. Ej. payload malicioso
// como "#fff; background: url(javascript:..." seria rechazado.
const HEX_COLOR = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid_hex_color');

const brandingUpdateSchema = z.object({
    // Si se envia logo_url, debe ser del bucket Supabase Storage school-assets
    // con la ruta logos/<school_id>/... La validacion estricta del prefix la
    // hace el RPC SQL, aqui solo verificamos forma general.
    logo_url:         z.string().url().max(1024).nullable().optional(),
    primary_color:    HEX_COLOR.optional(),
    secondary_color:  HEX_COLOR.optional(),
    show_watermark:   z.boolean().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'at_least_one_field_required' },
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/schools/:id/branding
//
// Actualiza el branding de una escuela (logo + colores + watermark toggle).
// Solo accesible para admins de la escuela en tier Pro+ (gate hecho por RPC).
//
// Body (todos opcionales, al menos uno requerido):
//   { logo_url?, primary_color?, secondary_color?, show_watermark? }
//
// Respuestas:
//   200 { ok: true, school_id, logo_url, branding_settings }
//   400 invalid_payload | invalid_*_color | invalid_logo_url
//   401 auth_required
//   403 forbidden | feature_not_available
//   429 rate_limited
//   500 server_error
// ─────────────────────────────────────────────────────────────────────────────
router.put(
    '/:id/branding',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    requireCsrfHeader,
    brandingLimiter,
    async (req: Request, res: Response) => {
        const schoolIdParam = req.params.id;

        // Forzar coincidencia entre param y header x-school-id resuelto por requireAuth.
        // Anti-IDOR: super-admin puede cambiar otra escuela enviando x-school-id especifico,
        // resto debe match exacto. requireAuth ya garantiza membership en req.schoolId.
        const isPrivileged = req.role === 'super_admin' || req.role === 'admin' || req.role === 'owner';
        if (!isPrivileged && req.schoolId !== schoolIdParam) {
            req.log?.warn(
                { userId: req.user?.id, role: req.role, paramSchool: schoolIdParam, sessionSchool: req.schoolId },
                'IDOR attempt: branding update cross-school',
            );
            return res.status(403).json({ error: 'forbidden', message: 'school_id mismatch' });
        }

        // Validacion zod
        const parsed = brandingUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'invalid_payload',
                details: parsed.error.flatten(),
            });
        }
        const { logo_url, primary_color, secondary_color, show_watermark } = parsed.data;

        // Forensics: IP real considerando proxy (Render setea x-forwarded-for)
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
        const userAgent = req.headers['user-agent'] || null;

        // ── Defense-in-depth: validacion MIME real del logo (Fase 1.8) ──
        // El bucket Storage ya valida MIME al subir, pero confiamos en el
        // cliente para que pase el tipo correcto. Aqui re-validamos:
        //   - host es el Storage de SportMaps
        //   - path es logos/<school_id>/
        //   - magic bytes coinciden con el header Content-Type
        //   - SVG no contiene <script>, onload, javascript:, foreignObject
        //   - tamaño <= 2MB
        if (logo_url) {
            const validation = await validateLogoUrl(logo_url, schoolIdParam);
            if (!validation.ok) {
                req.log?.warn(
                    {
                        userId: req.user?.id,
                        schoolId: schoolIdParam,
                        logoUrl: logo_url,
                        validationError: validation.error,
                        detail: validation.detail,
                        ip,
                        ua: userAgent,
                    },
                    'Logo validation rejected (defense-in-depth)',
                );
                // Audit cruzado para forense (puede haber sido intento de bypass)
                await auditLog(
                    req,
                    'branding_logo_rejected',
                    'schools',
                    schoolIdParam,
                    null,
                    { logo_url, validation_error: validation.error, detail: validation.detail },
                );
                return res.status(400).json({
                    error: validation.error,
                    message: 'El logo no pasó la validación de seguridad. Volvé a subir el archivo.',
                    detail: validation.detail,
                });
            }
        }

        try {
            const { data, error } = await supabase.rpc('update_school_branding', {
                p_school_id:        schoolIdParam,
                p_logo_url:         logo_url ?? null,
                p_primary_color:    primary_color ?? null,
                p_secondary_color:  secondary_color ?? null,
                p_show_watermark:   show_watermark ?? null,
                p_ip_address:       ip,
                p_user_agent:       userAgent,
            });

            if (error) {
                req.log?.error({ err: error, schoolIdParam }, 'update_school_branding RPC failed');
                return res.status(500).json({ error: 'server_error', detail: error.message });
            }

            if (!data?.ok) {
                // Mapear errores conocidos del RPC a status HTTP apropiados
                const errCode = data?.error || 'unknown';
                const statusByCode: Record<string, number> = {
                    auth_required:          401,
                    school_id_required:     400,
                    forbidden:              403,
                    feature_not_available:  403,
                    rate_limited:           429,
                    invalid_primary_color:  400,
                    invalid_secondary_color:400,
                    invalid_logo_url:       400,
                    school_not_found:       404,
                };
                return res.status(statusByCode[errCode] ?? 400).json(data);
            }

            // Audit cruzado en security_audit_log (corre en background, no
            // bloquea respuesta). El branding_change_log ya lo hizo el RPC.
            await auditLog(
                req,
                'branding_update',
                'schools',
                schoolIdParam,
                null,
                {
                    logo_url:        data.logo_url,
                    branding_settings: data.branding_settings,
                },
            );

            // Invalidar cache del resolver para que emails / PDFs / push
            // futuros usen el branding actualizado inmediatamente (sin
            // esperar al TTL de 60s).
            invalidateBrandingCache(schoolIdParam);

            return res.json(data);
        } catch (err: any) {
            req.log?.error({ err }, 'Error en PUT /schools/:id/branding');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/schools/:id/branding/audit
//
// Devuelve el historial de cambios de branding (max 50). Util para super-admin
// o admin que quiere ver "quien cambio que y cuando". La RLS sobre
// branding_change_log ya filtra por membership.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
    '/:id/branding/audit',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    async (req: Request, res: Response) => {
        const schoolIdParam = req.params.id;
        const isPrivileged = req.role === 'super_admin' || req.role === 'admin' || req.role === 'owner';
        if (!isPrivileged && req.schoolId !== schoolIdParam) {
            return res.status(403).json({ error: 'forbidden' });
        }

        try {
            const { data, error } = await supabase
                .from('branding_change_log')
                .select('id, changed_by, changed_at, before_state, after_state, ip_address, user_agent, change_source')
                .eq('school_id', schoolIdParam)
                .order('changed_at', { ascending: false })
                .limit(50);

            if (error) {
                req.log?.error({ err: error, schoolIdParam }, 'Error leyendo branding_change_log');
                return res.status(500).json({ error: 'server_error' });
            }

            return res.json({ ok: true, entries: data ?? [] });
        } catch (err: any) {
            req.log?.error({ err }, 'Error en GET /schools/:id/branding/audit');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

export default router;
