import { describe, it, expect, vi, afterEach } from 'vitest';
import { calcEarlyPaymentDiscount, earlyDiscountAppliesToCategory } from './earlyPaymentDiscount';

// Espejo de fn_payments_pronto_pago_servidor (migración 20261010143743, S1/H5):
// si estas reglas cambian, la del servidor tiene que cambiar igual, o el
// navegador mostrará un descuento que la base recorta.

const cfg = { enabled: true, days: 5, percentage: 10 };

vi.mock('@/lib/dateUtils', () => ({ todayColombia: vi.fn(() => '2026-10-10') }));

afterEach(() => vi.clearAllMocks());

describe('earlyDiscountAppliesToCategory', () => {
  it('mensualidad y legado (NULL) sí', () => {
    expect(earlyDiscountAppliesToCategory('mensualidad')).toBe(true);
    expect(earlyDiscountAppliesToCategory(null)).toBe(true);
    expect(earlyDiscountAppliesToCategory(undefined)).toBe(true);
  });
  it.each(['inscripcion', 'seguro', 'torneo', 'articulos', 'otro'])('cobro único %s no', (c) => {
    expect(earlyDiscountAppliesToCategory(c)).toBe(false);
  });
});

describe('calcEarlyPaymentDiscount', () => {
  it('dentro de la ventana: round(amount × pct)', () => {
    const r = calcEarlyPaymentDiscount(123455, { createdAt: '2026-10-06T15:00:00Z', config: cfg, hasEarlierUnpaid: false });
    expect(r).toMatchObject({ eligible: true, discountAmount: 12346, finalAmount: 111109, validUntil: '2026-10-11' });
  });

  it('el último día de la ventana (created + days) todavía aplica', () => {
    const r = calcEarlyPaymentDiscount(100000, { createdAt: '2026-10-05T15:00:00Z', config: cfg, hasEarlierUnpaid: false });
    expect(r.eligible).toBe(true);
  });

  it('fuera de la ventana no aplica', () => {
    const r = calcEarlyPaymentDiscount(100000, { createdAt: '2026-10-04T15:00:00Z', config: cfg, hasEarlierUnpaid: false });
    expect(r).toMatchObject({ eligible: false, discountAmount: 0, finalAmount: 100000 });
  });

  it('la ventana se cuenta en fecha de Bogotá (00:30 UTC = día anterior en Colombia)', () => {
    // 2026-10-05T00:30Z = 2026-10-04 19:30 Bogotá → vence 2026-10-09 → hoy 10 ya no.
    const r = calcEarlyPaymentDiscount(100000, { createdAt: '2026-10-05T00:30:00Z', config: cfg, hasEarlierUnpaid: false });
    expect(r.eligible).toBe(false);
  });

  it('con un cobro anterior impago no aplica', () => {
    const r = calcEarlyPaymentDiscount(100000, { createdAt: '2026-10-09T15:00:00Z', config: cfg, hasEarlierUnpaid: true });
    expect(r.eligible).toBe(false);
  });

  it('escuela sin pronto pago o con 0 % no aplica', () => {
    expect(calcEarlyPaymentDiscount(100000, { createdAt: '2026-10-09T15:00:00Z', config: { ...cfg, enabled: false }, hasEarlierUnpaid: false }).eligible).toBe(false);
    expect(calcEarlyPaymentDiscount(100000, { createdAt: '2026-10-09T15:00:00Z', config: { ...cfg, percentage: 0 }, hasEarlierUnpaid: false }).eligible).toBe(false);
  });

  it('el valor congelado en la fila manda (lo que la base ya acotó)', () => {
    const r = calcEarlyPaymentDiscount(100000, { createdAt: '2026-01-01T15:00:00Z', config: cfg, hasEarlierUnpaid: true, alreadyAppliedAmount: 7000 });
    expect(r).toMatchObject({ eligible: true, discountAmount: 7000, finalAmount: 93000 });
  });
});
