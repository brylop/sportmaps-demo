/**
 * Estado de opt-in del contacto — el ESTADO, no el evento.
 *
 * Por qué existe. La ingesta devuelve `opted_out: true` solo cuando **el mensaje
 * actual** trae una palabra de baja (STOP, baja, no molestar…). Eso alcanza para
 * confirmar la baja en el momento, pero no para saber si alguien que se dio de
 * baja *antes* sigue dado de baja.
 *
 * El bug que esto arregla, medido el 2026-09-11 en la conversación de prueba:
 *
 *   11:36:07  «Stop»  → opt-out registrado, se le responde «no volverás a
 *                       recibir mensajes automáticos»
 *   17:38:47  imagen  → como una imagen no trae texto, la ingesta devolvió
 *                       opted_out=false y el bot la proceso y le respondio
 *
 * Nadie consultaba `whatsapp_optins`. Se miraba el evento y nunca el estado.
 */

import { supabase } from '../config/supabase';

/**
 * ¿Este contacto pidió que no le escriban?
 *
 * `opted_out_at` no null y posterior al `opted_in_at` (si lo hay). Ante la duda
 * —error de consulta— devuelve `false`: dejar de responderle a alguien que SÍ
 * dio consentimiento es peor que el caso contrario, porque queda hablando solo.
 */
export async function estaDadoDeBaja(
    integrationId: string,
    contactWaId: string,
): Promise<boolean> {
    const { data, error } = await supabase
        .from('whatsapp_optins')
        .select('opted_in_at, opted_out_at')
        .eq('integration_id', integrationId)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();

    if (error || !data?.opted_out_at) return false;
    if (!data.opted_in_at) return true;
    return new Date(data.opted_out_at) >= new Date(data.opted_in_at);
}

/**
 * Coletilla para quien está dado de baja pero nos escribió.
 *
 * Decisión de producto: se le responde igual. La baja silencia los mensajes
 * *automáticos proactivos* —que es lo que se le prometió—, pero si él inicia el
 * contacto, dejarlo hablando solo es peor. Lo que no puede pasar es que reciba
 * respuesta sin enterarse de que sigue con las notificaciones apagadas.
 */
export const AVISO_DADO_DE_BAJA =
    '\n\n_Tienes las notificaciones de la escuela apagadas. Escríbeme *ACTIVAR* si quieres volver a recibirlas._';
