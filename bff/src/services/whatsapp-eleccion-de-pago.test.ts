/**
 * La respuesta del acudiente a «¿a cuál de tus cobros lo aplico?».
 *
 * Los casos vienen del caso real que motivó la regla: Sharik y Nathaly Zambra,
 * hermanas en Dynasty, el mismo teléfono para las dos.
 */
import { describe, it, expect } from 'vitest';
import { interpretarEleccion, loQueQueda } from './whatsapp-eleccion-de-pago.service';
import type { PagoPendiente } from './whatsapp-receipt-matching.service';

/** Del más viejo al más nuevo, como los entrega `pagosPendientesDe`. */
const SHARIK_AGO: PagoPendiente = {
    id: 'p1', amount: 150000, concept: 'Mensualidad 08/2026 - SHARIK NICOLLE ZAMBRA HIDALGO',
    due_date: '2026-08-10', child_id: 'c-sharik', atleta: 'SHARIK NICOLLE ZAMBRA HIDALGO',
};
const NATHALY_SEP: PagoPendiente = {
    id: 'p2', amount: 150000, concept: 'Mensualidad 09/2026 - Nathaly Valenzuela',
    due_date: '2026-09-10', child_id: 'c-nathaly', atleta: 'Nathaly Valenzuela',
};
const SHARIK_SEP: PagoPendiente = {
    id: 'p3', amount: 150000, concept: 'Mensualidad 09/2026 - SHARIK NICOLLE ZAMBRA HIDALGO',
    due_date: '2026-09-10', child_id: 'c-sharik', atleta: 'SHARIK NICOLLE ZAMBRA HIDALGO',
};

const OPCIONES = [SHARIK_AGO, NATHALY_SEP, SHARIK_SEP];

describe('interpretarEleccion', () => {
    it('un número elige esa opción', () => {
        expect(interpretarEleccion('2', OPCIONES)).toEqual(
            { tipo: 'elegido', pagos: [NATHALY_SEP], motivo: 'numero' });
        expect(interpretarEleccion('la 1 por favor', OPCIONES)).toEqual(
            { tipo: 'elegido', pagos: [SHARIK_AGO], motivo: 'numero' });
    });

    it('varios números eligen varios', () => {
        const r = interpretarEleccion('1 y 3', OPCIONES);
        expect(r).toMatchObject({ tipo: 'elegido', motivo: 'numero' });
        expect((r as any).pagos.map((p: any) => p.id)).toEqual(['p1', 'p3']);
    });

    it('un monto NO se lee como número de opción', () => {
        // «pagué 150000» traía un número; leerlo como la opción 1 sería aplicar
        // plata al cobro equivocado sin que el padre lo eligiera.
        expect(interpretarEleccion('pagué 150000', OPCIONES).tipo).toBe('no_entendi');
    });

    it('«los dos» aplica a todas', () => {
        expect(interpretarEleccion('los dos', OPCIONES)).toMatchObject(
            { tipo: 'elegido', motivo: 'todos' });
        expect(interpretarEleccion('ambos porfa', OPCIONES)).toMatchObject({ motivo: 'todos' });
    });

    it('«el pendiente» aplica al MÁS ANTIGUO, no al del mes', () => {
        for (const frase of ['el pendiente', 'lo atrasado', 'la deuda', 'el más viejo', 'el anterior']) {
            const r = interpretarEleccion(frase, OPCIONES);
            expect(r, frase).toEqual({ tipo: 'elegido', pagos: [SHARIK_AGO], motivo: 'mas_antiguo' });
        }
    });

    it('nombrar a un hijo trae SUS cobros', () => {
        const r = interpretarEleccion('el de Sharik', OPCIONES);
        expect(r).toMatchObject({ tipo: 'elegido', motivo: 'atleta' });
        expect((r as any).pagos.map((p: any) => p.id)).toEqual(['p1', 'p3']);
    });

    it('el apellido compartido por dos hermanas NO desempata', () => {
        // «Zambra» está en las dos fichas. Resolverlo a una sería adivinar.
        const opciones = [SHARIK_AGO, { ...NATHALY_SEP, atleta: 'NATHALY ZAMBRA HIDALGO' }];
        expect(interpretarEleccion('el de Zambra', opciones).tipo).toBe('no_entendi');
    });

    it('un «no» corto cancela; dentro de una frase larga no', () => {
        expect(interpretarEleccion('no, espera', OPCIONES).tipo).toBe('cancelar');
        expect(interpretarEleccion('no sé bien cuál era, me puedes decir cuánto debo', OPCIONES).tipo)
            .toBe('no_entendi');
    });

    it('lo que no entiende NO lo resuelve al azar', () => {
        for (const frase of ['hola', 'gracias', 'ya quedó?', '']) {
            expect(interpretarEleccion(frase, OPCIONES).tipo, frase).toBe('no_entendi');
        }
    });
});

describe('loQueQueda', () => {
    it('devuelve el mes corriente cuando se pagó el atrasado', () => {
        expect(loQueQueda(OPCIONES, [SHARIK_AGO]).map((p) => p.id)).toEqual(['p2', 'p3']);
    });
    it('vacío cuando se pagó todo', () => {
        expect(loQueQueda(OPCIONES, OPCIONES)).toEqual([]);
    });
});
