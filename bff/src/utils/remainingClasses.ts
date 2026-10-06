/**
 * Alta a mitad de mes por CLASES RESTANTES (F7 — D12/D14/D14b,
 * docs/specs/dreamers-niveles-por-horas-y-progresion.md §3.2).
 *
 * ÚNICO lugar de la fórmula. El frontend NO la replica: pide el preview a
 * POST /api/v1/students/first-payment-preview, que usa estas mismas funciones.
 *
 *   clases_del_periodo = included_minutes_per_period ÷ bloque   (si da entero)
 *                        bloque = plan.session_block_minutes ?? school_settings.hours_session_block_minutes
 *                      → si no da entero o faltan minutos: plan.max_sessions
 *                      → si tampoco hay: null = la opción NO se ofrece
 *
 *   parcial  = round(clases_restantes × precio ÷ clases_del_periodo)   (período = mes del alta)
 *   siguiente = precio completo                                         (período = mes siguiente)
 *
 * D14: siempre DOS filas, cada una con su período. D14b: el vencimiento del
 * parcial es hoy (default) o el 1 del mes siguiente — un override de due_date,
 * nunca un billing_cycle_type nuevo.
 */

export type ClassesSource = 'minutes' | 'max_sessions';

export interface PlanClassesInput {
    included_minutes_per_period?: number | null;
    session_block_minutes?: number | null;
    max_sessions?: number | null;
}

export interface ClassesPerPeriod {
    classes: number;
    source: ClassesSource;
}

const posInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

export function classesPerPeriod(
    plan: PlanClassesInput,
    schoolBlockMinutes: number | null | undefined,
): ClassesPerPeriod | null {
    const minutes = plan.included_minutes_per_period != null ? Number(plan.included_minutes_per_period) : null;
    const blockRaw = plan.session_block_minutes ?? schoolBlockMinutes ?? null;
    const block = blockRaw != null ? Number(blockRaw) : null;
    if (posInt(minutes) && posInt(block) && minutes % block === 0) {
        return { classes: minutes / block, source: 'minutes' };
    }
    const max = plan.max_sessions != null ? Number(plan.max_sessions) : null;
    if (posInt(max)) return { classes: max, source: 'max_sessions' };
    return null;
}

export type PartialDue = 'today' | 'next_month_first';

export interface RemainingClassesInput {
    /** Fecha del alta, YYYY-MM-DD: define el período del parcial. */
    startDate: string;
    /** Cuota mensual efectiva (antes del descuento del primer mes). */
    monthlyFee: number;
    classesRemaining: number;
    classesPerPeriod: number;
    /** school_settings.payment_cutoff_day (vencimiento del mes siguiente). */
    cutoffDay: number;
    partialDue?: PartialDue;
    /** Descuento del primer mes: SOLO afecta la fila parcial. */
    discountPct?: number;
    /** Hoy en la zona del negocio (YYYY-MM-DD); inyectado para poder probar. */
    today: string;
}

export interface RemainingClassesRow {
    kind: 'partial' | 'next_month';
    amount: number;
    dueDate: string;
    periodYear: number;
    periodMonth: number;
    description: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function nextMonthOf(year: number, month: number): { year: number; month: number } {
    return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export class RemainingClassesError extends Error {}

export function validateClassesRemaining(classesRemaining: number, perPeriod: number): void {
    if (!Number.isInteger(classesRemaining) || classesRemaining < 1 || classesRemaining >= perPeriod) {
        throw new RemainingClassesError(
            `Las clases restantes deben ser un entero entre 1 y ${perPeriod - 1} (el plan tiene ${perPeriod} por período).`,
        );
    }
}

export function calcRemainingClassesPayment(input: RemainingClassesInput): [RemainingClassesRow, RemainingClassesRow] {
    validateClassesRemaining(input.classesRemaining, input.classesPerPeriod);
    const [y, m] = input.startDate.split('-').map(Number);
    const next = nextMonthOf(y, m);

    const base = Math.round((input.classesRemaining * input.monthlyFee) / input.classesPerPeriod);
    const pct = input.discountPct && input.discountPct > 0 && input.discountPct <= 100 ? input.discountPct : 0;
    const partialAmount = pct ? Math.round(base * (1 - pct / 100)) : base;

    const firstOfNext = `${next.year}-${pad(next.month)}-01`;
    // Nunca nace vencido: si el alta se registró con fecha pasada, vence hoy.
    const altaDue = input.startDate > input.today ? input.startDate : input.today;
    const partialDue = input.partialDue === 'next_month_first' ? firstOfNext : altaDue;

    // Mismo vencimiento que open_month(): día de corte acotado al último día del mes.
    const nextDueDay = Math.min(Math.max(1, input.cutoffDay || 10), lastDay(next.year, next.month));
    const nextDue = `${next.year}-${pad(next.month)}-${pad(nextDueDay)}`;

    return [
        {
            kind: 'partial',
            amount: partialAmount,
            dueDate: partialDue,
            periodYear: y,
            periodMonth: m,
            description: `Clases restantes ${input.classesRemaining} de ${input.classesPerPeriod}`
                + (pct ? ` (Desc. ${pct}%)` : ''),
        },
        {
            kind: 'next_month',
            amount: input.monthlyFee,
            dueDate: nextDue,
            periodYear: next.year,
            periodMonth: next.month,
            description: `Mensualidad ${pad(next.month)}/${next.year}`,
        },
    ];
}

export interface EligibilityInput {
    flagEnabled: boolean;
    cycleType: string | null | undefined;
    plan: (PlanClassesInput & { duration_days?: number | null }) | null;
    schoolBlockMinutes: number | null | undefined;
}

export type EligibilityResult =
    | { eligible: true; classes: number; source: ClassesSource }
    | { eligible: false; reason: string; classes: number | null; source: ClassesSource | null };

/** ¿Se puede ofrecer «clases restantes» en esta alta? Mismo criterio para el preview y el alta real. */
export function remainingClassesEligibility(input: EligibilityInput): EligibilityResult {
    const no = (reason: string, cpp: ClassesPerPeriod | null = null): EligibilityResult =>
        ({ eligible: false, reason, classes: cpp?.classes ?? null, source: cpp?.source ?? null });
    if (!input.flagEnabled) return no('La escuela no tiene activado el cobro por clases restantes.');
    if (!input.plan) return no('El cobro por clases restantes requiere un plan.');
    if (input.cycleType === 'rolling_30') return no('El ciclo de 30 días no maneja meses calendario.');
    if ((input.plan.duration_days ?? 30) < 28) return no('El plan no es mensual.');
    const cpp = classesPerPeriod(input.plan, input.schoolBlockMinutes);
    if (!cpp) return no('El plan no define cuántas clases tiene por período.');
    if (cpp.classes < 2) return no('El plan tiene una sola clase por período.', cpp);
    return { eligible: true, classes: cpp.classes, source: cpp.source };
}
