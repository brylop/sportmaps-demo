/**
 * list-query — parámetros del listado de facturas de un dueño
 * (GET /api/v1/invoicing/invoices/:ownerType/:ownerId).
 *
 * Antes el listado traía las 200 más recientes y nada más: Dynasty ya pasa de
 * 240 documentos, así que lo viejo desaparecía de la pantalla sin aviso. Ahora
 * pagina del lado del servidor y filtra por estado y por fecha.
 *
 * Lógica pura (sin base) para poder probarla: el handler solo traduce esto a
 * `.in('status', …)`, `.gte/.lte('created_at', …)` y `.range(desde, hasta)`.
 */

/** Estados que existen en electronic_invoices.status. */
export const INVOICE_STATUSES = ['draft', 'queued', 'sent', 'accepted', 'rejected', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_DOC_TYPES = ['invoice', 'credit_note', 'debit_note'] as const;
export type InvoiceDocType = (typeof INVOICE_DOC_TYPES)[number];

export const INVOICE_PAGE_SIZE_DEFAULT = 50;
export const INVOICE_PAGE_SIZE_MAX = 200;
/**
 * Sin `page` ni `pageSize` en la URL se devuelven 200, como antes: un frontend
 * viejo desplegado contra este BFF ve lo mismo que veía.
 */
export const INVOICE_PAGE_SIZE_LEGACY = 200;

export interface InvoiceListQuery {
    page: number;              // 1-based
    pageSize: number;
    statuses: InvoiceStatus[]; // vacío = todos
    documentType: InvoiceDocType | null;
    /** Límites ISO con zona de Colombia (UTC-5), sobre created_at. */
    createdFrom: string | null;
    createdTo: string | null;
    /** Desde/hasta tal como llegaron (YYYY-MM-DD), para devolverlos. */
    from: string | null;
    to: string | null;
}

export type ParseResult =
    | { ok: true; value: InvoiceListQuery }
    | { ok: false; error: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function primero(v: unknown): string | undefined {
    if (Array.isArray(v)) return v.length ? String(v[0]) : undefined;
    return v == null ? undefined : String(v);
}

/** ¿`YYYY-MM-DD` es un día real del calendario? (rechaza 2026-02-30). */
export function isRealDay(day: string): boolean {
    if (!DAY_RE.test(day)) return false;
    const d = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/**
 * Límites del día en hora de Colombia. Las facturas se guardan en UTC; un
 * documento emitido el 30-sep a las 9 p.m. en Bogotá es 1-oct en UTC, y filtrar
 * por el día UTC lo mandaría al mes equivocado.
 */
export function dayStartBogota(day: string): string {
    return `${day}T00:00:00-05:00`;
}
export function dayEndBogota(day: string): string {
    return `${day}T23:59:59.999-05:00`;
}

export function parseInvoiceListQuery(q: Record<string, unknown>): ParseResult {
    const pageRaw = primero(q.page);
    const sizeRaw = primero(q.pageSize ?? q.page_size);

    let page = 1;
    if (pageRaw !== undefined && pageRaw !== '') {
        if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1) return { ok: false, error: 'invalid_page' };
        page = Number(pageRaw);
    }

    let pageSize = pageRaw === undefined && sizeRaw === undefined
        ? INVOICE_PAGE_SIZE_LEGACY
        : INVOICE_PAGE_SIZE_DEFAULT;
    if (sizeRaw !== undefined && sizeRaw !== '') {
        if (!/^\d+$/.test(sizeRaw) || Number(sizeRaw) < 1) return { ok: false, error: 'invalid_page_size' };
        pageSize = Math.min(Number(sizeRaw), INVOICE_PAGE_SIZE_MAX);
    }

    // status=rejected,queued  ó  status=rejected&status=queued
    const statusVals = (Array.isArray(q.status) ? q.status : [q.status])
        .filter((v) => v != null && v !== '')
        .flatMap((v) => String(v).split(','))
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
    const statuses: InvoiceStatus[] = [];
    for (const v of statusVals) {
        if (!(INVOICE_STATUSES as readonly string[]).includes(v)) return { ok: false, error: 'invalid_status' };
        if (!statuses.includes(v as InvoiceStatus)) statuses.push(v as InvoiceStatus);
    }

    const docRaw = primero(q.documentType ?? q.document_type);
    let documentType: InvoiceDocType | null = null;
    if (docRaw) {
        if (!(INVOICE_DOC_TYPES as readonly string[]).includes(docRaw)) return { ok: false, error: 'invalid_document_type' };
        documentType = docRaw as InvoiceDocType;
    }

    const from = primero(q.from) || null;
    const to = primero(q.to) || null;
    if (from && !isRealDay(from)) return { ok: false, error: 'invalid_from' };
    if (to && !isRealDay(to)) return { ok: false, error: 'invalid_to' };
    if (from && to && from > to) return { ok: false, error: 'from_after_to' };

    return {
        ok: true,
        value: {
            page,
            pageSize,
            statuses,
            documentType,
            createdFrom: from ? dayStartBogota(from) : null,
            createdTo: to ? dayEndBogota(to) : null,
            from,
            to,
        },
    };
}

/** Rango inclusivo para PostgREST `.range(desde, hasta)`. */
export function pageRange(page: number, pageSize: number): { desde: number; hasta: number } {
    const desde = (page - 1) * pageSize;
    return { desde, hasta: desde + pageSize - 1 };
}

/** Total de páginas (mínimo 1, para que «página 1 de 1» con lista vacía tenga sentido). */
export function totalPages(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}
