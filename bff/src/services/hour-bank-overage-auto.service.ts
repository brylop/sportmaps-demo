/**
 * Excedentes del banco de horas: «Cobrar todos» y confirmación automática bajo tope.
 * Plan: docs/specs/dreamers-horas-agotadas-bloqueo-y-excedentes-automaticos.md §3.
 *
 * El cron de las 03:00 ya deja filas `suggested` (generate_hour_bank_overage_suggestions) y el owner
 * las confirma una por una. Aquí se agregan dos formas de decidir muchas a la vez, sin cambiar la
 * regla de cobro (la crea SIEMPRE confirm_hour_bank_overage, que es idempotente y bloquea la fila):
 *   · «Cobrar todos»: el owner confirma de una vez todas las sugeridas elegibles.
 *   · Confirmación automática: solo escuelas con al menos un tope definido; se confirma una sugerida
 *     si cumple TODOS los topes definidos (horas y/o valor). Lo que supere cualquiera sigue en revisión.
 *
 * En los dos casos se EXCLUYE (queda `suggested` para decidir a mano): inscripciones no activas y
 * cobros de los hijos / de la cuenta del dueño de la escuela. Nunca se cobra dos veces: «Cobrar
 * todos» dos veces no duplica porque la RPC devuelve `not_suggested` para lo ya decidido.
 */
import { supabase } from '../config/supabase';

export interface Topes {
    maxHoras: number | null;
    maxMonto: number | null;
}

/** Hay al menos un tope definido y la sugerencia cumple TODOS los definidos. */
export function cumpleTopes(c: { horas: number; monto: number }, t: Topes): boolean {
    const hayHoras = t.maxHoras != null && t.maxHoras > 0;
    const hayMonto = t.maxMonto != null && t.maxMonto > 0;
    if (!hayHoras && !hayMonto) return false;
    if (hayHoras && !(c.horas <= (t.maxHoras as number))) return false;
    if (hayMonto && !(c.monto <= (t.maxMonto as number))) return false;
    return true;
}

export interface ResultadoDeConfirmacion {
    confirmados: number;
    omitidos: { id: string; motivo: 'tope' | 'inscripcion_inactiva' | 'dueno' | 'ya_decidido' }[];
    errores: { id: string; mensaje: string }[];
    pagos: string[];
}

interface Sugerida { id: string; enrollment_id: string; billable_hours: number; amount: number }

/**
 * Confirma las sugeridas elegibles de una escuela. `topes` null = sin filtro por tope («Cobrar todos»).
 * `origen` solo cambia el rastro en audit_logs.
 */
export async function confirmarSugeridas(opts: {
    schoolId: string;
    actorId: string;
    ownerId: string | null;
    origen: 'manual' | 'auto';
    topes?: Topes | null;
    log?: { error: (...a: any[]) => void };
}): Promise<ResultadoDeConfirmacion> {
    const out: ResultadoDeConfirmacion = { confirmados: 0, omitidos: [], errores: [], pagos: [] };

    const { data: filas, error } = await supabase
        .from('hour_bank_overage_charges')
        .select('id, enrollment_id, billable_hours, amount')
        .eq('school_id', opts.schoolId)
        .eq('status', 'suggested')
        .order('created_at', { ascending: true })
        .limit(200);
    if (error) throw new Error(`hour_bank_overage_charges: ${error.message}`);
    const sugeridas = (filas ?? []) as unknown as Sugerida[];
    if (sugeridas.length === 0) return out;

    // Contexto en lote: estado de la inscripción y de quién es el cobro.
    const enrollmentIds = [...new Set(sugeridas.map((s) => s.enrollment_id))];
    const { data: insc } = await supabase
        .from('enrollments').select('id, status, child_id, user_id').in('id', enrollmentIds);
    const inscPor = new Map(((insc ?? []) as Record<string, any>[]).map((e) => [e.id as string, e]));
    const childIds = [...new Set([...inscPor.values()].map((e) => e.child_id).filter(Boolean))] as string[];
    const { data: hijos } = childIds.length
        ? await supabase.from('children').select('id, parent_id').in('id', childIds)
        : { data: [] as Record<string, any>[] };
    const padrePor = new Map(((hijos ?? []) as Record<string, any>[]).map((h) => [h.id as string, h.parent_id as string | null]));

    for (const s of sugeridas) {
        const e = inscPor.get(s.enrollment_id);
        if (!e || e.status !== 'active') { out.omitidos.push({ id: s.id, motivo: 'inscripcion_inactiva' }); continue; }
        const pagador = (e.child_id ? padrePor.get(e.child_id as string) : e.user_id) ?? null;
        if (opts.ownerId && pagador === opts.ownerId) { out.omitidos.push({ id: s.id, motivo: 'dueno' }); continue; }
        if (opts.topes && !cumpleTopes({ horas: Number(s.billable_hours), monto: Number(s.amount) }, opts.topes)) {
            out.omitidos.push({ id: s.id, motivo: 'tope' });
            continue;
        }

        const { data, error: errRpc } = await supabase.rpc('confirm_hour_bank_overage', { p_id: s.id, p_actor: opts.actorId });
        if (errRpc) {
            opts.log?.error({ err: errRpc.message }, 'Error confirmando excedente');
            out.errores.push({ id: s.id, mensaje: errRpc.message.slice(0, 160) });
            continue;
        }
        const r = (data ?? {}) as { payment_id?: string; error?: string };
        if (r.error === 'not_suggested') { out.omitidos.push({ id: s.id, motivo: 'ya_decidido' }); continue; }
        if (r.error || !r.payment_id) { out.errores.push({ id: s.id, mensaje: r.error ?? 'sin pago' }); continue; }

        out.confirmados += 1;
        out.pagos.push(r.payment_id);
        // Rastro por cada cobro creado (quién, de dónde salió y por cuánto).
        const { error: errAudit } = await supabase.from('audit_logs').insert({
            school_id: opts.schoolId,
            profile_id: opts.actorId,
            table_name: 'hour_bank_overage_charges',
            record_id: s.id,
            action: opts.origen === 'auto' ? 'hour_bank_overage_auto_confirmed' : 'hour_bank_overage_confirmed',
            new_data: { status: 'confirmed', payment_id: r.payment_id, amount: s.amount, billable_hours: s.billable_hours, origen: opts.origen },
        });
        if (errAudit) opts.log?.error({ err: errAudit.message }, 'No se pudo registrar la confirmación del excedente');
    }
    return out;
}

/** Cron diario (08:00 COT): confirma solo lo que cumple los topes de cada escuela que los definió. */
export async function runHourBankOverageAutoConfirm(): Promise<{ escuelas: number; confirmados: number }> {
    const { data: ajustes, error } = await supabase
        .from('school_settings')
        .select('school_id, hour_bank_overage_auto_confirm_max_hours, hour_bank_overage_auto_confirm_max_amount')
        .eq('hours_plan_enabled', true)
        .eq('hour_bank_overage_charges_enabled', true);
    if (error) return { escuelas: 0, confirmados: 0 }; // columnas aún sin migración: no-op

    const conTopes = ((ajustes ?? []) as Record<string, any>[])
        .map((a) => ({
            schoolId: a.school_id as string,
            topes: {
                maxHoras: a.hour_bank_overage_auto_confirm_max_hours == null ? null : Number(a.hour_bank_overage_auto_confirm_max_hours),
                maxMonto: a.hour_bank_overage_auto_confirm_max_amount == null ? null : Number(a.hour_bank_overage_auto_confirm_max_amount),
            } as Topes,
        }))
        .filter((e) => (e.topes.maxHoras ?? 0) > 0 || (e.topes.maxMonto ?? 0) > 0);

    let confirmados = 0;
    for (const e of conTopes) {
        try {
            const { data: esc } = await supabase.from('schools').select('owner_id').eq('id', e.schoolId).maybeSingle();
            const ownerId = ((esc as any)?.owner_id as string | null | undefined) ?? null;
            if (!ownerId) continue; // sin dueño no hay a nombre de quién decidir
            const r = await confirmarSugeridas({ schoolId: e.schoolId, actorId: ownerId, ownerId, origen: 'auto', topes: e.topes });
            confirmados += r.confirmados;
            if (r.confirmados > 0 || r.errores.length > 0) {
                console.log(`[CRON] excedentes automáticos — escuela ${e.schoolId}: confirmados=${r.confirmados} omitidos=${r.omitidos.length} errores=${r.errores.length}`);
            }
        } catch (err: any) {
            console.error(`[CRON] excedentes automáticos — error en escuela ${e.schoolId}:`, err?.message || err);
        }
    }
    return { escuelas: conTopes.length, confirmados };
}
