/**
 * Tienda v2 F0 (T15): `processPurchase` ya no intenta crear pedidos de
 * productos con el JWT (INSERT en orders/order_items prohibido). Si el
 * carrito trae productos, corta ANTES de procesar inscripciones o citas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
const from = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
    supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) },
}));

const processEnrollment = vi.fn().mockResolvedValue({ success: true, enrollment_id: 'e1' });
vi.mock('@/lib/api/checkout', () => ({
    checkoutAPI: { processEnrollment: (...a: unknown[]) => processEnrollment(...a) },
}));

import { transactionsAPI } from '../lib/api/transactions';
import { PRODUCT_PURCHASE_UNAVAILABLE } from '../lib/store/storeErrors';

const base = { userId: 'u1', email: 'a@b.co', paymentMethod: 'wompi', reference: 'R1' };

describe('transactionsAPI.processPurchase — productos deshabilitados', () => {
    beforeEach(() => {
        rpc.mockClear();
        from.mockClear();
        processEnrollment.mockClear();
    });

    it('carrito con productos: no escribe nada y devuelve "no disponible"', async () => {
        const res = await transactionsAPI.processPurchase({
            ...base,
            items: [
                { type: 'enrollment', name: 'Sub 11', price: 1000, quantity: 1, metadata: { schoolId: 's1' } },
                { type: 'product', name: 'Balón', price: 5000, quantity: 1, metadata: { productId: 'p1' } },
            ],
        });
        expect(res).toEqual({ success: false, error: PRODUCT_PURCHASE_UNAVAILABLE });
        expect(processEnrollment).not.toHaveBeenCalled();
        expect(from).not.toHaveBeenCalled();
        expect(rpc).not.toHaveBeenCalled();
    });

    it('sin productos sigue procesando inscripciones', async () => {
        const res = await transactionsAPI.processPurchase({
            ...base,
            items: [{ type: 'enrollment', name: 'Sub 11', price: 1000, quantity: 1, metadata: { schoolId: 's1' } }],
        });
        expect(res.success).toBe(true);
        expect(processEnrollment).toHaveBeenCalledTimes(1);
        expect(from).not.toHaveBeenCalledWith('orders');
    });
});
