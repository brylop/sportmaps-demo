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
    bank: string | null;
    reference: string | null;
    rawResponse?: string;
    provider: string;
}

const SYSTEM_PROMPT =
    'Eres un extractor de datos de comprobantes de pago colombianos (DaviPlata, Nequi, Bancolombia, BBVA, Davivienda, Movii, etc.). ' +
    'Devuelve UNICAMENTE un JSON valido con el siguiente schema, sin texto adicional:\n' +
    '{\n' +
    '  "amount": <numero sin separadores de miles, sin moneda, ej 150000>,\n' +
    '  "currency": "COP" | "USD" | null,\n' +
    '  "date": "YYYY-MM-DD" o null si no la encuentras,\n' +
    '  "bank": "DaviPlata" | "Nequi" | "Bancolombia" | "BBVA" | "Davivienda" | "Movii" | "Otro" | null,\n' +
    '  "reference": "<numero de operacion/aprobacion/transaccion>" o null\n' +
    '}\n' +
    'Reglas:\n' +
    '- amount: SOLO el monto principal de la transaccion (campo "Valor", "Monto", "Total"). Ignora costos, comisiones, saldos.\n' +
    '- currency: detecta por simbolo ($, COP) o contexto.\n' +
    '- date: convierte cualquier formato a ISO. "Abril 28 de 2026" -> "2026-04-28".\n' +
    '- Si la imagen NO es un comprobante de pago, devuelve todos los campos null.\n' +
    '- Si un campo no es legible, devuelve null para ese campo individualmente.\n' +
    '- NUNCA inventes datos.';

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
function parseLlmJson(content: string, provider: string): OcrResult {
    try {
        const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
        const data = JSON.parse(cleaned);
        return {
            amount: typeof data.amount === 'number' ? data.amount : null,
            currency: typeof data.currency === 'string' ? data.currency : null,
            date: typeof data.date === 'string' ? data.date : null,
            bank: typeof data.bank === 'string' ? data.bank : null,
            reference: typeof data.reference === 'string' ? data.reference : null,
            rawResponse: content,
            provider,
        };
    } catch {
        return {
            amount: null, currency: null, date: null, bank: null, reference: null,
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
