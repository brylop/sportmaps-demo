/**
 * Llaves de pago restringidas a un concepto (`only_for`) y la categoría del cobro.
 * Caso de origen: Dynasty, 2026-10-05 — Nequi personal de la dueña solo para inscripciones.
 */
import { describe, it, expect } from 'vitest';
import { categoriaDeCobro, cuentaAplicaA, parseCuentasDePago, describirCategorias } from './payment-accounts';

describe('parseCuentasDePago', () => {
    it('lee `value`, `active` y `only_for`, y descarta filas sin valor', () => {
        const cuentas = parseCuentasDePago([
            { id: 'a', type: 'breb', label: 'Bre-B', value: '0092231411', active: true },
            { id: 'b', type: 'nequi', label: 'Nequi inscripciones', value: '3204298969', active: true, only_for: ['inscripcion', 'basura'] },
            { id: 'c', type: 'nequi', value: '   ' },
            null,
        ]);
        expect(cuentas).toHaveLength(2);
        expect(cuentas[0].onlyFor).toBeNull();
        expect(cuentas[1].onlyFor).toEqual(['inscripcion']);
    });

    it('only_for vacío o inválido = llave general', () => {
        const [a, b] = parseCuentasDePago([
            { type: 'breb', value: '1', only_for: [] },
            { type: 'breb', value: '2', only_for: ['nada'] },
        ]);
        expect(a.onlyFor).toBeNull();
        expect(b.onlyFor).toBeNull();
    });

    it('no es un arreglo → lista vacía', () => {
        expect(parseCuentasDePago(null)).toEqual([]);
        expect(parseCuentasDePago({})).toEqual([]);
    });
});

describe('categoriaDeCobro', () => {
    it('payment_category específica manda', () => {
        expect(categoriaDeCobro('mensualidad', 'Inscripción anual')).toBe('mensualidad');
        expect(categoriaDeCobro('inscripcion', null)).toBe('inscripcion');
    });

    it("sin categoría o con 'otro' se lee el concepto (payment_type no sirve)", () => {
        expect(categoriaDeCobro(null, 'Inscripción Anual')).toBe('inscripcion');
        expect(categoriaDeCobro(null, 'MATRICULA 2026')).toBe('inscripcion');
        expect(categoriaDeCobro(null, 'Mensualidad 10/2026 - ABRIL SAMUDIO')).toBe('mensualidad');
        // Caso real de Dynasty: categoría 'otro' con concepto de mensualidad.
        expect(categoriaDeCobro('otro', 'Pago mensualidad octubre 2 dias a la semana')).toBe('mensualidad');
        expect(categoriaDeCobro('otro', 'Abono')).toBe('otro');
        expect(categoriaDeCobro(null, 'Abono')).toBeNull();
        expect(categoriaDeCobro(undefined, undefined)).toBeNull();
    });
});

describe('cuentaAplicaA', () => {
    const general = { onlyFor: null };
    const soloInscripciones = { onlyFor: ['inscripcion' as const] };

    it('una llave general vale para todo, incluso categoría desconocida', () => {
        expect(cuentaAplicaA(general, 'mensualidad')).toBe(true);
        expect(cuentaAplicaA(general, null)).toBe(true);
    });

    it('una llave restringida solo vale para su categoría; desconocida = no', () => {
        expect(cuentaAplicaA(soloInscripciones, 'inscripcion')).toBe(true);
        expect(cuentaAplicaA(soloInscripciones, 'mensualidad')).toBe(false);
        expect(cuentaAplicaA(soloInscripciones, null)).toBe(false);
    });
});

describe('describirCategorias', () => {
    it('arma el texto para el mensaje', () => {
        expect(describirCategorias(['inscripcion'])).toBe('inscripciones');
        expect(describirCategorias(['inscripcion', 'torneo'])).toBe('inscripciones y torneos');
    });
});
