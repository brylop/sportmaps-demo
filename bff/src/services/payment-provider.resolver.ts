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
import { decryptSecretOrNull } from '../utils/payment-crypto';

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

// ─── Secretos cifrados (Connected Accounts, tabla payment_provider_secrets) ─

interface DecryptedSecrets {
    accessToken: string | null;
    refreshToken: string | null;
    privateKey: string | null;
    integritySecret: string | null;
    eventsSecret: string | null;
}

/**
 * Carga y descifra los secretos de un provider conectado (Fase 0 connected-accounts).
 * Devuelve null si no hay fila o si el descifrado falla (clave ausente/corrupta) →
 * el caller debe tratar null como "sin credenciales" y fail-closed. Nunca lanza.
 */
async function loadDecryptedSecrets(providerId: string): Promise<DecryptedSecrets | null> {
    try {
        const { data } = await supabase
            .from('payment_provider_secrets')
            .select('access_token_enc, refresh_token_enc, private_key_enc, integrity_secret_enc, events_secret_enc')
            .eq('provider_id', providerId)
            .maybeSingle();
        if (!data) return null;
        const d = data as any;
        return {
            accessToken: decryptSecretOrNull(d.access_token_enc),
            refreshToken: decryptSecretOrNull(d.refresh_token_enc),
            privateKey: decryptSecretOrNull(d.private_key_enc),
            integritySecret: decryptSecretOrNull(d.integrity_secret_enc),
            eventsSecret: decryptSecretOrNull(d.events_secret_enc),
        };
    } catch (e: any) {
        console.error('[payment-provider.resolver] loadDecryptedSecrets:', e?.message);
        return null;
    }
}

/**
 * Mapea los secretos descifrados al shape ResolvedProvider según el provider.
 * MP: access_token propio. Wompi: private_key hace de "accessToken", + integrity/events.
 * Devuelve null si falta el secreto imprescindible (accessToken efectivo).
 */
function toResolved(
    provider: PaymentProvider,
    row: { public_key: string; sandbox: boolean; is_default: boolean },
    secrets: DecryptedSecrets,
): ResolvedProvider | null {
    const isWompi = provider === 'wompi';
    const accessToken = isWompi ? secrets.privateKey : secrets.accessToken;
    if (!accessToken) return null;
    return {
        provider,
        publicKey: row.public_key,
        accessToken,
        webhookSecret: isWompi ? secrets.eventsSecret : null,
        integritySecret: isWompi ? secrets.integritySecret : null,
        sandbox: row.sandbox,
        isDefault: row.is_default,
    };
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
        // Modo de pago de la escuela — regla fail-closed [M1].
        const { data: schoolRow } = await supabase
            .from('schools')
            .select('payment_mode')
            .eq('id', schoolId)
            .maybeSingle();
        const paymentMode = (schoolRow as any)?.payment_mode ?? 'unset';

        if (paymentMode === 'direct') {
            // SOLO cuenta propia conectada. NUNCA cae a las llaves globales (ENV).
            const { data, error } = await supabase
                .from('school_payment_providers')
                .select('id, provider, public_key, sandbox, is_default, connect_status')
                .eq('school_id', schoolId)
                .eq('enabled', true)
                .order('is_default', { ascending: false });
            if (error) {
                console.error('[payment-provider.resolver] resolveProvider direct:', error.message);
            }
            const rows = data ?? [];
            const chosen =
                (preferredProvider && rows.find(r => r.provider === preferredProvider)) ||
                rows[0];

            if (!chosen) {
                console.warn(`[payment-provider.resolver] school ${schoolId} en 'direct' sin provider habilitado → checkout BLOQUEADO (fail-closed).`);
                return null;
            }
            if (chosen.connect_status !== 'connected') {
                console.warn(`[payment-provider.resolver] school ${schoolId} provider ${chosen.provider} en estado '${chosen.connect_status}' → checkout BLOQUEADO (fail-closed).`);
                return null;
            }
            const secrets = await loadDecryptedSecrets(chosen.id);
            const resolved = secrets && toResolved(chosen.provider as PaymentProvider, chosen, secrets);
            if (!resolved) {
                console.warn(`[payment-provider.resolver] school ${schoolId} provider ${chosen.provider} sin secretos descifrables → checkout BLOQUEADO (fail-closed).`);
                return null;
            }
            return resolved;
        }

        // 'aggregator' | 'unset' → comportamiento legacy: llaves globales (ENV) más abajo.
        // Prod-hardening (Fase 4): 'unset' debería BLOQUEAR en prod; hoy se trata como
        // agregador para no romper el flujo actual ni las escuelas/demos existentes.
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
            .select('id, public_key, sandbox, is_default')
            .eq('school_id', schoolId)
            .eq('provider', provider)
            .eq('enabled', true)
            .maybeSingle();

        if (data) {
            const secrets = await loadDecryptedSecrets((data as any).id);
            const resolved = secrets && toResolved(provider, data as any, secrets);
            if (resolved) return resolved;
            // Fila sin secretos descifrables → cae al fallback global de abajo.
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
