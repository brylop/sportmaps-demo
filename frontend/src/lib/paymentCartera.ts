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

/** Un cobro con lo mínimo para calcular cuánto queda por cobrar de él. */
export type BalanceState = { status: string; amount: number | string; amount_paid?: number | string | null };

/**
 * Saldo real por cobrar. Un `partial` ya recibió `amount_paid`: lo que falta es
 * la diferencia, no el total del cobro — sumar `amount` entero ahí duplica lo
 * que ya entró. Para cualquier otro estado el saldo es el monto completo.
 */
export const remainingBalance = (p: BalanceState): number =>
  p.status === 'partial'
    ? Math.max(Number(p.amount) - Number(p.amount_paid ?? 0), 0)
    : Number(p.amount);

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

/**
 * `partial` cuenta como impago: por definición le queda saldo (si ya hubiera
 * cubierto todo, el estado sería `paid`). Sin esto, un abono con saldo vencido
 * desaparecía de las tres tarjetas de Finanzas y de la tabla de cartera — no
 * salía como ingreso (correcto, no se cobró todo) NI como vencido/pendiente
 * (incorrecto: esa plata sigue debida).
 */
export const isUnpaid = (p: ChargeState): boolean =>
  p.status === 'pending' || p.status === 'overdue' || p.status === 'partial';

/** Vencido de verdad: impago, de un período ya empezado, y con el plazo cumplido. */
export const isOverdueCharge = (p: ChargeState): boolean =>
  isUnpaid(p) && !isFuturePeriod(p) && (p.status === 'overdue' || p.due_date < todayColombia());

/**
 * Impago que aún no vence. Incluye a propósito los `overdue` de período futuro:
 * si solo se los quitáramos de "vencido" sin recogerlos acá, esa plata
 * desaparecería de las dos tarjetas — el mismo fallo silencioso que F-01.
 */
export const isUpcomingCharge = (p: ChargeState): boolean => isUnpaid(p) && !isOverdueCharge(p);

/** Un cobro abierto con lo mínimo para mostrarlo en la ficha del atleta. */
export type OpenChargeRow = BalanceState & {
  child_id?: string | null;
  user_id?: string | null;
  unregistered_athlete_id?: string | null;
  label: string;
};

export type AthleteOpenDebt = { total: number; items: { label: string; amount: number }[] };

/**
 * Saldo abierto por atleta (llave = child_id / user_id / unregistered_athlete_id,
 * la misma que `school_athletes.id`), con el detalle por cobro. TODOS los cobros
 * impagos cuentan: la inscripción y el seguro del alta son filas aparte de la
 * mensualidad, y una pantalla que solo mira la mensualidad los esconde.
 */
export function groupOpenDebtByAthlete(rows: OpenChargeRow[]): Map<string, AthleteOpenDebt> {
  const out = new Map<string, AthleteOpenDebt>();
  for (const r of rows) {
    if (!isUnpaid({ status: r.status, due_date: '' })) continue;
    const key = r.child_id || r.user_id || r.unregistered_athlete_id;
    if (!key) continue;
    const amount = remainingBalance(r);
    if (amount <= 0) continue;
    const acc = out.get(key) ?? { total: 0, items: [] };
    acc.total += amount;
    acc.items.push({ label: r.label, amount });
    out.set(key, acc);
  }
  return out;
}
