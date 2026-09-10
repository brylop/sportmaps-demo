/**
 * Pruebas UNITARIAS del adaptador Factus V2 — armado del payload y lectura de
 * la respuesta. SIN RED: se moquea `globalThis.fetch` y se captura el cuerpo del
 * POST, que es la única forma de verificar el payload sin salir a internet.
 *
 * (La prueba de integración real contra el sandbox es
 * `factus-v2.adapter.sandbox.test.ts`, apagada tras FACTUS_SANDBOX_TEST=1. Esta
 * es su complemento barato: corre siempre, en CI y sin credenciales.)
 *
 * Por qué el payload merece pruebas: Factus DESCARTA EN SILENCIO una clave que
 * no conoce y responde "Created" igual. Un payload mal armado no da error —
 * produce una factura equivocada ante la DIAN. Los cuatro fallos silenciosos
 * que se blindan acá:
 *   · la razón social de una empresa viajaba en `names`, que V2 reporta como
 *     null para personas jurídicas: la factura salía sin nombre de adquirente;
 *   · `municipality_code` viajaba como número (5001) y sin el cero inicial;
 *   · `is_excluded` iba mal y el ítem salía GRAVADO AL 0% en vez de EXCLUIDO;
 *   · `payment_method_code` estaba clavado en '10' (efectivo) para todo.
 * Y en la respuesta: un 502 del PAC se marcaba 'rejected' definitivo, y el acuse
 * de producción (sin número ni CUFE) se contaba como fallo.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { factusV2Adapter } from './factus-v2.adapter';
import { PacTransportError } from './types';
import type { InvoiceRequest, ProviderConfig } from './types';

// ─── PAC falso ────────────────────────────────────────────────────────────────

const fetchOriginal = globalThis.fetch;

/**
 * Host inexistente a propósito (.invalid nunca resuelve): si el moqueo de fetch
 * se cayera, la prueba falla por DNS en vez de tocar el PAC de verdad.
 */
const BASE = 'https://factus.invalid';

interface RespuestaFalsa { status?: number; body?: unknown }

const resp = (status: number, body: unknown) => {
    const texto = typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, text: async () => texto } as unknown as Response;
};

/** Cuerpo del POST de emisión, ya parseado, más las URLs pedidas en orden. */
interface Pac { payload: any; urls: string[] }

/**
 * Instala un PAC falso: resuelve el OAuth y contesta `ruta(url)` a todo lo demás.
 * Una URL sin ruta definida responde 501 para que la prueba se queje en vez de
 * pasar por accidente.
 */
function montarPac(ruta: (url: string) => RespuestaFalsa | undefined): Pac {
    const pac: Pac = { payload: null, urls: [] };
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
        const u = String(url);
        pac.urls.push(u);
        if (u.includes('/oauth/token')) {
            return resp(200, { access_token: 'token-de-prueba', expires_in: 3600 });
        }
        if (u.includes('/v2/bills/validate')) {
            pac.payload = JSON.parse(String(init?.body ?? 'null'));
        }
        const r = ruta(u);
        if (!r) return resp(501, { message: `URL sin ruta en la prueba: ${u}` });
        return resp(r.status ?? 201, r.body ?? {});
    }) as any;
    return pac;
}

/** PAC que solo responde la emisión. */
const pacEmision = (r: RespuestaFalsa = {}) =>
    montarPac((u) => (u.includes('/v2/bills/validate') ? r : undefined));

/**
 * cfg con client_id único por llamada: el adaptador cachea el token en un Map de
 * módulo y un id compartido haría que unas pruebas no pidan el OAuth y otras sí.
 */
let seq = 0;
const cfg = (config: Record<string, any> = {}): ProviderConfig => ({
    provider: 'factus_v2',
    sandbox: true,
    credentials: {
        base_url: BASE,
        client_id: `cliente-${++seq}`,
        client_secret: 'secreto',
        username: 'usuario',
        password: 'clave',
    },
    config: { numbering_range_id: 5224, ...config },
});

// ─── Peticiones canónicas ─────────────────────────────────────────────────────

/** Mensualidad de un acudiente persona natural: excluida de IVA. */
const pedido = (over: Partial<InvoiceRequest> = {}): InvoiceRequest => ({
    referenceCode: 'SM-PAY-0001',
    documentType: 'invoice',
    customer: {
        documentType: 'CC',
        identification: '1020304050',
        name: 'Ana María Pérez',
        email: 'ana@example.com',
        phone: '3001234567',
        address: 'Calle 1 # 2-3',
        municipalityCode: '05001',        // Medellín: el caso del cero inicial
    },
    items: [{
        codeReference: 'MENS-09',
        name: 'Mensualidad septiembre',
        quantity: 1,
        unitPrice: 250000,
        taxRate: 0,
        isExcluded: true,
    }],
    paymentMethod: 'transfer',
    ...over,
});

/** Artículo deportivo gravado al 19%: unitPrice viene IVA-INCLUIDO. */
const itemGravado = (over: Partial<InvoiceRequest['items'][number]> = {}) => ({
    codeReference: 'GUAYOS',
    name: 'Guayos',
    quantity: 1,
    unitPrice: 119000,   // neto 100.000 + 19%
    taxRate: 19,
    ...over,
});

afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
});

// ─── Adquirente ───────────────────────────────────────────────────────────────

describe('payload — adquirente', () => {
    it('la razón social de una empresa (NIT) viaja en `company` y NO en `names`', async () => {
        // El bug: iba siempre en `names`, y V2 reporta `names` como null para una
        // persona jurídica → la factura de la empresa salía sin nombre y nadie se
        // enteraba, porque el campo que sobra no da error.
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({
                customer: {
                    documentType: 'NIT',
                    identification: '900123456',
                    name: 'Colegio Dynasty S.A.S.',
                    municipalityCode: '11001',
                },
            }),
            cfg(),
        );
        expect(pac.payload.customer.company).toBe('Colegio Dynasty S.A.S.');
        expect('names' in pac.payload.customer).toBe(false);
        expect(pac.payload.customer.legal_organization_code).toBe('1');  // jurídica
        expect(pac.payload.customer.tribute_code).toBe('01');            // IVA
        expect(pac.payload.customer.identification_document_code).toBe('31');
    });

    it('una persona natural viaja en `names` y NO en `company`', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido(), cfg());
        expect(pac.payload.customer.names).toBe('Ana María Pérez');
        expect('company' in pac.payload.customer).toBe(false);
        expect(pac.payload.customer.legal_organization_code).toBe('2');  // natural
        expect(pac.payload.customer.tribute_code).toBe('ZZ');            // no aplica
        expect(pac.payload.customer.identification_document_code).toBe('13');  // CC
    });

    it('un tipo de documento fuera del mapa cae en cédula en vez de viajar vacío', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({ customer: { ...pedido().customer, documentType: 'NUIP' } }),
            cfg(),
        );
        expect(pac.payload.customer.identification_document_code).toBe('13');
        expect(pac.payload.customer.legal_organization_code).toBe('2');  // no es NIT
    });
});

// ─── Municipio ────────────────────────────────────────────────────────────────

describe('payload — municipio del cliente', () => {
    it('el código de Medellín viaja como STRING con el cero, bajo la clave nueva', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido(), cfg());
        expect(pac.payload.customer.municipality_code).toBe('05001');
        expect(typeof pac.payload.customer.municipality_code).toBe('string');
        // `municipality_id` es el nombre de V1: V2 lo ignora en silencio y el
        // cliente queda sin ciudad ni país (notificación FAK08 de la DIAN).
        expect('municipality_id' in pac.payload.customer).toBe(false);
    });

    it('un código que ya perdió el cero en un Number() previo se repone antes de salir', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({ customer: { ...pedido().customer, municipalityCode: 5001 as any } }),
            cfg(),
        );
        expect(pac.payload.customer.municipality_code).toBe('05001');
    });

    it('sin municipio del cliente la clave NO viaja: el adaptador no la rellena con la del emisor', async () => {
        // Ese fallback silencioso es el que le ponía Bogotá (11001, el emisor de
        // Dynasty) a familias de Mosquera y de Madrid.
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({ customer: { ...pedido().customer, municipalityCode: null } }),
            cfg({ default_municipality_id: '11001' }),
        );
        expect('municipality_code' in pac.payload.customer).toBe(false);
        expect(JSON.stringify(pac.payload)).not.toContain('11001');
    });

    it('el nombre de la ciudad como texto libre no viaja como código', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({ customer: { ...pedido().customer, municipalityCode: 'Medellín' } }),
            cfg({ default_municipality_id: '11001' }),
        );
        expect('municipality_code' in pac.payload.customer).toBe(false);
        // Y tampoco se cuela el del emisor por la puerta de atrás.
        expect(JSON.stringify(pac.payload)).not.toContain('11001');
    });
});

// ─── Ítems ────────────────────────────────────────────────────────────────────

describe('payload — ítems: excluido vs gravado, y precio neto', () => {
    it('un ítem excluido manda la bandera BOOLEANA dentro de taxes y nada más', async () => {
        // Mandarla como 1/0 o al nivel del ítem hace que V2 la descarte y el ítem
        // salga GRAVADO AL 0%, que ante la DIAN no es lo mismo que EXCLUIDO.
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido(), cfg());
        expect(pac.payload.items[0].taxes).toEqual([{ is_excluded: true }]);
        expect(pac.payload.items[0].is_excluded).toBeUndefined();
        expect(pac.payload.items[0].tax_rate).toBeUndefined();
    });

    it('un ítem gravado manda código y tarifa, sin bandera de excluido', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido({ items: [itemGravado()] }), cfg());
        expect(pac.payload.items[0].taxes).toEqual([{ code: '01', rate: '19.00' }]);
        // La bandera NO va al nivel del ítem (ahí V2 la descarta sin avisar).
        expect(pac.payload.items[0].is_excluded).toBeUndefined();
    });

    // El borde que faltaba, y es el que da nombre a todo el bug: GRAVADO AL 0%
    // es un tercer estado fiscal, distinto de EXCLUIDO y de EXENTO. Un ítem con
    // tarifa 0 que NO está marcado como excluido tiene que salir declarando el
    // tributo IVA con tarifa 0.00 — no la bandera de exclusión. Si el adaptador
    // colapsara los dos casos (por ejemplo tratando `!taxRate` como excluido),
    // una escuela con servicios gravados al 0% declararía operaciones excluidas
    // sin saberlo. Sin esta prueba, ese colapso pasaba en verde.
    it('un ítem con tarifa 0 que NO es excluido sale GRAVADO AL 0%, no excluido', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({ items: [itemGravado({ taxRate: 0, isExcluded: false })] }),
            cfg(),
        );
        expect(pac.payload.items[0].taxes).toEqual([{ code: '01', rate: '0.00' }]);
        expect(JSON.stringify(pac.payload.items[0].taxes)).not.toContain('is_excluded');
    });

    it('el precio de un gravado al 19% viaja NETO: 119.000 con IVA sale como 100.000', async () => {
        // V2 pide el valor neto por unidad; V1 recibía el IVA incluido. Mandar el
        // total como si fuera base infla la factura un 19%.
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido({ items: [itemGravado()] }), cfg());
        expect(pac.payload.items[0].price).toBe('100000.00');
        expect(pac.payload.items[0].price).not.toBe('119000.00');
    });

    it('un excluido no se divide, ni aunque traiga una tarifa cargada por error', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({
                items: [
                    { codeReference: 'A', name: 'Mensualidad', quantity: 1, unitPrice: 250000, taxRate: 0, isExcluded: true },
                    { codeReference: 'B', name: 'Inscripción', quantity: 1, unitPrice: 150000, taxRate: 19, isExcluded: true },
                ],
            }),
            cfg(),
        );
        expect(pac.payload.items[0].price).toBe('250000.00');
        expect(pac.payload.items[1].price).toBe('150000.00');
        expect(pac.payload.items[1].taxes).toEqual([{ is_excluded: true }]);
    });
});

// ─── Medio de pago y monto declarado ──────────────────────────────────────────

describe('payload — payment_details', () => {
    it('una transferencia se declara transferencia (47), no efectivo clavado', async () => {
        // 350 de 443 pagos de Dynasty (79%, $53,8M) se declaraban en efectivo sin
        // haberlo sido, y eso rompe cualquier cruce con el extracto bancario.
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido({ paymentMethod: 'transfer' }), cfg());
        expect(pac.payload.payment_details[0].payment_method_code).toBe('47');
        expect(pac.payload.payment_details[0].payment_method_code).not.toBe('10');
    });

    it('un pago por PSE o sin medio conocido va como «no definido», nunca como efectivo', async () => {
        const pse = pacEmision();
        await factusV2Adapter.emit(pedido({ paymentMethod: 'pse' }), cfg());
        expect(pse.payload.payment_details[0].payment_method_code).toBe('1');

        const sinDato = pacEmision();
        await factusV2Adapter.emit(pedido({ paymentMethod: null }), cfg());
        expect(sinDato.payload.payment_details[0].payment_method_code).toBe('1');
    });

    it('el override del contador llega hasta el payload', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({ paymentMethod: 'pse' }),
            cfg({ payment_method_codes: { pse: '47' } }),
        );
        expect(pac.payload.payment_details[0].payment_method_code).toBe('47');
    });

    it('el monto declarado es lo que pagó el padre: con impuesto y por cantidad', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            // El medio es `transfer` y no `cash` a propósito: con `cash` el
            // código esperado sería '10', que es EXACTAMENTE el valor que
            // producía el bug clavado, y la aserción de abajo no distinguiría
            // nada. Con una transferencia (47) sí muere si alguien vuelve a
            // clavar el efectivo.
            pedido({ items: [itemGravado({ quantity: 2 })], paymentMethod: 'transfer' }),
            cfg(),
        );
        // El neto por unidad va en el ítem; acá va el total pagado, 119.000 × 2.
        expect(pac.payload.items[0].price).toBe('100000.00');
        expect(pac.payload.items[0].quantity).toBe('2.00');
        expect(pac.payload.payment_details[0].amount).toBe('238000.00');
        expect(pac.payload.payment_details[0].payment_method_code).toBe('47');
    });

    it('la factura sale con nuestra referencia de idempotencia y sin correo del PAC', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(pedido(), cfg());
        expect(pac.payload.reference_code).toBe('SM-PAY-0001');
        expect(pac.payload.numbering_range_id).toBe(5224);
        // Explícito: el default documentado es `true` y Factus le escribiría al
        // acudiente con una plantilla que no controlamos.
        expect(pac.payload.send_email).toBe(false);
    });

    // BUG LATENTE (no arreglado acá: el adaptador es de otro agente).
    // `payment_details[0].amount` suma unitPrice × quantity IGNORANDO
    // `discountRate`, mientras que el ítem sí manda `discount_rate`: el PAC
    // calcula un total descontado que no cuadra con el monto declarado como
    // pagado. Hoy es latente porque invoicing.service nunca setea discountRate
    // (siempre 0), pero el canónico InvoiceLine.discountRate lo permite y el día
    // que se use, la factura sale descuadrada.
    it.fails('PENDIENTE: el monto declarado debería descontar el discount_rate del ítem', async () => {
        const pac = pacEmision();
        await factusV2Adapter.emit(
            pedido({
                items: [{
                    codeReference: 'MENS-09', name: 'Mensualidad con beca',
                    quantity: 1, unitPrice: 100000, taxRate: 0, isExcluded: true,
                    discountRate: 10,
                }],
            }),
            cfg(),
        );
        expect(pac.payload.items[0].discount_rate).toBe('10.00');
        expect(pac.payload.payment_details[0].amount).toBe('90000.00');  // manda '100000.00'
    });
});

// ─── Lectura de la respuesta ──────────────────────────────────────────────────

/** Documento completo, como responde el sandbox (síncrono). */
const documentoValidado = {
    is_validated: true,
    number: 'SETP990018445',
    numbering_range: { prefix: 'SETP' },
    document_type: { code: '01' },
    cufe: 'a1b2c3d4e5f6',
    validated_at: '2026-09-10 08:00:00',
    links: {
        qr: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=a1b2',
        public_url: 'https://api.factus.com.co/documents/bills/a1b2c3d4e5f6',
    },
    totals: { taxable_amount: '250000.00', tax_amount: '0.00', total: '250000.00' },
};

describe('respuesta — estado del documento', () => {
    it('el sandbox responde completo: queda aceptada con número, CUFE y totales', async () => {
        pacEmision({ status: 201, body: { status: 'Created', data: documentoValidado } });
        const r = await factusV2Adapter.emit(pedido(), cfg());
        expect(r.status).toBe('accepted');
        expect(r.number).toBe('SETP990018445');
        expect(r.prefix).toBe('SETP');
        expect(r.cufe).toBe('a1b2c3d4e5f6');
        expect(r.dianCode).toBe('01');
        expect(r.total).toBe(250000);
        expect(r.qrUrl).toContain('searchqr');
        expect(r.errorMessage).toBeNull();
    });

    it('producción solo responde un acuse: la factura queda ENVIADA, no rechazada', async () => {
        // Sin esto toda emisión real se contaba como fallida (y con `data` vacío
        // no hay número ni CUFE: los completa después fetchByReference).
        pacEmision({ status: 201, body: { status: 'Accepted', message: 'Documento en proceso de validación' } });
        const r = await factusV2Adapter.emit(pedido(), cfg());
        expect(r.status).toBe('sent');
        expect(r.number).toBeNull();
        expect(r.cufe).toBeNull();
        expect(r.errorMessage).toBeNull();
    });

    it('un Rechazo de la DIAN en `errors` marca la factura como rechazada', async () => {
        // El caso real: DYTY1 el 2026-09-09, regla 90. Sin esto se quedaba para
        // siempre en "enviada, esperando validación" y nadie se enteraba.
        pacEmision({
            status: 201,
            body: {
                data: {
                    is_validated: false,
                    number: 'DYTY1',
                    errors: ['Regla: 90, Rechazo: Documento procesado anteriormente'],
                },
            },
        });
        const r = await factusV2Adapter.emit(pedido(), cfg());
        expect(r.status).toBe('rejected');
        expect(r.errorMessage).toMatch(/Rechazo/);
    });

    it('una Notificación blanda de la DIAN NO es un rechazo: el documento vale', async () => {
        const errores = [
            'Regla: FAK08, Notificación: Grupo de dirección incompleto',
            'Regla: RUT01, Notificación: El adquiriente no está en el RUT',
        ];
        // En array…
        pacEmision({ status: 201, body: { data: { is_validated: false, number: 'SETP1', errors: errores } } });
        const enArray = await factusV2Adapter.emit(pedido(), cfg());
        expect(enArray.status).toBe('sent');
        expect(enArray.errorMessage).toBeNull();

        // …y como objeto indexado por regla, que es la otra forma que manda Factus.
        pacEmision({
            status: 201,
            body: { data: { is_validated: false, number: 'SETP2', errors: { FAK08: errores[0], RUT01: errores[1] } } },
        });
        const enObjeto = await factusV2Adapter.emit(pedido(), cfg());
        expect(enObjeto.status).toBe('sent');
        expect(enObjeto.errorMessage).toBeNull();
    });

    it('el rechazo también se detecta cuando `errors` viene como objeto indexado', async () => {
        pacEmision({
            status: 201,
            body: {
                data: {
                    is_validated: false,
                    number: 'DYTY2',
                    errors: {
                        '90': 'Regla: 90, Rechazo: Documento procesado anteriormente',
                        FAK08: 'Regla: FAK08, Notificación: Grupo de dirección incompleto',
                    },
                },
            },
        });
        const r = await factusV2Adapter.emit(pedido(), cfg());
        expect(r.status).toBe('rejected');
        expect(r.errorMessage).toMatch(/Rechazo/);
        expect(r.errorMessage).not.toMatch(/FAK08/);
    });

    it('sin errores no se inventa un rechazo', async () => {
        for (const errors of [[], null, undefined, {}]) {
            pacEmision({ status: 201, body: { data: { is_validated: false, number: 'SETP3', errors } } });
            const r = await factusV2Adapter.emit(pedido(), cfg());
            expect(r.status).toBe('sent');
            expect(r.errorMessage).toBeNull();
        }
    });

    it('la URL pública sin el hash del documento se descarta: sería un botón muerto', async () => {
        pacEmision({
            status: 201,
            body: { data: { ...documentoValidado, links: { public_url: 'https://api.factus.com.co/documents/bills/' } } },
        });
        const incompleta = await factusV2Adapter.emit(pedido(), cfg());
        expect(incompleta.publicUrl).toBeNull();

        pacEmision({ status: 201, body: { data: documentoValidado } });
        const completa = await factusV2Adapter.emit(pedido(), cfg());
        expect(completa.publicUrl).toBe('https://api.factus.com.co/documents/bills/a1b2c3d4e5f6');
    });
});

// ─── HTTP: rechazo terminal vs fallo de transporte ────────────────────────────

describe('respuesta — un fallo de transporte NO es un rechazo de la DIAN', () => {
    it('un 422 del PAC sí es un rechazo terminal, con el mensaje del PAC', async () => {
        pacEmision({ status: 422, body: { data: { message: 'El rango de numeración no existe' } } });
        const r = await factusV2Adapter.emit(pedido(), cfg());
        expect(r.status).toBe('rejected');
        expect(r.errorMessage).toBe('El rango de numeración no existe');
    });

    it('un 502 del PAC NO se marca rechazada: se lanza reintentable', async () => {
        // El bug: `res.json()` antes de `res.ok` reventaba con el HTML del 502, y
        // arriba eso se escribía 'rejected' — con la numeración DIAN ya quemada y
        // el documento posiblemente vivo. La reconciliación excluye 'rejected'.
        pacEmision({ status: 502, body: '<html>502 Bad Gateway</html>' });
        const p = factusV2Adapter.emit(pedido(), cfg());
        await expect(p).rejects.toBeInstanceOf(PacTransportError);
        await expect(p).rejects.toThrow(/502/);
    });

    it('un 429 tampoco quema la factura', async () => {
        pacEmision({ status: 429, body: { message: 'Too Many Attempts.' } });
        await expect(factusV2Adapter.emit(pedido(), cfg()))
            .rejects.toBeInstanceOf(PacTransportError);
    });

    it('credenciales rechazadas en el OAuth son un problema NUESTRO, no un rechazo', async () => {
        globalThis.fetch = vi.fn(async (url: any) =>
            String(url).includes('/oauth/token')
                ? resp(401, { message: 'Unauthenticated.' })
                : resp(201, { data: documentoValidado }),
        ) as any;
        await expect(factusV2Adapter.emit(pedido(), cfg()))
            .rejects.toBeInstanceOf(PacTransportError);
    });

    it('un 500 con cuerpo JSON LEGIBLE tampoco se convierte en rechazo', async () => {
        // El caso más traicionero: acá el cuerpo sí se parsea, así que el orden
        // viejo (parsear y devolver antes de clasificar el status) lo entregaba
        // como respuesta y arriba se escribía 'rejected' — número DIAN quemado y
        // documento posiblemente vivo. Tiene que salir por excepción.
        pacEmision({ status: 500, body: { message: 'Server Error' } });
        const r = await factusV2Adapter.emit(pedido(), cfg()).then((x) => x, (e) => e);
        expect(r).toBeInstanceOf(PacTransportError);
        expect((r as PacTransportError).httpStatus).toBe(500);
    });
});

// ─── fetchByReference: el camino que completa la factura de producción ────────

describe('fetchByReference — completa la factura que nació como acuse', () => {
    it('una referencia que el PAC no conoce devuelve null (no una factura vacía)', async () => {
        montarPac((u) => (u.includes('/v2/bills?') ? { status: 200, body: { data: { data: [] } } } : undefined));
        expect(await factusV2Adapter.fetchByReference!('SM-PAY-0001', cfg())).toBeNull();
    });

    it('el detalle aporta el CUFE que el listado no trae', async () => {
        const pac = montarPac((u) => {
            if (u.includes('/v2/bills?')) {
                return { status: 200, body: { data: { data: [{ number: 'SETP990018445', total: '250000.00' }] } } };
            }
            if (u.includes('/v2/bills/')) return { status: 200, body: { data: documentoValidado } };
            return undefined;
        });
        const r = await factusV2Adapter.fetchByReference!('SM-PAY-0001', cfg());
        expect(r?.status).toBe('accepted');
        expect(r?.cufe).toBe('a1b2c3d4e5f6');
        // El filtro viaja codificado; sin él el PAC devolvería la lista completa.
        expect(pac.urls.some((u) => u.includes('filter%5Breference_code%5D=SM-PAY-0001'))).toBe(true);
    });

    it('si el detalle falla, se conserva el hallazgo del listado en vez de perderlo', async () => {
        montarPac((u) => {
            if (u.includes('/v2/bills?')) {
                return { status: 200, body: { data: { data: [{ number: 'SETP990018445', total: '250000.00' }] } } };
            }
            return { status: 422, body: { message: 'no disponible' } };
        });
        const r = await factusV2Adapter.fetchByReference!('SM-PAY-0001', cfg());
        expect(r?.number).toBe('SETP990018445');
        expect(r?.total).toBe(250000);
        expect(r?.status).toBe('sent');
    });
});
