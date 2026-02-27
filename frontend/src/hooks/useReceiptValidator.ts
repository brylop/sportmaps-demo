/**
 * useReceiptValidator.ts
 * 
 * Validador de comprobantes de pago usando OCR en el navegador.
 * Usa Tesseract.js para extraer texto de imágenes y pdfjs-dist para PDFs.
 * 100% gratuito, sin llamadas a APIs externas.
 */

import { useState } from 'react';
import Tesseract from 'tesseract.js';

export interface ReceiptValidationResult {
    valid: boolean;
    extractedDate: string | null;
    extractedAmount: string | null;
    extractedReference: string | null;
    rejectionReason: string | null;
    rawText?: string;
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

const getTodayVariants = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');

    const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    const monthName = monthNames[today.getMonth()];

    return {
        iso: `${year}-${mm}-${dd}`,
        slash: `${dd}/${mm}/${year}`,
        slashShort: `${dd}/${mm}/${String(year).slice(2)}`,
        dash: `${dd}-${mm}-${year}`,
        dot: `${dd}.${mm}.${year}`,
        human: `${day} de ${monthName} de ${year}`,
        humanShort: `${day} ${monthName} ${year}`,
        dayMonth: `${dd}/${mm}`,
        dayMonthDash: `${dd}-${mm}`,
        day,
        month,
        year,
        monthName,
    };
};

// ── Extracción con regex ──────────────────────────────────────────────────────

const extractDate = (text: string): { found: string | null; isToday: boolean } => {
    const today = getTodayVariants();
    const lower = text.toLowerCase();

    const patterns = [
        today.iso,
        today.slash,
        today.slashShort,
        today.dash,
        today.dot,
        today.human,
        today.humanShort,
        today.dayMonth,
        today.dayMonthDash,
    ];

    for (const pattern of patterns) {
        if (lower.includes(pattern.toLowerCase())) {
            return { found: pattern, isToday: true };
        }
    }

    const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g;
    const matches = text.match(dateRegex);
    const humanDateRegex = /\b(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})\b/gi;
    const humanMatch = humanDateRegex.exec(text);

    const found = humanMatch ? humanMatch[0] : (matches ? matches[0] : null);
    return { found, isToday: false };
};

const extractAmount = (text: string): string | null => {
    const patterns = [
        /(?:valor|monto|total|transferencia|pago|enviaste?|recibiste?|cobrado)[:\s]*\$?\s*([\d.,]+)/gi,
        /\$\s*([\d.,]+(?:\.\d{2})?)/g,
        /COP\s*([\d.,]+)/gi,
        /\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)\b/g,
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
            const raw = match[1] || match[0];
            const numeric = parseFloat(raw.replace(/[.,]/g, ''));
            if (numeric > 1000) {
                return raw.trim();
            }
        }
    }
    return null;
};

const extractReference = (text: string): string | null => {
    const patterns = [
        /(?:n[uú]mero\s+de\s+operaci[oó]n|no\.?\s*operaci[oó]n)[:\s#]*([A-Z0-9\-]{4,20})/gi,
        /(?:referencia|ref\.?)[:\s#]*([A-Z0-9\-]{4,20})/gi,
        /(?:transacci[oó]n|transacci[oó]n\s+n[uú]mero?)[:\s#]*([A-Z0-9\-]{4,20})/gi,
        /(?:comprobante|n[uú]mero\s+de\s+comprobante)[:\s#]*([A-Z0-9\-]{4,20})/gi,
        /(?:aprobaci[oó]n|c[oó]digo)[:\s#]*([A-Z0-9\-]{4,20})/gi,
        /(?:id\s+transacci[oó]n|id)[:\s#]*([A-Z0-9\-]{6,20})/gi,
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match?.[1]) return match[1].trim();
    }

    const longNumber = /\b(\d{8,20})\b/.exec(text);
    if (longNumber) return longNumber[1];

    return null;
};

// ── Convertir primera página de PDF a imagen via canvas ──────────────────────

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

// ── Hook principal ────────────────────────────────────────────────────────────

export function useReceiptValidator() {
    const [validating, setValidating] = useState(false);

    const validate = async (file: File): Promise<ReceiptValidationResult> => {
        setValidating(true);
        try {
            let imageSource: File | Blob = file;

            if (file.type === 'application/pdf') {
                try {
                    imageSource = await pdfPageToImageBlob(file);
                } catch (err) {
                    console.error('Error convirtiendo PDF:', err);
                    return {
                        valid: false,
                        extractedDate: null,
                        extractedAmount: null,
                        extractedReference: null,
                        rejectionReason: 'No se pudo procesar el PDF. Intenta convertirlo a imagen (JPG/PNG) y vuelve a subirlo.',
                    };
                }
            }

            const { data } = await Tesseract.recognize(imageSource, 'spa+eng', {
                logger: process.env.NODE_ENV === 'development' ? (m) => console.log('[OCR]', m.status, Math.round((m.progress || 0) * 100) + '%') : undefined,
            });

            const text = data.text || '';
            const textLower = text.toLowerCase();

            const receiptKeywords = [
                'transferencia', 'transacción', 'transaccion',
                'comprobante', 'recibo', 'pago', 'operación', 'operacion',
                'nequi', 'daviplata', 'bancolombia', 'banco', 'enviaste',
                'enviado', 'recibiste', 'valor', 'aprobado', 'exitoso',
                'exitosa', 'realizada', 'confirmado',
            ];

            const isReceipt = receiptKeywords.some(kw => textLower.includes(kw));

            if (!isReceipt && text.length < 50) {
                return {
                    valid: false,
                    extractedDate: null,
                    extractedAmount: null,
                    extractedReference: null,
                    rejectionReason:
                        'No pudimos leer el comprobante o no parece ser un soporte válido. Por favor, asegúrate de que la imagen sea nítida o que el PDF sea legible e inténtalo de nuevo.',
                    rawText: text,
                };
            }

            const { found: dateFound, isToday } = extractDate(text);

            if (!isToday) {
                const today = getTodayVariants();
                const dateMsg = dateFound
                    ? `La fecha encontrada es "${dateFound}"`
                    : 'No se encontró ninguna fecha en el comprobante';
                return {
                    valid: false,
                    extractedDate: dateFound,
                    extractedAmount: extractAmount(text),
                    extractedReference: extractReference(text),
                    rejectionReason:
                        `${dateMsg}, pero el comprobante debe ser del día de hoy (${today.slash}). ` +
                        'Verifica que estés subiendo el comprobante correcto.',
                    rawText: text,
                };
            }

            return {
                valid: true,
                extractedDate: dateFound,
                extractedAmount: extractAmount(text),
                extractedReference: extractReference(text),
                rejectionReason: null,
                rawText: text,
            };
        } catch (err) {
            console.error('Error en OCR:', err);
            return {
                valid: false,
                extractedDate: null,
                extractedAmount: null,
                extractedReference: null,
                rejectionReason: 'Error al analizar el archivo. Intenta de nuevo.',
            };
        } finally {
            setValidating(false);
        }
    };

    return { validate, validating };
}
