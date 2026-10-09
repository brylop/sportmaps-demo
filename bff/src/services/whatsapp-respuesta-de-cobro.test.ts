/**
 * La respuesta a «¿a cuál de tus cobros aplico el comprobante?», de punta a
 * punta contra la fila `waiting_user`.
 *
 * Caso inventado, equivalente al de Dynasty del 2026-10-09: una familia con
 * tres mensualidades iguales pendientes (julio, agosto, septiembre) contesta
 * en lenguaje natural. Antes: «ya pagamos julio» recibía la MISMA lista, y
 * «la mensualidad es de 160 mil porque va solo 2 días» se leía como la opción
 * 2 y aplicaba el comprobante a agosto.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    const state = {
        fila: null as any,
        updates: [] as any[],
    };
    function builder(table: string) {
        const ops: [string, any[]][] = [];
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lt', 'order', 'limit', 'is', 'not', 'or']) {
            b[m] = (...a: any[]) => { ops.push([m, a]); return b; };
        }
        b.update = (row: any) => {
            ops.push(['update', [row]]);
            state.updates.push({ table, row });
            if (table === 'whatsapp_inbound_queue' && state.fila) state.fila = { ...state.fila, ...row };
            return b;
        };
        const resolver = () => {
            if (ops.some(([m]) => m === 'update')) return { data: null, error: null };
            if (table === 'whatsapp_inbound_queue') {
                const f = state.fila && state.fila.status === 'waiting_user' ? { ...state.fila } : null;
                return { data: f, error: null };
            }
            return { data: null, error: null };
        };
        b.maybeSingle = () => Promise.resolve(resolver());
        b.single = b.maybeSingle;
        b.then = (res: any, rej: any) => Promise.resolve(resolver()).then(res, rej);
        return b;
    }
    return {
        state,
        supabase: { from: (t: string) => builder(t), rpc: vi.fn(async () => ({ data: null, error: null })) },
        aplicarComprobante: vi.fn(async () => undefined),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('../jobs/whatsapp-queue.job', () => ({
    aplicarComprobante: h.aplicarComprobante,
    aplicarComprobanteDeFicha: vi.fn(),
}));

import { resolverRespuestaDeCobro, mensajeReintento } from './whatsapp-respuesta-de-cobro.service';
import { mensajeElegirPago, type PagoPendiente } from './whatsapp-receipt-matching.service';

const JUL: PagoPendiente = { id: 'p-jul', amount: 200000, concept: 'Mensualidad 07/2026 - Martina Ruiz',
    due_date: '2026-07-05', child_id: 'c-1', atleta: 'Martina Ruiz' };
const AGO: PagoPendiente = { id: 'p-ago', amount: 200000, concept: 'Mensualidad 08/2026 - Martina Ruiz',
    due_date: '2026-08-05', child_id: 'c-1', atleta: 'Martina Ruiz' };
const SEP: PagoPendiente = { id: 'p-sep', amount: 200000, concept: 'Mensualidad 09/2026 - Martina Ruiz',
    due_date: '2026-09-05', child_id: 'c-1', atleta: 'Martina Ruiz' };

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;

type Salida = { texto: string; paso: string; botones?: any[] };
let salidas: Salida[];
let pases: { resumen: string; mensajeFamilia: string | null }[];
const responder = async (texto: string, paso: string, botones?: any[]) => { salidas.push({ texto, paso, botones }); };
const pasar = async (p: { resumen: string; mensajeFamilia: string | null }) => { pases.push(p); };
const contestar = (texto: string) => resolverRespuestaDeCobro(INTEGRATION, '573001112233', texto, responder, pasar);

beforeEach(() => {
    vi.clearAllMocks();
    salidas = [];
    pases = [];
    h.state.updates = [];
    h.state.fila = {
        id: 'q-1', status: 'waiting_user', school_id: 'school-1', retries: 0,
        pregunta_at: new Date(Date.now() - 60_000).toISOString(),
        pregunta_opciones: [JUL, AGO, SEP],
        pregunta_ocr: { ocr: { amount: 200000 }, sha: 'abc', storagePath: 'x/y.jpg', parentId: 'parent-1' },
    };
});

describe('el caso completo: «ya pagamos julio» → luego discute el valor', () => {
    it('descarta julio, pregunta SOLO entre agosto y septiembre con botones, y después escala con resumen', async () => {
        expect(await contestar('Ya habíamos pagado julio')).toBe(true);

        // Nada se aplicó y la pregunta es otra: solo las dos que quedan.
        expect(h.aplicarComprobante).not.toHaveBeenCalled();
        expect(salidas).toHaveLength(1);
        expect(salidas[0].paso).toBe('ask_cual_pago_acotado');
        expect(salidas[0].texto).toContain('*julio* no');
        expect(salidas[0].texto).toContain('08/2026');
        expect(salidas[0].texto).toContain('09/2026');
        expect(salidas[0].texto).not.toContain('07/2026');
        expect(salidas[0].texto).not.toBe(mensajeElegirPago([JUL, AGO, SEP]));
        expect(salidas[0].botones?.map((b) => b.id)).toEqual(['sm_cobro_1', 'sm_cobro_2']);
        // Las opciones congeladas ahora son las dos: «sm_cobro_1» = agosto.
        expect(h.state.fila.pregunta_opciones.map((p: any) => p.id)).toEqual(['p-ago', 'p-sep']);
        expect(h.state.fila.pregunta_ocr.dice_pagado).toEqual(['julio']);

        // Discute el valor: NO se aplica (antes «2 días» elegía la opción 2).
        expect(await contestar('Y la mensualidad es de $160.000 porque va solo 2 días a la semana')).toBe(true);
        expect(h.aplicarComprobante).not.toHaveBeenCalled();
        expect(pases).toHaveLength(1);
        expect(pases[0].mensajeFamilia).toBe(
            'Le paso esto a la escuela para que revise tu plan y tus pagos. Tu comprobante queda guardado ' +
            'y no lo apliqué a ningún cobro todavía 🙏');
        expect(pases[0].resumen).toContain('julio ya está pagado');
        expect(pases[0].resumen).toContain('su mensualidad es $160.000');
        expect(pases[0].resumen).toContain('va solo 2 días a la semana');
        // Una sola respuesta a la familia (la da el pase), y la fila sale de la espera.
        expect(salidas).toHaveLength(1);
        expect(h.state.fila.status).toBe('failed');
        expect(h.state.fila.error_message).toMatch(/^revision_escuela: /);
    });

    it('después de acotar, el botón 1 aplica a agosto (no a julio)', async () => {
        await contestar('julio ya lo pagué');
        expect(await contestar('1')).toBe(true);
        expect(h.aplicarComprobante).toHaveBeenCalledTimes(1);
        const [, pago, restantes] = h.aplicarComprobante.mock.calls[0] as any[];
        expect(pago.id).toBe('p-ago');
        expect(restantes.map((p: any) => p.id)).toEqual(['p-sep']);
        // La escuela se entera de que dicen que julio está pago, sin otro mensaje a la familia.
        expect(pases).toEqual([expect.objectContaining({ mensajeFamilia: null })]);
        expect(pases[0].resumen).toContain('julio ya está pagado');
    });
});

describe('elegir por mes, «el último», «el más viejo»', () => {
    it.each([
        ['el de septiembre', 'p-sep'],
        ['agosto', 'p-ago'],
        ['es para el último', 'p-sep'],
        ['el más viejo', 'p-jul'],
    ])('«%s» → %s', async (texto, id) => {
        expect(await contestar(texto)).toBe(true);
        expect((h.aplicarComprobante.mock.calls[0] as any[])[1].id).toBe(id);
        expect(pases).toHaveLength(0);
    });

    it('«julio y agosto ya están pagos» deja una sola opción: se aplica a esa', async () => {
        expect(await contestar('julio y agosto ya están pagos')).toBe(true);
        expect((h.aplicarComprobante.mock.calls[0] as any[])[1].id).toBe('p-sep');
        expect(pases[0].resumen).toContain('julio y agosto ya están pagados');
    });
});

describe('nunca el mismo mensaje dos veces', () => {
    it('la repregunta no repite la pregunta original ni a sí misma, y trae botones', async () => {
        await contestar('mmm no estoy segura de eso la verdad, déjame ver');
        h.state.fila.retries = 1;
        await contestar('eso que te mandé');
        expect(salidas.map((s) => s.paso)).toEqual(['ask_cual_pago_reintento', 'ask_cual_pago_reintento']);
        expect(salidas[0].texto).not.toBe(salidas[1].texto);
        for (const s of salidas) {
            expect(s.texto).not.toBe(mensajeElegirPago([JUL, AGO, SEP]));
            expect(s.botones).toHaveLength(3);
        }
        expect(mensajeReintento([JUL, AGO, SEP], 0)).toContain('el mes');
    });

    it('un saludo pegado a la pregunta no se contesta (llegó con el comprobante)', async () => {
        expect(await contestar('Buen día')).toBe(true);
        expect(salidas).toHaveLength(0);
        expect(h.state.fila.retries).toBe(0);
    });

    it('«ya pagué todo» va a la escuela, no se aplica a «todos»', async () => {
        expect(await contestar('ya pagué todo')).toBe(true);
        expect(h.aplicarComprobante).not.toHaveBeenCalled();
        expect(pases[0].resumen).toContain('ya pagó todo lo que figura pendiente');
    });
});
