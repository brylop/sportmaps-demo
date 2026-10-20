/**
 * Dynasty 2026-10-20: tres respuestas del bot que no debían salir.
 *  - «Cc 1007 497036» (cédula) se tomó por un código de verificación.
 *  - «Hola amor» tras un mensaje de la escuela recibió la presentación del bot.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

import { pareceSoloUnCodigo, saludoSinContenido } from './whatsapp-bot.service';
import { preguntaHorarioDeHoy } from './whatsapp-desconocido-reglas';

describe('pareceSoloUnCodigo', () => {
    it.each(['123456', 'mi código es 123456', 'el código: 654321 gracias', ' 123456 '])('«%s» → código', (t) =>
        expect(pareceSoloUnCodigo(t)).toBe(true));
    it.each([
        'Necesito que me ayudes con una certificación laboral para Danna como entrenadora de Benjamines desde hace 2 años. Danna Stefania Arango Barrera Cc 1007 497036',
        'son 170000 pesos de la mensualidad de octubre del niño',
    ])('«%s» → NO es un código', (t) => expect(pareceSoloUnCodigo(t)).toBe(false));
});

describe('saludoSinContenido con vocativos cariñosos', () => {
    it.each(['Hola amor', 'Hola mi amor', 'Buenos días mi vida'.replace('mi vida', 'amor'), 'Hola corazón', 'Hola mi Mile'])(
        '«%s» → solo saludo', (t) => expect(saludoSinContenido(t, new Map([['mile', 'mile']]))).toBe(true));
    it.each(['Hola amor, ¿cuánto debo?', 'Amor, mi hija no va hoy'])('«%s» → trae contenido', (t) =>
        expect(saludoSinContenido(t)).toBe(false));
});

describe('preguntaHorarioDeHoy (el caso del 11 de octubre)', () => {
    it('«Menores masculino no hay entrenamiento hoy?» → sí', () =>
        expect(preguntaHorarioDeHoy('Menores masculino no hay entrenamiento hoy?')).toBe(true));
});
