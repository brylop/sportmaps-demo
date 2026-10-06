/**
 * Llaves de pago restringidas a un concepto (`only_for`) y la categoría del cobro.
 * Caso de origen: Dynasty, 2026-10-05 — Nequi personal de la dueña solo para inscripciones.
 */
import { describe, it, expect } from 'vitest';
import {
    categoriaDeCobro, cuentaAplicaA, parseCuentasDePago, describirCategorias, linkDePago, esUrlDeLinkDePago,
} from './payment-accounts';

// Link de pago de Wompi de Dynasty (2026-10-06): vive en payment_accounts pero
// no es una cuenta para transferir.
describe('link de pago (type payment_link)', () => {
    const LINK = 'https://checkout.wompi.co/l/Hj5s7R';
    const lista = [
        { id: 'a', type: 'breb', label: 'Bre-B', value: '0092231411', active: true },
        { id: 'w', type: 'payment_link', label: 'Pagar con tarjeta, PSE o Nequi (Wompi)', value: LINK, active: true },
    ];

    it('NO entra en parseCuentasDePago (verificación de destino del comprobante y cuentas)', () => {
        const cuentas = parseCuentasDePago(lista);
        expect(cuentas.map((c) => c.value)).toEqual(['0092231411']);
        expect(cuentas.some((c) => c.type === 'payment_link')).toBe(false);
    });

    it('linkDePago devuelve la URL si está activa y aplica', () => {
        expect(linkDePago(lista, null)).toBe(LINK);
        expect(linkDePago(lista, 'mensualidad')).toBe(LINK);
    });

    it('linkDePago respeta active y only_for', () => {
        expect(linkDePago([{ ...lista[1], active: false }], null)).toBeNull();
        const soloInscripcion = [{ ...lista[1], only_for: ['inscripcion'] }];
        expect(linkDePago(soloInscripcion, 'mensualidad')).toBeNull();
        expect(linkDePago(soloInscripcion, null)).toBeNull();
        expect(linkDePago(soloInscripcion, 'inscripcion')).toBe(LINK);
    });

    it('solo https y sin caracteres que rompan el HTML', () => {
        expect(esUrlDeLinkDePago(LINK)).toBe(true);
        expect(esUrlDeLinkDePago('http://checkout.wompi.co/l/Hj5s7R')).toBe(false);
        expect(esUrlDeLinkDePago('javascript:alert(1)')).toBe(false);
        expect(esUrlDeLinkDePago('https://x.co/"><script>')).toBe(false);
        expect(esUrlDeLinkDePago('3204298969')).toBe(false);
        expect(linkDePago([{ type: 'payment_link', value: 'http://inseguro.co/l/1' }], null)).toBeNull();
        expect(linkDePago(null, null)).toBeNull();
    });
});

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
