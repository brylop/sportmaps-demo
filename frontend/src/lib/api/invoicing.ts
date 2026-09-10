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
    /**
     * Motivo que devolvió el PAC / la DIAN cuando la factura no salió.
     *
     * Se guarda en `electronic_invoices.error_message` desde siempre, pero el
     * endpoint no lo devolvía y la tabla no lo pintaba: por eso una factura
     * rechazada se veía igual que cualquier otra y las rechazadas se
     * acumularon sin que nadie se enterara. Opcional en el tipo porque el
     * backend que lo devuelve puede no estar desplegado todavía.
     */
    error_message?: string | null;
    /** Nuestro identificador del documento (`SM-<paymentId>`): con esto el PAC lo encuentra en soporte. */
    reference_code?: string | null;
}

export interface SaveProviderBody {
    provider: string;
    credentials: Record<string, any>;
    config: Record<string, any>;
    sandbox?: boolean;
    isDefault?: boolean;
    enabled?: boolean;
}

// ─── Backfill (emisión del rezago) ──────────────────────────────────────────

/**
 * Rango a emitir. `from`/`to` son días en formato ISO (`YYYY-MM-DD`), ambos
 * inclusive, y se comparan contra `payments.payment_date` igual que el barrido
 * automático.
 *
 * `limit` es el tope duro de documentos a emitir en la corrida. NO es
 * paginación: es el freno de mano de una operación irreversible (cada
 * documento consume un número de la resolución DIAN y todavía no existen
 * notas crédito), y sirve para hacer una corrida de prueba con 1.
 */
export interface BackfillInvoicesBody {
    ownerType: OwnerType;
    ownerId: string;
    from: string;
    to: string;
    limit: number;
}

/** Tope de documentos por llamada que acepta el BFF (`BACKFILL_MAX_LIMIT`). */
export const BACKFILL_MAX_LIMIT = 200;
/** Ventana máxima del rango que acepta el BFF (`BACKFILL_MAX_DAYS`). */
export const BACKFILL_MAX_DAYS = 92;

/** Qué pasó con UN pago de la corrida. */
export interface BackfillDetail {
    /**
     * Vacío en las entradas AGREGADAS: el BFF resume los que ya tenían factura
     * en una sola línea (`reason: 'already_invoiced:<n>'`, sin paymentId).
     */
    paymentId: string;
    outcome: 'emitted' | 'skipped' | 'failed';
    /** Código de la razón (`customer_missing_fiscal_data`, `payment_without_payer`, …) o mensaje del PAC. */
    reason?: string | null;
    invoiceId?: string | null;
    status?: string | null;
    /** Avisos que no impidieron emitir, p. ej. que se usó el municipio del emisor. */
    warnings?: string[] | null;
}

export interface BackfillInvoicesResult {
    /** emitted + skipped + failed: todo pago sobre el que se decidió algo. */
    attempted: number;
    emitted: number;
    skipped: number;
    failed: number;
    details: BackfillDetail[];
    /** Pagos que el rango encontró antes de aplicar el tope. */
    scanned: number;
    /** true si el tope recortó: quedan pagos del rango sin tocar y hay que volver a correr. */
    truncated: boolean;
}

/**
 * El `details` que llega puede venir en snake_case según cómo lo construya el
 * BFF; el contrato entre carriles fijó el nivel de arriba
 * (`attempted/emitted/skipped/failed/details`), no el nombre de cada campo de
 * adentro. Normalizar acá cuesta diez líneas y evita que la pantalla muestre
 * "undefined" si el backend eligió la otra convención.
 */
function normalizeDetail(raw: any): BackfillDetail {
    const outcome = String(raw?.outcome ?? raw?.result ?? 'failed');
    return {
        paymentId: String(raw?.paymentId ?? raw?.payment_id ?? ''),
        outcome: outcome === 'emitted' || outcome === 'skipped' ? outcome : 'failed',
        reason: raw?.reason ?? raw?.error ?? raw?.error_message ?? null,
        invoiceId: raw?.invoiceId ?? raw?.invoice_id ?? null,
        status: raw?.status ?? null,
        warnings: Array.isArray(raw?.warnings) ? raw.warnings.map(String) : null,
    };
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

    /**
     * Emite el rezago de un rango de fechas.
     *
     * POR QUÉ existe: el barrido automático (`autoEmitPendingInvoices`) mira
     * solo los últimos 3 días, así que un pago registrado a mano una semana
     * después NUNCA se factura solo. Sin esta vía no hay forma de producto de
     * emitir un mes cerrado, y `emit` (pago por pago) no tenía ni un llamador.
     *
     * Idempotente por diseño: el motor devuelve temprano para los pagos que ya
     * tienen factura en 'accepted' o 'sent', así que volver a correr el mismo
     * rango no duplica documentos.
     */
    backfill: async ({ ownerType, ownerId, ...rango }: BackfillInvoicesBody): Promise<BackfillInvoicesResult> => {
        const raw = await bffClient.post<any>(
            `/api/v1/invoicing/backfill/${ownerType}/${ownerId}`,
            rango,
        );
        return {
            attempted: Number(raw?.attempted ?? 0),
            emitted: Number(raw?.emitted ?? 0),
            skipped: Number(raw?.skipped ?? 0),
            failed: Number(raw?.failed ?? 0),
            details: Array.isArray(raw?.details) ? raw.details.map(normalizeDetail) : [],
            scanned: Number(raw?.scanned ?? 0),
            truncated: raw?.truncated === true,
        };
    },

    byPayment: (paymentId: string) =>
        bffClient.get<{ invoice: InvoiceRow & { qr_url?: string; qr_image?: string; owner_type: string; owner_id: string } }>(
            `/api/v1/invoicing/by-payment/${paymentId}`,
        ),
};
