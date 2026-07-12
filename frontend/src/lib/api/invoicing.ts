/**
 * invoicing (frontend) — cliente de la API de facturación electrónica del BFF.
 *
 * Multi-owner: todas las rutas reciben ownerType/ownerId, así sirve para
 * school, vendor (coach/tienda/wellness) y organizer con el mismo código.
 * Las credenciales del PAC nunca vuelven en las respuestas (solo se envían).
 */

import { bffClient } from './bffClient';

export type OwnerType = 'school' | 'vendor' | 'organizer';

export interface InvoiceProviderRow {
    id: string;
    provider: string;
    config: Record<string, any>;
    sandbox: boolean;
    is_default: boolean;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface InvoiceRow {
    id: string;
    payment_id: string | null;
    provider: string;
    document_type: string;
    number: string | null;
    cufe: string | null;
    status: string;
    public_url: string | null;
    total: number | null;
    taxable_amount: number | null;
    tax_amount: number | null;
    validated_at: string | null;
    created_at: string;
}

export interface SaveProviderBody {
    provider: string;
    credentials: Record<string, any>;
    config: Record<string, any>;
    sandbox?: boolean;
    isDefault?: boolean;
    enabled?: boolean;
}

export const invoicingApi = {
    listProviders: (ownerType: OwnerType, ownerId: string) =>
        bffClient.get<{ providers: InvoiceProviderRow[]; supported: string[] }>(
            `/api/v1/invoicing/providers/${ownerType}/${ownerId}`,
        ),

    saveProvider: (ownerType: OwnerType, ownerId: string, body: SaveProviderBody) =>
        bffClient.post<{ provider: InvoiceProviderRow }>(
            `/api/v1/invoicing/providers/${ownerType}/${ownerId}`,
            body,
        ),

    deleteProvider: (id: string) =>
        bffClient.delete<{ ok: boolean }>(`/api/v1/invoicing/providers/${id}`),

    emit: (paymentId: string) =>
        bffClient.post<{ ok: boolean; invoiceId?: string; status?: string; error?: string }>(
            `/api/v1/invoicing/emit/${paymentId}`, {},
        ),

    listInvoices: (ownerType: OwnerType, ownerId: string) =>
        bffClient.get<{ invoices: InvoiceRow[] }>(
            `/api/v1/invoicing/invoices/${ownerType}/${ownerId}`,
        ),

    byPayment: (paymentId: string) =>
        bffClient.get<{ invoice: InvoiceRow & { qr_url?: string; qr_image?: string; owner_type: string; owner_id: string } }>(
            `/api/v1/invoicing/by-payment/${paymentId}`,
        ),
};
