/**
 * glosas API — wrappers del frontend sobre los endpoints del BFF /api/v1/payments/glosas.
 * Todo pasa por el BFF (los RPCs son solo-service_role); bffClient adjunta el JWT.
 */
import { bffClient } from '@/lib/api/bffClient';

export type GlosaStatus = 'GLOSADA' | 'EN_RESPUESTA' | 'EN_CONCILIACION' | 'ACEPTADA' | 'RATIFICADA';

export type GlosaReason =
    | 'MONTO_DIFIERE'
    | 'FECHA_FUERA_VENTANA'
    | 'REFERENCIA_DUPLICADA'
    | 'DESTINO_NO_COINCIDE'
    | 'CAMPOS_ILEGIBLES'
    | 'LECTURA_INCONSISTENTE'
    | 'NO_APARECE_EN_BANCO'
    | 'OTRO';

export type GlosaOutcome = 'ACEPTADA' | 'RATIFICADA';

/** Datos del pago que el BFF adjunta (join) para la conciliación del admin. */
export interface GlosaPaymentInfo {
    id: string;
    amount: number | null;
    concept: string | null;
    due_date: string | null;
    payment_date: string | null;
    receipt_url: string | null;
    ocr_amount: number | null;
    ocr_currency: string | null;
    ocr_date: string | null;
    ocr_bank: string | null;
    ocr_reference: string | null;
    ocr_destination: string | null;
    receipt_verdict: string | null;
    receipt_verdict_reasons: unknown[] | null;
    child?: { full_name: string | null } | null;
    parent?: { full_name: string | null; email: string | null } | null;
}

export interface Glosa {
    id: string;
    school_id: string;
    payment_id: string;
    reason: GlosaReason;
    reason_detail: Record<string, unknown> | null;
    status: GlosaStatus;
    response_text: string | null;
    response_files: unknown[] | null;
    resolution_note: string | null;
    responds_by: string;
    created_at: string;
    responded_at: string | null;
    resolved_at: string | null;
    /** Join que agrega el BFF en listBySchool. */
    payments?: GlosaPaymentInfo | null;
}

// ── Etiquetas ───────────────────────────────────────────────────────────────

/** Motivo → texto simple para el ACUDIENTE (nunca el código técnico). */
export const REASON_LABELS: Record<GlosaReason, string> = {
    MONTO_DIFIERE: 'El monto del comprobante no coincide con el valor esperado.',
    FECHA_FUERA_VENTANA: 'La fecha del comprobante está fuera del plazo permitido.',
    REFERENCIA_DUPLICADA: 'Este número de comprobante ya se había usado.',
    DESTINO_NO_COINCIDE: 'El dinero se envió a una cuenta que no reconocemos.',
    CAMPOS_ILEGIBLES: 'No pudimos leer bien algunos datos del comprobante.',
    LECTURA_INCONSISTENTE: 'Necesitamos verificar algunos datos del comprobante.',
    NO_APARECE_EN_BANCO: 'No pudimos confirmar el pago en el extracto del banco.',
    OTRO: 'Necesitamos que aclares un detalle de tu comprobante.',
};

/** Motivo → etiqueta corta para el ADMIN (tipificada). */
export const REASON_ADMIN_LABELS: Record<GlosaReason, string> = {
    MONTO_DIFIERE: 'Monto difiere',
    FECHA_FUERA_VENTANA: 'Fecha fuera de ventana',
    REFERENCIA_DUPLICADA: 'Referencia duplicada',
    DESTINO_NO_COINCIDE: 'Destino no coincide',
    CAMPOS_ILEGIBLES: 'Campos ilegibles',
    LECTURA_INCONSISTENTE: 'Lectura inconsistente',
    NO_APARECE_EN_BANCO: 'No aparece en banco',
    OTRO: 'Otro',
};

export const STATUS_LABELS: Record<GlosaStatus, string> = {
    GLOSADA: 'Pendiente de respuesta',
    EN_RESPUESTA: 'Respondida',
    EN_CONCILIACION: 'En conciliación',
    ACEPTADA: 'Aceptada',
    RATIFICADA: 'Ratificada',
};

/** Estados abiertos (necesitan acción). */
export const OPEN_GLOSA_STATUSES: GlosaStatus[] = ['GLOSADA', 'EN_RESPUESTA', 'EN_CONCILIACION'];

// ── Endpoints ─────────────────────────────────────────────────────────────

const BASE = '/api/v1/payments/glosas';

/** Glosas del acudiente autenticado (todas las de sus pagos). */
export const listMine = () => bffClient.get<Glosa[]>(`${BASE}/mine`);

/** Glosas de la escuela del admin (opcionalmente filtradas por estado). */
export const listBySchool = (status?: GlosaStatus) =>
    bffClient.get<Glosa[]>(status ? `${BASE}?status=${status}` : BASE);

export const create = (body: {
    paymentId: string;
    reason: GlosaReason;
    reasonDetail?: unknown;
    respondsBy?: string;
}) => bffClient.post<{ id: string }>(BASE, body);

export const respond = (id: string, body: { responseText: string; responseFiles?: unknown }) =>
    bffClient.post<{ ok: true }>(`${BASE}/${id}/respond`, body);

export const conciliate = (id: string) =>
    bffClient.post<{ ok: true }>(`${BASE}/${id}/conciliate`, {});

export const resolve = (id: string, outcome: GlosaOutcome, resolutionNote: string) =>
    bffClient.post<{ ok: true }>(`${BASE}/${id}/resolve`, { outcome, resolutionNote });

export const reopen = (id: string, note: string) =>
    bffClient.post<{ ok: true }>(`${BASE}/${id}/reopen`, { note });

/** Auto-evaluación app-layer (dormant si auto_glosa_enabled=false). Fire-and-forget. */
export const autoEvaluate = (paymentId: string) =>
    bffClient.post<{ glosaId: string | null }>(`${BASE}/auto-evaluate`, { paymentId });