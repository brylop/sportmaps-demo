import { describe, it, expect } from 'vitest';
import { mensajeErrorDeMonto, montoEsperadoDelServidor } from './paymentAmountError';

describe('rechazo del monto por la base (trg_zz_payments_monto_servidor)', () => {
  it('lee el valor de la mensualidad que dice el servidor', () => {
    expect(montoEsperadoDelServidor({ message: 'PAYMENT_AMOUNT_MISMATCH: 150000' })).toBe(150000);
    expect(montoEsperadoDelServidor({ message: 'PAYMENT_AMOUNT_MISMATCH: 127500.00' })).toBe(127500);
    expect(montoEsperadoDelServidor({ message: 'duplicate key' })).toBeNull();
    expect(montoEsperadoDelServidor(null)).toBeNull();
  });

  it('traduce el rechazo a un mensaje para la familia con el valor correcto', () => {
    const msg = mensajeErrorDeMonto({ message: 'PAYMENT_AMOUNT_MISMATCH: 150000' });
    expect(msg).toMatch(/mensualidad es/);
    expect(msg).toMatch(/150\.000/);
    expect(msg).toMatch(/Recarga/);
  });

  it('monto <= 0 y errores ajenos', () => {
    expect(mensajeErrorDeMonto({ message: 'PAYMENT_AMOUNT_INVALID' })).toMatch(/mayor que cero/);
    expect(mensajeErrorDeMonto({ message: 'PAYMENT_FIELD_LOCKED: status' })).toBeNull();
    expect(mensajeErrorDeMonto(undefined)).toBeNull();
  });
});
