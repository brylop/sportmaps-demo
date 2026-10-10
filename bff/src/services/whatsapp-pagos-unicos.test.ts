/**
 * Pagos únicos en el lado de WhatsApp (2026-10-10): estado de cuenta del bot,
 * respuesta a «¿a cuál cobro?» y aviso del desenlace. Supabase mockeado con un
 * builder encadenable; datos inventados, sin nombres ni teléfonos reales.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
    filas: [] as any[],
    error: null as any,
    ops: [] as [string, any[]][],
    filaEsperando: null as any,
    updates: [] as any[],
}));

vi.mock('../config/supabase', () => {
    const builder = (table: string) => {
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'order', 'limit', 'neq', 'is', 'not', 'gte', 'lte', 'or']) {
            b[m] = (...a: any[]) => { h.ops.push([`${table}.${m}`, a]); return b; };
        }
        b.update = (v: any) => { h.updates.push({ table, v }); return b; };
        b.maybeSingle = () => Promise.resolve(table === 'whatsapp_inbound_queue'
            ? { data: h.filaEsperando, error: null } : { data: null, error: null });
        b.then = (res: any, rej: any) => Promise.resolve({ data: h.filas, error: h.error }).then(res, rej);
        return b;
    };
    return { supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: null, error: null }) } };
});
vi.mock('./cobro-enlace-publico.service', () => ({ emitirTokenCobro: vi.fn(async () => null) }));
const aplicarComprobanteMock = vi.fn(async (..._a: any[]) => undefined);
vi.mock('../jobs/whatsapp-queue.job', () => ({ aplicarComprobante: (...a: any[]) => aplicarComprobanteMock(...a) }));

import { conTipoDeCobro } from './whatsapp-enlaces-de-pago.service';
import { cubreVariosNoSoloElMasAntiguo, resolverRespuestaDeCobro } from './whatsapp-respuesta-de-cobro.service';
import { rotuloDePagoUnico, botonesDeCobros } from './whatsapp-comprobante-de-ficha.service';
import type { PagoPendiente } from './whatsapp-receipt-matching.service';

beforeEach(() => {
    h.filas = []; h.error = null; h.ops = []; h.filaEsperando = null; h.updates = [];
    aplicarComprobanteMock.mockClear();
});

// Lo que devuelve la RPC wa_get_payment_status (sin id ni categoría).
const rpc = (concept: string, amount: number, extra: any = {}) => ({
    concept, amount, saldo: amount, due_date: '2026-10-10', status: 'pending', debe_pagarse: true, ...extra,
});

describe('conTipoDeCobro: el bot nombra cada pendiente', () => {
    it('empareja con el cobro y nombra por su categoría (mensualidad con categoría NULL incluida)', async () => {
        h.filas = [
            { id: 'm', concept: 'Plan PGX — Mensualidad completa — Atleta Uno', amount: 180000, due_date: '2026-10-10', status: 'pending', payment_category: null, payment_type: 'subscription', period_year: 2026, period_month: 10 },
            { id: 'i', concept: 'Inscripción — PLAN RM MENSUAL — Atleta Uno', amount: 300000, due_date: '2026-10-10', status: 'pending', payment_category: 'inscripcion', payment_type: 'one_time' },
            { id: 's', concept: 'Seguro de accidentes — PGX — Atleta Uno', amount: 35000, due_date: '2026-10-10', status: 'pending', payment_category: 'seguro', payment_type: 'one_time' },
            { id: 't', concept: 'Copa regional — Atleta Uno', amount: 50000, due_date: '2026-10-10', status: 'pending', payment_category: 'uniforme_gala', payment_type: 'one_time' },
        ];
        const pagos = [
            rpc('Plan PGX — Mensualidad completa — Atleta Uno', 180000),
            rpc('Inscripción — PLAN RM MENSUAL — Atleta Uno', 300000),
            rpc('Seguro de accidentes — PGX — Atleta Uno', 35000),
            rpc('Copa regional — Atleta Uno', 50000),
            rpc('Mensualidad 09/2026', 180000, { status: 'paid', debe_pagarse: false }),
        ];
        const out = await conTipoDeCobro(pagos, 'parent-1', 'school-1');
        expect(out.map((p) => p.tipo_cobro)).toEqual([
            'Mensualidad octubre 2026', 'Inscripción', 'Seguro de accidentes', 'Uniforme gala', undefined,
        ]);
        expect(h.ops).toEqual(expect.arrayContaining([
            ['payments.eq', ['parent_id', 'parent-1']], ['payments.eq', ['school_id', 'school-1']],
        ]));
    });

    it('si la lectura falla, se nombra por el concepto (nunca lanza)', async () => {
        h.error = { message: 'boom' };
        const out = await conTipoDeCobro([rpc('Seguro de accidentes — PGX — Atleta Uno', 35000)], 'parent-1', 'school-1');
        expect(out[0].tipo_cobro).toBe('Seguro de accidentes');
    });

    it('sin pendientes no consulta nada y devuelve la lista tal cual', async () => {
        const pagos = [rpc('Mensualidad 09/2026', 1, { debe_pagarse: false })];
        expect(await conTipoDeCobro(pagos, 'parent-1', 'school-1')).toBe(pagos);
        expect(h.ops).toEqual([]);
    });
});

const P = (id: string, amount: number, concept: string, categoria?: string): PagoPendiente =>
    ({ id, amount, concept, due_date: '2026-10-10', child_id: 'c1', atleta: 'Atleta Uno', categoria });
const MEN = P('m', 180000, 'Plan PGX — Mensualidad completa — Atleta Uno', 'mensualidad');
const INS = P('i', 300000, 'Inscripción — PGX — Atleta Uno', 'inscripcion');
const SEG = P('s', 35000, 'Seguro de accidentes — PGX — Atleta Uno', 'seguro');

describe('«los tres» a la pregunta ¿a cuál cobro?', () => {
    it('cubreVariosNoSoloElMasAntiguo: solo cuando el monto suma exacto todos los elegidos', () => {
        expect(cubreVariosNoSoloElMasAntiguo([MEN, INS, SEG], 515000)).toBe(true);
        expect(cubreVariosNoSoloElMasAntiguo([MEN, INS, SEG], 180000)).toBe(false); // pagó el más antiguo
        expect(cubreVariosNoSoloElMasAntiguo([MEN], 180000)).toBe(false);
        expect(cubreVariosNoSoloElMasAntiguo([MEN, INS], null)).toBe(false);
    });

    it('«todos» con $515.000 → a la escuela, sin estampar en el más antiguo', async () => {
        h.filaEsperando = {
            id: 'q1', school_id: 'school-1', retries: 0, pregunta_at: new Date().toISOString(),
            pregunta_opciones: [MEN, INS, SEG],
            pregunta_ocr: { ocr: { amount: 515000 }, sha: 'x', storagePath: 'p', parentId: 'parent-1' },
        };
        const responder = vi.fn(async (..._a: any[]) => undefined);
        const r = await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', 'todos', responder);
        expect(r).toBe(true);
        expect(aplicarComprobanteMock).not.toHaveBeenCalled();
        expect(responder.mock.calls[0][1]).toBe('varios_cobros');
        expect(responder.mock.calls[0][0]).toContain('Seguro de accidentes');
        expect(h.updates.at(-1)?.v).toMatchObject({ status: 'ignored', result_type: 'escalated' });
    });

    it('«todos» con el monto del más antiguo → la regla de siempre: al más antiguo', async () => {
        h.filaEsperando = {
            id: 'q1', school_id: 'school-1', retries: 0, pregunta_at: new Date().toISOString(),
            pregunta_opciones: [MEN, INS, SEG],
            pregunta_ocr: { ocr: { amount: 180000 }, sha: 'x', storagePath: 'p', parentId: 'parent-1' },
        };
        const responder = vi.fn(async (..._a: any[]) => undefined);
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', 'todos', responder);
        expect(aplicarComprobanteMock).toHaveBeenCalledTimes(1);
        expect((aplicarComprobanteMock.mock.calls[0] as any[])[1]).toMatchObject({ id: 'm' });
    });
});

describe('botones de la pregunta', () => {
    it('rotuloDePagoUnico: tipo corto para pagos únicos, null para la mensualidad', () => {
        expect(rotuloDePagoUnico(INS)).toBe('Inscrip.');
        expect(rotuloDePagoUnico(SEG)).toBe('Seguro');
        expect(rotuloDePagoUnico(MEN)).toBeNull();
        // Opciones congeladas antes del cambio (sin categoría): por el concepto.
        expect(rotuloDePagoUnico({ concept: 'Seguro de accidentes — X', due_date: '2026-10-10' })).toBe('Seguro');
        expect(rotuloDePagoUnico({ concept: 'Mensualidad 10/2026', due_date: '2026-10-10' })).toBeNull();
    });
    it('los títulos caben en 20 caracteres', () => {
        const t = botonesDeCobros([MEN, INS, SEG]).map((b) => b.title);
        expect(t).toEqual(['1. Oct $180.000', '2. Inscrip. $300.000', '3. Seguro $35.000']);
        expect(t.every((x) => x.length <= 20)).toBe(true);
    });
});
