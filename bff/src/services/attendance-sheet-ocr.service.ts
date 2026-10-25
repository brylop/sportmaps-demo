/**
 * attendance-sheet-ocr.service — extracción estructurada de planillas de
 * asistencia en papel (docs/specs/fotos-de-planillas-y-autorregistro.md F1,
 * docs/specs/whatsapp-conversacion-v2-dynasty.md §3.8).
 *
 * Misma cadena de proveedores que enrollment-ocr.service.ts (Gemini → OpenAI →
 * Groq con fallback; mismos timeouts y mismo `OCR_PROVIDER`), otro prompt y otro
 * schema. El LLM SOLO transcribe lo que ve: no decide quién asistió, no traduce
 * siglas y no guarda nada. La traducción de marcas (`interpretarMarca`) es
 * determinista y vive acá, y el guardado SIEMPRE pasa por revisión humana.
 *
 * Leyenda de Dynasty (respuesta de Milena, 2026-10-05):
 *   ✓  X  R  VR  ✓R  «/»  VA  →  ASISTIÓ        ·  R tachada → asistió
 *   celda vacía → «sin marca» (NO es falta: la planilla en papel no marca ausencias)
 *   tachón sobre ✓/X, garabatos, números, anotaciones → «dudosa» (no se interpreta)
 */
import { formatDateInZone } from '../utils/businessDate';

export interface PlanillaColumna {
    /** Etiqueta tal como se ve en el encabezado de la columna ("22", "23/10"). */
    label: string;
    day: number | null;
    month: number | null;
}

export interface PlanillaFila {
    n: number | null;
    /** Tal como está escrito (en Dynasty: APELLIDOS primero). */
    name: string;
    /** etiqueta de columna → texto de la marca. Las celdas vacías NO aparecen. */
    marks: Record<string, string>;
    note: string | null;
    /** Nombre tachado / «Retirada» escrito en la fila. */
    struck: boolean;
}

export interface AttendanceSheetResult {
    isAttendanceSheet: boolean;
    title: string | null;
    /** Equipo/grupo impreso o escrito en el encabezado ("INTERMEDIO", "NUEVA ERA"). */
    groupHeader: string | null;
    /** Mes impreso ("SEPTIEMBRE") si lo hay. */
    monthHeader: string | null;
    columns: PlanillaColumna[];
    rows: PlanillaFila[];
    missingFields: string[];
    rawResponse?: string;
    provider: string;
}

const SYSTEM_PROMPT = `Eres un transcriptor de planillas de ASISTENCIA en papel de escuelas deportivas
colombianas (cuadrícula: una fila por deportista, una columna por día de clase), escritas a mano.
Las fotos pueden venir rotadas, con perspectiva o con la hoja doblada: enderézala mentalmente.
Devuelve UNICAMENTE un JSON valido, sin texto adicional, con este schema:
{
  "is_attendance_sheet": true | false,
  "title": "<titulo impreso de la hoja>" | null,
  "group_header": "<equipo/grupo/categoria del encabezado, tal cual>" | null,
  "month_header": "<mes impreso, ej. SEPTIEMBRE>" | null,
  "columns": [{"label": "<texto del encabezado de la columna, ej. 22>", "day": <numero de dia> | null, "month": <1-12> | null}],
  "rows": [{"n": <numero de fila impreso> | null, "name": "<nombre tal como esta escrito>", "marks": {"<label de columna>": "<marca tal como se ve>"}, "note": "<anotacion al margen de la fila>" | null, "struck": true | false}],
  "missing_fields": ["<cosas de la hoja que no se pueden leer>"]
}
Reglas:
- Transcribe SOLO lo que ves. NUNCA decidas si alguien asistio ni interpretes siglas.
- marks: copia la marca literal ("✓", "X", "R", "VR", "✓R", "/", "VA", "R tachada", "X tachada", "garabato").
  Si la R esta tachada escribe "R tachada". Si un ✓ o una X tienen un tachon encima, escribe "✓ tachado" / "X tachada".
  Las celdas VACIAS no van en marks (omitelas). No inventes marcas para llenar huecos.
- Una marca debe ir en la columna donde esta; si la fila esta corrida +-1 por perspectiva, usa el vertice/centro de la marca.
- columns: en el orden en que aparecen. Si un encabezado de dia esta corregido a mano (23 tachado y 22 escrito), usa el corregido.
- name: copialo tal cual (suele ser APELLIDOS NOMBRES, abreviado o con otra ortografia). Incluye los alumnos escritos a mano al final.
- struck: true si el nombre esta tachado o la fila dice "Retirada/o"; en ese caso pon el texto en note.
- is_attendance_sheet: false si la imagen no es una planilla de asistencia (comprobante, matricula, planilla de PAGOS con valor/fecha/medio, etc.).
- Si la hoja no tiene nombre de grupo visible (tapado/doblado), group_header = null.`;

const USER_PROMPT = 'Transcribe esta planilla de asistencia:';

// ─────────────────────────────────────────────────────────────────────────────
// Proveedores (mismo patrón que enrollment-ocr.service.ts)
// ─────────────────────────────────────────────────────────────────────────────
async function viaGroq(b64: string, mime: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
            temperature: 0, max_tokens: 6000, response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: [{ type: 'text', text: USER_PROMPT }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }] },
            ],
        }),
    });
    if (!res.ok) throw new Error(`Groq API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json: any = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
}

async function viaOpenAI(b64: string, mime: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
    if (mime === 'application/pdf') {
        const res = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST', signal: AbortSignal.timeout(45_000),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini', temperature: 0, instructions: SYSTEM_PROMPT,
                input: [{ role: 'user', content: [
                    { type: 'input_file', filename: 'planilla.pdf', file_data: `data:application/pdf;base64,${b64}` },
                    { type: 'input_text', text: USER_PROMPT },
                ] }],
            }),
        });
        if (!res.ok) throw new Error(`OpenAI responses error ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const json: any = await res.json();
        return json.output_text ?? (json.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text).filter(Boolean).join('');
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: 'gpt-4o-mini', temperature: 0, max_tokens: 6000, response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: [{ type: 'text', text: USER_PROMPT }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }] },
            ],
        }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json: any = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
}

async function viaGemini(b64: string, mime: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
    // Alias, no versión fija (Google retira versiones puntuales de Flash sin aviso).
    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', signal: AbortSignal.timeout(45_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: USER_PROMPT }, { inlineData: { mimeType: mime, data: b64 } }] }],
            generationConfig: {
                temperature: 0,
                // Sin esto los tokens de "thinking" comen maxOutputTokens y el JSON sale truncado.
                thinkingConfig: { thinkingBudget: 0 },
                // Una planilla de 25-40 filas x 8 columnas es mucho más JSON que una matrícula.
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
        }),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json: any = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────
const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const asInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null);

export function parsePlanillaJson(content: string, provider: string): AttendanceSheetResult {
    try {
        const data = JSON.parse(content.replace(/^```json\s*|\s*```$/g, '').trim());
        return {
            isAttendanceSheet: data.is_attendance_sheet === false ? false : true,
            title: asStr(data.title),
            groupHeader: asStr(data.group_header),
            monthHeader: asStr(data.month_header),
            columns: (Array.isArray(data.columns) ? data.columns : [])
                .filter((c: any) => c && (c.label !== undefined && c.label !== null))
                .map((c: any) => ({ label: String(c.label).trim(), day: asInt(c.day), month: asInt(c.month) })),
            rows: (Array.isArray(data.rows) ? data.rows : [])
                .filter((r: any) => r && typeof r.name === 'string' && r.name.trim())
                .map((r: any) => ({
                    n: asInt(r.n),
                    name: r.name.trim(),
                    marks: Object.fromEntries(
                        Object.entries(r.marks && typeof r.marks === 'object' ? r.marks : {})
                            .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
                            .map(([k, v]) => [String(k).trim(), String(v).trim()]),
                    ),
                    note: asStr(r.note),
                    struck: r.struck === true,
                })),
            missingFields: Array.isArray(data.missing_fields) ? data.missing_fields.filter((f: unknown): f is string => typeof f === 'string') : [],
            rawResponse: content,
            provider,
        };
    } catch {
        console.warn(`[AttendanceSheetOCR] ${provider}: JSON no parseable (¿truncado?). len=${content.length} tail=${JSON.stringify(content.slice(-40))}`);
        // isAttendanceSheet=true para no descartar en falso; sin filas queda "por revisar" vacío.
        return { isAttendanceSheet: true, title: null, groupHeader: null, monthHeader: null, columns: [], rows: [],
            missingFields: ['json_no_parseable'], rawResponse: content, provider };
    }
}

function groqPuedeVer(): boolean { return Boolean(process.env.GROQ_OCR_MODEL); }
function soportaMime(provider: string, mime: string): boolean {
    return mime !== 'application/pdf' || provider === 'gemini' || provider === 'openai';
}

export async function extractAttendanceSheet(base64Image: string, mimeType = 'image/jpeg'): Promise<AttendanceSheetResult> {
    const order = (process.env.OCR_PROVIDER || 'gemini').toLowerCase();
    const providers: Record<string, () => Promise<string>> = {
        groq: () => viaGroq(base64Image, mimeType),
        openai: () => viaOpenAI(base64Image, mimeType),
        gemini: () => viaGemini(base64Image, mimeType),
    };
    const tryOrder = [order, 'gemini', 'openai', 'groq']
        .filter((v, i, a) => a.indexOf(v) === i && providers[v])
        .filter((v) => v !== 'groq' || groqPuedeVer())
        .filter((v) => soportaMime(v, mimeType));
    if (tryOrder.length === 0) throw new Error(`Ningun proveedor de OCR configurado soporta ${mimeType}`);

    let lastErr: Error | null = null;
    for (const name of tryOrder) {
        try {
            return parsePlanillaJson(await providers[name](), name);
        } catch (err: any) {
            lastErr = err;
            // 429/cuota: igual que el resto de los OCR, se pasa al siguiente proveedor.
            console.warn(`[AttendanceSheetOCR] ${name} fallo, intentando siguiente:`, err.message);
        }
    }
    throw lastErr ?? new Error('Todos los providers de OCR fallaron');
}

// ─────────────────────────────────────────────────────────────────────────────
// Interpretación determinista de marcas y fechas (sin LLM)
// ─────────────────────────────────────────────────────────────────────────────
export type MarcaInterpretada = 'asistio' | 'sin_marca' | 'dudosa';

const SIGLAS_ASISTIO = new Set(['✓', '✔', '√', 'v', 'x', 'r', 'vr', 'va', '/', '✓r', 'r✓', 'vr✓', '✓vr', 'x✓', '✓x']);

/**
 * Traduce la marca tal como la vio el OCR (leyenda de Dynasty, Milena 2026-10-05).
 * Vacío → `sin_marca` (NO falta). Tachón sobre ✓/X, garabatos, números,
 * «Repetida», «Incapacidad», «Retirada»… → `dudosa`: no cuenta y se muestra al revisar.
 */
export function interpretarMarca(raw: string | null | undefined): MarcaInterpretada {
    const s0 = (raw ?? '').toString().trim().toLowerCase();
    if (!s0 || s0 === '-' || s0 === '—' || s0 === 'null') return 'sin_marca';
    const tachada = /tach|(?:^|[^a-z])sobre(?:[^a-z]|$)|borr|garab/.test(s0);
    // quitar descripciones de color/intensidad: "✓(rojo)", "x (azul)", "x (tenue)"
    const limpia = s0.replace(/\(.*?\)/g, '').replace(/\b(rojo|roja|azul|tenue|negro|verde)\b/g, '').replace(/\s+/g, '').trim();
    if (tachada) {
        // Única tachadura que cuenta: R tachada = asistió (Milena).
        return /^r(\s|\(|$)/.test(s0) && !/[✓x]/.test(s0.replace(/tach\w*/g, '')) ? 'asistio' : 'dudosa';
    }
    return SIGLAS_ASISTIO.has(limpia) ? 'asistio' : 'dudosa';
}

const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
    septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
export function mesDeTexto(t: string | null | undefined): number | null {
    const s = (t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const [k, v] of Object.entries(MESES)) if (s.includes(k)) return v;
    return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const diasDelMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Fecha ISO (YYYY-MM-DD) de cada columna. Mes: el de la columna ("23/10"), si no
 * el del encabezado impreso, si no el mes de `hoy`; y si así el día cae en el
 * futuro se asume el mes anterior (una foto de octubre con la columna «28» es
 * del 28 de septiembre). Devuelve null en las columnas sin día legible.
 */
export function resolverFechasColumnas(
    columnas: PlanillaColumna[], monthHeader: string | null, hoy: string,
): Array<{ label: string; fecha: string | null }> {
    const [hy, hm] = hoy.split('-').map(Number);
    const mesEnc = mesDeTexto(monthHeader);
    return columnas.map((c) => {
        let day = c.day;
        let month = c.month;
        if (day == null) {
            const m = /^(\d{1,2})(?:[\/.-](\d{1,2}))?/.exec(c.label);
            if (m) { day = Number(m[1]); if (m[2] && month == null) month = Number(m[2]); }
        }
        if (day == null || day < 1 || day > 31) return { label: c.label, fecha: null };
        let y = hy;
        let mo = month ?? mesEnc ?? hm;
        if (mo > hm && (month != null || mesEnc != null)) y = hy - 1;        // mes escrito posterior al actual → año pasado
        if (day > diasDelMes(y, mo)) return { label: c.label, fecha: null };
        let fecha = `${y}-${pad(mo)}-${pad(day)}`;
        if (fecha > hoy && month == null && mesEnc == null) {
            mo -= 1; if (mo === 0) { mo = 12; y -= 1; }
            if (day > diasDelMes(y, mo)) return { label: c.label, fecha: null };
            fecha = `${y}-${pad(mo)}-${pad(day)}`;
        }
        return { label: c.label, fecha };
    });
}

/** YYYY-MM-DD en hora Colombia de un instante dado (para fecha de sesión por defecto). */
export function fechaNegocio(ahora: Date): string { return formatDateInZone(ahora); }
