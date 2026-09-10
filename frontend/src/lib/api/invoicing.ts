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
    /**
     * Rastro de la anulación (columnas de la migración 20260910092915).
     * Opcionales en el tipo porque el endpoint de listado puede no devolverlos
     * todavía: si no llegan, la tabla se sigue pintando y una anulada se ve
     * simplemente como «Anulada» sin el detalle.
     *
     * `voided_by_invoice_id` apunta a OTRA fila de esta misma lista: la que
     * tiene `document_type === 'credit_note'`. Ese enlace explícito existe
     * porque deducirlo por `payment_id` compartido se rompe en cuanto un pago
     * tiene más de un intento de facturación — que es justamente el caso que
     * lleva a anular.
     *
     * NULL con `status === 'void'` NO es un dato faltante: es el descarte local
     * de una factura que nunca llegó a la DIAN (rechazo terminal, sin número ni
     * CUFE), donde no hay nota crédito que emitir.
     */
    voided_at?: string | null;
    void_reason?: string | null;
    voided_by_invoice_id?: string | null;
}

// ─── Notas crédito (lo único que deshace una factura ya emitida) ────────────

/**
 * Concepto de corrección de la DIAN. Catálogo oficial completo, verificado en
 * developers.factus.com.co/notas-credito.
 *
 * Está duplicado del BFF (`bff/src/services/invoicing/types.ts`) porque el
 * frontend no puede importar de ahí, y se escribe COMPLETO aunque el caso común
 * sea el 2: los seis conceptos son fiscalmente distintos y el que factura tiene
 * que poder elegir. Si esta copia se desincroniza, el BFF valida el código
 * contra su propio catálogo y rechaza el que no exista — la copia de más nunca
 * llega a emitir un concepto inventado.
 */
export type CorrectionConceptCode = '1' | '2' | '3' | '4' | '5' | '6';

/** Redacción oficial de la DIAN, tal cual. La versión en lenguaje llano vive en el diálogo. */
export const CORRECTION_CONCEPTS: Record<CorrectionConceptCode, string> = {
    '1': 'Devolución parcial de los bienes y/o no aceptación parcial del servicio',
    '2': 'Anulación de factura electrónica',
    '3': 'Rebaja o descuento parcial o total',
    '4': 'Ajuste de precio',
    '5': 'Descuento comercial por pronto pago',
    '6': 'Descuento comercial por volumen de ventas',
};

/** El concepto que ANULA. Es el preseleccionado, no el único. */
export const CORRECTION_CONCEPT_ANULACION: CorrectionConceptCode = '2';

/** Tope de `observation` que acepta el API del PAC; el BFF además lo recorta. */
export const CREDIT_NOTE_OBSERVATION_MAX = 500;

/** Clave de `provider.config` donde vive el rango de numeración de notas crédito. */
export const CREDIT_NOTE_RANGE_KEY = 'credit_note_numbering_range_id';

/**
 * Rango de numeración de notas crédito del facturador, o null si no está.
 *
 * Es OTRO rango que el de facturas, con otro prefijo y otra resolución DIAN (en
 * el sandbox de Dynasty: 5224/SETP para facturas, 5225/NC para notas crédito), y
 * hoy **producción de Dynasty no lo tiene**: solo tiene el de facturas. Sin esta
 * clave no se puede anular nada, y eso no lo arregla el código — alguien tiene
 * que crear el rango en el portal del PAC.
 *
 * Se descarta la cadena vacía y cualquier cosa que no sean dígitos: es lo que
 * deja un input en blanco, y mandarla sería peor que no mandar nada (el PAC
 * caería a su rango por defecto, que es el de FACTURAS, y gastaría un número de
 * esa resolución en una nota crédito).
 */
export function creditNoteRangeId(provider: InvoiceProviderRow | null | undefined): string | null {
    const raw = provider?.config?.[CREDIT_NOTE_RANGE_KEY];
    if (raw == null) return null;
    const s = String(raw).trim();
    return s && /^\d+$/.test(s) ? s : null;
}

export interface VoidInvoiceBody {
    correctionConceptCode: CorrectionConceptCode;
    /** Va al `observation` de la nota crédito: es la copia que sobrevive del lado del PAC. */
    reason?: string;
}

/** La nota crédito que quedó emitida. Los datos con los que se la busca después. */
export interface CreditNoteIssued {
    number: string | null;
    cufe: string | null;
    publicUrl: string | null;
}

/**
 * Qué se hizo DE VERDAD. Hay que mirarlo antes de decirle a alguien que su
 * factura se anuló ante la DIAN:
 *   'credit_note' → salió una nota crédito real y consumió un número de la
 *                   resolución. Irreversible.
 *   'discarded'   → NO se emitió nada: la factura nunca llegó a la DIAN (sin
 *                   número ni CUFE) y solo se cerró el intento de nuestro lado
 *                   para liberar el cobro. No consumió numeración.
 */
export type VoidMode = 'credit_note' | 'discarded';

export interface VoidInvoiceResult {
    ok: boolean;
    mode: VoidMode | null;
    creditNote: CreditNoteIssued | null;
    /** Estado en el que quedó la FACTURA (no la nota): 'void' cuando salió bien. */
    invoiceStatus: string | null;
    /** Código del motivo cuando `ok` es false. */
    error: string | null;
    /** Explicación del backend para la persona que apretó el botón. */
    message: string | null;
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

    /**
     * Emite la nota crédito que anula (o corrige) una factura ya emitida y deja
     * la factura en 'void'.
     *
     * NO es lo mismo que un borrado y no hay vuelta atrás: consume un número del
     * rango de notas crédito y el documento queda ante la DIAN para siempre. Y
     * tampoco vuelve a facturar el cobro — `reference_code` es determinista
     * (`SM-<paymentId>`), así que reemitir devuelve el mismo documento y la DIAN
     * contesta regla 90 («documento procesado anteriormente»).
     *
     * Se normaliza la respuesta acá por lo mismo que en `backfill`: el contrato
     * entre carriles fijó el nivel de arriba (`ok`, `creditNote`,
     * `invoiceStatus`), no si el BFF escribe `publicUrl` o `public_url`. Diez
     * líneas evitan que la pantalla muestre un enlace vacío justo después de la
     * operación que no se puede repetir para volver a verlo.
     */
    voidInvoice: async (invoiceId: string, body: VoidInvoiceBody): Promise<VoidInvoiceResult> => {
        const raw = await bffClient.post<any>(
            `/api/v1/invoicing/credit-note/${invoiceId}`,
            body,
        );
        const nc = raw?.creditNote ?? raw?.credit_note ?? null;
        const modeRaw = raw?.mode;
        return {
            ok: raw?.ok === true,
            // 'credit_note' | 'discarded' | null (rechazado por el backend, o
            // 400/403/404 donde el mode ni siquiera aplica).
            mode: modeRaw === 'credit_note' || modeRaw === 'discarded' ? modeRaw : null,
            creditNote: nc
                ? {
                    number: nc.number != null ? String(nc.number) : null,
                    cufe: nc.cufe != null ? String(nc.cufe) : null,
                    publicUrl: nc.publicUrl ?? nc.public_url ?? null,
                }
                : null,
            invoiceStatus: raw?.invoiceStatus ?? raw?.invoice_status ?? null,
            error: raw?.error ?? null,
            // Explicación en lenguaje llano que ya arma el backend (p. ej. "esta
            // factura nunca llegó a la DIAN, se cerró el intento sin nota
            // crédito" o "falta configurar el rango de notas crédito del PAC").
            // Si no llega, el diálogo cae a un mensaje genérico por `error`.
            message: raw?.message != null ? String(raw.message) : null,
        };
    },

    byPayment: (paymentId: string) =>
        bffClient.get<{ invoice: InvoiceRow & { qr_url?: string; qr_image?: string; owner_type: string; owner_id: string } }>(
            `/api/v1/invoicing/by-payment/${paymentId}`,
        ),
};
