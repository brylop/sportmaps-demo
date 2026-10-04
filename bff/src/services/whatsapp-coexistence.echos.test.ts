/**
 * Echos de Coexistence: un echo de una PERSONA cierra la conversación; el
 * saludo / mensaje de ausencia que manda sola la app WhatsApp Business no.
 *
 * Caso real (Dynasty, 2026-10-03): "Gracias por comunicarte con Dynasty…" salió
 * 7 veces a 7 contactos, entre 1 y 8 s después del entrante. Antes cerraba la
 * conversación y el buzón la daba por atendida sin que nadie hubiera contestado.
 *
 * Supabase moqueado en memoria: filtra de verdad en eq / not / gte / lte.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({ tablas: {} as Record<string, Record<string, any>[]> }));

vi.mock('../config/supabase', () => {
    const valor = (f: Fila, c: string) => c.split('->').reduce((o: any, k) => (o == null ? undefined : o[k]), f);
    function builder(tabla: string) {
        let filtros: ((f: Fila) => boolean)[] = [];
        let cambios: Fila | null = null;
        let alta: Fila | null = null;
        let opciones: any = null;
        let limite = Infinity;
        const coinciden = () => (estado.tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filtros.push((f) => valor(f, c) === v); return api; },
            not: (c: string, _op: string, _v: any) => { filtros.push((f) => valor(f, c) != null); return api; },
            gte: (c: string, v: any) => { filtros.push((f) => valor(f, c) >= v); return api; },
            lte: (c: string, v: any) => { filtros.push((f) => valor(f, c) <= v); return api; },
            order: () => api,
            limit: (n: number) => { limite = n; return api; },
            update: (c: Fila) => { cambios = c; return api; },
            upsert: (c: Fila, o?: any) => { alta = c; opciones = o; return api; },
            maybeSingle: async () => resolver(true),
            single: async () => resolver(true),
            then: (ok: any, ko: any) => Promise.resolve(resolver(false)).then(ok, ko),
        };
        function resolver(uno: boolean) {
            estado.tablas[tabla] ??= [];
            if (alta) {
                const claves: string[] = String(opciones?.onConflict ?? '').split(',').filter(Boolean);
                const ya = estado.tablas[tabla].find((f) => claves.length && claves.every((k) => f[k] === (alta as Fila)[k]));
                if (ya) return { data: opciones?.ignoreDuplicates ? null : ya, error: null };
                const nueva = { id: `${tabla}-${estado.tablas[tabla].length + 1}`, ...alta };
                estado.tablas[tabla].push(nueva);
                return { data: nueva, error: null };
            }
            const filas = coinciden().slice(0, limite);
            if (cambios) for (const f of filas) Object.assign(f, cambios);
            return { data: uno ? filas[0] ?? null : filas, error: null };
        }
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

vi.mock('./whatsapp.service', () => ({
    resolveIntegration: async (id: string) => (id === 'pn-1' ? { id: 'int-1', school_id: 'school-1' } : null),
}));

const { procesarEchos, necesitaReabrir } = await import('./whatsapp-coexistence.service');

const SALUDO = 'Gracias por comunicarte con Dynasty D.C😃🏐 Club y escuela de fútbol. En breve te respondemos.';
const BASE = Math.floor(Date.UTC(2026, 9, 3, 15) / 1000);

/** Webhook `smb_message_echoes` con un echo. */
const webhook = (id: string, to: string, texto: string, seg = 0) => ({
    entry: [{ changes: [{
        field: 'smb_message_echoes',
        value: {
            metadata: { phone_number_id: 'pn-1' },
            message_echoes: [{ id, from: '573000000000', to, type: 'text', text: { body: texto }, timestamp: String(BASE + seg) }],
        },
    }] }],
});

const conv = (contacto: string) => estado.tablas.whatsapp_conversations.find((c) => c.contact_wa_id === contacto)!;
const msg = (waId: string) => estado.tablas.whatsapp_messages.find((m) => m.wa_message_id === waId)!;
const entrante = (convId: string, seg: number) => ({
    id: `in-${convId}-${seg}`, conversation_id: convId, integration_id: 'int-1', direction: 'inbound',
    ai_generated: false, wa_timestamp: new Date((BASE + seg) * 1000).toISOString(), payload: { from: 'x' },
});

beforeEach(() => {
    estado.tablas = {
        whatsapp_conversations: ['571', '572', '573', '574'].map((t) => ({
            id: `conv-${t}`, integration_id: 'int-1', school_id: 'school-1', contact_wa_id: t, status: 'open',
        })),
        whatsapp_messages: [],
    };
    for (const t of ['571', '572', '573', '574']) estado.tablas.whatsapp_messages.push(entrante(`conv-${t}`, -2));
});

describe('procesarEchos', () => {
    it('echo de una persona: se guarda sin marca y cierra la conversación', async () => {
        await procesarEchos(webhook('w1', '571', 'Hola, ya te confirmo el horario del sábado'));
        expect(msg('w1').payload.automatico).toBeUndefined();
        expect(conv('571').status).toBe('closed');
    });

    it('el saludo a 2 contactos todavía se toma por humano; el 3.º lo destapa: marca los 3 y reabre los 2 hilos', async () => {
        await procesarEchos(webhook('w1', '571', SALUDO, 0));
        await procesarEchos(webhook('w2', '572', SALUDO, 60));
        expect(conv('571').status).toBe('closed');
        expect(conv('572').status).toBe('closed');

        await procesarEchos(webhook('w3', '573', SALUDO.toUpperCase(), 120));
        expect(msg('w3').payload.automatico).toBe(true);
        expect(msg('w1').payload.automatico).toBe(true);
        expect(msg('w2').payload.automatico).toBe(true);
        // El automático no cierra, y los cerrados por error vuelven a 'open'.
        expect(conv('573').status).toBe('open');
        expect(conv('571').status).toBe('open');
        expect(conv('572').status).toBe('open');
    });

    it('con el texto ya conocido, el siguiente saludo no cierra desde el primer momento', async () => {
        for (const [i, t] of ['571', '572', '573'].entries()) await procesarEchos(webhook(`w${i}`, t, SALUDO, i));
        await procesarEchos(webhook('w9', '574', SALUDO, 10));
        expect(msg('w9').payload.automatico).toBe(true);
        expect(conv('574').status).toBe('open');
    });

    it('el mismo echo reenviado por Meta no cuenta como otro contacto', async () => {
        await procesarEchos(webhook('w1', '571', SALUDO));
        await procesarEchos(webhook('w1', '571', SALUDO));
        await procesarEchos(webhook('w2', '572', SALUDO, 5));
        expect(msg('w2').payload.automatico).toBeUndefined();
        expect(conv('572').status).toBe('closed');
    });

    it('texto corto repetido a 3 contactos ("Hola cómo estás") sigue siendo humano', async () => {
        for (const [i, t] of ['571', '572', '573'].entries()) await procesarEchos(webhook(`w${i}`, t, 'Hola cómo estás', i));
        expect(conv('573').status).toBe('closed');
        expect(msg('w2').payload.automatico).toBeUndefined();
    });
});

describe('necesitaReabrir', () => {
    const m = (direction: string, min: number, automatico = false) => ({
        direction, wa_timestamp: new Date(Date.UTC(2026, 9, 3, 10, min)).toISOString(),
        payload: automatico ? { automatico: true } : {},
    });

    it('lo último es el automático y nadie contestó después del entrante → reabrir', () => {
        expect(necesitaReabrir([m('inbound', 0), m('outbound', 1, true)])).toBe(true);
        expect(necesitaReabrir([m('outbound', 0), m('inbound', 5), m('outbound', 6, true)])).toBe(true);
    });

    it('cerrada a mano tras "ok, gracias" (lo último es el entrante) → no se toca', () => {
        expect(necesitaReabrir([m('inbound', 0), m('outbound', 1, true), m('outbound', 2), m('inbound', 3)])).toBe(false);
    });

    it('una persona contestó después del entrante → no', () => {
        expect(necesitaReabrir([m('inbound', 0), m('outbound', 2), m('outbound', 3, true)])).toBe(false);
    });
});
