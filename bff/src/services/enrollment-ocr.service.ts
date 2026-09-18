/**
 * enrollment-ocr.service — Extraccion estructurada de hojas de matricula en
 * papel (deportistas nuevos), fase 2 de
 * docs/specs/alta-atleta-por-foto-hoja-matricula.md.
 *
 * Misma cadena de proveedores que ocr.service.ts (comprobantes de pago), otro
 * prompt y otro schema. El LLM SOLO extrae, nunca decide: la creacion del
 * atleta siempre pasa por revision humana en el inbox (fase 4), nunca
 * automatica — a diferencia de comprobantes, aca un error no rechaza un pago,
 * crea una PERSONA equivocada.
 *
 * Provider por defecto: Gemini Flash (gemini-flash-latest). Fallbacks:
 * OpenAI gpt-4o-mini, Groq (si algun dia vuelve a tener modelo de vision).
 */

export interface EnrollmentFormResult {
    athleteFullName: string | null;
    docType: string | null;        // "CC" | "TI" | "RC" | "CE" | null
    docNumber: string | null;
    dateOfBirth: string | null;    // ISO yyyy-mm-dd
    /** Texto tal como aparece en la hoja (ej. "23 ENERO 1996" o "23/01/96"). */
    dateOfBirthRaw: string | null;
    /** Edad tal como aparece escrita en la hoja, si la hoja la trae. Cruce contra dateOfBirth, no autoridad. */
    ageOnForm: number | null;
    category: string | null;       // texto libre tal como aparece en la hoja
    guardianFullName: string | null;
    guardianDocNumber: string | null;
    guardianPhone: string | null;
    guardianEmail: string | null;
    /** Solo si la hoja trae un correo/telefono propios del deportista, distintos del acudiente. */
    athleteEmail: string | null;
    athletePhone: string | null;
    epsName: string | null;
    bloodType: string | null;      // "O+" | "O-" | "A+" | ... | null
    /** false si la imagen no es una hoja de matricula/afiliacion deportiva. */
    isEnrollmentForm: boolean;
    /** Campos del schema que el modelo NO pudo ver/leer en la imagen. */
    missingFields: string[];
    rawResponse?: string;
    provider: string;
}

// El LLM SOLO extrae. Nunca aprueba ni crea nada. La decision de crear el
// atleta la toma un humano en el inbox (fase 4), siempre — no hay auto-alta
// en ningun caso (ver §2 del plan).
const SYSTEM_PROMPT = `Eres un extractor de datos de hojas de matricula/afiliacion de escuelas deportivas
colombianas, diligenciadas a mano o a maquina. El formato varia entre escuelas: no asumas un layout
fijo, extrae lo que veas sea cual sea el formato de la hoja.
Devuelve UNICAMENTE un JSON valido con este schema, sin texto adicional:
{
  "athlete_full_name": "<nombre completo del deportista>" | null,
  "doc_type": "CC"|"TI"|"RC"|"CE" | null,
  "doc_number": "<numero de documento del deportista>" | null,
  "date_of_birth": "YYYY-MM-DD" | null,
  "date_of_birth_raw": "<fecha tal como aparece escrita en la hoja>" | null,
  "age_on_form": <numero entero, la edad tal como aparece escrita en la hoja> | null,
  "category": "<categoria/division tal como aparece en la hoja, texto libre>" | null,
  "guardian_full_name": "<nombre completo del padre/madre/acudiente>" | null,
  "guardian_doc_number": "<documento del acudiente>" | null,
  "guardian_phone": "<telefono de contacto del acudiente>" | null,
  "guardian_email": "<correo del acudiente>" | null,
  "athlete_email": "<correo PROPIO del deportista, SOLO si la hoja trae uno distinto al del acudiente>" | null,
  "athlete_phone": "<telefono PROPIO del deportista, SOLO si la hoja trae uno distinto al del acudiente>" | null,
  "eps_name": "<nombre de la EPS>" | null,
  "blood_type": "O+"|"O-"|"A+"|"A-"|"B+"|"B-"|"AB+"|"AB-" | null,
  "is_enrollment_form": true | false,
  "missing_fields": ["<campos que NO son visibles o legibles en la imagen>"]
}
Reglas:
- date_of_birth: convierte lo que veas a ISO. Si el formato numerico es ambiguo (dd/mm vs mm/dd),
  usa el criterio mas probable para Colombia (dd/mm/aaaa) pero SIEMPRE llena date_of_birth_raw con
  el texto exacto tal como aparece, para que un humano pueda verificar de donde salio.
- age_on_form: solo si la hoja trae un campo de edad explicito. No lo calcules vos a partir de la
  fecha de nacimiento — reporta el numero tal cual esta escrito, aunque no coincida con la fecha.
- category: copia el texto tal cual aparece (ej. "SENIORS", "SUB-12", "PRIMERA DIVISION"). No lo
  normalices ni lo mapees a nada.
- athlete_email / athlete_phone: llenalos SOLO si la hoja tiene una seccion separada de datos de
  contacto del propio deportista (distinta de la seccion del acudiente). La mayoria de hojas NO
  traen esto — en ese caso, null.
- is_enrollment_form: false si la imagen no es una hoja de matricula/afiliacion deportiva (por
  ejemplo, si es un comprobante de pago, un carnet, o cualquier otro documento).
- missing_fields: lista todo campo del schema que no aparece o no es legible en la imagen.
  Reporta lo que VES; no juzgues si el dato es valido o completo.
- NUNCA inventes datos. Campo no legible = null + entrada en missing_fields.`;

const USER_PROMPT = 'Extrae los datos de esta hoja de matrícula/afiliación deportiva:';

// ─────────────────────────────────────────────────────────────────────────────
// GROQ — Llama vision (si algun dia vuelve a tener modelo de vision)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithGroq(base64Image: string, mimeType: string): Promise<EnrollmentFormResult> {
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
            model: process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
            temperature: 0,
            max_tokens: 800,
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
async function extractOpenAIPdf(apiKey: string, base64Pdf: string): Promise<EnrollmentFormResult> {
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
                    { type: 'input_file', filename: 'hoja-matricula.pdf', file_data: `data:application/pdf;base64,${base64Pdf}` },
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

async function extractWithOpenAI(base64Image: string, mimeType: string): Promise<EnrollmentFormResult> {
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
            max_tokens: 800,
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
// GEMINI — Google Gemini Flash (provider por defecto)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithGemini(base64Image: string, mimeType: string): Promise<EnrollmentFormResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

    // Alias, no version fija: Google retira versiones puntuales de Flash sin
    // aviso (mismo motivo documentado en ocr.service.ts).
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
                // Gemini 2.5 Flash descuenta los tokens de "thinking" de
                // maxOutputTokens; sin esto el JSON sale truncado a mitad de
                // camino (mismo hallazgo que ocr.service.ts). El schema de
                // matricula tiene mas campos que el de comprobantes, por eso
                // el margen es mayor (1536 vs 1024).
                thinkingConfig: { thinkingBudget: 0 },
                maxOutputTokens: 1536,
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
const asInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null);

function parseLlmJson(content: string, provider: string): EnrollmentFormResult {
    try {
        const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
        const data = JSON.parse(cleaned);
        return {
            athleteFullName: asStr(data.athlete_full_name),
            docType: asStr(data.doc_type),
            docNumber: asStr(data.doc_number),
            dateOfBirth: asStr(data.date_of_birth),
            dateOfBirthRaw: asStr(data.date_of_birth_raw),
            ageOnForm: asInt(data.age_on_form),
            category: asStr(data.category),
            guardianFullName: asStr(data.guardian_full_name),
            guardianDocNumber: asStr(data.guardian_doc_number),
            guardianPhone: asStr(data.guardian_phone),
            guardianEmail: asStr(data.guardian_email),
            athleteEmail: asStr(data.athlete_email),
            athletePhone: asStr(data.athlete_phone),
            epsName: asStr(data.eps_name),
            bloodType: asStr(data.blood_type),
            // Default true: solo marcamos "no es hoja de matricula" si el
            // modelo lo afirma explicitamente. Un campo omitido no debe
            // disparar un rechazo falso (mismo criterio que ocr.service.ts).
            isEnrollmentForm: data.is_enrollment_form === false ? false : true,
            missingFields: Array.isArray(data.missing_fields)
                ? data.missing_fields.filter((f: unknown): f is string => typeof f === 'string')
                : [],
            rawResponse: content,
            provider,
        };
    } catch (err) {
        console.warn(
            `[EnrollmentOCR] ${provider}: no se pudo parsear el JSON (¿truncado?). ` +
            `len=${content.length} tail=${JSON.stringify(content.slice(-40))}`,
        );
        // isEnrollmentForm=true para no descartar en falso; queda con todos
        // los campos en missingFields y el humano revisa en el inbox.
        return {
            athleteFullName: null, docType: null, docNumber: null,
            dateOfBirth: null, dateOfBirthRaw: null, ageOnForm: null, category: null,
            guardianFullName: null, guardianDocNumber: null, guardianPhone: null, guardianEmail: null,
            athleteEmail: null, athletePhone: null, epsName: null, bloodType: null,
            isEnrollmentForm: true,
            missingFields: [
                'athlete_full_name', 'doc_number', 'date_of_birth',
                'guardian_full_name', 'guardian_phone', 'guardian_email',
            ],
            rawResponse: content,
            provider,
        };
    }
}

function groqPuedeVer(): boolean {
    return Boolean(process.env.GROQ_OCR_MODEL);
}

function proveedorSoportaMime(provider: string, mimeType: string): boolean {
    if (mimeType !== 'application/pdf') return true;
    return provider === 'gemini' || provider === 'openai';
}

export async function extractEnrollmentForm(
    base64Image: string,
    mimeType: string = 'image/png',
): Promise<EnrollmentFormResult> {
    const order = (process.env.OCR_PROVIDER || 'gemini').toLowerCase();

    const providers: Record<string, () => Promise<EnrollmentFormResult>> = {
        groq:   () => extractWithGroq(base64Image, mimeType),
        openai: () => extractWithOpenAI(base64Image, mimeType),
        gemini: () => extractWithGemini(base64Image, mimeType),
    };

    const tryOrder = [order, 'gemini', 'openai', 'groq']
        .filter((v, i, a) => a.indexOf(v) === i && providers[v])
        .filter((v) => v !== 'groq' || groqPuedeVer())
        .filter((v) => proveedorSoportaMime(v, mimeType));

    if (tryOrder.length === 0) {
        throw new Error(`Ningun proveedor de OCR configurado soporta ${mimeType}`);
    }

    let lastErr: Error | null = null;
    for (const name of tryOrder) {
        try {
            return await providers[name]();
        } catch (err: any) {
            lastErr = err;
            console.warn(`[EnrollmentOCR] ${name} fallo, intentando siguiente:`, err.message);
        }
    }
    throw lastErr ?? new Error('Todos los providers de OCR fallaron');
}
