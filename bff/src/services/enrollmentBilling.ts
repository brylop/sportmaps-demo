import { supabase } from '../config/supabase';
import { addDaysToDateString, todayInZone } from '../utils/businessDate';

/**
 * Reglas compartidas de inscripción + cobro.
 *
 * Antes vivían duplicadas dentro de PUT /students/:id (closures del handler), así
 * que POST /enrollments asignaba planes SIN generar cobro y con otro criterio de
 * vencimiento. Resultado visible: el admin asignaba un plan desde el modal de
 * planes, la vista lo mostraba y no existía mensualidad. Una sola fuente.
 */

export type AthleteType = 'child' | 'adult' | 'unregistered';
export type AthleteCol = 'child_id' | 'user_id' | 'unregistered_athlete_id';

export const athleteColFor = (t: AthleteType): AthleteCol =>
    t === 'child' ? 'child_id' : t === 'adult' ? 'user_id' : 'unregistered_athlete_id';

/**
 * Corte y días de gracia de la escuela: la MISMA fuente que usa open_month() y
 * que el helper SQL `qr_first_charge_due_date` del flujo por QR.
 */
export async function getBillingConfig(schoolId: string): Promise<{ cutoff: number; grace: number }> {
    const { data } = await supabase
        .from('school_settings')
        .select('payment_cutoff_day, payment_grace_days')
        .eq('school_id', schoolId)
        .maybeSingle();
    return {
        cutoff: Number((data as any)?.payment_cutoff_day) || 10,
        // 0 explícito es válido: solo se cae al default cuando no hay fila/valor.
        grace: Number((data as any)?.payment_grace_days ?? 5),
    };
}


/**
 * Vencimiento canónico del cobro: día de corte de la escuela DENTRO DEL MES DE
 * ENTRADA, acotado al último día de ese mes y nunca antes del día del alta.
 *
 * Antes cada rama inventaba su propia fecha (start_date + 1 mes para equipo,
 * plan_start + 30 días para plan): cobros del MISMO mes con vencimientos
 * distintos y cada edición corriéndole la fecha al alumno.
 *
 * EL PERIODO ES EL MES DE ENTRADA. Antes esta función devolvía `mes + 1` a
 * propósito ("el alta no cobra el mes en curso") y eso resultó ser el error:
 * quien se inscribía y pagaba en agosto quedaba con un cobro de SEPTIEMBRE, su
 * agosto no se facturaba nunca y salía "al día" sin tener cobro. Medido en
 * Dynasty el 2026-08-04: 12 atletas y $1.730.000 aparcados en septiembre. El
 * desfase tampoco se autocorregía — `next_unpaid_period` seguía avanzando.
 *
 * `due_date` NO define el mes cubierto: el periodo se devuelve aparte y los
 * callers lo persisten, sin depender de `trg_payments_fill_period`.
 *
 * UN COBRO NUEVO NUNCA NACE VENCIDO. Acotar al día del alta no alcanzaba: solo
 * protege dentro del mes de entrada. Si el plan se asigna un mes DESPUÉS del
 * alta, el vencimiento calculado ya pasó y el cobro entra al mundo en mora, con
 * recargo y recordatorio de deuda por un cobro que ayer no existía. Medido en
 * Dynasty el 2026-08-12: 5 cobros nacidos con 9 a 31 días de atraso — Salomé
 * Montenegro nació con 27 (alta 6-jul, corte 10, cobro emitido el 6-ago).
 *
 * La deuda puede ser legítima (cursó el mes), así que el PERIODO no se toca:
 * sigue siendo el mes de entrada. Lo que se corrige es la fecha de pago: como
 * muy tarde pasa a ser hoy + los días de gracia de la escuela, la MISMA regla
 * que ya aplica el flujo por QR (`qr_first_charge_due_date` usa
 * `GREATEST(corte, hoy + payment_grace_days)`). Antes había dos criterios
 * distintos para la misma situación según la vía de alta.
 *
 * Esto NO aplica al registro manual de pagos viejos: esa vía escribe en
 * `payments` directamente y debe poder fechar hacia atrás a propósito.
 */
export async function billingDue(schoolId: string, startDate: string): Promise<{
    due_date: string;
    period_year: number;
    period_month: number;
}> {
    const { cutoff, grace } = await getBillingConfig(schoolId);
    const [y, m, d] = startDate.split('-').map(Number);
    // Día 0 del mes siguiente = último día del mes de entrada.
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // Nunca antes del día del alta: con alta el 20 y corte 10, un vencimiento el
    // 10 nace en mora y el motor de recargos le cobra un atraso que no existió.
    const day = Math.max(Math.min(cutoff, lastDay), d);
    const pad = (n: number) => String(n).padStart(2, '0');
    const calculado = `${y}-${pad(m)}-${pad(day)}`;
    // Solo se reemplaza si la fecha calculada YA PASÓ. Aplicar el piso siempre
    // correría también los vencimientos que ya eran correctos (un alta el 20 con
    // corte 10 vencía el 20 y pasaría al 25), y esto no viene a mover lo que
    // funciona: viene a que nada nazca vencido.
    //
    // Comparación lexicográfica: ambas son 'YYYY-MM-DD' en la zona del negocio,
    // no UTC (un alta de las 19:00 en Bogotá ya es del día siguiente en UTC, y
    // por ahí se colaba un corrimiento de un día).
    const hoy = todayInZone();
    return {
        due_date: calculado < hoy ? addDaysToDateString(hoy, grace) : calculado,
        period_year: y,
        period_month: m,
    };
}

export async function createPendingPayment(opts: {
    schoolId: string;
    athleteCol: AthleteCol;
    athleteId: string;
    teamId?: string | null;
    planId?: string | null;
    amount: number;
    concept: string;
    startDate: string;
}): Promise<void> {
    // El constraint payments_amount_positive exige amount > 0: si no hay cuota
    // configurada no se genera cobro (evita INSERT fallido silencioso).
    if (!opts.amount || opts.amount <= 0) return;

    const due = await billingDue(opts.schoolId, opts.startDate);
    const row: any = {
        school_id: opts.schoolId,
        amount: opts.amount,
        concept: opts.concept,
        // Vencimiento + período poblados: sin period_year/period_month los
        // índices uniq_payment_active_period_* son parciales y no aplican, así
        // que el cobro se escapaba del dedup y duplicaba el mes.
        due_date: due.due_date,
        period_year: due.period_year,
        period_month: due.period_month,
        status: 'pending',
        // payment_type solo admite 'one_time' | 'subscription' (constraint
        // payments_payment_type_check). 'monthly' rompía el INSERT.
        payment_type: 'one_time',
    };
    if (opts.teamId) row.team_id = opts.teamId;
    if (opts.planId) row.offering_plan_id = opts.planId;
    row[opts.athleteCol] = opts.athleteId;

    // QUIÉN PAGA. Sin esto el cobro nace sin pagador y el guard anti-IDOR de
    // create-session (payments.routes.ts) lo vuelve IMPAGABLE online: responde 403
    // "No tienes permiso para pagar este registro" al propio acudiente, porque compara
    // el caller contra [parent_id, user_id] y ambos están en NULL.
    //
    // Solo afectaba a menores: para un adulto, athleteCol ES 'user_id' y el pagador
    // queda seteado de paso. Para 'child_id' hay que resolver el acudiente del menor.
    if (opts.athleteCol === 'child_id') {
        const { data: child } = await supabase
            .from('children')
            .select('parent_id')
            .eq('id', opts.athleteId)
            .maybeSingle();
        const parentId = (child as any)?.parent_id;
        if (parentId) {
            row.parent_id = parentId;
        } else {
            // Menor sin acudiente vinculado: se registra, porque el cobro nacerá
            // impagable online y alguien tiene que enterarse.
            console.warn(
                `[enrollmentBilling] child ${opts.athleteId} sin parent_id: el cobro `
                + 'quedará sin pagador y no se podrá pagar online.',
            );
        }
    }

    const { error } = await supabase.from('payments').insert(row);
    if (error) {
        // 23505: ya existe un cobro activo para este atleta+período
        // (uniq_payment_active_period_*). NO es un error: el cobro ya está
        // creado, así que la operación continúa sin duplicar ni abortar.
        if ((error as any).code === '23505') return;
        throw new Error(`Error creando cobro pendiente: ${error.message}`);
    }
}

/**
 * Emite la mensualidad de un plan recién asignado (lee nombre y precio del
 * catálogo). Idempotente por período gracias al 23505 que absorbe
 * createPendingPayment.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export async function emitPlanCharge(
    schoolId: string,
    athleteCol: AthleteCol,
    athleteId: string,
    planId: string,
    startDate: string,
): Promise<void> {
    const { data: plan } = await supabase
        .from('offering_plans')
        .select('name, price')
        .eq('id', planId)
        .maybeSingle();

    // Sin el mes en el texto, dos cobros del mismo atleta y plan (uno de agosto sin
    // pagar, otro de septiembre recién generado) se ven idénticos en cualquier
    // pantalla que muestre `concept` crudo (cartera de FinancesPage, WhatsApp
    // manual) — MyPaymentsPage no lo sufre porque ya arma su propio label desde
    // period_year/period_month, pero el resto de la app lee `concept` tal cual.
    const [y, m] = startDate.split('-').map(Number);
    const periodo = y && m ? `${MESES[m - 1]}/${y}` : null;
    const planName = (plan as any)?.name || 'Plan';

    await createPendingPayment({
        schoolId,
        athleteCol,
        athleteId,
        planId,
        amount: Number((plan as any)?.price ?? 0),
        concept: periodo ? `Plan ${planName} - ${periodo}` : `Plan ${planName}`,
        startDate,
    });
}

/** Anula los cobros pendientes de un plan concreto (cambio o baja de plan). */
export async function cancelPendingPlanPayments(opts: {
    schoolId: string;
    athleteCol: AthleteCol;
    athleteId: string;
    planIds: string[];
}): Promise<void> {
    const planIds = opts.planIds.filter(Boolean);
    if (!planIds.length) return;
    await supabase
        .from('payments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('school_id', opts.schoolId)
        .eq(opts.athleteCol, opts.athleteId)
        .in('offering_plan_id', planIds)
        .eq('status', 'pending');
}

/**
 * ¿El atleta está activo en la escuela? Un inactivo no puede recibir equipo ni
 * plan: el plan es lo que genera cobros, así que asignárselo lo devuelve a la
 * facturación por la puerta de atrás.
 */
export async function isAthleteActive(
    schoolId: string,
    athleteType: AthleteType,
    athleteId: string,
): Promise<boolean> {
    if (athleteType === 'adult') {
        const { data } = await supabase
            .from('school_members')
            .select('status')
            .eq('profile_id', athleteId)
            .eq('school_id', schoolId)
            .eq('role', 'athlete')
            .maybeSingle();
        return (data as any)?.status === 'active';
    }

    const table = athleteType === 'child' ? 'children' : 'unregistered_athletes';
    const { data } = await supabase
        .from(table)
        .select('is_active')
        .eq('id', athleteId)
        .maybeSingle();
    // Sin fila no se bloquea: el ownership lo resuelve quien llama.
    return data ? (data as any).is_active !== false : true;
}

export const INACTIVE_ATHLETE_ERROR =
    'El atleta está inactivo. Reactívalo antes de asignarle equipo o plan.';
