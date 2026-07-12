/**
 * invoicing/types — contrato canónico de facturación electrónica (multi-PAC).
 *
 * SportMaps arma un InvoiceRequest canónico; cada facturador (Factus, Siigo,
 * Alegra, …) es un InvoicingAdapter que lo traduce a SU API. El resto del
 * sistema no conoce el PAC concreto. Agregar un facturador = implementar esta
 * interface y registrarlo en ./index.ts. CERO cambios de esquema (ver
 * migración 20260708000001).
 */

export type DocumentKind = 'invoice' | 'credit_note' | 'debit_note';

/** Datos fiscales del adquirente (el papá/atleta que paga). */
export interface InvoiceCustomer {
    documentType: string;             // CC | CE | NIT | PASAPORTE | TI | RC
    identification: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    department?: string | null;       // texto libre (profiles.billing_state_dane)
    city?: string | null;             // texto libre (profiles.billing_city_dane)
    municipalityId?: number | null;   // id del PAC si ya se resolvió
}

/** Una línea de la factura. unitPrice es IVA-incluido salvo isExcluded. */
export interface InvoiceLine {
    codeReference: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discountRate?: number;            // %
    taxRate: number;                  // 19 | 5 | 0
    isExcluded?: boolean;             // excluido de IVA (educación/deporte)
}

export interface InvoiceRequest {
    referenceCode: string;            // idempotencia (generado por nosotros)
    documentType: DocumentKind;
    customer: InvoiceCustomer;
    items: InvoiceLine[];
    observation?: string;
}

/** Resultado normalizado de cualquier PAC. raw → electronic_invoices.dian_response. */
export interface InvoiceResult {
    status: 'accepted' | 'rejected' | 'sent';
    providerBillId?: string | null;
    prefix?: string | null;
    number?: string | null;
    dianCode?: string | null;
    cufe?: string | null;
    qrUrl?: string | null;
    qrImage?: string | null;
    publicUrl?: string | null;
    pdfUrl?: string | null;
    xmlUrl?: string | null;
    taxableAmount?: number | null;
    taxAmount?: number | null;
    total?: number | null;
    validatedAt?: string | null;
    errorMessage?: string | null;
    raw: unknown;
}

/** Config resuelta desde electronic_invoice_providers (secretos, solo BFF). */
export interface ProviderConfig {
    provider: string;
    sandbox: boolean;
    credentials: Record<string, any>;  // Factus: {base_url?, client_id, client_secret, username, password}
    config: Record<string, any>;       // Factus: {numbering_range_id, default_municipality_id?, default_tax_rate?, tax_excluded?}
}

export interface InvoicingAdapter {
    readonly provider: string;
    emit(req: InvoiceRequest, cfg: ProviderConfig): Promise<InvoiceResult>;
}
