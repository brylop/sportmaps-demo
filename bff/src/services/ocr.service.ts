/**
 * ocr.service — Extraccion estructurada de comprobantes de pago colombianos.
 *
 * Recibe la imagen del comprobante (base64) y devuelve JSON con monto, fecha,
 * banco emisor y numero de referencia. Usa LLM Vision en lugar de Tesseract
 * para mayor precision con formatos heterogeneos (DaviPlata, Nequi, Bancolombia,
 * BBVA, Movii, etc.).
 *
 * Provider primario: Groq Llama 3.2 Vision (gratis, free tier alcanza).
 * Fallbacks: OpenAI GPT-4o-mini, Google Gemini Flash.
 */

export interface OcrResult {
    amount: number | null;
    currency: string | null;
    date: string | null;          // ISO yyyy-mm-dd
    time: string | null;          // HH:MM (24h)
    bank: string | null;
    reference: string | null;
    /** Numero de cuenta/celular/llave AL QUE SE ENVIO el dinero (destino). */
    destination: string | null;
    /** Nombre del titular destino (etiqueta "Para"). Señal informativa, no bloquea. */
    destinationName: string | null;
    /** Nombre de quien envia. */
    originName: string | null;
    /** false si la imagen no es un comprobante de pago individual. */
    isReceipt: boolean;
    /** true si es un pantallazo de lista de movimientos (no un comprobante individual). */
    isTransactionList: boolean;
    /** Campos del schema que el modelo NO pudo ver/leer en la imagen. */
    missingFields: string[];
    rawResponse?: string;
    provider: string;
}

// El LLM SOLO extrae. Nunca aprueba ni rechaza. La decision vive en
// receipt-verdict.ts (reglas determinísticas). No pedir "confianza" al modelo.
const SYSTEM_PROMPT = `Eres un extractor de datos de comprobantes de pago colombianos (DaviPlata, Nequi,
Bancolombia, BBVA, Davivienda, Movii, Bre-B, PSE, etc.).
Devuelve UNICAMENTE un JSON valido con este schema, sin texto adicional:
{
  "amount": <numero sin separadores, ej 150000> | null,
  "currency": "COP" | "USD" | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "bank": "DaviPlata"|"Nequi"|"Bancolombia"|"BBVA"|"Davivienda"|"Movii"|"BreB"|"PSE"|"Otro" | null,
  "reference": "<numero de operacion/aprobacion/comprobante/CUS>" | null,
  "destination": "<numero de cuenta, celular o llave A LA QUE SE ENVIO el dinero>" | null,
  "destination_name": "<nombre del titular destino, etiqueta 'Para'>" | null,
  "origin_name": "<nombre de quien envia>" | null,
  "is_receipt": true | false,
  "is_transaction_list": true | false,
  "missing_fields": ["<campos que NO son visibles o legibles en la imagen>"]
}
Reglas:
- amount: SOLO el monto principal ("Valor", "Monto", "Total"). Ignora comisiones y saldos.
- amount: el formato colombiano usa punto de miles y coma decimal.
  "$ 1.000,00" -> 1000. "$ 150.000" -> 150000.
- date/time: convierte cualquier formato. "Abril 28 de 2026, 11:51 p.m." -> "2026-04-28", "23:51".
- destination: el numero DESTINO (a quien le llego la plata), NO el de quien envia.
  Busca etiquetas como "Llave", "Para", "Cuenta destino", "Banco destino", "Numero Nequi".
  En envios por llave (Bre-B/Nequi), destination es el numero de la llave.
- is_receipt: false si la imagen no es un comprobante de pago individual.
- is_transaction_list: true si es un pantallazo de lista de movimientos, no un comprobante individual.
- missing_fields: lista todo campo del schema que no aparece o no es legible.
  Reporta lo que VES; no juzgues validez.
- NUNCA inventes datos. Campo no legible = null + entrada en missing_fields.`;

const USER_PROMPT = 'Extrae los datos de este comprobante de pago:';

// ─────────────────────────────────────────────────────────────────────────────
// GROQ — Llama 3.2 90B Vision (provider primario, gratis)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithGroq(base64Image: string, mimeType: string): Promise<OcrResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            // Llama 4 Scout: modelo de vision actual de Groq (free tier).
            // El anterior llama-3.2-90b-vision-preview fue decommissioned.
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            temperature: 0,
            max_tokens: 500,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: USER_PROMPT },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';
    return parseLlmJson(content, 'groq');
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENAI — GPT-4o-mini (fallback 1)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithOpenAI(base64Image: string, mimeType: string): Promise<OcrResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0,
            max_tokens: 500,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: USER_PROMPT },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';
    return parseLlmJson(content, 'openai');
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI — Google Gemini 2.0 Flash (fallback 2)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithGemini(base64Image: string, mimeType: string): Promise<OcrResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

    // gemini-2.0-flash devolvía 404 con las keys nuevas de AI Studio; 2.5-flash
    // es el estable vigente con visión. Configurable por env si cambia.
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: USER_PROMPT },
                        { inlineData: { mimeType, data: base64Image } },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 500,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const content: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseLlmJson(content, 'gemini');
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser comun + entry point con fallback
// ─────────────────────────────────────────────────────────────────────────────
const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

function parseLlmJson(content: string, provider: string): OcrResult {
    try {
        const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
        const data = JSON.parse(cleaned);
        return {
            amount: typeof data.amount === 'number' ? data.amount : null,
            currency: asStr(data.currency),
            date: asStr(data.date),
            time: asStr(data.time),
            bank: asStr(data.bank),
            reference: asStr(data.reference),
            destination: asStr(data.destination),
            destinationName: asStr(data.destination_name),
            originName: asStr(data.origin_name),
            // Default true: solo marcamos "no es comprobante" si el modelo lo afirma
            // explícitamente. Un campo omitido no debe disparar un ROJO falso.
            isReceipt: data.is_receipt === false ? false : true,
            isTransactionList: data.is_transaction_list === true,
            missingFields: Array.isArray(data.missing_fields)
                ? data.missing_fields.filter((f: unknown): f is string => typeof f === 'string')
                : [],
            rawResponse: content,
            provider,
        };
    } catch {
        // JSON ilegible: tratamos como comprobante no leído (todo null/vacío).
        // isReceipt=true para no rechazar en falso; el pipeline lo mandará a
        // AMARILLO por campos faltantes, no a ROJO.
        return {
            amount: null, currency: null, date: null, time: null, bank: null,
            reference: null, destination: null, destinationName: null, originName: null,
            isReceipt: true, isTransactionList: false, missingFields: ['amount', 'date', 'reference'],
            rawResponse: content,
            provider,
        };
    }
}

export async function extractReceipt(base64Image: string, mimeType: string = 'image/png'): Promise<OcrResult> {
    const order = (process.env.OCR_PROVIDER || 'groq').toLowerCase();

    const providers: Record<string, () => Promise<OcrResult>> = {
        groq:   () => extractWithGroq(base64Image, mimeType),
        openai: () => extractWithOpenAI(base64Image, mimeType),
        gemini: () => extractWithGemini(base64Image, mimeType),
    };

    const tryOrder = [order, 'gemini', 'openai', 'groq'].filter((v, i, a) => a.indexOf(v) === i && providers[v]);

    let lastErr: Error | null = null;
    for (const name of tryOrder) {
        try {
            return await providers[name]();
        } catch (err: any) {
            lastErr = err;
            console.warn(`[OCR] ${name} fallo, intentando siguiente:`, err.message);
        }
    }
    throw lastErr ?? new Error('Todos los providers de OCR fallaron');
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción por proveedor explícito — para la DOBLE extracción de Fase 5
// (cross-check con dos providers DISTINTOS). Cada uno ya tiene AbortSignal.timeout.
// ─────────────────────────────────────────────────────────────────────────────
export type OcrProvider = 'groq' | 'gemini' | 'openai';

/** Providers con API key configurada, en orden de preferencia (groq, gemini, openai). */
export function listConfiguredProviders(): OcrProvider[] {
    const out: OcrProvider[] = [];
    if (process.env.GROQ_API_KEY) out.push('groq');
    if (process.env.GEMINI_API_KEY) out.push('gemini');
    if (process.env.OPENAI_API_KEY) out.push('openai');
    return out;
}

export function extractReceiptWith(
    provider: OcrProvider,
    base64Image: string,
    mimeType: string = 'image/png',
): Promise<OcrResult> {
    switch (provider) {
        case 'groq': return extractWithGroq(base64Image, mimeType);
        case 'gemini': return extractWithGemini(base64Image, mimeType);
        case 'openai': return extractWithOpenAI(base64Image, mimeType);
    }
}
