/**
 * saldo-cobro — lo que falta por pagar de un cobro. Una sola regla para el
 * enlace /p/:token, el estado de cuenta y los recordatorios, la misma del modal
 * de cobros (frontend/src/lib/cobrosYPagos.ts):
 *
 *   saldo = amount - amount_paid - early_payment_discount_applied   (nunca negativo)
 *
 * La mora ya está dentro de `amount` (apply_late_fees la suma ahí), así que el
 * saldo la incluye. Un abono por debajo del total deja el cobro en 'partial'
 * con amount_paid: se cobra solo lo que falta.
 *
 * Puro y sin dependencias: vive en utils para que quien lo use no arrastre
 * cobro-enlace-publico (y los tests que moquean ese módulo no lo pierdan).
 */
export function saldoDelCobro(p: {
    amount?: number | string | null;
    amount_paid?: number | string | null;
    early_payment_discount_applied?: number | string | null;
}): number {
    const total = Number(p.amount) || 0;
    const pagado = Number(p.amount_paid) || 0;
    const pronto = Number(p.early_payment_discount_applied) || 0;
    return Math.max(total - pagado - pronto, 0);
}
