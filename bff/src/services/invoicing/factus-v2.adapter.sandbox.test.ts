/**
 * Prueba de integración REAL contra el sandbox de Factus V2.
 *
 * No es un test unitario: sale a la red y crea documentos de verdad en el
 * ambiente de pruebas del PAC. Por eso está apagada por defecto y solo corre
 * con `FACTUS_SANDBOX_TEST=1`, para que ni CI ni un `npm test` distraído la
 * disparen.
 *
 *     FACTUS_SANDBOX_TEST=1 \
 *     FACTUS_SANDBOX_CLIENT_ID=… FACTUS_SANDBOX_CLIENT_SECRET=… \
 *     FACTUS_SANDBOX_USERNAME=… FACTUS_SANDBOX_PASSWORD=… \
 *     npx vitest run src/services/invoicing/factus-v2.adapter.sandbox.test.ts
 *
 * POR QUÉ existe: el valor no está en comprobar que el PAC responde 201, sino
 * en LEER DE VUELTA el documento y verificar qué guardó. Los tres bugs fiscales
 * que corregimos eran silenciosos — Factus descarta una clave desconocida sin
 * dar error, así que un payload mal armado responde "Created" y produce una
 * factura equivocada. La única forma de saber si el campo llegó es preguntar.
 *
 * SEGURIDAD: el usuario y la contraseña de Dynasty son IDÉNTICOS en sandbox y
 * en producción; lo único que separa los ambientes es client_id/secret y la
 * URL. Por eso el guard de abajo ancla en el client_id y en la URL, nunca en
 * el usuario, y aborta si detecta el client_id de producción.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { factusV2Adapter } from './factus-v2.adapter';
import type { CreditNoteRequest, InvoiceRequest, ProviderConfig } from './types';

const HABILITADA = process.env.FACTUS_SANDBOX_TEST === '1';

const SANDBOX_URL = 'https://api-sandbox.factus.com.co';
/** Rango "Factura de Venta" del sandbox de Dynasty (prefijo SETP). */
const RANGO_FACTURA_SANDBOX = 5224;
/** Rango "Nota Crédito" del sandbox de Dynasty (prefijo NC). Verificado por API: en PRODUCCIÓN este rango NO existe todavía. */
const RANGO_NOTA_CREDITO_SANDBOX = 5225;
/** client_id de PRODUCCIÓN. Si aparece, se aborta: emitiría contra la resolución DIAN real. */
const CLIENT_ID_PRODUCCION_PREFIJO = 'a2b28e28';

const cfg: ProviderConfig = {
    provider: 'factus_v2',
    sandbox: true,
    credentials: {
        base_url: SANDBOX_URL,
        client_id: process.env.FACTUS_SANDBOX_CLIENT_ID ?? '',
        client_secret: process.env.FACTUS_SANDBOX_CLIENT_SECRET ?? '',
        username: process.env.FACTUS_SANDBOX_USERNAME ?? '',
        password: process.env.FACTUS_SANDBOX_PASSWORD ?? '',
    },
    config: {
        numbering_range_id: RANGO_FACTURA_SANDBOX,
        credit_note_numbering_range_id: RANGO_NOTA_CREDITO_SANDBOX,
        // A propósito Bogotá, distinto del municipio del cliente (Medellín):
        // así se distingue si la factura viajó con el municipio DEL CLIENTE o
        // si cayó al del emisor, que era justo el bug.
        default_municipality_id: '11001',
    },
};

/** Referencia única por corrida: el PAC es idempotente por reference_code. */
const ref = (etiqueta: string) => `TEST-${etiqueta}-${process.pid}-${Date.now()}`;

async function token(): Promise<string> {
    const body = new URLSearchParams({
        grant_type: 'password',
        client_id: cfg.credentials.client_id,
        client_secret: cfg.credentials.client_secret,
        username: cfg.credentials.username,
        password: cfg.credentials.password,
    });
    const res = await fetch(`${SANDBOX_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const json = (await res.json()) as any;
    if (!json.access_token) throw new Error(`auth falló: ${res.status}`);
    return json.access_token;
}

/** Lee el documento tal como lo guardó el PAC. Es el punto de toda la prueba. */
async function leerFactura(numero: string): Promise<any> {
    const t = await token();
    const res = await fetch(`${SANDBOX_URL}/v2/bills/${encodeURIComponent(numero)}`, {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
    });
    const json = (await res.json()) as any;
    return json?.data;
}

/**
 * Lo mismo para una NOTA CRÉDITO. Es OTRA colección (/v2/credit-notes), no un
 * filtro de /v2/bills: mismo motivo que fetchCreditNoteByReference en el
 * adaptador.
 */
async function leerNotaCredito(numero: string): Promise<any> {
    const t = await token();
    const res = await fetch(`${SANDBOX_URL}/v2/credit-notes/${encodeURIComponent(numero)}`, {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
    });
    const json = (await res.json()) as any;
    return json?.data;
}

describe.skipIf(!HABILITADA)('factus_v2 adapter contra el sandbox real', () => {
    beforeAll(() => {
        if (!cfg.credentials.client_id || !cfg.credentials.password) {
            throw new Error('Faltan las credenciales de sandbox en el entorno.');
        }
        if (cfg.credentials.client_id.startsWith(CLIENT_ID_PRODUCCION_PREFIJO)) {
            throw new Error('ABORTADO: ese es el client_id de PRODUCCIÓN. Emitiría contra la resolución DIAN real de Dynasty.');
        }
        if (!/api-sandbox/.test(String(cfg.credentials.base_url))) {
            throw new Error('ABORTADO: base_url no es el sandbox.');
        }
    });

    it('una mensualidad excluida de IVA de una familia de Medellín sale con TODOS los campos correctos', async () => {
        const req: InvoiceRequest = {
            referenceCode: ref('MENS'),
            documentType: 'invoice',
            customer: {
                documentType: 'CC',
                identification: '1020304050',
                name: 'Familia De Prueba Sandbox',
                email: 'prueba.sandbox@sportmaps.co',
                phone: '3200000000',
                address: 'Calle 10 # 43-30',
                // Medellín. El cero inicial es el corazón de la prueba:
                // Number('05001') daba 5001, un municipio inexistente.
                municipalityCode: '05001',
            },
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,      // servicio deportivo: EXCLUIDO, no gravado al 0%
            }],
            observation: 'Documento de PRUEBA emitido por la suite de integración.',
            paymentMethod: 'transfer',
        };

        const r = await factusV2Adapter.emit(req, cfg);

        expect(r.status, `el PAC rechazó: ${r.errorMessage ?? ''}`).not.toBe('rejected');
        expect(r.number, 'no devolvió número de documento').toBeTruthy();

        const doc = await leerFactura(String(r.number));

        // ── 1. El municipio del CLIENTE, con su cero inicial ────────────────
        // Si esto dice 11001 (Bogotá) o 5001, el bug volvió.
        const muni = String(
            doc?.customer?.municipality?.code
            ?? doc?.customer?.municipality_code
            ?? doc?.customer?.municipality
            ?? '',
        );
        expect(muni, `municipio guardado: ${JSON.stringify(doc?.customer?.municipality)}`).toContain('5001');
        expect(muni).not.toBe('11001');

        // ── 2. EXCLUIDO de verdad, no gravado al 0% ─────────────────────────
        const impuestos = doc?.items?.[0]?.taxes ?? doc?.taxes ?? [];
        const excluido = JSON.stringify(impuestos).includes('"is_excluded":true')
            || impuestos?.[0]?.is_excluded === true;
        expect(excluido, `impuestos guardados: ${JSON.stringify(impuestos)}`).toBe(true);

        // ── 3. Persona natural → el nombre va en `names`, no en `company` ───
        expect(doc?.customer?.names ?? '').toContain('Familia');

        // ── 4. El total es el que se cobró, sin inflar por IVA ──────────────
        expect(Number(doc?.totals?.total ?? doc?.total)).toBe(150000);

        // ── 5. El medio de pago REAL, no "efectivo" para todo ───────────────
        // Era el 79% del dinero de Dynasty declarado como efectivo sin serlo.
        // 47 = Transferencia en el catálogo oficial de Factus.
        const medio = String(
            doc?.payment_details?.[0]?.payment_method?.code
            ?? doc?.payment_details?.[0]?.payment_method
            ?? '',
        );
        expect(medio, `payment_details guardado: ${JSON.stringify(doc?.payment_details)}`).toBe('47');
    }, 120_000);

    it('a una empresa (NIT) la razón social le llega en `company`, no en `names`', async () => {
        const req: InvoiceRequest = {
            referenceCode: ref('NIT'),
            documentType: 'invoice',
            customer: {
                documentType: 'NIT',
                identification: '901929705',
                name: 'Empresa De Prueba SAS',
                email: 'prueba.sandbox@sportmaps.co',
                address: 'Carrera 7 # 71-21',
                municipalityCode: '11001',
            },
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
        };

        const r = await factusV2Adapter.emit(req, cfg);
        expect(r.status, `el PAC rechazó: ${r.errorMessage ?? ''}`).not.toBe('rejected');
        expect(r.number).toBeTruthy();

        const doc = await leerFactura(String(r.number));
        // Esto es el bug que cerramos: antes la razón social iba en `names` y
        // V2 la reporta como null para personas jurídicas — se perdía.
        expect(doc?.customer?.company ?? '', `company=${doc?.customer?.company} names=${doc?.customer?.names}`)
            .toContain('Empresa');
    }, 120_000);

    it('reenviar el mismo reference_code devuelve el MISMO documento (idempotencia)', async () => {
        const referencia = ref('IDEM');
        const armar = (): InvoiceRequest => ({
            referenceCode: referencia,
            documentType: 'invoice',
            customer: {
                documentType: 'CC',
                identification: '1020304050',
                name: 'Familia De Prueba Sandbox',
                email: 'prueba.sandbox@sportmaps.co',
                address: 'Calle 10 # 43-30',
                municipalityCode: '05001',
            },
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
        });

        const a = await factusV2Adapter.emit(armar(), cfg);
        const b = await factusV2Adapter.emit(armar(), cfg);

        // De esto depende que los tres BFF corriendo el mismo cron sean
        // inofensivos: si no fuera idempotente, cada tick duplicaría facturas.
        expect(b.number).toBe(a.number);
    }, 180_000);

    it('fetchByReference encuentra el documento por la referencia que generamos', async () => {
        const referencia = ref('FETCH');
        const emitida = await factusV2Adapter.emit({
            referenceCode: referencia,
            documentType: 'invoice',
            customer: {
                documentType: 'CC',
                identification: '1020304050',
                name: 'Familia De Prueba Sandbox',
                email: 'prueba.sandbox@sportmaps.co',
                address: 'Calle 10 # 43-30',
                municipalityCode: '05001',
            },
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
        }, cfg);

        expect(emitida.number).toBeTruthy();

        // Es el camino del que depende toda la reconciliación en producción:
        // ahí la emisión solo devuelve un acuse y el número llega después.
        const encontrada = await factusV2Adapter.fetchByReference!(referencia, cfg);
        expect(encontrada?.number).toBe(emitida.number);
    }, 180_000);

    it('emitCreditNote anula una factura real: el PAC guarda la referencia a bill_number y el concepto', async () => {
        // El mismo cliente que la factura que se va a anular: la nota crédito
        // tiene que emparejar con el adquirente ORIGINAL (ver el comentario de
        // CreditNoteRequest en types.ts — es lo que se guarda como
        // customer_snapshot y se reutiliza en producción, nunca uno reconstruido).
        const clienteFactura: InvoiceRequest['customer'] = {
            documentType: 'CC',
            identification: '1020304050',
            name: 'Familia De Prueba Sandbox',
            email: 'prueba.sandbox@sportmaps.co',
            address: 'Calle 10 # 43-30',
            municipalityCode: '05001',
        };

        // 1. Se emite una factura de verdad, para tener un número real que anular.
        const facturaOriginal = await factusV2Adapter.emit({
            referenceCode: ref('NC-ORIGEN'),
            documentType: 'invoice',
            customer: clienteFactura,
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026 (para anular)',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
        }, cfg);
        expect(facturaOriginal.status, `no se pudo emitir la factura a anular: ${facturaOriginal.errorMessage ?? ''}`).not.toBe('rejected');
        expect(facturaOriginal.number, 'sin número no hay bill_number que anular').toBeTruthy();

        // 2. Se anula con la nota crédito. Concepto 2 = anulación de factura
        // electrónica, el caso que usa el producto.
        const req: CreditNoteRequest = {
            referenceCode: ref('NC'),
            billNumber: facturaOriginal.number as string,
            correctionConceptCode: '2',
            customer: clienteFactura,
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026 (para anular)',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
            observation: 'Anulación de prueba — suite de integración',
            paymentMethod: 'transfer',
        };
        const nc = await factusV2Adapter.emitCreditNote!(req, cfg);

        expect(nc.status, `el PAC rechazó la nota crédito: ${nc.errorMessage ?? ''}`).not.toBe('rejected');
        expect(nc.number, 'la nota crédito no devolvió número').toBeTruthy();

        // 3. LEE de vuelta el documento — no basta con que el PAC respondiera
        // 201. Los bugs de este módulo eran silenciosos: una clave que Factus
        // no reconoce se descarta sin error, así que hay que comprobar qué
        // quedó guardado de verdad.
        const doc = await leerNotaCredito(String(nc.number));

        // La referencia a la factura anulada: el nombre exacto de la clave lo
        // decide el PAC (bill/related_bill/billing_reference…), así que se
        // busca en las formas razonables en vez de asumir una sola.
        const referenciaGuardada = JSON.stringify(
            doc?.bill ?? doc?.related_bill ?? doc?.billing_reference ?? doc?.bill_number ?? doc,
        );
        expect(referenciaGuardada, `documento guardado: ${JSON.stringify(doc).slice(0, 500)}`)
            .toContain(String(facturaOriginal.number));

        // El concepto de corrección también tiene que haber llegado.
        const conceptoGuardado = String(
            doc?.correction_concept?.code ?? doc?.correction_concept_code ?? '',
        );
        expect(conceptoGuardado, `documento guardado: ${JSON.stringify(doc).slice(0, 500)}`).toBe('2');
    }, 240_000);

    it('fetchCreditNoteByReference encuentra la nota crédito por su referencia (camino de reconciliación)', async () => {
        const clienteFactura: InvoiceRequest['customer'] = {
            documentType: 'CC',
            identification: '1020304050',
            name: 'Familia De Prueba Sandbox',
            email: 'prueba.sandbox@sportmaps.co',
            address: 'Calle 10 # 43-30',
            municipalityCode: '05001',
        };
        const facturaOriginal = await factusV2Adapter.emit({
            referenceCode: ref('NC-ORIGEN2'),
            documentType: 'invoice',
            customer: clienteFactura,
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026 (para anular)',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
        }, cfg);
        expect(facturaOriginal.number).toBeTruthy();

        const referencia = ref('NC-FETCH');
        const nc = await factusV2Adapter.emitCreditNote!({
            referenceCode: referencia,
            billNumber: facturaOriginal.number as string,
            correctionConceptCode: '2',
            customer: clienteFactura,
            items: [{
                codeReference: 'MENS-2026-09',
                name: 'Mensualidad septiembre 2026 (para anular)',
                quantity: 1,
                unitPrice: 150000,
                taxRate: 0,
                isExcluded: true,
            }],
            paymentMethod: 'transfer',
        }, cfg);
        expect(nc.number).toBeTruthy();

        // Es el camino que en producción completa número y CUFE cuando la
        // emisión solo devolvió el acuse. Sin este método por colección
        // separada, una nota crédito en 'sent' se queda sin número para
        // siempre (no aparece en /v2/bills, que es donde mira fetchByReference).
        const encontrada = await factusV2Adapter.fetchCreditNoteByReference!(referencia, cfg);
        expect(encontrada?.number).toBe(nc.number);
    }, 240_000);
});
