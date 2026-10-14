/**
 * Cupones por tienda (tienda v2 F3b): textos para el comprador, formulario de
 * la tienda y errores del checkout. La base aplica el descuento.
 */
import { describe, it, expect } from 'vitest';
import {
  couponAdminErrorText, couponConditions, couponErrorText, couponPayload, couponValueLabel, EMPTY_COUPON_FORM,
} from '../lib/store/coupons';
import { storeErrorCode, storeErrorView } from '../lib/store/storeErrors';
import { getVendorNavGroup } from '../config/navigation';

const bff = (status: number, error: string, details?: unknown) =>
  Object.assign(new Error(error), { status, body: { ok: false, error, message: 'x', ...(details ? { details } : {}) } });

describe('mensajes de cupón para el comprador', () => {
  it('cada coupon_error de quote_cart tiene texto propio, sin código crudo', () => {
    for (const c of ['COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_NOT_STARTED', 'COUPON_LIMIT', 'COUPON_BUYER_LIMIT',
      'COUPON_MIN_PURCHASE', 'COUPON_NOT_APPLICABLE', 'COUPON_TOO_MANY_ATTEMPTS', 'COUPON_LOGIN_REQUIRED', 'MULTIPLE_SELLERS']) {
      const t = couponErrorText(c);
      expect(t, c).toBeTruthy();
      expect(t, c).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    }
    expect(couponErrorText('COUPON_EXPIRED')).toBe('Ese código ya venció.');
    expect(couponErrorText(null)).toBeNull();
  });

  it('el mínimo de compra dice cuánto falta alcanzar', () => {
    expect(couponErrorText('COUPON_MIN_PURCHASE', { min_subtotal: 100000 })).toMatch(/100\.000/);
  });

  it('errores de create_cart_order: acción fix_coupon y no se confunden entre sí', () => {
    for (const c of ['COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_LIMIT', 'COUPON_BUYER_LIMIT', 'COUPON_MIN_PURCHASE', 'COUPON_NOT_APPLICABLE']) {
      const v = storeErrorView(bff(422, c));
      expect(v.code, c).toBe(c);
      expect(v.action, c).toBe('fix_coupon');
      expect(v.description, c).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    }
    expect(storeErrorCode({ message: 'COUPON_BUYER_LIMIT' })).toBe('COUPON_BUYER_LIMIT');
    expect(storeErrorView(bff(401, 'COUPON_LOGIN_REQUIRED')).action).toBe('login');
  });
});

describe('formulario de la tienda', () => {
  it('10 % por defecto, código normalizado, 1 uso por comprador', () => {
    const p = couponPayload({ ...EMPTY_COUPON_FORM, code: ' socios10 ' });
    expect(p).toEqual({ ok: true, body: { code: 'SOCIOS10', kind: 'percent', value: 10, maxPerBuyer: 1 } });
  });

  it('fijo con mínimo, tope, usos y vencimiento a fin de día en Colombia', () => {
    const p = couponPayload({
      ...EMPTY_COUPON_FORM, code: 'FIJO20K', kind: 'fixed', value: '20.000', minSubtotal: '100.000', maxDiscount: '',
      maxRedemptions: '50', maxPerBuyer: '', endsAt: '2099-12-31',
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.body).toMatchObject({ code: 'FIJO20K', kind: 'fixed', value: 20000, minSubtotal: 100000, maxRedemptions: 50, maxPerBuyer: null });
    expect(p.body.endsAt).toBe('2100-01-01T04:59:59.000Z');
  });

  it.each([
    [{ code: 'AB' }, /3 a 30/],
    [{ code: 'MUCHO', value: '95' }, /1 a 90/],
    [{ code: 'CERO', value: '0' }, /cuánto descuenta/],
    [{ code: 'VIEJO', endsAt: '2000-01-01' }, /futura/],
    [{ code: 'NEG', maxRedemptions: '-1' }, /enteros y positivos/],
  ])('rechaza %o', (patch, msg) => {
    const p = couponPayload({ ...EMPTY_COUPON_FORM, ...patch });
    expect(p.ok).toBe(false);
    if ('error' in p) expect(p.error).toMatch(msg);
  });

  it('etiquetas y condiciones', () => {
    expect(couponValueLabel({ kind: 'percent', value: 10 })).toBe('10 %');
    expect(couponValueLabel({ kind: 'fixed', value: 20000 })).toMatch(/20\.000/);
    expect(couponConditions({ min_subtotal: 0, max_discount: null, max_redemptions: null, max_per_buyer: null, ends_at: null, applies_to: 'store', school_id: null }))
      .toBe('Toda la tienda, sin mínimo');
    expect(couponConditions({ min_subtotal: 50000, max_discount: null, max_redemptions: 3, max_per_buyer: 1, ends_at: null, applies_to: 'store', school_id: null }))
      .toMatch(/mínimo .*50\.000 · 3 usos en total · 1 por comprador/);
  });

  it('errores del BFF al guardar', () => {
    expect(couponAdminErrorText(bff(409, 'COUPON_CODE_TAKEN'))).toBe('Ya tienes un cupón con ese código.');
    expect(couponAdminErrorText(bff(409, 'COUPON_LOCKED'))).toMatch(/ya tiene usos/);
  });
});

describe('menú «Tu tienda»', () => {
  it('trae Cupones cuando la tienda está abierta', () => {
    const g = getVendorNavGroup({ canSellProducts: true, canSellServices: false, verificationStatus: 'verified', storeEnabled: true, isSchool: true, storeOpen: true });
    expect(g.items.find((i) => i.title === 'Cupones')?.href).toBe('/tienda-escuela/cupones');
  });
});
