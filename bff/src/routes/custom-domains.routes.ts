// bff/src/routes/custom-domains.routes.ts
//
// Endpoints para gestion de dominios propios de escuelas Enterprise (Fase 5).
//
//   POST   /api/v1/schools/:id/domains          → add (issue verification token)
//   GET    /api/v1/schools/:id/domains          → list
//   POST   /api/v1/schools/:id/domains/:did/verify → verify DNS TXT
//   DELETE /api/v1/schools/:id/domains/:did     → soft-remove
//
// Seguridad: auth + role + CSRF + rate-limit + feature gate (en RPC).

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { promises as dns } from 'dns';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { requireCsrfHeader } from '../middlewares/csrfHeader';

const router = Router();

const domainLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited' },
});

const AddDomainSchema = z.object({
    domain: z.string().min(4).max(253).toLowerCase().regex(
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/,
        'invalid_domain_format',
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/schools/:id/domains  — agregar dominio (emite token)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/domains',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    requireCsrfHeader,
    domainLimiter,
    async (req: Request, res: Response) => {
        const schoolId = req.params.id;
        const isPrivileged = ['super_admin', 'admin', 'owner'].includes(req.role);
        if (!isPrivileged && req.schoolId !== schoolId) {
            return res.status(403).json({ error: 'forbidden' });
        }

        const parsed = AddDomainSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
        }

        try {
            const { data, error } = await supabase.rpc('add_custom_domain', {
                p_school_id: schoolId,
                p_domain: parsed.data.domain,
            });

            if (error) {
                req.log?.error({ err: error, schoolId }, 'add_custom_domain RPC failed');
                return res.status(500).json({ error: 'server_error', detail: error.message });
            }

            if (!data?.ok) {
                const errCode = data?.error || 'unknown';
                const statusByCode: Record<string, number> = {
                    auth_required: 401,
                    forbidden: 403,
                    feature_not_available: 403,
                    invalid_domain: 400,
                    reserved_domain: 400,
                };
                return res.status(statusByCode[errCode] ?? 400).json(data);
            }

            return res.json(data);
        } catch (err: any) {
            req.log?.error({ err }, 'Error POST /schools/:id/domains');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/schools/:id/domains  — listar
// ─────────────────────────────────────────────────────────────────────────────
router.get(
    '/:id/domains',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    async (req: Request, res: Response) => {
        const schoolId = req.params.id;
        const isPrivileged = ['super_admin', 'admin', 'owner'].includes(req.role);
        if (!isPrivileged && req.schoolId !== schoolId) {
            return res.status(403).json({ error: 'forbidden' });
        }

        try {
            const { data, error } = await supabase
                .from('school_custom_domains')
                .select('id, domain, verification_token, verified_at, ssl_status, ssl_issued_at, ssl_expires_at, removed_at, created_at')
                .eq('school_id', schoolId)
                .is('removed_at', null)
                .order('created_at', { ascending: false });

            if (error) {
                req.log?.error({ err: error, schoolId }, 'Error listing custom domains');
                return res.status(500).json({ error: 'server_error' });
            }
            return res.json({ ok: true, domains: data ?? [] });
        } catch (err: any) {
            req.log?.error({ err }, 'Error GET /schools/:id/domains');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/schools/:id/domains/:did/verify — checkear DNS TXT y marcar
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/domains/:did/verify',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    requireCsrfHeader,
    domainLimiter,
    async (req: Request, res: Response) => {
        const schoolId = req.params.id;
        const domainId = req.params.did;
        const isPrivileged = ['super_admin', 'admin', 'owner'].includes(req.role);
        if (!isPrivileged && req.schoolId !== schoolId) {
            return res.status(403).json({ error: 'forbidden' });
        }

        try {
            // 1. Leer dominio + token
            const { data: domainRow, error: readErr } = await supabase
                .from('school_custom_domains')
                .select('id, domain, verification_token, verified_at, removed_at')
                .eq('id', domainId)
                .eq('school_id', schoolId)
                .maybeSingle();

            if (readErr || !domainRow) {
                return res.status(404).json({ error: 'not_found' });
            }
            if (domainRow.removed_at) {
                return res.status(400).json({ error: 'domain_removed' });
            }
            if (domainRow.verified_at) {
                return res.json({ ok: true, already_verified: true });
            }

            // 2. Resolver TXT record _sportmaps-verify.<domain>
            const txtName = `_sportmaps-verify.${domainRow.domain}`;
            let records: string[][] = [];
            try {
                records = await dns.resolveTxt(txtName);
            } catch (dnsErr: any) {
                return res.status(400).json({
                    error: 'txt_record_not_found',
                    detail: dnsErr?.code || 'ENODATA',
                    hint: `Agrega un TXT record en ${txtName} con valor ${domainRow.verification_token}`,
                });
            }

            // 3. Match del token
            const flat = records.flat().map((s) => s.trim());
            const match = flat.includes(domainRow.verification_token);
            if (!match) {
                return res.status(400).json({
                    error: 'txt_record_mismatch',
                    found: flat,
                    expected: domainRow.verification_token,
                });
            }

            // 4. Marcar verified via RPC
            const { data: rpcData, error: rpcErr } = await supabase.rpc('mark_custom_domain_verified', {
                p_id: domainId,
            });
            if (rpcErr || !rpcData?.ok) {
                req.log?.error({ err: rpcErr, rpcData }, 'mark_custom_domain_verified failed');
                return res.status(500).json({ error: 'mark_verified_failed' });
            }

            return res.json({
                ok: true,
                verified: true,
                next_step: 'Configura un CNAME del dominio apuntando a cname.vercel-dns.com. Vercel emitira SSL en 5-10 min.',
            });
        } catch (err: any) {
            req.log?.error({ err }, 'Error POST /schools/:id/domains/:did/verify');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/schools/:id/domains/:did — soft remove
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
    '/:id/domains/:did',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    requireCsrfHeader,
    async (req: Request, res: Response) => {
        const schoolId = req.params.id;
        const domainId = req.params.did;
        const isPrivileged = ['super_admin', 'admin', 'owner'].includes(req.role);
        if (!isPrivileged && req.schoolId !== schoolId) {
            return res.status(403).json({ error: 'forbidden' });
        }

        try {
            const { error } = await supabase
                .from('school_custom_domains')
                .update({ removed_at: new Date().toISOString(), removed_by: req.user.id, updated_at: new Date().toISOString() })
                .eq('id', domainId)
                .eq('school_id', schoolId)
                .is('removed_at', null);

            if (error) {
                req.log?.error({ err: error }, 'soft remove domain failed');
                return res.status(500).json({ error: 'server_error' });
            }
            return res.json({ ok: true });
        } catch (err: any) {
            req.log?.error({ err }, 'Error DELETE /schools/:id/domains/:did');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

export default router;
