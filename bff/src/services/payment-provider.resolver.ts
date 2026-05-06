/**
 * payment-provider.resolver — decide que provider de pago usar para un checkout.
 *
 * Reglas:
 *  - Si el flujo tiene school_id (pago a escuela) → consulta
 *    school_payment_providers; el provider is_default=true gana, sino el
 *    primer enabled. Si el padre/atleta especifica preferencia, valida que
 *    este enabled para esa escuela.
 *  - Si el flujo tiene vendor_id (servicio, evento, producto) → consulta
 *    vendor_payment_providers analogo.
 *  - Marketplace global / sin escuela ni vendor → SportMaps default desde
 *    ENV (Wompi en CO, MP en resto LATAM idealmente; controlado por env).
 *
 * Tambien expone listProvidersFor* para que el frontend muestre selector
 * cuando hay 2+ providers habilitados.
 *
 * SECURITY: solo expone public_key + provider + sandbox al cliente.
 * access_token y webhook_secret nunca salen de este modulo.
 */

import { supabase } from '../config/supabase';

export type PaymentProvider = 'wompi' | 'mercadopago';

export interface PublicProviderInfo {
    provider: PaymentProvider;
    publicKey: string;
    sandbox: boolean;
    isDefault: boolean;
}

export interface ResolvedProvider extends PublicProviderInfo {
    /** Solo presente cuando se llama desde el BFF con service_role */
    accessToken?: string;
    /** Solo presente cuando se llama desde el BFF con service_role */
    webhookSecret?: string | null;
    /** Wompi only */
    integritySecret?: string | null;
}

export interface ResolveContext {
    schoolId?: string | null;
    vendorId?: string | null;
    /** Override del padre/atleta cuando hay seleccion en UI */
    preferredProvider?: PaymentProvider | null;
}

// ─── Listado publico (frontend pide al BFF) ────────────────────────────────

export async function listProvidersForSchool(
    schoolId: string,
): Promise<PublicProviderInfo[]> {
    const { data, error } = await supabase
        .from('school_payment_providers')
        .select('provider, public_key, sandbox, is_default')
        .eq('school_id', schoolId)
        .eq('enabled', true)
        .order('is_default', { ascending: false });

    if (error) {
        console.error('[payment-provider.resolver] listProvidersForSchool:', error.message);
        return [];
    }

    return (data ?? []).map(row => ({
        provider: row.provider as PaymentProvider,
        publicKey: row.public_key,
        sandbox: row.sandbox,
        isDefault: row.is_default,
    }));
}

export async function listProvidersForVendor(
    vendorId: string,
): Promise<PublicProviderInfo[]> {
    const { data, error } = await supabase
        .from('vendor_payment_providers')
        .select('provider, public_key, sandbox, is_default')
        .eq('vendor_id', vendorId)
        .eq('enabled', true)
        .order('is_default', { ascending: false });

    if (error) {
        console.error('[payment-provider.resolver] listProvidersForVendor:', error.message);
        return [];
    }

    return (data ?? []).map(row => ({
        provider: row.provider as PaymentProvider,
        publicKey: row.public_key,
        sandbox: row.sandbox,
        isDefault: row.is_default,
    }));
}

export function listProvidersForMarketplace(): PublicProviderInfo[] {
    const out: PublicProviderInfo[] = [];

    const wompiPub = process.env.WOMPI_PUBLIC_KEY;
    if (wompiPub) {
        out.push({
            provider: 'wompi',
            publicKey: wompiPub,
            sandbox: (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase() !== 'production',
            isDefault: (process.env.MARKETPLACE_DEFAULT_PROVIDER ?? 'mercadopago') === 'wompi',
        });
    }

    const mpPub = process.env.MP_PUBLIC_KEY_DEFAULT;
    if (mpPub) {
        out.push({
            provider: 'mercadopago',
            publicKey: mpPub,
            sandbox: (process.env.MP_ENV ?? 'sandbox').toLowerCase() !== 'production',
            isDefault: (process.env.MARKETPLACE_DEFAULT_PROVIDER ?? 'mercadopago') === 'mercadopago',
        });
    }

    return out;
}

// ─── Resolver con secretos (uso solo BFF interno) ──────────────────────────

/**
 * Resuelve el provider efectivo para un checkout dado el contexto.
 * Devuelve credenciales completas (incluye access_token).
 *
 * Orden de resolucion:
 *  1. preferredProvider (si esta enabled para el contexto)
 *  2. is_default=true del contexto
 *  3. primer enabled del contexto
 *  4. fallback a marketplace global (env)
 *  5. null si no hay provider configurado
 */
export async function resolveProvider(
    ctx: ResolveContext,
): Promise<ResolvedProvider | null> {
    const { schoolId, vendorId, preferredProvider } = ctx;

    if (schoolId) {
        const { data, error } = await supabase
            .from('school_payment_providers')
            .select('provider, public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default')
            .eq('school_id', schoolId)
            .eq('enabled', true)
            .order('is_default', { ascending: false });

        if (error) {
            console.error('[payment-provider.resolver] resolveProvider school:', error.message);
        }

        const rows = data ?? [];
        const chosen =
            (preferredProvider && rows.find(r => r.provider === preferredProvider)) ||
            rows[0];

        if (chosen) {
            return {
                provider: chosen.provider as PaymentProvider,
                publicKey: chosen.public_key,
                accessToken: chosen.access_token,
                webhookSecret: chosen.webhook_secret,
                integritySecret: chosen.integrity_secret,
                sandbox: chosen.sandbox,
                isDefault: chosen.is_default,
            };
        }
    }

    if (vendorId) {
        const { data, error } = await supabase
            .from('vendor_payment_providers')
            .select('provider, public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default')
            .eq('vendor_id', vendorId)
            .eq('enabled', true)
            .order('is_default', { ascending: false });

        if (error) {
            console.error('[payment-provider.resolver] resolveProvider vendor:', error.message);
        }

        const rows = data ?? [];
        const chosen =
            (preferredProvider && rows.find(r => r.provider === preferredProvider)) ||
            rows[0];

        if (chosen) {
            return {
                provider: chosen.provider as PaymentProvider,
                publicKey: chosen.public_key,
                accessToken: chosen.access_token,
                webhookSecret: chosen.webhook_secret,
                integritySecret: chosen.integrity_secret,
                sandbox: chosen.sandbox,
                isDefault: chosen.is_default,
            };
        }
    }

    // Marketplace global (sin escuela ni vendor)
    const marketplaceDefault = (process.env.MARKETPLACE_DEFAULT_PROVIDER ?? 'mercadopago') as PaymentProvider;
    const effective = preferredProvider ?? marketplaceDefault;

    if (effective === 'mercadopago') {
        const accessToken = process.env.MP_ACCESS_TOKEN_DEFAULT;
        const publicKey = process.env.MP_PUBLIC_KEY_DEFAULT;
        if (!accessToken || !publicKey) return null;
        return {
            provider: 'mercadopago',
            publicKey,
            accessToken,
            webhookSecret: process.env.MP_WEBHOOK_SECRET_DEFAULT ?? null,
            integritySecret: null,
            sandbox: (process.env.MP_ENV ?? 'sandbox').toLowerCase() !== 'production',
            isDefault: true,
        };
    }

    // Wompi marketplace global
    const wompiPub = process.env.WOMPI_PUBLIC_KEY;
    const wompiPriv = process.env.WOMPI_PRIVATE_KEY;
    if (!wompiPub || !wompiPriv) return null;
    return {
        provider: 'wompi',
        publicKey: wompiPub,
        accessToken: wompiPriv,
        webhookSecret: process.env.WOMPI_EVENTS_SECRET ?? null,
        integritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? null,
        sandbox: (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase() !== 'production',
        isDefault: true,
    };
}

/**
 * Carga config de un provider especifico para un contexto. Util cuando ya sabes
 * que provider quieres (e.g., webhook MP que llega y necesitas leer el access_token
 * del merchant que recibio el evento — busqueda inversa por external_reference).
 */
export async function loadProviderConfig(params: {
    provider: PaymentProvider;
    schoolId?: string | null;
    vendorId?: string | null;
}): Promise<ResolvedProvider | null> {
    const { provider, schoolId, vendorId } = params;

    if (schoolId) {
        const { data } = await supabase
            .from('school_payment_providers')
            .select('public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default')
            .eq('school_id', schoolId)
            .eq('provider', provider)
            .eq('enabled', true)
            .maybeSingle();

        if (data) {
            return {
                provider,
                publicKey: data.public_key,
                accessToken: data.access_token,
                webhookSecret: data.webhook_secret,
                integritySecret: data.integrity_secret,
                sandbox: data.sandbox,
                isDefault: data.is_default,
            };
        }
    }

    if (vendorId) {
        const { data } = await supabase
            .from('vendor_payment_providers')
            .select('public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default')
            .eq('vendor_id', vendorId)
            .eq('provider', provider)
            .eq('enabled', true)
            .maybeSingle();

        if (data) {
            return {
                provider,
                publicKey: data.public_key,
                accessToken: data.access_token,
                webhookSecret: data.webhook_secret,
                integritySecret: data.integrity_secret,
                sandbox: data.sandbox,
                isDefault: data.is_default,
            };
        }
    }

    // Fallback global por provider
    if (provider === 'mercadopago') {
        const accessToken = process.env.MP_ACCESS_TOKEN_DEFAULT;
        const publicKey = process.env.MP_PUBLIC_KEY_DEFAULT;
        if (!accessToken || !publicKey) return null;
        return {
            provider: 'mercadopago',
            publicKey,
            accessToken,
            webhookSecret: process.env.MP_WEBHOOK_SECRET_DEFAULT ?? null,
            integritySecret: null,
            sandbox: (process.env.MP_ENV ?? 'sandbox').toLowerCase() !== 'production',
            isDefault: true,
        };
    }

    const wompiPub = process.env.WOMPI_PUBLIC_KEY;
    const wompiPriv = process.env.WOMPI_PRIVATE_KEY;
    if (!wompiPub || !wompiPriv) return null;
    return {
        provider: 'wompi',
        publicKey: wompiPub,
        accessToken: wompiPriv,
        webhookSecret: process.env.WOMPI_EVENTS_SECRET ?? null,
        integritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? null,
        sandbox: (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase() !== 'production',
        isDefault: true,
    };
}
