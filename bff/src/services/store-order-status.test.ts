/**
 * Estados de la orden de la tienda (tienda v2 F0, M-F0-3).
 *
 * La base tiene un CHECK con la lista exacta: 'pending', 'processing',
 * 'declined', 'failed', 'rejected' y texto libre fallan con 23514. Estos tests
 * vigilan que el BFF (PATCH del vendedor y webhooks) nunca escriba algo fuera
 * de la lista, y que el vendedor no pueda cancelar un pedido pagado (eso es un
 * reembolso).
 */

import { describe, it, expect } from 'vitest';
import {
    STORE_ORDER_STATUSES,
    isStoreOrderStatus,
    normalizeOrderStatus,
    isAwaitingPayment,
    checkVendorTransition,
    cartWebhookFailureStatus,
    VENDOR_TRANSITIONS,
} from './store-order-status';

describe('STORE_ORDER_STATUSES', () => {
    it('es exactamente la lista del CHECK de orders.status', () => {
        expect([...STORE_ORDER_STATUSES].sort()).toEqual([
            'awaiting_approval', 'cancelled', 'delivered', 'expired', 'paid', 'partially_refunded',
            'payment_review', 'pending_payment', 'preparing', 'ready_for_pickup', 'refunded', 'shipped',
        ]);
    });

    it.each(['pending', 'processing', 'declined', 'failed', 'rejected', 'completed', 'whatever', ''])(
        '%s no es un estado válido',
        (s) => expect(isStoreOrderStatus(s)).toBe(false),
    );
});

describe('normalizeOrderStatus', () => {
    it.each([
        ['processing', 'preparing'],
        ['pending', 'pending_payment'],
        ['declined', 'cancelled'],
        ['rejected', 'cancelled'],
        ['failed', 'cancelled'],
        ['completed', 'delivered'],
        ['  SHIPPED ', 'shipped'],
        ['paid', 'paid'],
    ])('%s → %s', (input, expected) => {
        expect(normalizeOrderStatus(input)).toBe(expected);
    });

    it.each(['texto libre', '', null, undefined, 42, {}])('%s → null', (input) => {
        expect(normalizeOrderStatus(input)).toBeNull();
    });

    it('todo lo que devuelve está en la lista del CHECK', () => {
        for (const s of ['pending', 'processing', 'declined', 'rejected', 'failed', 'completed', ...STORE_ORDER_STATUSES]) {
            const n = normalizeOrderStatus(s);
            expect(n === null || isStoreOrderStatus(n)).toBe(true);
        }
    });
});

describe('isAwaitingPayment', () => {
    it('pending_payment y el pending legacy esperan pago', () => {
        expect(isAwaitingPayment('pending_payment')).toBe(true);
        expect(isAwaitingPayment('pending')).toBe(true);
    });
    it.each(['paid', 'payment_review', 'cancelled', null])('%s no', (s) => {
        expect(isAwaitingPayment(s)).toBe(false);
    });
});

describe('checkVendorTransition', () => {
    it.each([
        ['paid', 'preparing'],
        ['preparing', 'ready_for_pickup'],
        ['preparing', 'shipped'],
        ['ready_for_pickup', 'delivered'],
        ['shipped', 'delivered'],
        ['paid', 'processing'], // legacy → preparing
        ['processing', 'shipped'], // fila legacy
    ])('%s → %s permitido', (from, to) => {
        const r = checkVendorTransition(from, to);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.changed).toBe(true);
    });

    it.each([
        ['paid', 'cancelled'],
        ['preparing', 'cancelled'],
        ['pending_payment', 'paid'],
        ['pending_payment', 'preparing'],
        ['payment_review', 'paid'],
        ['delivered', 'shipped'],
        ['shipped', 'preparing'],
        ['cancelled', 'preparing'],
        ['paid', 'refunded'],
        ['paid', 'delivered'],
    ])('%s → %s no permitido (409)', (from, to) => {
        const r = checkVendorTransition(from, to);
        expect(r).toMatchObject({ ok: false, http: 409, error: 'TRANSITION_NOT_ALLOWED' });
    });

    it('estado pedido irreconocible → 400', () => {
        expect(checkVendorTransition('paid', 'enviado-ya')).toMatchObject({ ok: false, http: 400, error: 'INVALID_STATUS' });
        expect(checkVendorTransition('paid', undefined)).toMatchObject({ ok: false, http: 400 });
    });

    it('mismo estado = sin cambio (para actualizar la guía)', () => {
        expect(checkVendorTransition('shipped', 'shipped')).toEqual({ ok: true, from: 'shipped', to: 'shipped', changed: false });
    });

    it('la matriz no tiene salidas hacia cancelled ni desde estados previos al pago', () => {
        for (const [from, tos] of Object.entries(VENDOR_TRANSITIONS)) {
            expect(tos).not.toContain('cancelled');
            expect(['pending_payment', 'awaiting_approval', 'payment_review']).not.toContain(from);
        }
    });
});

describe('cartWebhookFailureStatus', () => {
    it('rechazo / fallo sobre orden sin pagar → cancelled (nunca declined/failed)', () => {
        expect(cartWebhookFailureStatus('pending_payment', 'rejected')).toBe('cancelled');
        expect(cartWebhookFailureStatus('pending', 'failed')).toBe('cancelled');
        expect(cartWebhookFailureStatus('payment_review', 'rejected')).toBe('cancelled');
    });

    it('un intento fallido posterior no deshace un pago', () => {
        expect(cartWebhookFailureStatus('paid', 'rejected')).toBeNull();
        expect(cartWebhookFailureStatus('shipped', 'failed')).toBeNull();
        expect(cartWebhookFailureStatus('cancelled', 'rejected')).toBeNull();
    });

    it('anulación de una orden pagada → refunded', () => {
        expect(cartWebhookFailureStatus('paid', 'refunded')).toBe('refunded');
        expect(cartWebhookFailureStatus('delivered', 'refunded')).toBe('refunded');
    });

    it('anulación de una orden nunca confirmada → cancelled; de una cerrada → no toca', () => {
        expect(cartWebhookFailureStatus('pending_payment', 'refunded')).toBe('cancelled');
        expect(cartWebhookFailureStatus('refunded', 'refunded')).toBeNull();
        expect(cartWebhookFailureStatus('expired', 'refunded')).toBeNull();
    });

    it('pending y paid no cambian el estado por esta vía', () => {
        expect(cartWebhookFailureStatus('pending_payment', 'pending')).toBeNull();
        expect(cartWebhookFailureStatus('pending_payment', 'paid')).toBeNull();
    });

    it('nunca devuelve algo fuera del CHECK', () => {
        const internals = ['paid', 'rejected', 'refunded', 'failed', 'pending', 'raro'];
        const currents = ['pending', 'processing', 'declined', ...STORE_ORDER_STATUSES, null, 'texto'];
        for (const c of currents) {
            for (const i of internals) {
                const r = cartWebhookFailureStatus(c, i);
                expect(r === null || isStoreOrderStatus(r)).toBe(true);
            }
        }
    });
});
