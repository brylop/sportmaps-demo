/**
 * Aviso del desenlace de un pago por WhatsApp fuera de la ventana de 24 h, con
 * tope de reintentos, y gancho del link de pago (2026-10-07).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const inserts: any[] = [];
let respuestasInsert: any[] = [];

vi.mock('../config/supabase', () => ({
    supabase: {
        from: () => ({
            insert: (v: any) => {
                inserts.push(v);
                return Promise.resolve(respuestasInsert.shift() ?? { error: null });
            },
        }),
        rpc: () => Promise.resolve({ data: null, error: null }),
    },
}));
vi.mock('../services/cobro-enlace-publico.service', () => ({ emitirTokenCobro: () => Promise.resolve(null) }));

import {
    separarAviso, conAviso, siguienteTrasFallo, plantillaDelDesenlace, nombreCorto, textoDelConcepto,
    registrarAvisoDePagoPorLink, idDeFilaLink, MAX_INTENTOS, FILTRO_FILAS_CON_DESENLACE,
} from './whatsapp-payment-outcome.job';
import { ventanaAbierta, esErrorDeVentana } from '../services/whatsapp-plantillas.service';

beforeEach(() => { inserts.length = 0; respuestasInsert = []; });

describe('ventana de 24 h', () => {
    const ahora = Date.parse('2026-10-06T13:48:00Z');
    it('caso real: último entrante el 03-oct, aviso el 06-oct → cerrada', () => {
        expect(ventanaAbierta('2026-10-03T16:49:40Z', ahora)).toBe(false);
    });
    it('entrante hace 2 h → abierta; sin dato → cerrada', () => {
        expect(ventanaAbierta(new Date(ahora - 2 * 3600_000).toISOString(), ahora)).toBe(true);
        expect(ventanaAbierta(null, ahora)).toBe(false);
    });
    it('al borde (23 h 50 min) ya se trata como cerrada', () => {
        expect(ventanaAbierta(new Date(ahora - (24 * 60 - 10) * 60_000).toISOString(), ahora)).toBe(false);
    });
    it('reconoce el error de Meta por código o por texto', () => {
        expect(esErrorDeVentana('Re-engagement message')).toBe(true);
        expect(esErrorDeVentana('(#131047) Message failed to send')).toBe(true);
        expect(esErrorDeVentana('graph_500')).toBe(false);
    });
});

describe('estado del aviso en error_message', () => {
    it('ida y vuelta conservando lo que ya había (recuperación)', () => {
        const base = 'recuperado: en_revision — a Mensualidad 10/2026';
        const em = conAviso(base, { tipo: 'reintento', intentos: 2, proximo: Date.parse('2026-10-07T10:00:00Z') });
        expect(em).toBe(`${base} | aviso_reintento:2:2026-10-07T10:00:00.000Z`);
        const s = separarAviso(em);
        expect(s.base).toBe(base);
        expect(s.aviso).toEqual({ tipo: 'reintento', intentos: 2, proximo: Date.parse('2026-10-07T10:00:00Z') });
    });
    it('sin base: la marca sola', () => {
        expect(conAviso(null, { tipo: 'no_entregado', motivo: 'ventana cerrada; plantilla: sin_optin' }))
            .toBe('aviso_no_entregado: ventana cerrada; plantilla: sin_optin');
        expect(separarAviso('aviso_por_plantilla:pago_confirmado')).toEqual({
            base: null, aviso: { tipo: 'por_plantilla', plantilla: 'pago_confirmado' },
        });
    });
    it('un motivo cualquiera no es un estado', () => {
        expect(separarAviso('familia sin parent_id resoluble').aviso).toEqual({ tipo: 'nuevo' });
        expect(separarAviso(null)).toEqual({ base: null, aviso: { tipo: 'nuevo' } });
    });
});

describe('tope de reintentos', () => {
    it(`reintenta con espera creciente y se rinde al intento ${MAX_INTENTOS}`, () => {
        const ahora = 1_000_000;
        expect(siguienteTrasFallo(1, 'graph_500', ahora)).toEqual({ tipo: 'reintento', intentos: 1, proximo: ahora + 5 * 60_000 });
        expect(siguienteTrasFallo(2, 'graph_500', ahora)).toEqual({ tipo: 'reintento', intentos: 2, proximo: ahora + 20 * 60_000 });
        const fin = siguienteTrasFallo(MAX_INTENTOS, 'graph_500', ahora);
        expect(fin.tipo).toBe('no_entregado');
    });
});

describe('plantilla del desenlace', () => {
    it('pagado de mensualidad o plan → pago_confirmado', () => {
        expect(plantillaDelDesenlace('paid', 'Mensualidad 10/2026 - X')).toEqual({ concepto: 'pago_confirmado' });
        expect(plantillaDelDesenlace('paid', 'Plan PLAN PRO - 08/2026')).toEqual({ concepto: 'pago_confirmado' });
    });
    it('pagado de un uniforme: no pago_confirmado (dice «mensualidad») sino pago_recibido_otro_concepto', () => {
        expect(plantillaDelDesenlace('paid', 'Uniforme talla M')).toEqual({ concepto: 'pago_recibido_otro_concepto' });
        expect(plantillaDelDesenlace('paid', 'Inscripción Torneo Copa Bogotá')).toEqual({ concepto: 'pago_recibido_otro_concepto' });
    });
    it('textoDelConcepto: lo que escribió la escuela, recortado', () => {
        expect(textoDelConcepto('  Uniforme   talla M ')).toBe('Uniforme talla M');
        expect(textoDelConcepto('x'.repeat(80))?.length).toBe(60);
        expect(textoDelConcepto(null)).toBeNull();
    });
    it('rechazado → comprobante_rechazado; glosa → sin plantilla', () => {
        expect(plantillaDelDesenlace('rejected', 'Mensualidad')).toEqual({ concepto: 'comprobante_rechazado' });
        expect(plantillaDelDesenlace('glosado', 'Mensualidad')).toHaveProperty('motivo');
    });
    it('nombreCorto', () => {
        expect(nombreCorto('ISABELLA RODRIGUEZ HERNANDEZ')).toBe('Isabella Rodriguez');
        expect(nombreCorto('  ')).toBeNull();
    });
});

describe('registrarAvisoDePagoPorLink', () => {
    const A = { integrationId: 'int-1', schoolId: 'sch-1', waPhone: '573001234567', paymentId: 'pay-1' };

    it('deja una fila done, rastreable por el cobro y con id idempotente', async () => {
        const r = await registrarAvisoDePagoPorLink(A);
        expect(r).toEqual({ ok: true, yaExistia: false });
        expect(inserts[0]).toMatchObject({
            status: 'done', message_type: 'payment_link', result_type: 'payment_link',
            result_ref_id: 'pay-1', wa_message_id: idDeFilaLink(A),
        });
    });
    it('sin la migración (CHECK 23514) cae a result_type none, reconocible por message_type', async () => {
        respuestasInsert = [{ error: { code: '23514', message: 'chk_wa_queue_result' } }, { error: null }];
        const r = await registrarAvisoDePagoPorLink(A);
        expect(r.ok).toBe(true);
        expect(inserts[1]).toMatchObject({ result_type: 'none', message_type: 'payment_link' });
        expect(FILTRO_FILAS_CON_DESENLACE).toContain('message_type.eq.payment_link');
    });
    it('dos veces el mismo link: no duplica (23505)', async () => {
        respuestasInsert = [{ error: { code: '23505', message: 'dup' } }];
        expect(await registrarAvisoDePagoPorLink(A)).toEqual({ ok: true, yaExistia: true });
    });
    it('otro error: no lanza, lo devuelve', async () => {
        respuestasInsert = [{ error: { code: 'XX', message: 'boom' } }];
        expect(await registrarAvisoDePagoPorLink(A)).toEqual({ ok: false, error: 'boom' });
    });
});
