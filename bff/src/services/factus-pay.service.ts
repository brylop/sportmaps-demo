/**
 * factus-pay.service — Recaudo por QR con Factus Pay (DIN-23).
 *
 * Factus Pay es un producto distinto de Factus facturación (api.factus.com.co /v1/bills):
 *  - Sandbox: https://pay-api-sandbox.factus.com.co · Producción: https://pay-api.factus.com.co
 *  - `POST /v1/collections {reference_code, amount}` crea el recaudo y devuelve el QR
 *    (data:image/png base64) con `qr_expires_at` (~24 h). `GET /v1/collections/:ref` lo consulta.
 *
 * Reglas validadas contra el sandbox (2026-10-05), no de la documentación:
 *  - Montos en PESOS enteros (no centavos). Mínimo 10.000, máximo 12.000.000.
 *  - Idempotente por `reference_code` SOLO si el monto es el mismo: misma referencia con
 *    otro monto → 422 "La referencia ya existe con un monto diferente".
 *  - En los 422 de validación `errors` llega partido letra por letra → leer `message`.
 *  - No hay webhook documentado: el estado se consulta (polling).
 *
 * TOKEN: `POST /auth` revoca el token anterior y el token no vence. El BFF NUNCA llama a
 * /auth: el token se genera una vez a mano y llega por config (ENV para la cuenta de
 * SportMaps; más adelante, la cuenta de cada escuela). Si cada BFF se autenticara solo,
 * los 3 ambientes se tumbarían el token entre ellos.
 *
 * La cuenta de Factus Pay de SportMaps recauda para SportMaps: sirve para la facturación
 * SaaS. Mensualidades de acudientes → cuenta de la escuela (D-FPAY), nunca esta.
 */

export const FACTUS_PAY_MIN_AMOUNT = 10_000;
export const FACTUS_PAY_MAX_AMOUNT = 12_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface FactusPayConfig {
    baseUrl: string;
    token: string;
}

/** Estado crudo de Factus: started → ready → paid | failed | rejected. */
export type FactusPayRawStatus = 'started' | 'ready' | 'paid' | 'failed' | 'rejected';

/** Estado normalizado para conciliar contra nuestras tablas. */
export type FactusPayStatus = 'pending' | 'paid' | 'failed';

export interface FactusPayCollection {
    referenceCode: string;
    amount: number;
    rawStatus: string;
    status: FactusPayStatus;
    createdAt: string | null;
    qrDataUrl: string | null;
    qrExpiresAt: string | null;
}

export type FactusPayResult<T> =
    | { ok: true; data: T; alreadyExisted?: boolean }
    | { ok: false; error: FactusPayError };

export interface FactusPayError {
    code: 'not_configured' | 'invalid_amount' | 'invalid_reference' | 'reference_amount_mismatch'
        | 'not_found' | 'unauthorized' | 'validation' | 'http' | 'network';
    message: string;
    httpStatus?: number;
}

/** Config de la cuenta de SportMaps (ENV). null si falta algo → el llamador decide (fail-closed). */
export function factusPayEnvConfig(env: NodeJS.ProcessEnv = process.env): FactusPayConfig | null {
    const baseUrl = env.FACTUS_PAY_BASE_URL?.trim();
    const token = env.FACTUS_PAY_TOKEN?.trim();
    if (!baseUrl || !token) return null;
    return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

export function mapFactusPayStatus(raw: string | null | undefined): FactusPayStatus {
    switch ((raw ?? '').toLowerCase()) {
        case 'paid': return 'paid';
        case 'failed':
        case 'rejected': return 'failed';
        default: return 'pending'; // started, ready y cualquier estado nuevo que no conozcamos
    }
}

/** Valida monto en pesos enteros dentro del rango de Factus Pay. */
export function validateFactusPayAmount(amount: number): FactusPayError | null {
    if (!Number.isInteger(amount)) {
        return { code: 'invalid_amount', message: 'El monto debe ser un entero en pesos (no centavos).' };
    }
    if (amount < FACTUS_PAY_MIN_AMOUNT || amount > FACTUS_PAY_MAX_AMOUNT) {
        return {
            code: 'invalid_amount',
            message: `El monto debe estar entre ${FACTUS_PAY_MIN_AMOUNT} y ${FACTUS_PAY_MAX_AMOUNT} pesos.`,
        };
    }
    return null;
}

function toCollection(d: any): FactusPayCollection {
    return {
        referenceCode: String(d?.reference_code ?? ''),
        amount: Number(d?.amount ?? 0),
        rawStatus: String(d?.status ?? ''),
        status: mapFactusPayStatus(d?.status),
        createdAt: d?.created_at ?? null,
        qrDataUrl: d?.qr ?? null,
        qrExpiresAt: d?.qr_expires_at ?? null,
    };
}

async function request(
    config: FactusPayConfig | null,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; status: number; json: any } | { ok: false; error: FactusPayError }> {
    if (!config) return { ok: false, error: { code: 'not_configured', message: 'Factus Pay no está configurado.' } };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
        const res = await fetchImpl(`${config.baseUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${config.token}`,
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        return { ok: true, status: res.status, json };
    } catch (err: any) {
        return {
            ok: false,
            error: { code: 'network', message: err?.name === 'AbortError' ? 'Factus Pay no respondió a tiempo.' : 'Error de red con Factus Pay.' },
        };
    } finally {
        clearTimeout(timer);
    }
}

function httpError(status: number, json: any): FactusPayError {
    // `message` es lo único fiable: `errors` llega partido letra por letra.
    const message = typeof json?.message === 'string' ? json.message : `Factus Pay respondió ${status}.`;
    if (status === 401 || status === 403) return { code: 'unauthorized', message, httpStatus: status };
    if (status === 404) return { code: 'not_found', message, httpStatus: status };
    if (status === 422 && /monto diferente/i.test(message)) {
        return { code: 'reference_amount_mismatch', message, httpStatus: status };
    }
    if (status === 422) return { code: 'validation', message, httpStatus: status };
    return { code: 'http', message, httpStatus: status };
}

/**
 * Crea (o recupera, si ya existe con el mismo monto) el recaudo de `referenceCode`.
 * Si el monto del cobro cambió hace falta una referencia NUEVA (`reference_amount_mismatch`).
 */
export async function createCollection(
    config: FactusPayConfig | null,
    params: { referenceCode: string; amount: number },
    fetchImpl: typeof fetch = fetch,
): Promise<FactusPayResult<FactusPayCollection>> {
    const amountErr = validateFactusPayAmount(params.amount);
    if (amountErr) return { ok: false, error: amountErr };
    const ref = params.referenceCode?.trim();
    if (!ref) return { ok: false, error: { code: 'invalid_reference', message: 'Falta la referencia del recaudo.' } };

    const r = await request(config, 'POST', '/v1/collections', { reference_code: ref, amount: params.amount }, fetchImpl);
    if (!r.ok) return r;
    if (r.status !== 200 && r.status !== 201) return { ok: false, error: httpError(r.status, r.json) };
    if (!r.json?.data) return { ok: false, error: { code: 'http', message: 'Respuesta de Factus Pay sin datos.', httpStatus: r.status } };

    return {
        ok: true,
        data: toCollection(r.json.data),
        alreadyExisted: /ya existente/i.test(String(r.json?.message ?? '')),
    };
}

export async function getCollection(
    config: FactusPayConfig | null,
    referenceCode: string,
    fetchImpl: typeof fetch = fetch,
): Promise<FactusPayResult<FactusPayCollection>> {
    const ref = referenceCode?.trim();
    if (!ref) return { ok: false, error: { code: 'invalid_reference', message: 'Falta la referencia del recaudo.' } };

    const r = await request(config, 'GET', `/v1/collections/${encodeURIComponent(ref)}`, undefined, fetchImpl);
    if (!r.ok) return r;
    if (r.status !== 200) return { ok: false, error: httpError(r.status, r.json) };
    if (!r.json?.data) return { ok: false, error: { code: 'not_found', message: 'Recaudo no encontrado.', httpStatus: r.status } };
    return { ok: true, data: toCollection(r.json.data) };
}
