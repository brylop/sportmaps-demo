/**
 * Pruebas de la lógica pura de invoicing/types — la ÚNICA copia de los helpers
 * que comparten todos los adaptadores. Cada vez que uno de ellos se duplicó
 * dentro de un adaptador, la copia se desincronizó y el bug volvió una capa más
 * abajo, así que acá se blindan en su casa.
 *
 * Lo que afirman, en orden de plata perdida:
 *   1. El código DANE es un STRING con su cero inicial. `Number('05001')` = 5001
 *      no es ningún municipio del catálogo: se rompían los 148 de Antioquia
 *      (05xxx) y Atlántico (08xxx) — Medellín, Envigado, Barranquilla, Soledad.
 *   2. El medio de pago se DECLARA, no se adivina. Estaba clavado en '10'
 *      (efectivo) para todo: 350 transferencias de Dynasty se habrían declarado
 *      en efectivo ante la DIAN.
 *   3. Un 502 del PAC no es un rechazo de la DIAN. El documento pudo quedar
 *      creado con su número consumido; marcarlo 'rejected' lo deja huérfano.
 *
 * CERO red: el único test que usa `fetch` lo hace contra un `globalThis.fetch`
 * moqueado y una URL inexistente (.invalid).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    normalizeDaneMunicipality,
    defaultMunicipalityCode,
    defaultMunicipalityLegacyId,
    customerMunicipalityPolicy,
    resolveCustomerMunicipality,
    resolvePaymentMethodCode,
    isTerminalPacStatus,
    isRetryablePacError,
    pacJsonFetch,
    PacTransportError,
} from './types';
import type { InvoiceCustomer, ProviderConfig } from './types';

/** ProviderConfig mínimo: acá solo importa `config`. */
const cfg = (config: Record<string, any> = {}): ProviderConfig => ({
    provider: 'factus_v2',
    sandbox: true,
    credentials: {},
    config,
});

const cliente = (over: Partial<InvoiceCustomer> = {}): InvoiceCustomer => ({
    documentType: 'CC',
    identification: '1020304050',
    name: 'Ana María Pérez',
    ...over,
});

// ─── Código DANE ──────────────────────────────────────────────────────────────

describe('normalizeDaneMunicipality — el cero inicial del código DANE', () => {
    it('el código de Medellín conserva el cero inicial y sale como string', () => {
        const r = normalizeDaneMunicipality('05001');
        expect(r).toBe('05001');
        // Explícito porque el bug era exactamente perder el tipo: 5001 !== '05001'.
        expect(typeof r).toBe('string');
    });

    it('un 05001 que ya pasó por Number() en un viaje anterior recupera su cero', () => {
        // Así llega hoy la fila de una escuela de Medellín guardada como número JSON.
        expect(normalizeDaneMunicipality(5001)).toBe('05001');
        expect(normalizeDaneMunicipality('5001')).toBe('05001');
    });

    it('Atlántico (08xxx) también se recupera: Barranquilla y Soledad', () => {
        expect(normalizeDaneMunicipality(8001)).toBe('08001');
        expect(normalizeDaneMunicipality('8758')).toBe('08758');
    });

    it('un código que nunca tuvo cero inicial no se toca', () => {
        expect(normalizeDaneMunicipality('11001')).toBe('11001');
        expect(normalizeDaneMunicipality(25473)).toBe('25473');
    });

    it('el nombre de la ciudad no se toma por código de municipio', () => {
        // profiles.billing_city_dane es texto libre: puede traer el nombre.
        expect(normalizeDaneMunicipality('Bogota')).toBeNull();
        expect(normalizeDaneMunicipality('Bogotá D.C.')).toBeNull();
        expect(normalizeDaneMunicipality('05001 Medellín')).toBeNull();
        expect(normalizeDaneMunicipality('')).toBeNull();
        expect(normalizeDaneMunicipality('   ')).toBeNull();
    });

    it('sin dato devuelve null en vez de un municipio inventado', () => {
        expect(normalizeDaneMunicipality(null)).toBeNull();
        expect(normalizeDaneMunicipality(undefined)).toBeNull();
        expect(normalizeDaneMunicipality(NaN)).toBeNull();
        expect(normalizeDaneMunicipality({})).toBeNull();
    });

    it('los espacios alrededor no invalidan un código bueno', () => {
        expect(normalizeDaneMunicipality('  05001  ')).toBe('05001');
        expect(normalizeDaneMunicipality('\t08001\n')).toBe('08001');
    });

    it('un largo imposible se descarta en vez de rellenarse', () => {
        expect(normalizeDaneMunicipality('501')).toBeNull();     // 3 dígitos
        expect(normalizeDaneMunicipality('050011')).toBeNull();  // 6 dígitos
        expect(normalizeDaneMunicipality(0)).toBeNull();
    });
});

describe('municipio del EMISOR — código DANE (V2) vs id interno (V1)', () => {
    it('el municipio del emisor guardado como número JSON no pierde el cero', () => {
        // Una escuela de Medellín tendría 5001 en default_municipality_id.
        expect(defaultMunicipalityCode(cfg({ default_municipality_id: 5001 }))).toBe('05001');
        expect(defaultMunicipalityCode(cfg({ default_municipality_id: 11001 }))).toBe('11001');
        expect(defaultMunicipalityCode(cfg())).toBeNull();
    });

    it('el id interno de Factus V1 y el código DANE de V2 NO son intercambiables', () => {
        // '169' es Bogotá en el catálogo de V1; como código DANE no existe.
        const c = cfg({ default_municipality_id: '169' });
        expect(defaultMunicipalityLegacyId(c)).toBe('169');   // sin padding: es un id
        expect(defaultMunicipalityCode(c)).toBeNull();        // y no vale como DANE
    });
});

describe('resolveCustomerMunicipality — el fallback ya no miente en silencio', () => {
    it('el municipio del cliente manda sobre el del emisor', () => {
        const r = resolveCustomerMunicipality(
            cliente({ municipalityCode: '05001' }),
            cfg({ default_municipality_id: '11001' }),
        );
        expect(r).toEqual({ code: '05001', reject: null, usedOwnerFallback: false });
    });

    it("sin dato, el default 'fallback' usa el del emisor pero DEJA RASTRO", () => {
        // Con el fallback, familias de Mosquera tienen facturas que dicen Bogotá.
        // Sigue siendo el default (0 de 147 pagos de septiembre tienen DANE), pero
        // la bandera es la que permite avisarlo en el log y en el backfill.
        const r = resolveCustomerMunicipality(cliente(), cfg({ default_municipality_id: '11001' }));
        expect(r.code).toBe('11001');
        expect(r.usedOwnerFallback).toBe(true);
        expect(r.reject).toBeNull();
    });

    it("'require' corta la emisión ANTES de hablar con el PAC", () => {
        const r = resolveCustomerMunicipality(
            cliente(),
            cfg({ default_municipality_id: '11001', customer_municipality_policy: 'require' }),
        );
        expect(r.reject).toBe('customer_missing_municipality');
        expect(r.code).toBeNull();
    });

    it("'omit' manda la factura SIN municipio, no con el del emisor", () => {
        const r = resolveCustomerMunicipality(
            cliente(),
            cfg({ default_municipality_id: '11001', customer_municipality_policy: 'omit' }),
        );
        expect(r.code).toBeNull();
        expect(r.reject).toBeNull();
        expect(r.usedOwnerFallback).toBe(false);
    });

    it('una política mal escrita cae en fallback, no en un corte ni en un omit silencioso', () => {
        expect(customerMunicipalityPolicy(cfg({ customer_municipality_policy: 'REQUERIDO' }))).toBe('fallback');
        expect(customerMunicipalityPolicy(cfg({ customer_municipality_policy: null }))).toBe('fallback');
        expect(customerMunicipalityPolicy(cfg())).toBe('fallback');
        // pero sí se acepta escrita en mayúsculas
        expect(customerMunicipalityPolicy(cfg({ customer_municipality_policy: ' REQUIRE ' }))).toBe('require');
    });
});

// ─── Medios de pago ───────────────────────────────────────────────────────────

describe('resolvePaymentMethodCode — el medio de pago se declara, no se clava', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('una transferencia se declara transferencia (47), nunca efectivo', () => {
        expect(resolvePaymentMethodCode('transfer', cfg())).toBe('47');
        expect(resolvePaymentMethodCode('transfer', cfg())).not.toBe('10');
    });

    it('los cuatro medios confirmados en la tabla oficial mapean a su código', () => {
        expect(resolvePaymentMethodCode('cash', cfg())).toBe('10');
        expect(resolvePaymentMethodCode('transfer', cfg())).toBe('47');
        expect(resolvePaymentMethodCode('check', cfg())).toBe('20');
        expect(resolvePaymentMethodCode('cheque', cfg())).toBe('20');
        expect(resolvePaymentMethodCode('deposit', cfg())).toBe('42');
        expect(resolvePaymentMethodCode('consignacion', cfg())).toBe('42');
    });

    it("PSE no figura en el catálogo: va como 'no definido' (1) y NUNCA como efectivo", () => {
        expect(resolvePaymentMethodCode('pse', cfg())).toBe('1');
        expect(resolvePaymentMethodCode('pse', cfg())).not.toBe('10');
    });

    it("'card' no distingue crédito (48) de débito (49): tampoco se afirma efectivo", () => {
        expect(resolvePaymentMethodCode('card', cfg())).toBe('1');
        expect(resolvePaymentMethodCode('card', cfg())).not.toBe('10');
    });

    it('sin medio de pago no se afirma nada: 1, no 10', () => {
        expect(resolvePaymentMethodCode(null, cfg())).toBe('1');
        expect(resolvePaymentMethodCode(undefined, cfg())).toBe('1');
        expect(resolvePaymentMethodCode('', cfg())).toBe('1');
        expect(resolvePaymentMethodCode('   ', cfg())).toBe('1');
    });

    it('un medio desconocido no se toma por efectivo', () => {
        expect(resolvePaymentMethodCode('other', cfg())).toBe('1');
        expect(resolvePaymentMethodCode('nequi_qr', cfg())).toBe('1');
        expect(resolvePaymentMethodCode('cripto', cfg())).toBe('1');
    });

    it('no depende de la caja del texto ni de los espacios', () => {
        expect(resolvePaymentMethodCode(' TRANSFER ', cfg())).toBe('47');
        expect(resolvePaymentMethodCode('Cash', cfg())).toBe('10');
    });

    it('el contador de la escuela puede fijar el código de PSE sin deploy', () => {
        const c = cfg({ payment_method_codes: { pse: '47', card: '48' } });
        expect(resolvePaymentMethodCode('pse', c)).toBe('47');
        expect(resolvePaymentMethodCode('card', c)).toBe('48');
    });

    it('un override que no está en el catálogo oficial se ignora y avisa', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const c = cfg({ payment_method_codes: { pse: '999' } });
        // No se le manda al PAC un código inventado: se cae a «no definido».
        expect(resolvePaymentMethodCode('pse', c)).toBe('1');
        expect(warn).toHaveBeenCalled();
    });

    it('un override basura tampoco se convierte en efectivo por descarte', () => {
        expect(resolvePaymentMethodCode('cash', cfg({ payment_method_codes: { cash: 'efectivo' } }))).toBe('10');
        expect(resolvePaymentMethodCode('pse', cfg({ payment_method_codes: { pse: '' } }))).toBe('1');
        expect(resolvePaymentMethodCode('pse', cfg({ payment_method_codes: 'pse=47' }))).toBe('1');
    });

    it("el override sí acepta 'ZZZ' (Otro) y no le importa la caja", () => {
        expect(resolvePaymentMethodCode('other', cfg({ payment_method_codes: { other: 'zzz' } }))).toBe('ZZZ');
    });

    it('un override nulo no borra el código confirmado', () => {
        expect(resolvePaymentMethodCode('transfer', cfg({ payment_method_codes: { transfer: null } }))).toBe('47');
    });

    it('una config ausente no rompe la resolución', () => {
        const sinConfig = { provider: 'factus_v2', sandbox: true, credentials: {} } as unknown as ProviderConfig;
        expect(resolvePaymentMethodCode('transfer', sinConfig)).toBe('47');
        expect(resolvePaymentMethodCode(null, sinConfig)).toBe('1');
    });
});

// ─── Transporte vs rechazo ────────────────────────────────────────────────────

describe('isTerminalPacStatus — solo el rechazo sobre el CONTENIDO es terminal', () => {
    it('400, 409 y 422 son terminales; credenciales, timeouts y 5xx no', () => {
        for (const s of [400, 409, 422]) expect(isTerminalPacStatus(s)).toBe(true);
        // Todo esto se arregla y se reintenta; darlo por rechazado quema numeración.
        for (const s of [401, 403, 404, 408, 429, 500, 502, 503, 504]) {
            expect(isTerminalPacStatus(s)).toBe(false);
        }
    });
});

describe('isRetryablePacError', () => {
    it('los fallos de red, timeout y transporte se reintentan', () => {
        expect(isRetryablePacError(new PacTransportError('502', 502))).toBe(true);
        expect(isRetryablePacError(new TypeError('fetch failed'))).toBe(true);
        const abort = new Error('abortada');
        abort.name = 'AbortError';
        expect(isRetryablePacError(abort)).toBe(true);
        const red = new Error('socket');
        (red as any).cause = { code: 'ECONNRESET' };
        expect(isRetryablePacError(red)).toBe(true);
    });

    it('un error cualquiera NO se reintenta: si no consta que sea transporte, no se asume', () => {
        expect(isRetryablePacError(new Error('la DIAN rechazó el documento'))).toBe(false);
        expect(isRetryablePacError(null)).toBe(false);
    });
});

describe('pacJsonFetch — mira res.ok ANTES de parsear el cuerpo', () => {
    const fetchOriginal = globalThis.fetch;

    /** Respuesta falsa: solo lo que pacJsonFetch usa (ok/status/text). */
    const resp = (status: number, body: unknown) => {
        const texto = typeof body === 'string' ? body : JSON.stringify(body);
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => texto,
        } as unknown as Response;
    };

    const montar = (impl: (url: string, init: any) => Promise<Response>) => {
        const espia = vi.fn(impl as any);
        globalThis.fetch = espia as any;
        return espia;
    };

    // URL inexistente a propósito: si el moqueo se cayera, la prueba falla por
    // DNS en vez de salir a internet.
    const URL_FALSA = 'https://pac.invalid/v2/bills/validate';

    // Esta prueba se agregó DESPUÉS y por una razón concreta: una revisión por
    // mutación quitó `signal: AbortSignal.timeout(timeoutMs)` del fetch y las 37
    // pruebas de este archivo siguieron verdes. O sea que la mitad "sin timeout,
    // un cuelgue deja la fila en 'queued' contada como facturada" del arreglo
    // NO estaba cubierta, aunque otra prueba dijera que sí. Un timeout ausente
    // no se nota en un test rápido: se nota en producción, durante un redeploy
    // de Render, cuando el proceso muere entre el upsert y la respuesta.
    it('el fetch sale SIEMPRE con una señal de timeout y con el plazo que se le pidió', async () => {
        const espia = montar(async () => resp(200, { data: { number: 'X1' } }));

        await pacJsonFetch('emitir', URL_FALSA, { method: 'POST' }, 25_000);

        const init = espia.mock.calls[0][1];
        expect(init.signal, 'el fetch salió sin AbortSignal: un cuelgue del PAC no se corta nunca').toBeDefined();
        expect(init.signal).toBeInstanceOf(AbortSignal);
        // Se conserva lo que venía en `init` en vez de reemplazarlo entero.
        expect(init.method).toBe('POST');
    });

    it('la señal aborta cuando se cumple el plazo, y eso se clasifica como transporte', async () => {
        // Plazo mínimo y un fetch que respeta la señal: así se comprueba que el
        // timeout ESTÁ CABLEADO, no solo que el objeto existe.
        montar((_url, init) => new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
                const e = new Error('abortado');
                e.name = 'TimeoutError';
                reject(e);
            });
        }));

        // El contrato es LANZAR PacTransportError, no devolver un resultado:
        // así el llamador no puede confundir un cuelgue con un rechazo de la
        // DIAN por descuido. Un timeout es un fallo NUESTRO y tiene que quedar
        // reintentable, o el pago se pierde para siempre.
        const error = await pacJsonFetch('emitir', URL_FALSA, { method: 'POST' }, 1)
            .then(
                (r) => { throw new Error(`debió lanzar por timeout y devolvió: ${JSON.stringify(r)}`); },
                (e) => e,
            );

        expect(error).toBeInstanceOf(PacTransportError);
        expect(isRetryablePacError(error), `clasificado como: ${String(error)}`).toBe(true);
        // Que el mensaje diga el plazo es lo que hace diagnosticable un cuelgue
        // en los logs de Render.
        expect(String(error.message)).toContain('1ms');
    });

    afterEach(() => {
        globalThis.fetch = fetchOriginal;
        vi.restoreAllMocks();
    });

    it('un 502 con cuerpo HTML se lanza como transporte, no se devuelve como respuesta', async () => {
        // El bug: `await res.json()` antes de `res.ok` reventaba con este cuerpo y
        // el catch de arriba escribía status='rejected' con el documento vivo en
        // la DIAN. Ahora tiene que LANZAR PacTransportError (reintentable).
        montar(async () => resp(502, '<html><body>502 Bad Gateway</body></html>'));
        const p = pacJsonFetch('Factus V2', URL_FALSA, { method: 'POST' }, 1000);
        await expect(p).rejects.toBeInstanceOf(PacTransportError);
        await expect(p).rejects.toThrow(/502/);
    });

    it('un 429 y un 401 tampoco son rechazos: la factura queda reintentable', async () => {
        montar(async () => resp(429, { message: 'Too Many Attempts.' }));
        await expect(pacJsonFetch('Factus V2', URL_FALSA, {}, 1000))
            .rejects.toBeInstanceOf(PacTransportError);

        montar(async () => resp(401, { message: 'Unauthenticated.' }));
        const e = await pacJsonFetch('Factus V2', URL_FALSA, {}, 1000).catch((x) => x);
        expect(e).toBeInstanceOf(PacTransportError);
        expect(e.httpStatus).toBe(401);
        expect(isRetryablePacError(e)).toBe(true);
    });

    it('un 422 del PAC SÍ vuelve como respuesta terminal, para poder reportarlo', async () => {
        montar(async () => resp(422, { message: 'El campo customer.identification es obligatorio' }));
        const r = await pacJsonFetch('Factus V2', URL_FALSA, {}, 1000);
        expect(r.ok).toBe(false);
        expect(r.status).toBe(422);
        expect(r.json.message).toMatch(/identification/);
    });

    it('un 2xx con cuerpo no-JSON no se toma por éxito', async () => {
        // Página de un proxy delante del PAC: no sabemos si el documento se creó.
        montar(async () => resp(200, '<html>proxy</html>'));
        await expect(pacJsonFetch('Factus V2', URL_FALSA, {}, 1000))
            .rejects.toBeInstanceOf(PacTransportError);
    });

    it('un timeout se reporta como transporte y dice cuánto esperó', async () => {
        montar(async () => {
            const e = new Error('The operation was aborted due to timeout');
            e.name = 'TimeoutError';
            throw e;
        });
        await expect(pacJsonFetch('Factus V2', URL_FALSA, {}, 1234))
            .rejects.toThrow(/sin respuesta en 1234ms/);
    });

    it('un 201 con JSON válido pasa derecho', async () => {
        montar(async () => resp(201, { status: 'Created', data: { number: 'SETP990018445' } }));
        const r = await pacJsonFetch('Factus V2', URL_FALSA, {}, 1000);
        expect(r.ok).toBe(true);
        expect(r.json.data.number).toBe('SETP990018445');
    });
});
