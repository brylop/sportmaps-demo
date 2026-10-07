/**
 * Bandeja de comprobantes: clasificación por motivo, cierre por la escuela y
 * qué filas se cierran solas. Puro, sin base.
 */
import { describe, expect, it, vi } from 'vitest';

// Solo para importar `esRecuperable` sin tocar la base.
vi.mock('../config/supabase', () => ({ supabase: { from: () => ({}) } }));

import {
    clasificarFila, estaCerrada, filasParaAutocierre, marcaDeCierre, motivoDeFila, referenciaUsada,
    resumenDeGrupos, PREFIJO_CERRADA, type PagoMinimo,
} from './whatsapp-bandeja.service';

const fila = (status: string, error_message: string | null, extra: Record<string, any> = {}) =>
    ({ id: 'q', status, error_message, ...extra });

describe('motivoDeFila / clasificarFila', () => {
    it.each([
        ['recuperado: varios_cobros — 2 cobros pendientes y ni el monto…', 'varios_cobros', 'accion'],
        ['recuperado: monto_distinto — leído 25000', 'monto_distinto', 'accion'],
        ['recuperado: sin_familia — el número no está en ninguna ficha', 'sin_familia', 'accion'],
        ['recuperado: destino_ajeno — el dinero fue a 52784471', 'destino_ajeno', 'accion'],
        ['recuperado: otro_concepto — uniforme', 'otro_concepto', 'accion'],
        ['familia_sin_cuenta', 'familia_sin_cuenta', 'accion'],
        ['destino no es de la escuela', 'destino_ajeno', 'accion'],
        ['otro_concepto: Uniforme (pie: «uniforme»)', 'otro_concepto', 'accion'],
        ['pregunta_vencida: la familia no dijo a qué cobro va en 24 h; aplicarlo a mano', 'pregunta_vencida', 'accion'],
        ['recuperado: sin_pendientes — la familia no tiene cobros pendientes', 'sin_pendientes', 'revisar'],
        ['sin pagos pendientes', 'sin_pendientes', 'revisar'],
        ['contacto_no_atendido', 'contacto_no_atendido', 'revisar'],
        ['bot_apagado', 'bot_apagado', 'revisar'],
        ['recuperado: no_es_comprobante — el archivo no es un comprobante', 'no_es_comprobante', 'informativo'],
        ['no es un comprobante', 'no_es_comprobante', 'informativo'],
        ['consulta_no_comprobante:texto', 'no_es_comprobante', 'informativo'],
        ['recuperado: ya_registrado — ya hay un pago paid de 180000', 'ya_registrado', 'informativo'],
        ['referencia ya usada: M123', 'ya_registrado', 'informativo'],
        ['admin no acudiente, comprobante no aplicado', 'enviado_por_equipo', 'informativo'],
    ])('%s → %s / %s', (em, motivo, grupo) => {
        const c = clasificarFila(fila('ignored', em));
        expect(c.motivo).toBe(motivo);
        expect(c.grupo).toBe(grupo);
        expect(c.etiqueta.length).toBeGreaterThan(3);
    });

    it('failed sin motivo conocido pide acción; waiting_user es para revisar', () => {
        expect(clasificarFila(fila('failed', 'no se entendió la elección; va al inbox')).grupo).toBe('accion');
        expect(clasificarFila(fila('waiting_user', null)).motivo).toBe('esperando_familia');
        expect(clasificarFila(fila('waiting_user', null)).grupo).toBe('revisar');
    });

    it('el detalle de la recuperación se separa del código', () => {
        expect(motivoDeFila(fila('ignored', 'recuperado: monto_distinto — leído 150000: MAYOR que X')).detalle)
            .toBe('leído 150000: MAYOR que X');
    });

    it('contacto personal o del equipo baja un escalón', () => {
        expect(clasificarFila(fila('ignored', 'contacto_no_atendido'), 'personal').grupo).toBe('informativo');
        expect(clasificarFila(fila('ignored', 'recuperado: sin_familia — x'), 'personal').grupo).toBe('revisar');
        expect(clasificarFila(fila('ignored', 'destino no es de la escuela'), 'staff').grupo).toBe('revisar');
        // Una familia no baja.
        expect(clasificarFila(fila('ignored', 'familia_sin_cuenta'), 'familia_sin_cuenta').grupo).toBe('accion');
    });

    it('resumen cuenta por grupo', () => {
        const r = resumenDeGrupos([
            clasificarFila(fila('ignored', 'familia_sin_cuenta')),
            clasificarFila(fila('ignored', 'no es un comprobante')),
            clasificarFila(fila('ignored', 'no es un comprobante')),
            clasificarFila(fila('waiting_user', null)),
        ]);
        expect(r).toEqual({ accion: 1, revisar: 1, informativo: 2, total: 4 });
    });
});

describe('cierre por la escuela', () => {
    it('la marca conserva el motivo original y se reconoce como cerrada', () => {
        const m = marcaDeCierre('descartado', 'foto personal | de la familia', 'abcdef12-3456', 'contacto_no_atendido');
        expect(m.startsWith(PREFIJO_CERRADA)).toBe(true);
        expect(m).toContain('descartado — foto personal / de la familia (por abcdef12)');
        expect(m.endsWith('| contacto_no_atendido')).toBe(true);
        expect(estaCerrada(m)).toBe(true);
        expect(estaCerrada('recuperado: ya_registrado — x')).toBe(false);
        expect(estaCerrada(null)).toBe(false);
    });

    it('una fila cerrada no es recuperable por la recuperación', async () => {
        const { esRecuperable } = await import('./whatsapp-recuperacion.service');
        const m = marcaDeCierre('resuelto', 'lo registré en Pagos', 'u', 'recuperado: varios_cobros — x');
        expect(esRecuperable({ status: 'ignored', error_message: m, media_id: 'm' }, true)).toBe(false);
    });
});

describe('filasParaAutocierre', () => {
    const S = 'school-a';
    const pago = (id: string, status: string, school_id = S, ocr_reference: string | null = null): PagoMinimo =>
        ({ id, status, school_id, concept: 'Mensualidad 10/2026', ocr_reference });

    it('cierra ya_registrado con pago vivo de la escuela; deja anulados, ajenos y otros motivos', () => {
        const filas = [
            fila('ignored', 'recuperado: ya_registrado — ya hay un pago paid', { id: 'ok', result_ref_id: 'p1' }),
            fila('ignored', 'recuperado: ya_registrado — x', { id: 'anulado', result_ref_id: 'p2' }),
            fila('ignored', 'recuperado: ya_registrado — x', { id: 'ajeno', result_ref_id: 'p3' }),
            fila('ignored', 'recuperado: varios_cobros — x', { id: 'varios', result_ref_id: 'p1' }),
            fila('ignored', 'referencia ya usada: REF9', { id: 'ref' }),
            fila('ignored', marcaDeCierre('resuelto', 'x', null, 'recuperado: ya_registrado — x'), { id: 'cerrada', result_ref_id: 'p1' }),
        ];
        const porId = new Map([
            ['p1', pago('p1', 'paid')], ['p2', pago('p2', 'cancelled')], ['p3', pago('p3', 'paid', 'school-b')],
        ]);
        const porRef = new Map([['REF9', pago('p9', 'awaiting_approval', S, 'REF9')]]);
        const r = filasParaAutocierre(S, filas, porId, porRef).map((x) => x.fila.id);
        expect(r).toEqual(['ok', 'ref']);
    });

    it('referenciaUsada lee la referencia del worker', () => {
        expect(referenciaUsada('referencia ya usada: 8e7040c3-0461')).toBe('8e7040c3-0461');
        expect(referenciaUsada('no es un comprobante')).toBeNull();
    });
});
