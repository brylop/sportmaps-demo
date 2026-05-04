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
 *      - Fecha debe ser hoy
 *      - Si conceptKind === 'fixed' y monto no match con expectedAmount -> bloquea
 *      - Si conceptKind === 'lenient' -> advisory (no bloquea)
 *      - Si LLM no detecto monto/fecha -> advisory (admin valida visualmente)
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
}

// Tolerancia: monto OCR puede diferir del esperado en hasta esto y se considera match.
// Util para variantes de redondeo o cuando el comprobante incluye un peso adicional.
const AMOUNT_TOLERANCE_PCT = 0.5; // 0.5%

const todayIsoBogota = (): string => {
    const now = new Date();
    // Bogota es UTC-5 sin DST. Calculo manual evita depender de Intl.
    const offsetMs = -5 * 60 * 60 * 1000;
    const bogota = new Date(now.getTime() + offsetMs - now.getTimezoneOffset() * 60 * 1000);
    const y = bogota.getUTCFullYear();
    const m = String(bogota.getUTCMonth() + 1).padStart(2, '0');
    const d = String(bogota.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

            const { amount, date, reference, bank, currency, provider } = ocr;

            // 3) Validacion de fecha (hoy en Bogota)
            const today = todayIsoBogota();
            const dateMatchesToday = date === today;

            // 4) Validacion de monto (solo aplica si conceptKind === 'fixed')
            const conceptKind: ConceptKind = opts.conceptKind ?? 'lenient';
            const expected = opts.expectedAmount;
            let amountMatches: boolean | null = null;
            if (typeof amount === 'number' && typeof expected === 'number' && expected > 0) {
                const diffPct = Math.abs(amount - expected) / expected * 100;
                amountMatches = diffPct <= AMOUNT_TOLERANCE_PCT;
            }

            // 5) Bloqueo duro en concept fixed: acumula TODOS los conflictos detectados
            //    (monto incorrecto + fecha distinta a hoy) en un solo mensaje.
            if (conceptKind === 'fixed') {
                const errors: string[] = [];
                if (typeof amount === 'number' && expected && amountMatches === false) {
                    errors.push(
                        `El comprobante es por ${formatCop(amount)} pero el plan cuesta ${formatCop(expected)}.`,
                    );
                }
                if (date && !dateMatchesToday) {
                    errors.push(
                        `El comprobante es del ${date}, pero debe ser de hoy (${today}).`,
                    );
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
                        rejectionReason: errors.join(' ') + ' Sube el comprobante correcto.',
                    };
                }
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
