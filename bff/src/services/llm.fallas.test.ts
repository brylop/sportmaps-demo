/**
 * P1-6 de la auditoría del bot (2026-10-06): la causa de cada caída del modelo
 * tiene que quedar en la base, no solo en los logs de Render. `chatWithTools`
 * devuelve las fallas previas al proveedor que respondió, y si fallan todos,
 * el error las trae en `.fallas`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatWithTools, fallasDeError } from './llm.service';

const ok = (body: any) => ({ ok: true, status: 200, json: async () => body });
const falla = (status: number, msg: string) => ({ ok: false, status, json: async () => ({ error: { message: msg } }) });

let fetchMock: ReturnType<typeof vi.fn>;
const env = { ...process.env };

beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.WHATSAPP_LLM_PROVIDER;
    process.env.GEMINI_API_KEY = 'g';
    process.env.GROQ_API_KEY = 'q';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...env }; });

describe('chatWithTools: fallas consultables', () => {
    it('Gemini 503 y responde Groq → el resultado trae la falla de Gemini', async () => {
        fetchMock
            .mockResolvedValueOnce(falla(503, 'high demand'))
            .mockResolvedValueOnce(ok({ choices: [{ message: { content: 'hola' } }] }));
        const r = await chatWithTools({ system: 's', messages: [{ role: 'user', content: 'x' }] });
        expect(r.provider).toBe('groq');
        expect(r.fallas).toHaveLength(1);
        expect(r.fallas![0]).toMatchObject({ proveedor: 'gemini' });
        expect(r.fallas![0].error).toContain('503');
        expect(typeof r.fallas![0].ms).toBe('number');
    });

    it('responde el primero → sin `fallas`', async () => {
        fetchMock.mockResolvedValueOnce(ok({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }));
        const r = await chatWithTools({ system: 's', messages: [{ role: 'user', content: 'x' }] });
        expect(r.fallas).toBeUndefined();
    });

    it('fallan todos → el error trae cada falla', async () => {
        fetchMock.mockResolvedValue(falla(500, 'boom'));
        const err = await chatWithTools({ system: 's', messages: [{ role: 'user', content: 'x' }] }).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect(fallasDeError(err).map((f) => f.proveedor)).toEqual(['gemini', 'groq']);
        expect(fallasDeError(new Error('otro'))).toEqual([]);
    });
});
