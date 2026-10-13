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
    desenlaceDelPago, textoComprobanteRechazado,
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

describe('desenlace del comprobante (rechazo que no borra la deuda, 2026-10-08)', () => {
    const LLEGO = '2026-10-07T23:36:00Z';

    it('pagado, glosado y el rejected viejo siguen siendo desenlace', () => {
        expect(desenlaceDelPago({ status: 'paid' }, LLEGO)).toBe('paid');
        expect(desenlaceDelPago({ status: 'glosado' }, LLEGO)).toBe('glosado');
        expect(desenlaceDelPago({ status: 'rejected' }, LLEGO)).toBe('rejected');
    });

    it('cobro de vuelta en pending/overdue con rechazo POSTERIOR a la fila → rechazado', () => {
        expect(desenlaceDelPago({ status: 'pending', receipt_rejected_at: '2026-10-08T20:16:00Z' }, LLEGO)).toBe('rejected');
        expect(desenlaceDelPago({ status: 'overdue', receipt_rejected_at: '2026-10-08T20:16:00Z' }, LLEGO)).toBe('rejected');
        expect(desenlaceDelPago({ status: 'partial', receipt_rejected_at: '2026-10-08T20:16:00Z' }, LLEGO)).toBe('rejected');
    });

    it('un rechazo ANTERIOR a la fila es de otro comprobante: no se cuenta', () => {
        expect(desenlaceDelPago({ status: 'pending', receipt_rejected_at: '2026-10-06T10:00:00Z' }, LLEGO)).toBeNull();
    });

    it('en revisión o sin marca: nada que contar', () => {
        expect(desenlaceDelPago({ status: 'awaiting_approval', receipt_rejected_at: '2026-10-08T20:16:00Z' }, LLEGO)).toBeNull();
        expect(desenlaceDelPago({ status: 'pending' }, LLEGO)).toBeNull();
        expect(desenlaceDelPago({ status: 'pending', receipt_rejected_at: null }, LLEGO)).toBeNull();
    });

    it('sin fecha de la fila no afirma nada', () => {
        expect(desenlaceDelPago({ status: 'pending', receipt_rejected_at: '2026-10-08T20:16:00Z' }, null)).toBeNull();
    });

    it('el texto lleva el motivo y dice que el cobro sigue pendiente', () => {
        const t = textoComprobanteRechazado('$ 180.000', 'Mensualidad 10/2026', 'La cuenta de destino no es de la escuela.');
        expect(t).toContain('*Motivo:* La cuenta de destino no es de la escuela.');
        expect(t).toContain('El cobro sigue pendiente');
        expect(textoComprobanteRechazado('$ 1', null, null)).not.toContain('Motivo');
    });
});

describe('pagos únicos (2026-10-10)', () => {
    it('con categoría manda la categoría: inscripción/seguro → pago_recibido_otro_concepto aunque el plan diga MENSUAL', async () => {
        const { plantillaDelDesenlace: p } = await import('./whatsapp-payment-outcome.job');
        expect(p('paid', 'Inscripción — PLAN RM MENSUAL — Atleta', { payment_category: 'inscripcion', payment_type: 'one_time' }))
            .toEqual({ concepto: 'pago_recibido_otro_concepto' });
        expect(p('paid', 'Seguro de accidentes — PGX — Atleta', { payment_category: 'seguro', payment_type: 'one_time' }))
            .toEqual({ concepto: 'pago_recibido_otro_concepto' });
        expect(p('paid', 'Plan PGX — Mensualidad completa', { payment_category: 'mensualidad', payment_type: 'subscription' }))
            .toEqual({ concepto: 'pago_confirmado' });
        // Categoría nueva (lista de pagos únicos por plan): también es otro concepto.
        expect(p('paid', 'Uniforme de gala', { payment_category: 'uniforme_gala', payment_type: 'one_time' }))
            .toEqual({ concepto: 'pago_recibido_otro_concepto' });
    });
    it('sin categoría, el seguro por su texto ya no sale como «la mensualidad de»', async () => {
        const { plantillaDelDesenlace: p } = await import('./whatsapp-payment-outcome.job');
        expect(p('paid', 'Seguro de accidentes — PGX — Atleta')).toEqual({ concepto: 'pago_recibido_otro_concepto' });
    });
    it('«Queda al día» solo si no queda otro cobro vivo', async () => {
        const { cierreDelAvisoDePago: c } = await import('./whatsapp-payment-outcome.job');
        expect(c(0)).toBe(' Queda al día.');
        expect(c(1)).toBe(' Te queda 1 cobro pendiente.');
        expect(c(2)).toBe(' Te quedan 2 cobros pendientes.');
        expect(c(null)).toBe('');
    });
});
