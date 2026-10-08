/**
 * Cobro con fuente de pago y consulta por referencia (débito automático F2).
 *   · `installments` y `recurrent` (COF) solo viajan con tarjeta: Nequi no los lleva.
 *   · Los tokens de aceptación solo viajan si el motor los pasa.
 *   · GET /transactions?reference= va con la llave privada y distingue «ninguna»
 *     de «no se pudo consultar».
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import { createTransactionWithPaymentSource, findTransactionsByReference, type WompiCreds } from './wompi.service';

const CREDS: WompiCreds = { publicKey: 'pub_test_x', privateKey: 'prv_test_x', integritySecret: 'sec', eventsSecret: null, sandbox: true };

function mockFetch(status: number, body: any) {
    const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fn);
    return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('createTransactionWithPaymentSource', () => {
    const base = { paymentSourceId: 7, amountInCents: 15750000, reference: 'SCH-A-1', customerEmail: 'a@b.co' };

    it('tarjeta: manda installments y recurrent', async () => {
        const f = mockFetch(201, { data: { id: 'tx-1', status: 'PENDING' } });
        await createTransactionWithPaymentSource({ ...base, paymentMethodType: 'CARD' }, CREDS);
        const body = JSON.parse((f.mock.calls[0] as any)[1].body);
        expect(body).toMatchObject({ payment_source_id: 7, recurrent: true, payment_method: { installments: 1 } });
        expect(body.acceptance_token).toBeUndefined();
    });

    it('Nequi: sin installments ni recurrent; tokens de aceptación solo si se pasan', async () => {
        const f = mockFetch(201, { data: { id: 'tx-1', status: 'PENDING' } });
        await createTransactionWithPaymentSource({ ...base, paymentMethodType: 'NEQUI', acceptanceToken: 'acc', personalDataAuthToken: 'pda' }, CREDS);
        const body = JSON.parse((f.mock.calls[0] as any)[1].body);
        expect(body.recurrent).toBeUndefined();
        expect(body.payment_method).toBeUndefined();
        expect(body).toMatchObject({ acceptance_token: 'acc', accept_personal_auth: 'pda', signature: expect.any(String) });
    });
});

describe('findTransactionsByReference', () => {
    it('consulta con la llave privada y devuelve la lista', async () => {
        const f = mockFetch(200, { data: [{ id: 't1', status: 'DECLINED' }] });
        const r = await findTransactionsByReference('SCH-A-1', CREDS);
        expect(r).toEqual({ ok: true, transactions: [{ id: 't1', status: 'DECLINED' }] });
        expect((f.mock.calls[0] as any)[1].headers.Authorization).toBe('Bearer prv_test_x');
        expect((f.mock.calls[0] as any)[0]).toContain('sandbox.wompi.co/v1/transactions?reference=SCH-A-1');
    });

    it('error HTTP → ok:false (no es lo mismo que «ninguna»)', async () => {
        mockFetch(500, {});
        expect((await findTransactionsByReference('SCH-A-1', CREDS)).ok).toBe(false);
    });
});
