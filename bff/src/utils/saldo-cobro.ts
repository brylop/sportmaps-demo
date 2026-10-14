/**
 * Saldo por cobrar de un cobro: lo que falta pagar HOY.
 *
 *   saldo = amount − amount_paid − early_payment_discount_applied
 *
 * Misma regla que frontend/src/lib/cobrosYPagos.ts (§6.5). `amount` ya trae la
 * mora sumada por `apply_late_fees()` (2026-10-14), así que el saldo también.
 * Un cobro 'partial' (p. ej. pagado en línea con un link de antes de la mora:
 * el webhook lo deja parcial con `amount_paid`) se cobra por este saldo, y el
 * recargo en línea se calcula sobre él. Nunca negativo. Pura.
 */
export function saldoPorCobrar(p: {
    amount?: number | string | null;
    amount_paid?: number | string | null;
    early_payment_discount_applied?: number | string | null;
}): number {
    const n = (v: unknown) => {
        const x = Number(v ?? 0);
        return Number.isFinite(x) ? x : 0;
    };
    return Math.max(n(p.amount) - n(p.amount_paid) - n(p.early_payment_discount_applied), 0);
}

/** Estados en que un cobro se puede pagar en línea (create-session y /p/:token). */
export const ESTADOS_PAGABLES_EN_LINEA = ['pending', 'overdue', 'partial'];
