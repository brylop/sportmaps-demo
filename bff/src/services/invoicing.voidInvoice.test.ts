/**
 * Pruebas de `voidInvoice` — la anulación de una factura con nota crédito.
 *
 * Es la operación más irreversible del módulo: un documento con CUFE existe
 * ante la DIAN para siempre y la nota crédito que lo deja sin efecto consume
 * SU PROPIO número de resolución, que tampoco se recupera. Lo que se blinda
 * acá son los tres caminos donde un descuido cuesta caro:
 *
 *   - Anular una factura RECHAZADA sin número quemaría un número de nota
 *     crédito para anular un documento que nunca existió ante la DIAN.
 *   - Anular una factura RECHAZADA que SÍ tiene número y CUFE (el caso real
 *     de DYTY1) tiene que hacer lo contrario: el documento existe allá
 *     aunque acá diga 'rejected', y hay que dejarlo sin efecto de verdad.
 *   - Reemitir después de anular con el MISMO reference_code devolvería el
 *     documento anulado (regla 90 de la DIAN): la referencia del segundo
 *     intento tiene que ser otra.
 *   - Un fallo de TRANSPORTE al emitir la nota crédito no puede marcar la
 *     factura como anulada ni la nota como rechazada: la nota PUDO quedar
 *     creada con su número consumido.
 *
 * Cero red, cero base: Supabase, el resolver del facturador y el adaptador
 * del PAC están moqueados. El mock de Supabase es el MISMO patrón que
 * invoicing.service.unit.test.ts (no se puede compartir: vi.mock es por
 * archivo), incluida su idempotencia real por (owner_type, owner_id,
 * reference_code) en `upsert`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PacTransportError, TRANSPORT_ERROR_PREFIX } from './invoicing/types';

// ─── Stub de supabase (mismo patrón que invoicing.service.unit.test.ts) ────────

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
            store().push(...arr.map((r: Fila) => ({ ...r })));
            filas = arr;
            return api;
        },
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
        in: (col: string, vals: any[]) => { filas = filas.filter(f => vals.includes(f[col])); return api; },
        order: (col: string, opts?: { ascending?: boolean }) => {
            const asc = opts?.ascending !== false;
            filas = [...filas].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
            return api;
        },
        limit: (n: number) => { filas = filas.slice(0, n); return api; },
        maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
        single: async () => ({ data: filas[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve({ data: filas, error: null }).then(res, rej),
    };
    return api;
}

vi.mock('../config/supabase', () => ({
    supabase: { from: (tabla: string) => builder(tabla) },
}));

let cfgFalso: any = null;
let adaptadorFalso: any = null;

vi.mock('./invoice-provider.resolver', () => ({
    resolveInvoiceProvider: async () => cfgFalso,
}));

vi.mock('./invoicing', () => ({
    getAdapter: () => adaptadorFalso,
    listSupportedProviders: () => ['factus_v2'],
}));

import { voidInvoice, emitInvoiceForPayment } from './invoicing.service';

// ─── Datos base ─────────────────────────────────────────────────────────────

const ESCUELA = 'aaaaaaaa-0000-4000-8000-000000000001';
const PAGO = 'pa000001-0000-4000-8000-000000000001';
const FACTURA = 'fa000001-0000-4000-8000-000000000001';
const ACTOR = 'ac000001-0000-4000-8000-000000000001';

/** Config con el rango de FACTURAS y el de NOTA CRÉDITO configurados. */
function cfgConRangoNC(config: Fila = {}) {
    return {
        provider: 'factus_v2',
        sandbox: true,
        credentials: {},
        config: { numbering_range_id: 8, credit_note_numbering_range_id: 9, default_municipality_id: 11001, ...config },
    };
}

/** La misma config, SIN el rango de nota crédito — el estado real de Dynasty en producción. */
function cfgSinRangoNC() {
    const c = cfgConRangoNC();
    delete c.config.credit_note_numbering_range_id;
    return c;
}

/** Una factura 'accepted' con número y CUFE: el caso común, sí se puede anular. */
function facturaAceptada(over: Fila = {}) {
    return {
        id: FACTURA,
        owner_type: 'school',
        owner_id: ESCUELA,
        provider: 'factus_v2',
        document_type: 'invoice',
        status: 'accepted',
        number: 'SETP990000123',
        prefix: 'SETP',
        cufe: 'e6f1a-cufe-real',
        payment_id: PAGO,
        total: 210000,
        taxable_amount: 210000,
        tax_amount: 0,
        reference_code: `SM-${PAGO}`,
        // Forma real de InvoiceCustomer (no la del wire de Factus: `name`, no
        // `names`) — es lo que `emitInvoiceForPayment` guarda de verdad como
        // customer_snapshot al emitir, y lo que voidInvoice tiene que reenviar
        // tal cual a emitCreditNote.
        customer_snapshot: {
            documentType: 'CC', identification: '1015418301', name: 'Juan Pérez',
            email: 'juan@ejemplo.co', address: 'Calle 1 # 2-3', municipalityCode: '11001',
        },
        voided_by_invoice_id: null,
        ...over,
    };
}

function sembrarFactura(over: Fila = {}) {
    tablas.electronic_invoices = [facturaAceptada(over)];
}

function sembrarItems(items: Fila[]) {
    tablas.electronic_invoice_items = items.map((it, i) => ({ line_no: i + 1, invoice_id: FACTURA, ...it }));
}

/** Nota crédito emitida y validada por el PAC. */
const NC_ACEPTADA = {
    status: 'accepted', number: 'NC00001', cufe: 'nc-cufe-real', publicUrl: 'https://factus/nc/1',
    taxableAmount: 210000, taxAmount: 0, total: 210000, validatedAt: '2026-09-10T10:00:05Z', raw: {},
};
/** Acuse: producción responde solo esto y valida minutos después. */
const NC_ACUSE = { status: 'sent', number: null, cufe: null, raw: {} };
/** El PAC rechazó el CONTENIDO de la nota crédito. La factura sigue viva. */
const NC_RECHAZADA = { status: 'rejected', errorMessage: 'concepto de corrección inválido', raw: {} };

/** Adaptador con emitCreditNote (y opcionalmente emit, para las pruebas que reemiten). */
function adaptadorCon(opts: { emitCreditNote?: any; emit?: any } = {}) {
    const emitCreditNote = opts.emitCreditNote ?? vi.fn(async () => NC_ACEPTADA);
    const emit = opts.emit ?? vi.fn(async () => ({ status: 'accepted', number: 'X', cufe: 'y', raw: {} }));
    adaptadorFalso = { provider: 'factus_v2', emit, emitCreditNote };
    return { emit, emitCreditNote };
}

/** Adaptador SIN emitCreditNote — el caso de Factus V1. */
function adaptadorSinNotaCredito() {
    adaptadorFalso = { provider: 'factus', emit: vi.fn() };
    return adaptadorFalso;
}

beforeEach(() => {
    tablas = {};
    secuencia = 0;
    cfgFalso = cfgConRangoNC();
    adaptadorFalso = null;
    vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => vi.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────────────

describe('el documento que se anula: bill_number y concepto viajan tal cual', () => {
    it('bill_number es el NÚMERO de la factura, no el uuid de la fila', async () => {
        sembrarFactura({ number: 'DYTY1' });
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, correctionConceptCode: '2', reason: 'prueba', actorId: ACTOR });

        expect(emitCreditNote).toHaveBeenCalledTimes(1);
        const req = emitCreditNote.mock.calls[0][0];
        expect(req.billNumber).toBe('DYTY1');
        expect(req.billNumber).not.toBe(FACTURA);
    });

    it('el concepto de corrección que se pide es el que viaja al PAC', async () => {
        sembrarFactura();
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, correctionConceptCode: '4', reason: 'ajuste de precio', actorId: ACTOR });

        expect(emitCreditNote.mock.calls[0][0].correctionConceptCode).toBe('4');
    });

    it('sin concepto explícito, el default es "2" (anulación de factura electrónica)', async () => {
        sembrarFactura();
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(emitCreditNote.mock.calls[0][0].correctionConceptCode).toBe('2');
    });
});

describe('las tres situaciones — el discriminador es si hay NÚMERO, no el status', () => {
    it('rechazada SIN número ni CUFE: descarte local, el PAC nunca se llama', async () => {
        sembrarFactura({ status: 'rejected', number: null, cufe: null });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(true);
        expect(r.mode).toBe('discarded');
        expect(r.invoiceStatus).toBe('void');
        expect(emitCreditNote).not.toHaveBeenCalled();
        expect(tablas.electronic_invoices[0].status).toBe('void');
        // Sin nota crédito: el enlace queda null, y eso es un estado legítimo
        // (ver COMMENT de la migración), no un dato faltante.
        expect(tablas.electronic_invoices[0].voided_by_invoice_id).toBeNull();
    });

    it('rechazada CON número Y CUFE (el caso DYTY1): el documento existe ante la DIAN, sí se anula', async () => {
        sembrarFactura({ status: 'rejected', number: 'DYTY1', cufe: 'cufe-real-de-dyty1' });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(emitCreditNote).toHaveBeenCalledTimes(1);
        expect(r.ok).toBe(true);
        expect(r.mode).toBe('credit_note');
    });

    it('rechazada CON cufe pero SIN número: no se adivina, hay que reconciliar primero', async () => {
        sembrarFactura({ status: 'rejected', number: null, cufe: 'cufe-huerfano' });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_without_number');
        expect(emitCreditNote).not.toHaveBeenCalled();
        // No se tocó nada: la factura sigue como estaba.
        expect(tablas.electronic_invoices[0].status).toBe('rejected');
    });

    it("'sent' sin número: el PAC pudo haberla creado, no se decide sin reconciliar", async () => {
        sembrarFactura({ status: 'sent', number: null, cufe: null });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_pending_reconciliation');
        expect(emitCreditNote).not.toHaveBeenCalled();
        expect(tablas.electronic_invoices[0].status).toBe('sent');
    });

    it("'queued' sin número: mismo corte que 'sent'", async () => {
        sembrarFactura({ status: 'queued', number: null, cufe: null });
        adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_pending_reconciliation');
    });

    it('ya está void: no se reintenta, se dice que ya estaba', async () => {
        sembrarFactura({ status: 'void' });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_already_void');
        expect(emitCreditNote).not.toHaveBeenCalled();
    });

    it('una nota crédito no se anula con este camino (sería una nota débito)', async () => {
        sembrarFactura({ document_type: 'credit_note' });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('not_an_invoice');
        expect(emitCreditNote).not.toHaveBeenCalled();
    });

    it('factura inexistente', async () => {
        adaptadorCon();
        const r = await voidInvoice({ invoiceId: 'no-existe', actorId: ACTOR });
        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_not_found');
    });
});

describe('sin rango de nota crédito, no se emite NADA', () => {
    it('falla ANTES de tocar el PAC, con el motivo exacto que dice qué hacer', async () => {
        sembrarFactura();
        cfgFalso = cfgSinRangoNC();
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('missing_credit_note_range');
        expect(emitCreditNote).not.toHaveBeenCalled();
        // La factura NO cambia de estado: sigue disponible para anular en
        // cuanto se configure el rango.
        expect(tablas.electronic_invoices[0].status).toBe('accepted');
    });
});

describe('un adaptador sin emitCreditNote (Factus V1) no revienta', () => {
    it('da un motivo claro en vez de "is not a function"', async () => {
        sembrarFactura();
        adaptadorSinNotaCredito();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toContain('credit_note_not_supported');
        expect(tablas.electronic_invoices[0].status).toBe('accepted');
    });
});

describe('la fila anulada NUNCA se borra', () => {
    it('sigue existiendo en la tabla, con status void', async () => {
        sembrarFactura();
        adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const fila = tablas.electronic_invoices.find(f => f.id === FACTURA);
        expect(fila).toBeDefined();
        expect(fila!.status).toBe('void');
    });

    it('queda enlazada con la nota crédito que la anuló (voided_by_invoice_id)', async () => {
        sembrarFactura();
        adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const fila = tablas.electronic_invoices.find(f => f.id === FACTURA)!;
        expect(fila.voided_by_invoice_id).toBe(r.creditNote!.id);
        // Y la nota crédito es una fila DISTINTA, con su propio número.
        const nc = tablas.electronic_invoices.find(f => f.id === r.creditNote!.id)!;
        expect(nc.document_type).toBe('credit_note');
        expect(nc.number).toBe('NC00001');
    });

    it('la nota crédito NO comparte payment_id con la factura (o el padre vería el número de la NC como si fuera su factura)', async () => {
        sembrarFactura();
        adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const nc = tablas.electronic_invoices.find(f => f.id === r.creditNote!.id)!;
        expect(nc.payment_id).not.toBe(PAGO);
        expect(nc.payment_id ?? null).toBeNull();
    });
});

describe('el pago vuelve a ser facturable, con una referencia DISTINTA', () => {
    it('reemitir tras anular NO usa el mismo reference_code (si lo usara, el PAC devolvería el documento anulado)', async () => {
        sembrarFactura();
        const { emit } = adaptadorCon();

        const referenciaOriginal = tablas.electronic_invoices[0].reference_code;
        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        // Ahora se factura el pago de cero: se necesita `payments` sembrado
        // (emitInvoiceForPayment lo exige) y un cliente con datos completos.
        tablas.payments = [{
            id: PAGO, amount: 210000, gross_amount: null, payment_method: 'transfer',
            status: 'paid', concept: 'Mensualidad', school_id: ESCUELA, parent_id: ACTOR, user_id: null,
        }];
        tablas.profiles = [{
            id: ACTOR, full_name: 'Ana Gómez', document_type: 'CC', document_number: '4736509',
            billing_address: 'Calle 1', billing_city_dane: '11001',
        }];

        const r2 = await emitInvoiceForPayment(PAGO);

        expect(r2.ok).toBe(true);
        expect(emit).toHaveBeenCalledTimes(1);
        const referenciaNueva = emit.mock.calls[0][0].referenceCode;
        expect(referenciaNueva).not.toBe(referenciaOriginal);
        expect(referenciaNueva).toBe(`${referenciaOriginal}-R2`);
    });
});

describe('items de la nota crédito — tienen que emparejar con la factura original', () => {
    it('se copian de electronic_invoice_items cuando existen', async () => {
        sembrarFactura();
        sembrarItems([
            { code_reference: 'MENS-09', name: 'Mensualidad septiembre', quantity: 1, unit_price: 210000, discount_rate: 0, is_excluded: true, tax_rate: 0 },
        ]);
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const items = emitCreditNote.mock.calls[0][0].items;
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('Mensualidad septiembre');
        expect(items[0].isExcluded).toBe(true);
    });

    it('sin líneas guardadas, se reconstruye UNA línea EXCLUIDA desde el total (tax_amount=0)', async () => {
        sembrarFactura({ total: 90000, taxable_amount: 90000, tax_amount: 0 });
        // Sin sembrarItems(): electronic_invoice_items queda vacía.
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const items = emitCreditNote.mock.calls[0][0].items;
        expect(items).toHaveLength(1);
        expect(items[0].unitPrice).toBe(90000);
        expect(items[0].isExcluded).toBe(true);
    });

    it('sin líneas guardadas y con IVA (tax_amount>0), se reconstruye GRAVADA — no se asume excluida a ciegas', async () => {
        // Una venta de tienda: 119.000 de los cuales 19.000 son IVA al 19%.
        sembrarFactura({ total: 119000, taxable_amount: 100000, tax_amount: 19000 });
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const items = emitCreditNote.mock.calls[0][0].items;
        expect(items[0].isExcluded).toBe(false);
        expect(items[0].taxRate).toBe(19);
    });

    it('sin líneas ni total: no hay con qué armar la nota crédito, se rechaza sin llamar al PAC', async () => {
        sembrarFactura({ total: null, taxable_amount: null, tax_amount: null });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_without_items');
        expect(emitCreditNote).not.toHaveBeenCalled();
    });
});

describe('un fallo de TRANSPORTE en la nota crédito no es un rechazo', () => {
    it('la factura NO se marca void: la nota pudo quedar creada con su número consumido', async () => {
        sembrarFactura();
        const emitCreditNote = vi.fn(async () => { throw new PacTransportError('502 del PAC', 502); });
        adaptadorFalso = { provider: 'factus_v2', emit: vi.fn(), emitCreditNote };

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('pac_transport_error');
        // La factura ORIGINAL sigue como estaba: no se afirma una anulación
        // que no se pudo confirmar.
        expect(tablas.electronic_invoices.find(f => f.id === FACTURA)!.status).toBe('accepted');
    });

    it('la fila de la nota crédito queda en "queued" con el prefijo de transporte, reintentable', async () => {
        sembrarFactura();
        const emitCreditNote = vi.fn(async () => { throw new PacTransportError('timeout', undefined); });
        adaptadorFalso = { provider: 'factus_v2', emit: vi.fn(), emitCreditNote };

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const nc = tablas.electronic_invoices.find(f => f.document_type === 'credit_note');
        expect(nc).toBeDefined();
        expect(nc!.status).toBe('queued');
        expect(String(nc!.error_message)).toContain(TRANSPORT_ERROR_PREFIX);
    });

    it('un rechazo TERMINAL del PAC (contenido inválido) deja la factura viva, no queued', async () => {
        sembrarFactura();
        adaptadorCon({ emitCreditNote: vi.fn(async () => NC_RECHAZADA) });

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('credit_note_rejected');
        // El peor final posible sería marcar la factura anulada cuando la
        // nota que iba a anularla fue rechazada: quedaría viva ante la DIAN
        // y nosotros la contaríamos como sin efecto.
        expect(tablas.electronic_invoices.find(f => f.id === FACTURA)!.status).toBe('accepted');
    });
});

describe("'sent' de la nota crédito SÍ cuenta como anulación (async de producción)", () => {
    it('con solo el acuse (sin número todavía), la factura ya queda void', async () => {
        sembrarFactura();
        adaptadorCon({ emitCreditNote: vi.fn(async () => NC_ACUSE) });

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(true);
        expect(r.invoiceStatus).toBe('void');
        expect(tablas.electronic_invoices.find(f => f.id === FACTURA)!.status).toBe('void');
    });
});

describe('doble clic / reintento sobre una nota crédito ya emitida', () => {
    it('no se llama al PAC una segunda vez: se completa la anulación con la nota que ya existe', async () => {
        sembrarFactura();
        const { emitCreditNote } = adaptadorCon();

        const r1 = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });
        expect(r1.ok).toBe(true);

        // Un segundo voidInvoice sobre la MISMA factura: como ya quedó 'void',
        // entra por el guard temprano de "invoice_already_void" — el camino
        // real de doble-clic sin ese guard (una nota 'queued'/'sent' de un
        // intento anterior) se prueba abajo.
        const r2 = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });
        expect(r2.ok).toBe(false);
        expect(r2.error).toBe('invoice_already_void');
        expect(emitCreditNote).toHaveBeenCalledTimes(1);
    });

    it("una nota crédito que quedó 'sent' de un intento anterior no dispara un segundo POST al PAC", async () => {
        // Simula el corte real: la factura AÚN no se marcó void (se cayó
        // el proceso entre el acuse y marcarFacturaAnulada), pero la fila
        // de la nota crédito ya existe con reference_code determinista.
        sembrarFactura({ voided_by_invoice_id: null });
        tablas.electronic_invoices.push({
            id: 'nc-previa', owner_type: 'school', owner_id: ESCUELA, provider: 'factus_v2',
            document_type: 'credit_note', reference_code: `NC-${FACTURA}`, status: 'sent',
            number: null, cufe: null, public_url: null,
        });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(emitCreditNote).not.toHaveBeenCalled();
        expect(r.ok).toBe(true);
        expect(r.mode).toBe('credit_note');
        expect(tablas.electronic_invoices.find(f => f.id === FACTURA)!.status).toBe('void');
    });
});

describe('el adquirente que viaja a la nota crédito es el de la FACTURA ORIGINAL', () => {
    // Nace de un hallazgo real: la doc de Factus V2 dice que `customer` es
    // opcional en la nota crédito y que, si falta, el PAC copia el adquirente
    // de la factura referenciada. Probado contra el sandbox real: es falso —
    // omitirlo responde 422 "El campo customer es obligatorio". Estas pruebas
    // blindan que el servicio nunca vuelva a confiar en esa copia automática.
    it('viaja el customer_snapshot de la factura, no uno reconstruido', async () => {
        sembrarFactura();
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        const customer = emitCreditNote.mock.calls[0][0].customer;
        expect(customer, 'emitCreditNote se llamó sin customer').toBeDefined();
        expect(customer.identification).toBe('1015418301');
        expect(customer.name).toBe('Juan Pérez');
    });

    it('sin customer_snapshot guardado, se rechaza ANTES de llamar al PAC (no se adivina el adquirente)', async () => {
        sembrarFactura({ customer_snapshot: null });
        const { emitCreditNote } = adaptadorCon();

        const r = await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(r.ok).toBe(false);
        expect(r.error).toBe('invoice_without_customer_snapshot');
        expect(emitCreditNote).not.toHaveBeenCalled();
    });
});

describe('el medio de pago de la nota crédito es el del PAGO original, no un genérico', () => {
    it('se lee de payments.payment_method cuando la factura tiene payment_id', async () => {
        sembrarFactura({ payment_id: PAGO });
        tablas.payments = [{ id: PAGO, payment_method: 'transfer' }];
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(emitCreditNote.mock.calls[0][0].paymentMethod).toBe('transfer');
    });

    it('sin payment_id (nota crédito de marketplace/orden) va null, no un valor inventado', async () => {
        sembrarFactura({ payment_id: null });
        const { emitCreditNote } = adaptadorCon();

        await voidInvoice({ invoiceId: FACTURA, actorId: ACTOR });

        expect(emitCreditNote.mock.calls[0][0].paymentMethod).toBeNull();
    });
});
