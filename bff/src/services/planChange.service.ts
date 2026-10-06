import { supabase } from '../config/supabase';
import { addDaysToDateString, todayInZone } from '../utils/businessDate';
import { AthleteCol, createPendingPayment } from './enrollmentBilling';

/**
 * Cambio de plan en escuelas con banco de horas (Dreamers, Academia Superior).
 * Spec: docs/specs/dreamers-ciclo-cobro-1-al-5-y-bloqueo.md §3.1.
 *
 * Qué resuelve:
 *   - Las horas ya consumidas se trasladan al plan nuevo (el período vigente pasa
 *     a las horas del plan nuevo, lo consumido se conserva) — RPC
 *     apply_hour_bank_plan_change.
 *   - Si el atleta YA pagó el período, el admin decide: pago PARCIAL (diferencia
 *     entre el plan nuevo y lo pagado) o COMPLETO. Antes el cobro del plan nuevo
 *     chocaba con el índice uniq_payment_active_period_per_child y createPendingPayment
 *     lo absorbía en silencio (23505): el cambio de plan después de pagar no emitía
 *     ningún cobro. Los cobros de este flujo van con period_uniqueness_exempt.
 *
 * Escuelas sin banco de horas: `applies: false`, se conserva el comportamiento de
 * siempre.
 */

export type PlanChangeChargeMode = 'partial' | 'full';
export type PlanChangeScenario = 'sin_pago' | 'pago_con_horas' | 'horas_agotadas' | 'cierre_de_periodo';

export interface PlanChangePreview {
    applies: boolean;
    reason?: string;
    current_plan?: { id: string; name: string; price: number };
    new_plan?: { id: string; name: string; price: number; included_minutes: number | null };
    paid_in_period: number;
    consumed_minutes: number;
    included_minutes: number | null;
    remaining_minutes: number | null;
    days_left: number;
    partial_amount: number;
    full_amount: number;
    needs_choice: boolean;
    scenario: PlanChangeScenario;
    recommended: PlanChangeChargeMode | 'wait' | null;
    message: string;
}

/** Quedan pocos días del período… */
export const NEAR_END_DAYS = 5;

const formatCOP = (n: number): string =>
    '$' + Math.round(n).toLocaleString('es-CO');

const formatHours = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = Math.abs(minutes % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
};

/**
 * Decisión pura (sin base de datos): escenario, recomendación y texto del aviso.
 * Reglas del owner (2026-10-05): sin pago del período, solo cambia y se cobra el
 * nuevo; con pago, decide el admin entre parcial (diferencia) y completo; si ya
 * gastó todas las horas y quedan días del período, se recomienda completo; si
 * está cerca del cierre y quedan pocas horas, se recomienda esperar al día 1.
 */
export function buildPlanChangeAdvice(input: {
    paid: number;
    newPrice: number;
    consumed: number;
    included: number | null;
    daysLeft: number;
    currentPlanName: string;
    newPlanName: string;
}): Pick<PlanChangePreview, 'scenario' | 'recommended' | 'needs_choice' | 'partial_amount' | 'full_amount' | 'message'> {
    const { paid, newPrice, consumed, included, daysLeft, currentPlanName, newPlanName } = input;
    const partial = Math.max(Math.round(newPrice - paid), 0);
    const full = Math.round(newPrice);

    if (paid <= 0) {
        return {
            scenario: 'sin_pago',
            recommended: null,
            needs_choice: false,
            partial_amount: partial,
            full_amount: full,
            message: `Este período aún no tiene pago registrado. Se cambia de ${currentPlanName} a ${newPlanName}, `
                + `se emite el cobro del plan nuevo (${formatCOP(full)}) y las horas ya usadas pasan al plan nuevo.`,
        };
    }

    const remaining = included === null ? null : included - consumed;
    const exhausted = remaining !== null && remaining <= 0;
    const nearEnd = daysLeft <= NEAR_END_DAYS
        && remaining !== null
        && remaining <= Math.max(120, Math.round((included ?? 0) * 0.25));

    const base = `Este usuario ya pagó ${formatCOP(paid)} en el período. `
        + `Para pasar a ${newPlanName} (${formatCOP(newPrice)}) puede generarse un pago parcial de ${formatCOP(partial)} `
        + `(la diferencia) o un pago completo de ${formatCOP(full)}. Las horas ya usadas pasan al plan nuevo.`;

    if (exhausted && daysLeft > 0) {
        return {
            scenario: 'horas_agotadas',
            recommended: 'full',
            needs_choice: true,
            partial_amount: partial,
            full_amount: full,
            message: `${base} Ya gastó todas las horas de su plan y aún le quedan ${daysLeft} día(s) del período: se recomienda el pago completo.`,
        };
    }

    if (nearEnd) {
        return {
            scenario: 'cierre_de_periodo',
            recommended: 'wait',
            needs_choice: true,
            partial_amount: partial,
            full_amount: full,
            message: `${base} Faltan ${daysLeft} día(s) para que termine el período y le quedan ${formatHours(remaining as number)}: `
                + 'conviene dejar que use sus horas y hacer el cambio el día 1 (el cobro del mes ya saldrá con el plan nuevo).',
        };
    }

    return {
        scenario: 'pago_con_horas',
        recommended: 'partial',
        needs_choice: true,
        partial_amount: partial,
        full_amount: full,
        message: base,
    };
}

const lastDayOfMonth = (ymd: string): string => {
    const [y, m] = ymd.split('-').map(Number);
    const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const daysBetween = (fromYmd: string, toYmd: string): number =>
    Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86400000);

interface PeriodWindow {
    start: string;
    end: string;
    periodId: string | null;
    included: number | null;
    consumed: number;
}

/** Período vigente del banco de horas, SIN abrirlo (el preview no escribe). */
async function currentPeriodWindow(
    enrollmentId: string,
    cycle: string,
    startDate: string | null,
    oldIncluded: number | null,
    today: string,
): Promise<PeriodWindow> {
    const { data: row } = await supabase
        .from('hour_bank_periods')
        .select('id, period_start, period_end, included_minutes, consumed_minutes')
        .eq('enrollment_id', enrollmentId)
        .lte('period_start', today)
        .gte('period_end', today)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (row) {
        return {
            start: (row as any).period_start,
            end: (row as any).period_end,
            periodId: (row as any).id,
            included: (row as any).included_minutes,
            consumed: Number((row as any).consumed_minutes ?? 0),
        };
    }

    // Aún no se abrió: misma fórmula que get_or_open_hour_bank_period.
    if (cycle === 'rolling_30' && startDate) {
        const elapsed = Math.max(0, daysBetween(startDate, today));
        const start = addDaysToDateString(startDate, 30 * Math.floor(elapsed / 30));
        return { start, end: addDaysToDateString(start, 29), periodId: null, included: oldIncluded, consumed: 0 };
    }
    return {
        start: `${today.slice(0, 7)}-01`,
        end: lastDayOfMonth(today),
        periodId: null,
        included: oldIncluded,
        consumed: 0,
    };
}

/** Lo pagado por el atleta para el período vigente. */
async function paidInPeriod(opts: {
    schoolId: string;
    athleteCol: AthleteCol;
    athleteId: string;
    cycle: string;
    periodStart: string;
    periodEnd: string;
    today: string;
}): Promise<number> {
    let q = supabase
        .from('payments')
        .select('amount, amount_paid, status, due_date, period_year, period_month')
        .eq('school_id', opts.schoolId)
        .eq(opts.athleteCol, opts.athleteId)
        .in('status', ['paid', 'partial']);

    if (opts.cycle === 'rolling_30') {
        // Ciclo de 30 días: los cobros no están alineados al mes. Aproximación:
        // lo pagado con vencimiento dentro del período vigente (con 15 días de
        // holgura hacia atrás, por el corte). El admin ve el monto en el aviso.
        q = q.gte('due_date', addDaysToDateString(opts.periodStart, -15)).lte('due_date', opts.periodEnd);
    } else {
        const [y, m] = opts.today.split('-').map(Number);
        q = q.eq('period_year', y).eq('period_month', m);
    }

    const { data } = await q;
    return (data ?? []).reduce((sum: number, p: any) => {
        const v = p.status === 'partial' ? Number(p.amount_paid ?? 0) : Number(p.amount_paid ?? p.amount ?? 0);
        return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
}

export async function previewPlanChange(opts: {
    schoolId: string;
    athleteCol: AthleteCol;
    athleteId: string;
    newPlanId: string;
}): Promise<PlanChangePreview> {
    const empty = (reason: string): PlanChangePreview => ({
        applies: false, reason, paid_in_period: 0, consumed_minutes: 0, included_minutes: null,
        remaining_minutes: null, days_left: 0, partial_amount: 0, full_amount: 0, needs_choice: false,
        scenario: 'sin_pago', recommended: null, message: '',
    });

    const { data: settings } = await supabase
        .from('school_settings')
        .select('hours_plan_enabled, billing_cycle_type')
        .eq('school_id', opts.schoolId)
        .maybeSingle();
    if (!(settings as any)?.hours_plan_enabled) return empty('escuela_sin_banco_de_horas');

    const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id, offering_plan_id, start_date')
        .eq('school_id', opts.schoolId)
        .eq(opts.athleteCol, opts.athleteId)
        .eq('status', 'active')
        .not('offering_plan_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (!enrollment) return empty('sin_plan_actual');
    if ((enrollment as any).offering_plan_id === opts.newPlanId) return empty('mismo_plan');

    const { data: plans } = await supabase
        .from('offering_plans')
        .select('id, name, price, included_minutes_per_period')
        .eq('school_id', opts.schoolId)
        .in('id', [(enrollment as any).offering_plan_id, opts.newPlanId]);
    const oldPlan: any = (plans ?? []).find((p: any) => p.id === (enrollment as any).offering_plan_id);
    const newPlan: any = (plans ?? []).find((p: any) => p.id === opts.newPlanId);
    if (!oldPlan || !newPlan) return empty('plan_no_encontrado');

    const cycle = (settings as any).billing_cycle_type || 'fixed_calendar';
    const today = todayInZone();
    const window = await currentPeriodWindow(
        (enrollment as any).id, cycle, (enrollment as any).start_date ?? null,
        oldPlan.included_minutes_per_period ?? null, today,
    );
    const paid = await paidInPeriod({
        schoolId: opts.schoolId, athleteCol: opts.athleteCol, athleteId: opts.athleteId,
        cycle, periodStart: window.start, periodEnd: window.end, today,
    });
    const daysLeft = Math.max(daysBetween(today, window.end), 0);
    const newPrice = Number(newPlan.price ?? 0);

    const advice = buildPlanChangeAdvice({
        paid, newPrice, consumed: window.consumed, included: window.included,
        daysLeft, currentPlanName: oldPlan.name, newPlanName: newPlan.name,
    });

    return {
        applies: true,
        current_plan: { id: oldPlan.id, name: oldPlan.name, price: Number(oldPlan.price ?? 0) },
        new_plan: {
            id: newPlan.id, name: newPlan.name, price: newPrice,
            included_minutes: newPlan.included_minutes_per_period ?? null,
        },
        paid_in_period: paid,
        consumed_minutes: window.consumed,
        included_minutes: window.included,
        remaining_minutes: window.included === null ? null : window.included - window.consumed,
        days_left: daysLeft,
        ...advice,
    };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Efectos del cambio de plan que dependen del banco de horas. Se llama DESPUÉS de
 * actualizar la inscripción (y de anular los cobros pendientes del plan viejo).
 *
 * `handledCharge` = true → este servicio ya emitió el cobro (o decidió que no hay
 * que emitirlo): el caller NO debe emitir el cobro completo habitual.
 */
export async function applyPlanChangeEffects(opts: {
    schoolId: string;
    athleteCol: AthleteCol;
    athleteId: string;
    enrollmentId: string;
    newPlanId: string;
    chargeMode?: PlanChangeChargeMode;
    preview?: PlanChangePreview;
}): Promise<{
    applies: boolean;
    handledCharge: boolean;
    charge: { mode: PlanChangeChargeMode; amount: number } | null;
    hours: any | null;
}> {
    const preview = opts.preview;
    if (!preview || !preview.applies || !preview.new_plan) {
        return { applies: false, handledCharge: false, charge: null, hours: null };
    }

    // 1. Horas: el período vigente toma las horas del plan nuevo, lo consumido se conserva.
    let hours: any = null;
    const { data: hoursData, error: hoursError } = await supabase
        .rpc('apply_hour_bank_plan_change', { p_enrollment_id: opts.enrollmentId });
    if (hoursError) {
        console.error('[planChange] apply_hour_bank_plan_change falló:', hoursError.message);
    } else {
        hours = hoursData;
    }

    // 2. Cobro: sin pago del período no hay nada que decidir (lo emite el caller).
    if (!preview.needs_choice) {
        return { applies: true, handledCharge: false, charge: null, hours };
    }

    const mode: PlanChangeChargeMode = opts.chargeMode ?? 'full';
    const amount = mode === 'partial' ? preview.partial_amount : preview.full_amount;
    const today = todayInZone();
    const [y, m] = today.split('-').map(Number);
    const periodo = `${MESES[m - 1]}/${y}`;
    const planName = preview.new_plan.name;
    const oldName = preview.current_plan?.name ?? 'plan anterior';

    await createPendingPayment({
        schoolId: opts.schoolId,
        athleteCol: opts.athleteCol,
        athleteId: opts.athleteId,
        // El parcial no lleva plan: el período ya fue comprado con el plan anterior y
        // fn_extend_enrollment_on_payment_paid no debe volver a correr la vigencia.
        planId: mode === 'full' ? opts.newPlanId : null,
        amount,
        concept: mode === 'partial'
            ? `Diferencia de plan ${oldName} → ${planName} - ${periodo}`
            : `Plan ${planName} (cambio de plan) - ${periodo}`,
        startDate: today,
        periodUniquenessExempt: true,
    });

    return { applies: true, handledCharge: true, charge: amount > 0 ? { mode, amount } : null, hours };
}
