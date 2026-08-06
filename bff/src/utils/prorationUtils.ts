/**
 * Utilidades de cálculo de pagos según ciclo de facturación.
 * billing_cycle_type:
 *   'prorated'        — proporcional desde start_date hasta fin del mes de entrada
 *   'fixed_calendar'  — mes completo del mes de entrada
 *   'rolling_30'      — 30 días desde start_date, sin cutoff
 *
 * EL PERIODO ES EL MES DE ENTRADA, NO EL SIGUIENTE.
 *
 * Antes el vencimiento salía en el corte del mes SIGUIENTE y estos inserts no
 * poblaban `period_year/period_month`, así que el trigger `trg_payments_fill_period`
 * lo derivaba del `due_date`: un atleta inscrito el 1 de agosto quedaba con un cobro
 * de SEPTIEMBRE y su agosto no se facturaba nunca. Medido en Dynasty el 2026-08-04:
 * 12 atletas y $1.730.000 aparcados en septiembre, todos "al día" en agosto sin tener
 * cobro. Ahora el periodo se calcula acá y los callers lo persisten explícitamente,
 * sin depender del trigger.
 *
 * `due_date` y el periodo son cosas distintas: que venza el 10 no dice qué mes cubre.
 */

export type BillingCycleType = 'prorated' | 'fixed_calendar' | 'rolling_30';

export interface PaymentCalc {
  amount: number;       // monto del primer cobro
  dueDate: string;      // YYYY-MM-DD
  isFullMonth: boolean;
  description: string;  // texto legible del cálculo
  periodYear: number;   // mes que CUBRE el cobro
  periodMonth: number;  // 1-12
}

const pad = (n: number) => String(n).padStart(2, '0');

const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

/**
 * Vencimiento DENTRO del mes de entrada: el día de corte, o el día del alta si el
 * corte ya pasó. Un cobro no puede nacer vencido — con alta el 20 y corte 10, un
 * `due_date` del 10 lo dejaría en mora desde el primer día y el motor de mora le
 * cargaría recargo por un atraso que no existió.
 */
function dueInEntryMonth(year: number, month0: number, day: number, cutoffDay: number): string {
  const target = Math.max(Math.min(cutoffDay, daysInMonth(year, month0)), day);
  return `${year}-${pad(month0 + 1)}-${pad(target)}`;
}

export function calcFirstPayment(
  startDate: string,
  monthlyFee: number,
  cycleType: BillingCycleType,
  cutoffDay: number = 10
): PaymentCalc {
  const date = new Date(startDate + 'T12:00:00');
  const day   = date.getDate();
  const month = date.getMonth();
  const year  = date.getFullYear();

  // El periodo es siempre el mes del alta, en los tres ciclos.
  const period = { periodYear: year, periodMonth: month + 1 };

  switch (cycleType) {

    case 'prorated': {
      // Proporcional: días desde start_date hasta fin de mes / días del mes
      const totalDays     = daysInMonth(year, month);
      const remainingDays = totalDays - day + 1;
      const isFullMonth   = day === 1;
      const amount = isFullMonth
        ? monthlyFee
        : Math.round((remainingDays / totalDays) * monthlyFee);

      const dueDate = dueInEntryMonth(year, month, day, cutoffDay);

      return {
        amount,
        dueDate,
        isFullMonth,
        ...period,
        description: isFullMonth
          ? `Mes completo (inscripción día 1)`
          : `${remainingDays} de ${totalDays} días = ${formatCOP(amount)}`,
      };
    }

    case 'fixed_calendar': {
      const dueDate = dueInEntryMonth(year, month, day, cutoffDay);
      // El día sale del dueDate ya calculado, no de cutoffDay: este texto termina
      // dentro del `concept` del cobro, y con alta después del corte decía
      // "vence día 10" sobre un cobro que vencía el 20.
      const dueDay = Number(dueDate.slice(-2));

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
        ...period,
        description: `Mensualidad completa, vence día ${dueDay}`,
      };
    }

    case 'rolling_30': {
      // 30 días exactos desde start_date
      const due = new Date(date);
      due.setDate(due.getDate() + 30);
      const dueDate = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
        ...period,
        description: `Ciclo 30 días: ${startDate} → ${dueDate}`,
      };
    }
  }
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}
