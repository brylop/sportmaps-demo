/**
 * Lectura humana del último intento de pago fallido.
 *
 * `payments.last_failure_reason` lo escribe el webhook con formato
 * `<proveedor>_<estado> · <medio> · <mensaje del banco> (tx=…)`. Acá se
 * convierte en algo que una secretaria pueda leer de un vistazo en la fila del
 * cobro, sin abrir el dashboard de Wompi.
 *
 * Por qué existe: hasta el 19 ago 2026 el rechazo no se veía en NINGUNA
 * pantalla. La escuela leía «Pendiente» sin saber que la mamá había intentado
 * pagar y su banco la tumbó en el 3DS, y el cobro salía en la conversación de
 * mora como si la familia no hubiera hecho nada.
 */

/** Medios tal como los rotula Wompi/MercadoPago, y cómo se dicen en español. */
const MEDIOS: Record<string, string> = {
  CARD: 'Tarjeta',
  PSE: 'PSE',
  NEQUI: 'Nequi',
  BANCOLOMBIA_TRANSFER: 'Bancolombia',
  BANCOLOMBIA_QR: 'Bancolombia QR',
  DAVIPLATA: 'Daviplata',
};

export interface PaymentFailure {
  /** Rótulo corto del chip: «Tarjeta rechazada», «PSE no autorizado». */
  label: string;
  /** Lo que dijo el banco, si vino. Va en el detalle, no en el chip. */
  bankMessage: string | null;
  /**
   * ERROR/VOIDED: no sabemos si el dinero se movió. Estos SÍ necesitan que
   * alguien mire la pasarela; una declinación ordinaria no.
   */
  ambiguous: boolean;
}

/**
 * Interpreta `last_failure_reason`. Devuelve null si no hay intento fallido.
 *
 * Tolerante con el formato viejo (`wompi_rejected (tx=…)`, sin medio ni
 * mensaje): los 10 casos de Dynasty de agosto quedaron así.
 */
export function parsePaymentFailure(reason: string | null | undefined): PaymentFailure | null {
  if (!reason) return null;

  const partes = reason.split('·').map(p => p.trim());
  const codigo = (partes[0] || '').replace(/\s*\(tx=.*$/, '').trim();

  // `wompi_rejected` → rejected; `mp_failed` → failed.
  const estado = codigo.replace(/^(wompi|mp)_/, '');

  const medioRaw = (partes[1] || '').replace(/\s*\(.*$/, '').trim().toUpperCase();
  const medio = MEDIOS[medioRaw] ?? null;

  const bankMessage = (partes[2] || '').replace(/\s*\(tx=[^)]*\)\s*$/, '').trim() || null;

  const ambiguous = estado === 'failed' || estado === 'refunded';

  let label: string;
  if (ambiguous) {
    // No decir «rechazado»: justamente lo que no sabemos es si se cobró.
    label = estado === 'refunded' ? 'Transacción anulada' : 'Error de la pasarela';
  } else if (medio === 'PSE') {
    label = 'PSE no autorizado';
  } else if (medio) {
    label = `${medio} rechazada`;
  } else {
    label = 'Pago rechazado';
  }

  return { label, bankMessage, ambiguous };
}
