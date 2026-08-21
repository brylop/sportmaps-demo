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
import { encryptSecret } from '../utils/payment-crypto';

const router = Router();

// Schema discriminado por provider. El schema plano anterior no alcanzaba para Wompi:
// `accessToken` hacía de private key y `webhookSecret` de events secret, mapeo ambiguo
// que impedía guardar las 4 llaves reales. Ref: doc §2 (F0.1).
const SchoolProviderSchema = z.discriminatedUnion('provider', [
    z.object({
        provider: z.literal('wompi'),
        publicKey: z.string().min(10),
        privateKey: z.string().min(10),
        integritySecret: z.string().min(10),
        eventsSecret: z.string().min(10),
        sandbox: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        enabled: z.boolean().optional(),
    }),
    z.object({
        provider: z.literal('mercadopago'),
        publicKey: z.string().min(10),
        accessToken: z.string().min(10),
        webhookSecret: z.string().optional(),
        sandbox: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        enabled: z.boolean().optional(),
    }),
]);

/** Schema legacy — solo el camino vendor, que sigue guardando en claro (fuera de F0). */
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
    const { schoolId } = req.params as { schoolId: string };

    // Verificar permisos: school owner / school_admin / admin
    const authorized = await isSchoolAuthorized(req.user.id, schoolId);
    if (!authorized) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('school_payment_providers')
        .select('id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at, '
            + 'connect_method, connect_status, connected_at, external_user_id')
        .eq('school_id', schoolId)
        .order('is_default', { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // `as any[]`: los tipos generados de Supabase no incluyen todavía las columnas connect
    // (connect_method/connect_status/connected_at/external_user_id) de la mig 20260714000004
    // ni la tabla payment_provider_secrets. Regenerar los tipos elimina este cast.
    const rows = (data ?? []) as any[];

    // Qué secretos hay, sin devolver ninguno — ni en claro ni cifrado. Sirve para que la
    // UI muestre "configurado" vs "falta" sin exponer nada.
    const { data: secretRows } = await supabase
        .from('payment_provider_secrets')
        .select('provider_id, access_token_enc, private_key_enc, integrity_secret_enc, events_secret_enc, token_expires_at')
        .in('provider_id', rows.map(r => r.id));

    const secretsById = new Map((secretRows ?? []).map((s: any) => [s.provider_id, s]));

    const providers = rows.map(r => {
        const s: any = secretsById.get(r.id);
        return {
            ...r,
            secrets: {
                hasAccessToken: !!s?.access_token_enc,
                hasPrivateKey: !!s?.private_key_enc,
                hasIntegritySecret: !!s?.integrity_secret_enc,
                hasEventsSecret: !!s?.events_secret_enc,
                tokenExpiresAt: s?.token_expires_at ?? null,
            },
        };
    });

    return res.status(200).json({ providers });
});

router.post('/school/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    const parsed = SchoolProviderSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    }

    const authorized = await isSchoolAuthorized(req.user.id, schoolId);
    if (!authorized) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const p = parsed.data;

    // Gate por addon de pasarela. El admin global lo saltea (onboarding concierge).
    const isAdmin = await isAdminGlobal(req.user.id);
    if (!isAdmin) {
        const allowed = await hasGatewayAddon(schoolId, p.provider);
        if (!allowed) {
            return res.status(403).json({
                error: 'La escuela no tiene activo el addon de pasarela para este proveedor.',
                code: 'addon_required',
                addon: p.provider === 'wompi' ? 'wompi' : 'mp',
            });
        }
    }

    // Rechazo de llaves de prueba en producción — será el error más común de las escuelas.
    const sandbox = p.sandbox ?? true;
    if (!sandbox && /^(pub|prv)_test_/.test(p.publicKey)) {
        return res.status(400).json({
            error: 'Estas son llaves de PRUEBAS (pub_test_/prv_test_). Copia las de producción '
                + 'desde tu panel del proveedor, o marca la conexión como sandbox.',
            code: 'test_keys_in_production',
        });
    }

    // Cifrado AES-256-GCM en el BFF: la DB nunca ve estos valores en claro.
    let secretsEnc: Record<string, string | null>;
    try {
        secretsEnc = p.provider === 'wompi'
            ? {
                private_key_enc: encryptSecret(p.privateKey),
                integrity_secret_enc: encryptSecret(p.integritySecret),
                events_secret_enc: encryptSecret(p.eventsSecret),
            }
            : {
                access_token_enc: encryptSecret(p.accessToken),
                events_secret_enc: p.webhookSecret ? encryptSecret(p.webhookSecret) : null,
            };
    } catch (err: any) {
        // Típicamente PAYMENT_TOKENS_ENC_KEY ausente o mal formada en el entorno.
        console.error('[payment-providers] cifrado de secretos falló:', err?.message);
        return res.status(500).json({ error: 'cipher_unavailable', code: 'cipher_unavailable' });
    }

    // Wompi: el events_secret solo se puede verificar cuando llegue el primer webhook.
    const connectStatus = p.provider === 'wompi' ? 'connected_pending_webhook' : 'connected';

    const { data: providerId, error } = await supabase.rpc('upsert_school_provider', {
        p_school_id: schoolId,
        p_provider: p.provider,
        p_public_key: p.publicKey,
        p_secrets_enc: secretsEnc,
        p_sandbox: sandbox,
        p_enabled: p.enabled ?? true,
        p_is_default: p.isDefault ?? false,
        p_connect_method: 'manual',
        p_connect_status: connectStatus,
        p_connected_by: req.user.id,
    });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
        provider: {
            id: providerId,
            provider: p.provider,
            public_key: p.publicKey,
            sandbox,
            connect_method: 'manual',
            connect_status: connectStatus,
        },
    });
});

// ─── Vendor endpoints ──────────────────────────────────────────────────────

router.get('/vendor/:vendorId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { vendorId } = req.params as { vendorId: string };
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
    const { vendorId } = req.params as { vendorId: string };
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
    const { id } = req.params as { id: string };
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

    // Los secretos de ESCUELA ya no se escriben aquí: irían en claro a las columnas legacy
    // (DEPRECATED por 20260714000004) y el resolver, que lee los cifrados de
    // payment_provider_secrets, no los vería → checkout bloqueado por fail-closed.
    // Van por POST /school/:schoolId, que cifra y usa la RPC transaccional.
    const touchesSecrets = parsed.data.accessToken !== undefined
        || parsed.data.webhookSecret !== undefined
        || parsed.data.integritySecret !== undefined;

    if (target.kind === 'school' && touchesSecrets) {
        return res.status(400).json({
            error: 'Las llaves de una escuela se actualizan por POST /payment-providers/school/:schoolId, '
                + 'que las cifra antes de guardarlas. Este PATCH solo cambia sandbox/enabled/is_default/publicKey.',
            code: 'use_encrypted_upsert',
        });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.publicKey !== undefined) updates.public_key = parsed.data.publicKey;
    if (parsed.data.sandbox !== undefined) updates.sandbox = parsed.data.sandbox;
    if (parsed.data.isDefault !== undefined) updates.is_default = parsed.data.isDefault;
    if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

    // Camino vendor: sigue en claro (fuera del alcance de F0, lo leen vendor/recurring).
    if (target.kind === 'vendor') {
        if (parsed.data.accessToken !== undefined) updates.access_token = parsed.data.accessToken;
        if (parsed.data.webhookSecret !== undefined) updates.webhook_secret = parsed.data.webhookSecret;
        if (parsed.data.integritySecret !== undefined) updates.integrity_secret = parsed.data.integritySecret;
    }

    const tableName = target.kind === 'school' ? 'school_payment_providers' : 'vendor_payment_providers';
    const { error } = await supabase.from(tableName).update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };
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

/**
 * ¿La escuela tiene activo el addon de pasarela del proveedor?
 * Usa has_entitlement() y las keys 'wompi'/'mp' de school_addons, que ya existen
 * (mig 20260513000007). Fail-closed: si la consulta falla, se niega.
 */
async function hasGatewayAddon(schoolId: string, provider: 'wompi' | 'mercadopago'): Promise<boolean> {
    const key = provider === 'wompi' ? 'wompi' : 'mp';
    const { data, error } = await supabase.rpc('has_entitlement', {
        p_school_id: schoolId,
        p_key: key,
    });
    if (error) {
        console.error('[payment-providers] has_entitlement falló:', error.message);
        return false;
    }
    return data === true;
}

async function isAdminGlobal(userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
    // 'super_admin' es estrictamente superior a 'admin'; excluirlo era un
    // descuido — el resto del producto trata a los dos como staff de
    // plataforma (ver AppSidebar). Sin esto, el super admin ve el formulario
    // de pasarelas y recibe 403 al guardar.
    return data?.role === 'admin' || data?.role === 'super_admin';
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
