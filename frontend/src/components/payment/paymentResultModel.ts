/**
 * /payment-result (V2 «Pago recibido») — palabras de la pantalla, sin React.
 * Nunca el estado técnico de Wompi (APPROVED, DECLINED…).
 */
export type WompiStatus = 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' | 'PENDING';

export interface ResultadoEnPalabras {
  tono: 'ok' | 'espera' | 'error' | 'neutro';
  titulo: string;
  frase: string;
  /** Botón principal. */
  accion: string;
}

export function resultadoPago(status: string | null | undefined): ResultadoEnPalabras {
  switch (status) {
    case 'APPROVED':
      return { tono: 'ok', titulo: 'Pago recibido', frase: 'No tienes que enviar comprobante. En unos minutos lo ves como pagado en Pagos.', accion: 'Ver mis pagos' };
    case 'PENDING':
      return { tono: 'espera', titulo: 'Tu pago se está confirmando', frase: 'El banco aún no responde. Suele tardar unos minutos; no lo pagues otra vez.', accion: 'Ver mis pagos' };
    case 'DECLINED':
      return { tono: 'error', titulo: 'El pago no pasó', frase: 'Tu banco lo rechazó y no se te cobró. Puedes intentarlo de nuevo con otro medio.', accion: 'Intentar de nuevo' };
    case 'VOIDED':
      return { tono: 'neutro', titulo: 'El pago se anuló', frase: 'No se te cobró nada. Si todavía debes ese cobro, puedes pagarlo de nuevo.', accion: 'Ver mis pagos' };
    default:
      return { tono: 'error', titulo: 'El pago no pasó', frase: 'Hubo un problema al procesarlo y no se te cobró. Inténtalo de nuevo.', accion: 'Intentar de nuevo' };
  }
}

const METODOS: Record<string, string> = {
  CARD: 'Tarjeta',
  PSE: 'PSE',
  NEQUI: 'Nequi',
  BANCOLOMBIA_TRANSFER: 'Botón Bancolombia',
  BANCOLOMBIA_QR: 'QR Bancolombia',
  BANCOLOMBIA_COLLECT: 'Corresponsal Bancolombia',
  DAVIPLATA: 'Daviplata',
  PCOL: 'Puntos Colombia',
  SU_PLUS: 'SU+ Pay',
};

/** «Tarjeta», «PSE»… o null si no se reconoce (no se muestra un código técnico). */
export function metodoEnPalabras(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  return METODOS[tipo.toUpperCase()] ?? null;
}

/** A dónde lleva el botón principal según quién mira. */
export function destinoResultado(opts: { logueado: boolean; rol: string | null | undefined }): string {
  if (!opts.logueado) return '/';
  if (opts.rol === 'parent' || opts.rol === 'athlete') return '/my-payments';
  return '/dashboard';
}
