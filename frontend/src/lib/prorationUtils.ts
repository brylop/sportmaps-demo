/**
 * Utilidades de cálculo de pagos según ciclo de facturación.
 * billing_cycle_type:
 *   'prorated'        — proporcional desde start_date hasta fin del mes de entrada
 *   'fixed_calendar'  — mes completo del mes de entrada
 *   'rolling_30'      — 30 días desde start_date, sin cutoff
 *
 * ESPEJO de bff/src/utils/prorationUtils.ts. Acá el cálculo es solo PREVIEW (el
 * panel "así quedará el cobro" en los modales de alta); el cobro real lo inserta
 * el BFF. Si los dos difieren, la pantalla miente sobre lo que se va a cobrar.
 *
 * El periodo es el MES DE ENTRADA, no el siguiente — ver el encabezado del BFF
 * para el porqué y el tamaño del daño que causó lo anterior.
 */

export type BillingCycleType = 'prorated' | 'fixed_calendar' | 'rolling_30';

export interface PaymentCalc {
  amount: number;       // monto del primer cobro
  dueDate: string;      // YYYY-MM-DD
  isFullMonth: boolean;
  description: string;  // texto legible del cálculo
  periodYear: number;   // mes que CUBRE el cobro
  periodMonth: number;  // 1-12
  remainingDays?: number;
  totalDaysInMonth?: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

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

  // El periodo es siempre el mes del alta, en los tres ciclos.
  const period = { periodYear: year, periodMonth: month + 1 };

  /**
   * Vencimiento DENTRO del mes de entrada: el corte, o el día del alta si el corte
   * ya pasó (un cobro no puede nacer vencido).
   */
  const dueInEntryMonth = (): string => {
    const target = Math.max(Math.min(cutoffDay, getDaysInMonth(year, month)), day);
    return `${year}-${pad2(month + 1)}-${pad2(target)}`;
  };

  switch (cycleType) {
    case 'prorated': {
      const daysInMonth   = getDaysInMonth(year, month);
      const remainingDays = daysInMonth - day + 1;
      const isFullMonth   = day === 1;
      const amount = isFullMonth
        ? monthlyFee
        : Math.round((remainingDays / daysInMonth) * monthlyFee);

      const dueDate = dueInEntryMonth();

      return {
        amount,
        dueDate,
        isFullMonth,
        ...period,
        remainingDays,
        totalDaysInMonth: daysInMonth,
        description: isFullMonth
          ? `Mes completo (inscripción día 1)`
          : `${remainingDays} de ${daysInMonth} días = ${formatCOP(amount)}`,
      };
    }

    case 'fixed_calendar': {
      const dueDate = dueInEntryMonth();
      // El día sale del dueDate ya calculado, no de cutoffDay: este texto termina
      // dentro del `concept` del cobro y con alta posterior al corte mentía.
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
      const base = lastDueDate
        ? new Date(lastDueDate + 'T12:00:00')
        : date;
      const due = new Date(base);
      due.setDate(due.getDate() + 30);
      // Fecha local, no toISOString(): en tz al este de UTC el corrimiento a UTC
      // devolvía el día anterior.
      const dueDate = `${due.getFullYear()}-${pad2(due.getMonth() + 1)}-${pad2(due.getDate())}`;

      return {
        amount: monthlyFee,
        dueDate,
        isFullMonth: true,
        ...period,
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
