import { todayColombia } from '@/lib/dateUtils';

/**
 * Estados que las secciones de Finanzas basadas en el fetch compartido de
 * `payments` usan de verdad: transacciones (paid/partial) y cartera
 * (pending/overdue). `cancelled` son cobros anulados por las limpiezas de
 * duplicados y no se muestran en ninguna de las dos tablas: traerlos solo
 * acerca el techo de FETCH_CAP.
 */
export const USED_STATUSES = ['paid', 'partial', 'pending', 'overdue'] as const;

/**
 * Tope explícito de la consulta compartida de `payments`. No es un filtro: es
 * el techo que PostgREST aplica igual (`max-rows` = 1000) aunque no se pida
 * nada. Pedirlo a la vista permite DARSE CUENTA de que se truncó, en vez de
 * perder plata en silencio — el mismo principio que F-01.
 */
export const FETCH_CAP = 1000;

/** Lo mínimo que hay que saber de un cobro para clasificarlo como vencido o por vencer. */
export type ChargeState = {
  status: string;
  due_date: string;
  period_year?: number | null;
  period_month?: number | null;
};

/**
 * Un cobro de un mes que todavía no empieza NO está vencido, aunque su `due_date`
 * ya haya pasado. Salía "Mensualidad Septiembre 2026 · 2 días vencido" el 4 de
 * agosto, porque el QR estampaba el período de septiembre pero el vencimiento del
 * día en que se generó el cobro. Espejo del cinturón que lleva `apply_late_fees`
 * en la migración 20260804125644.
 */
export const isFuturePeriod = (p: ChargeState): boolean => {
  if (!p.period_year || !p.period_month) return false;
  const [y, m] = todayColombia().split('-').map(Number);
  return p.period_year * 12 + p.period_month > y * 12 + m;
};

export const isUnpaid = (p: ChargeState): boolean => p.status === 'pending' || p.status === 'overdue';

/** Vencido de verdad: impago, de un período ya empezado, y con el plazo cumplido. */
export const isOverdueCharge = (p: ChargeState): boolean =>
  isUnpaid(p) && !isFuturePeriod(p) && (p.status === 'overdue' || p.due_date < todayColombia());

/**
 * Impago que aún no vence. Incluye a propósito los `overdue` de período futuro:
 * si solo se los quitáramos de "vencido" sin recogerlos acá, esa plata
 * desaparecería de las dos tarjetas — el mismo fallo silencioso que F-01.
 */
export const isUpcomingCharge = (p: ChargeState): boolean => isUnpaid(p) && !isOverdueCharge(p);
