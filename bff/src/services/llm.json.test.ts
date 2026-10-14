/**
 * generarJsonEstructurado (pizarra IA, M3): Claude con structured outputs y
 * respaldo Gemini → Groq. SDK y fetch mockeados: no sale nada a la red.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: h.create }; },
}));

import { generarJsonEstructurado, fallasDeError } from './llm.service';

const SCHEMA = { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { type: 'string' } } };
const env = { ...process.env };

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'k';
  process.env.GEMINI_API_KEY = 'g';
  process.env.GROQ_API_KEY = 'q';
  h.create.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...env }; });

describe('generarJsonEstructurado', () => {
  it('Claude: manda output_config.format json_schema + esfuerzo, y el timeout por llamada', async () => {
    h.create.mockResolvedValue({ model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"a":"b"}' }], usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 5 } });
    const r = await generarJsonEstructurado({ system: 'S', user: 'U', schema: SCHEMA, timeoutMs: 1234 });
    const [body, opts] = h.create.mock.calls[0];
    expect(body.output_config.format).toEqual({ type: 'json_schema', schema: SCHEMA });
    expect(body.output_config.effort).toBe('medium');
    expect(body.messages).toEqual([{ role: 'user', content: 'U' }]);
    expect(opts).toEqual({ timeout: 1234, maxRetries: 0 });
    expect(r).toMatchObject({ texto: '{"a":"b"}', provider: 'claude', tokens: { input: 10, output: 20, cacheRead: 0, cacheWrite: 5 } });
  });

  it('Claude cortado por max_tokens o rechazo → pasa a Gemini (JSON mime)', async () => {
    h.create.mockResolvedValue({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a":' }], usage: {} });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a":"g"}' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generarJsonEstructurado({ system: 'S', user: 'U', schema: SCHEMA });
    expect(r.provider).toBe('gemini');
    expect(r.fallas?.[0].proveedor).toBe('claude');
    const sent = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.system_instruction.parts[0].text).toContain('"additionalProperties":false');
  });

  it('fallan todos → error con las fallas de cada proveedor', async () => {
    h.create.mockRejectedValue(new Error('Request timed out.'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"no"}}', { status: 503 })));
    const err = await generarJsonEstructurado({ system: 'S', user: 'U', schema: SCHEMA }).catch((e) => e);
    expect(fallasDeError(err).map((f) => f.proveedor)).toEqual(['claude', 'gemini', 'groq']);
    expect(err.message).toMatch(/todos los proveedores/);
  });
});
