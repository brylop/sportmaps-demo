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
export function signIntegrity(payload: WompiSignaturePayload): string {
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
        throw new Error('WOMPI_INTEGRITY_SECRET no configurado en el BFF.');
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
export function validateWebhookChecksum(body: any): boolean {
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
    if (!eventsSecret) {
        console.error('[wompi.service] WOMPI_EVENTS_SECRET no configurado.');
        return false;
    }

    const signature = body?.signature;
    const timestamp = body?.timestamp;
    const data = body?.data;

    if (!signature?.checksum || !Array.isArray(signature?.properties)) {
        return false;
    }

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
    return signature.checksum === expected;
}

/**
 * Consulta el estado de una transaccion en la API de Wompi.
 * Util para:
 *  - Confirmar el monto en el webhook (defensa frente a webhook spoofing)
 *  - Polling desde paginas de resultado
 */
export async function fetchTransaction(transactionId: string): Promise<{
    id: string;
    status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
    reference: string;
    amount_in_cents: number;
    currency: string;
    payment_method_type: string;
    created_at: string;
} | null> {
    const env = (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase();
    const baseUrl = env === 'production' ? WOMPI_BASE_URL_PROD : WOMPI_BASE_URL_SANDBOX;

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
export async function voidTransaction(transactionId: string): Promise<{ ok: boolean; error?: string }> {
    const env = (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase();
    const baseUrl = env === 'production' ? WOMPI_BASE_URL_PROD : WOMPI_BASE_URL_SANDBOX;

    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!privateKey) {
        return { ok: false, error: 'WOMPI_PRIVATE_KEY no configurado.' };
    }

    try {
        const res = await fetch(`${baseUrl}/transactions/${transactionId}/void`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${privateKey}`,
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

/**
 * Crea una transaccion en Wompi usando un token previamente capturado.
 * Usado por el cron de auto-cobro para suscripciones con autopay.
 *
 * Wompi flow para "merchant initiated transactions":
 *  1. Obtener acceptance_token desde GET /merchants/:public_key
 *  2. POST /transactions con payment_method.type='CARD', token=<tokenized>, customer_email, ...
 */
export async function createTransactionWithToken(params: {
    paymentToken: string;
    amountInCents: number;
    reference: string;
    customerEmail: string;
    paymentMethodType?: string;     // CARD por defecto
}): Promise<{ ok: true; transactionId: string; status: string } | { ok: false; error: string }> {
    const env = (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase();
    const baseUrl = env === 'production' ? WOMPI_BASE_URL_PROD : WOMPI_BASE_URL_SANDBOX;
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const privateKey = process.env.WOMPI_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        return { ok: false, error: 'WOMPI keys not configured' };
    }

    try {
        // 1. Obtener acceptance_token (Wompi requiere este token de "aceptación de TyC")
        const merchRes = await fetch(`${baseUrl}/merchants/${publicKey}`);
        if (!merchRes.ok) {
            return { ok: false, error: `merchants endpoint failed (${merchRes.status})` };
        }
        const merchJson = await merchRes.json();
        const acceptanceToken = merchJson?.data?.presigned_acceptance?.acceptance_token;
        if (!acceptanceToken) {
            return { ok: false, error: 'no_acceptance_token' };
        }

        // 2. Generar firma de integridad
        const signature = signIntegrity({
            reference: params.reference,
            amountInCents: params.amountInCents,
        });

        // 3. Crear transaccion server-to-server
        const txRes = await fetch(`${baseUrl}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${privateKey}`,
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
            return { ok: false, error: `wompi_tx_failed: ${errBody.slice(0, 300)}` };
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
