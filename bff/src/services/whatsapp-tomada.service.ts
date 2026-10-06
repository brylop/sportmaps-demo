/**
 * whatsapp-tomada.service — «Tomar la conversación» (mejora 9, 2026-10-06).
 *
 * Una persona de la escuela toma una conversación desde el buzón y, mientras
 * esté tomada, el asistente NO le escribe nada automático a esa familia:
 *
 *   - ni el modelo (`runBotTurn` sale antes de gastarlo),
 *   - ni acuses, cortesía, ausencias, avisos de formato, video o nota de voz
 *     (todo eso pasa por `deliver`, que se niega; y por `debeAtender`, que
 *     devuelve `atender=false` con `tomada=true`),
 *   - ni la puerta del desconocido (`atenderDesconocido`).
 *
 * La COLA DE COMPROBANTES sí sigue trabajando (decisión): el comprobante se
 * baja, se lee y se APLICA igual —perderlo o demorarlo le cuesta plata a la
 * familia—, pero sin escribirle mientras esté tomada. Lo que el worker le
 * habría dicho queda en el log y el resultado se ve en el panel de
 * comprobantes; la persona que la tomó es quien le cuenta. El aviso de
 * «la escuela confirmó tu pago» (job de resultados) se DIFIERE: no se marca
 * como avisado y sale en la primera vuelta después de soltarla o de que venza.
 *
 * Se libera con «Soltar» o sola al vencer (`tomada_hasta`). Default 12 h al
 * tomar (env `WHATSAPP_TOMADA_HORAS`, o `horas` en el POST, 1–72). Responder
 * desde el buzón la toma 2 h (sin acortar una toma más larga ya vigente).
 *
 * Tolerante a la migración 20261006101521 sin aplicar: si la columna no existe
 * `conversacionTomada` dice false (el bot sigue como siempre) y `tomar`/`soltar`
 * devuelven 'no_disponible' (el buzón deshabilita el botón).
 */

import { supabase } from '../config/supabase';
import { esColumnaInexistente as esColumnaFaltante } from './whatsapp-buzon';

export const HORAS_TOMADA_DEFAULT = Number(process.env.WHATSAPP_TOMADA_HORAS) || 12;
export const HORAS_TOMADA_AL_RESPONDER = 2;
export const HORAS_TOMADA_MAX = 72;

export interface EstadoDeTomada {
    tomada_por: string | null;
    tomada_hasta: string | null;
}

/** ¿Vigente? Pura: sin dueño o vencida = libre. */
export function tomadaVigente(
    fila: Partial<EstadoDeTomada> | null | undefined,
    ahora: number = Date.now(),
): boolean {
    if (!fila?.tomada_por || !fila.tomada_hasta) return false;
    const hasta = new Date(fila.tomada_hasta).getTime();
    return Number.isFinite(hasta) && hasta > ahora;
}

/**
 * ¿Esta conversación está tomada por una persona ahora? Nunca lanza.
 *
 * Ante error (columna inexistente, base caída) dice false: el resto de los
 * filtros (bot apagado, P4 de 15 min por humano) sigue protegiendo, y callar
 * al bot en todas las escuelas por una migración sin aplicar sería peor.
 */
export async function conversacionTomada(conversationId: string | null | undefined): Promise<boolean> {
    if (!conversationId) return false;
    try {
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('tomada_por, tomada_hasta')
            .eq('id', conversationId)
            .maybeSingle();
        if (error) return false;
        return tomadaVigente(data as any);
    } catch {
        return false;
    }
}

export type ResultadoTomar =
    | { ok: true; tomada_por: string; tomada_hasta: string }
    | { ok: false; motivo: 'no_encontrada' | 'no_disponible' | 'error'; detalle?: string };

/**
 * Toma la conversación para `userId` por `horas`.
 *
 * `soloExtender` (responder desde el buzón): si ya está tomada y vence después
 * de lo pedido, no se acorta ni se le cambia el dueño; si está tomada por otra
 * persona con menos tiempo, se extiende y queda a nombre de quien respondió.
 */
export async function tomarConversacion(
    schoolId: string,
    conversationId: string,
    userId: string,
    horas: number,
    opciones: { soloExtender?: boolean } = {},
): Promise<ResultadoTomar> {
    const ahora = Date.now();
    const pedida = ahora + horas * 3600_000;

    const { data: actual, error: errLeer } = await supabase
        .from('whatsapp_conversations')
        .select('id, tomada_por, tomada_hasta')
        .eq('id', conversationId)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (errLeer) {
        return esColumnaFaltante(errLeer)
            ? { ok: false, motivo: 'no_disponible' }
            : { ok: false, motivo: 'error', detalle: errLeer.message };
    }
    if (!actual) return { ok: false, motivo: 'no_encontrada' };

    const a = actual as any as EstadoDeTomada;
    if (opciones.soloExtender && tomadaVigente(a, ahora)
        && new Date(a.tomada_hasta as string).getTime() >= pedida) {
        return { ok: true, tomada_por: a.tomada_por as string, tomada_hasta: a.tomada_hasta as string };
    }

    const hasta = new Date(pedida).toISOString();
    const { data, error } = await supabase
        .from('whatsapp_conversations')
        .update({ tomada_por: userId, tomada_hasta: hasta, updated_at: new Date(ahora).toISOString() })
        .eq('id', conversationId)
        .eq('school_id', schoolId)
        .select('id, tomada_por, tomada_hasta')
        .maybeSingle();
    if (error) {
        return esColumnaFaltante(error)
            ? { ok: false, motivo: 'no_disponible' }
            : { ok: false, motivo: 'error', detalle: error.message };
    }
    if (!data) return { ok: false, motivo: 'no_encontrada' };
    return { ok: true, tomada_por: userId, tomada_hasta: hasta };
}

export type ResultadoSoltar =
    | { ok: true }
    | { ok: false; motivo: 'no_encontrada' | 'no_disponible' | 'error'; detalle?: string };

/** Suelta la conversación (cualquier admin de la escuela puede soltarla). Idempotente. */
export async function soltarConversacion(schoolId: string, conversationId: string): Promise<ResultadoSoltar> {
    const { data, error } = await supabase
        .from('whatsapp_conversations')
        .update({ tomada_por: null, tomada_hasta: null, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('school_id', schoolId)
        .select('id')
        .maybeSingle();
    if (error) {
        return esColumnaFaltante(error)
            ? { ok: false, motivo: 'no_disponible' }
            : { ok: false, motivo: 'error', detalle: error.message };
    }
    if (!data) return { ok: false, motivo: 'no_encontrada' };
    return { ok: true };
}

export interface TomaVisible {
    tomada_por: string;
    tomada_por_nombre: string | null;
    tomada_hasta: string;
}

/**
 * Para el buzón: las tomas VIGENTES de estas conversaciones, con el nombre de
 * quien la tiene. `disponible=false` = falta la migración (el buzón deshabilita
 * el botón). Nunca lanza.
 */
export async function tomasDe(ids: string[]): Promise<{ disponible: boolean; tomas: Map<string, TomaVisible> }> {
    const tomas = new Map<string, TomaVisible>();
    if (!ids.length) {
        // Sin conversaciones no se puede saber por la lista: se pregunta por la columna.
        const { error } = await supabase.from('whatsapp_conversations').select('tomada_hasta').limit(1);
        return { disponible: !error, tomas };
    }
    try {
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('id, tomada_por, tomada_hasta')
            .in('id', ids);
        if (error) return { disponible: false, tomas };
        const ahora = Date.now();
        const vigentes = ((data ?? []) as any[]).filter((c) => tomadaVigente(c, ahora));
        const personas = [...new Set(vigentes.map((c) => c.tomada_por as string))];
        const nombres = new Map<string, string | null>();
        if (personas.length) {
            const { data: perfiles } = await supabase.from('profiles').select('id, full_name').in('id', personas);
            for (const p of (perfiles ?? []) as any[]) nombres.set(p.id, p.full_name ?? null);
        }
        for (const c of vigentes) {
            tomas.set(c.id, {
                tomada_por: c.tomada_por,
                tomada_por_nombre: nombres.get(c.tomada_por) ?? null,
                tomada_hasta: c.tomada_hasta,
            });
        }
        return { disponible: true, tomas };
    } catch {
        return { disponible: false, tomas };
    }
}
