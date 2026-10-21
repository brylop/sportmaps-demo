/**
 * Comprobante vs. total cuando la operación incluye horas adicionales por adelantado.
 *
 * Si la familia paga por transferencia y el comprobante lee MENOS de lo que la
 * operación registra, las horas quedarían «pagadas» con plata que el comprobante
 * no cubre. La pantalla lo bloquea y ofrece «Separar las horas»; esto es el mismo
 * criterio en el servidor, para que no dependa del cliente.
 *
 * Mismo criterio que el veredicto de comprobantes: tolerancia 0 sobre pesos
 * redondeados (receipt-verdict.ts, «Monto distinto al esperado»). Solo bloquea
 * por MENOS: un comprobante de más ya lo avisa la pantalla y no deja horas sin pagar.
 * Sin horas, sin transferencia o sin monto leído por el OCR: no hace nada.
 */
import { CobrosError } from './charge-batches.service';
import type { ChargeBatchRequest } from './charge-batches.schemas';
import { lineaDeHoras } from './hour-bank-extra.service';

/** Lo que la operación registra como pagado: pagos de las líneas nuevas + de los pendientes marcados. */
export function totalAPagar(b: Pick<ChargeBatchRequest, 'lines' | 'pending'>): number {
    const lineas = b.lines.reduce((s, l) => s + (l.pay_amount ?? 0), 0);
    const pendientes = b.pending.reduce((s, p) => s + (p.pay_amount ?? 0), 0);
    return Math.round(lineas) + Math.round(pendientes);
}

export function verificarComprobanteConHoras(b: Pick<ChargeBatchRequest, 'lines' | 'pending' | 'payment'>): void {
    if (!lineaDeHoras(b)) return;
    const pago = b.payment;
    if (!pago || pago.method !== 'transfer' || !pago.receipt_url) return;
    const leido = Number((pago.ocr as Record<string, unknown> | undefined)?.ocr_amount);
    if (!Number.isFinite(leido) || leido <= 0) return;

    const total = totalAPagar(b);
    if (Math.round(leido) >= total) return;

    throw new CobrosError(
        422,
        'COMPROBANTE_MENOR_AL_TOTAL',
        'El comprobante cubre menos de lo que se registra con las horas adicionales. Separa las horas en otra operación o corrige los montos.',
        { comprobante: Math.round(leido), total },
    );
}
