/**
 * Inscripción y seguro DESPUÉS del alta (ficha de edición del atleta).
 *
 * En el alta son opt-in («Cobrar inscripción / seguro»). Si la escuela no los
 * marcó —o los desmarcó por error— los puede cobrar después desde la ficha: se
 * crea el mismo cobro único que habría creado el alta (emit_enrollment_fees),
 * con el valor del plan, y queda el registro (audit_logs + la fila de payments).
 *
 *   · Inscripción: UNA sola vez por atleta. Si ya hay una viva (pendiente,
 *     abonada, en revisión o pagada) no se repite. Una cancelada no cuenta: se
 *     puede cobrar de nuevo.
 *   · Seguro: no se repite si el atleta ya tiene uno de los últimos 12 meses
 *     (misma regla de emit_enrollment_fees).
 *
 * El cambio de plan sigue SIN emitir estos cobros (D18): solo esta acción explícita.
 */
import { supabase } from '../config/supabase';
import { addDaysToDateString, todayInZone } from '../utils/businessDate';
import { emitEnrollmentFees, enrollmentFeeDueDate, type AthleteCol } from './enrollmentBilling';

export type FeeKind = 'inscripcion' | 'seguro';
export type FeeState =
    | 'sin_valor'     // el plan no tiene este valor configurado
    | 'por_cobrar'    // se puede cobrar ahora
    | 'cobrado'       // existe y está abierto (pendiente, abonado, en revisión)
    | 'pagado'        // existe y está pagado
    | 'vigente';      // seguro: ya tiene uno de los últimos 12 meses

export interface FeePaymentRow {
    id: string;
    payment_category: string | null;
    amount: number | string | null;
    status: string;
    due_date: string | null;
}

export interface FeeLine {
    kind: FeeKind;
    plan_amount: number;
    state: FeeState;
    /** El cobro vivo (o el que lo hace «vigente»); null si no hay. */
    payment: { id: string; amount: number; status: string; due_date: string | null } | null;
    /** Había uno cancelado antes (informativo: se puede cobrar de nuevo). */
    previously_cancelled: boolean;
    can_charge: boolean;
}

/** Puro: estado de un concepto según el valor del plan y los cobros que el atleta ya tiene. */
export function estadoDeConcepto(
    kind: FeeKind,
    planAmount: number,
    rows: FeePaymentRow[],
    today: string,
): FeeLine {
    const mine = rows.filter((r) => r.payment_category === kind);
    const vivos = mine.filter((r) => r.status !== 'cancelled' && r.status !== 'rejected');
    const cancelado = mine.some((r) => r.status === 'cancelled');
    const limite = addDaysToDateString(today, -365);
    const relevantes = kind === 'seguro'
        ? vivos.filter((r) => (r.due_date ?? '') > limite)
        : vivos;
    // El más reciente por vencimiento (los pagados pesan más que los abiertos al explicar).
    const ref = [...relevantes].sort((a, b) => String(b.due_date ?? '').localeCompare(String(a.due_date ?? '')))[0] ?? null;
    const payment = ref ? { id: ref.id, amount: Number(ref.amount) || 0, status: ref.status, due_date: ref.due_date } : null;

    const base = { kind, plan_amount: planAmount, payment, previously_cancelled: cancelado };
    if (ref) {
        if (ref.status === 'paid') {
            return { ...base, state: kind === 'seguro' ? 'vigente' : 'pagado', can_charge: false };
        }
        // Abierto (pendiente, vencido, abonado, en revisión) o cualquier otro vivo: ya está cobrado.
        return { ...base, state: 'cobrado', can_charge: false };
    }
    if (!(planAmount > 0)) return { ...base, state: 'sin_valor', can_charge: false };
    return { ...base, state: 'por_cobrar', can_charge: true };
}

export type AthleteType = 'child' | 'adult' | 'unregistered';

export interface ResolvedAthlete {
    col: AthleteCol;
    id: string;
    name: string | null;
}

/** Cruza el atleta contra la escuela del JWT. null = no es de esta escuela. */
export async function resolverAtleta(schoolId: string, id: string, type: AthleteType): Promise<ResolvedAthlete | null> {
    if (type === 'child') {
        const { data } = await supabase.from('children').select('id, full_name').eq('id', id).eq('school_id', schoolId).maybeSingle();
        return data ? { col: 'child_id', id, name: (data as any).full_name ?? null } : null;
    }
    if (type === 'adult') {
        const { data: m } = await supabase.from('school_members').select('id')
            .eq('profile_id', id).eq('school_id', schoolId).eq('role', 'athlete').maybeSingle();
        if (!m) return null;
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', id).maybeSingle();
        return { col: 'user_id', id, name: (p as any)?.full_name ?? null };
    }
    const { data } = await supabase.from('unregistered_athletes').select('id, full_name').eq('id', id).eq('school_id', schoolId).maybeSingle();
    return data ? { col: 'unregistered_athlete_id', id, name: (data as any).full_name ?? null } : null;
}

export interface FeesView {
    plan: { id: string; name: string } | null;
    fees: FeeLine[];
}

/** Plan activo del atleta (inscripción de plan más reciente) con los valores de inscripción y seguro. */
async function planActivo(schoolId: string, a: ResolvedAthlete) {
    const { data: enr } = await supabase.from('enrollments')
        .select('offering_plan_id, created_at')
        .eq('school_id', schoolId).eq(a.col, a.id).eq('status', 'active')
        .not('offering_plan_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1);
    const planId = (enr as any)?.[0]?.offering_plan_id as string | undefined;
    if (!planId) return null;
    const { data: plan } = await supabase.from('offering_plans')
        .select('id, name, registration_fee, insurance_fee')
        .eq('id', planId).eq('school_id', schoolId).maybeSingle();
    return (plan as any) ?? null;
}

async function cobrosUnicos(schoolId: string, a: ResolvedAthlete): Promise<FeePaymentRow[]> {
    let q = supabase.from('payments')
        .select('id, payment_category, amount, status, due_date')
        .eq('school_id', schoolId).eq(a.col, a.id)
        .in('payment_category', ['inscripcion', 'seguro']);
    if (a.col === 'user_id') q = q.is('child_id', null);
    const { data, error } = await q;
    if (error) throw new Error(`payments: ${error.message}`);
    return (data ?? []) as FeePaymentRow[];
}

export async function verCobrosUnicos(schoolId: string, a: ResolvedAthlete): Promise<FeesView> {
    const [plan, rows] = await Promise.all([planActivo(schoolId, a), cobrosUnicos(schoolId, a)]);
    const hoy = todayInZone();
    const valor = (v: unknown) => (Number(v) > 0 ? Number(v) : 0);
    return {
        plan: plan ? { id: plan.id, name: plan.name } : null,
        fees: [
            estadoDeConcepto('inscripcion', valor(plan?.registration_fee), rows, hoy),
            estadoDeConcepto('seguro', valor(plan?.insurance_fee), rows, hoy),
        ],
    };
}

export class CobroUnicoError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

/** Cobra lo pedido. Devuelve los ids creados. Nunca repite un cobro vivo. */
export async function cobrarUnicosDespues(opts: {
    schoolId: string;
    profileId: string | null;
    athlete: ResolvedAthlete;
    inscripcion: boolean;
    seguro: boolean;
    log?: { error: (...a: any[]) => void };
}): Promise<{ created: string[] }> {
    const { schoolId, athlete: a } = opts;
    if (!opts.inscripcion && !opts.seguro) throw new CobroUnicoError(400, 'Elige qué cobrar.');

    const view = await verCobrosUnicos(schoolId, a);
    if (!view.plan) throw new CobroUnicoError(409, 'El atleta no tiene un plan activo: asígnale un plan primero.');
    const quiere: Record<FeeKind, boolean> = { inscripcion: opts.inscripcion, seguro: opts.seguro };
    for (const f of view.fees) {
        if (!quiere[f.kind] || f.can_charge) continue;
        const nombre = f.kind === 'inscripcion' ? 'La inscripción' : 'El seguro';
        const why = f.state === 'sin_valor' ? 'el plan no tiene ese valor configurado'
            : f.state === 'pagado' ? 'ya está pagado'
            : f.state === 'vigente' ? 'el atleta ya tiene un seguro vigente (12 meses)'
            : 'ya está cobrado';
        throw new CobroUnicoError(409, `${nombre} no se puede cobrar: ${why}.`);
    }

    const hoy = todayInZone();
    const created = await emitEnrollmentFees({
        schoolId,
        planId: view.plan.id,
        athleteCol: a.col,
        athleteId: a.id,
        dueDate: enrollmentFeeDueDate(hoy, hoy),
        personName: a.name,
        // Lo no pedido se exonera: la RPC solo emite lo marcado.
        waivers: { registration: !opts.inscripcion, insurance: !opts.seguro },
        log: opts.log,
    });
    if (created.length === 0) throw new CobroUnicoError(502, 'No se pudo crear el cobro. Intenta de nuevo.');

    const { error } = await supabase.from('audit_logs').insert({
        school_id: schoolId,
        profile_id: opts.profileId,
        table_name: 'payments',
        record_id: created[0],
        action: 'enrollment_fees_charged_after_signup',
        new_data: { [a.col]: a.id, offering_plan_id: view.plan.id, inscripcion: opts.inscripcion, seguro: opts.seguro, payment_ids: created },
    });
    if (error) opts.log?.error({ err: error }, 'No se pudo registrar el cobro posterior de inscripción/seguro');
    return { created };
}
