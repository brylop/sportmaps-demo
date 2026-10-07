/**
 * invitaciones-atleta-inactivo — no invitar a la familia de un atleta que la
 * escuela ya dio de baja.
 *
 * Caso real (2026-10-06): Dynasty desactivó a Isabella Mancera Sarmiento
 * (children.is_active=false, inscripción cancelada) pero su invitación de
 * acudiente seguía 'pending' y el reenvío masivo le volvía a escribir a la
 * mamá. La base se arregla aparte (otra migración); esto es la defensa en
 * profundidad del BFF.
 *
 * Vínculo invitación → atleta:
 *   · ficha sin cuenta: unregistered_athletes.invitation_id = invitations.id.
 *     Si la ficha está inactiva y nadie la reclamó (linked_profile_id IS NULL)
 *     → se excluye. Si la ficha está activa → se invita.
 *   · children: no hay FK. Se cruza por nombre normalizado
 *     (lower(trim(child_name)) = lower(trim(full_name))) contra los children de
 *     la escuela (children.school_id o con inscripción en la escuela) y las
 *     fichas de la escuela. Se excluye solo si hay coincidencia y NINGUNA
 *     coincidencia está activa: un homónimo activo gana (mejor un correo de
 *     más que dejar sin invitación a un atleta vigente).
 *
 * Las invitaciones de coach (y demás roles de staff) no se tocan: su
 * child_name es el nombre del coach.
 */

import { supabase } from '../config/supabase';

/** Roles de invitación que corresponden a la familia de un atleta. */
const ROLES_DE_ATLETA = new Set(['parent', 'athlete']);

export interface InvitacionMin {
    id: string;
    role_to_assign?: string | null;
    child_name?: string | null;
}

export interface DatosAtletaInvitacion {
    /** Fichas sin cuenta vinculadas por invitation_id. */
    fichasPorInvitacion: { invitation_id: string; is_active: boolean | null; linked_profile_id: string | null }[];
    /** Atletas de la escuela (children + fichas) con su nombre y si están activos. */
    atletasDeLaEscuela: { full_name: string | null; is_active: boolean | null }[];
}

export const normalizarNombre = (s: string | null | undefined) =>
    String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** is_active NULL se lee como activo (columna con default true; NULL = sin baja explícita). */
const activo = (v: boolean | null | undefined) => v !== false;

/**
 * Pura: ids de las invitaciones cuyo atleta está inactivo (y por lo tanto no
 * deben recibir correo).
 */
export function invitacionesDeAtletaInactivo(invitaciones: InvitacionMin[], datos: DatosAtletaInvitacion): Set<string> {
    const fichaPorInv = new Map<string, { activa: boolean; reclamada: boolean }[]>();
    for (const f of datos.fichasPorInvitacion) {
        const l = fichaPorInv.get(f.invitation_id) ?? [];
        l.push({ activa: activo(f.is_active), reclamada: !!f.linked_profile_id });
        fichaPorInv.set(f.invitation_id, l);
    }

    // nombre normalizado → ¿hay alguno activo con ese nombre?
    const activoPorNombre = new Map<string, boolean>();
    for (const a of datos.atletasDeLaEscuela) {
        const n = normalizarNombre(a.full_name);
        if (!n) continue;
        activoPorNombre.set(n, (activoPorNombre.get(n) ?? false) || activo(a.is_active));
    }

    const out = new Set<string>();
    for (const inv of invitaciones) {
        if (!ROLES_DE_ATLETA.has(String(inv.role_to_assign ?? ''))) continue;

        const fichas = fichaPorInv.get(inv.id);
        if (fichas?.length) {
            // La ficha vinculada manda: si alguna sigue activa (o ya la reclamó
            // una cuenta), la invitación es legítima.
            if (fichas.some((f) => f.activa || f.reclamada)) continue;
            out.add(inv.id);
            continue;
        }

        const n = normalizarNombre(inv.child_name);
        if (!n) continue;
        if (activoPorNombre.get(n) === false) out.add(inv.id);
    }
    return out;
}

async function todas<T>(q: (desde: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
    const out: T[] = [];
    for (let desde = 0; ; desde += 1000) {
        const { data, error } = await q(desde);
        if (error) throw new Error(error.message);
        out.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return out;
    }
}

const trozos = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / 200) }, (_, i) => a.slice(i * 200, i * 200 + 200));

/**
 * Lee en lote lo que necesita `invitacionesDeAtletaInactivo` para una escuela.
 * Consultas fijas (paginadas), no una por invitación.
 */
export async function cargarDatosAtletaInvitacion(schoolId: string, invitaciones: InvitacionMin[]): Promise<DatosAtletaInvitacion> {
    const deAtleta = invitaciones.filter((i) => ROLES_DE_ATLETA.has(String(i.role_to_assign ?? '')));
    if (deAtleta.length === 0) return { fichasPorInvitacion: [], atletasDeLaEscuela: [] };

    const fichasPorInvitacion = (await Promise.all(trozos(deAtleta.map((i) => i.id)).map(async (t) => {
        const { data, error } = await supabase.from('unregistered_athletes')
            .select('invitation_id, is_active, linked_profile_id').in('invitation_id', t);
        if (error) throw new Error(error.message);
        return (data ?? []) as DatosAtletaInvitacion['fichasPorInvitacion'];
    }))).flat();

    const [hijosEscuela, inscritos, fichasEscuela] = await Promise.all([
        todas<{ id: string; full_name: string | null; is_active: boolean | null }>((d) => supabase.from('children')
            .select('id, full_name, is_active').eq('school_id', schoolId).order('id').range(d, d + 999)),
        todas<{ child_id: string | null }>((d) => supabase.from('enrollments')
            .select('child_id').eq('school_id', schoolId).not('child_id', 'is', null).order('id').range(d, d + 999)),
        todas<{ full_name: string | null; is_active: boolean | null }>((d) => supabase.from('unregistered_athletes')
            .select('id, full_name, is_active').eq('school_id', schoolId).order('id').range(d, d + 999)),
    ]);

    // Children con inscripción en la escuela pero school_id de otra (o NULL).
    const yaLeidos = new Set(hijosEscuela.map((h) => h.id));
    const faltan = [...new Set(inscritos.map((e) => e.child_id).filter((id): id is string => !!id && !yaLeidos.has(id)))];
    const hijosInscritos = (await Promise.all(trozos(faltan).map(async (t) => {
        const { data, error } = await supabase.from('children').select('id, full_name, is_active').in('id', t);
        if (error) throw new Error(error.message);
        return (data ?? []) as { full_name: string | null; is_active: boolean | null }[];
    }))).flat();

    return {
        fichasPorInvitacion,
        atletasDeLaEscuela: [...hijosEscuela, ...hijosInscritos, ...fichasEscuela]
            .map((a) => ({ full_name: a.full_name, is_active: a.is_active })),
    };
}

/** Atajo: carga + filtro. */
export async function idsInvitacionesDeAtletaInactivo(schoolId: string, invitaciones: InvitacionMin[]): Promise<Set<string>> {
    return invitacionesDeAtletaInactivo(invitaciones, await cargarDatosAtletaInvitacion(schoolId, invitaciones));
}
