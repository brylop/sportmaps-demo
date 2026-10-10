/**
 * Llaves de pago restringidas a un concepto (`only_for`) y la categoría del cobro.
 * Caso de origen: Dynasty, 2026-10-05 — Nequi personal de la dueña solo para inscripciones.
 */
import { describe, it, expect } from 'vitest';
import {
    categoriaDeCobro, cuentaAplicaA, parseCuentasDePago, describirCategorias, linkDePago, esUrlDeLinkDePago,
    esCobroUnico, etiquetaDeCobro, CATEGORIAS_COBRO, ETIQUETA_COBRO,
    esMensualidadPorCategoria, FILTRO_SOLO_MENSUALIDAD,
} from './payment-accounts';
import { readFileSync } from 'fs';
import path from 'path';

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

// Cobros únicos (Dreamers 2026-10-10: mensualidad + inscripción + seguro en el alta).
describe('cobros únicos: esCobroUnico / etiquetaDeCobro', () => {
    it('solo por categoría explícita: NULL y mensualidad no son únicos', () => {
        expect(esCobroUnico(null)).toBe(false);
        expect(esCobroUnico(undefined)).toBe(false);
        expect(esCobroUnico('mensualidad')).toBe(false);
        for (const c of CATEGORIAS_COBRO.filter((c) => c !== 'mensualidad')) expect(esCobroUnico(c)).toBe(true);
        // Una categoría futura (lista por plan) también es única: la regla es genérica.
        expect(esCobroUnico('uniforme_competencia')).toBe(true);
    });

    it('cada categoría del CHECK tiene etiqueta', () => {
        for (const c of CATEGORIAS_COBRO) expect(ETIQUETA_COBRO[c]).toBeTruthy();
    });

    it('etiqueta: categoría, si no el concepto, si no mensualidad solo para subscription', () => {
        expect(etiquetaDeCobro({ payment_category: 'seguro', concept: 'Seguro de accidentes — Plan X' })).toBe('Seguro de accidentes');
        expect(etiquetaDeCobro({ payment_category: null, concept: 'Inscripción — Plan X' })).toBe('Inscripción');
        expect(etiquetaDeCobro({ payment_category: 'clase_extra', concept: null })).toBe('Clase extra');
        expect(etiquetaDeCobro({ payment_category: null, concept: null, payment_type: 'subscription' })).toBe('Mensualidad');
        expect(etiquetaDeCobro({ payment_category: null, concept: 'Abono', payment_type: 'one_time' })).toBe('Cobro');
    });

    it('la llave «solo para seguros» se ofrece en el seguro y no en la mensualidad', () => {
        const [cuenta] = parseCuentasDePago([{ id: 's', type: 'nequi', label: 'Nequi seguros', value: '3000000000', active: true, only_for: ['seguro'] }]);
        expect(cuentaAplicaA(cuenta, categoriaDeCobro('seguro', 'Seguro de accidentes'))).toBe(true);
        expect(cuentaAplicaA(cuenta, categoriaDeCobro(null, 'Seguro de accidentes — Plan X'))).toBe(true);
        expect(cuentaAplicaA(cuenta, categoriaDeCobro(null, 'Mensualidad Octubre'))).toBe(false);
        expect(describirCategorias(['seguro'])).toBe('seguros');
    });
});

// F0 (migración 20261010143132): una sola regla en BFF, PostgREST y SQL.
describe('regla única de mensualidad (F0)', () => {
    it('esMensualidadPorCategoria es el complemento exacto de esCobroUnico', () => {
        for (const c of [null, undefined, 'mensualidad', ...CATEGORIAS_COBRO, 'categoria_futura']) {
            expect(esMensualidadPorCategoria(c)).toBe(!esCobroUnico(c));
        }
        expect(esMensualidadPorCategoria(null)).toBe(true);
        expect(esMensualidadPorCategoria('torneo')).toBe(false);
    });

    it('el filtro PostgREST deja pasar exactamente NULL y mensualidad', () => {
        expect(FILTRO_SOLO_MENSUALIDAD).toBe('payment_category.is.null,payment_category.eq.mensualidad');
    });

    it('la migración usa la lista blanca y ya no la lista negra inscripción/seguro', () => {
        const sql = readFileSync(
            path.resolve(__dirname, '../../../supabase/migrations/20261010143132_cobros_unicos_reglas_genericas.sql'), 'utf8');
        const codigo = sql.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n');
        expect(codigo).not.toMatch(/NOT IN \('inscripcion', 'seguro'\)/);
        // apply_late_fees ×2, fn_expire_overdue_payments, _mark_overdue_payments_impl
        expect(codigo.match(/COALESCE\((p\.)?payment_category, 'mensualidad'\) = 'mensualidad'/g)).toHaveLength(4);
        // trigger del torniquete
        expect(codigo).toMatch(/COALESCE\(NEW\.payment_category, 'mensualidad'\) <> 'mensualidad'/);
    });
});
