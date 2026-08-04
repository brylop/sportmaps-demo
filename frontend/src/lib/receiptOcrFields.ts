/**
 * receiptOcrFields — Mapea el resultado del validador de comprobantes a las
 * columnas ocr_* / receipt_* de `payments`.
 *
 * El mismo bloque estaba duplicado en PaymentCheckoutModal y ParentCheckoutPage;
 * cualquier flujo nuevo que persista un comprobante debe usar este helper para
 * no dejar campos sueltos (los índices de dedup dependen de ocr_reference y
 * receipt_image_sha256, así que omitirlos desactiva el guard de reuso).
 */

import type { ReceiptValidationResult } from '@/hooks/useReceiptValidator';

/** Intenta parsear un string como JSON; devuelve null si no es JSON valido. */
function safeParseJson(s: string): unknown | null {
    try { return JSON.parse(s); } catch { return null; }
}

export function buildReceiptOcrFields(ocr: ReceiptValidationResult | null | undefined) {
    return {
        ocr_amount: ocr?.extractedAmount ?? null,
        ocr_currency: ocr?.extractedCurrency ?? null,
        ocr_date: ocr?.extractedDate ?? null,
        ocr_bank: ocr?.extractedBank ?? null,
        ocr_reference: ocr?.extractedReference ?? null,
        ocr_provider: ocr?.provider ?? null,
        ocr_destination: ocr?.extractedDestination ?? null,
        ocr_destination_name: ocr?.extractedDestinationName ?? null,
        ocr_origin_name: ocr?.extractedOriginName ?? null,
        ocr_time: ocr?.extractedTime ?? null,
        ocr_raw_response: ocr?.rawResponse
            ? safeParseJson(ocr.rawResponse) ?? ocr.rawResponse
            : null,
        receipt_verdict: ocr?.verdict ?? null,
        receipt_verdict_reasons: ocr?.verdictReasons ?? null,
        receipt_reference_norm: ocr?.referenceNorm ?? null,
        receipt_image_sha256: ocr?.imageSha256 ?? null,
        receipt_image_sha256_source: ocr?.imageSha256Source ?? null,
        receipt_verdict_at: ocr?.verdict ? new Date().toISOString() : null,
    };
}

/** true si el error de Supabase es un choque con los índices de dedup de comprobantes. */
export function isDuplicateReceiptError(err: { code?: string; message?: string } | null | undefined): boolean {
    if (err?.code !== '23505') return false;
    const msg = (err.message ?? '').toLowerCase();
    return msg.includes('ocr_reference')
        || msg.includes('receipt_hash')
        || msg.includes('receipt_image_sha256');
}
