import { describe, it, expect } from 'vitest';
import {
  availabilityLabel, defaultSelection, findVariant, isSoldOut, optionState, priceRange, productAvailable,
  variantAxes, variantLabel, type StoreProduct, type StoreVariant,
} from '../lib/store/variants';

const v = (id: string, talla: string, color: string, available: number, price = 65000): StoreVariant => ({
  id, name: `${talla} / ${color}`, attributes: { Talla: talla, color }, price, available, image_url: null,
});

// Camiseta del seed del gemelo: S 5, M 3, L 0 (azul).
const camiseta: StoreProduct = {
  id: 'cam', name: 'Camiseta', description: null, price: 65000, image_url: null, category: null, stock: 0,
  variants: [v('S', 'S', 'azul', 5), v('M', 'M', 'azul', 3), v('L', 'L', 'azul', 0)],
};
// Guayos: 38 negro 2, 40 negro 4, 40 blanco 0.
const guayos: StoreProduct = {
  id: 'gua', name: 'Guayos', description: null, price: 210000, image_url: null, category: null,
  variants: [v('g1', '38', 'negro', 2, 210000), v('g2', '40', 'negro', 4, 210000), v('g3', '40', 'blanco', 0, 230000)],
};

describe('variantes — disponibilidad (B3)', () => {
  it('con variantes NO está agotado aunque products.stock sea 0', () => {
    expect(productAvailable(camiseta)).toBe(8);
    expect(isSoldOut(camiseta)).toBe(false);
  });

  it('agotado solo si todas las variantes están en 0', () => {
    expect(isSoldOut({ ...camiseta, variants: camiseta.variants!.map((x) => ({ ...x, available: 0 })) })).toBe(true);
  });

  it('sin variantes usa available/stock del producto', () => {
    expect(isSoldOut({ id: 'g', name: 'Gorra', description: null, price: 1, image_url: null, category: null, available: 1 })).toBe(false);
    expect(isSoldOut({ id: 'g', name: 'Gorra', description: null, price: 1, image_url: null, category: null, stock: 0 })).toBe(true);
  });

  it('rango de precio cuando una variante cambia el precio', () => {
    expect(priceRange(guayos)).toEqual({ min: 210000, max: 230000 });
    expect(priceRange(camiseta)).toEqual({ min: 65000, max: 65000 });
  });
});

describe('variantes — selector talla × color', () => {
  it('ejes: talla primero, color después; atributos sin importar mayúsculas', () => {
    expect(variantAxes(guayos.variants!).map((a) => [a.key, a.label, a.values])).toEqual([
      ['talla', 'Talla', ['38', '40']],
      ['color', 'Color', ['negro', 'blanco']],
    ]);
  });

  it('combinación sin stock: visible pero tachada (sold_out); inexistente: missing', () => {
    const vs = guayos.variants!;
    expect(optionState(vs, { talla: '40' }, 'color', 'blanco')).toBe('sold_out');
    expect(optionState(vs, { talla: '40' }, 'color', 'negro')).toBe('available');
    expect(optionState(vs, { talla: '38' }, 'color', 'blanco')).toBe('missing');
    expect(optionState(camiseta.variants!, { color: 'azul' }, 'talla', 'L')).toBe('sold_out');
  });

  it('findVariant exige todos los ejes elegidos', () => {
    expect(findVariant(guayos.variants!, { talla: '40' })).toBeUndefined();
    expect(findVariant(guayos.variants!, { talla: '40', color: 'negro' })?.id).toBe('g2');
  });

  it('la selección por defecto cae en una variante con stock', () => {
    const sel = defaultSelection([v('L', 'L', 'azul', 0), v('M', 'M', 'azul', 3)]);
    expect(sel).toEqual({ talla: 'M', color: 'azul' });
  });

  it('nombre corto para el carrito', () => {
    expect(variantLabel(v('M', 'M', 'azul', 1))).toBe('Talla M · Azul');
  });
});

describe('variantes — texto de disponibilidad', () => {
  it('nunca el número exacto si supera el umbral', () => {
    expect(availabilityLabel(0)).toEqual({ text: 'Agotado', tone: 'out' });
    expect(availabilityLabel(1).text).toBe('¡Última unidad!');
    expect(availabilityLabel(3).text).toBe('Últimas 3 disponibles');
    expect(availabilityLabel(12)).toEqual({ text: 'Disponible', tone: 'ok' });
    expect(availabilityLabel(8, 10).text).toBe('Últimas 8 disponibles');
  });
});
