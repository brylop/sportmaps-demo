/**
 * wompi.service — Capa unificada de integracion con Wompi (Colombia).
 *
 * Wompi opera con un Widget Checkout cliente-side:
 *  - El BFF crea la transaccion logica (payment, marketplace_transaction, order)
 *    y devuelve al frontend `{ reference, amountInCents }`.
 *  - El frontend obtiene la firma de integridad desde la Edge Function `wompi-sign`
 *    (o desde `signIntegrity` aqui si se prefiere todo via BFF) y abre el Widget
 *    con `publicKey + signature`.
 *  - Wompi llama al webhook (`/api/v1/webhooks/wompi`) cuando la transaccion
 *    cambia de estado. El webhook valida el checksum de eventos y reconcilia.
 *
 * NUNCA exponer WOMPI_INTEGRITY_SECRET ni WOMPI_EVENTS_SECRET al cliente.
 */

import crypto from 'crypto';

const WOMPI_BASE_URL_SANDBOX = 'https://sandbox.wompi.co/v1';
const WOMPI_BASE_URL_PROD = 'https://production.wompi.co/v1';

export type WompiSource =
    | 'school_payment'        // pago de escuela (mensualidad, inscripcion)
    | 'service'               // cita de servicio (fisio, coach)
    | 'event'                 // inscripcion a evento
    | 'subscription'          // suscripcion (plan)
    | 'cart'                  // carrito de productos del shop
    | 'marketplace_pay'       // pago generico de marketplace_transaction existente
    | 'session_booking';      // reserva de cancha / sesion con cobro

export interface WompiSignaturePayload {
    reference: string;
    amountInCents: number;
    currency?: string;
}

// ─── Credenciales por comercio (Connected Accounts) ────────────────────────────
//
// Antes este módulo leía process.env.WOMPI_* en cada función, lo que hacía imposible
// cobrar con la cuenta de una escuela concreta: el resolver entregaba la public_key de
// la escuela pero la firma se hacía con el integrity secret de ENV → firma inválida.
// Ahora toda función acepta `creds` opcional; sin `creds` usa ENV (camino legacy).
//
// Ref: docs/payments-connected-accounts-fase0-cierre.md §2 quater.

export interface WompiCreds {
    publicKey: string;
    privateKey: string;
    integritySecret: string | null;
    eventsSecret: string | null;
    sandbox: boolean;
}

/**
 * Resuelve las credenciales a usar.
 *
 * REGLA: no se mezcla. O vienen todas del `creds` recibido, o todas de ENV. Completar
 * un `creds` parcial con valores de ENV es exactamente el bug que rutea el dinero de
 * una escuela a la cuenta comercial de otra (las llaves de ENV son de una escuela real).
 * Devuelve null si falta lo imprescindible; el caller falla explícito.
 */
function resolveCreds(creds?: WompiCreds): WompiCreds | null {
    if (creds) {
        return creds.publicKey && creds.privateKey ? creds : null;
    }
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!publicKey || !privateKey) return null;
    return {
        publicKey,
        privateKey,
        integritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? null,
        eventsSecret: process.env.WOMPI_EVENTS_SECRET ?? null,
        sandbox: (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase() !== 'production',
    };
}

/**
 * Adapta el resultado de `resolveProvider` a WompiCreds.
 *
 * Tipado estructural a propósito (no importa ResolvedProvider) para no acoplar este
 * módulo al resolver. Ojo con el mapeo: en el shape del resolver, para Wompi el
 * `accessToken` ES la private key, y `webhookSecret` ES el events secret.
 */
export function wompiCredsFrom(r: {
    publicKey: string;
    accessToken?: string;
    integritySecret?: string | null;
    webhookSecret?: string | null;
    sandbox: boolean;
} | null | undefined): WompiCreds | null {
    // Sin public key o sin private key no hay credenciales usables. Devolver un objeto
    // a medias haría que resolveCreds() lo rechace más tarde y con peor diagnóstico.
    if (!r?.publicKey || !r.accessToken) return null;
    return {
        publicKey: r.publicKey,
        privateKey: r.accessToken,
        integritySecret: r.integritySecret ?? null,
        eventsSecret: r.webhookSecret ?? null,
        sandbox: r.sandbox,
    };
}

/** Base URL según el sandbox del comercio (no según ENV global). */
function baseUrlFor(creds?: WompiCreds): string {
    const sandbox = creds
        ? creds.sandbox
        : (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase() !== 'production';
    return sandbox ? WOMPI_BASE_URL_SANDBOX : WOMPI_BASE_URL_PROD;
}

/**
 * Genera una referencia unica para una transaccion Wompi.
 * Formato: <prefix>-<timestamp36>-<random>
 *  - prefix corto identifica la fuente (SCH, SVC, EVT, SUB, CART, MKT)
 *  - permite trazabilidad rapida del tipo de checkout sin lookup
 */
export function generateReference(source: WompiSource): string {
    const prefixMap: Record<WompiSource, string> = {
        school_payment: 'SCH',
        service: 'SVC',
        event: 'EVT',
        subscription: 'SUB',
        cart: 'CART',
        marketplace_pay: 'MKT',
        session_booking: 'BKG',
    };
    const prefix = prefixMap[source];
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${ts}-${rand}`;
}

/**
 * Genera la firma de integridad para abrir el Widget Checkout de Wompi.
 * Protocolo: SHA256( reference + amountInCents + currency + integritySecret )
 *
 * Usa esta funcion si quieres firmar desde el BFF en lugar de la Edge Function.
 * Por defecto el frontend pide la firma a `wompi-sign` (Edge Function);
 * tener esto en el BFF es util para tests, scripts, o flujos server-to-server.
 */
export function signIntegrity(payload: WompiSignaturePayload, creds?: WompiCreds): string {
    const integritySecret = creds
        ? creds.integritySecret
        : process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
        throw new Error(
            creds
                ? 'La cuenta Wompi conectada no tiene integrity_secret: no se puede firmar el checkout.'
                : 'WOMPI_INTEGRITY_SECRET no configurado en el BFF.',
        );
    }
    const { reference, amountInCents, currency = 'COP' } = payload;
    const stringToSign = `${reference}${amountInCents}${currency}${integritySecret}`;
    return crypto.createHash('sha256').update(stringToSign).digest('hex');
}

/**
 * Valida el checksum de un webhook de Wompi (event signature).
 *
 * Wompi envia en el body:
 *   {
 *     event, data: { transaction: {...} }, timestamp,
 *     signature: { checksum, properties: ['transaction.id', 'transaction.status', ...] }
 *   }
 *
 * Para validar:
 *   1. Tomar los valores de `data` segun los path en `signature.properties`
 *   2. Concatenar: <values...> + timestamp + WOMPI_EVENTS_SECRET
 *   3. SHA256 = signature.checksum
 */
// Ventana maxima de antiguedad permitida para webhooks de Wompi.
// Previene replay attacks: aunque un atacante capture un webhook valido
// con su checksum correcto, si lo replays >5 min despues lo rechazamos.
const WEBHOOK_MAX_AGE_SECONDS = 300;

export function validateWebhookChecksum(body: any, creds?: WompiCreds): boolean {
    const eventsSecret = creds ? creds.eventsSecret : process.env.WOMPI_EVENTS_SECRET;
    if (!eventsSecret) {
        console.error(
            creds
                ? '[wompi.service] la cuenta Wompi conectada no tiene events_secret: no se puede validar el webhook.'
                : '[wompi.service] WOMPI_EVENTS_SECRET no configurado.',
        );
        return false;
    }

    const signature = body?.signature;
    const timestamp = body?.timestamp;
    const data = body?.data;

    if (!signature?.checksum || !Array.isArray(signature?.properties)) {
        return false;
    }

    // Validacion de antiguedad (anti-replay). Wompi manda timestamp en
    // unix seconds. Si esta fuera de la ventana, rechazamos.
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || ts <= 0) return false;
    const ageSeconds = Math.abs(Date.now() / 1000 - ts);
    if (ageSeconds > WEBHOOK_MAX_AGE_SECONDS) return false;

    const values: string[] = [];
    for (const prop of signature.properties) {
        const keys = String(prop).split('.');
        let value: any = data;
        for (const key of keys) {
            if (typeof value === 'object' && value !== null) {
                value = value[key];
            } else {
                value = '';
                break;
            }
        }
        values.push(String(value ?? ''));
    }

    const raw = values.join('') + String(timestamp ?? '') + eventsSecret;
    const expected = crypto.createHash('sha256').update(raw).digest('hex');

    // Comparacion constant-time: evita timing attacks que filtrarian el checksum
    // byte por byte. timingSafeEqual REQUIERE buffers de la misma longitud — el
    // chequeo previo evita un throw cuando un atacante manda un checksum corto.
    const received = String(signature.checksum);
    if (received.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/**
 * Saneamos el cuerpo de error de Wompi antes de loguear/devolver. Wompi
 * puede incluir customer_email, card_holder o acceptance_token en sus
 * mensajes de error — eso es PII / data sensible que no debe terminar en
 * logs o respuestas HTTP del BFF.
 */
function sanitizeWompiErrorBody(body: string): string {
    let s = body;
    // Pares JSON tipo "campo":"valor" — enmascaramos el valor
    const sensitiveKeys = [
        'customer_email', 'card_holder', 'holder_name',
        'acceptance_token', 'accept_personal_auth', 'personal_data_auth',
        'phone_number', 'cellphone',
    ];
    for (const key of sensitiveKeys) {
        const re = new RegExp(`"${key}"\\s*:\\s*"[^"]*"`, 'gi');
        s = s.replace(re, `"${key}":"<redacted>"`);
    }
    // Tokens largos sueltos (>20 chars alphanum) — heuristic redact
    s = s.replace(/\b(tok_[A-Za-z0-9_]{16,}|eyJ[A-Za-z0-9._-]{20,})\b/g, '<token_redacted>');
    return s;
}

/**
 * Consulta el estado de una transaccion en la API de Wompi.
 * Util para:
 *  - Confirmar el monto en el webhook (defensa frente a webhook spoofing)
 *  - Polling desde paginas de resultado
 */
export async function fetchTransaction(transactionId: string, creds?: WompiCreds): Promise<{
    id: string;
    status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
    reference: string;
    amount_in_cents: number;
    currency: string;
    payment_method_type: string;
    created_at: string;
} | null> {
    // Endpoint público (no requiere llave); solo importa el ambiente del comercio.
    const baseUrl = baseUrlFor(creds);

    try {
        const res = await fetch(`${baseUrl}/transactions/${transactionId}`);
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch (err) {
        console.error('[wompi.service] fetchTransaction error', err);
        return null;
    }
}

/**
 * Solicita un void/refund a Wompi (requiere private key, no public).
 * Wompi hoy solo expone void de transaccion APPROVED en plazos cortos;
 * refund parcial se gestiona offline contra el merchant.
 */
export async function voidTransaction(
    transactionId: string,
    creds?: WompiCreds,
): Promise<{ ok: boolean; error?: string }> {
    const c = resolveCreds(creds);
    if (!c) {
        return { ok: false, error: 'Credenciales Wompi no disponibles (privateKey ausente).' };
    }

    try {
        const res = await fetch(`${baseUrlFor(c)}/transactions/${transactionId}/void`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${c.privateKey}`,
            },
        });
        if (!res.ok) {
            const errBody = await res.text();
            return { ok: false, error: `Wompi void failed: ${errBody}` };
        }
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err.message || 'Wompi void error' };
    }
}

/**
 * Mapea el status de Wompi al status interno de SportMaps.
 *  APPROVED → 'paid'
 *  DECLINED → 'rejected'
 *  VOIDED   → 'refunded'
 *  ERROR    → 'failed'
 *  PENDING  → 'pending'
 */
export function mapWompiStatus(wompiStatus: string): 'paid' | 'rejected' | 'refunded' | 'failed' | 'pending' {
    const map: Record<string, ReturnType<typeof mapWompiStatus>> = {
        APPROVED: 'paid',
        DECLINED: 'rejected',
        VOIDED: 'refunded',
        ERROR: 'failed',
        PENDING: 'pending',
    };
    return map[wompiStatus] ?? 'pending';
}

/**
 * Convierte pesos colombianos a centavos (Wompi opera en cents).
 * Redondea para evitar problemas de floating point.
 */
export function copToCents(cop: number): number {
    return Math.round(cop * 100);
}

/**
 * Convierte centavos de Wompi a pesos colombianos.
 */
export function centsToCop(cents: number): number {
    return Math.round(cents) / 100;
}

/**
 * Verifica que el usuario no tenga pagos en revision pendiente.
 *
 * Politica de negocio: si CUALQUIER pago del usuario fallo (DECLINED/ERROR/VOIDED)
 * y aun no fue destrabado por el negocio (admin/school owner/vendor), se bloquea
 * cualquier nuevo intento de checkout en cualquier flujo (escuela, marketplace, cart).
 *
 * Lanza UserPaymentBlockedError si esta bloqueado; pasa silenciosamente si esta libre.
 */
import { supabase } from '../config/supabase';

export class UserPaymentBlockedError extends Error {
    code = 'USER_PAYMENT_BLOCKED';
    details: any;
    constructor(details: any) {
        super('Tienes pagos pendientes de revision por el negocio. Contacta al administrador para destrabar.');
        this.details = details;
    }
}

export async function assertUserNotBlocked(userId: string): Promise<void> {
    const { data, error } = await supabase.rpc('is_user_payment_blocked', { p_user_id: userId });

    if (error) {
        // Falla cerrada no es ideal pero falla abierta tampoco. Loggear y permitir,
        // que el bloqueo es defense-in-depth — el webhook tambien valida.
        console.warn('[wompi.service] is_user_payment_blocked RPC failed:', error.message);
        return;
    }

    if (data?.blocked === true) {
        throw new UserPaymentBlockedError(data);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wompi recurrente con payment_source — flujo MIT (Merchant Initiated Tx)
//
// Docs: https://docs.wompi.co/docs/colombia/fuentes-de-pago/
//
// 3 pasos:
//   A. fetchAcceptanceTokens()           — GET /merchants/info (JWT Habeas Data)
//   B. createPaymentSource(...)          — POST /v1/payment_sources (ID permanente)
//   C. createTransactionWithPaymentSource — POST /v1/transactions con recurrent:true
//
// Importante:
//   - Acceptance tokens: JWT de 1 h y de UN SOLO USO (verificado en sandbox
//     2026-10-05: reusar uno en POST /payment_sources o en un pago normal da 422
//     "El token de aceptación ya fue usado"). NO se cachean: cada usuario pide
//     los suyos, los ve y los acepta. El cobro con payment_source_id no los exige.
//   - Se piden a GET /merchants/info con header x-merchant-public-key; el
//     GET /merchants/:pub se apaga el 2026-10-31.
//   - payment_source_id es entero permanente; se guarda en
//     payment_tokens.provider_payment_source_id.
//   - recurrent:true (COF / Credential On File) solo aplica a VISA/MC con RBM.
//     Sin este flag, el banco emisor puede declinar el cobro MIT.
// ─────────────────────────────────────────────────────────────────────────────

interface AcceptanceTokens {
    acceptanceToken: string;
    personalDataAuthToken: string;
    acceptancePermalink: string;
    personalDataPermalink: string;
    fetchedAt: number;
}

/**
 * GET /merchants/info del comercio dueño de `publicKey`. Reemplaza a
 * GET /merchants/:pub (Wompi lo apaga el 2026-10-31). Sin caché: los tokens de
 * aceptación son de un solo uso, compartirlos entre usuarios hace fallar al segundo.
 */
async function fetchMerchantInfo(baseUrl: string, publicKey: string): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
    const res = await fetch(`${baseUrl}/merchants/info`, {
        headers: { 'x-merchant-public-key': publicKey, Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, error: `merchants/info ${res.status}` };
    const json = await res.json().catch(() => null);
    if (!json?.data) return { ok: false, error: 'merchants/info sin data' };
    return { ok: true, data: json.data };
}

/**
 * Obtiene los dos JWT de aceptacion (Habeas Data + politica) desde Wompi.
 * Los dos son requeridos al crear payment_source y transactions con datos
 * personales del usuario.
 *
 * Sin caché: son de un solo uso y cada usuario debe aceptar los suyos
 * (verificado en sandbox 2026-10-05).
 */
export async function fetchAcceptanceTokens(
    creds?: WompiCreds,
): Promise<{ ok: true; tokens: AcceptanceTokens } | { ok: false; error: string }> {
    const publicKey = creds ? creds.publicKey : process.env.WOMPI_PUBLIC_KEY;
    if (!publicKey) return { ok: false, error: 'WOMPI_PUBLIC_KEY no configurado' };

    try {
        const info = await fetchMerchantInfo(baseUrlFor(creds), publicKey);
        if (!info.ok) return info;
        const presigned = info.data.presigned_acceptance;
        const personal = info.data.presigned_personal_data_auth;
        if (!presigned?.acceptance_token || !personal?.acceptance_token) {
            return { ok: false, error: 'missing_acceptance_tokens_in_merchant_response' };
        }
        const tokens: AcceptanceTokens = {
            acceptanceToken: presigned.acceptance_token,
            personalDataAuthToken: personal.acceptance_token,
            acceptancePermalink: presigned.permalink ?? '',
            personalDataPermalink: personal.permalink ?? '',
            fetchedAt: Date.now(),
        };
        return { ok: true, tokens };
    } catch (err: any) {
        return { ok: false, error: err.message || 'fetchAcceptanceTokens error' };
    }
}

/**
 * Crea un payment_source permanente a partir de un token efimero de tarjeta.
 * El token efimero (`tok_prod_...`) viene del Widget tras un cobro exitoso
 * o de POST /v1/tokens/cards. El payment_source_id (entero) que devolvemos
 * se guarda en payment_tokens.provider_payment_source_id y sirve para
 * cobros MIT indefinidamente (hasta que la tarjeta expire o sea void).
 *
 * Requiere los DOS acceptance_tokens — pasarselos desde pending_card_saves
 * (los que el usuario vio y acepto en el modal).
 */
export async function createPaymentSource(params: {
    cardToken: string;                  // tok_prod_... efimero
    customerEmail: string;
    acceptanceToken: string;
    personalDataAuthToken: string;
    type?: 'CARD' | 'NEQUI' | 'DAVIPLATA' | 'BANCOLOMBIA_TRANSFER';
}, creds?: WompiCreds): Promise<{ ok: true; paymentSourceId: number; status: string } | { ok: false; error: string; statusCode?: number }> {
    const c = resolveCreds(creds);
    if (!c) return { ok: false, error: 'Credenciales Wompi no disponibles (privateKey ausente)' };

    try {
        const res = await fetch(`${baseUrlFor(c)}/payment_sources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${c.privateKey}`,
            },
            body: JSON.stringify({
                type: params.type ?? 'CARD',
                token: params.cardToken,
                customer_email: params.customerEmail,
                acceptance_token: params.acceptanceToken,
                accept_personal_auth: params.personalDataAuthToken,
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            return { ok: false, statusCode: res.status, error: `payment_source_failed: ${sanitizeWompiErrorBody(errBody).slice(0, 300)}` };
        }

        const json = await res.json();
        const data = json?.data;
        if (!data?.id || typeof data.id !== 'number') {
            return { ok: false, error: 'no_payment_source_id_in_response' };
        }

        return { ok: true, paymentSourceId: data.id, status: data.status ?? 'AVAILABLE' };
    } catch (err: any) {
        return { ok: false, error: err.message || 'createPaymentSource error' };
    }
}

/**
 * Cobra usando un payment_source_id permanente (MIT / cobro recurrente).
 *
 * Diferencia clave vs createTransactionWithToken:
 *   - Manda `payment_source_id` (entero) en lugar de `payment_method.token`.
 *   - Manda `recurrent: true` — flag COF (Credential On File). Sin esto, el
 *     banco emisor puede declinar como "transaccion no autorizada".
 *
 * Maneja el caso 422 "reference already exists" (idempotencia anti
 * doble-click / re-fire del cron): busca la tx original y devuelve SU estado.
 */
export async function createTransactionWithPaymentSource(params: {
    paymentSourceId: number;
    amountInCents: number;
    reference: string;
    customerEmail: string;
    installments?: number;
}, creds?: WompiCreds): Promise<{ ok: true; transactionId: string; status: string } | { ok: false; error: string; statusCode?: number }> {
    const c = resolveCreds(creds);
    if (!c) return { ok: false, error: 'Credenciales Wompi no disponibles (privateKey ausente)' };

    try {
        // Firma con el integrity secret del MISMO comercio que autoriza el cobro.
        const signature = signIntegrity({
            reference: params.reference,
            amountInCents: params.amountInCents,
        }, creds);

        const res = await fetch(`${baseUrlFor(c)}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${c.privateKey}`,
            },
            body: JSON.stringify({
                amount_in_cents: params.amountInCents,
                currency: 'COP',
                signature,
                customer_email: params.customerEmail,
                reference: params.reference,
                payment_source_id: params.paymentSourceId,
                payment_method: { installments: params.installments ?? 1 },
                recurrent: true,
            }),
        });

        // Idempotencia: si reference ya existe (422), buscar tx original.
        if (res.status === 422) {
            const errBody = await res.text();
            const isDupRef = errBody.includes('reference') && /already|duplicat|exists/i.test(errBody);
            if (isDupRef) {
                const existing = await fetchTransactionByReference(params.reference, creds);
                if (existing) {
                    return { ok: true, transactionId: existing.id, status: existing.status };
                }
            }
            return { ok: false, statusCode: 422, error: `validation: ${sanitizeWompiErrorBody(errBody).slice(0, 300)}` };
        }

        if (!res.ok) {
            const errBody = await res.text();
            return { ok: false, statusCode: res.status, error: `tx_failed: ${sanitizeWompiErrorBody(errBody).slice(0, 300)}` };
        }

        const json = await res.json();
        const tx = json?.data;
        if (!tx?.id) return { ok: false, error: 'no_tx_id_in_response' };

        return { ok: true, transactionId: tx.id, status: tx.status };
    } catch (err: any) {
        return { ok: false, error: err.message || 'createTransactionWithPaymentSource error' };
    }
}

/**
 * Busca una transaccion por reference (no por id). Wompi expone esto en
 * GET /v1/transactions?reference=... — usado para reconciliar cuando un
 * 422 "duplicate reference" nos hace pensar que ya cobramos.
 */
async function fetchTransactionByReference(
    reference: string,
    creds?: WompiCreds,
): Promise<{ id: string; status: string } | null> {
    try {
        const res = await fetch(`${baseUrlFor(creds)}/transactions?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) return null;
        const json = await res.json();
        const arr = Array.isArray(json?.data) ? json.data : [];
        if (arr.length === 0) return null;
        // Si hay varias (raro), preferir APPROVED, luego PENDING
        const approved = arr.find((t: any) => t.status === 'APPROVED');
        const pending = arr.find((t: any) => t.status === 'PENDING');
        const pick = approved ?? pending ?? arr[0];
        return { id: pick.id, status: pick.status };
    } catch {
        return null;
    }
}

/**
 * Desactiva un payment_source en Wompi (PUT /v1/payment_sources/:id/void).
 * Lo llamamos al borrar la tarjeta para que el provider tampoco la pueda
 * usar — defense-in-depth si nuestro RLS o backend fallaran.
 */
export async function voidPaymentSource(
    paymentSourceId: number,
    creds?: WompiCreds,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const c = resolveCreds(creds);
    if (!c) return { ok: false, error: 'Credenciales Wompi no disponibles (privateKey ausente)' };

    try {
        const res = await fetch(`${baseUrlFor(c)}/payment_sources/${paymentSourceId}/void`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${c.privateKey}`,
            },
            body: JSON.stringify({ status: 'VOIDED' }),
        });
        if (!res.ok) {
            const errBody = await res.text();
            return { ok: false, error: `void_failed: ${sanitizeWompiErrorBody(errBody).slice(0, 200)}` };
        }
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err.message || 'voidPaymentSource error' };
    }
}

/**
 * Crea una transaccion en Wompi usando un token previamente capturado.
 * Usado por el cron de auto-cobro para suscripciones con autopay.
 *
 * @deprecated para autopay — usar createTransactionWithPaymentSource. Esta
 * funcion sigue para flujos one-shot legacy / fallback.
 *
 * Wompi flow para "merchant initiated transactions":
 *  1. Obtener acceptance_token desde GET /merchants/info
 *  2. POST /transactions con payment_method.type='CARD', token=<tokenized>, customer_email, ...
 */
export async function createTransactionWithToken(params: {
    paymentToken: string;
    amountInCents: number;
    reference: string;
    customerEmail: string;
    paymentMethodType?: string;     // CARD por defecto
}, creds?: WompiCreds): Promise<{ ok: true; transactionId: string; status: string } | { ok: false; error: string }> {
    const c = resolveCreds(creds);
    if (!c) {
        return { ok: false, error: 'WOMPI keys not configured' };
    }
    const baseUrl = baseUrlFor(c);

    try {
        // 1. Obtener acceptance_token (Wompi requiere este token de "aceptación de TyC")
        const info = await fetchMerchantInfo(baseUrl, c.publicKey);
        if (!info.ok) {
            return { ok: false, error: `merchants endpoint failed (${info.error})` };
        }
        const acceptanceToken = info.data?.presigned_acceptance?.acceptance_token;
        if (!acceptanceToken) {
            return { ok: false, error: 'no_acceptance_token' };
        }

        // 2. Generar firma de integridad (mismo comercio que autoriza)
        const signature = signIntegrity({
            reference: params.reference,
            amountInCents: params.amountInCents,
        }, creds);

        // 3. Crear transaccion server-to-server
        const txRes = await fetch(`${baseUrl}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${c.privateKey}`,
            },
            body: JSON.stringify({
                acceptance_token: acceptanceToken,
                amount_in_cents: params.amountInCents,
                currency: 'COP',
                signature,
                customer_email: params.customerEmail,
                reference: params.reference,
                payment_method: {
                    type: params.paymentMethodType ?? 'CARD',
                    token: params.paymentToken,
                    installments: 1,
                },
            }),
        });

        if (!txRes.ok) {
            const errBody = await txRes.text();
            return { ok: false, error: `wompi_tx_failed: ${sanitizeWompiErrorBody(errBody).slice(0, 300)}` };
        }

        const txJson = await txRes.json();
        const tx = txJson?.data;
        if (!tx?.id) {
            return { ok: false, error: 'no_tx_id_in_response' };
        }

        return { ok: true, transactionId: tx.id, status: tx.status };
    } catch (err: any) {
        return { ok: false, error: err.message || 'createTransactionWithToken error' };
    }
}

// ─── Web Checkout por URL: link con el monto ya puesto ─────────────────────────
//
// Wompi Web Checkout (docs.wompi.co/docs/colombia/widget-checkout-web, verificado
// 2026-10-06): un GET a https://checkout.wompi.co/p/ con public-key, currency,
// amount-in-cents, reference y signature:integrity (obligatorios) + redirect-url
// y expiration-time (opcionales). El monto va firmado: si alguien lo cambia en la
// URL, Wompi rechaza la firma. La misma URL sirve para sandbox y producción (lo
// decide la llave pública). Solo necesita la llave pública y el secreto de
// integridad; la privada no. A diferencia de POST /v1/payment_links, la
// transacción conserva NUESTRA referencia (SCH-*), así que el webhook la concilia
// por payment_links.wompi_reference sin nada nuevo.

export const WOMPI_WEB_CHECKOUT_URL = 'https://checkout.wompi.co/p/';

/**
 * Firma de integridad con fecha de expiración. Según la doc, con
 * `expiration-time` se concatena: referencia + monto + moneda + expiración + secreto.
 * `expirationTime` debe ser EXACTAMENTE el valor que va en la URL (ISO 8601 UTC,
 * p.ej. 2023-06-09T20:28:50.000Z).
 */
export function signIntegrityWithExpiration(
    payload: WompiSignaturePayload & { expirationTime: string },
    creds: WompiCreds,
): string {
    if (!creds.integritySecret) {
        throw new Error('La cuenta Wompi no tiene integrity_secret: no se puede firmar el checkout.');
    }
    const { reference, amountInCents, currency = 'COP', expirationTime } = payload;
    return crypto
        .createHash('sha256')
        .update(`${reference}${amountInCents}${currency}${expirationTime}${creds.integritySecret}`)
        .digest('hex');
}

/**
 * URL de Web Checkout con monto fijo. Los nombres de parámetro llevan ':' tal
 * cual (signature:integrity), por eso no se usa URLSearchParams, que lo codifica.
 */
export function buildWebCheckoutUrl(p: {
    publicKey: string;
    reference: string;
    amountInCents: number;
    signature: string;
    currency?: string;
    expirationTime?: string | null;
    redirectUrl?: string | null;
}): string {
    const partes: [string, string][] = [
        ['public-key', p.publicKey],
        ['currency', p.currency ?? 'COP'],
        ['amount-in-cents', String(p.amountInCents)],
        ['reference', p.reference],
        ['signature:integrity', p.signature],
    ];
    if (p.expirationTime) partes.push(['expiration-time', p.expirationTime]);
    if (p.redirectUrl) partes.push(['redirect-url', p.redirectUrl]);
    return WOMPI_WEB_CHECKOUT_URL + '?' + partes.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}
