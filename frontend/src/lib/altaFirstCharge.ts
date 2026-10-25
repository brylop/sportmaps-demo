/**
 * «Primer cobro» del formulario de alta (CreateChildModal / CreateAdultAthleteModal).
 *
 * ESPEJO de lo que inserta el BFF en POST /api/v1/students/create-one:
 *   · Mensualidad: buildAltaPayments (bff/src/routes/students-create-one.route.ts)
 *     → sin fila si la cuota es < $10.000; el descuento del primer mes se aplica
 *     a la cuota ANTES del prorrateo; período y vencimiento de calcFirstPayment
 *     (vence dentro del mes de entrada: el día de corte, o el día del alta si el
 *     corte ya pasó; rolling_30 = alta + 30 días).
 *   · Inscripción y seguro: emit_enrollment_fees, con vencimiento
 *     enrollmentFeeDueDate = el día del alta (o hoy, si el alta es en el pasado).
 *     El seguro no se repite si el atleta ya tiene uno de los últimos 12 meses.
 *   · Exoneración por alta («No cobrar inscripción / seguro»): esa fila no se crea.
 *
 * Si este cálculo y el del BFF difieren, la pantalla miente sobre lo que se cobra.
 */
import { calcFirstPayment, BillingCycleType } from '@/lib/prorationUtils';

/** Igual que buildAltaPayments: por debajo de esto no se crea la mensualidad. */
export const MIN_MONTHLY_FEE = 10000;

export type OneTimeFeeStatus =
  | 'none'       // el plan no tiene este pago único
  | 'charged'    // se cobra en el alta
  | 'waived'     // la escuela marcó «No cobrar»
  | 'active';    // seguro: ya tiene uno vigente (12 meses), no se repite

export interface OneTimeFeeLine {
  /** Valor configurado en el plan (0 = el plan no lo tiene). */
  amount: number;
  /** Lo que de verdad se cobra (0 si exonerado, vigente o sin valor). */
  charged: number;
  status: OneTimeFeeStatus;
}

export interface MonthlyLine {
  /** Monto sin descuento (para tacharlo cuando hay descuento). */
  listAmount: number;
  /** Monto que se cobra. */
  amount: number;
  dueDate: string;
  isFullMonth: boolean;
  remainingDays?: number;
  totalDaysInMonth?: number;
}

export interface AltaFirstChargeInput {
  startDate: string;
  /** Hoy en Colombia (YYYY-MM-DD). */
  today: string;
  monthlyFee: number;
  cycleType: BillingCycleType;
  cutoffDay: number;
  /**
   * Escuela con «primer cobro sin recargo» (late_fee_skip_signup_month): el trigger
   * fn_payments_primer_cobro_vence_prox_corte mueve el vencimiento del primer cobro
   * al día de corte del mes SIGUIENTE al período (solo si vencía dentro del período).
   */
  firstChargeNextCutoff?: boolean;
  discountPct?: number;
  registrationFee?: number | null;
  insuranceFee?: number | null;
  waiveRegistration?: boolean;
  waiveInsurance?: boolean;
  /** Fecha del seguro vigente del atleta (últimos 12 meses), si tiene. */
  insuranceActiveSince?: string | null;
}

export interface AltaFirstCharge {
  monthly: MonthlyLine | null;
  registration: OneTimeFeeLine;
  insurance: OneTimeFeeLine;
  /** Vencimiento de la inscripción y el seguro. */
  feesDueDate: string;
  /** Total del primer cobro: mensualidad + pagos únicos que sí se cobran. */
  total: number;
}

/** Mismo criterio que enrollmentFeeDueDate del BFF. */
export function altaFeesDueDate(startDate: string, today: string): string {
  return startDate > today ? startDate : today;
}

/** Espejo del trigger de la base: el primer cobro vence en el corte del mes siguiente al período. */
export function firstChargeDue(dueDate: string, periodYear: number, periodMonth: number, cutoffDay: number): string {
  const nextStart = new Date(Date.UTC(periodYear, periodMonth, 1)); // día 1 del mes siguiente
  const nextStartStr = nextStart.toISOString().slice(0, 10);
  if (dueDate >= nextStartStr) return dueDate; // ya vence fuera de su período (p. ej. ciclo de 30 días)
  const daysNext = new Date(Date.UTC(periodYear, periodMonth + 1, 0)).getUTCDate();
  const day = Math.max(1, Math.min(cutoffDay || 5, daysNext));
  return `${nextStartStr.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

function feeLine(raw: number | null | undefined, waived: boolean, active = false): OneTimeFeeLine {
  const amount = Number(raw) > 0 ? Number(raw) : 0;
  if (amount <= 0) return { amount: 0, charged: 0, status: 'none' };
  if (active) return { amount, charged: 0, status: 'active' };
  if (waived) return { amount, charged: 0, status: 'waived' };
  return { amount, charged: amount, status: 'charged' };
}

export function computeAltaFirstCharge(i: AltaFirstChargeInput): AltaFirstCharge {
  let monthly: MonthlyLine | null = null;
  if (i.startDate && i.monthlyFee >= MIN_MONTHLY_FEE) {
    const pct = i.discountPct && i.discountPct > 0 ? Math.min(100, i.discountPct) : 0;
    const effectiveFee = pct ? Math.round(i.monthlyFee * (1 - pct / 100)) : i.monthlyFee;
    const list = calcFirstPayment(i.startDate, i.monthlyFee, i.cycleType, i.cutoffDay);
    const calc = pct ? calcFirstPayment(i.startDate, effectiveFee, i.cycleType, i.cutoffDay) : list;
    monthly = {
      listAmount: list.amount,
      amount: calc.amount,
      dueDate: i.firstChargeNextCutoff ? firstChargeDue(calc.dueDate, calc.periodYear, calc.periodMonth, i.cutoffDay) : calc.dueDate,
      isFullMonth: calc.isFullMonth,
      remainingDays: calc.remainingDays,
      totalDaysInMonth: calc.totalDaysInMonth,
    };
  }

  const registration = feeLine(i.registrationFee, !!i.waiveRegistration);
  const insurance = feeLine(i.insuranceFee, !!i.waiveInsurance, !!i.insuranceActiveSince);

  return {
    monthly,
    registration,
    insurance,
    feesDueDate: altaFeesDueDate(i.startDate, i.today),
    total: (monthly?.amount ?? 0) + registration.charged + insurance.charged,
  };
}
