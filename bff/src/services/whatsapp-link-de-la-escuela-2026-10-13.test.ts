/**
 * 2026-10-13 (Dynasty): si la escuela tiene su propio link de pago (Wompi, la
 * familia escribe el valor, sin recargo), el bot usa ESE con el botón «Ir a
 * pagar» y pide el comprobante. No genera el link de la app. Sin red ni base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
    cobros: [] as any[],
    cuentas: null as any,
    link: vi.fn(),
    emitir: vi.fn(),
}));

vi.mock('../config/supabase', () => ({
    supabase: {
        from: (tabla: string) => {
            const builder: any = {};
            for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte']) builder[m] = () => builder;
            builder.then = (res: any, rej: any) => Promise.resolve({
                data: tabla === 'school_settings' ? (h.cuentas ? [{ payment_accounts: h.cuentas }] : []) : h.cobros,
                error: null,
            }).then(res, rej);
            return builder;
        },
    },
}));
vi.mock('./cobro-enlace-publico.service', () => ({ emitirTokenCobro: h.emitir }));
vi.mock('./wompi-link-con-monto.service', () => ({ crearLinkWompiConMonto: h.link }));

import { conEnlacesDePago, lineaPagar, botonPagarUnico, instruccionesDelLinkDeLaEscuela } from './whatsapp-enlaces-de-pago.service';

const LINK = 'https://checkout.wompi.co/l/EJEMPLO';
const pago = (concept: string, amount: number) =>
    ({ concept, due_date: '2026-10-10', amount, status: 'pending', debe_pagarse: true });

beforeEach(() => {
    h.cobros = [
        { id: 'p1', concept: 'Mensualidad Octubre', amount: 150000, due_date: '2026-10-10', status: 'pending' },
        { id: 'p2', concept: 'Seguro', amount: 40000, due_date: '2026-10-10', status: 'pending' },
    ];
    h.cuentas = null;
    h.link.mockReset();
    h.emitir.mockReset();
});

describe('link de pago propio de la escuela', () => {
    it('lo usa en cada pendiente, con el valor a escribir, y no genera el link de la app', async () => {
        h.cuentas = [{ type: 'payment_link', value: LINK, active: true }];
        const out = await conEnlacesDePago([pago('Mensualidad Octubre', 150000), pago('Seguro', 40000)] as any[], 'parent-1', 'school-1');
        expect(out.map((p) => p.enlace_pago)).toEqual([LINK, LINK]);
        expect(out.every((p) => p.enlace_de_la_escuela === true)).toBe(true);
        expect(out[0].enlace_instrucciones).toBe('Toca «Ir a pagar», escribe $150.000 y, al terminar, mándame la foto del comprobante por aquí para que la escuela lo aplique.');
        expect(h.link).not.toHaveBeenCalled();
        expect(h.emitir).not.toHaveBeenCalled();
        expect(lineaPagar(out[0])).toContain('escribe $150.000');
    });

    it('botón «Ir a pagar» aunque haya varios cobros (el link es el mismo)', async () => {
        h.cuentas = [{ type: 'payment_link', value: LINK, active: true }];
        const out = await conEnlacesDePago([pago('Mensualidad Octubre', 150000), pago('Seguro', 40000)] as any[], 'parent-1', 'school-1');
        expect(botonPagarUnico(out)).toEqual({ texto: 'Ir a pagar', url: LINK });
    });

    it('un link inactivo no cuenta: sigue el link de la app', async () => {
        h.cuentas = [{ type: 'payment_link', value: LINK, active: false }];
        h.link.mockResolvedValue({ ok: false, code: 'sin_pago_en_linea', error: '' });
        h.emitir.mockResolvedValue('abcdefghijklmnopqrstuvwx');
        const out = await conEnlacesDePago([pago('Mensualidad Octubre', 150000)] as any[], 'parent-1', 'school-1');
        expect(out[0].enlace_pago).toBe('https://app.sportmaps.co/p/abcdefghijklmnopqrstuvwx');
        expect(out[0].enlace_de_la_escuela).toBeUndefined();
        expect(botonPagarUnico(out)).toEqual({ texto: 'Pagar', url: 'https://app.sportmaps.co/p/abcdefghijklmnopqrstuvwx' });
    });

    it('mora (2026-10-14): el valor es el ACTUAL del cobro y dice cuánto es mora', async () => {
        h.cuentas = [{ type: 'payment_link', value: LINK, active: true }];
        h.cobros = [
            { id: 'p1', concept: 'Mensualidad Octubre', amount: '160000.00', due_date: '2026-10-10', status: 'overdue', late_fee_amount: '10000.00' },
        ];
        const out = await conEnlacesDePago([{ ...pago('Mensualidad Octubre', 160000), status: 'overdue' }] as any[], 'parent-1', 'school-1');
        expect(out[0].enlace_instrucciones).toBe('Toca «Ir a pagar», escribe $160.000 y, al terminar, mándame la foto del comprobante por aquí para que la escuela lo aplique. Incluye recargo por mora: $10.000.');
        expect(lineaPagar(out[0])).toContain('Incluye recargo por mora: $10.000');
        // Sin mora, nada extra.
        expect(instruccionesDelLinkDeLaEscuela(150000, 0)).not.toContain('mora');
        expect(instruccionesDelLinkDeLaEscuela(150000, null)).not.toContain('mora');
    });

    it('sin monto, no inventa un valor', () => {
        expect(instruccionesDelLinkDeLaEscuela(null)).toContain('escribe el valor de tu cobro');
    });
});
