/**
 * hour-bank-extra.service — venta de HORAS ADICIONALES por adelantado.
 *
 * El cobro va por el lote de siempre como `clase_extra` (ver `lineasParaRpc`);
 * este servicio hace lo que el lote no sabe: comprobar que el atleta tiene
 * banco de horas ANTES de cobrar, sumar las horas al banco DESPUÉS, ya pagado,
 * y deshacerlas si el cobro se anula.
 *
 * Orden y por qué:
 *   1. `verificarHorasAdicionales` (antes del lote): plan con horas, escuela con
 *      banco de horas, inscripción del atleta, y que la migración exista. Así
 *      nunca se cobra algo que después no se puede acreditar.
 *   2. Lote (RPC create_charge_batch): crea el cobro, atómico. La RPC guarda el
 *      concepto como «<concepto> — <nombre del atleta>»: por eso el pago se busca
 *      por PREFIJO de concepto + lote + atleta, nunca por igualdad.
 *   3. `sumarHorasAdicionales` (después): solo si el cobro quedó pagado. Si falla,
 *      queda el cobro SIN horas —visible en la respuesta y reintentable, porque
 *      la RPC es idempotente—, nunca horas sin cobro.
 *   4. `revertirHorasDeLote` (al anular): resta las horas de los cobros anulados.
 */

import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';
import { CobrosError, COLUMNA_ATLETA } from './charge-batches.service';
import type { AtletaInput, ChargeBatchRequest, LineaInput } from './charge-batches.schemas';
import { conceptoHorasAdicionales, formatearHoras, minutosDeHoras } from './hour-bank-extra.shared';

export type LineaDeHoras = LineaInput & { extra_hours: number; enrollment_id: string };

/** La línea de venta de horas del lote, si hay (el esquema permite una sola). */
export function lineaDeHoras(b: Pick<ChargeBatchRequest, 'lines'>): LineaDeHoras | null {
    const l = b.lines.find((x) => x.extra_hours != null);
    return l && l.enrollment_id ? (l as LineaDeHoras) : null;
}

/**
 * Antes del lote. Lanza CobrosError con un mensaje que la pantalla puede mostrar.
 * Nunca escribe.
 */
export async function verificarHorasAdicionales(schoolId: string, b: ChargeBatchRequest): Promise<void> {
    const linea = lineaDeHoras(b);
    if (!linea) return;
    await verificarVentaDeHoras(schoolId, b.athletes[0], linea.enrollment_id);
}

/** La misma verificación, para quien ya tiene el atleta y la inscripción (reintento). */
export async function verificarVentaDeHoras(
    schoolId: string,
    atleta: AtletaInput | undefined,
    enrollmentId: string,
): Promise<void> {
    if (!atleta) {
        throw new CobrosError(400, 'HORAS_SIN_ATLETA', 'Elige el atleta al que se le venden las horas.');
    }

    const col = COLUMNA_ATLETA[atleta.type];
    const { data: insc, error } = await supabase.from('enrollments')
        .select('id, offering_plan_id, status')
        .eq('id', enrollmentId).eq('school_id', schoolId).eq(col, atleta.id)
        .in('status', ['active', 'pending'])
        .maybeSingle();
    if (error) throw new Error(`enrollments: ${error.message}`);
    if (!insc) {
        throw new CobrosError(404, 'HORAS_INSCRIPCION_AJENA', 'Esa inscripción no es de este atleta o no está activa.');
    }

    const [{ data: plan, error: errPlan }, { data: ajustes, error: errAjustes }] = await Promise.all([
        insc.offering_plan_id
            ? supabase.from('offering_plans').select('included_minutes_per_period').eq('id', insc.offering_plan_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        supabase.from('school_settings').select('hours_plan_enabled').eq('school_id', schoolId).maybeSingle(),
    ]);
    if (errPlan) throw new Error(`offering_plans: ${errPlan.message}`);
    if (errAjustes) throw new Error(`school_settings: ${errAjustes.message}`);

    if (!(ajustes as { hours_plan_enabled?: boolean } | null)?.hours_plan_enabled) {
        throw new CobrosError(409, 'SIN_BANCO_DE_HORAS', 'La escuela no tiene activado el banco de horas.');
    }
    if (!(Number((plan as { included_minutes_per_period?: number } | null)?.included_minutes_per_period) > 0)) {
        throw new CobrosError(409, 'PLAN_SIN_HORAS',
            'El plan de este atleta no tiene horas configuradas, así que no se le pueden sumar horas. Configura las horas del plan o cobra esto como «Otro cobro».');
    }

    // La tabla de la migración. Si falta, no se cobra: no habría dónde acreditar.
    const { error: errTabla } = await supabase.from('hour_bank_grants').select('id').limit(1);
    if (errTabla) {
        throw new CobrosError(503, 'MIGRACION_PENDIENTE',
            'La venta de horas adicionales todavía no está habilitada en la base de datos. Avisa a soporte.');
    }
}

export interface ResultadoSumaDeHoras {
    ok: boolean;
    minutes?: number;
    hours?: number;
    period_id?: string;
    available_minutes?: number;
    duplicated?: boolean;
    payment_id?: string;
    /** sin_cobro: la línea no se creó. sin_pago: el cobro quedó pendiente. error: la RPC falló o no se pudo decidir. */
    reason?: 'sin_cobro' | 'sin_pago' | 'error';
    message?: string;
}

/**
 * Después del lote. NUNCA lanza: el cobro ya existe y la pantalla debe poder
 * decirle a la escuela exactamente qué quedó hecho y qué no.
 */
export async function sumarHorasAdicionales(
    schoolId: string,
    actor: string,
    batchId: string | null | undefined,
    linea: Pick<LineaDeHoras, 'extra_hours' | 'enrollment_id'>,
    atleta: AtletaInput | undefined,
): Promise<ResultadoSumaDeHoras> {
    const concepto = conceptoHorasAdicionales(linea.extra_hours);
    const minutos = minutosDeHoras(linea.extra_hours);
    try {
        if (!batchId) return { ok: false, reason: 'error', message: 'No se pudo identificar el lote.' };
        if (!atleta) return { ok: false, reason: 'error', message: 'No se pudo identificar al atleta.' };
        // Prefijo, no igualdad: la RPC agrega « — <nombre del atleta>» al concepto.
        const { data, error } = await supabase.from('payments')
            .select('id, status, amount')
            .eq('school_id', schoolId).eq('charge_batch_id', batchId)
            .eq('payment_category', 'clase_extra').like('concept', `${concepto}%`)
            .eq(COLUMNA_ATLETA[atleta.type], atleta.id)
            .limit(2);
        if (error) throw new Error(error.message);
        const filas = (data ?? []) as { id: string; status: string; amount: number }[];
        if (filas.length === 0) {
            return {
                ok: false, reason: 'sin_cobro',
                message: 'No se creó el cobro de las horas (por ejemplo, una venta idéntica de hoy ya estaba registrada, o se marcó «No cobrar»), así que no se sumaron al banco.',
            };
        }
        if (filas.length > 1) {
            return { ok: false, reason: 'error', message: 'Hay más de un cobro de horas en este lote; súmalas a mano.' };
        }
        const pago = filas[0];
        if (pago.status !== 'paid') {
            return {
                ok: false, reason: 'sin_pago', payment_id: pago.id,
                message: 'El cobro quedó pendiente: las horas no se suman hasta que esté pagado. Cuando lo pagues, usa «Reintentar suma de horas».',
            };
        }

        const { data: r, error: errRpc } = await supabase.rpc('grant_hour_bank_minutes', {
            p_enrollment_id: linea.enrollment_id,
            p_minutes: minutos,
            p_reason: `Horas adicionales compradas (${formatearHoras(linea.extra_hours)} h)`,
            p_actor: actor,
            p_payment_id: pago.id,
            // Las horas se compran para usarlas ya: el periodo es el de HOY, no el del vencimiento del cobro.
            p_on: todayInZone(),
        });
        if (errRpc) throw new Error(errRpc.message);
        const res = (r ?? {}) as Record<string, unknown>;
        return {
            ok: true,
            minutes: Number(res.minutes ?? minutos),
            hours: linea.extra_hours,
            period_id: res.period_id as string | undefined,
            available_minutes: res.available_minutes == null ? undefined : Number(res.available_minutes),
            duplicated: res.duplicated === true,
            payment_id: pago.id,
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            ok: false, reason: 'error',
            message: `El cobro quedó registrado, pero no se pudieron sumar las horas al banco (${message.slice(0, 160)}). Usa «Reintentar suma de horas» o avisa a soporte.`,
        };
    }
}

/**
 * Reintento a pedido del dueño: el lote ya existe (el cobro se creó y se pagó), pero las
 * horas no se sumaron. Verifica de nuevo y reutiliza la misma suma idempotente.
 */
export async function reintentarSumaDeHoras(
    schoolId: string,
    actor: string,
    batchId: string,
    atleta: AtletaInput,
    enrollmentId: string,
    horas: number,
): Promise<ResultadoSumaDeHoras> {
    const { data: lote, error } = await supabase.from('charge_batches')
        .select('id').eq('id', batchId).eq('school_id', schoolId).maybeSingle();
    if (error) throw new Error(`charge_batches: ${error.message}`);
    if (!lote) throw new CobrosError(404, 'LOTE_NO_ENCONTRADO', 'No encontramos esa operación en esta escuela.');
    await verificarVentaDeHoras(schoolId, atleta, enrollmentId);
    return sumarHorasAdicionales(schoolId, actor, batchId, { extra_hours: horas, enrollment_id: enrollmentId }, atleta);
}

export interface ResultadoReversaDeHoras {
    reverted: number;
    minutes: number;
    errors: string[];
}

/**
 * Al anular cobros: las horas vendidas con esos pagos se restan del banco. Nunca lanza
 * (la anulación ya ocurrió); los errores se devuelven para que la pantalla los diga.
 */
export async function revertirHorasDeLote(
    schoolId: string,
    actor: string,
    paymentIds: string[],
    motivo: string,
): Promise<ResultadoReversaDeHoras> {
    const out: ResultadoReversaDeHoras = { reverted: 0, minutes: 0, errors: [] };
    if (!paymentIds.length) return out;
    try {
        const { data, error } = await supabase.from('hour_bank_grants')
            .select('payment_id, minutes')
            .eq('school_id', schoolId).in('payment_id', paymentIds).is('reverted_at', null);
        if (error) {
            // Sin la tabla (migración sin aplicar) no hay horas que revertir.
            return out;
        }
        for (const g of (data ?? []) as { payment_id: string; minutes: number }[]) {
            const { data: r, error: errRpc } = await supabase.rpc('revoke_hour_bank_grant', {
                p_payment_id: g.payment_id, p_actor: actor, p_reason: motivo || 'Cobro anulado',
            });
            if (errRpc) { out.errors.push(errRpc.message.slice(0, 160)); continue; }
            if ((r as { reverted?: boolean } | null)?.reverted) { out.reverted += 1; out.minutes += g.minutes; }
        }
    } catch (err: unknown) {
        out.errors.push((err instanceof Error ? err.message : String(err)).slice(0, 160));
    }
    return out;
}
