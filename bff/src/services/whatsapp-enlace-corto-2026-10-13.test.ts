/**
 * 2026-10-13: el bot manda la página corta del cobro (/p/:token) y no la URL
 * firmada de Wompi (~400 caracteres, vencía en 1 hora). La página arma el mismo
 * checkout con el monto exacto al tocar «Pagar en línea». Sin red ni base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
    filas: [] as any[],
    link: vi.fn(),
    emitir: vi.fn(),
}));

vi.mock('../config/supabase', () => {
    const builder: any = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte']) builder[m] = () => builder;
    builder.then = (res: any, rej: any) => Promise.resolve({ data: h.filas, error: null }).then(res, rej);
    return { supabase: { from: () => builder } };
});
vi.mock('./cobro-enlace-publico.service', () => ({ emitirTokenCobro: h.emitir }));
vi.mock('./wompi-link-con-monto.service', () => ({ crearLinkWompiConMonto: h.link }));

import { conEnlacesDePago, lineaPagar, botonPagarUnico, instruccionesDeLaPaginaDeCobro } from './whatsapp-enlaces-de-pago.service';

const PAGINA = 'https://app.sportmaps.co/p/abcdefghijklmnopqrstuvwx';
const WOMPI = 'https://checkout.wompi.co/p/?public-key=pub_prod_x&currency=COP&amount-in-cents=15000000'
    + '&reference=SCH-A-B&signature:integrity=' + 'f'.repeat(64) + '&expiration-time=2026-10-13T20:00:00.000Z'
    + '&redirect-url=' + encodeURIComponent(PAGINA);
const pago = { concept: 'Mensualidad Octubre', due_date: '2026-10-10', amount: 150000, status: 'pending', debe_pagarse: true };

beforeEach(() => {
    h.filas = [{ id: 'p1', concept: 'Mensualidad Octubre', amount: 150000, due_date: '2026-10-10', status: 'pending' }];
    h.link.mockReset();
    h.emitir.mockReset();
});

describe('enlace corto del bot', () => {
    it('con pago en línea manda la página del cobro, no la URL de Wompi', async () => {
        h.link.mockResolvedValue({ ok: true, url: WOMPI, paginaCobro: PAGINA, total: 150000, base: 150000, recargo: 0, minutos: 60 });
        const [p] = await conEnlacesDePago([pago] as any[], 'parent-1', 'school-1');
        expect(p.enlace_pago).toBe(PAGINA);
        expect(p.enlace_pago!.length).toBeLessThan(60);
        expect(p.enlace_vence_min).toBeUndefined();
        expect(p.enlace_instrucciones).toBe('Ahí puedes pagar en línea o ver los datos para transferir; si pagas en línea, el pago queda aplicado solo.');
        expect(lineaPagar(p)).toBe(`   Pagar: ${PAGINA}\n   (${p.enlace_instrucciones})`);
        expect(lineaPagar(p)).not.toMatch(/checkout\.wompi|hora para pagar/);
        expect(botonPagarUnico([p])).toEqual({ texto: 'Pagar', url: PAGINA });
    });

    it('si no hay página (sin token), sigue la URL de Wompi con su plazo', async () => {
        h.link.mockResolvedValue({ ok: true, url: WOMPI, paginaCobro: null, total: 150000, base: 150000, recargo: 0, minutos: 60 });
        const [p] = await conEnlacesDePago([pago] as any[], 'parent-1', 'school-1');
        expect(p.enlace_pago).toBe(WOMPI);
        expect(p.enlace_vence_min).toBe(60);
    });

    it('sin pago en línea: la página del cobro, sin instrucciones de pago en línea', async () => {
        h.link.mockResolvedValue({ ok: false, code: 'sin_pago_en_linea', error: '' });
        h.emitir.mockResolvedValue('abcdefghijklmnopqrstuvwx');
        const [p] = await conEnlacesDePago([pago] as any[], 'parent-1', 'school-1');
        expect(p.enlace_pago).toBe(PAGINA);
        expect(p.enlace_instrucciones).toBeUndefined();
        expect(lineaPagar(p)).toBe(`   Pagar: ${PAGINA}`);
    });

    it('con recargo de la escuela, lo dice; con aviso registrado, promete avisar', () => {
        expect(instruccionesDeLaPaginaDeCobro(true, { total: 157500, recargo: 7500 }))
            .toBe('El pago en línea es de $157.500 (incluye $7.500 de recargo de la app). Si transfieres directo a la escuela no pagas recargo: son $150.000. Ahí puedes pagar en línea o ver los datos para transferir; si pagas en línea, el pago queda aplicado solo y te aviso por aquí.');
    });

    it('sin recargo (escuela con 0 %) no menciona recargo ni inventa un valor aparte', () => {
        const t = instruccionesDeLaPaginaDeCobro(false, { total: 150000, recargo: 0 });
        expect(t).not.toMatch(/recargo/i);
    });
});
