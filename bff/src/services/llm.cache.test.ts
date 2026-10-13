/**
 * Auditoría 2026-10-10 (5): caché de prompt.
 *
 * El prefijo que cachea Claude es herramientas → sistema → mensajes. La
 * segunda llamada del turno del bot iba con `tools: []`, así que su prefijo era
 * otro y no leía nada de lo que escribió la primera. Ahora va con las mismas
 * herramientas y `tool_choice: none`, y los puntos de corte usan el TTL de
 * CACHE_TTL_CLAUDE (1 h por defecto).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: h.create }; },
}));

import { chatWithTools, cacheControlClaude, CACHE_TTL_CLAUDE, type LlmTool } from './llm.service';

const TOOLS: LlmTool[] = [
    { name: 'get_payment_status', description: 'Estado de pagos', parameters: { type: 'object', properties: {} } },
    { name: 'escalate_to_human', description: 'Pasar a una persona', parameters: { type: 'object', properties: { reason: { type: 'string' } } } },
];
const env = { ...process.env };

beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'k';
    h.create.mockReset();
    h.create.mockResolvedValue({ content: [{ type: 'text', text: 'hola' }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' });
});
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...env }; });

describe('Claude: mismo prefijo en las dos llamadas del turno', () => {
    it('toolChoice none → manda las herramientas con tool_choice {type:none}', async () => {
        await chatWithTools({ system: 'S', messages: [{ role: 'user', content: 'x' }], tools: TOOLS });
        await chatWithTools({ system: 'S', messages: [{ role: 'user', content: 'x' }], tools: TOOLS, toolChoice: 'none' });
        const [b1, b2] = h.create.mock.calls.map((c) => c[0]);
        expect(b2.tools).toEqual(b1.tools);
        expect(b2.system).toEqual(b1.system);
        expect(b1.tool_choice).toBeUndefined();
        expect(b2.tool_choice).toEqual({ type: 'none' });
    });

    it('los dos puntos de corte (sistema y última herramienta) usan el mismo TTL', async () => {
        await chatWithTools({ system: 'S', messages: [{ role: 'user', content: 'x' }], tools: TOOLS });
        const b = h.create.mock.calls[0][0];
        expect(b.system[0].cache_control).toEqual(cacheControlClaude());
        expect(b.tools.at(-1).cache_control).toEqual(cacheControlClaude());
        expect(b.tools[0].cache_control).toBeUndefined();
    });

    it('TTL por defecto 1 h; 5 min = ephemeral sin ttl', () => {
        expect(CACHE_TTL_CLAUDE).toBe(process.env.WHATSAPP_CLAUDE_CACHE_TTL === '5m' ? '5m' : '1h');
        expect(cacheControlClaude('1h')).toEqual({ type: 'ephemeral', ttl: '1h' });
        expect(cacheControlClaude('5m')).toEqual({ type: 'ephemeral' });
    });
});

describe('Gemini y Groq respetan toolChoice none', () => {
    beforeEach(() => {
        delete process.env.ANTHROPIC_API_KEY;
        process.env.GEMINI_API_KEY = 'g';
        process.env.GROQ_API_KEY = 'q';
    });

    it('Gemini: function_calling_config NONE con las mismas declaraciones', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) });
        vi.stubGlobal('fetch', fetchMock);
        await chatWithTools({ system: 'S', messages: [{ role: 'user', content: 'x' }], tools: TOOLS, toolChoice: 'none', provider: 'gemini' });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.tools[0].function_declarations).toHaveLength(2);
        expect(body.tool_config).toEqual({ function_calling_config: { mode: 'NONE' } });
    });

    it('Groq: tool_choice "none"', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200,
            json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
        vi.stubGlobal('fetch', fetchMock);
        await chatWithTools({ system: 'S', messages: [{ role: 'user', content: 'x' }], tools: TOOLS, toolChoice: 'none', provider: 'groq' });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.tools).toHaveLength(2);
        expect(body.tool_choice).toBe('none');
    });
});
