// MercadoPago Payment Gateway Integration Service
//
// MP usa flujo distinto a Wompi:
//  - El BFF retorna { provider, publicKey, sandbox, reference, transactionAmount }
//  - El frontend renderiza el Brick `<Payment />` con esa publicKey.
//  - El Brick devuelve { token, paymentMethodId, installments, payer } al onSubmit.
//  - El frontend llama POST /api/v1/payments/mp/create con el token.
//  - El BFF llama a MP API y retorna el status.

import type { PaymentProvider } from '@/types/payments';

export interface MpInitData {
    provider: 'mercadopago';
    publicKey: string;
    sandbox: boolean;
    reference: string;            // external_reference
    transactionAmount: number;    // COP decimal (no cents)
    payerEmail?: string;
    schoolId?: string | null;
    vendorId?: string | null;
}

export interface MpIdentification {
    type: 'CC' | 'CE' | 'NIT' | 'PAS' | string;
    number: string;
}

export interface MpItemInput {
    id: string;
    title: string;
    description?: string;
    categoryId?: string;
    quantity?: number;
    unitPrice?: number;
}

export interface MpCreatePaymentPayload {
    token: string;
    paymentMethodId: string;
    installments?: number;
    payerEmail: string;
    payerFirstName?: string;
    payerLastName?: string;
    /** Sube tasa de aprobacion: MP recomienda enviar identificacion del payer. */
    payerIdentification?: MpIdentification;
    transactionAmount: number;
    description?: string;
    externalReference: string;
    schoolId?: string | null;
    vendorId?: string | null;
    metadata?: Record<string, unknown>;
    /** items detallados para additional_info (sube tasa de aprobacion). */
    items?: MpItemInput[];
    /** texto en extracto del payer (max 22 chars). Default: 'SPORTMAPS'. */
    statementDescriptor?: string;
}

export interface MpCreatePaymentResult {
    paymentId: number;
    status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded';
    statusDetail: string;
    internalStatus: 'paid' | 'rejected' | 'refunded' | 'failed' | 'pending';
    externalReference: string;
}

export interface ProvidersResponse {
    providers: Array<{
        provider: PaymentProvider;
        publicKey: string;
        sandbox: boolean;
        isDefault: boolean;
    }>;
}

const BFF_URL = import.meta.env.VITE_BFF_URL ?? '';

// /create y /save-card mutan tarjeta/cobro → el BFF exige requireAuth + este
// header anti-CSRF (mismo patrón que payment-tokens/recurring).
const CSRF_HEADERS = { 'X-Requested-With': 'SportMaps' };

/**
 * Lista los providers disponibles para una escuela / vendor / marketplace.
 * Usado por el PaymentProviderGate para decidir si mostrar selector o ir directo.
 */
export async function listAvailableProviders(params: {
    schoolId?: string | null;
    vendorId?: string | null;
    authToken?: string;
}): Promise<ProvidersResponse> {
    const search = new URLSearchParams();
    if (params.schoolId) search.set('schoolId', params.schoolId);
    if (params.vendorId) search.set('vendorId', params.vendorId);

    const url = `${BFF_URL}/api/v1/payments/mp/providers?${search.toString()}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.authToken) headers.Authorization = `Bearer ${params.authToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`Error listing providers: ${res.status}`);
    }
    return res.json();
}

/**
 * Crea el payment en MercadoPago llamando al BFF.
 * El BFF resuelve access_token, llama a MP API, y retorna { paymentId, status }.
 */
export async function createMpPayment(
    payload: MpCreatePaymentPayload,
    authToken?: string,
): Promise<MpCreatePaymentResult> {
    const url = `${BFF_URL}/api/v1/payments/mp/create`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...CSRF_HEADERS };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`MP create payment failed (${res.status}): ${errBody.slice(0, 300)}`);
    }
    return res.json();
}

/**
 * Guarda una tarjeta tokenizada en MP customer para autopay.
 */
export async function saveMpCard(
    payload: {
        cardToken: string;
        payerEmail: string;
        userId: string;
        schoolId?: string | null;
        vendorId?: string | null;
        setDefault?: boolean;
    },
    authToken?: string,
): Promise<{ ok: boolean; tokenId?: string; lastFour?: string; brand?: string }> {
    const url = `${BFF_URL}/api/v1/payments/mp/save-card`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...CSRF_HEADERS };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`MP save card failed (${res.status}): ${errBody.slice(0, 300)}`);
    }
    return res.json();
}

/**
 * Mapea el status de MP a un estado interno consumible por la UI.
 */
export function mpStatusLabel(status: string): { label: string; color: 'green' | 'yellow' | 'red' | 'gray' } {
    const s = status.toLowerCase();
    if (s === 'approved') return { label: 'Aprobado', color: 'green' };
    if (s === 'pending' || s === 'in_process') return { label: 'En proceso', color: 'yellow' };
    if (s === 'rejected' || s === 'cancelled') return { label: 'Rechazado', color: 'red' };
    if (s === 'refunded' || s === 'charged_back') return { label: 'Reembolsado', color: 'gray' };
    return { label: status, color: 'gray' };
}
