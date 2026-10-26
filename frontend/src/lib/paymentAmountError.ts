/**
 * El monto de un cobro que crea el navegador lo valida la base
 * (trg_zz_payments_monto_servidor, migración 20261007163134):
 *
 * - Mensualidad: tiene que ser la tarifa del servidor (misma regla que
 *   open_month). Si no, la base rechaza con `PAYMENT_AMOUNT_MISMATCH: <valor>`.
 * - Monto <= 0: `PAYMENT_AMOUNT_INVALID`.
 *
 * Esto solo traduce ese rechazo a un mensaje para la familia. Si la pantalla
 * mostraba otro valor (precio que cambió, pestaña vieja), recargar trae el
 * cobro con el valor correcto.
 */

const formatoCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/** Valor de la mensualidad que dice el servidor, o null si el error no es ese. */
export function montoEsperadoDelServidor(error: { message?: string | null } | null | undefined): number | null {
  const m = error?.message?.match(/PAYMENT_AMOUNT_MISMATCH:\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mensaje para la familia si el rechazo es por el monto; null si es otro error. */
export function mensajeErrorDeMonto(error: { message?: string | null } | null | undefined): string | null {
  const msg = error?.message ?? '';
  if (msg.includes('PAYMENT_AMOUNT_MISMATCH')) {
    const esperado = montoEsperadoDelServidor(error);
    return esperado
      ? `El valor de la mensualidad es ${formatoCOP(esperado)}. Recarga la página para pagar el valor correcto.`
      : 'El valor de la mensualidad cambió. Recarga la página para pagar el valor correcto.';
  }
  if (msg.includes('PAYMENT_AMOUNT_INVALID')) {
    return 'El valor del pago debe ser mayor que cero.';
  }
  return null;
}
