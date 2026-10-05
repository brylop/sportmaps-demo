/**
 * Tests del adaptador de Factus Pay. Las respuestas simuladas son copias (recortadas)
 * de lo que devolvió el sandbox el 2026-10-05, incluido el `errors` letra por letra.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createCollection,
    getCollection,
    factusPayEnvConfig,
    mapFactusPayStatus,
    validateFactusPayAmount,
} from './factus-pay.service';

const CONFIG = { baseUrl: 'https://pay-api-sandbox.factus.com.co', token: '238|abc' };

const DATA = {
    reference_code: 'SAAS-0001',
    amount: 10000,
    status: 'ready',
    created_at: '2026-10-05T16:59:49.000000Z',
    qr: 'data:image/png;base64,iVBORw0K',
    qr_expires_at: '2026-10-06T17:08:03Z',
};

function fakeFetch(status: number, json: unknown) {
    return vi.fn(async () => ({ status, json: async () => json })) as unknown as typeof fetch;
}

describe('factusPayEnvConfig', () => {
    it('devuelve null si falta el token o la URL (fail-closed)', () => {
        expect(factusPayEnvConfig({ FACTUS_PAY_BASE_URL: 'https://x' } as any)).toBeNull();
        expect(factusPayEnvConfig({ FACTUS_PAY_TOKEN: 't' } as any)).toBeNull();
    });
    it('quita la barra final de la URL', () => {
        expect(factusPayEnvConfig({ FACTUS_PAY_BASE_URL: 'https://x/', FACTUS_PAY_TOKEN: 't' } as any))
            .toEqual({ baseUrl: 'https://x', token: 't' });
    });
});

describe('mapFactusPayStatus', () => {
    it.each([
        ['paid', 'paid'], ['failed', 'failed'], ['rejected', 'failed'],
        ['ready', 'pending'], ['started', 'pending'], ['algo_nuevo', 'pending'], [null, 'pending'],
    ])('%s → %s', (raw, esperado) => {
        expect(mapFactusPayStatus(raw as any)).toBe(esperado);
    });
});

describe('validateFactusPayAmount', () => {
    it('acepta los bordes', () => {
        expect(validateFactusPayAmount(10_000)).toBeNull();
        expect(validateFactusPayAmount(12_000_000)).toBeNull();
    });
    it('rechaza fuera de rango y no enteros (centavos)', () => {
        expect(validateFactusPayAmount(9_999)?.code).toBe('invalid_amount');
        expect(validateFactusPayAmount(12_000_001)?.code).toBe('invalid_amount');
        expect(validateFactusPayAmount(10_000.5)?.code).toBe('invalid_amount');
    });
});

describe('createCollection', () => {
    it('no llama a la red si el monto es inválido', async () => {
        const f = fakeFetch(200, {});
        const r = await createCollection(CONFIG, { referenceCode: 'X', amount: 500 }, f);
        expect(r.ok).toBe(false);
        expect(f).not.toHaveBeenCalled();
    });

    it('sin config → not_configured, sin red', async () => {
        const f = fakeFetch(200, {});
        const r = await createCollection(null, { referenceCode: 'X', amount: 10_000 }, f);
        expect(r).toEqual({ ok: false, error: expect.objectContaining({ code: 'not_configured' }) });
        expect(f).not.toHaveBeenCalled();
    });

    it('crea: manda Bearer y body en pesos, normaliza el estado', async () => {
        const f = fakeFetch(200, { data: DATA, status: 'success', message: 'Recaudo asignado y QR generado correctamente' });
        const r = await createCollection(CONFIG, { referenceCode: 'SAAS-0001', amount: 10_000 }, f);

        expect(r.ok && r.data).toMatchObject({ referenceCode: 'SAAS-0001', status: 'pending', rawStatus: 'ready', qrExpiresAt: DATA.qr_expires_at });
        expect(r.ok && r.alreadyExisted).toBe(false);
        const [url, init] = (f as any).mock.calls[0];
        expect(url).toBe('https://pay-api-sandbox.factus.com.co/v1/collections');
        expect(init.headers.Authorization).toBe('Bearer 238|abc');
        expect(JSON.parse(init.body)).toEqual({ reference_code: 'SAAS-0001', amount: 10000 });
    });

    it('misma referencia y monto → alreadyExisted', async () => {
        const f = fakeFetch(200, { data: DATA, status: 'success', message: 'Recaudo ya existente' });
        const r = await createCollection(CONFIG, { referenceCode: 'SAAS-0001', amount: 10_000 }, f);
        expect(r.ok && r.alreadyExisted).toBe(true);
    });

    it('misma referencia con otro monto → reference_amount_mismatch', async () => {
        const f = fakeFetch(422, { status: 'error', message: 'La referencia ya existe con un monto diferente.', data: null });
        const r = await createCollection(CONFIG, { referenceCode: 'SAAS-0001', amount: 20_000 }, f);
        expect(!r.ok && r.error.code).toBe('reference_amount_mismatch');
    });

    it('422 de validación: usa `message`, ignora `errors` partido letra por letra', async () => {
        const f = fakeFetch(422, {
            message: 'The amount field must be at least 10000.',
            errors: { amount: [{ 0: 'T', 1: 'h', 2: 'e' }] },
        });
        // Monto válido para nuestra validación; Factus igual responde 422 (p. ej. cambia su mínimo).
        const r = await createCollection(CONFIG, { referenceCode: 'X', amount: 10_000 }, f);
        expect(!r.ok && r.error).toEqual({ code: 'validation', message: 'The amount field must be at least 10000.', httpStatus: 422 });
    });

    it('401 → unauthorized (token revocado por otro /auth)', async () => {
        const f = fakeFetch(401, { message: 'Unauthenticated.' });
        const r = await createCollection(CONFIG, { referenceCode: 'X', amount: 10_000 }, f);
        expect(!r.ok && r.error.code).toBe('unauthorized');
    });

    it('error de red → network', async () => {
        const f = vi.fn(async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
        const r = await createCollection(CONFIG, { referenceCode: 'X', amount: 10_000 }, f);
        expect(!r.ok && r.error.code).toBe('network');
    });
});

describe('getCollection', () => {
    it('codifica la referencia en la URL y mapea paid', async () => {
        const f = fakeFetch(200, { data: { ...DATA, reference_code: 'SAAS/1', status: 'paid' }, message: 'Recaudo encontrado' });
        const r = await getCollection(CONFIG, 'SAAS/1', f);
        expect((f as any).mock.calls[0][0]).toBe('https://pay-api-sandbox.factus.com.co/v1/collections/SAAS%2F1');
        expect(r.ok && r.data.status).toBe('paid');
    });

    it('404 → not_found', async () => {
        const f = fakeFetch(404, { message: 'Recaudo no encontrado' });
        const r = await getCollection(CONFIG, 'NOPE', f);
        expect(!r.ok && r.error.code).toBe('not_found');
    });
});
