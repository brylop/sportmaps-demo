import { describe, expect, it } from 'vitest';
import {
    DIA_MS, analizarConversacion, clasificarComprobante, desenlace, diaBogota, esEscalamiento, leerRango,
    motivoCorto, percentil, serieDiaria, tipoDeMensaje, variantesDeTelefono, type Evento, type MensajeCrudo,
} from './whatsapp-metricas';

const T0 = Date.parse('2026-10-03T15:00:00Z'); // 10:00 en Bogotá
const min = (n: number) => T0 + n * 60_000;
const msg = (p: Partial<MensajeCrudo>): MensajeCrudo => ({ id: 'x', conversation_id: 'c', direction: 'outbound', ...p });

describe('tipoDeMensaje', () => {
    it('clasifica entrante, bot, escalamiento, humano (echo, buzón, borrador aprobado), automático y otro', () => {
        expect(tipoDeMensaje(msg({ direction: 'inbound' }))).toBe('entrante');
        expect(tipoDeMensaje(msg({ ai_generated: true, step: 'get_payment_status' }))).toBe('bot');
        expect(tipoDeMensaje(msg({ ai_generated: true, step: 'escalated' }))).toBe('escalamiento');
        expect(tipoDeMensaje(msg({ ai_generated: false, to: '573001112233' }))).toBe('humano');
        expect(tipoDeMensaje(msg({ ai_generated: false, manual: true }))).toBe('humano');
        // Borrador aprobado sin editar: ai_generated=true, pero lo mandó una persona.
        expect(tipoDeMensaje(msg({ ai_generated: true, aprobado_por: 'u1', step: null }))).toBe('humano');
        expect(tipoDeMensaje(msg({ ai_generated: false, to: '57300', automatico: true }))).toBe('automatico');
        expect(tipoDeMensaje(msg({ id: 'saludo', ai_generated: false, to: '57300' }), new Set(['saludo']))).toBe('automatico');
        expect(tipoDeMensaje(msg({ ai_generated: false }))).toBe('otro');
    });

    it('prospecto sin enlace es escalamiento; con enlace no', () => {
        expect(esEscalamiento('desconocido_tema_escolar', false)).toBe(true);
        expect(esEscalamiento('desconocido_tema_escolar', true)).toBe(false);
        expect(esEscalamiento('debe_registrarse')).toBe(false);
        expect(esEscalamiento('identificacion_ambigua')).toBe(true);
    });
});

describe('analizarConversacion + desenlace', () => {
    const ev = (n: number, tipo: Evento['tipo']): Evento => ({ t: min(n), tipo });

    it('solo bot: el bot respondió y nadie más', () => {
        const r = analizarConversacion([ev(0, 'entrante'), ev(0.1, 'bot'), ev(5, 'entrante'), ev(5.1, 'bot')]);
        expect(desenlace(r)).toBe('solo_bot');
        expect(r.esperas).toEqual([]);
    });

    it('escalada: la espera corre desde el ENTRANTE, no desde el aviso del bot', () => {
        const r = analizarConversacion([
            ev(0, 'entrante'), ev(0.1, 'escalamiento'), ev(3, 'entrante'), ev(30, 'humano'),
        ]);
        expect(desenlace(r)).toBe('escalada');
        expect(r.esperas).toEqual([30 * 60_000]);
    });

    it('escalada en borrador (modo asistido) sin entrante previo arranca en el escalamiento', () => {
        const r = analizarConversacion([ev(10, 'escalamiento'), ev(12, 'entrante'), ev(20, 'humano')]);
        expect(r.esperas).toEqual([10 * 60_000]);
    });

    it('sin bot: mide del primer entrante sin atender hasta el echo; el saludo automático no corta la espera', () => {
        const r = analizarConversacion([
            ev(0, 'entrante'), ev(0.05, 'automatico'), ev(1, 'entrante'), ev(45, 'humano'),
            ev(50, 'entrante'), ev(52, 'humano'),
        ]);
        expect(desenlace(r)).toBe('humano');
        expect(r.esperas).toEqual([45 * 60_000, 2 * 60_000]);
    });

    it('bot respondió y luego una persona también: no es "solo bot" y no hay espera que medir', () => {
        const r = analizarConversacion([ev(0, 'entrante'), ev(0.1, 'bot'), ev(60, 'humano')]);
        expect(desenlace(r)).toBe('humano');
        expect(r.esperas).toEqual([]);
    });

    it('sin respuesta y sin entrante', () => {
        expect(desenlace(analizarConversacion([ev(0, 'entrante'), ev(1, 'automatico')]))).toBe('sin_respuesta');
        expect(desenlace(analizarConversacion([ev(0, 'humano')]))).toBeNull();
    });

    it('ordena los eventos aunque lleguen desordenados', () => {
        const r = analizarConversacion([ev(30, 'humano'), ev(0, 'entrante')]);
        expect(r.esperas).toEqual([30 * 60_000]);
    });
});

describe('percentil', () => {
    it('mediana y p90 con interpolación', () => {
        expect(percentil([], 0.5)).toBeNull();
        expect(percentil([5], 0.9)).toBe(5);
        expect(percentil([1, 2, 3, 4], 0.5)).toBe(2.5);
        expect(percentil([10, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.9)).toBeCloseTo(9.1);
    });
});

describe('serieDiaria', () => {
    it('agrupa por día de Bogotá y rellena los días vacíos', () => {
        // 2026-10-03 23:30 Bogotá = 2026-10-04 04:30Z: sigue siendo el 3 en Bogotá.
        const tarde = Date.parse('2026-10-04T04:30:00Z');
        expect(diaBogota(tarde)).toBe('2026-10-03');
        const s = serieDiaria([
            { t: tarde, tipo: 'entrante' }, { t: tarde, tipo: 'escalamiento' }, { t: tarde, tipo: 'humano' },
            { t: tarde + 2 * DIA_MS, tipo: 'automatico' },
        ], Date.parse('2026-10-02T12:00:00Z'), tarde + 2 * DIA_MS);
        expect(s.map((p) => p.dia)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
        expect(s[1]).toMatchObject({ entrantes: 1, bot: 1, humano: 1 });
        expect(s[2].entrantes + s[2].bot).toBe(0);
        expect(s[3].automatico).toBe(1);
    });
});

describe('clasificarComprobante', () => {
    it('distingue aprobado solo, por la escuela, en revisión, escalado e ignorado', () => {
        const done = { status: 'done', result_type: 'payment_receipt' };
        expect(clasificarComprobante(done, { status: 'paid', approved_by: null })).toBe('aprobado_solo');
        expect(clasificarComprobante(done, { status: 'paid', approved_by: 'u1' })).toBe('aprobado_por_escuela');
        expect(clasificarComprobante(done, { status: 'awaiting_approval' })).toBe('esperando_revision');
        expect(clasificarComprobante(done, { status: 'rejected' })).toBe('rechazado');
        expect(clasificarComprobante({ status: 'ignored', result_type: 'escalated' })).toBe('escalado');
        expect(clasificarComprobante({ status: 'ignored', result_type: 'none' })).toBe('ignorado');
        expect(clasificarComprobante({ status: 'done', result_type: 'none' })).toBe('matricula');
        expect(clasificarComprobante({ status: 'waiting_user' })).toBe('esperando_familia');
        expect(clasificarComprobante({ status: 'pending' })).toBe('en_proceso');
        expect(motivoCorto('referencia ya usada: 123')).toBe('referencia ya usada');
        expect(motivoCorto(null)).toBe('sin motivo');
    });
});

describe('variantesDeTelefono', () => {
    it('cubre +57, 57 y 10 dígitos', () => {
        expect(variantesDeTelefono('573001112233').sort())
            .toEqual(['+573001112233', '3001112233', '573001112233'].sort());
        expect(variantesDeTelefono('')).toEqual([]);
    });
});

describe('leerRango', () => {
    const ahora = Date.parse('2026-10-04T15:00:00Z');
    it('default: últimos 30 días hasta ahora', () => {
        const r = leerRango(undefined, undefined, ahora);
        expect(r).toEqual({ desde: ahora - 30 * DIA_MS, hasta: ahora });
    });
    it('fechas YYYY-MM-DD son días de Bogotá y hasta no pasa de ahora', () => {
        const r = leerRango('2026-10-01', '2026-10-31', ahora) as { desde: number; hasta: number };
        expect(new Date(r.desde).toISOString()).toBe('2026-10-01T05:00:00.000Z');
        expect(r.hasta).toBe(ahora);
    });
    it('rechaza basura, rango invertido y más de 180 días', () => {
        expect(leerRango('ayer', undefined, ahora)).toEqual({ error: 'fecha_invalida' });
        expect(leerRango('2026-10-05', '2026-10-01', ahora)).toEqual({ error: 'rango_invalido' });
        expect(leerRango('2026-01-01', undefined, ahora)).toEqual({ error: 'rango_demasiado_largo' });
    });
});
