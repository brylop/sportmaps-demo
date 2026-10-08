import { describe, it, expect } from 'vitest';
import { buyerStoreVisibility, BUYER_STORE_HIDDEN } from '../lib/store/buyerStoreVisibility';
import { getNavigationByRole } from '../config/navigation';

/**
 * Piloto de la tienda (GYM RM): el flag global se prende, pero solo la escuela
 * cuya tienda vende (store_seller_allowed) debe mostrarle «Tienda» a sus padres
 * y atletas. «Mis compras» además si el usuario ya tiene pedidos.
 */
const hrefs = (groups: ReturnType<typeof getNavigationByRole>) =>
  groups.flatMap(g => g.items.flatMap(i => [i.href, ...(i.submenu ?? []).map(s => s.href)])).filter(Boolean);

describe('buyerStoreVisibility — flag × escuela vende × tiene pedidos', () => {
  const casos: Array<[boolean, boolean, boolean, boolean, boolean]> = [
    // flag, vende, pedidos → Tienda, Mis compras
    [false, false, false, false, false],
    [false, false, true,  false, false],
    [false, true,  false, false, false],
    [false, true,  true,  false, false],
    [true,  false, false, false, false],
    [true,  false, true,  false, true],
    [true,  true,  false, true,  true],
    [true,  true,  true,  true,  true],
  ];
  it.each(casos)('flag=%s vende=%s pedidos=%s → Tienda=%s, Mis compras=%s',
    (storeEnabled, schoolSells, hasOrders, showStore, showMyPurchases) => {
      expect(buyerStoreVisibility({ storeEnabled, schoolSells, hasOrders })).toEqual({ showStore, showMyPurchases });
    });

  it('fail-closed: sin datos (cargando / error / sin escuela) no muestra nada', () => {
    expect(buyerStoreVisibility(null)).toEqual(BUYER_STORE_HIDDEN);
    expect(buyerStoreVisibility(undefined)).toEqual(BUYER_STORE_HIDDEN);
    expect(buyerStoreVisibility({ storeEnabled: true })).toEqual(BUYER_STORE_HIDDEN);
  });
});

describe('menú del comprador (getNavigationByRole)', () => {
  const all = () => true;
  for (const role of ['parent', 'athlete'] as const) {
    describe(role, () => {
      it('flag prendido + escuela que NO vende + sin pedidos → ni Tienda ni Mis compras', () => {
        const nav = getNavigationByRole(role, all, all, true, buyerStoreVisibility({ storeEnabled: true, schoolSells: false, hasOrders: false }));
        expect(hrefs(nav)).not.toContain('/mi-tienda');
        expect(hrefs(nav)).not.toContain('/mis-compras');
        expect(hrefs(nav)).not.toContain('/shop');
      });

      it('flag prendido + escuela que vende → Tienda y Mis compras', () => {
        const nav = getNavigationByRole(role, all, all, true, buyerStoreVisibility({ storeEnabled: true, schoolSells: true, hasOrders: false }));
        expect(hrefs(nav)).toContain('/mi-tienda');
        expect(hrefs(nav)).toContain('/mis-compras');
      });

      it('flag prendido + escuela que no vende + ya compró → solo Mis compras', () => {
        const nav = getNavigationByRole(role, all, all, true, buyerStoreVisibility({ storeEnabled: true, schoolSells: false, hasOrders: true }));
        expect(hrefs(nav)).not.toContain('/mi-tienda');
        expect(hrefs(nav)).toContain('/mis-compras');
      });

      it('flag apagado → nada, aunque se pase visibilidad positiva por error', () => {
        const nav = getNavigationByRole(role, all, all, false, { showStore: true, showMyPurchases: true });
        expect(hrefs(nav)).not.toContain('/mi-tienda');
        expect(hrefs(nav)).not.toContain('/mis-compras');
      });

      it('default del 5.º parámetro = oculto (fail-closed)', () => {
        const nav = getNavigationByRole(role, all, all, true);
        expect(hrefs(nav)).not.toContain('/mi-tienda');
        expect(hrefs(nav)).not.toContain('/mis-compras');
      });

      it('no queda el grupo «Tienda» vacío cuando se ocultan sus ítems', () => {
        const nav = getNavigationByRole(role, all, all, true, BUYER_STORE_HIDDEN);
        for (const g of nav) expect(g.items.length).toBeGreaterThan(0);
        if (role === 'athlete') expect(nav.map(g => g.title)).not.toContain('Tienda');
      });
    });
  }

  it('el panel de la escuela no depende de la visibilidad del comprador', () => {
    const a = hrefs(getNavigationByRole('school', all, all, true, BUYER_STORE_HIDDEN));
    const b = hrefs(getNavigationByRole('school', all, all, true, { showStore: true, showMyPurchases: true }));
    expect(a).toEqual(b);
  });
});
