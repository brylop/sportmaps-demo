/**
 * P10 (análisis 2026-10-06): el 06-oct 23 de 25 respuestas del modelo salieron
 * por Groq. En la base, desde el 16-sep Gemini no contesta NINGUNA primera
 * llamada (la que lleva las tools) y sí algunas de redacción (sin tools): el
 * rechazo está en cómo se declaran las tools, no en la llave.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chatWithTools, type LlmTool } from './llm.service';

const TOOLS: LlmTool[] = [
    { name: 'get_payment_status', description: 'x', parameters: { type: 'object', properties: {}, required: [] } },
    {
        name: 'escalate_to_human', description: 'y',
        parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: [] },
    },
];

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.GEMINI_API_KEY = 'k';
    process.env.GROQ_API_KEY = 'k';
    delete process.env.WHATSAPP_LLM_PROVIDER;
});
afterEach(() => vi.unstubAllGlobals());

const ok = (json: any) => ({ ok: true, status: 200, json: async () => json });
const falla = (status: number, message: string) => ({ ok: false, status, json: async () => ({ error: { message } }) });

describe('Gemini', () => {
    it('declara las tools sin `properties: {}` ni `required: []`', async () => {
        fetchMock.mockResolvedValue(ok({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }));
        await chatWithTools({ system: 's', messages: [{ role: 'user', content: 'hola' }], tools: TOOLS });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        const [sinParams, conParams] = body.tools[0].function_declarations;
        expect(sinParams).toEqual({ name: 'get_payment_status', description: 'x' });
        expect(conParams.parameters).toEqual({ type: 'object', properties: { reason: { type: 'string' } } });
    });

    it('el resultado de una tool va como texto, no como functionResponse huérfano', async () => {
        fetchMock.mockResolvedValue(ok({ candidates: [{ content: { parts: [{ text: 'listo' }] } }] }));
        await chatWithTools({
            system: 's',
            messages: [
                { role: 'user', content: '¿cuánto debo?' },
                { role: 'assistant', content: 'Llamando get_payment_status' },
                { role: 'tool', toolName: 'get_payment_status', content: '[{"saldo":1}]' },
            ],
        });
        const { contents } = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(JSON.stringify(contents)).not.toContain('functionResponse');
        expect(contents[2].parts[0].text).toContain('Resultado de get_payment_status');
    });

    it('si Gemini falla pasa a Groq, y si fallan los dos el error nombra a ambos', async () => {
        fetchMock
            .mockResolvedValueOnce(falla(400, 'bad schema'))
            .mockResolvedValueOnce(falla(500, 'caído'));
        await expect(chatWithTools({ system: 's', messages: [{ role: 'user', content: 'x' }], tools: TOOLS }))
            .rejects.toThrow(/gemini: gemini_400: bad schema \| groq: groq_500: caído/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('Groq (OpenAI-compatible)', () => {
    it('el resultado de una tool va como texto del usuario, no como `role: tool` huérfano', async () => {
        fetchMock.mockResolvedValue(ok({ choices: [{ message: { content: 'listo' } }] }));
        await chatWithTools({
            system: 's',
            provider: 'groq',
            messages: [
                { role: 'user', content: '¿cómo edito mi equipo?' },
                { role: 'assistant', content: 'Llamando search_help_articles' },
                { role: 'tool', toolName: 'search_help_articles', content: '[{"slug":"x"}]' },
            ],
        });
        const { messages } = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(messages.some((m: any) => m.role === 'tool' || m.tool_call_id)).toBe(false);
        expect(messages[3]).toMatchObject({ role: 'user' });
        expect(messages[3].content).toContain('Resultado de search_help_articles');
    });
});
