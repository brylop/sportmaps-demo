/**
 * El monto de un cobro que crea el navegador lo pone la base:
 *
 * - S4 (trg_zzy_monto_cobro_cliente, 20261010145241): mensualidad, inscripción
 *   y seguro salen con la tarifa del servidor; sin tarifa, P0001 con un mensaje
 *   ya legible (PAYMENT_AMOUNT_UNPRICED en el DETAIL).
 * - Marca amount_source (20261025205952 + 20261025205957): monto <= 0 →
 *   `PAYMENT_AMOUNT_INVALID`. Desde el 2026-10-24 un monto distinto NO se
 *   rechaza (queda 'cliente', sin auto-aprobación), así que
 *   `PAYMENT_AMOUNT_MISMATCH` ya no llega; se sigue traduciendo por si vuelve.
 *
 * Esto solo traduce esos rechazos a un mensaje para la familia.
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
