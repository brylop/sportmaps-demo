/**
 * plan-change-detector.job — detecta familias que cambiaron de plan sin avisar.
 *
 * Mira los pagos `paid` de mensualidad de los últimos días y compara lo pagado con
 * lo que se esperaba de la inscripción activa del atleta. La decisión (cambiar solo,
 * avisar o nada) vive en `services/plan-change-detector.ts`, que es pura y tiene sus
 * pruebas. Acá solo se lee en lote, se aplica y se avisa.
 *
 * Solo corre para las escuelas de `PLAN_CHANGE_AUTO_SCHOOL_IDS` (coma-separadas).
 * Vacía = no hace nada: se activa escuela por escuela, a propósito.
 *
 * Concurrencia / idempotencia (los 3 BFF comparten una base, aunque los crons solo
 * corren en prod):
 *  · El cambio de plan es un UPDATE condicionado al plan viejo y a `fee_is_manual=false`:
 *    solo la instancia que lo logra avisa. Repetirlo no hace nada.
 *  · Los avisos llevan una clave estable `plan-change:<atleta>:<año-mes>` en
 *    `notifications.data.clave` y no se repiten.
 *  · No toca cobros ya emitidos: solo el plan y el valor de la inscripción, que es lo
 *    que usarán los próximos cobros.
 */

import { supabase } from '../config/supabase';
import {
    avisoCambioAplicado, avisoPorDecidir, clavePlanChange, etiquetaPeriodo, evaluarPago,
    type Decision, type InscripcionLite, type PagoLite, type PlanLite,
} from '../services/plan-change-detector';

const VENTANA_PAGOS_DIAS = 3;
const VENTANA_HISTORIAL_DIAS = 100;
const VENTANA_AVISOS_DIAS = 70;
const LIMITE_PAGOS = 2000;
const LINK = '/school/students';
const TIPO_APLICADO = 'plan_change_applied';
const TIPO_SUGERENCIA = 'plan_change_suggestion';
const CATEGORIAS = 'payment_category.is.null,payment_category.in.(mensualidad,plan)';

type Col = 'child_id' | 'user_id' | 'unregistered_athlete_id';
const COLS: Col[] = ['child_id', 'user_id', 'unregistered_athlete_id'];

interface LogLike {
    info?: (...a: any[]) => void;
    warn?: (...a: any[]) => void;
    error?: (...a: any[]) => void;
}

export interface ResultadoDetector {
    revisados: number;
    cambiados: number;
    avisados: number;
    errores: number;
    detalle: Array<{
        pago_id: string;
        school_id: string;
        atleta: string;
        decision: Decision['tipo'];
        motivo?: string;
        plan_viejo?: string;
        plan_nuevo?: string;
        monto: number;
        aplicado: boolean;
    }>;
}

export function escuelasAutorizadas(env: NodeJS.ProcessEnv = process.env): string[] {
    return String(env.PLAN_CHANGE_AUTO_SCHOOL_IDS ?? '')
        .split(',').map((s) => s.trim()).filter(Boolean);
}

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

function atletaDe(fila: Record<string, any>): { col: Col; id: string } | null {
    for (const col of COLS) if (fila[col]) return { col, id: fila[col] as string };
    return null;
}
const claveAtleta = (a: { col: Col; id: string }) => `${a.col}:${a.id}`;

export async function runPlanChangeDetector(
    opts: { dryRun?: boolean; schoolIds?: string[]; log?: LogLike; ventanaPagosDias?: number } = {},
): Promise<ResultadoDetector> {
    const log = opts.log ?? console;
    const dryRun = !!opts.dryRun;
    const resultado: ResultadoDetector = { revisados: 0, cambiados: 0, avisados: 0, errores: 0, detalle: [] };

    const schoolIds = opts.schoolIds ?? escuelasAutorizadas();
    if (schoolIds.length === 0) return resultado;

    // 1) Pagos recientes de mensualidad ya confirmados.
    const { data: pagosRaw, error: errPagos } = await supabase
        .from('payments')
        .select('id, school_id, child_id, user_id, unregistered_athlete_id, amount, period_year, period_month')
        .in('school_id', schoolIds)
        .eq('status', 'paid')
        .gt('amount', 0)
        .gte('payment_date', hace(opts.ventanaPagosDias ?? VENTANA_PAGOS_DIAS))
        .not('period_year', 'is', null)
        .not('period_month', 'is', null)
        .or(CATEGORIAS)
        .limit(LIMITE_PAGOS);
    if (errPagos) {
        log.error?.({ err: errPagos.message }, '[plan-change] no se pudieron leer los pagos');
        resultado.errores++;
        return resultado;
    }
    const pagos = ((pagosRaw ?? []) as any[]).filter((p) => atletaDe(p));
    if (pagos.length === 0) return resultado;

    // 2) Todo lo demás, en lote (nada de una consulta por atleta).
    const idsPorCol: Record<Col, string[]> = { child_id: [], user_id: [], unregistered_athlete_id: [] };
    for (const p of pagos) {
        const a = atletaDe(p)!;
        if (!idsPorCol[a.col].includes(a.id)) idsPorCol[a.col].push(a.id);
    }

    const [planesRes, escuelasRes] = await Promise.all([
        supabase.from('offering_plans').select('id, school_id, name, price, is_active').in('school_id', schoolIds),
        supabase.from('schools').select('id, owner_id, name').in('id', schoolIds),
    ]);
    if (planesRes.error || escuelasRes.error) {
        log.error?.({ err: planesRes.error?.message ?? escuelasRes.error?.message }, '[plan-change] no se pudieron leer planes/escuelas');
        resultado.errores++;
        return resultado;
    }
    const planesPorEscuela = new Map<string, PlanLite[]>();
    for (const p of (planesRes.data ?? []) as any[]) {
        const lista = planesPorEscuela.get(p.school_id) ?? [];
        lista.push({ id: p.id, name: p.name ?? '', price: Number(p.price), is_active: !!p.is_active });
        planesPorEscuela.set(p.school_id, lista);
    }
    const duenoPorEscuela = new Map<string, string | null>(
        ((escuelasRes.data ?? []) as any[]).map((s) => [s.id, s.owner_id ?? null]));

    const inscPorAtleta = new Map<string, Array<InscripcionLite & { school_id: string }>>();
    const historialPorAtleta = new Map<string, PagoLite[]>();
    for (const col of COLS) {
        const ids = idsPorCol[col];
        if (ids.length === 0) continue;
        const [insc, hist] = await Promise.all([
            supabase.from('enrollments')
                .select('id, school_id, child_id, user_id, unregistered_athlete_id, offering_plan_id, monthly_fee, fee_is_manual')
                .in(col, ids).in('school_id', schoolIds).eq('status', 'active').not('offering_plan_id', 'is', null),
            supabase.from('payments')
                .select('id, child_id, user_id, unregistered_athlete_id, amount, period_year, period_month')
                .in(col, ids).in('school_id', schoolIds).eq('status', 'paid').gt('amount', 0)
                .gte('payment_date', hace(VENTANA_HISTORIAL_DIAS))
                .not('period_year', 'is', null).not('period_month', 'is', null)
                .or(CATEGORIAS),
        ]);
        if (insc.error || hist.error) {
            log.error?.({ col, err: insc.error?.message ?? hist.error?.message }, '[plan-change] no se pudieron leer inscripciones/historial');
            resultado.errores++;
            continue;
        }
        for (const e of (insc.data ?? []) as any[]) {
            const k = claveAtleta({ col, id: e[col] });
            if (!e[col]) continue;
            const l = inscPorAtleta.get(k) ?? [];
            l.push({
                id: e.id, school_id: e.school_id, offering_plan_id: e.offering_plan_id,
                monthly_fee: e.monthly_fee != null ? Number(e.monthly_fee) : null, fee_is_manual: !!e.fee_is_manual,
            });
            inscPorAtleta.set(k, l);
        }
        for (const h of (hist.data ?? []) as any[]) {
            if (!h[col]) continue;
            const k = claveAtleta({ col, id: h[col] });
            const l = historialPorAtleta.get(k) ?? [];
            l.push({ id: h.id, amount: Number(h.amount), period_year: h.period_year, period_month: h.period_month });
            historialPorAtleta.set(k, l);
        }
    }

    // 3) Avisos ya enviados (por clave estable), para no repetir.
    const yaAvisados = new Set<string>();
    {
        const { data } = await supabase.from('notifications')
            .select('data')
            .in('school_id', schoolIds).in('type', [TIPO_APLICADO, TIPO_SUGERENCIA])
            .gte('created_at', hace(VENTANA_AVISOS_DIAS));
        for (const n of (data ?? []) as any[]) if (n?.data?.clave) yaAvisados.add(n.data.clave as string);
    }

    // 4) Decisión y aplicación, pago por pago (un fallo no frena el lote).
    const pendientes: Array<{ pago: any; atleta: { col: Col; id: string }; decision: Decision }> = [];
    for (const pago of pagos) {
        resultado.revisados++;
        const atleta = atletaDe(pago)!;
        const k = claveAtleta(atleta);
        try {
            const decision = evaluarPago(
                { id: pago.id, amount: Number(pago.amount), period_year: pago.period_year, period_month: pago.period_month },
                (inscPorAtleta.get(k) ?? []).filter((i) => i.school_id === pago.school_id),
                planesPorEscuela.get(pago.school_id) ?? [],
                historialPorAtleta.get(k) ?? [],
            );
            if (decision.tipo !== 'ok') pendientes.push({ pago, atleta, decision });
        } catch (err: any) {
            resultado.errores++;
            log.warn?.({ pagoId: pago.id, err: err?.message }, '[plan-change] no se pudo evaluar el pago');
        }
    }
    if (pendientes.length === 0) return resultado;

    // Nombres solo de quienes van a generar algo.
    const nombres = new Map<string, string>();
    for (const col of COLS) {
        const ids = [...new Set(pendientes.filter((p) => p.atleta.col === col).map((p) => p.atleta.id))];
        if (ids.length === 0) continue;
        const tabla = col === 'child_id' ? 'children' : col === 'user_id' ? 'profiles' : 'unregistered_athletes';
        const { data } = await supabase.from(tabla).select('id, full_name').in('id', ids);
        for (const f of (data ?? []) as any[]) nombres.set(`${col}:${f.id}`, f.full_name ?? 'Atleta');
    }

    for (const { pago, atleta, decision } of pendientes) {
        const k = claveAtleta(atleta);
        const nombre = nombres.get(k) ?? 'Un atleta';
        const clave = clavePlanChange(k, pago.period_year, pago.period_month);
        const periodo = etiquetaPeriodo(pago.period_year, pago.period_month);
        const dueno = duenoPorEscuela.get(pago.school_id) ?? null;
        const fila: ResultadoDetector['detalle'][number] = {
            pago_id: pago.id, school_id: pago.school_id, atleta: nombre, decision: decision.tipo,
            monto: Number(pago.amount), aplicado: false,
        };
        try {
            if (decision.tipo === 'cambiar') {
                fila.plan_viejo = decision.planViejo.name.trim();
                fila.plan_nuevo = decision.planNuevo.name.trim();
                if (!dryRun) {
                    const insc = (inscPorAtleta.get(k) ?? []).find((i) => i.school_id === pago.school_id)!;
                    const { data: reclamado, error } = await supabase.from('enrollments')
                        .update({ offering_plan_id: decision.planNuevo.id, monthly_fee: decision.planNuevo.price })
                        .eq('id', insc.id).eq('offering_plan_id', decision.planViejo.id)
                        .eq('status', 'active').eq('fee_is_manual', false)
                        .select('id');
                    if (error) throw error;
                    if (!reclamado || reclamado.length === 0) continue; // otra instancia ya lo hizo, o cambió entre tanto
                    fila.aplicado = true;
                    resultado.cambiados++;
                    log.info?.({ school: pago.school_id, atleta: k, de: decision.planViejo.name, a: decision.planNuevo.name, monto: decision.monto },
                        '[plan-change] plan cambiado automáticamente');
                    if (dueno && !yaAvisados.has(clave)) {
                        const aviso = avisoCambioAplicado(nombre, decision);
                        await avisar(pago.school_id, dueno, TIPO_APLICADO, aviso, { clave, atleta: k, periodo, plan_viejo: decision.planViejo.id, plan_nuevo: decision.planNuevo.id, monto: decision.monto });
                        yaAvisados.add(clave);
                    }
                }
            } else if (decision.tipo === 'avisar') {
                fila.motivo = decision.motivo;
                fila.plan_viejo = decision.planActual?.name.trim();
                if (decision.candidatos.length === 1) fila.plan_nuevo = decision.candidatos[0].name.trim();
                if (!dryRun && dueno && !yaAvisados.has(clave)) {
                    const aviso = avisoPorDecidir(nombre, decision, periodo);
                    await avisar(pago.school_id, dueno, TIPO_SUGERENCIA, aviso, { clave, atleta: k, periodo, motivo: decision.motivo, monto: decision.monto });
                    yaAvisados.add(clave);
                    fila.aplicado = true;
                    resultado.avisados++;
                }
            }
            resultado.detalle.push(fila);
        } catch (err: any) {
            resultado.errores++;
            log.warn?.({ pagoId: pago.id, err: err?.message }, '[plan-change] no se pudo aplicar la decisión');
        }
    }

    return resultado;
}

async function avisar(
    schoolId: string, userId: string, type: string,
    aviso: { titulo: string; mensaje: string }, data: Record<string, unknown>,
) {
    const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        school_id: schoolId,
        title: aviso.titulo,
        message: aviso.mensaje,
        type,
        category: 'payment',
        link: LINK,
        data,
    });
    if (error) throw error;
}
