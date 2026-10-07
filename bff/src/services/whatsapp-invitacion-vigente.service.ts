/**
 * whatsapp-invitacion-vigente — la invitación pendiente de un contacto, SOLO si
 * su atleta sigue activo.
 *
 * El bot de WhatsApp ofrece `/register?invite=<id>` a la familia sin cuenta
 * (whatsapp-bot.service, aviso `debe_registrarse`; whatsapp-queue.job, mensaje
 * de familia sin cuenta). La invitación la encuentra
 * `wa_invitacion_pendiente_por_telefono`, que HOY ya filtra `children.is_active`
 * y `unregistered_athletes.is_active`; esto es la defensa del BFF por si la RPC
 * cambia (deriva de esquema, otra versión aplicada a mano) y para el vínculo por
 * nombre, que la RPC no mira contra TODOS los homónimos de la escuela.
 *
 * Caso real (Dynasty, 2026-10-06): a Beverly Sarmiento el bot le ofreció el
 * enlace de la invitación de Isabella Mancera Sarmiento; la escuela la dio de
 * baja nueve minutos después y la invitación siguió 'pending'. A la familia de
 * un atleta inactivo no se le ofrece crear la cuenta.
 *
 * La regla (cuándo una invitación es de un atleta inactivo) es la de
 * `invitaciones-atleta-inactivo.service`, la misma que usa el reenvío de
 * invitaciones: ficha por `invitation_id` primero; si no hay, children y fichas
 * de la escuela por nombre normalizado, inactiva solo si hay coincidencia y
 * NINGUNA está activa.
 */

import { supabase } from '../config/supabase';
import { invitacionesDeAtletaInactivo, normalizarNombre } from './invitaciones-atleta-inactivo.service';

export interface InvitacionPendiente {
    invite_id?: string;
    email?: string | null;
    child_name?: string | null;
}

export interface InvitacionVigente {
    /** La invitación que se puede ofrecer, o null. */
    invitacion: InvitacionPendiente | null;
    /** Había invitación pendiente pero su atleta está inactivo: no se ofrece. */
    atletaInactivo: boolean;
}

/** `%` entre palabras: ilike tolera espacios dobles; la igualdad exacta la decide `normalizarNombre`. */
function patronIlike(nombre: string): string {
    return nombre.trim().split(/\s+/)
        .map((p) => p.replace(/[\\%_]/g, (c) => `\\${c}`))
        .join('%');
}

/**
 * ¿La invitación es de un atleta inactivo? Consultas acotadas a esa invitación
 * (no carga la escuela entera: corre por mensaje).
 */
export async function esInvitacionDeAtletaInactivo(schoolId: string, inviteId: string): Promise<boolean> {
    const { data: fila, error } = await supabase.from('invitations')
        .select('id, role_to_assign, child_name, school_id')
        .eq('id', inviteId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (!fila) return false;

    const inv = fila as { id: string; role_to_assign: string | null; child_name: string | null; school_id: string | null };
    const escuela = inv.school_id || schoolId;
    const nombre = (inv.child_name ?? '').trim();

    const vacio = Promise.resolve({ data: [] as any[], error: null as any });
    const [porInvitacion, hijos, fichas] = await Promise.all([
        supabase.from('unregistered_athletes')
            .select('invitation_id, is_active, linked_profile_id')
            .eq('invitation_id', inviteId),
        nombre
            ? supabase.from('children').select('full_name, is_active')
                .eq('school_id', escuela).ilike('full_name', patronIlike(nombre))
            : vacio,
        nombre
            ? supabase.from('unregistered_athletes').select('full_name, is_active')
                .eq('school_id', escuela).ilike('full_name', patronIlike(nombre))
            : vacio,
    ]);
    for (const r of [porInvitacion, hijos, fichas]) {
        if ((r as any)?.error) throw new Error((r as any).error.message);
    }

    const n = normalizarNombre(nombre);
    const atletas = [...((hijos as any).data ?? []), ...((fichas as any).data ?? [])]
        .filter((a: any) => normalizarNombre(a?.full_name) === n)
        .map((a: any) => ({ full_name: a.full_name as string | null, is_active: a.is_active as boolean | null }));

    return invitacionesDeAtletaInactivo(
        [{ id: inv.id, role_to_assign: inv.role_to_assign, child_name: inv.child_name }],
        { fichasPorInvitacion: ((porInvitacion as any).data ?? []), atletasDeLaEscuela: atletas },
    ).has(inv.id);
}

/**
 * La invitación pendiente del contacto (`wa_invitacion_pendiente_por_telefono`)
 * filtrada por atleta activo. Si la verificación falla se ofrece igual (es lo
 * que hacía antes y lo que la RPC ya filtra): un error de lectura no puede
 * dejar sin enlace a una familia vigente.
 */
export async function invitacionPendienteVigente(
    integrationId: string,
    contactWaId: string,
    schoolId: string,
): Promise<InvitacionVigente> {
    const { data } = await supabase.rpc('wa_invitacion_pendiente_por_telefono', {
        p_integration_id: integrationId,
        p_contact_wa_id: contactWaId,
    });
    const invitacion = data as InvitacionPendiente | null;
    if (!invitacion?.invite_id) return { invitacion: null, atletaInactivo: false };

    try {
        if (await esInvitacionDeAtletaInactivo(schoolId, invitacion.invite_id)) {
            return { invitacion: null, atletaInactivo: true };
        }
    } catch (e: any) {
        console.warn('[whatsapp] no se pudo verificar si el atleta de la invitación está activo',
            { inviteId: invitacion.invite_id, err: e?.message ?? e });
    }
    return { invitacion, atletaInactivo: false };
}
