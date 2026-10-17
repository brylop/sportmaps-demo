import { describe, expect, it } from 'vitest';
import {
  etiquetaDelMedio, mediosDeCobroDeLaEscuela, soloEfectivo, validarCobroDelTorneo,
} from './mediosDeCobro';

const claves = (s: Record<string, unknown> | null | undefined) => mediosDeCobroDeLaEscuela(s).map((m) => m.key);

describe('mediosDeCobroDeLaEscuela', () => {
  it('sin configuración solo ofrece el efectivo', () => {
    expect(claves(null)).toEqual(['efectivo']);
    expect(claves({})).toEqual(['efectivo']);
  });

  it('ofrece solo lo que la escuela tiene cargado', () => {
    expect(claves({ wompi_enabled: true, nequi_number: '3001234567', bank_account_number: '123' }))
      .toEqual(['wompi', 'nequi', 'transferencia', 'efectivo']);
  });

  it('un número vacío o en blanco no cuenta', () => {
    expect(claves({ nequi_number: '   ', daviplata_number: '', breb_key: null })).toEqual(['efectivo']);
  });

  it('Bre-B vale con llave o con número', () => {
    expect(claves({ breb_key: '@escuela' })).toContain('breb');
    expect(claves({ breb_number: '3001112222' })).toContain('breb');
  });

  it('wompi_enabled solo cuenta si es exactamente true', () => {
    expect(claves({ wompi_enabled: 'true' })).not.toContain('wompi');
    expect(claves({ wompi_enabled: false })).not.toContain('wompi');
  });
});

describe('validarCobroDelTorneo', () => {
  const ok = { is_paid: true, price: '50000', payment_methods: ['nequi'], valid_until: '2026-11-01' };

  it('gratis no pide nada', () => {
    expect(validarCobroDelTorneo({ is_paid: false, price: '', payment_methods: [], valid_until: '' })).toBeNull();
  });

  it('con costo y todo completo → válido', () => {
    expect(validarCobroDelTorneo(ok)).toBeNull();
  });

  it('exige tarifa mayor que cero', () => {
    for (const price of ['', '0', '-5', 'abc']) {
      expect(validarCobroDelTorneo({ ...ok, price })).toMatch(/tarifa mayor que cero/);
    }
  });

  it('exige al menos un medio de pago', () => {
    expect(validarCobroDelTorneo({ ...ok, payment_methods: [] })).toMatch(/medio de pago/);
  });

  it('exige una fecha de vigencia de la tarifa', () => {
    expect(validarCobroDelTorneo({ ...ok, valid_until: '' })).toMatch(/vigencia/);
  });
});

describe('etiquetaDelMedio / soloEfectivo', () => {
  it('traduce las claves conocidas y deja las desconocidas', () => {
    expect(etiquetaDelMedio('nequi')).toBe('Nequi');
    expect(etiquetaDelMedio('efectivo')).toBe('Efectivo en la escuela');
    expect(etiquetaDelMedio('otro')).toBe('otro');
  });

  it('soloEfectivo: solo cuando TODOS los medios son efectivo', () => {
    expect(soloEfectivo(['efectivo'])).toBe(true);
    expect(soloEfectivo(['efectivo', 'nequi'])).toBe(false);
    expect(soloEfectivo([])).toBe(false);
    expect(soloEfectivo(null)).toBe(false);
  });
});
