/**
 * Traducción de errores de las RPC de la tienda a HTTP (tienda v2 F0).
 * Las RPC lanzan RAISE '<TOKEN>' USING ERRCODE; PostgREST trae {code, message}.
 */

import { describe, it, expect } from 'vitest';
import { mapStoreRpcError, refundErrorStatus } from './store-rpc-errors';

describe('mapStoreRpcError', () => {
    it.each([
        [{ code: '42501', message: 'NOT_OWNER' }, 403, 'NOT_OWNER'],
        [{ code: '22023', message: 'INVALID_QTY' }, 400, 'INVALID_QTY'],
        [{ code: 'P0002', message: 'NOT_FOUND' }, 404, 'NOT_FOUND'],
        [{ code: '22023', message: 'PRODUCT_HAS_VARIANTS' }, 400, 'PRODUCT_HAS_VARIANTS'],
        [{ code: '22023', message: 'BELOW_RESERVED: reservado 3' }, 400, 'BELOW_RESERVED'],
        [{ code: '42501', message: 'NOT_DELIVERED' }, 403, 'NOT_DELIVERED'],
        [{ code: '23505', message: 'ALREADY_REVIEWED' }, 409, 'ALREADY_REVIEWED'],
        [{ code: '22023', message: 'INVALID_TEXT' }, 400, 'INVALID_TEXT'],
        [{ code: '23514', message: 'PAID_WITHOUT_PROOF' }, 409, 'PAID_WITHOUT_PROOF'],
        // Cobros y entrega de la tienda (20261008163336)
        [{ code: 'P0001', message: 'SHIPPING_NOT_OFFERED' }, 409, 'SHIPPING_NOT_OFFERED'],
        [{ code: '22023', message: 'INVALID_TRANSFER_ACCOUNT' }, 400, 'INVALID_TRANSFER_ACCOUNT'],
        [{ code: '22023', message: 'PICKUP_BRANCH_REQUIRED' }, 400, 'PICKUP_BRANCH_REQUIRED'],
        [{ code: '22023', message: 'INVALID_PICKUP_BRANCH' }, 400, 'INVALID_PICKUP_BRANCH'],
        [{ code: '22023', message: 'NO_PAYMENT_METHODS' }, 400, 'NO_PAYMENT_METHODS'],
    ])('%o → %i %s', (err, status, code) => {
        expect(mapStoreRpcError(err)).toMatchObject({ status, code });
    });

    it('el token manda sobre el sqlstate', () => {
        // NOT_DELIVERED viene con 42501 igual que NOT_OWNER, pero el mensaje es otro
        expect(mapStoreRpcError({ code: '42501', message: 'NOT_DELIVERED' }).code).toBe('NOT_DELIVERED');
    });

    it('sin token cae al sqlstate', () => {
        expect(mapStoreRpcError({ code: '42501', message: 'permission denied' })).toMatchObject({ status: 403 });
        expect(mapStoreRpcError({ code: '23514', message: 'violates check constraint "x"' })).toMatchObject({ status: 400 });
        expect(mapStoreRpcError({ code: '23505', message: 'duplicate key' })).toMatchObject({ status: 409 });
        expect(mapStoreRpcError({ code: 'P0002', message: 'no rows' })).toMatchObject({ status: 404 });
    });

    it('RPC inexistente (migración sin aplicar) → 503', () => {
        expect(mapStoreRpcError({ code: 'PGRST202', message: 'Could not find the function' })).toMatchObject({ status: 503 });
        expect(mapStoreRpcError({ code: '42883', message: 'function does not exist' })).toMatchObject({ status: 503 });
    });

    it('no confunde un token dentro de otra palabra', () => {
        expect(mapStoreRpcError({ code: 'XX000', message: 'IS_NOT_OWNERSHIP' }).status).toBe(500);
    });

    it('desconocido o nulo → 500', () => {
        expect(mapStoreRpcError({ code: 'XX000', message: 'boom' }).status).toBe(500);
        expect(mapStoreRpcError(null).status).toBe(500);
    });
});

describe('refundErrorStatus', () => {
    it.each([
        ['unauthenticated', 401],
        ['forbidden', 403],
        ['not_found', 404],
        ['refund_already_open', 409],
        ['invalid_state', 409],
        ['order_not_eligible', 409],
        ['reason_too_short', 400],
        ['not_an_order_refund', 400],
        [undefined, 400],
    ])('%s → %i', (code, status) => {
        expect(refundErrorStatus(code as any)).toBe(status);
    });
});
