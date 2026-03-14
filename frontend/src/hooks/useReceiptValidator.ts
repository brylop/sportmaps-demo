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

// ── Tablas de nombres ─────────────────────────────────────────────────────────

const MONTH_NAMES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MONTH_ABBREV_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_ABBREV_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_ABBREV_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// ── Helpers de fecha ──────────────────────────────────────────────────────────

/** Día del año (1 = 1 enero). */
const getDayOfYear = (date: Date): number => {
    const start = new Date(Date.UTC(date.getFullYear(), 0, 1));
    const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1;
};

/** Semana ISO (week) y día ISO (1=lun … 7=dom). */
const getISOWeek = (date: Date): { week: number; day: number } => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const isoDow = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - isoDow);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    const day = date.getDay() === 0 ? 7 : date.getDay();
    return { week, day };
};

const getTodayVariants = () => {
    const today = new Date();
    const day   = today.getDate();
    const month = today.getMonth() + 1;
    const year  = today.getFullYear();
    const dd    = String(day).padStart(2, '0');
    const mm    = String(month).padStart(2, '0');
    const yy    = String(year).slice(2);

    const monthName  = MONTH_NAMES_ES[today.getMonth()];
    const mAbbES     = MONTH_ABBREV_ES[today.getMonth()];
    const mAbbEN     = MONTH_ABBREV_EN[today.getMonth()];
    const weekdayName  = WEEKDAY_NAMES_ES[today.getDay()];
    const weekdayAbbr  = WEEKDAY_ABBREV_ES[today.getDay()];

    const dayOfYear = getDayOfYear(today);
    const ddd = String(dayOfYear).padStart(3, '0');
    const { week, day: isoDay } = getISOWeek(today);
    const ww = String(week).padStart(2, '0');

    // Rango Unix UTC del día actual (para validar @timestamp)
    const unixStart = Math.floor(Date.UTC(year, today.getMonth(), day,  0,  0,  0) / 1000);
    const unixEnd   = Math.floor(Date.UTC(year, today.getMonth(), day, 23, 59, 59) / 1000);

    return {
        // ── Formatos originales ───────────────────────────────────────────────
        iso:              `${year}-${mm}-${dd}`,           // AAAA-MM-DD
        slash:            `${dd}/${mm}/${year}`,            // DD/MM/AAAA
        slashShort:       `${dd}/${mm}/${yy}`,              // DD/MM/AA
        dash:             `${dd}-${mm}-${year}`,            // DD-MM-AAAA
        dot:              `${dd}.${mm}.${year}`,            // DD.MM.AAAA
        human:            `${day} de ${monthName} de ${year}`,  // D de MMMM de AAAA
        humanShort:       `${day} ${monthName} ${year}`,   // D MMMM AAAA
        dayMonth:         `${dd}/${mm}`,                    // DD/MM
        dayMonthDash:     `${dd}-${mm}`,                    // DD-MM

        // ── ISO extendidos ───────────────────────────────────────────────────
        compact:          `${year}${mm}${dd}`,              // AAAAMMDD (ISO básico)
        slashISO:         `${year}/${mm}/${dd}`,            // AAAA/MM/DD
        julian:           `${year}-${ddd}`,                 // AAAA-DDD (día ordinal)
        isoWeek:          `${year}-W${ww}-${isoDay}`,       // AAAA-Www-D (semana ISO)

        // ── Formato EE.UU. ───────────────────────────────────────────────────
        slashUS:          `${mm}/${dd}/${year}`,            // MM/DD/AAAA
        mSlashDSlashYY:   `${month}/${day}/${yy}`,          // M/D/AA

        // ── Mes abreviado (español) ──────────────────────────────────────────
        dashMMMes:        `${dd}-${mAbbES}-${year}`,        // DD-mmm-AAAA
        dashMMMesShort:   `${dd}-${mAbbES}-${yy}`,          // DD-mmm-AA
        noSepMMes:        `${dd}${mAbbES}${year}`,          // DDmmmAAAA
        humanAbbr:        `${day} ${mAbbES} ${year}`,       // D mmm AAAA
        humanAbbrDot:     `${day} ${mAbbES}. ${year}`,      // D mmm. AAAA

        // ── Mes abreviado (inglés) ───────────────────────────────────────────
        dashMMMen:        `${dd}-${mAbbEN}-${year}`,        // DD-MMM-AAAA
        dashMMMenuShort:  `${dd}-${mAbbEN}-${yy}`,          // DD-MMM-AA
        noSepMMen:        `${dd}${mAbbEN}${year}`,          // DDMMMAAAA
        humanAbbrEN:      `${day} ${mAbbEN} ${year}`,       // D MMM AAAA

        // ── Con coma / día de semana ─────────────────────────────────────────
        humanComma:         `${day} de ${monthName}, ${year}`,                   // D de MMMM, AAAA
        humanWeekday:       `${weekdayName}, ${day} de ${monthName} de ${year}`, // EEEE, D de MMMM de AAAA
        humanWeekdayAbbr:   `${weekdayAbbr}, ${day} ${mAbbES} ${year}`,          // ddd, D mmm AAAA

        // ── Compactos cortos ─────────────────────────────────────────────────
        ddmmyy:           `${dd}${mm}${yy}`,               // DDMMAA
        ddmmyydash:       `${dd}-${mm}-${yy}`,             // DD-MM-AA
        mmddyy:           `${mm}${dd}${yy}`,               // MMDDAA
        mmddyydash:       `${mm}-${dd}-${yy}`,             // MM-DD-AA
        yymmdd:           `${yy}${mm}${dd}`,               // AAMMDD

        // ── Metadatos (uso interno) ──────────────────────────────────────────
        unixStart,
        unixEnd,
        day, month, year, monthName, yy,
    };
};

// ── Extracción con regex ──────────────────────────────────────────────────────

const extractDate = (text: string): { found: string | null; isToday: boolean } => {
    const today = getTodayVariants();
    const lower = text.toLowerCase();

    // Orden: de más específico/largo a más corto para reducir falsos positivos
    const patterns = [
        // Con día de semana (más largo → menos ambiguo)
        today.humanWeekday,
        today.humanWeekdayAbbr,
        // Formato largo con mes escrito
        today.human,
        today.humanComma,
        today.humanShort,
        today.humanAbbr,
        today.humanAbbrDot,
        today.humanAbbrEN,
        // ISO y variantes con año completo
        today.iso,
        today.slashISO,
        today.compact,
        today.julian,
        today.isoWeek,
        // DD/MM/AAAA y variantes
        today.slash,
        today.slashUS,
        today.dash,
        today.dot,
        // Con mes abreviado
        today.dashMMMes,
        today.dashMMMen,
        today.noSepMMes,
        today.noSepMMen,
        // Año corto
        today.slashShort,
        today.dashMMMesShort,
        today.dashMMMenuShort,
        today.ddmmyydash,
        today.mmddyydash,
        today.mSlashDSlashYY,
        // Compactos sin separador (mayor riesgo de falso positivo — van al final)
        today.ddmmyy,
        today.mmddyy,
        today.yymmdd,
        // Solo día/mes
        today.dayMonth,
        today.dayMonthDash,
    ];

    for (const pattern of patterns) {
        if (lower.includes(pattern.toLowerCase())) {
            return { found: pattern, isToday: true };
        }
    }

    // Unix timestamp: @XXXXXXXXXX o número de 10 dígitos suelto
    const unixMatch = /@(\d{9,10})\b|\b(\d{10})\b/.exec(text);
    if (unixMatch) {
        const ts = parseInt(unixMatch[1] || unixMatch[2], 10);
        if (ts >= today.unixStart && ts <= today.unixEnd) {
            return { found: `@${ts}`, isToday: true };
        }
    }

    // Fallback: extraer cualquier fecha presente en el texto
    const dateRegex = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})\b/g;
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
        /(?:n[uú]mero\s+de\s+operaci[oó]n|no\.?\s*operaci[oó]n)[:\s#]*([A-Z0-9-]{4,20})/gi,
        /(?:referencia|ref\.?)[:\s#]*([A-Z0-9-]{4,20})/gi,
        /(?:transacci[oó]n|transacci[oó]n\s+n[uú]mero?)[:\s#]*([A-Z0-9-]{4,20})/gi,
        /(?:comprobante|n[uú]mero\s+de\s+comprobante)[:\s#]*([A-Z0-9-]{4,20})/gi,
        /(?:aprobaci[oó]n|c[oó]digo)[:\s#]*([A-Z0-9-]{4,20})/gi,
        /(?:id\s+transacci[oó]n|id)[:\s#]*([A-Z0-9-]{6,20})/gi,
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
                logger: import.meta.env.DEV ? (msg) => console.log('[OCR]', msg.status, Math.round((msg.progress || 0) * 100) + '%') : undefined,
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

            const isReceipt = receiptKeywords.some(keyword => textLower.includes(keyword));

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
