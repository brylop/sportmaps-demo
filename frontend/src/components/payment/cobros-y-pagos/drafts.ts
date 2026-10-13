/**
 * Borradores del formulario de «Cobros y pagos» que no son de una sola línea de
 * cobro (esas están en lib/cobrosYPagos.ts): atleta nuevo (§16), bloque «Ya lo
 * pagaron» y destino del modo varios. Viven aparte de los componentes para que
 * Fast Refresh funcione (un archivo .tsx solo exporta componentes).
 */
import { buildReceiptOcrFields } from '@/lib/receiptOcrFields';
import type { ReceiptValidationResult } from '@/hooks/useReceiptValidator';
import type { AthleteDuplicate, NewAthletePayload, PaymentPayload, TargetKind } from '@/lib/api/chargeBatches';

// ── Atleta nuevo (§16.2) ──────────────────────────────────────────────────────

export interface NewAthleteDraft {
    kind: 'menor' | 'adulto';
    full_name: string;
    doc_type: string;
    doc_number: string;
    guardian_name: string;
    guardian_phone: string;
    date_of_birth: string;
    allow_duplicate: boolean;
}

export const emptyNewAthlete = (): NewAthleteDraft => ({
    kind: 'menor', full_name: '', doc_type: 'TI', doc_number: '', guardian_name: '', guardian_phone: '', date_of_birth: '', allow_duplicate: false,
});

/** null si el registro mínimo está completo (§16.2); si no, qué falta. */
export function newAthleteError(d: NewAthleteDraft): string | null {
    if (d.full_name.trim().length < 3) return 'Escribe el nombre completo.';
    if (d.guardian_phone.replace(/\D/g, '').length < 7) return d.kind === 'menor' ? 'Escribe el teléfono del acudiente.' : 'Escribe el teléfono.';
    return null;
}

export function newAthletePayload(d: NewAthleteDraft): NewAthletePayload {
    return {
        kind: d.kind,
        full_name: d.full_name.trim(),
        ...(d.doc_number.trim() ? { doc_type: d.doc_type, doc_number: d.doc_number.trim() } : {}),
        ...(d.kind === 'menor' && d.guardian_name.trim() ? { guardian_name: d.guardian_name.trim() } : {}),
        guardian_phone: d.guardian_phone.trim(),
        ...(d.date_of_birth ? { date_of_birth: d.date_of_birth } : {}),
        allow_duplicate: d.allow_duplicate,
    };
}

/** ¿Hay coincidencias reales (no solo teléfono) sin decisión? Bloquea confirmar. */
export function hasUnresolvedDuplicates(d: NewAthleteDraft, dups: AthleteDuplicate[] | undefined): boolean {
    if (d.allow_duplicate) return false;
    return (dups ?? []).some((m) => {
        const by = Array.isArray(m.matched_by) ? m.matched_by : [m.matched_by];
        return !(by.length === 1 && /tel/i.test(by[0]));
    });
}

// ── «Ya lo pagaron» ───────────────────────────────────────────────────────────

export interface PaymentDraft {
    on: boolean;
    method: 'cash' | 'transfer';
    /** YYYY-MM-DD tal cual lo eligió la escuela (nunca toISOString: corre el día). */
    date: string;
    reference: string;
    receiptUrl: string | null;
    ocr: ReceiptValidationResult | null;
    wantsEInvoice: boolean;
}

export const emptyPaymentDraft = (today: string, on = false): PaymentDraft => ({
    on, method: 'cash', date: today, reference: '', receiptUrl: null, ocr: null, wantsEInvoice: false,
});

/** null si se puede registrar; si no, qué falta. */
export function paymentDraftError(p: PaymentDraft, today: string): string | null {
    if (!p.on) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return 'Elige la fecha del pago.';
    if (p.date > today) return 'La fecha del pago no puede ser futura.';
    return null;
}

export function paymentPayload(p: PaymentDraft): PaymentPayload {
    const ref = p.reference.trim();
    const withReceipt = p.method === 'transfer' && p.receiptUrl;
    return {
        method: p.method,
        payment_date: p.date,
        ...(ref ? { reference: ref } : {}),
        ...(withReceipt ? { receipt_url: p.receiptUrl! } : {}),
        ...(withReceipt && p.ocr?.imageSha256 ? { receipt_sha256: p.ocr.imageSha256 } : {}),
        // Hash y referencia OCR quedan en UNA fila (la de mayor monto), lo decide la RPC (Q23).
        ...(withReceipt && p.ocr ? { ocr: buildReceiptOcrFields(p.ocr) as Record<string, unknown> } : {}),
        ...(p.wantsEInvoice ? { wants_e_invoice: true } : {}),
    };
}

// ── Modo varios ───────────────────────────────────────────────────────────────

export interface MultiTargetValue {
    kind: Exclude<TargetKind, 'athlete'>;
    groupId: string | null;
    includePaused: boolean;
    /** Quitados a mano de la lista del grupo. */
    excluded: string[];
    /** Elegidos a mano (kind = 'list'). */
    manual: string[];
}

export const emptyMultiTarget = (teamId?: string | null): MultiTargetValue => ({
    kind: 'team', groupId: teamId ?? null, includePaused: false, excluded: [], manual: [],
});
