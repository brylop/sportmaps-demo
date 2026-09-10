/**
 * Pruebas de invoicing.service — el orquestador que decide QUÉ se factura, POR
 * CUÁNTO y A NOMBRE DE QUIÉN. Todo moqueado: cero red, cero base, cero PAC.
 *
 * Lo que se blinda acá son errores que ya salieron caros y que no gritan cuando
 * vuelven, porque el sistema sigue "funcionando":
 *
 *   - Una fila 'queued' que nunca llegó al PAC contada como factura → el pago
 *     queda bloqueado para siempre y nadie se enteraba.
 *   - Un 502 del PAC marcado 'rejected' → número de la resolución DIAN quemado,
 *     documento vivo en la DIAN, y para nosotros "Rechazada" definitiva.
 *   - Facturar `amount` en vez de `gross_amount` → el extracto de tarjeta del
 *     padre no cuadra con la factura.
 *   - `Number('05001')` = 5001 → 148 municipios (Antioquia, Atlántico) sin
 *     código válido.
 *   - Emitir por un cobro que no está 'paid' → numeración fiscal irrecuperable.
 *
 * `esFacturaEfectiva` y `loadCustomer` no se exportan, así que se prueban por su
 * único camino observable: `backfillInvoices({dryRun})` para la clasificación, y
 * lo que el servicio le pasa al adaptador (`emit`) para los datos del cliente.
 * Eso es además lo que de verdad importa: lo que llega al PAC.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PacTransportError, TRANSPORT_ERROR_PREFIX } from './invoicing/types';

// ─── Stub de supabase ─────────────────────────────────────────────────────────
// Encadena lo que el servicio usa (select/eq/in/or/order/range/upsert/update/
// insert/delete) sobre tablas en memoria. `or`, `gte`, `lte` y `order` son
// no-ops a propósito: el filtro por fechas es de PostgREST, y acá las filas se
// siembran ya dentro del rango.

type Fila = Record<string, any>;
let tablas: Record<string, Fila[]> = {};
let secuencia = 0;

function builder(tabla: string) {
    const store = () => (tablas[tabla] ??= []);
    let filas = [...store()];
    let op = 'select';
    let cuerpo: any = null;

    const api: any = {
        select: () => api,
        insert: (rows: any) => {
            op = 'insert';
            const arr = Array.isArray(rows) ? rows : [rows];
            inserciones.push({ tabla, filas: arr });
            store().push(...arr.map((r: Fila) => ({ ...r })));
            filas = arr;
            return api;
        },
        // Idempotencia real por (owner_type, owner_id, reference_code), que es el
        // onConflict que usa el servicio: un segundo intento del MISMO pago
        // reusa la fila en vez de crear otra.
        upsert: (row: Fila) => {
            op = 'upsert';
            const previa = store().find(f =>
                f.owner_type === row.owner_type &&
                f.owner_id === row.owner_id &&
                f.reference_code === row.reference_code);
            if (previa) {
                Object.assign(previa, row);
                filas = [previa];
            } else {
                const nueva = { id: `inv-${++secuencia}`, ...row };
                store().push(nueva);
                filas = [nueva];
            }
            return api;
        },
        update: (row: Fila) => { op = 'update'; cuerpo = row; return api; },
        delete: () => { op = 'delete'; return api; },
        eq: (col: string, val: any) => {
            if (op === 'update') {
                for (const f of store()) if (f[col] === val) Object.assign(f, cuerpo);
            } else if (op === 'delete') {
                tablas[tabla] = store().filter(f => f[col] !== val);
            }
            filas = filas.filter(f => f[col] === val);
            return api;
        },
        in: (col: string, vals: any[]) => {
            filas = filas.filter(f => vals.includes(f[col]));
            return api;
        },
        or: () => api,
        gte: () => api,
        lte: () => api,
        order: () => api,
        limit: (n: number) => { filas = filas.slice(0, n); return api; },
        range: (desde: number, hasta: number) => { filas = filas.slice(desde, hasta + 1); return api; },
        maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
        single: async () => ({ data: filas[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve({ data: filas, error: null }).then(res, rej),
    };
    return api;
}

let inserciones: { tabla: string; filas: Fila[] }[] = [];

vi.mock('../config/supabase', () => ({
    supabase: { from: (tabla: string) => builder(tabla) },
}));

// El facturador del dueño y el adaptador del PAC se inyectan por test.
let cfgFalso: any = null;
let adaptadorFalso: any = null;

vi.mock('./invoice-provider.resolver', () => ({
    resolveInvoiceProvider: async () => cfgFalso,
}));

vi.mock('./invoicing', () => ({
    getAdapter: () => adaptadorFalso,
    listSupportedProviders: () => ['factus_v2'],
}));

import { emitInvoiceForPayment, backfillInvoices } from './invoicing.service';

// ─── Datos base ───────────────────────────────────────────────────────────────

const ESCUELA = 'aaaaaaaa-0000-4000-8000-000000000001';
const PAGO = 'pa000001-0000-4000-8000-000000000001';
const PAGO2 = 'pa000002-0000-4000-8000-000000000002';
const PAGO3 = 'pa000003-0000-4000-8000-000000000003';
const PADRE = 'cc000001-0000-4000-8000-000000000001';
const ADULTO = 'cc000009-0000-4000-8000-000000000009';

/** Config de facturador válida: rango de numeración + municipio del emisor. */
function cfgBase(config: Fila = {}) {
    return {
        provider: 'factus_v2',
        sandbox: true,
        credentials: {},
        config: { numbering_range_id: 8, default_municipality_id: 11001, ...config },
    };
}

/** Acuse de Factus V2 en producción: ni número ni CUFE, solo "en proceso". */
const ACUSE = { status: 'sent', providerBillId: 'FV-1', number: null, cufe: null, raw: {} };
/** Documento ya validado por la DIAN. */
const ACEPTADA = {
    status: 'accepted', providerBillId: 'FV-2', prefix: 'SETP', number: '990000123',
    cufe: 'e6f1a...', taxableAmount: 210000, taxAmount: 0, total: 210000,
    validatedAt: '2026-09-05T10:00:05Z', raw: {},
};
/** Rechazo de contenido del PAC/DIAN. */
const RECHAZADA = { status: 'rejected', errorMessage: 'El NIT del adquiriente no existe en el RUT', raw: {} };

function sembrarPago(pago: Partial<Fila> = {}, perfil: Partial<Fila> = {}) {
    tablas.payments = [{
        id: PAGO,
        amount: 210000,
        gross_amount: null,
        payment_method: 'transfer',
        status: 'paid',
        concept: 'Mensualidad septiembre',
        school_id: ESCUELA,
        parent_id: PADRE,
        user_id: null,
        payment_date: '2026-09-05',
        created_at: '2026-09-05T10:00:00Z',
        ...pago,
    }];
    tablas.profiles = [{
        id: PADRE,
        full_name: 'Juan Pérez',
        email: 'juan@ejemplo.co',
        phone: '3000000000',
        document_type: 'CC',
        document_number: '1015418301',
        billing_address: 'Calle 1 # 2-3',
        billing_state_dane: '11',
        billing_city_dane: '11001',
        ...perfil,
    }];
}

/** Adaptador que responde `resultado` (o lo calcula según la petición). */
function adaptadorQueDevuelve(resultado: any) {
    const emit = vi.fn(async (req: any) =>
        typeof resultado === 'function' ? resultado(req) : resultado);
    adaptadorFalso = { provider: 'factus_v2', emit };
    return emit;
}

/** Adaptador que revienta: red, timeout, 5xx, o rechazo terminal. */
function adaptadorQueLanza(e: any) {
    const emit = vi.fn(async () => { throw e; });
    adaptadorFalso = { provider: 'factus_v2', emit };
    return emit;
}

/** Lo que el servicio le pasó al PAC en la primera (y normalmente única) llamada. */
function peticionAlPac(emit: any) {
    return emit.mock.calls[0][0];
}

const RANGO = { ownerType: 'school' as const, ownerId: ESCUELA, from: '2026-09-01', to: '2026-09-30' };

beforeEach(() => {
    tablas = {};
    inserciones = [];
    secuencia = 0;
    cfgFalso = cfgBase();
    adaptadorFalso = null;
    vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => vi.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────────────

describe('el estado del cobro decide si se puede facturar', () => {
    it('un cobro pendiente no quema numeración: no se llama al PAC ni nace la fila', async () => {
        sembrarPago({ status: 'pending' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.ok).toBe(false);
        expect(r.error).toBe('payment_not_paid');
        expect(emit).not.toHaveBeenCalled();
        expect(tablas.electronic_invoices ?? []).toHaveLength(0);
    });

    it('un cobro anulado tampoco se factura', async () => {
        sembrarPago({ status: 'cancelled' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.error).toBe('payment_not_paid');
        expect(emit).not.toHaveBeenCalled();
    });

    it('un cobro pagado sí llega al PAC', async () => {
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.ok).toBe(true);
        expect(emit).toHaveBeenCalledTimes(1);
    });
});

describe('el monto facturado es lo que el pagador pagó', () => {
    it('con recargo online se factura el bruto, no el neto de la mensualidad', async () => {
        sembrarPago({ amount: 210000, gross_amount: 220500 });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).items[0].unitPrice).toBe(220500);
    });

    it('sin pasarela (gross_amount nulo) se factura el monto del cobro', async () => {
        sembrarPago({ amount: 210000, gross_amount: null });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).items[0].unitPrice).toBe(210000);
    });

    // Esta prueba nació roja y documentaba un bug real: el servicio hacía
    // `Number(payment.gross_amount ?? payment.amount)`, y `??` solo atrapa null
    // y undefined. Un `gross_amount` en 0 —o cualquier valor por debajo de
    // `amount`— emitía un documento fiscal por MENOS de lo cobrado, que ante la
    // DIAN no se corrige: se anula con nota crédito, y Dynasty no tiene rango
    // de nota crédito en producción.
    // ARREGLADO con un piso explícito (`Math.max`), así que la prueba pasa a
    // ser un guard de no-regresión: el invariante ahora lo sostiene el código y
    // no la suerte de los datos.
    it('el monto facturado nunca es menor que amount, aunque gross_amount venga en 0', async () => {
        sembrarPago({ amount: 210000, gross_amount: 0 });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).items[0].unitPrice).toBeGreaterThanOrEqual(210000);
    });
});

describe('los datos fiscales del comprador', () => {
    it('la cédula guardada con espacios viaja sin ellos', async () => {
        sembrarPago({}, { document_number: ' 1015 418301 ' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).customer.identification).toBe('1015418301');
    });

    it('el punto y el guion del dígito de verificación de un NIT NO se tocan', async () => {
        sembrarPago({}, { document_type: 'NIT', document_number: '900.123.456-7' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).customer.identification).toBe('900.123.456-7');
    });

    it('el código DANE de Medellín conserva el cero inicial y viaja como texto', async () => {
        sembrarPago({}, { billing_city_dane: '05001' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        const { municipalityCode } = peticionAlPac(emit).customer;
        expect(municipalityCode).toBe('05001');
        expect(typeof municipalityCode).toBe('string');
    });

    it('un código de 4 dígitos es un cero comido y se le repone', async () => {
        sembrarPago({}, { billing_city_dane: '5001' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).customer.municipalityCode).toBe('05001');
    });

    it('un municipio en texto libre no se manda como código: entra el del emisor y queda el aviso', async () => {
        sembrarPago({}, { billing_city_dane: 'Medellin' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).customer.municipalityCode).toBe('11001');
        expect(peticionAlPac(emit).customer.city).toBe('Medellin');
        expect(r.warnings).toContain('municipio_del_emisor_por_falta_del_cliente:11001');
    });

    it("con la política 'require' el municipio faltante corta ANTES de crear la fila", async () => {
        cfgFalso = cfgBase({ customer_municipality_policy: 'require' });
        sembrarPago({}, { billing_city_dane: '' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.error).toBe('customer_missing_municipality');
        expect(emit).not.toHaveBeenCalled();
        // Lo que importa: NO queda una fila 'queued' que el barrido cuente como
        // facturada y deje el pago bloqueado para siempre.
        expect(tablas.electronic_invoices ?? []).toHaveLength(0);
    });

    it('sin documento no se factura', async () => {
        sembrarPago({}, { document_number: null });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.error).toBe('customer_missing_fiscal_data');
        expect(emit).not.toHaveBeenCalled();
    });

    it('un documento de solo espacios cuenta como ausente', async () => {
        sembrarPago({}, { document_number: '   ' });
        adaptadorQueDevuelve(ACEPTADA);

        expect((await emitInvoiceForPayment(PAGO)).error).toBe('customer_missing_fiscal_data');
    });

    it('sin pagador se reporta como tal, no como falta de datos fiscales', async () => {
        sembrarPago({ parent_id: null, user_id: null });
        adaptadorQueDevuelve(ACEPTADA);

        expect((await emitInvoiceForPayment(PAGO)).error).toBe('payment_without_payer');
    });

    it('el atleta adulto que paga por sí mismo se factura con su propio perfil', async () => {
        sembrarPago({ parent_id: null, user_id: ADULTO });
        tablas.profiles.push({
            id: ADULTO, full_name: 'Ana Gómez', document_type: 'CC',
            document_number: '4736509', billing_address: 'Cra 7 # 8-9',
            billing_city_dane: '05001',
        });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.ok).toBe(true);
        expect(peticionAlPac(emit).customer.identification).toBe('4736509');
        expect(peticionAlPac(emit).customer.name).toBe('Ana Gómez');
    });

    // HALLAZGO SIN PRUEBA, a propósito.
    //
    // `loadCustomer` solo exige documento: sin `billing_address` la factura sale
    // igual y el adaptador manda `address: ''`, así que el documento queda sin
    // dirección del adquirente. Acá había un `it.fails` exigiendo fail-closed, y
    // se quitó porque fijaba una política que este mismo módulo YA rechazó para
    // el campo análogo: el municipio quedó en modo 'fallback' justamente porque
    // cortar la emisión con 0 de 147 pagos completos dejaba a la escuela sin
    // facturar nada. Además ninguna fuente dice que Factus exija `address`, y la
    // DIAN por grupo de dirección incompleto devuelve una notificación BLANDA
    // (FAK08), no un rechazo.
    //
    // O sea: es un dato que conviene pedir, no un motivo para no facturar. El
    // día que se decida cómo tratarlo (aviso, o motivo de skip como el
    // municipio), la prueba se escribe contra ESA decisión. Pinearla antes
    // habría convertido un deseo en contrato.
});

describe('el medio de pago real llega al adaptador', () => {
    it('una transferencia se declara como transferencia, no como efectivo', async () => {
        sembrarPago({ payment_method: 'transfer' });
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        // Sin este campo el adaptador clavaba '10' = efectivo para TODO.
        expect(peticionAlPac(emit).paymentMethod).toBe('transfer');
    });
});

describe('el acuse del PAC cuenta como emisión', () => {
    it("un acuse sin número ('sent') es una emisión buena, no un fallo", async () => {
        sembrarPago();
        adaptadorQueDevuelve(ACUSE);

        const r = await emitInvoiceForPayment(PAGO);

        // Factus V2 en producción NUNCA responde 'accepted' en la emisión;
        // exigirlo contaba toda emisión real como fallida.
        expect(r.ok).toBe(true);
        expect(r.status).toBe('sent');
    });

    it('un rechazo de contenido de la DIAN no es una emisión', async () => {
        sembrarPago();
        adaptadorQueDevuelve(RECHAZADA);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.ok).toBe(false);
        expect(r.status).toBe('rejected');
    });
});

describe('un fallo de transporte no es un rechazo de la DIAN', () => {
    it('un 502 del PAC deja la fila reintentable en queued y marcada como transporte', async () => {
        sembrarPago();
        adaptadorQueLanza(new PacTransportError('factus emit HTTP 502: <html>bad gateway', 502));

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.ok).toBe(false);
        expect(r.error).toBe('pac_transport_error');
        const fila = tablas.electronic_invoices[0];
        // 'rejected' acá era el peor final: la reconciliación excluye
        // 'rejected', así que el número quedaba quemado y el documento vivo.
        expect(fila.status).toBe('queued');
        expect(String(fila.error_message).startsWith(TRANSPORT_ERROR_PREFIX)).toBe(true);
    });

    it('un timeout de red también queda reintentable', async () => {
        sembrarPago();
        const timeout: any = new Error('The operation was aborted due to timeout');
        timeout.name = 'TimeoutError';
        adaptadorQueLanza(timeout);

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.error).toBe('pac_transport_error');
        expect(tablas.electronic_invoices[0].status).toBe('queued');
    });

    it('un rechazo terminal del PAC sí deja la fila rechazada y sin marca de transporte', async () => {
        sembrarPago();
        adaptadorQueLanza(new Error('factus emit HTTP 422: numbering_range_id inválido'));

        const r = await emitInvoiceForPayment(PAGO);

        expect(r.error).toContain('422');
        const fila = tablas.electronic_invoices[0];
        expect(fila.status).toBe('rejected');
        expect(String(fila.error_message).startsWith(TRANSPORT_ERROR_PREFIX)).toBe(false);
    });
});

// ─── Qué fila cuenta como "ya facturado" (esFacturaEfectiva) ─────────────────
// Se observa por backfillInvoices en dryRun: un pago ya facturado se agrega en
// 'already_invoiced:N'; uno pendiente aparece con su propio id y 'dry_run'.

/** Siembra un pago con UNA fila de electronic_invoices y clasifica el rango. */
async function clasificarCon(factura: Partial<Fila>) {
    sembrarPago();
    tablas.electronic_invoices = [{
        id: 'inv-previa',
        owner_type: 'school',
        owner_id: ESCUELA,
        payment_id: PAGO,
        reference_code: `SM-${PAGO}`,
        status: null,
        number: null,
        cufe: null,
        provider_bill_id: null,
        error_message: null,
        ...factura,
    }];
    const r = await backfillInvoices({ ...RANGO, dryRun: true });
    return {
        yaFacturado: r.details.some(d => d.reason === 'already_invoiced:1'),
        pendiente: r.details.some(d => d.paymentId === PAGO && d.reason === 'dry_run'),
    };
}

describe('qué fila de electronic_invoices significa "ya facturado"', () => {
    it('un queued sin número ni CUFE NO cuenta: el pago sigue pendiente de facturar', async () => {
        // El proceso murió entre el upsert y la llamada al PAC. Contar esto como
        // factura dejaba el pago bloqueado para siempre, sin rescate.
        const r = await clasificarCon({ status: 'queued' });
        expect(r.yaFacturado).toBe(false);
        expect(r.pendiente).toBe(true);
    });

    it('un queued que la reconciliación ya completó con CUFE sí cuenta', async () => {
        const r = await clasificarCon({ status: 'queued', cufe: 'e6f1a...' });
        expect(r.yaFacturado).toBe(true);
        expect(r.pendiente).toBe(false);
    });

    it('un queued con número del PAC sí cuenta', async () => {
        const r = await clasificarCon({ status: 'queued', number: '990000123' });
        expect(r.yaFacturado).toBe(true);
    });

    it('un accepted cuenta como facturado', async () => {
        const r = await clasificarCon({ status: 'accepted', number: '990000123', cufe: 'e6f1a...' });
        expect(r.yaFacturado).toBe(true);
        expect(r.pendiente).toBe(false);
    });

    it("un sent (acuse sin número) cuenta: lo completa la reconciliación, no una emisión nueva", async () => {
        const r = await clasificarCon({ status: 'sent', provider_bill_id: 'FV-1' });
        expect(r.yaFacturado).toBe(true);
        expect(r.pendiente).toBe(false);
    });

    it('un rejected marcado como transporte se reintenta', async () => {
        const r = await clasificarCon({
            status: 'rejected',
            error_message: `${TRANSPORT_ERROR_PREFIX} factus emit HTTP 502: bad gateway`,
        });
        expect(r.yaFacturado).toBe(false);
        expect(r.pendiente).toBe(true);
    });

    it('un rejected de la DIAN es terminal y NO se reintenta', async () => {
        const r = await clasificarCon({
            status: 'rejected',
            error_message: 'El NIT del adquiriente no existe en el RUT',
        });
        expect(r.yaFacturado).toBe(true);
        expect(r.pendiente).toBe(false);
    });

    it('un draft nunca salió: sigue pendiente', async () => {
        const r = await clasificarCon({ status: 'draft' });
        expect(r.yaFacturado).toBe(false);
        expect(r.pendiente).toBe(true);
    });
});

// ─── backfillInvoices ────────────────────────────────────────────────────────

describe('backfillInvoices', () => {
    it('attempted es exactamente emitted + skipped + failed, y cada pago dice por qué', async () => {
        // Tres pagos de la misma escuela: uno emite, uno no tiene datos fiscales
        // y uno lo rechaza la DIAN.
        sembrarPago();
        tablas.payments.push(
            { ...tablas.payments[0], id: PAGO2, parent_id: 'cc000002-0000-4000-8000-000000000002' },
            { ...tablas.payments[0], id: PAGO3, parent_id: 'cc000003-0000-4000-8000-000000000003' },
        );
        tablas.profiles.push(
            // Sin documento → skipped.
            { id: 'cc000002-0000-4000-8000-000000000002', full_name: 'Sin Documento', document_number: null },
            { id: 'cc000003-0000-4000-8000-000000000003', full_name: 'Nit Malo', document_type: 'NIT', document_number: '900123456', billing_address: 'x', billing_city_dane: '11001' },
        );
        adaptadorQueDevuelve((req: any) => (req.referenceCode === `SM-${PAGO3}` ? RECHAZADA : ACUSE));

        const r = await backfillInvoices(RANGO);

        expect(r.emitted).toBe(1);
        expect(r.skipped).toBe(1);
        expect(r.failed).toBe(1);
        expect(r.attempted).toBe(r.emitted + r.skipped + r.failed);
        expect(r.attempted).toBe(3);
        expect(r.details.find(d => d.paymentId === PAGO)?.outcome).toBe('emitted');
        expect(r.details.find(d => d.paymentId === PAGO2)).toMatchObject({
            outcome: 'skipped', reason: 'customer_missing_fiscal_data',
        });
        expect(r.details.find(d => d.paymentId === PAGO3)?.outcome).toBe('failed');
    });

    it('llamarlo dos veces no emite dos veces', async () => {
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACUSE);

        const primera = await backfillInvoices(RANGO);
        const segunda = await backfillInvoices(RANGO);

        expect(primera.emitted).toBe(1);
        expect(segunda.emitted).toBe(0);
        expect(segunda.skipped).toBe(1);
        expect(segunda.details.some(d => d.reason === 'already_invoiced:1')).toBe(true);
        // Lo que de verdad no puede pasar: una segunda llamada al PAC que queme
        // otro número por el mismo pago.
        expect(emit).toHaveBeenCalledTimes(1);
        expect(tablas.electronic_invoices).toHaveLength(1);
    });

    it('un pago que quedó en transporte SÍ se reintenta en la segunda pasada', async () => {
        sembrarPago();
        const emit = adaptadorQueLanza(new PacTransportError('factus emit HTTP 504', 504));

        const primera = await backfillInvoices(RANGO);
        // Al PAC ya se le pasó el susto: ahora responde.
        adaptadorQueDevuelve(ACEPTADA);
        const segunda = await backfillInvoices(RANGO);

        expect(primera.failed).toBe(1);
        expect(emit).toHaveBeenCalledTimes(1);
        expect(segunda.emitted).toBe(1);
        expect(segunda.details.some(d => d.reason === 'already_invoiced:1')).toBe(false);
        // Y sigue siendo UNA sola fila: el upsert por reference_code la reusa.
        expect(tablas.electronic_invoices).toHaveLength(1);
    });

    it('los ya facturados se reportan agregados y suman al skipped', async () => {
        sembrarPago();
        tablas.payments.push({ ...tablas.payments[0], id: PAGO2 });
        tablas.electronic_invoices = [
            { owner_type: 'school', owner_id: ESCUELA, payment_id: PAGO, reference_code: `SM-${PAGO}`, status: 'accepted', number: '1' },
            { owner_type: 'school', owner_id: ESCUELA, payment_id: PAGO2, reference_code: `SM-${PAGO2}`, status: 'accepted', number: '2' },
        ];
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await backfillInvoices(RANGO);

        expect(r.skipped).toBe(2);
        expect(r.attempted).toBe(2);
        expect(r.emitted).toBe(0);
        expect(r.details.filter(d => d.reason === 'already_invoiced:2')).toHaveLength(1);
        expect(emit).not.toHaveBeenCalled();
    });

    it('con el facturador apagado no emite nada y lo dice pago por pago', async () => {
        // Prender el facturador es decisión del dueño, no efecto del backfill.
        cfgFalso = null;
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await backfillInvoices(RANGO);

        expect(r.emitted).toBe(0);
        expect(r.skipped).toBe(1);
        expect(r.failed).toBe(0);
        expect(r.details.find(d => d.paymentId === PAGO)?.reason).toBe('no_invoice_provider');
        expect(emit).not.toHaveBeenCalled();
        expect(tablas.electronic_invoices ?? []).toHaveLength(0);
    });

    it('dryRun clasifica sin llamar al PAC ni crear filas', async () => {
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await backfillInvoices({ ...RANGO, dryRun: true });

        expect(r.emitted).toBe(0);
        expect(r.details.find(d => d.paymentId === PAGO)?.reason).toBe('dry_run');
        expect(emit).not.toHaveBeenCalled();
        expect(tablas.electronic_invoices ?? []).toHaveLength(0);
    });

    it('un rango de fechas inválido no barre nada', async () => {
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await backfillInvoices({ ...RANGO, from: 'septiembre', to: '2026-09-30' });

        expect(r.details[0].reason).toBe('invalid_date_range');
        expect(r.scanned).toBe(0);
        expect(r.attempted).toBe(0);
        expect(emit).not.toHaveBeenCalled();
    });

    it('from posterior a to no barre nada: sin rango válido facturaría años enteros', async () => {
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await backfillInvoices({ ...RANGO, from: '2026-09-30', to: '2026-09-01' });

        expect(r.details[0].reason).toBe('invalid_date_range');
        expect(emit).not.toHaveBeenCalled();
    });

    it('un dueño que no es escuela no tiene este camino', async () => {
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        const r = await backfillInvoices({ ...RANGO, ownerType: 'vendor' as any });

        expect(r.details[0].reason).toBe('owner_type_not_supported');
        expect(emit).not.toHaveBeenCalled();
    });

    it('sin dueño no barre nada', async () => {
        sembrarPago();
        const r = await backfillInvoices({ ...RANGO, ownerId: '' });
        expect(r.details[0].reason).toBe('missing_owner');
    });
});

describe('IVA: excluido no es lo mismo que gravado al 0%', () => {
    it('una mensualidad se guarda EXCLUIDA, no gravada al 0%', async () => {
        // Default del dueño: excluido salvo que config diga lo contrario.
        cfgFalso = cfgBase();
        sembrarPago();
        adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        const item = inserciones.find(i => i.tabla === 'electronic_invoice_items')!.filas[0];
        expect(item.is_excluded).toBe(true);
        expect(item.tax_rate).toBe(0);
    });

    it('con tax_excluded=false el ítem queda gravado a la tarifa configurada', async () => {
        cfgFalso = cfgBase({ tax_excluded: false, default_tax_rate: 19 });
        sembrarPago();
        const emit = adaptadorQueDevuelve(ACEPTADA);

        await emitInvoiceForPayment(PAGO);

        expect(peticionAlPac(emit).items[0].isExcluded).toBe(false);
        const item = inserciones.find(i => i.tabla === 'electronic_invoice_items')!.filas[0];
        expect(item.is_excluded).toBe(false);
        expect(item.tax_rate).toBe(19);
    });
});
