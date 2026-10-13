/**
 * MEJORA 1 (2026-10-06): cada cobro pendiente del estado de pagos del bot trae
 * su «Pagar: https://app.sportmaps.co/p/<token>», y con UN solo cobro además el
 * botón URL (cta_url). Sin red ni base: Supabase y el emisor de tokens mockeados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
    filas: [] as any[],
    error: null as any,
    emitir: vi.fn(),
    ops: [] as [string, any[]][],
}));

vi.mock('../config/supabase', () => {
    const builder: any = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte']) {
        builder[m] = (...a: any[]) => { h.ops.push([m, a]); return builder; };
    }
    builder.then = (res: any, rej: any) => Promise.resolve({ data: h.filas, error: h.error }).then(res, rej);
    return { supabase: { from: () => builder } };
});
vi.mock('./cobro-enlace-publico.service', () => ({ emitirTokenCobro: h.emitir }));

import {
    emparejarIds, conEnlacesDePago, botonPagarUnico, lineaPagar, MAX_ENLACES_POR_MENSAJE, hayComprobanteEnCamino,
} from './whatsapp-enlaces-de-pago.service';
import { payloadDeCtaUrl } from './whatsapp.service';
import { textoYaPague } from './whatsapp-reglas-turno';

const tok = (n: number) => `tok${String(n).padStart(21, '0')}`; // 24 caracteres
const pago = (concept: string, due: string, amount = 170000, extra: any = {}) =>
    ({ concept, due_date: due, amount, saldo: amount, status: 'pending', debe_pagarse: true, ...extra });

beforeEach(() => {
    h.filas = [];
    h.error = null;
    h.ops = [];
    h.emitir.mockReset();
    h.emitir.mockImplementation(async (id: string) => tok(Number(id.replace(/\D/g, '')) || 0));
    delete process.env.FAMILIAS_APP_URL;
});
afterEach(() => { delete process.env.FAMILIAS_APP_URL; });

describe('emparejarIds', () => {
    it('empareja por concepto + vencimiento + monto y usa cada cobro una sola vez', () => {
        const pagos = [pago('Mensualidad Octubre', '2026-10-10'), pago('Mensualidad Octubre', '2026-10-10')];
        const filas = [
            { id: 'p1', concept: 'Mensualidad Octubre', amount: '170000.00', due_date: '2026-10-10', status: 'pending' },
            { id: 'p2', concept: 'Mensualidad Octubre', amount: 170000, due_date: '2026-10-10T00:00:00', status: 'pending' },
        ];
        expect([...emparejarIds(pagos, filas)]).toEqual([[0, 'p1'], [1, 'p2']]);
    });

    it('no empareja lo resuelto ni un cobro con otro monto (mejor sin enlace que el de otro cobro)', () => {
        const pagos = [
            { ...pago('Mensualidad Septiembre', '2026-09-10'), status: 'paid', debe_pagarse: false },
            pago('Uniforme', '2026-10-01', 90000),
        ];
        const filas = [
            { id: 'p1', concept: 'Mensualidad Septiembre', amount: 170000, due_date: '2026-09-10', status: 'pending' },
            { id: 'p2', concept: 'Uniforme', amount: 95000, due_date: '2026-10-01', status: 'pending' },
        ];
        expect(emparejarIds(pagos, filas).size).toBe(0);
    });

    it(`máximo ${MAX_ENLACES_POR_MENSAJE} enlaces`, () => {
        const pagos = Array.from({ length: 8 }, (_, i) => pago(`C${i}`, '2026-10-10'));
        const filas = pagos.map((p, i) => ({ id: `p${i}`, concept: p.concept, amount: 170000, due_date: '2026-10-10', status: 'pending' }));
        expect(emparejarIds(pagos, filas).size).toBe(MAX_ENLACES_POR_MENSAJE);
    });
});

describe('conEnlacesDePago', () => {
    it('inyecta enlace_pago con la base de PRODUCCIÓN en cada pendiente', async () => {
        h.filas = [{ id: 'p7', concept: 'Mensualidad Octubre', amount: 170000, due_date: '2026-10-10', status: 'pending' }];
        const pagos = [pago('Mensualidad Octubre', '2026-10-10'),
            { concept: 'Mensualidad Septiembre', status: 'paid', debe_pagarse: false }];
        const out = await conEnlacesDePago(pagos as any[], 'parent-1', 'school-1');
        expect(out[0].enlace_pago).toBe(`https://app.sportmaps.co/p/${tok(7)}`);
        expect(out[1].enlace_pago).toBeUndefined();
        expect(h.emitir).toHaveBeenCalledWith('p7');
        // Mismo filtro que la RPC: pagador + escuela + vivos.
        expect(h.ops).toEqual(expect.arrayContaining([
            ['eq', ['parent_id', 'parent-1']], ['eq', ['school_id', 'school-1']],
            ['in', ['status', ['pending', 'partial', 'overdue']]],
        ]));
    });

    it('nunca localhost: con FAMILIAS_APP_URL local no hay enlace y responde igual', async () => {
        process.env.FAMILIAS_APP_URL = 'http://localhost:5173';
        h.filas = [{ id: 'p1', concept: 'Mensualidad Octubre', amount: 170000, due_date: '2026-10-10', status: 'pending' }];
        const pagos = [pago('Mensualidad Octubre', '2026-10-10')];
        const out = await conEnlacesDePago(pagos as any[], 'parent-1', 'school-1');
        expect(out).toEqual(pagos);
    });

    it('sin token (RPC caída) o error de lectura → los pagos tal cual', async () => {
        h.filas = [{ id: 'p1', concept: 'Mensualidad Octubre', amount: 170000, due_date: '2026-10-10', status: 'pending' }];
        h.emitir.mockResolvedValue(null);
        const pagos = [pago('Mensualidad Octubre', '2026-10-10')];
        expect((await conEnlacesDePago(pagos as any[], 'parent-1', 'school-1'))[0].enlace_pago).toBeUndefined();

        h.error = { message: 'boom' };
        expect(await conEnlacesDePago(pagos as any[], 'parent-1', 'school-1')).toEqual(pagos);
    });

    it('sin pagador o sin pendientes no consulta nada', async () => {
        await conEnlacesDePago([pago('X', '2026-10-10')] as any[], null, 'school-1');
        await conEnlacesDePago([{ concept: 'X', debe_pagarse: false }] as any[], 'parent-1', 'school-1');
        expect(h.ops).toEqual([]);
        expect(h.emitir).not.toHaveBeenCalled();
    });
});

describe('botón URL y línea «Pagar»', () => {
    const URL = `https://app.sportmaps.co/p/${tok(1)}`;

    it('botón solo con UN pendiente que trae enlace', () => {
        expect(botonPagarUnico([{ ...pago('A', 'x'), enlace_pago: URL }, { debe_pagarse: false }]))
            .toEqual({ texto: 'Pagar', url: URL });
        expect(botonPagarUnico([{ ...pago('A', 'x'), enlace_pago: URL }, { ...pago('B', 'x'), enlace_pago: URL }])).toBeNull();
        expect(botonPagarUnico([pago('A', 'x')])).toBeNull();
        expect(botonPagarUnico(null)).toBeNull();
    });

    it('lineaPagar', () => {
        expect(lineaPagar({ enlace_pago: URL })).toBe(`   Pagar: ${URL}`);
        expect(lineaPagar({})).toBeNull();
    });

    it('payloadDeCtaUrl arma interactive/cta_url y rechaza lo que Meta no acepta', () => {
        expect(payloadDeCtaUrl('573001112233', 'Tu cobro', 'Pagar', URL)).toEqual({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '573001112233',
            type: 'interactive',
            interactive: {
                type: 'cta_url',
                body: { text: 'Tu cobro' },
                action: { name: 'cta_url', parameters: { display_text: 'Pagar', url: URL } },
            },
        });
        expect(payloadDeCtaUrl('5730', 'x'.repeat(1025), 'Pagar', URL)).toBeNull();
        expect(payloadDeCtaUrl('5730', 'x', 'Pagar', 'http://localhost/p/x')).toBeNull();
        expect(payloadDeCtaUrl('5730', 'x', '', URL)).toBeNull();
    });

    it('«ya pagué»: lo pendiente lleva su enlace en el texto', () => {
        const { texto } = textoYaPague([{ ...pago('Mensualidad Octubre', '2026-10-10'), enlace_pago: URL }], []);
        expect(texto).toContain('• Mensualidad Octubre: $170.000');
        expect(texto).toContain(`Pagar: ${URL}`);
    });
});

// Dynasty 2026-10-09 (inventado): foto del comprobante y, 30 s después, el
// estado de pagos con link. Quedó un `payment_link` sobre el mismo cobro que
// el comprobante pagó.
describe('comprobante en camino: sin link de pago', () => {
    const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

    it('hayComprobanteEnCamino: pendiente, en proceso o esperando respuesta, de los últimos 30 min', () => {
        expect(hayComprobanteEnCamino([{ status: 'processing', message_type: 'image', created_at: hace(1) }])).toBe(true);
        expect(hayComprobanteEnCamino([{ status: 'waiting_user', message_type: 'image', created_at: hace(10) }])).toBe(true);
        expect(hayComprobanteEnCamino([{ status: 'done', message_type: 'image', created_at: hace(1) }])).toBe(false);
        expect(hayComprobanteEnCamino([{ status: 'pending', message_type: 'image', created_at: hace(45) }])).toBe(false);
        expect(hayComprobanteEnCamino([{ status: 'pending', message_type: 'payment_link', created_at: hace(1) }])).toBe(false);
    });

    it('con un comprobante en la cola de ese chat no se emite ni se registra ningún link', async () => {
        h.filas = [
            { id: 'p7', concept: 'Mensualidad Octubre', amount: 170000, due_date: '2026-10-10', status: 'processing',
                message_type: 'image', created_at: hace(0.5) },
        ];
        const pagos = [pago('Mensualidad Octubre', '2026-10-10')];
        const out = await conEnlacesDePago(pagos as any[], 'parent-1', 'school-1', { integrationId: 'int-1', waPhone: '573000000000' });
        expect(out[0]).not.toHaveProperty('enlace_pago');
        expect(h.emitir).not.toHaveBeenCalled();
    });
});
