/**
 * Aviso a la familia ANTES del cobro cuando el plan cambia por clases tomadas.
 * «Sofía tomó 12 clases en octubre: su plan pasa a ELITE, $180.000 al mes.»
 *
 * Esta pasada deja el aviso detrás de funciones con pruebas y NO lo dispara el job:
 *  · modo sombra  → nunca se avisa (nada cambió);
 *  · modo auto    → se avisa (cuando el job lo conecte).
 *
 * Reglas que respeta, sin crear canal nuevo:
 *  · Canal = despachador unificado de notificaciones (fila en `notifications` →
 *    `notification_deliveries` → push/web). WhatsApp NO se usa aquí: fuera de la
 *    ventana de 24 h exige plantilla aprobada + opt-in vigente, y hoy no hay
 *    plantilla de «cambio de plan» ni opt-ins suficientes (hay ~1). Si en el futuro
 *    se crea la plantilla, se agrega como otro `canal` en `decidirAviso`.
 *  · Ley 2300: máximo 1 contacto por día a la familia y se mantiene un solo canal por
 *    semana (si la familia ya fue contactada por WhatsApp esta semana, no se cambia
 *    de canal: se pospone).
 *  · Idempotente: clave estable `plan-por-asistencia:<atleta>:<año-mes>` en
 *    `notifications.data.clave`.
 */

import { supabase } from '../config/supabase';
import { nombreMes, nombrePlan, pesos, type ModoPlanAsistencia, type PropuestaFila } from './plan-por-asistencia.service';

export type MotivoSinAviso =
    | 'modo_no_auto' | 'sin_destinatario' | 'ya_avisado' | 'contactada_hoy' | 'canal_semana_whatsapp';

export interface ContextoAviso {
    modo: ModoPlanAsistencia;
    /** Cuenta de la familia (acudiente) que recibe la notificación in-app/push. */
    destinatarioUserId: string | null;
    /** Claves de aviso ya registradas. */
    clavesYaAvisadas: ReadonlySet<string>;
    /** La familia ya recibió HOY un contacto de cobranza/avisos de la escuela. */
    contactadaHoy: boolean;
    /** Canal con el que se contactó a la familia en los últimos 7 días. */
    canalUltimaSemana: 'whatsapp' | 'inapp' | null;
}

export type DecisionAviso =
    | { enviar: true; canal: 'inapp'; clave: string }
    | { enviar: false; motivo: MotivoSinAviso };

export const claveAviso = (atletaKey: string, year: number, month: number) =>
    `plan-por-asistencia:${atletaKey}:${year}-${String(month).padStart(2, '0')}`;

export interface TextoAviso { titulo: string; mensaje: string }

/** Texto corto. `nombre` completo → se usa el primer nombre. */
export function textoAviso(
    p: Pick<PropuestaFila, 'atleta' | 'clases_mes' | 'period_month' | 'to_plan' | 'to_amount' | 'from_plan' | 'direction'>,
): TextoAviso {
    const primer = p.atleta.trim().split(/\s+/)[0] || 'Tu deportista';
    const clases = `${p.clases_mes} ${p.clases_mes === 1 ? 'clase' : 'clases'}`;
    const mes = nombreMes(p.period_month);
    const plan = nombrePlan({ name: p.to_plan });
    return {
        titulo: 'Cambio de plan del mes',
        mensaje: `${primer} tomó ${clases} en ${mes}: su plan pasa a ${plan}, ${pesos(p.to_amount)} al mes.`,
    };
}

export function decidirAviso(
    p: Pick<PropuestaFila, 'child_id' | 'user_id' | 'unregistered_athlete_id' | 'period_year' | 'period_month'>,
    ctx: ContextoAviso,
): DecisionAviso {
    if (ctx.modo !== 'auto') return { enviar: false, motivo: 'modo_no_auto' };
    if (!ctx.destinatarioUserId) return { enviar: false, motivo: 'sin_destinatario' };
    const atletaKey = p.child_id ? `child_id:${p.child_id}` : p.user_id ? `user_id:${p.user_id}`
        : `unregistered_athlete_id:${p.unregistered_athlete_id}`;
    const clave = claveAviso(atletaKey, p.period_year, p.period_month);
    if (ctx.clavesYaAvisadas.has(clave)) return { enviar: false, motivo: 'ya_avisado' };
    if (ctx.contactadaHoy) return { enviar: false, motivo: 'contactada_hoy' };
    if (ctx.canalUltimaSemana === 'whatsapp') return { enviar: false, motivo: 'canal_semana_whatsapp' };
    return { enviar: true, canal: 'inapp', clave };
}

export interface ResultadoAviso { enviado: boolean; motivo?: MotivoSinAviso | 'error'; clave?: string }

/**
 * Registra la notificación (el despachador la entrega). NO se llama desde el job en
 * modo sombra. Inserta una sola fila; el contexto (claves previas, contacto de hoy) lo
 * arma quien llame, en lote.
 */
export async function enviarAvisoFamilia(
    p: PropuestaFila,
    ctx: ContextoAviso,
    insertar: (fila: Record<string, unknown>) => Promise<{ error: { message: string } | null }> =
        async (fila) => supabase.from('notifications').insert(fila),
): Promise<ResultadoAviso> {
    const d = decidirAviso(p, ctx);
    if (!d.enviar) return { enviado: false, motivo: d.motivo };
    const t = textoAviso(p);
    const { error } = await insertar({
        user_id: ctx.destinatarioUserId,
        school_id: p.school_id,
        title: t.titulo,
        message: t.mensaje,
        type: 'plan_change_family_notice',
        category: 'payment',
        link: '/parent/payments',
        data: { clave: d.clave, enrollment_id: p.enrollment_id, to_plan_id: p.to_plan_id, clases: p.clases_mes },
    });
    if (error) return { enviado: false, motivo: 'error', clave: d.clave };
    return { enviado: true, clave: d.clave };
}
