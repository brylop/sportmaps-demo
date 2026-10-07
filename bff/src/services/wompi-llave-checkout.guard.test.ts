import { describe, expect, it } from 'vitest';
import { esLlaveDePruebaWompi, validarLlaveCheckoutEscuela } from './wompi-llave-checkout.guard';

describe('validarLlaveCheckoutEscuela', () => {
    it('llave de producción pasa en cualquier ambiente y fuente', () => {
        for (const NODE_ENV of ['production', 'development', 'staging']) {
            for (const source of ['env', 'school_direct', 'vendor'] as const) {
                expect(validarLlaveCheckoutEscuela({ publicKey: 'pub_prod_abc', source }, { NODE_ENV }).ok).toBe(true);
            }
        }
    });

    it("llaves de ENV ('aggregator' = escuela real) con pub_test_ → rechazo aunque sea dev", () => {
        const v = validarLlaveCheckoutEscuela({ publicKey: 'pub_test_abc', source: 'env' }, { NODE_ENV: 'development' });
        expect(v).toMatchObject({ ok: false, code: 'wompi_llave_prueba_escuela_real' });
    });

    it('BFF de producción con pub_test_ → rechazo aunque sea cuenta propia', () => {
        const v = validarLlaveCheckoutEscuela({ publicKey: 'pub_test_abc', source: 'school_direct' }, { NODE_ENV: 'production' });
        expect(v).toMatchObject({ ok: false, code: 'wompi_llave_prueba_en_produccion' });
    });

    it('cuenta propia sandbox fuera de producción → permitido (Escuela Demo)', () => {
        expect(validarLlaveCheckoutEscuela({ publicKey: 'pub_test_abc', source: 'school_direct' }, { NODE_ENV: 'development' }).ok).toBe(true);
    });

    it('sin llave → rechazo', () => {
        expect(validarLlaveCheckoutEscuela({ publicKey: '', source: 'env' }, {})).toMatchObject({ ok: false, code: 'wompi_sin_llave' });
        expect(validarLlaveCheckoutEscuela({ publicKey: null, source: 'school_direct' }, {})).toMatchObject({ ok: false });
    });

    it('la llave manda, no el nombre del ambiente', () => {
        expect(esLlaveDePruebaWompi('pub_test_x')).toBe(true);
        expect(esLlaveDePruebaWompi(' PUB_TEST_x ')).toBe(true);
        expect(esLlaveDePruebaWompi('pub_prod_x')).toBe(false);
        expect(esLlaveDePruebaWompi(undefined)).toBe(false);
    });
});
