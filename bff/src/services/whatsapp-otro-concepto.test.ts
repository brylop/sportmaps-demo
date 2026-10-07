/**
 * «El comprobante dice que NO es la mensualidad» (P0, Dynasty 2026-10-06:
 * perfeccionamiento y uniformes aplicados a la mensualidad → 3 rechazos).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import {
    conceptoNombrado, conceptoDelCobro, detectarOtroConcepto, decidirOtroConcepto,
    mensajeOtroConcepto, motivoOtroConcepto,
} from './whatsapp-otro-concepto.service';

const P = (id: string, amount: number, concept: string) =>
    ({ id, amount, concept, due_date: '2026-10-05', child_id: 'c1', atleta: 'LUIS PARRA' });

describe('conceptoNombrado', () => {
    it.each([
        ['Clase perfeccionamiento Luis Parra', 'clase_extra'],
        ['lo del refuerzo de hoy', 'clase_extra'],
        ['mira aquí lo de los uniformes', 'uniforme'],
        ['pago camiseta talla L', 'uniforme'],
        ['inscripción torneo Cenit', 'torneo'],
        ['abono viaje a México', 'viaje'],
        ['la rifa', 'rifa'],
        ['Matrícula Camila', 'inscripcion'],
        ['curso vacacional', 'vacacional'],
    ])('«%s» → %s', (texto, esperado) => {
        expect(conceptoNombrado(texto)).toBe(esperado);
    });

    it('lo que no nombra nada → null', () => {
        expect(conceptoNombrado('Buen día, envío el comprobante')).toBeNull();
        expect(conceptoNombrado('')).toBeNull();
    });
});

describe('conceptoDelCobro', () => {
    it('la mensualidad y el plan no son «otro concepto»', () => {
        expect(conceptoDelCobro('Mensualidad 10/2026 - LUIS PARRA')).toBeNull();
        expect(conceptoDelCobro('Plan PLAN PRO - 08/2026')).toBeNull();
    });
    it('un cobro de uniforme es uniforme', () => {
        expect(conceptoDelCobro('Uniforme talla M')).toBe('uniforme');
    });
});

describe('detectarOtroConcepto', () => {
    it('caso real bd8bd4d3: el pie dice «Clase perfeccionamiento»', () => {
        const s = detectarOtroConcepto({ pie: 'Clase perfeccionamiento Luis Parra', descripcion: null, chat: [] });
        expect(s).toMatchObject({ concepto: 'clase_extra', fuente: 'pie' });
    });
    it('caso real 0a55af2d: el chat dice «lo de los uniformes»', () => {
        const s = detectarOtroConcepto({ pie: null, chat: ['mira aquí lo de los uniformes'] });
        expect(s).toMatchObject({ concepto: 'uniforme', fuente: 'chat' });
    });
    it('la descripción del comprobante (OCR) cuenta', () => {
        expect(detectarOtroConcepto({ descripcion: 'TORNEO CENIT' })?.concepto).toBe('torneo');
    });
    it('el pie que nombra la mensualidad manda sobre el chat', () => {
        expect(detectarOtroConcepto({ pie: 'mensualidad octubre', chat: ['y lo de los uniformes'] })).toBeNull();
    });
    it('el texto precargado de /p/:token (mensualidad) no es otro concepto', () => {
        expect(detectarOtroConcepto({
            chat: ['Hola, envío el comprobante de pago de Mensualidad 10/2026 - LUIS (octubre 2026) de LUIS. (ref. ABCD1234)'],
        })).toBeNull();
    });
    it('una PREGUNTA sobre otro concepto no convierte el comprobante en ese concepto', () => {
        expect(detectarOtroConcepto({ chat: ['¿cuánto valen los uniformes?'] })).toBeNull();
    });
    it('sin textos → null', () => {
        expect(detectarOtroConcepto({})).toBeNull();
    });
});

describe('decidirOtroConcepto', () => {
    const mensualidad = P('p-oct', 180000, 'Mensualidad 10/2026 - LUIS PARRA');
    const pie = detectarOtroConcepto({ pie: 'Clase perfeccionamiento' })!;
    const chat = detectarOtroConcepto({ chat: ['lo de los uniformes'] })!;

    it('sin señal → sigue el flujo normal', () => {
        expect(decidirOtroConcepto(null, [mensualidad], 180000)).toEqual({ tipo: 'seguir' });
    });
    it('no hay cobro del concepto → a la escuela, NUNCA a la mensualidad', () => {
        const d = decidirOtroConcepto(pie, [mensualidad], 25000);
        expect(d.tipo).toBe('a_la_escuela');
    });
    it('aunque el monto coincida con la mensualidad, si lo dice el PIE va a la escuela', () => {
        expect(decidirOtroConcepto(pie, [mensualidad], 180000).tipo).toBe('a_la_escuela');
    });
    it('hay un cobro pendiente de ese concepto por ese monto → se aplica a ese', () => {
        const uni = P('p-uni', 60000, 'Uniforme talla M');
        const d = decidirOtroConcepto(chat, [mensualidad, uni], 60000);
        expect(d).toMatchObject({ tipo: 'aplicar', pago: { id: 'p-uni' } });
    });
    it('cobro del concepto pero el monto no cuadra → a la escuela', () => {
        const uni = P('p-uni', 60000, 'Uniforme talla M');
        expect(decidirOtroConcepto(chat, [mensualidad, uni], 120000).tipo).toBe('a_la_escuela');
    });
    it('señal SOLO del chat + monto exacto de la mensualidad → sigue (el texto puede ser de otra foto)', () => {
        expect(decidirOtroConcepto(chat, [mensualidad], 180000)).toEqual({ tipo: 'seguir' });
    });
});

describe('mensajes', () => {
    it('a la familia: honesto, nombra el concepto y no promete aplicarlo a la mensualidad', () => {
        const s = detectarOtroConcepto({ chat: ['lo de los uniformes'] })!;
        const m = mensajeOtroConcepto(s);
        expect(m).toContain('*uniforme*');
        expect(m).toMatch(/se lo paso a la escuela/i);
    });
    it('a la escuela: el motivo empieza por otro_concepto y lleva la evidencia', () => {
        const s = detectarOtroConcepto({ pie: 'Clase perfeccionamiento Luis' })!;
        expect(motivoOtroConcepto(s)).toMatch(/^otro_concepto: clase de perfeccionamiento \(pie: «Clase perfeccionamiento Luis»\)/);
    });
});
