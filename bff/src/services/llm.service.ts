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

const GEMINI_MODEL = process.env.WHATSAPP_GEMINI_MODEL || 'gemini-2.5-flash';

// Proveedores OpenAI-compatibles (mismo shape de request/response).
const OPENAI_COMPAT: Record<string, { baseUrl: string; model: string; keyEnv: string }> = {
    deepseek: {
        baseUrl: 'https://api.deepseek.com',
        model: process.env.WHATSAPP_DEEPSEEK_MODEL || 'deepseek-chat',
        keyEnv: 'DEEPSEEK_API_KEY',
    },
    groq: {
        baseUrl: 'https://api.groq.com/openai/v1',
        model: process.env.WHATSAPP_GROQ_MODEL || 'llama-3.3-70b-versatile',
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

    // Mapear mensajes al formato de Gemini (contents con role user/model + functionResponse).
    const contents: any[] = [];
    for (const m of messages) {
        if (m.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: m.content }] });
        } else if (m.role === 'assistant') {
            contents.push({ role: 'model', parts: [{ text: m.content }] });
        } else if (m.role === 'tool') {
            contents.push({
                role: 'user',
                parts: [{
                    functionResponse: {
                        name: m.toolName,
                        response: { result: safeParse(m.content) },
                    },
                }],
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
            function_declarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            })),
        }];
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json: any = await res.json();
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
    });
    const json: any = await res.json();
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
    const order: LlmProvider[] = [primary, ...(['gemini', 'groq', 'deepseek'] as LlmProvider[])]
        .filter((p, i, a) => a.indexOf(p) === i);

    let lastErr: any;
    for (const p of order) {
        try {
            return await run(p);
        } catch (err: any) {
            lastErr = err;
            console.warn(`[llm.service] ${p} falló (${err?.message}); intento siguiente`);
        }
    }
    throw lastErr || new Error('todos los proveedores LLM fallaron');
}

function safeParse(s: unknown): any {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return s; }
}
