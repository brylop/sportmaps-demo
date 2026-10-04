/**
 * Estados de pedido de la tienda tras Tienda v2 F0 (M-F0-3) y mensajes de
 * error de la tienda (src/lib/store/*).
 */

import { describe, it, expect } from 'vitest';
import {
    ORDER_STATUSES,
    ORDER_STATUS_LABELS,
    ORDER_STATUS_GROUPS,
    normalizeOrderStatus,
    orderStatusLabel,
    vendorNextStatuses,
    orderStatusGroup,
    isOrderPendingForVendor,
    isOrderPaidLike,
} from '../lib/store/orderStatus';
import {
    enableSchoolStoreErrorMessage,
    productDeleteErrorMessage,
    PRODUCT_DELETE_NOT_ALLOWED,
} from '../lib/store/storeErrors';

describe('orderStatus — etiquetas', () => {
    it('cada estado del CHECK de la base tiene etiqueta en español', () => {
        expect(ORDER_STATUSES).toHaveLength(12);
        for (const s of ORDER_STATUSES) {
            expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
        }
        expect(orderStatusLabel('pending_payment')).toBe('Pendiente de pago');
        expect(orderStatusLabel('awaiting_approval')).toBe('Esperando aprobación');
        expect(orderStatusLabel('payment_review')).toBe('En revisión');
        expect(orderStatusLabel('ready_for_pickup')).toBe('Listo para retirar');
        expect(orderStatusLabel('partially_refunded')).toBe('Reembolso parcial');
        expect(orderStatusLabel('expired')).toBe('Vencido');
    });

    it('tolera los valores legacy pending/processing', () => {
        expect(normalizeOrderStatus('pending')).toBe('pending_payment');
        expect(normalizeOrderStatus('processing')).toBe('preparing');
        expect(orderStatusLabel('pending')).toBe('Pendiente de pago');
        expect(orderStatusLabel('processing')).toBe('En preparación');
    });

    it('un valor desconocido no se disfraza de otro estado', () => {
        expect(normalizeOrderStatus('foo')).toBeNull();
        expect(orderStatusLabel('foo')).toBe('foo');
        expect(orderStatusLabel(null)).toBe('Sin estado');
        expect(orderStatusLabel(undefined)).toBe('Sin estado');
    });

    it('normaliza mayúsculas y espacios', () => {
        expect(normalizeOrderStatus(' PAID ')).toBe('paid');
    });
});

describe('orderStatus — transiciones del vendedor', () => {
    it('solo las que acepta el BFF', () => {
        expect(vendorNextStatuses('paid')).toEqual(['preparing']);
        expect(vendorNextStatuses('preparing')).toEqual(['ready_for_pickup', 'shipped']);
        expect(vendorNextStatuses('ready_for_pickup')).toEqual(['delivered']);
        expect(vendorNextStatuses('shipped')).toEqual(['delivered']);
    });

    it('sin acciones antes del pago ni en estados finales', () => {
        for (const s of ['pending_payment', 'awaiting_approval', 'payment_review', 'delivered', 'expired', 'cancelled', 'refunded', 'partially_refunded', 'foo', null]) {
            expect(vendorNextStatuses(s)).toEqual([]);
        }
    });

    it('legacy processing se trata como preparing', () => {
        expect(vendorNextStatuses('processing')).toEqual(['ready_for_pickup', 'shipped']);
        // pending (= pending_payment) no habilita "Preparar": aún no se pagó.
        expect(vendorNextStatuses('pending')).toEqual([]);
    });
});

describe('orderStatus — grupos de filtro', () => {
    it('cada estado cae en exactamente un grupo', () => {
        for (const s of ORDER_STATUSES) {
            const hits = Object.values(ORDER_STATUS_GROUPS).filter(g => g.statuses.includes(s));
            expect(hits).toHaveLength(1);
        }
    });

    it('agrupa nuevos y legacy', () => {
        expect(orderStatusGroup('pending')).toBe('awaiting_payment');
        expect(orderStatusGroup('awaiting_approval')).toBe('awaiting_payment');
        expect(orderStatusGroup('paid')).toBe('to_prepare');
        expect(orderStatusGroup('processing')).toBe('in_progress');
        expect(orderStatusGroup('delivered')).toBe('delivered');
        expect(orderStatusGroup('refunded')).toBe('closed');
        expect(orderStatusGroup('foo')).toBeNull();
    });

    it('pendientes del vendedor y ventas no cuentan pedidos sin pagar', () => {
        expect(isOrderPendingForVendor('pending_payment')).toBe(false);
        expect(isOrderPendingForVendor('paid')).toBe(true);
        expect(isOrderPendingForVendor('shipped')).toBe(true);
        expect(isOrderPendingForVendor('delivered')).toBe(false);
        expect(isOrderPaidLike('pending')).toBe(false);
        expect(isOrderPaidLike('awaiting_approval')).toBe(false);
        expect(isOrderPaidLike('delivered')).toBe(true);
        expect(isOrderPaidLike('cancelled')).toBe(false);
    });
});

describe('storeErrors — enable_school_store', () => {
    it('ADDON_REQUIRED lleva a Mi plan', () => {
        const r = enableSchoolStoreErrorMessage({ code: 'P0001', message: 'ADDON_REQUIRED' });
        expect(r.addonRequired).toBe(true);
        expect(r.description).toMatch(/Mi plan/);
    });

    it('OWNER_HAS_OTHER_VENDOR_PROFILE', () => {
        const r = enableSchoolStoreErrorMessage({ code: 'P0001', message: 'OWNER_HAS_OTHER_VENDOR_PROFILE' });
        expect(r.addonRequired).toBe(false);
        expect(r.title).toMatch(/otra tienda/);
    });

    it('42501 = sin permiso', () => {
        const r = enableSchoolStoreErrorMessage({ code: '42501', message: 'permission denied' });
        expect(r.title).toBe('Sin permiso');
    });

    it('error desconocido no filtra el mensaje técnico', () => {
        const r = enableSchoolStoreErrorMessage(new Error('relation "x" does not exist'));
        expect(r.title).toBe('No se pudo activar la tienda');
        expect(r.description).not.toMatch(/relation/);
    });
});

describe('storeErrors — borrar producto', () => {
    it('42501 explica que solo se borran borradores/rechazados', () => {
        expect(productDeleteErrorMessage({ code: '42501', message: 'x' })).toBe(PRODUCT_DELETE_NOT_ALLOWED);
    });
    it('otro error conserva su mensaje', () => {
        expect(productDeleteErrorMessage({ code: '23503', message: 'fk' })).toBe('fk');
    });
});
