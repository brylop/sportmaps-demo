import { describe, expect, it } from 'vitest';
import { parsePaymentFailure } from './paymentFailure';

describe('parsePaymentFailure', () => {
  it('rechazo ordinario de tarjeta', () => {
    expect(parsePaymentFailure('wompi_rejected · CARD · Fondos insuficientes (tx=1)')).toEqual({
      label: 'Tarjeta rechazada', bankMessage: 'Fondos insuficientes', ambiguous: false,
    });
  });

  it('pago parcial por mora: no se rotula como rechazo y muestra lo que falta', () => {
    const r = parsePaymentFailure(
      'wompi_pago_parcial · NEQUI · Pagó $150.000; faltan $15.000 (recargo por mora aplicado después de generar el enlace; cobro $165.000) (tx=12-3)',
    );
    expect(r).toEqual({
      label: 'Falta saldo',
      bankMessage: 'Pagó $150.000; faltan $15.000 (recargo por mora aplicado después de generar el enlace; cobro $165.000)',
      ambiguous: false,
    });
  });

  it('pago parcial sin medio (Mercado Pago o tx sin payment_method_type)', () => {
    const r = parsePaymentFailure('mp_pago_parcial · Pagó $100.000; faltan $5.000 (el cobro subió después de generar el enlace; cobro $105.000) (tx=9)');
    expect(r?.label).toBe('Falta saldo');
    expect(r?.bankMessage).toContain('faltan $5.000');
    expect(r?.ambiguous).toBe(false);
  });
});
