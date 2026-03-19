/**
 * Utilidades de cálculo de pagos según ciclo de facturación.
 * billing_cycle_type:
 *   'prorated'        — proporcional desde start_date hasta cutoff_day
 *   'fixed_calendar'  — mes completo, vence en cutoff_day del mes siguiente
 *   'rolling_30'      — 30 días desde start_date, sin cutoff
 */

export type BillingCycleType = 'prorated' | 'fixed_calendar' | 'rolling_30';

export interface PaymentCalc {
  amount: number;       // monto del primer cobro
  dueDate: string;      // YYYY-MM-DD
  isFullMonth: boolean;
  description: string;  // texto legible del cálculo
}

/**
 * Helper legacy para componentes que necesitan detalles de días (modals).
 */
export function calcProration(date: Date, monthlyFee: number) {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = daysInMonth - day + 1;
  const isFullMonth = day === 1;
  const proratedFee = isFullMonth
    ? monthlyFee
    : Math.round((remainingDays / daysInMonth) * monthlyFee);

  // Vence por defecto el 10 del mes siguiente
  const dueMonth = month + 1 > 11 ? 0 : month + 1;
  const dueYear = month + 1 > 11 ? year + 1 : year;
  const dueDate = new Date(dueYear, dueMonth, 10);

  return { proratedFee, remainingDays, daysInMonth, isFullMonth, dueDate };
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

  switch (cycleType) {

    case 'prorated': {
      // Proporcional: días desde start_date hasta fin de mes / días del mes
      const daysInMonth   = new Date(year, month + 1, 0).getDate();
      const remainingDays = daysInMonth - day + 1;
      const isFullMonth   = day === 1;
      const amount = isFullMonth
        ? monthlyFee
        : Math.round((remainingDays / daysInMonth) * monthlyFee);

      // Vence en el cutoff_day del mes siguiente
      const dueMonth = month + 1 > 11 ? 0 : month + 1;
      const dueYear  = month + 1 > 11 ? year + 1 : year;
      const dueDate  = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(cutoffDay).padStart(2, '0')}`;

      return {
        amount,
        dueDate,
        isFullMonth,
        description: isFullMonth
          ? `Mes completo (inscripción día 1)`
          : `${remainingDays} de ${daysInMonth} días = ${formatCOP(amount)}`,
      };
    }

    case 'fixed_calendar': {
      // Mes completo siempre, vence en cutoff_day del mes siguiente
      const dueMonth = month + 1 > 11 ? 0 : month + 1;
      const dueYear  = month + 1 > 11 ? year + 1 : year;
      const dueDate  = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(cutoffDay).padStart(2, '0')}`;

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
        description: `Mensualidad completa, vence día ${cutoffDay}`,
      };
    }

    case 'rolling_30': {
      // 30 días exactos desde start_date
      const due = new Date(date);
      due.setDate(due.getDate() + 30);
      const dueDate = due.toISOString().split('T')[0];

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
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
