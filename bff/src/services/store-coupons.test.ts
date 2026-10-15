/**
 * Cupones por tienda (tienda v2 F3b): esquema del body, estado visible, usos
 * y mensajes. La base aplica el cupón; esto es solo la capa HTTP.
 */
import { describe, it, expect } from 'vitest';
import {
    CreateCouponSchema, UpdateCouponSchema, couponErrorMessage, couponState, normalizeCouponCode,
    summarizeUsage, toCouponColumns, type CouponRow,
} from './store-coupons';
import { mapStoreRpcError } from './store-rpc-errors';

describe('CreateCouponSchema', () => {
    it('normaliza el código y acepta % de 1 a 90', () => {
        const r = CreateCouponSchema.safeParse({ code: ' socios10 ', kind: 'percent', value: 10 });
        expect(r.success).toBe(true);
        expect(r.success && r.data.code).toBe('SOCIOS10');
    });

    it.each([
        [{ code: 'AB', kind: 'percent', value: 10 }, 'código corto'],
        [{ code: 'CON ESPACIO', kind: 'percent', value: 10 }, 'espacios'],
        [{ code: 'MUCHO', kind: 'percent', value: 95 }, '% > 90'],
        [{ code: 'FIJO', kind: 'fixed', value: 1000.5 }, 'fijo con centavos'],
        [{ code: 'PROD', kind: 'percent', value: 10, appliesTo: 'products' }, 'productos sin lista'],
        [{ code: 'FECHAS', kind: 'percent', value: 10, startsAt: '2026-10-10', endsAt: '2026-10-01' }, 'fin antes de inicio'],
        [{ code: 'SPORTMAPS', kind: 'percent', value: 10, fundedBy: 'platform' }, 'funded_by no se expone (v1)'],
    ])('rechaza %o (%s)', (body) => {
        expect(CreateCouponSchema.safeParse(body).success).toBe(false);
    });

    it('mapea a columnas de store_coupons sin inventar campos', () => {
        const r = CreateCouponSchema.parse({
            code: 'andes15', kind: 'percent', value: 15, minSubtotal: 50000, maxDiscount: 20000,
            maxPerBuyer: 1, appliesTo: 'products', productIds: ['00000000-0000-4000-d000-000000000002'],
            schoolId: '00000000-0000-4000-b000-000000000001',
        });
        expect(toCouponColumns(r)).toEqual({
            code: 'ANDES15', kind: 'percent', value: 15, min_subtotal: 50000, max_discount: 20000,
            max_per_buyer: 1, applies_to: 'products', product_ids: ['00000000-0000-4000-d000-000000000002'],
            school_id: '00000000-0000-4000-b000-000000000001',
        });
    });
});

describe('UpdateCouponSchema', () => {
    it('pausar es un PATCH de status', () => {
        expect(toCouponColumns(UpdateCouponSchema.parse({ status: 'paused' }))).toEqual({ status: 'paused' });
    });
    it('vacío o con campos de más → inválido', () => {
        expect(UpdateCouponSchema.safeParse({}).success).toBe(false);
        expect(UpdateCouponSchema.safeParse({ vendorProfileId: 'x' }).success).toBe(false);
    });
});

describe('couponState y usos', () => {
    const base: CouponRow = {
        id: 'c1', code: 'X', kind: 'percent', value: 10, status: 'active',
        starts_at: '2026-10-01T00:00:00Z', ends_at: null, max_redemptions: 2,
    };
    const now = new Date('2026-10-13T12:00:00Z');

    it('suma reservas, consumos y liberaciones; el descuento dado es solo lo consumido', () => {
        const u = summarizeUsage([
            { coupon_id: 'c1', status: 'consumed', discount_amount: 1000 },
            { coupon_id: 'c1', status: 'reserved', discount_amount: '500' },
            { coupon_id: 'c1', status: 'released', discount_amount: 700 },
        ]).get('c1');
        expect(u).toEqual({ reserved: 1, consumed: 1, released: 1, discountGiven: 1000 });
        expect(couponState(base, u, now)).toBe('exhausted');
    });

    it('vencido, programado, pausado', () => {
        expect(couponState({ ...base, ends_at: '2026-10-12T00:00:00Z' }, undefined, now)).toBe('expired');
        expect(couponState({ ...base, starts_at: '2026-10-20T00:00:00Z' }, undefined, now)).toBe('scheduled');
        expect(couponState({ ...base, status: 'paused' }, undefined, now)).toBe('paused');
        expect(couponState(base, undefined, now)).toBe('active');
    });
});

describe('mensajes de cupón', () => {
    it('quote y create dicen lo mismo', () => {
        for (const code of ['COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_LIMIT', 'COUPON_BUYER_LIMIT', 'COUPON_NOT_APPLICABLE',
            'COUPON_TOO_MANY_ATTEMPTS', 'COUPON_LOGIN_REQUIRED', 'COUPON_NOT_STARTED']) {
            expect(couponErrorMessage(code)).toBe(mapStoreRpcError({ code: 'P0001', message: code }).message);
        }
    });
    it('el mínimo de compra dice cuánto', () => {
        expect(couponErrorMessage('COUPON_MIN_PURCHASE', { min_subtotal: 100000 })).toMatch(/100\.000/);
        expect(couponErrorMessage(null)).toBeNull();
        expect(normalizeCouponCode('  abc-1 ')).toBe('ABC-1');
    });
    it.each([
        ['COUPON_INVALID', 422], ['COUPON_EXPIRED', 422], ['COUPON_LIMIT', 409], ['COUPON_BUYER_LIMIT', 409],
        ['COUPON_MIN_PURCHASE', 422], ['COUPON_TOO_MANY_ATTEMPTS', 429], ['COUPON_LOCKED', 409],
    ])('create_cart_order %s → HTTP %i (y no se confunde con otro token)', (code, status) => {
        expect(mapStoreRpcError({ code: 'P0001', message: code, details: '{"min_subtotal": 100000}' })).toMatchObject({ code, status });
    });
});
