// planDayRules — días permitidos por plan (D9 de
// docs/specs/dreamers-niveles-por-horas-y-progresion.md, fase F-F de
// docs/specs/dreamers-reglas-completas-plan.md).
//
// offering_plans.allowed_days_of_week integer[] (0 = domingo … 6 = sábado,
// igual que Date.getDay()). NULL = sin restricción = comportamiento de hoy.
//
// Quién lo usa:
//   · Reservas del atleta/acudiente (session-bookings.ts bookSession y
//     POST /:id/book, access-api.ts POST /hour-bank-reservations): 422
//     { reserved:false, reason:'day_not_allowed', allowed_days }.
//   · listAvailableSessions: no ofrece sesiones de días no permitidos.
//   · Torniquete (access-adms.ts): NO niega — el F22 decide el paso local
//     (D11b = solo registrar y avisar). Deja policy_warning en access_events.
//   · Reservas creadas por staff/admin (reservations-admin.routes.ts): NO se
//     validan a propósito — la escuela puede hacer excepciones.
//
// Fail-open: si la columna no existe todavía (migración sin aplicar) o la
// lectura falla, se trata como NULL. Una restricción nueva nunca debe tumbar
// una reserva ni un evento de torniquete que hoy funcionan.

import { supabase } from '../config/supabase';

export const DAY_NOT_ALLOWED = 'day_not_allowed' as const;

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Día de la semana (0=domingo) de una fecha calendario 'YYYY-MM-DD', sin zona horaria. */
export function weekdayOfDateString(date: string): number {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    if (!m) throw new Error(`fecha inválida: ${date}`);
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/** Fecha calendario en Bogotá ('YYYY-MM-DD') de un instante ISO. */
export function bogotaDateOf(instant: string | Date): string {
    const d = typeof instant === 'string' ? new Date(instant) : instant;
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** Normaliza lo que venga de la base: solo enteros 0..6; vacío/NULL = sin restricción. */
export function normalizeAllowedDays(raw: unknown): number[] | null {
    if (!Array.isArray(raw)) return null;
    const days = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
    return days.length > 0 ? days : null;
}

/** ¿La fecha cae en un día permitido? NULL/vacío = siempre sí. */
export function isDayAllowed(allowedDays: number[] | null | undefined, date: string): boolean {
    const days = normalizeAllowedDays(allowedDays);
    if (!days) return true;
    return days.includes(weekdayOfDateString(date));
}

export function describeAllowedDays(days: number[]): string {
    return days.map((d) => DAY_NAMES_ES[d]).join(', ');
}

/** Cuerpo del 422 — mismo shape que el 422 de reserve_hour_bank (reserved:false). */
export function dayNotAllowedBody(allowedDays: number[]) {
    return {
        reserved: false,
        reason: DAY_NOT_ALLOWED,
        allowed_days: allowedDays,
        error: `Tu plan solo permite reservar los días: ${describeAllowedDays(allowedDays)}.`,
    };
}

// ── Lecturas con caché de 60 s ───────────────────────────────────────────────
const TTL_MS = 60_000;
const byEnrollment = new Map<string, { value: number[] | null; at: number }>();

export function clearPlanDayRulesCache(): void {
    byEnrollment.clear();
}

/** Días permitidos del plan de la inscripción (caché 60 s). NULL = sin restricción. */
export async function getAllowedDaysForEnrollment(enrollmentId: string): Promise<number[] | null> {
    const cached = byEnrollment.get(enrollmentId);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

    let value: number[] | null = null;
    try {
        const { data: enr, error: enrErr } = await supabase
            .from('enrollments')
            .select('offering_plan_id')
            .eq('id', enrollmentId)
            .maybeSingle();
        if (!enrErr && enr?.offering_plan_id) {
            const { data: plan, error: planErr } = await supabase
                .from('offering_plans')
                .select('allowed_days_of_week')
                .eq('id', enr.offering_plan_id)
                .maybeSingle();
            if (!planErr) value = normalizeAllowedDays((plan as any)?.allowed_days_of_week);
        }
    } catch {
        value = null; // fail-open
    }

    byEnrollment.set(enrollmentId, { value, at: Date.now() });
    return value;
}

/** Días permitidos de varios planes en una sola lectura (sin caché; para listados). */
export async function getAllowedDaysForPlans(planIds: string[]): Promise<Record<string, number[] | null>> {
    const ids = [...new Set(planIds.filter(Boolean))];
    if (ids.length === 0) return {};
    try {
        const { data, error } = await supabase
            .from('offering_plans')
            .select('id, allowed_days_of_week')
            .in('id', ids);
        if (error) return {};
        const out: Record<string, number[] | null> = {};
        (data || []).forEach((p: any) => { out[p.id] = normalizeAllowedDays(p.allowed_days_of_week); });
        return out;
    } catch {
        return {};
    }
}

/** isDateAllowedForEnrollment(enrollmentId, 'YYYY-MM-DD'). */
export async function isDateAllowedForEnrollment(
    enrollmentId: string,
    date: string,
): Promise<{ allowed: boolean; allowedDays: number[] | null }> {
    const allowedDays = await getAllowedDaysForEnrollment(enrollmentId);
    return { allowed: isDayAllowed(allowedDays, date), allowedDays };
}

// ── Torniquete (D11b: registrar + avisar, nunca negar) ───────────────────────

/** Advertencia de política para una ENTRADA concedida, o undefined. Nunca lanza. */
export async function resolveEntryDayWarning(
    enrollmentId: string | undefined,
    occurredAt: string | undefined,
): Promise<typeof DAY_NOT_ALLOWED | undefined> {
    if (!enrollmentId) return undefined;
    try {
        const date = bogotaDateOf(occurredAt ?? new Date());
        const { allowed } = await isDateAllowedForEnrollment(enrollmentId, date);
        return allowed ? undefined : DAY_NOT_ALLOWED;
    } catch {
        return undefined;
    }
}

/**
 * Columnas de decisión del access_event. La advertencia de día NUNCA convierte
 * un acceso concedido en denegado (el F22 ya dejó pasar a la atleta) y solo se
 * escribe policy_warning cuando hay advertencia — así un evento normal no
 * depende de que la columna nueva exista.
 */
export function accessEventDecisionFields(v: { granted: boolean; reason?: string; policyWarning?: string }) {
    return {
        access_granted: v.granted,
        denial_reason: v.granted ? null : (v.reason ?? null),
        ...(v.granted && v.policyWarning ? { policy_warning: v.policyWarning } : {}),
    };
}

/**
 * Avisa al owner que alguien entró en un día que su plan no permite — una sola
 * vez por atleta por día (Bogotá). Clona el aviso de payment_overdue.
 * Devuelve true si insertó la notificación.
 */
export async function notifyOwnerDayNotAllowedOnce(params: {
    schoolId: string;
    enrollmentId: string;
    athleteName: string;
    occurredAt: string;
}): Promise<boolean> {
    const { schoolId, enrollmentId, athleteName, occurredAt } = params;
    const date = bogotaDateOf(occurredAt);

    const { data: school } = await supabase
        .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (!school?.owner_id) return false;

    const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('school_id', schoolId)
        .eq('user_id', school.owner_id)
        .eq('type', 'access_day_not_allowed')
        .contains('data', { enrollment_id: enrollmentId, date })
        .limit(1);
    if (existing && existing.length > 0) return false;

    const { error } = await supabase.from('notifications').insert({
        user_id:   school.owner_id,
        school_id: schoolId,
        type:      'access_day_not_allowed',
        category:  'access',
        title:     'Ingreso en día no permitido',
        message:   `${athleteName} ingresó hoy, pero su plan no incluye este día. El torniquete no lo bloquea: solo queda registrado.`,
        link:      '/school/access-control',
        data:      { enrollment_id: enrollmentId, date },
    });
    return !error;
}
