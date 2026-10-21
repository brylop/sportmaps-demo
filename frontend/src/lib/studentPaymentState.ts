import { daysDiffFromToday } from '@/lib/dateUtils';

export type PaymentState = 'paid' | 'overdue' | 'pending' | 'none' | 'other';

/**
 * Estado de cobro de un atleta en la lista (badge y filtro usan la MISMA función, para que
 * nunca difieran).
 *
 * `graceDays` = `school_settings.payment_grace_days`. El motor de mora (`apply_late_fees`) solo
 * marca `overdue` cuando `due_date + gracia < hoy`; antes esta pantalla ignoraba la gracia y
 * pintaba «Vencido» desde el día siguiente al vencimiento, aunque el cobro seguía `pending` y
 * sin recargo (Dreamers 2026-10-21: Airi Gacharna, inscrita el 20-oct con la inscripción
 * vencida ese mismo día, aparecía «Vencido» el 21 con 5 días de gracia). La fuente autoritativa
 * sigue siendo `status = 'overdue'`; el cálculo local solo la anticipa, ahora con la misma gracia.
 */
/** Lo que se lee de una fila de `school_athletes`; la pantalla pasa la fila entera (con muchas más columnas). */
type ConEstadoDePago = { payment_status?: string | null; payment_due_date?: string | null };

export function getPaymentState(student: object, graceDays = 0): PaymentState {
  const { payment_status: ps, payment_due_date: due } = student as ConEstadoDePago;
  if (!ps) return 'none';
  // Estados terminales = no hay nada que cobrar, NO una categoría propia. La vista
  // school_athletes ya los excluye (mig 20260804125913); defensa en profundidad por si otra vía
  // los reintroduce (antes el contador «OTROS» saltaba de 1 a 6 al anular duplicados).
  if (ps === 'cancelled' || ps === 'rejected' || ps === 'failed') return 'none';
  if (ps === 'paid' || ps === 'approved') return 'paid';
  // `due` es un YYYY-MM-DD (columna date): daysDiffFromToday compara días de Colombia (nunca
  // `new Date(due)` contra el instante local, que marcaba vencido ~29 horas antes de tiempo).
  const gracia = Number.isFinite(graceDays) && graceDays > 0 ? Math.floor(graceDays) : 0;
  if (ps === 'overdue' || ((ps === 'pending' || ps === 'awaiting_approval') && due && daysDiffFromToday(due) > gracia)) {
    return 'overdue';
  }
  if (ps === 'pending' || ps === 'awaiting_approval') return 'pending';
  return 'other';
}
