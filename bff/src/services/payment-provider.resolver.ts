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
import { esCredencialDePrueba } from './mercadopago.service';
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
        // Wompi: events secret. MP: el secreto de firma de webhooks que guarda
        // POST /payment-providers/school en events_secret_enc. Antes era null para
        // MP y toda escuela MP en 'direct' recibia 503 en el webhook (tienda v2
        // F0, plan M-F0-7 "fix de :117").
        webhookSecret: secrets.eventsSecret,
        integritySecret: isWompi ? secrets.integritySecret : null,
        sandbox: row.sandbox,
        isDefault: row.is_default,
        source: 'school_direct',
    };
}

/**
 * Lee `schools.payment_mode`, el interruptor que decide de quién es la plata.
 *
 * `falloLectura` distingue "no se pudo preguntar" de "dijo unset": si el código
 * subió antes de la migración que crea la columna, bloquear apagaría el checkout
 * de todas las escuelas por un desfase de despliegue. En ese caso se degrada al
 * camino legacy y el log es la alarma.
 *
 * Vive acá, compartida por resolveProvider y loadProviderConfig, porque tenerla
 * duplicada fue justo el origen de que la segunda cayera a ENV donde la primera
 * bloqueaba.
 */
async function leerModoDePago(
    schoolId: string,
): Promise<{ modo: string | null; falloLectura: boolean }> {
    const { data, error } = await supabase
        .from('schools')
        .select('payment_mode')
        .eq('id', schoolId)
        .maybeSingle();

    if (error) {
        console.error(
            `[payment-provider.resolver] no se pudo leer schools.payment_mode (school ${schoolId}): ${error.message}. ` +
            'Se degrada al camino legacy (ENV). ¿Falta aplicar la migración de payment_mode?',
        );
        return { modo: null, falloLectura: true };
    }

    return { modo: ((data as any)?.payment_mode ?? null), falloLectura: false };
}

/**
 * Secretos de un provider de VENDEDOR externo. Tienda v2 F0 (M-F0-7): viven
 * cifrados en vendor_payment_provider_secrets; las columnas en claro de
 * vendor_payment_providers quedan DEPRECATED y solo se leen si no hay fila
 * cifrada (legacy, 0 filas en la viva al 2026-10-03). Nunca lanza.
 */
async function loadVendorSecrets(row: {
    id?: string | null;
    access_token?: string | null;
    webhook_secret?: string | null;
    integrity_secret?: string | null;
}): Promise<{ accessToken: string | null; integritySecret: string | null; eventsSecret: string | null }> {
    if (row.id) {
        try {
            const { data } = await supabase
                .from('vendor_payment_provider_secrets')
                .select('access_token_enc, private_key_enc, integrity_secret_enc, events_secret_enc')
                .eq('provider_id', row.id)
                .maybeSingle();
            if (data) {
                const d = data as any;
                return {
                    accessToken: decryptSecretOrNull(d.private_key_enc) ?? decryptSecretOrNull(d.access_token_enc),
                    integritySecret: decryptSecretOrNull(d.integrity_secret_enc),
                    eventsSecret: decryptSecretOrNull(d.events_secret_enc),
                };
            }
        } catch (e: any) {
            console.error('[payment-provider.resolver] loadVendorSecrets:', e?.message);
            return { accessToken: null, integritySecret: null, eventsSecret: null };
        }
    }
    return {
        accessToken: row.access_token ?? null,
        integritySecret: row.integrity_secret ?? null,
        eventsSecret: row.webhook_secret ?? null,
    };
}

/** Pasarela con que se cobra una orden de tienda (orders.seller_gateway_id / _kind). */
export interface SellerGatewayRef {
    gatewayId: string | null | undefined;
    gatewayKind: string | null | undefined;
}

/**
 * Credenciales de la pasarela PROPIA del vendedor de una orden de tienda
 * (tienda v2 F0, D-5 = A). La fila la eligio la base en create_cart_order.
 *
 * NUNCA cae a las llaves de ENV ni mira schools.payment_mode: las llaves de ENV
 * son de una escuela real (Dynasty) y una venta de tienda cobrada con ellas le
 * caeria en su cuenta. Sin fila habilitada o sin secretos descifrables → null
 * (el caller responde 409 SELLER_GATEWAY_NOT_CONFIGURED o ignora el webhook).
 */
export async function resolveSellerGateway(ref: SellerGatewayRef): Promise<ResolvedProvider | null> {
    const { gatewayId, gatewayKind } = ref;
    if (!gatewayId || (gatewayKind !== 'school' && gatewayKind !== 'vendor')) return null;

    if (gatewayKind === 'school') {
        const { data, error } = await supabase
            .from('school_payment_providers')
            .select('id, provider, public_key, sandbox, is_default, enabled, connect_status')
            .eq('id', gatewayId)
            .maybeSingle();
        const row = data as any;
        if (error || !row || row.enabled !== true) return null;
        if (row.connect_status !== 'connected' && row.connect_status !== 'connected_pending_webhook') return null;
        const secrets = await loadDecryptedSecrets(row.id);
        const resolved = secrets && toResolved(row.provider as PaymentProvider, row, secrets);
        if (!resolved) return null;
        if (resolved.provider === 'wompi' && !resolved.integritySecret) return null;
        return resolved;
    }

    const { data, error } = await supabase
        .from('vendor_payment_providers')
        .select('id, provider, public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default, enabled')
        .eq('id', gatewayId)
        .maybeSingle();
    const row = data as any;
    if (error || !row || row.enabled !== true) return null;
    const secrets = await loadVendorSecrets(row);
    if (!secrets.accessToken) return null;
    const isWompi = row.provider === 'wompi';
    if (isWompi && !secrets.integritySecret) return null;
    return {
        provider: row.provider as PaymentProvider,
        publicKey: row.public_key,
        accessToken: secrets.accessToken,
        webhookSecret: secrets.eventsSecret,
        integritySecret: isWompi ? secrets.integritySecret : null,
        sandbox: row.sandbox,
        isDefault: row.is_default,
        source: 'vendor',
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
        const { modo: paymentMode } = await leerModoDePago(schoolId);

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
            .select('id, provider, public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default')
            .eq('vendor_id', vendorId)
            .eq('enabled', true)
            .order('is_default', { ascending: false });

        if (error) {
            console.error('[payment-provider.resolver] resolveProvider vendor:', error.message);
        }

        const rows = (data ?? []) as any[];
        const chosen =
            (preferredProvider && rows.find(r => r.provider === preferredProvider)) ||
            rows[0];

        if (chosen) {
            // Secretos cifrados (M-F0-7); en claro solo si no hay fila cifrada.
            const secrets = await loadVendorSecrets(chosen);
            if (secrets.accessToken) {
                return {
                    provider: chosen.provider as PaymentProvider,
                    publicKey: chosen.public_key,
                    accessToken: secrets.accessToken,
                    webhookSecret: secrets.eventsSecret,
                    integritySecret: secrets.integritySecret,
                    sandbox: chosen.sandbox,
                    isDefault: chosen.is_default,
                    source: 'vendor',
                };
            }
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

    // 2026-08-31: MP_ACCESS_TOKEN_DEFAULT NO es una cuenta comercial de SportMaps
    // ni de la escuela — es la cuenta personal de MercadoPago de un padre real de
    // la plataforma (confirmado contra GET /users/me de MP). Una escuela en
    // 'aggregator' (hoy: Dynasty) que cobrara por acá le mandaría la mensualidad
    // de un alumno a esa cuenta personal — exactamente el riesgo de captador
    // irregular que este archivo existe para evitar. WOMPI_* de ENV sigue siendo
    // legítimo para 'aggregator' (son las llaves reales de esa escuela); MP no.
    // Bloqueado fail-closed en vez de usar la credencial — no hay reemplazo
    // todavía, así que MercadoPago queda sin fallback para escuelas hasta que
    // haya una cuenta comercial real detrás.
    if (effective === 'mercadopago' && schoolId) {
        console.warn(
            `[payment-provider.resolver] resolveProvider: school ${schoolId} en 'aggregator' pidiendo mercadopago → ` +
            'BLOQUEADO (fail-closed). MP_ACCESS_TOKEN_DEFAULT es una cuenta personal, no de SportMaps ni de la escuela.',
        );
        return null;
    }

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
            // DIN-9: manda la CREDENCIAL, no la variable. MP no tiene host de
            // sandbox, asi que un token APP_USR- cobra de verdad aunque MP_ENV diga
            // sandbox. El guard de arranque (assertMpEnvCoherente) impide que se
            // contradigan, y aca se lee del prefijo.
            sandbox: esCredencialDePrueba(process.env.MP_ACCESS_TOKEN_DEFAULT),
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
        // Misma regla fail-closed que resolveProvider. Antes esta función NO
        // miraba payment_mode y caía a ENV, así que una escuela en 'direct' con
        // secretos ilegibles terminaba creando el cobro (POST /mercadopago/create)
        // en la cuenta comercial de ENV, que es de otro. Bug de ruteo de dinero,
        // no una simple incoherencia.
        const { modo, falloLectura } = await leerModoDePago(schoolId);

        if (!falloLectura && modo === 'unset') {
            console.warn(
                `[payment-provider.resolver] loadProviderConfig: school ${schoolId} en 'unset' → sin credenciales (fail-closed).`,
            );
            return null;
        }

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
        }

        if (!falloLectura && modo === 'direct') {
            console.warn(
                `[payment-provider.resolver] loadProviderConfig: school ${schoolId} en 'direct' sin credenciales resolubles → null (fail-closed). ` +
                'No cae a ENV: esas llaves son de otra cuenta.',
            );
            return null;
        }

        // 'aggregator' o lectura fallida → sigue al fallback de ENV, como antes.
    }

    if (vendorId) {
        const { data } = await supabase
            .from('vendor_payment_providers')
            .select('id, public_key, access_token, webhook_secret, integrity_secret, sandbox, is_default')
            .eq('vendor_id', vendorId)
            .eq('provider', provider)
            .eq('enabled', true)
            .maybeSingle();

        if (data) {
            const row = data as any;
            const secrets = await loadVendorSecrets(row);
            if (secrets.accessToken) {
                return {
                    provider,
                    publicKey: row.public_key,
                    accessToken: secrets.accessToken,
                    webhookSecret: secrets.eventsSecret,
                    integritySecret: secrets.integritySecret,
                    sandbox: row.sandbox,
                    isDefault: row.is_default,
                    source: 'vendor',
                };
            }
        }

        // Vendor identificado pero sin credenciales propias → null, igual que en
        // resolveProvider. Caer a ENV le cobraría al cliente de este vendor en la
        // cuenta comercial de otro.
        console.warn(
            `[payment-provider.resolver] loadProviderConfig: vendor ${vendorId} sin provider ${provider} habilitado → null (fail-closed).`,
        );
        return null;
    }

    // Fallback de ENV. Solo alcanzable con 'aggregator', con lectura fallida de
    // payment_mode, o SIN dueño identificable — este último caso es el legacy:
    // los cobros MP viejos viven en la cuenta de ENV y leer su estado necesita
    // ese token, así que acá el fallback es lo correcto y no un agujero.
    //
    // EXCEPCIÓN 2026-08-31: si SÍ hay un schoolId (una escuela real intentando
    // cobrar, no una búsqueda legacy sin dueño), MercadoPago no cae a ENV.
    // MP_ACCESS_TOKEN_DEFAULT es la cuenta personal de MercadoPago de un padre
    // real de la plataforma (confirmado vía GET /users/me), no una cuenta
    // comercial de SportMaps ni de la escuela — cobrar por acá le mandaría la
    // plata de la mensualidad a esa cuenta personal. Wompi no tiene este
    // problema (sus llaves de ENV sí son de la escuela real en 'aggregator') y
    // sigue sin cambios.
    if (provider === 'mercadopago' && schoolId) {
        console.warn(
            `[payment-provider.resolver] loadProviderConfig: school ${schoolId} pidiendo mercadopago sin credenciales propias → ` +
            'BLOQUEADO (fail-closed), no cae a MP_ACCESS_TOKEN_DEFAULT (cuenta personal, no de SportMaps ni de la escuela).',
        );
        return null;
    }

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
            // DIN-9: manda la CREDENCIAL, no la variable. MP no tiene host de
            // sandbox, asi que un token APP_USR- cobra de verdad aunque MP_ENV diga
            // sandbox. El guard de arranque (assertMpEnvCoherente) impide que se
            // contradigan, y aca se lee del prefijo.
            sandbox: esCredencialDePrueba(process.env.MP_ACCESS_TOKEN_DEFAULT),
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
