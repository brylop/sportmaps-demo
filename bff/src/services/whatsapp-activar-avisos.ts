/**
 * «Activar avisos por WhatsApp» desde fuera del chat — el consentimiento lo da
 * el NÚMERO, escribiendo él mismo.
 *
 * Por qué existe. En Dynasty (2026-10-08) 13 de ~350 familias tenían opt-in.
 * El bot solo pregunta dentro de una conversación ya abierta, a familias
 * identificadas y al final de un turno resuelto: 95 de 237 conversaciones
 * llegaron a ser elegibles y solo a 28 les salió la pregunta. Las ~250 familias
 * que nunca escribieron no tenían cómo darlo, y son justo las que reciben el
 * estado de cuenta por CORREO porque el WhatsApp no sale (`sin_optin`).
 *
 * Por qué un enlace wa.me y no una casilla en la web. El consentimiento es por
 * número + escuela (`whatsapp_optins.contact_wa_id`). Una casilla en /p/:token
 * no prueba que quien la marca sea el dueño del número: el enlace se reenvía.
 * El enlace abre WhatsApp con el texto prellenado; la familia lo ENVÍA desde su
 * teléfono, Meta autentica el `from`, y el bot registra el opt-in con
 * `source='user_confirmed'` y `source_ref` = el wa_message_id de ESE mensaje
 * (la misma prueba que un «SÍ» al bot). No hace falta migración.
 *
 * El texto termina en «ACTIVAR AVISOS» para que el bot lo reconozca aunque la
 * familia edite el principio. Nunca por subcadena suelta: «no quiero activar
 * avisos» no activa nada.
 */

import { supabase } from '../config/supabase';
import { aWaId } from './whatsapp-plantillas.service';

export const CLAVE_ACTIVAR_AVISOS = 'ACTIVAR AVISOS';

/** El texto prellenado del enlace. */
export function textoActivarAvisos(escuela: string): string {
    return `Hola, quiero recibir por aquí los recordatorios de pago y los avisos de ${escuela}. ${CLAVE_ACTIVAR_AVISOS}`;
}

function normalizar(t: string): string {
    return t
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * ¿El mensaje es un pedido explícito de activar los avisos? Pura.
 *   «ACTIVAR AVISOS» solo, o un mensaje que TERMINA en «activar avisos» y no
 *   tiene una negación («no», «no quiero», «desactivar»).
 */
export function esActivacionDeAvisos(texto: string | null | undefined): boolean {
    const n = normalizar(String(texto ?? ''));
    if (!n || n.length > 300) return false;
    if (n === 'activar avisos' || n === 'activar avisos por whatsapp') return true;
    if (!/(^| )activar avisos( por whatsapp)?$/.test(n)) return false;
    return !/(^| )(no|desactivar|nunca|jamas)( |$)/.test(n.replace(/ activar avisos( por whatsapp)?$/, ''));
}

/** wa.me de la línea de la escuela con el texto de activación, o null. */
export function enlaceActivarAvisos(telefonoEscuela: string | null | undefined, escuela: string): string | null {
    const digitos = String(telefonoEscuela ?? '').replace(/\D/g, '');
    if (digitos.length < 10) return null;
    return `https://wa.me/${digitos}?text=${encodeURIComponent(textoActivarAvisos(escuela))}`;
}

/**
 * El enlace para la página /p/:token del cobro de `parentId`, o null si la
 * escuela no tiene WhatsApp activo o si el número del perfil ya tiene opt-in
 * vigente (no se le ofrece lo que ya dio). Nunca lanza.
 */
export async function enlaceActivarAvisosParaPagador(
    schoolId: string,
    parentId: string | null,
    escuela: string,
): Promise<string | null> {
    try {
        const { data: integ } = await supabase
            .from('school_whatsapp_integrations')
            .select('id, display_phone_number')
            .eq('school_id', schoolId)
            .eq('status', 'active')
            .maybeSingle();
        const enlace = enlaceActivarAvisos((integ as any)?.display_phone_number, escuela);
        if (!enlace) return null;
        if (!parentId) return enlace;
        const { data: perfil } = await supabase.from('profiles').select('phone').eq('id', parentId).maybeSingle();
        const waId = aWaId((perfil as any)?.phone);
        if (!waId) return enlace;
        const { data: optin } = await supabase
            .from('whatsapp_optins')
            .select('opted_in_at, opted_out_at')
            .eq('integration_id', (integ as any).id)
            .eq('contact_wa_id', waId)
            .maybeSingle();
        const vigente = !!(optin as any)?.opted_in_at && !(optin as any)?.opted_out_at;
        return vigente ? null : enlace;
    } catch {
        return null;
    }
}
