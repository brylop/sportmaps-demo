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
  remainingDays?: number;
  totalDaysInMonth?: number;
}

// Removiendo calcProration duplicado arriba

export function calcFirstPayment(
  startDate: string,
  monthlyFee: number,
  cycleType: BillingCycleType,
  cutoffDay: number = 10,
  lastDueDate?: string | null,
): PaymentCalc {
  const date = new Date(startDate + 'T12:00:00');
  const day   = date.getDate();
  const month = date.getMonth();
  const year  = date.getFullYear();

  // Helper para calcular fin de mes
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  switch (cycleType) {
    case 'prorated': {
      const daysInMonth   = getDaysInMonth(year, month);
      const remainingDays = daysInMonth - day + 1;
      const isFullMonth   = day === 1;
      const amount = isFullMonth
        ? monthlyFee
        : Math.round((remainingDays / daysInMonth) * monthlyFee);

      // Vence en el cutoff_day del mes siguiente
      const nextMonth = new Date(year, month + 1, cutoffDay);
      const dueDate = nextMonth.toISOString().split('T')[0];

      return {
        amount,
        dueDate,
        isFullMonth,
        remainingDays,
        totalDaysInMonth: daysInMonth,
        description: isFullMonth
          ? `Mes completo (inscripción día 1)`
          : `${remainingDays} de ${daysInMonth} días = ${formatCOP(amount)}`,
      };
    }

    case 'fixed_calendar': {
      const nextMonth = new Date(year, month + 1, cutoffDay);
      const dueDate = nextMonth.toISOString().split('T')[0];

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
        description: `Mensualidad completa, vence día ${cutoffDay}`,
      };
    }

    case 'rolling_30': {
      const base = lastDueDate
        ? new Date(lastDueDate + 'T12:00:00')
        : date;
      const due = new Date(base);
      due.setDate(due.getDate() + 30);
      const dueDate = due.toISOString().split('T')[0];

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
        description: `Ciclo 30 días — vence ${due.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`,
      };
    }
  }
}

/**
 * @deprecated Usa calcFirstPayment con 'prorated' y cutoffDay.
 */
export function calcProration(date: Date, monthlyFee: number, cutoffDay: number = 10) {
  const result = calcFirstPayment(
    date.toISOString().split('T')[0],
    monthlyFee,
    'prorated',
    cutoffDay
  );

  return { 
    proratedFee: result.amount, 
    remainingDays: result.remainingDays || 0, 
    daysInMonth: result.totalDaysInMonth || 30, 
    isFullMonth: result.isFullMonth, 
    dueDate: new Date(result.dueDate + 'T12:00:00') 
  };
}

export function applyDiscount(amount: number, discountPct: number): number {
  if (!discountPct || discountPct <= 0 || discountPct > 100) return amount;
  return Math.round(amount * (1 - discountPct / 100));
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}
