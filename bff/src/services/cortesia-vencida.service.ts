/**
 * cortesia-vencida.service — «Terminó la semana de cortesía» (Besser, 2026-10-20).
 *
 * La inscripción por el QR de cortesía nace `active` y SIN cuota. Al terminar la
 * semana alguien de la escuela tiene que ponerle plan y cuota, o darla de baja;
 * antes nadie se enteraba. Este aviso es SOLO informativo: no cancela ni cobra
 * nada (decisión del usuario: la escuela decide una por una).
 *
 * Aplica a las escuelas con `school_settings.cortesia_unica = true`. Los días de
 * la semana salen de `wa_cortesia_dias` (7 por defecto).
 *
 * Una inscripción vencida es: `active`, sin cuota (`monthly_fee` NULL), sin plan
 * (o con un plan de $0) y con `start_date` de hace más de N días. Los becados
 * (cuota 0 fijada a mano) tienen `monthly_fee = 0`, no NULL: no entran.
 *
 * Cada inscripción se avisa UNA sola vez: el aviso lleva `data.enrollment_id` y
 * el job no repite si ya existe. Sin N+1: una consulta por tabla, en lote.
 */

import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';

const TIPO_AVISO = 'cortesia_vencida';
/** No se avisan cortesías de hace más de esto: serían datos viejos, no la semana que acaba de terminar. */
const VENTANA_MAX_DIAS = 30;

export interface InscripcionCortesia {
    id: string;
    school_id: string;
    child_id: string | null;
    user_id: string | null;
    start_date: string;
    monthly_fee: number | null;
    offering_plan_id: string | null;
    fee_is_manual?: boolean | null;
}

function sumarDias(fecha: string, n: number): string {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * ¿Esta inscripción es una cortesía vencida? Pura. `precioDelPlan`: precio del
 * plan asignado (null si no tiene plan).
 */
export function esCortesiaVencida(
    e: InscripcionCortesia, precioDelPlan: number | null, dias: number, hoy: string = todayInZone(),
): boolean {
    if (e.monthly_fee != null) return false;          // ya tiene cuota (o es becado en 0)
    if (e.fee_is_manual) return false;
    if (precioDelPlan != null && precioDelPlan > 0) return false; // ya tiene un plan que cobra
    const vence = sumarDias(e.start_date, dias);
    if (vence > hoy) return false;                    // la semana sigue
    return e.start_date >= sumarDias(hoy, -VENTANA_MAX_DIAS);
}

export interface ResultadoCortesiaVencida {
    escuelas: number;
    vencidas: number;
    avisadas: number;
}

/** Corre una vez al día. Nunca lanza: un fallo se registra y el resto de escuelas sigue. */
export async function runCortesiaVencida(hoy: string = todayInZone()): Promise<ResultadoCortesiaVencida> {
    const out: ResultadoCortesiaVencida = { escuelas: 0, vencidas: 0, avisadas: 0 };
    try {
        const { data: ajustes } = await supabase.from('school_settings')
            .select('school_id, wa_cortesia_dias')
            .eq('cortesia_unica', true);
        const escuelas = ((ajustes as any[]) ?? []).filter((a) => a.school_id);
        out.escuelas = escuelas.length;
        if (!escuelas.length) return out;
        const diasPorEscuela = new Map<string, number>(
            escuelas.map((a) => [a.school_id as string, Number(a.wa_cortesia_dias) || 7]));
        const ids = [...diasPorEscuela.keys()];

        const desde = sumarDias(hoy, -VENTANA_MAX_DIAS);
        const { data: inscripciones } = await supabase.from('enrollments')
            .select('id, school_id, child_id, user_id, start_date, monthly_fee, offering_plan_id, fee_is_manual')
            .in('school_id', ids).eq('status', 'active').is('monthly_fee', null).gte('start_date', desde);
        const candidatas = ((inscripciones as InscripcionCortesia[]) ?? []);
        if (!candidatas.length) return out;

        const planIds = [...new Set(candidatas.map((e) => e.offering_plan_id).filter(Boolean))] as string[];
        const precios = new Map<string, number>();
        if (planIds.length) {
            const { data: planes } = await supabase.from('offering_plans').select('id, price').in('id', planIds);
            for (const p of (planes as any[]) ?? []) precios.set(p.id, Number(p.price) || 0);
        }

        const vencidas = candidatas.filter((e) => esCortesiaVencida(
            e, e.offering_plan_id ? (precios.get(e.offering_plan_id) ?? 0) : null,
            diasPorEscuela.get(e.school_id) ?? 7, hoy));
        out.vencidas = vencidas.length;
        if (!vencidas.length) return out;

        // Una sola vez por inscripción: ¿ya se avisó?
        const { data: yaAvisadas } = await supabase.from('notifications')
            .select('data')
            .in('school_id', ids).eq('category', 'system').eq('data->>origen', TIPO_AVISO)
            .gte('created_at', new Date(Date.now() - 90 * 24 * 3600_000).toISOString());
        const avisadas = new Set(((yaAvisadas as any[]) ?? []).map((n) => n?.data?.enrollment_id).filter(Boolean));
        const nuevas = vencidas.filter((e) => !avisadas.has(e.id));
        if (!nuevas.length) return out;

        const childIds = [...new Set(nuevas.map((e) => e.child_id).filter(Boolean))] as string[];
        const nombres = new Map<string, string>();
        if (childIds.length) {
            const { data: hijos } = await supabase.from('children').select('id, full_name').in('id', childIds);
            for (const h of (hijos as any[]) ?? []) nombres.set(h.id, h.full_name);
        }

        const { data: miembros } = await supabase.from('school_members')
            .select('school_id, profile_id')
            .in('school_id', ids).eq('status', 'active').in('role', ['owner', 'admin', 'school_admin']);
        const adminsPorEscuela = new Map<string, string[]>();
        for (const m of (miembros as any[]) ?? []) {
            if (!m.profile_id) continue;
            const l = adminsPorEscuela.get(m.school_id) ?? [];
            if (!l.includes(m.profile_id)) l.push(m.profile_id);
            adminsPorEscuela.set(m.school_id, l);
        }

        const filas: Record<string, unknown>[] = [];
        for (const e of nuevas) {
            const nombre = (e.child_id && nombres.get(e.child_id)) || 'Un deportista';
            for (const uid of adminsPorEscuela.get(e.school_id) ?? []) {
                filas.push({
                    user_id: uid, school_id: e.school_id, type: 'info', category: 'system',
                    title: `Terminó la semana de cortesía: ${nombre}`,
                    message: `${nombre} ya cumplió su semana de cortesía (empezó el ${e.start_date}) y sigue sin plan ni cuota. ` +
                        'Asígnale un plan para que quede inscrito, o dalo de baja.',
                    link: '/students',
                    data: { origen: TIPO_AVISO, enrollment_id: e.id, child_id: e.child_id, start_date: e.start_date },
                });
            }
        }
        if (filas.length) {
            const { error } = await supabase.from('notifications').insert(filas);
            if (error) console.error('[cortesia-vencida] no se pudieron crear los avisos:', error.message);
            else out.avisadas = nuevas.length;
        }
    } catch (err: any) {
        console.error('[cortesia-vencida] falló:', err?.message ?? err);
    }
    return out;
}
