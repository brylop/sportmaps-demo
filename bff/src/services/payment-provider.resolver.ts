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
    /**
     * De dónde salieron las credenciales:
     *  - 'school_direct' → cuenta propia de la escuela (payment_mode='direct'), secretos
     *    descifrados de payment_provider_secrets.
     *  - 'vendor'        → vendor_payment_providers.
     *  - 'env'           → llaves globales del BFF. Transitorio: hoy pertenecen a UNA
     *    escuela real, así que solo la escuela en 'aggregator' llega acá.
     *
     * Los callers lo usan para no cambiarle el comportamiento al camino legacy: p.ej.
     * `create-session` solo firma el Widget en el BFF cuando es 'school_direct', y deja
     * que 'env' siga pidiendo la firma a la Edge Function como hasta ahora.
     */
    source?: 'school_direct' | 'vendor' | 'env';
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
        source: 'school_direct',
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

/**
 * Providers para un checkout SIN dueño identificable (ni escuela ni vendor).
 *
 * Devuelve [] a propósito: exponer la public key de ENV aquí hacía que cualquier
 * checkout de marketplace abriera el widget contra la cuenta comercial de ENV — que es
 * la de una escuela real. Un checkout sin dueño no debe poder cobrar.
 * Ref: docs/payments-connected-accounts-fase0-cierre.md §2 ter.
 */
export function listProvidersForMarketplace(): PublicProviderInfo[] {
    console.warn(
        '[payment-provider.resolver] listProvidersForMarketplace: checkout sin schoolId ni vendorId → sin providers (fail-closed).',
    );
    return [];
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

    // Las llaves de ENV son de UNA escuela real (ver §2 ter del doc), así que solo son
    // legítimas para ESA escuela — la que está en payment_mode='aggregator'. Ningún vendor,
    // organizer ni checkout de marketplace debe poder usarlas: su dinero terminaría en la
    // cuenta comercial de un cliente ajeno. Este flag habilita el fallback a ENV del final
    // únicamente en ese caso.
    let envFallbackAllowed = false;

    if (schoolId) {
        // Modo de pago de la escuela — regla fail-closed [M1].
        const { data: schoolRow, error: schoolErr } = await supabase
            .from('schools')
            .select('payment_mode')
            .eq('id', schoolId)
            .maybeSingle();

        // Si la lectura FALLA (p.ej. el código subió antes de aplicar la migración que
        // crea schools.payment_mode) no se puede decidir el modo. Se degrada al camino
        // legacy en vez de bloquear: bloquear aquí apagaría el checkout de todas las
        // escuelas por un desfase de despliegue. El log es la señal de alarma.
        if (schoolErr) {
            console.error(
                `[payment-provider.resolver] no se pudo leer schools.payment_mode (school ${schoolId}): ${schoolErr.message}. ` +
                'Se degrada al camino legacy (ENV). ¿Falta aplicar la migración de payment_mode?',
            );
        }

        const paymentMode: string | null = schoolErr
            ? null
            : ((schoolRow as any)?.payment_mode ?? null);

        // 'unset' = escuela sin decisión de cobro → BLOQUEADA. No cae a ENV.
        // Crítico: las llaves WOMPI_* del ENV son de una escuela real (ver
        // docs/payments-connected-accounts-fase0-cierre.md §2 ter), así que caer a ENV
        // le rutearía el dinero de esta escuela a la cuenta comercial de otra.
        if (paymentMode === 'unset') {
            console.warn(
                `[payment-provider.resolver] school ${schoolId} en 'unset' → checkout BLOQUEADO (fail-closed). ` +
                'Debe conectar su propia cuenta (direct) antes de cobrar online.',
            );
            return null;
        }

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
            // 'connected_pending_webhook' SÍ habilita el cobro: el events_secret de Wompi
            // solo se puede verificar cuando llega el primer webhook, y el primer webhook
            // solo llega si hubo un cobro. Exigir 'connected' aquí sería un deadlock.
            // Lo que bloquea es 'expired' / 'error' / 'disconnected'.
            if (chosen.connect_status !== 'connected'
                && chosen.connect_status !== 'connected_pending_webhook') {
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

        // 'aggregator' → camino legacy: llaves de ENV, más abajo. Transitorio: esas llaves
        // pertenecen a UNA escuela real, no a SportMaps. Solo debería quedar esa escuela en
        // 'aggregator' (ver migración 20260730000003) hasta migrarla a 'direct'.
        // null (lectura fallida) → también legacy, por el desfase de despliegue de arriba.
        envFallbackAllowed = true;
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
                source: 'vendor',
            };
        }

        // Vendor sin credenciales propias → BLOQUEADO. No hay fallback a ENV: esas llaves
        // son de una escuela, y cobrarle a un cliente de este vendor con ellas le mandaría
        // la plata a esa escuela.
        console.warn(
            `[payment-provider.resolver] vendor ${vendorId} sin provider habilitado → checkout BLOQUEADO (fail-closed).`,
        );
        return null;
    }

    if (!envFallbackAllowed) {
        // Sin escuela ni vendor: checkout de marketplace sin dueño identificable. Antes caía
        // a ENV, o sea a la cuenta comercial de una escuela real.
        console.warn(
            '[payment-provider.resolver] resolveProvider sin schoolId ni vendorId → BLOQUEADO (fail-closed). ' +
            'El checkout debe identificar al dueño del cobro.',
        );
        return null;
    }

    // Llaves de ENV — solo alcanzable por la escuela en 'aggregator' (ver flag arriba).
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
            source: 'env',
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
        source: 'env',
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
            source: 'env',
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
        source: 'env',
    };
}
