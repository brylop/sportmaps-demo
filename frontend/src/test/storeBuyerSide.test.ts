/**
 * Tienda, lado comprador: solo retiro, 429 ≠ 404, código de retiro regenerable
 * y textos neutros (socio adulto o acudiente).
 */
import { describe, expect, it } from 'vitest';
import { storeOffersShipping } from '@/lib/api/storeApi';
import { orderLoadError, storeErrorView } from '@/lib/store/storeErrors';
import { buyerCanRegeneratePickupCode, buyerCopy, buyerKind } from '@/lib/store/buyerCopy';

describe('entrega que ofrece la tienda', () => {
    it('solo retiro cuando la tienda publica shipping=false; sin dato = como antes (con envío)', () => {
        expect(storeOffersShipping({ fulfillment: { pickup: true, shipping: false } })).toBe(false);
        expect(storeOffersShipping({ fulfillment: { pickup: true, shipping: true } })).toBe(true);
        expect(storeOffersShipping({})).toBe(true);
        expect(storeOffersShipping(undefined)).toBe(true);
    });

    it('SHIPPING_NOT_OFFERED y SHIPPING_ZONE_NOT_FOUND salen en español, nunca el código', () => {
        const a = storeErrorView({ status: 409, body: { error: 'SHIPPING_NOT_OFFERED' } });
        expect(a.title).toBe('Solo retiro en sede');
        expect(a.description).not.toMatch(/SHIPPING/);
        const b = storeErrorView({ status: 422, body: { error: 'SHIPPING_ZONE_NOT_FOUND' } });
        expect(b.description).not.toMatch(/SHIPPING/);
        expect(b.action).toBe('fix_delivery');
    });
});

describe('leer un pedido: 429 no es "no encontrado"', () => {
    it('clasifica el error de carga', () => {
        expect(orderLoadError({ status: 429 })).toBe('rate_limited');
        expect(orderLoadError({ status: 404 })).toBe('not_found');
        expect(orderLoadError(new TypeError('Failed to fetch'))).toBe('network');
        expect(orderLoadError({ status: 500 })).toBe('other');
    });

    it('429 → "Demasiadas solicitudes, intenta en un minuto"', () => {
        const v = storeErrorView({ status: 429, body: { error: 'RATE_LIMITED' } });
        expect(v.code).toBe('RATE_LIMITED');
        expect(v.description).toBe('Demasiadas solicitudes, intenta en un minuto.');
        // También si el cuerpo no trae el código (otro limitador del BFF).
        expect(storeErrorView({ status: 429, body: { error: 'Límite' } }).description).toBe('Demasiadas solicitudes, intenta en un minuto.');
    });
});

describe('código de retiro regenerable', () => {
    it('misma regla que la RPC: retiro pagado y sin entregar', () => {
        expect(buyerCanRegeneratePickupCode({ status: 'paid', fulfillment_mode: 'pickup' })).toBe(true);
        expect(buyerCanRegeneratePickupCode({ status: 'preparing', fulfillment_mode: 'pickup' })).toBe(true);
        expect(buyerCanRegeneratePickupCode({ status: 'ready_for_pickup', fulfillment_mode: 'pickup' })).toBe(true);
        expect(buyerCanRegeneratePickupCode({ status: 'delivered', fulfillment_mode: 'pickup' })).toBe(false);
        expect(buyerCanRegeneratePickupCode({ status: 'pending_payment', fulfillment_mode: 'pickup' })).toBe(false);
        expect(buyerCanRegeneratePickupCode({ status: 'paid', fulfillment_mode: 'shipping' })).toBe(false);
    });

    it('errores de la RPC en español', () => {
        expect(storeErrorView({ status: 409, body: { error: 'PICKUP_CODE_LIMIT' } }).title).toMatch(/más códigos/);
        expect(storeErrorView({ status: 409, body: { error: 'NOT_A_PICKUP_ORDER' } }).action).toBe('reload_order');
    });
});

describe('copy neutral según quién compra', () => {
    it('socio adulto (atleta, sin rol) no lee "hijo"; acudiente sí', () => {
        expect(buyerKind('athlete')).toBe('member');
        expect(buyerKind(undefined)).toBe('member');
        expect(buyerKind('parent')).toBe('guardian');
        for (const role of ['athlete', 'coach', null]) {
            const c = buyerCopy(role);
            expect(`${c.notesPlaceholder} ${c.pickupShare}`).not.toMatch(/hij[oa]|acudiente/i);
        }
        expect(buyerCopy('parent').notesPlaceholder).toMatch(/hijo/);
    });

    it('sin voseo', () => {
        const all = ['parent', 'athlete'].flatMap((r) => Object.values(buyerCopy(r))).join(' ');
        expect(all).not.toMatch(/\b(vos|tenés|podés|querés|elegí|subí|mirá|escribí)\b/i);
    });
});
