import Anthropic from '@anthropic-ai/sdk';

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
    /**
     * Texto libre que escribió quien paga (concepto, descripción, mensaje,
     * «motivo»): suele traer el nombre del deportista o el mes. Solo es pista
     * para elegir el cobro entre varios; nunca decide validez.
     */
    description?: string | null;
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
  "description": "<texto libre escrito por quien envia: concepto, descripcion, mensaje o motivo>" | null,
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
            // Modelo de VISION de Groq. Configurable porque Groq rota/retira
            // modelos sin aviso y el nombre hardcodeado ya nos rompio dos veces:
            // llama-3.2-90b-vision-preview fue decommissioned, y despues
            // llama-4-scout empezo a dar 404 ("does not exist or you do not have
            // access to it") — puede ser retiro del modelo O falta de acceso de
            // la cuenta, el error de Groq no distingue.
            // Si Groq falla, la cadena de fallback pasa a Gemini/OpenAI sola.
            model: process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
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
/**
 * OpenAI con un PDF: va por `/v1/responses` con `input_file`, NO por
 * `chat/completions`.
 *
 * `chat/completions` recibe el archivo como `image_url` y responde
 * `400 Invalid MIME type. Only image types are supported.` — no es que OpenAI no
 * lea PDFs, es que ese endpoint no los acepta. Verificado el 2026-09-11 con un
 * comprobante real: mismo PDF, 400 por chat/completions y extracción completa
 * (monto, fecha, banco, referencia, destino) por `/v1/responses`.
 *
 * Importa tener las dos vías porque `evaluatePaymentReceipt` exige que DOS
 * proveedores distintos coincidan para auto-aprobar. Si OpenAI no puede leer
 * PDFs, todo comprobante en PDF cae a revisión manual aunque sea perfecto.
 */
async function extractOpenAIPdf(apiKey: string, base64Pdf: string): Promise<OcrResult> {
    const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0,
            instructions: SYSTEM_PROMPT,
            input: [{
                role: 'user',
                content: [
                    { type: 'input_file', filename: 'comprobante.pdf', file_data: `data:application/pdf;base64,${base64Pdf}` },
                    { type: 'input_text', text: USER_PROMPT },
                ],
            }],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI responses error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json: any = await res.json();
    // `output_text` es el atajo del SDK; por HTTP crudo puede no venir, así que
    // se arma desde `output[].content[].text`.
    const content: string =
        json.output_text
        ?? (json.output ?? [])
            .flatMap((o: any) => o.content ?? [])
            .map((c: any) => c.text)
            .filter(Boolean)
            .join('')
        ?? '';
    return parseLlmJson(content, 'openai');
}

async function extractWithOpenAI(base64Image: string, mimeType: string): Promise<OcrResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

    if (mimeType === 'application/pdf') return extractOpenAIPdf(apiKey, base64Image);

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
// CLAUDE — Anthropic (SDK oficial). Lee imagen y PDF de forma nativa.
//
// Se agregó el 2026-10-05 al recuperar los comprobantes de Dynasty: Gemini
// respondía 503 y OpenAI chocaba con su tope de tokens por minuto, y entre
// corridas el OCR cambiaba la lectura de la misma foto (la misma imagen salía
// «en revisión» en una y «destino ajeno» en otra). Para leer plata de familias
// vale más una lectura estable que una barata.
// ─────────────────────────────────────────────────────────────────────────────
// Sonnet 5.5 por defecto desde el 2026-10-06: el bot y la lectura de
// comprobantes no necesitan Opus y Sonnet cuesta bastante menos. Se cambia sin
// desplegar con la variable de entorno. Haiku 4.5 no acepta `effort`.
const MODELO_CLAUDE_DEFAULT = 'claude-sonnet-5-5';
function modeloClaude(env?: string): string { return (env || '').trim() || MODELO_CLAUDE_DEFAULT; }
function conEsfuerzoBajo(modelo: string): Record<string, unknown> {
    return /haiku/i.test(modelo) ? {} : { output_config: { effort: 'low' } };
}

let anthropicClient: Anthropic | null = null;
function clienteClaude(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurada');
    anthropicClient ??= new Anthropic({ timeout: 60_000, maxRetries: 2 });
    return anthropicClient;
}

async function extractWithClaude(base64Image: string, mimeType: string): Promise<OcrResult> {
    const client = clienteClaude();
    const archivo: any = mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Image } }
        : {
            type: 'image',
            source: {
                type: 'base64',
                media_type: (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
                    ? mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image,
            },
        };

    const res = await client.messages.create({
        model: modeloClaude(process.env.CLAUDE_OCR_MODEL),
        max_tokens: 4000,
        // Extracción de campos: esfuerzo bajo alcanza y abarata.
        ...conEsfuerzoBajo(modeloClaude(process.env.CLAUDE_OCR_MODEL)),
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [archivo, { type: 'text', text: USER_PROMPT }] }],
    } as any);

    if (res.stop_reason === 'refusal') throw new Error('Claude rechazó leer el comprobante');
    const texto = (res.content as any[]).map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return parseLlmJson(texto, 'claude');
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI — Google Gemini Flash (fallback 2)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithGemini(base64Image: string, mimeType: string): Promise<OcrResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

    // 2026-09-04: gemini-2.0-flash y luego gemini-2.5-flash fueron quedando 404
    // ("no longer available to new users") cada pocos meses — Google retira
    // versiones puntuales de Flash a un ritmo muy rápido. Se usa el alias
    // `gemini-flash-latest` (Google lo mantiene apuntando al Flash vigente) en
    // vez de fijar una versión, para no repetir este apagón. Configurable por
    // env si hace falta pinnear una versión concreta.
    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
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
                // Gemini 2.5 Flash es un modelo de "thinking": los tokens de
                // razonamiento se descuentan de maxOutputTokens. Con 500 el JSON
                // salía TRUNCADO (se cortaba a mitad de "reference") → JSON.parse
                // fallaba → todos los campos null. Desactivamos el thinking y
                // damos margen para que el JSON siempre cierre.
                thinkingConfig: { thinkingBudget: 0 },
                maxOutputTokens: 1024,
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
            description: asStr(data.description),
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
    } catch (err) {
        // JSON ilegible (p.ej. truncado por maxOutputTokens): lo dejamos visible
        // en logs para diagnosticar, y tratamos como comprobante no leído.
        console.warn(
            `[OCR] ${provider}: no se pudo parsear el JSON (¿truncado?). ` +
            `len=${content.length} tail=${JSON.stringify(content.slice(-40))}`,
        );
        // isReceipt=true para no rechazar en falso; el pipeline lo mandará a
        // AMARILLO por campos faltantes, no a ROJO.
        return {
            amount: null, currency: null, date: null, time: null, bank: null,
            reference: null, destination: null, destinationName: null, originName: null, description: null,
            isReceipt: true, isTransactionList: false, missingFields: ['amount', 'date', 'reference'],
            rawResponse: content,
            provider,
        };
    }
}

/**
 * ¿Groq puede leer imágenes con la llave actual?
 *
 * Por defecto NO, y no es una sospecha: el 2026-09-11 se listó
 * `GET https://api.groq.com/openai/v1/models` con nuestra llave y devolvió 14
 * modelos, **ninguno de visión** (gpt-oss y qwen son de texto, whisper es audio,
 * prompt-guard clasifica, orpheus es voz). Por eso el OCR por Groq daba 404 y
 * fallaba en silencio durante semanas.
 *
 * Queda fuera de la cadena de OCR, pero `GROQ_OCR_MODEL` sirve de interruptor de
 * reingreso: el día que la cuenta tenga un modelo de visión, se define esa
 * variable con su id y Groq vuelve solo, sin tocar código.
 */
function groqPuedeVer(): boolean {
    return Boolean(process.env.GROQ_OCR_MODEL);
}

/**
 * ¿Este proveedor sabe leer este tipo de archivo?
 *
 * Con PDF quedan Gemini (nativo) y OpenAI (por `/v1/responses`, ver
 * `extractOpenAIPdf`). Groq no: su endpoint es compatible con OpenAI pero solo
 * `chat/completions`, que responde `400 Invalid MIME type. Only image types are
 * supported.` — y ese 400 es PERMANENTE, así que gastar un intento en él solo
 * ensucia el log y retrasa la lectura.
 *
 * Varios bancos colombianos exportan el comprobante en PDF, así que no es un
 * caso de borde: es la mitad de lo que llega.
 */
function proveedorSoportaMime(provider: string, mimeType: string): boolean {
    if (mimeType !== 'application/pdf') return true;
    return provider === 'gemini' || provider === 'openai' || provider === 'claude';
}

export async function extractReceipt(base64Image: string, mimeType: string = 'image/png'): Promise<OcrResult> {
    // Default gemini (antes groq, que hoy da 404 al modelo de vision).
    const order = (process.env.OCR_PROVIDER || 'gemini').toLowerCase();

    const providers: Record<string, () => Promise<OcrResult>> = {
        groq:   () => extractWithGroq(base64Image, mimeType),
        openai: () => extractWithOpenAI(base64Image, mimeType),
        gemini: () => extractWithGemini(base64Image, mimeType),
        claude: () => extractWithClaude(base64Image, mimeType),
    };

    const tryOrder = [order, 'gemini', 'openai', 'claude', 'groq']
        .filter((v, i, a) => a.indexOf(v) === i && providers[v])
        .filter((v) => v !== 'groq' || groqPuedeVer())
        .filter((v) => v !== 'claude' || !!process.env.ANTHROPIC_API_KEY)
        .filter((v) => proveedorSoportaMime(v, mimeType));
    // (el orden de respaldo ya tenia gemini primero; solo cambio el default de `order`)

    if (tryOrder.length === 0) {
        // Mejor un error que nombra el problema que el 400 del primer proveedor
        // que no sabe leerlo.
        throw new Error(`Ningun proveedor de OCR configurado soporta ${mimeType}`);
    }

    let lastErr: Error | null = null;
    const fallas: string[] = [];
    for (const name of tryOrder) {
        try {
            return await providers[name]();
        } catch (err: any) {
            lastErr = err;
            fallas.push(`${name}: ${err?.message ?? err}`);
            console.warn(`[OCR] ${name} fallo, intentando siguiente:`, err.message);
        }
    }
    // Todos los proveedores, no solo el último. El 2026-10-06 las 15 filas de la
    // cola de WhatsApp quedaron con «OPENAI_API_KEY no configurada» —el último
    // de la cadena— y no se veía por qué había fallado Gemini, que va primero.
    throw new Error(fallas.length ? fallas.join(' | ') : (lastErr?.message ?? 'Todos los providers de OCR fallaron'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción por proveedor explícito — para la DOBLE extracción de Fase 5
// (cross-check con dos providers DISTINTOS). Cada uno ya tiene AbortSignal.timeout.
// ─────────────────────────────────────────────────────────────────────────────
export type OcrProvider = 'groq' | 'gemini' | 'openai' | 'claude';

/**
 * Providers con API key configurada, en orden de preferencia.
 *
 * GEMINI VA PRIMERO (antes iba groq). Groq empezo a responder 404 al modelo de
 * vision y, como este orden decide quien lee el comprobante en la doble
 * extraccion, tenerlo de primero costaba un intento fallido por comprobante.
 * Groq queda de ultimo: si algun dia vuelve a servir, entra solo.
 */
export function listConfiguredProviders(): OcrProvider[] {
    const out: OcrProvider[] = [];
    if (process.env.GEMINI_API_KEY) out.push('gemini');
    if (process.env.OPENAI_API_KEY) out.push('openai');
    if (process.env.GROQ_API_KEY && groqPuedeVer()) out.push('groq');
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
        case 'claude': return extractWithClaude(base64Image, mimeType);
    }
}

/**
 * Primer provider de `candidates` que responda, con QUIEN respondio.
 *
 * Existe porque la doble extraccion de Fase 5 llamaba a `extractReceiptWith`
 * pelado con `providers[0]`: si ese provider estaba caido, la excepcion subia
 * hasta el catch de `evaluatePaymentReceipt` y se perdia la evaluacion ENTERA
 * — ni auto-aprobacion ni glosa, el comprobante mudo en la cola y un 200 al
 * cliente. Paso de verdad: Groq empezo a dar 404 y nadie se entero.
 *
 * NO debilita el control: el llamador sigue exigiendo que DOS providers
 * distintos coincidan para aprobar. Esto solo evita que la caida de uno
 * tumbe el proceso completo.
 *
 * Devuelve null si TODOS fallan (ahi si no hay lectura posible).
 */
export async function extractReceiptWithFallback(
    candidates: OcrProvider[],
    base64Image: string,
    mimeType: string = 'image/png',
): Promise<{ provider: OcrProvider; result: OcrResult } | null> {
    // Mismo filtro que `extractReceipt`: con un PDF, OpenAI y Groq devuelven un
    // 400 permanente, y gastar un intento en ellos solo ensucia el log.
    for (const provider of candidates.filter((p) => proveedorSoportaMime(p, mimeType))) {
        try {
            const result = await extractReceiptWith(provider, base64Image, mimeType);
            return { provider, result };
        } catch (err: any) {
            console.warn(`[OCR] ${provider} fallo en doble extraccion:`, err?.message);
        }
    }
    return null;
}
