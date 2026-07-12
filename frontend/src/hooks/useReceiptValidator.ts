/**
 * useReceiptValidator.ts
 *
 * Validador de comprobantes de pago via LLM Vision en el BFF.
 * Reemplaza el Tesseract.js anterior — el LLM lee fuentes raras de
 * cualquier banco colombiano (DaviPlata, Nequi, Bancolombia, BBVA, etc.)
 * con mucha mayor precision.
 *
 * Flujo:
 *   1. Si es PDF, render la primera pagina a imagen via pdfjs-dist + canvas
 *   2. Convertir blob a base64
 *   3. Llamar POST /api/v1/payments/extract-receipt
 *   4. Validar resultado:
 *      - Fecha debe ser hoy en Bogota -> SIEMPRE bloquea si no coincide
 *        (evita reuso de comprobantes vencidos, independiente del conceptKind)
 *      - Moneda debe ser COP -> SIEMPRE bloquea si OCR detecto otra (USD, etc.)
 *      - Si conceptKind === 'fixed':
 *          * monto debe coincidir con expectedAmount (tolerancia 0.5%)
 *          * exige fecha Y monto detectados (sin advisory en fixed)
 *      - Si conceptKind === 'lenient':
 *          * el monto es advisory (no bloquea)
 *          * si LLM no detecto fecha/monto -> advisory (admin valida visualmente)
 */

import { useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';

export interface ReceiptValidationResult {
    valid: boolean;
    extractedDate: string | null;        // ISO yyyy-mm-dd
    extractedAmount: number | null;      // numero, sin formato
    extractedReference: string | null;
    extractedBank: string | null;
    extractedCurrency: string | null;
    rejectionReason: string | null;
    /** Provider que respondio (groq/openai/gemini), util para debug */
    provider?: string;
    /** Respuesta cruda del LLM (string JSON o texto). Se persiste en
     *  payments.ocr_raw_response para auditoria/forensia. */
    rawResponse?: string;
}

export type ConceptKind = 'fixed' | 'lenient';

export interface ValidationOptions {
    expectedAmount?: number;
    conceptKind?: ConceptKind;
}

interface OcrResponse {
    amount: number | null;
    currency: string | null;
    date: string | null;
    bank: string | null;
    reference: string | null;
    provider?: string;
    rawResponse?: string;
}

// Tolerancia: monto OCR puede diferir del esperado en hasta esto y se considera match.
// Util para variantes de redondeo o cuando el comprobante incluye un peso adicional.
const AMOUNT_TOLERANCE_PCT = 0.5; // 0.5%

const todayIsoBogota = (): string => {
    // en-CA formatea como YYYY-MM-DD. Intl resuelve la zona correctamente
    // para usuarios en cualquier tz (no solo UTC).
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
};

const formatCop = (n: number): string =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ─────────────────────────────────────────────────────────────────────────────
// PDF -> primera pagina como blob de imagen
// ─────────────────────────────────────────────────────────────────────────────
const pdfPageToImageBlob = async (file: File): Promise<Blob> => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
};

// ─────────────────────────────────────────────────────────────────────────────
// Blob -> base64 (sin prefijo data:)
// ─────────────────────────────────────────────────────────────────────────────
const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // dataUrl: "data:image/png;base64,XXXX..."
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────
export function useReceiptValidator() {
    const [validating, setValidating] = useState(false);

    const validate = async (
        file: File,
        opts: ValidationOptions = {},
    ): Promise<ReceiptValidationResult> => {
        setValidating(true);

        try {
            // 1) Preparar imagen (PDFs -> rasterizar primera pagina)
            let imageBlob: Blob = file;
            let mimeType: string = file.type || 'image/png';

            if (file.type === 'application/pdf') {
                try {
                    imageBlob = await pdfPageToImageBlob(file);
                    mimeType = 'image/png';
                } catch {
                    return advisory(
                        'No se pudo procesar el PDF. Conviertelo a imagen (JPG/PNG) e intentalo de nuevo.',
                    );
                }
            }

            const base64 = await blobToBase64(imageBlob);

            // 2) Llamar al BFF (LLM Vision)
            let ocr: OcrResponse;
            try {
                ocr = await bffClient.post<OcrResponse>('/api/v1/payments/extract-receipt', {
                    imageBase64: base64,
                    mimeType,
                });
            } catch (err: any) {
                console.error('[OCR] error llamando al BFF:', err);
                return advisory(
                    'No pudimos verificar el comprobante automaticamente. Sera revisado manualmente por la administracion.',
                );
            }

            const { amount, date, reference, bank, currency, provider, rawResponse } = ocr;

            // 3) Validacion de fecha (hoy en Bogota) — SIEMPRE bloquea fechas
            //    distintas a hoy (vencidas o futuras), independiente del conceptKind.
            //    Evita que se reusen comprobantes viejos para "pagar" de nuevo.
            const today = todayIsoBogota();
            const dateMatchesToday = date === today;
            const conceptKind: ConceptKind = opts.conceptKind ?? 'lenient';
            const expected = opts.expectedAmount;
            const errors: string[] = [];

            if (date && !dateMatchesToday) {
                errors.push(
                    `El comprobante es del ${date}, pero debe ser de hoy (${today}).`,
                );
            }

            // 3.b) Validacion de moneda: SIEMPRE bloquea si el OCR detecto una
            //      moneda distinta a COP. Comprobantes en USD u otra moneda
            //      no aplican para pagos en SportMaps Colombia.
            if (currency && currency.toUpperCase() !== 'COP') {
                errors.push(
                    `El comprobante esta en ${currency}, pero solo aceptamos pagos en pesos colombianos (COP).`,
                );
            }

            // 4) Validacion de monto (solo aplica si conceptKind === 'fixed')
            let amountMatches: boolean | null = null;
            if (typeof amount === 'number' && typeof expected === 'number' && expected > 0) {
                const diffPct = Math.abs(amount - expected) / expected * 100;
                amountMatches = diffPct <= AMOUNT_TOLERANCE_PCT;
            }
            // En 'fixed', un monto MENOR al esperado es un ABONO válido: no se
            // bloquea, se sube y la escuela lo aprueba como pago parcial. Solo se
            // bloquea si el comprobante es por MÁS del esperado (posible
            // comprobante equivocado o reusado de otro pago mayor).
            if (
                conceptKind === 'fixed' &&
                typeof amount === 'number' &&
                expected &&
                amountMatches === false &&
                amount > expected
            ) {
                errors.push(
                    `El comprobante es por ${formatCop(amount)}, mayor al valor esperado ${formatCop(expected)}. Verifica que sea el comprobante correcto.`,
                );
            }

            // 4.b) Endurecimiento de concept 'fixed': exigir que el OCR haya
            //      detectado al menos fecha y monto. En 'fixed' no aceptamos
            //      comprobantes ilegibles como advisory — el padre debe subir
            //      uno legible o el flujo se cae a aprobacion manual del admin.
            if (conceptKind === 'fixed') {
                if (!date) {
                    errors.push(
                        'No se pudo leer la fecha del comprobante. Sube una imagen mas nitida.',
                    );
                }
                if (typeof amount !== 'number') {
                    errors.push(
                        'No se pudo leer el monto del comprobante. Sube una imagen mas nitida.',
                    );
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    extractedDate: date,
                    extractedAmount: amount,
                    extractedReference: reference,
                    extractedBank: bank,
                    extractedCurrency: currency,
                    provider,
                    rawResponse,
                    rejectionReason: errors.join(' ') + ' Sube el comprobante correcto.',
                };
            }

            // 6) Si llegamos aqui: o todo coincide, o concept es lenient, o el LLM no detecto algun campo.
            //    Marcamos valid=true (permite subir). El admin valida visualmente.
            return {
                valid: true,
                extractedDate: date,
                extractedAmount: amount,
                extractedReference: reference,
                extractedBank: bank,
                extractedCurrency: currency,
                provider,
                rawResponse,
                rejectionReason: null,
            };
        } catch (err) {
            console.error('Error en OCR:', err);
            return advisory('Error al analizar el archivo. Intenta de nuevo con una imagen mas nitida.');
        } finally {
            setValidating(false);
        }
    };

    return { validate, validating };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resultado advisory (no bloquea, marca valid=true)
// ─────────────────────────────────────────────────────────────────────────────
function advisory(reason: string): ReceiptValidationResult {
    return {
        valid: true,
        extractedDate: null,
        extractedAmount: null,
        extractedReference: null,
        extractedBank: null,
        extractedCurrency: null,
        rejectionReason: reason,
    };
}
