import { describe, it, expect } from 'vitest';
import {
  addLine, applyQuote, cartStorageKey, clampQuantity, groupByStore, mergeCarts, parseStoredCart, productLineId,
  setLineQuantity, toCheckoutItems, toQuoteItems, MAX_QTY_PER_LINE, type CartLineLike, type CartQuote,
} from '../lib/store/cart';

const VP_A = 'vp-a';
const VP_B = 'vp-b';

function line(over: Partial<CartLineLike> & { metadata?: CartLineLike['metadata'] } = {}): CartLineLike {
  return {
    id: productLineId('p1'),
    type: 'product',
    name: 'Gorra',
    price: 45000,
    quantity: 1,
    stock: 5,
    metadata: { productId: 'p1', vendorProfileId: VP_A, vendorName: 'Tienda A' },
    ...over,
  };
}

function quote(lines: CartQuote['lines'], extra: Partial<CartQuote> = {}): CartQuote {
  return {
    lines, subtotal: 0, tax_total: 0, shipping: 0, shipping_error: null, discount_total: 0, total: 0,
    coupon_error: null, multiple_sellers: false, store_enabled: true, ...extra,
  };
}

describe('carrito — persistencia por usuario', () => {
  it('la clave lleva el usuario; invitado tiene la suya', () => {
    expect(cartStorageKey('u1')).toBe('sportmaps_cart:u:u1');
    expect(cartStorageKey(null)).toBe('sportmaps_cart:guest');
    expect(cartStorageKey('u1')).not.toBe(cartStorageKey('u2'));
  });

  it('lee lo guardado y descarta basura', () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart('no-json')).toEqual([]);
    expect(parseStoredCart('{"a":1}')).toEqual([]);
    const ok = JSON.stringify([line(), { id: 'x' }, { ...line({ id: 'z' }), quantity: 0 }]);
    expect(parseStoredCart(ok).map((i) => i.id)).toEqual([productLineId('p1')]);
  });

  it('al iniciar sesión suma el carrito del invitado sin pasar el tope', () => {
    const user = [line({ quantity: 2 })];
    const guest = [line({ quantity: 4 }), line({ id: productLineId('p2'), metadata: { productId: 'p2', vendorProfileId: VP_A } })];
    const merged = mergeCarts(user, guest);
    expect(merged).toHaveLength(2);
    expect(merged[0].quantity).toBe(5); // stock 5
  });
});

describe('carrito — cantidades (B6: no sobrevende)', () => {
  it('tope = disponible y 20 por línea', () => {
    expect(clampQuantity(4, 1)).toBe(1);
    expect(clampQuantity(30)).toBe(MAX_QTY_PER_LINE);
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(3, 0)).toBe(0);
  });

  it('agregar 4 de un producto con stock 1 deja 1 y avisa', () => {
    const res = addLine([], line({ stock: 1 }), 4);
    expect(res.items[0].quantity).toBe(1);
    expect(res.clamped).toBe(true);
  });

  it('agregar algo agotado no lo mete', () => {
    const res = addLine([], line({ stock: 0 }), 1);
    expect(res.items).toHaveLength(0);
    expect(res.added).toBe(0);
  });

  it('volver a agregar suma en la misma línea; otra talla es otra línea', () => {
    let items = addLine([], line({ id: productLineId('p1', 'vS'), metadata: { productId: 'p1', variantId: 'vS' } }), 1).items;
    items = addLine(items, line({ id: productLineId('p1', 'vS'), metadata: { productId: 'p1', variantId: 'vS' } }), 2).items;
    items = addLine(items, line({ id: productLineId('p1', 'vM'), metadata: { productId: 'p1', variantId: 'vM' } }), 1).items;
    expect(items.map((i) => [i.id, i.quantity])).toEqual([[productLineId('p1', 'vS'), 3], [productLineId('p1', 'vM'), 1]]);
  });

  it('setLineQuantity topa y 0 quita la línea', () => {
    const items = [line({ quantity: 1, stock: 2 })];
    expect(setLineQuantity(items, items[0].id, 9)[0].quantity).toBe(2);
    expect(setLineQuantity(items, items[0].id, 0)).toHaveLength(0);
  });
});

describe('carrito — el cliente nunca manda precios', () => {
  it('toQuoteItems / toCheckoutItems solo llevan ids y cantidad; la variante manda', () => {
    const items = [
      line({ quantity: 2 }),
      line({ id: productLineId('p2', 'v9'), metadata: { productId: 'p2', variantId: 'v9', vendorProfileId: VP_A } }),
      { ...line({ id: 'enr' }), type: 'enrollment' },
    ];
    expect(toQuoteItems(items)).toEqual([{ product_id: 'p1', quantity: 2 }, { variant_id: 'v9', quantity: 1 }]);
    expect(toCheckoutItems(items)).toEqual([{ productId: 'p1', quantity: 2 }, { variantId: 'v9', quantity: 1 }]);
    for (const i of [...toQuoteItems(items), ...toCheckoutItems(items)]) {
      expect(Object.keys(i).some((k) => /price|total|amount/i.test(k))).toBe(false);
    }
  });
});

describe('carrito — agrupado por tienda (D-2)', () => {
  it('un grupo por vendor_profile; los ítems sin tienda van aparte', () => {
    const groups = groupByStore([
      line(),
      line({ id: 'b1', metadata: { productId: 'b1', vendorProfileId: VP_B, vendorName: 'Tienda B' } }),
      line({ id: 'a2', metadata: { productId: 'a2', vendorProfileId: VP_A, vendorName: 'Tienda A' } }),
      line({ id: 'x', metadata: { productId: 'x' } }),
      { ...line({ id: 'svc' }), type: 'service' },
    ]);
    expect(groups.map((g) => [g.vendorProfileId, g.items.length])).toEqual([[VP_A, 2], [VP_B, 1], [null, 1]]);
  });
});

describe('carrito — revalidación con quote_cart', () => {
  it('precio que cambió, cantidad ajustada a lo disponible y tienda deducida', () => {
    const items = [
      line({ quantity: 4, price: 40000 }),
      line({ id: 'old', metadata: { productId: 'p2' } }),
    ];
    const res = applyQuote(items, quote([
      { product_id: 'p1', variant_id: null, quantity: 4, available: 1, unit_price: 45000, error: 'INSUFFICIENT_STOCK', vendor_profile_id: VP_A },
      { product_id: 'p2', variant_id: null, quantity: 1, available: 3, unit_price: 45000, error: null, vendor_profile_id: VP_B },
    ]));
    expect(res.items[0]).toMatchObject({ price: 45000, quantity: 1, stock: 1 });
    expect(res.items[1].metadata.vendorProfileId).toBe(VP_B);
    expect(res.notices.map((n) => n.kind).sort()).toEqual(['price_changed', 'qty_adjusted']);
    expect(res.blocked).toBe(false);
  });

  it('agotado, no disponible (p. ej. school_only ajeno) o sin talla bloquean el pago', () => {
    const items = [
      line(),
      line({ id: 'b', metadata: { productId: 'b', vendorProfileId: VP_A } }),
      line({ id: 'c', metadata: { productId: 'c', vendorProfileId: VP_A } }),
    ];
    const res = applyQuote(items, quote([
      { product_id: 'p1', variant_id: null, quantity: 1, available: 0, unit_price: 45000, error: 'OUT_OF_STOCK' },
      { product_id: 'b', variant_id: null, quantity: 1, error: 'PRODUCT_NOT_AVAILABLE' },
      { product_id: 'c', variant_id: null, quantity: 1, error: 'VARIANT_REQUIRED' },
    ]));
    expect(res.blocked).toBe(true);
    expect(res.notices.map((n) => n.kind)).toEqual(['out_of_stock', 'unavailable', 'variant_required']);
    expect(res.items[0].stock).toBe(0);
  });

  it('empareja por variante, no por producto', () => {
    const items = [line({ id: productLineId('p1', 'vS'), metadata: { productId: 'p1', variantId: 'vS', vendorProfileId: VP_A } })];
    const res = applyQuote(items, quote([
      { product_id: 'p1', variant_id: 'vM', quantity: 1, available: 0, unit_price: 1, error: 'OUT_OF_STOCK' },
      { product_id: 'p1', variant_id: 'vS', quantity: 1, available: 4, unit_price: 65000, error: null },
    ]));
    expect(res.blocked).toBe(false);
    expect(res.items[0]).toMatchObject({ price: 65000, stock: 4 });
  });
});
