/**
 * payment-providers — Admin endpoints para configurar Wompi / MercadoPago
 * a nivel de escuela y de vendor.
 *
 * Endpoints:
 *  - GET    /api/v1/payment-providers/school/:schoolId   → lista (sin secretos)
 *  - POST   /api/v1/payment-providers/school/:schoolId   → upsert provider
 *  - PATCH  /api/v1/payment-providers/:id                → toggle / set default
 *  - DELETE /api/v1/payment-providers/:id
 *  - GET    /api/v1/payment-providers/vendor/:vendorId   → lista
 *  - POST   /api/v1/payment-providers/vendor/:vendorId   → upsert
 *
 * Seguridad:
 *  - school: solo school owner / school_admin / admin global pueden escribir.
 *  - vendor: solo el vendor mismo / admin global.
 *  - access_token y webhook_secret NUNCA se devuelven en respuestas; solo se reciben.
 *  - public_key se devuelve siempre (es seguro exponerlo).
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

const ProviderUpsertSchema = z.object({
    provider: z.enum(['wompi', 'mercadopago']),
    publicKey: z.string().min(10),
    accessToken: z.string().min(10),
    webhookSecret: z.string().optional(),
    integritySecret: z.string().optional(),     // solo Wompi
    sandbox: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    enabled: z.boolean().optional(),
});

const ProviderPatchSchema = z.object({
    publicKey: z.string().min(10).optional(),
    accessToken: z.string().min(10).optional(),
    webhookSecret: z.string().optional(),
    integritySecret: z.string().optional(),
    sandbox: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    enabled: z.boolean().optional(),
});

// ─── School endpoints ──────────────────────────────────────────────────────

router.get('/school/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params;

    // Verificar permisos: school owner / school_admin / admin
    const authorized = await isSchoolAuthorized(req.user.id, schoolId);
    if (!authorized) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('school_payment_providers')
        .select('id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at')
        .eq('school_id', schoolId)
        .order('is_default', { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ providers: data ?? [] });
});

router.post('/school/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params;
    const parsed = ProviderUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    }

    const authorized = await isSchoolAuthorized(req.user.id, schoolId);
    if (!authorized) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const p = parsed.data;
    const { data, error } = await supabase
        .from('school_payment_providers')
        .upsert(
            {
                school_id: schoolId,
                provider: p.provider,
                public_key: p.publicKey,
                access_token: p.accessToken,
                webhook_secret: p.webhookSecret ?? null,
                integrity_secret: p.integritySecret ?? null,
                sandbox: p.sandbox ?? true,
                is_default: p.isDefault ?? false,
                enabled: p.enabled ?? true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'school_id,provider' },
        )
        .select('id, provider, public_key, sandbox, is_default, enabled')
        .single();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ provider: data });
});

// ─── Vendor endpoints ──────────────────────────────────────────────────────

router.get('/vendor/:vendorId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { vendorId } = req.params;
    const isOwner = req.user.id === vendorId;
    const isAdmin = await isAdminGlobal(req.user.id);
    if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('vendor_payment_providers')
        .select('id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at')
        .eq('vendor_id', vendorId)
        .order('is_default', { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ providers: data ?? [] });
});

router.post('/vendor/:vendorId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { vendorId } = req.params;
    const isOwner = req.user.id === vendorId;
    const isAdmin = await isAdminGlobal(req.user.id);
    if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const parsed = ProviderUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    }

    const p = parsed.data;
    const { data, error } = await supabase
        .from('vendor_payment_providers')
        .upsert(
            {
                vendor_id: vendorId,
                provider: p.provider,
                public_key: p.publicKey,
                access_token: p.accessToken,
                webhook_secret: p.webhookSecret ?? null,
                integrity_secret: p.integritySecret ?? null,
                sandbox: p.sandbox ?? true,
                is_default: p.isDefault ?? false,
                enabled: p.enabled ?? true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'vendor_id,provider' },
        )
        .select('id, provider, public_key, sandbox, is_default, enabled')
        .single();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ provider: data });
});

// ─── Generic patch / delete by id ──────────────────────────────────────────

router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const parsed = ProviderPatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_body' });
    }

    // Cargar el provider existente para chequear permisos
    const target = await locateProviderById(id);
    if (!target) {
        return res.status(404).json({ error: 'not_found' });
    }

    const authorized = target.kind === 'school'
        ? await isSchoolAuthorized(req.user.id, target.entityId)
        : (req.user.id === target.entityId || await isAdminGlobal(req.user.id));

    if (!authorized) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.publicKey !== undefined) updates.public_key = parsed.data.publicKey;
    if (parsed.data.accessToken !== undefined) updates.access_token = parsed.data.accessToken;
    if (parsed.data.webhookSecret !== undefined) updates.webhook_secret = parsed.data.webhookSecret;
    if (parsed.data.integritySecret !== undefined) updates.integrity_secret = parsed.data.integritySecret;
    if (parsed.data.sandbox !== undefined) updates.sandbox = parsed.data.sandbox;
    if (parsed.data.isDefault !== undefined) updates.is_default = parsed.data.isDefault;
    if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

    const tableName = target.kind === 'school' ? 'school_payment_providers' : 'vendor_payment_providers';
    const { error } = await supabase.from(tableName).update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const target = await locateProviderById(id);
    if (!target) {
        return res.status(404).json({ error: 'not_found' });
    }

    const authorized = target.kind === 'school'
        ? await isSchoolAuthorized(req.user.id, target.entityId)
        : (req.user.id === target.entityId || await isAdminGlobal(req.user.id));

    if (!authorized) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const tableName = target.kind === 'school' ? 'school_payment_providers' : 'vendor_payment_providers';
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
});

// ─── Helpers ───────────────────────────────────────────────────────────────

async function isAdminGlobal(userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
    return data?.role === 'admin';
}

async function isSchoolAuthorized(userId: string, schoolId: string): Promise<boolean> {
    if (await isAdminGlobal(userId)) return true;

    const { data: school } = await supabase
        .from('schools')
        .select('owner_id')
        .eq('id', schoolId)
        .maybeSingle();

    if (school?.owner_id === userId) return true;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    return profile?.role === 'school_admin' || profile?.role === 'owner';
}

async function locateProviderById(
    id: string,
): Promise<{ kind: 'school' | 'vendor'; entityId: string } | null> {
    const { data: school } = await supabase
        .from('school_payment_providers')
        .select('school_id')
        .eq('id', id)
        .maybeSingle();
    if (school) return { kind: 'school', entityId: school.school_id };

    const { data: vendor } = await supabase
        .from('vendor_payment_providers')
        .select('vendor_id')
        .eq('id', id)
        .maybeSingle();
    if (vendor) return { kind: 'vendor', entityId: vendor.vendor_id };

    return null;
}

export default router;
