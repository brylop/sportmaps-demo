/**
 * llm.service — Abstracción de LLM con tool-calling para el bot de WhatsApp (WA2).
 *
 * Default: Gemini Flash (baja latencia, buena gobernanza para datos de menores).
 * Fallback: DeepSeek V3 (OpenAI-compatible). Se cambia con WHATSAPP_LLM_PROVIDER.
 *
 * Expone una interfaz única `chatWithTools()` que devuelve, o bien una lista de
 * tool calls que el bot debe ejecutar, o bien texto final. El bot orquesta el
 * loop (ejecutar tool → devolver resultado → pedir redacción final).
 *
 * IMPORTANTE (decisión #6, cero alucinaciones): el bot NUNCA responde datos sin
 * un tool exitoso. Este módulo solo decide QUÉ tool llamar y REDACTA con datos
 * ya obtenidos; no inventa.
 */

export type LlmProvider = 'gemini' | 'deepseek' | 'groq';

export interface LlmTool {
    name: string;
    description: string;
    /** JSON Schema de los parámetros (objeto con properties/required). */
    parameters: Record<string, unknown>;
}

export interface LlmMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    /** Para role 'tool': nombre de la tool cuyo resultado es este mensaje. */
    toolName?: string;
}

export interface LlmToolCall {
    name: string;
    args: Record<string, unknown>;
}

export interface LlmResult {
    /** Si el modelo pidió ejecutar tools. */
    toolCalls?: LlmToolCall[];
    /** Texto final (cuando no hay tool call). */
    text?: string;
    provider: LlmProvider;
}

// 2026-09-04: gemini-2.5-flash quedó 404 ("no longer available to new users")
// — Google retira versiones puntuales de Flash cada pocos meses. Se usa el
// alias `gemini-flash-latest` (Google lo mantiene apuntando al Flash vigente)
// en vez de fijar una versión, para no repetir este apagón.
const GEMINI_MODEL = process.env.WHATSAPP_GEMINI_MODEL || 'gemini-flash-latest';

/**
 * Tope por llamada a un proveedor (P15, análisis 2026-10-06). Sin tope, un
 * proveedor colgado se comía la latencia entera antes de pasar al siguiente:
 * el estado de pagos llegó a tardar 269 s.
 */
const TIMEOUT_LLM_MS = Number(process.env.WHATSAPP_LLM_TIMEOUT_MS) || 20_000;

function sinRequiredVacio(p: Record<string, unknown>): Record<string, unknown> {
    const { required, ...resto } = p as any;
    return Array.isArray(required) && required.length ? { ...resto, required } : resto;
}

/** ¿El esquema de parámetros declara alguna propiedad? */
function tieneParametros(p: Record<string, unknown> | undefined): boolean {
    const props = (p as any)?.properties;
    return !!props && typeof props === 'object' && Object.keys(props).length > 0;
}

// Proveedores OpenAI-compatibles (mismo shape de request/response).
const OPENAI_COMPAT: Record<string, { baseUrl: string; model: string; keyEnv: string }> = {
    deepseek: {
        baseUrl: 'https://api.deepseek.com',
        model: process.env.WHATSAPP_DEEPSEEK_MODEL || 'deepseek-chat',
        keyEnv: 'DEEPSEEK_API_KEY',
    },
    groq: {
        baseUrl: 'https://api.groq.com/openai/v1',
        // `llama-3.3-70b-versatile` daba 404: no existe en nuestra cuenta. De los 14
        // modelos que sí tiene (listados el 2026-09-11), gpt-oss-120b es el único
        // de texto con tool-calling apto para el bot.
        model: process.env.WHATSAPP_GROQ_MODEL || 'openai/gpt-oss-120b',
        keyEnv: 'GROQ_API_KEY',
    },
};

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function chatGemini(
    system: string,
    messages: LlmMessage[],
    tools: LlmTool[],
): Promise<LlmResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurado');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // Mapear mensajes al formato de Gemini (contents con role user/model).
    //
    // El resultado de una tool va como TEXTO del usuario, no como
    // `functionResponse` (2026-10-06). El bot no reenvía el `functionCall`
    // original —arma «Llamando get_payment_status» como texto del modelo—, y
    // Gemini rechaza con 400 un `functionResponse` que no viene justo después
    // de un `functionCall` (y los modelos con «thinking» exigen además la firma
    // del pensamiento de ese call). Era uno de los motivos por los que el 06-oct
    // 23 de 25 respuestas salieron por Groq: la segunda llamada (redactar con
    // el resultado) fallaba siempre en Gemini.
    const contents: any[] = [];
    for (const m of messages) {
        if (m.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: m.content }] });
        } else if (m.role === 'assistant') {
            contents.push({ role: 'model', parts: [{ text: m.content }] });
        } else if (m.role === 'tool') {
            contents.push({
                role: 'user',
                parts: [{ text: `Resultado de ${m.toolName} (datos del sistema, no del acudiente):
${m.content}` }],
            });
        }
    }

    const body: any = {
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    };
    if (tools.length) {
        body.tools = [{
            // Sin `parameters` cuando no hay propiedades: Gemini rechaza un
            // OBJECT con `properties: {}` («should be non-empty for OBJECT
            // type»), y 4 de las 5 tools del bot no llevan parámetros. Con eso
            // la PRIMERA llamada también se caía a Groq.
            // Tampoco `required: []`: mismo validador, mismo riesgo.
            function_declarations: tools.map(t => (tieneParametros(t.parameters)
                ? { name: t.name, description: t.description, parameters: sinRequiredVacio(t.parameters) }
                : { name: t.name, description: t.description })),
        }];
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_LLM_MS),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`gemini_${res.status}: ${json?.error?.message || 'error'}`);
    }

    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const toolCalls: LlmToolCall[] = parts
        .filter((p: any) => p.functionCall)
        .map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));

    if (toolCalls.length) return { toolCalls, provider: 'gemini' };

    const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('').trim();
    return { text, provider: 'gemini' };
}

// ─── Proveedores OpenAI-compatibles (DeepSeek, Groq) ──────────────────────────

async function chatOpenAICompatible(
    provider: 'deepseek' | 'groq',
    system: string,
    messages: LlmMessage[],
    tools: LlmTool[],
): Promise<LlmResult> {
    const cfg = OPENAI_COMPAT[provider];
    const apiKey = process.env[cfg.keyEnv];
    if (!apiKey) throw new Error(`${cfg.keyEnv} no configurado`);

    const oaMessages: any[] = [{ role: 'system', content: system }];
    for (const m of messages) {
        if (m.role === 'tool') {
            oaMessages.push({ role: 'tool', name: m.toolName, content: m.content, tool_call_id: m.toolName });
        } else {
            oaMessages.push({ role: m.role, content: m.content });
        }
    }

    const body: any = {
        model: cfg.model,
        messages: oaMessages,
        temperature: 0.2,
        max_tokens: 1024,
    };
    if (tools.length) {
        body.tools = tools.map(t => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
        }));
        body.tool_choice = 'auto';
    }

    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_LLM_MS),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`${provider}_${res.status}: ${json?.error?.message || 'error'}`);
    }

    const choice = json?.choices?.[0]?.message;
    const rawCalls = choice?.tool_calls ?? [];
    if (rawCalls.length) {
        const toolCalls: LlmToolCall[] = rawCalls
            .map((c: any) => ({ name: c.function?.name, args: safeParse(c.function?.arguments) || {} }))
            .filter((c: LlmToolCall) => c.name);
        if (toolCalls.length) return { toolCalls, provider };
    }
    return { text: (choice?.content || '').trim(), provider };
}

// ─── Entrada pública con fallback ──────────────────────────────────────────────

export async function chatWithTools(params: {
    system: string;
    messages: LlmMessage[];
    tools?: LlmTool[];
    provider?: LlmProvider;
}): Promise<LlmResult> {
    const primary: LlmProvider =
        params.provider || (process.env.WHATSAPP_LLM_PROVIDER as LlmProvider) || 'gemini';
    const tools = params.tools ?? [];

    const run = (p: LlmProvider) =>
        p === 'gemini'
            ? chatGemini(params.system, params.messages, tools)
            : chatOpenAICompatible(p, params.system, params.messages, tools);

    // Cadena: primario → resto (resiliencia si un proveedor está sin saldo/caído).
    //
    // DeepSeek salió el 2026-09-12. Era el TERCER respaldo —solo entraba si
    // Gemini y Groq fallaban a la vez— y a cambio obligaba a declarar una
    // transferencia de datos a China: país sin nivel adecuado de protección
    // según la SIC, con datos de menores y de pagos de familias colombianas
    // de por medio. El amparo habría sido una cláusula contractual con el
    // encargado, y con DeepSeek no hay contrato: es una llave de API y nada
    // más. La política de privacidad no puede afirmar garantías que no
    // existen. Si algún día se firma un DPA, se vuelve a agregar acá.
    const order: LlmProvider[] = [primary, ...(['gemini', 'groq'] as LlmProvider[])]
        .filter((p, i, a) => a.indexOf(p) === i);

    let lastErr: any;
    const fallas: string[] = [];
    for (const p of order) {
        // Un 429 NO es que el proveedor este caido: es que llegamos muy rapido.
        // Antes se pasaba al siguiente sin esperar ni un segundo, y si el
        // siguiente tambien venia saturado la cadena entera se caia y el padre
        // recibia el texto plano de respaldo.
        //
        // Se ve con un solo usuario mandando mensajes cada 15 segundos (chat de
        // prueba, 2026-09-14: el respaldo salio 4 veces). Con treinta familias
        // escribiendo a la vez —un dia de cobro— seria el comportamiento normal,
        // no la excepcion.
        //
        // Dos reintentos cortos absorben la rafaga. Mas que eso no: Meta espera
        // el webhook y el padre esta mirando la pantalla.
        for (let intento = 0; intento < 3; intento++) {
            try {
                return await run(p);
            } catch (err: any) {
                lastErr = err;
                const msg = String(err?.message ?? '');
                const saturado = /\b429\b|rate.?limit|too many requests|quota|resource_exhausted/i.test(msg);

                if (!saturado || intento === 2) {
                    console.warn(`[llm.service] ${p} falló (${msg}); intento siguiente proveedor`);
                    fallas.push(`${p}: ${msg}`);
                    break;
                }
                // 400 ms, 1200 ms. Con jitter para que treinta webhooks
                // simultaneos no reintenten todos en el mismo instante y se
                // vuelvan a saturar entre ellos.
                const espera = 400 * Math.pow(3, intento) * (0.7 + Math.random() * 0.6);
                console.warn(`[llm.service] ${p} saturado; reintento en ${Math.round(espera)} ms`);
                await new Promise((r) => setTimeout(r, espera));
            }
        }
    }
    // El error final nombra a TODOS: antes solo quedaba el del último y la causa
    // de que el primero (Gemini) fallara no se veía en ningún lado.
    throw new Error(fallas.length ? `todos los proveedores LLM fallaron — ${fallas.join(' | ')}`
        : (lastErr?.message || 'todos los proveedores LLM fallaron'));
}

function safeParse(s: unknown): any {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return s; }
}
