/**
 * whatsapp-mantenimiento.job — que el buzón no acumule lo que ya no se puede atender.
 *
 * Medido el 2026-10-03 en Dynasty (primer día con Coexistence): 55
 * conversaciones TODAS en 'open' y 316 borradores 'pending' sin aprobar. Nada
 * los sacaba de ahí: responder escribía un status que el CHECK no admite, y
 * ningún proceso vencía los borradores.
 *
 * Dos limpiezas, ambas idempotentes (la condición del UPDATE es la misma que
 * la de la selección, así que correr dos veces no cambia nada más):
 *
 *  (a) Conversaciones 'open' sin actividad hace 48 h → 'closed'. Si la familia
 *      vuelve a escribir, `wa_ingest_inbound_message` la reabre a 'open'. No se
 *      pierde nada: solo deja de figurar como pendiente algo que nadie va a
 *      atender ya.
 *  (b) Borradores 'pending' con más de 24 h → 'expired'. La ventana de 24 h de
 *      Meta ya cerró: aprobarlos después no se puede enviar como texto libre
 *      (el BFF devolvería `ventana_cerrada`). Dejarlos 'pending' solo infla el
 *      contador del buzón. 'expired' es un valor que el CHECK de
 *      whatsapp_message_drafts ya admite.
 *
 * En lotes de LOTE filas por vuelta y con tope de vueltas, para no tomar
 * cientos de filas de una en el primer pase sobre una escuela grande.
 */

import { supabase } from '../config/supabase';

export const HORAS_INACTIVIDAD_CONVERSACION = 48;
export const HORAS_VIDA_BORRADOR = 24;
const LOTE = 200;
const MAX_VUELTAS = 20;

const haceHoras = (h: number, ahora: number) => new Date(ahora - h * 60 * 60 * 1000).toISOString();

export async function cerrarConversacionesInactivas(ahora = Date.now()): Promise<number> {
    const corte = haceHoras(HORAS_INACTIVIDAD_CONVERSACION, ahora);
    // Sin `last_message_at` (conversación creada sin mensajes) se mira `updated_at`.
    const filtroInactiva = `last_message_at.lt.${corte},and(last_message_at.is.null,updated_at.lt.${corte})`;
    let total = 0;

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('status', 'open')
            .or(filtroInactiva)
            .limit(LOTE);
        if (error) throw new Error(`listar conversaciones inactivas: ${error.message}`);
        const ids = (data ?? []).map((c: any) => c.id as string);
        if (!ids.length) break;

        // Se repite la condición en el UPDATE: si entre el SELECT y acá entró
        // un mensaje (la conversación se movió), no se cierra.
        const { data: cerradas, error: errUpd } = await supabase
            .from('whatsapp_conversations')
            .update({ status: 'closed', updated_at: new Date(ahora).toISOString() })
            .in('id', ids)
            .eq('status', 'open')
            .or(filtroInactiva)
            .select('id');
        if (errUpd) throw new Error(`cerrar conversaciones inactivas: ${errUpd.message}`);
        total += (cerradas ?? []).length;
        if (ids.length < LOTE) break;
    }
    return total;
}

export async function expirarBorradoresViejos(ahora = Date.now()): Promise<number> {
    const corte = haceHoras(HORAS_VIDA_BORRADOR, ahora);
    let total = 0;

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const { data, error } = await supabase
            .from('whatsapp_message_drafts')
            .select('id')
            .eq('status', 'pending')
            .lt('created_at', corte)
            .limit(LOTE);
        if (error) throw new Error(`listar borradores viejos: ${error.message}`);
        const ids = (data ?? []).map((d: any) => d.id as string);
        if (!ids.length) break;

        // `.eq('status','pending')` también en el UPDATE: si alguien lo aprobó
        // en el medio, no se le pisa el 'sent'.
        const { data: vencidos, error: errUpd } = await supabase
            .from('whatsapp_message_drafts')
            .update({ status: 'expired', updated_at: new Date(ahora).toISOString() })
            .in('id', ids)
            .eq('status', 'pending')
            .select('id');
        if (errUpd) throw new Error(`expirar borradores: ${errUpd.message}`);
        total += (vencidos ?? []).length;
        if (ids.length < LOTE) break;
    }
    return total;
}

export async function runWhatsAppMantenimiento(ahora = Date.now()): Promise<{ cerradas: number; expirados: number }> {
    // Independientes: si una falla, la otra corre igual.
    const [c, e] = await Promise.allSettled([
        cerrarConversacionesInactivas(ahora),
        expirarBorradoresViejos(ahora),
    ]);
    if (c.status === 'rejected') console.error('[wa-mantenimiento]', c.reason?.message ?? c.reason);
    if (e.status === 'rejected') console.error('[wa-mantenimiento]', e.reason?.message ?? e.reason);
    const r = {
        cerradas: c.status === 'fulfilled' ? c.value : 0,
        expirados: e.status === 'fulfilled' ? e.value : 0,
    };
    if (r.cerradas || r.expirados) {
        console.log(`[wa-mantenimiento] ${r.cerradas} conversación(es) cerrada(s) por inactividad, `
            + `${r.expirados} borrador(es) expirado(s).`);
    }
    return r;
}
