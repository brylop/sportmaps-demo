/**
 * ¿Puede quien llama ver/tocar este equipo?
 *
 * El BFF corre con service role (salta RLS): este chequeo ES el gate. Hallazgo
 * 2026-10-10: GET /reports/coach/:teamId solo validaba la escuela para
 * `school_admin`, así que un coach (o un owner) podía leer el roster y los
 * resultados de un equipo de OTRA escuela con su UUID.
 *
 * Regla:
 *   · El equipo tiene que ser de la escuela de la sesión (req.schoolId), salvo
 *     staff de plataforma (`super_admin`, que el middleware solo asigna a
 *     quien figura en platform_admins).
 *   · Un `coach` además tiene que dirigirlo: teams.coach_id o team_coaches,
 *     ambos = school_staff.id resuelto por coach_auth_id (mismo criterio que
 *     assertCoachHasTeamAccess de attendance.ts).
 *   · El resto de roles que la ruta ya admite ven todos los equipos de SU escuela.
 *
 * Equipo de otra escuela → 404 (no se confirma que exista).
 */

export interface SesionEquipo {
    role?: string | null;
    schoolId?: string | null;
    userId?: string | null;
}

export type AccesoEquipo<T> =
    | { ok: true; team: T }
    | { ok: false; status: 403 | 404; error: string };

// Cliente mínimo: lo que usa la función (supabase-js lo cumple).
type Db = { from: (tabla: string) => any };

const TEAM_COLS = 'id, name, age_group, sport, coach_id, school_id';

export async function resolverAccesoEquipo<T extends { id: string; school_id: string | null; coach_id: string | null }>(
    db: Db,
    sesion: SesionEquipo,
    teamId: string,
    cols: string = TEAM_COLS,
): Promise<AccesoEquipo<T>> {
    const noEncontrado = { ok: false as const, status: 404 as const, error: 'Equipo no encontrado.' };
    if (!teamId) return noEncontrado;

    const { data: team, error } = await db.from('teams').select(cols).eq('id', teamId).maybeSingle();
    if (error || !team) return noEncontrado;

    const esPlataforma = sesion.role === 'super_admin';
    if (!esPlataforma && (!sesion.schoolId || team.school_id !== sesion.schoolId)) {
        return noEncontrado;
    }

    if (sesion.role !== 'coach') return { ok: true, team: team as T };

    const sinPermiso = { ok: false as const, status: 403 as const, error: 'No diriges este equipo.' };
    if (!sesion.userId) return sinPermiso;

    const { data: staff } = await db
        .from('school_staff')
        .select('id')
        .eq('coach_auth_id', sesion.userId)
        .eq('school_id', team.school_id)
        .eq('status', 'active')
        .maybeSingle();
    if (!staff?.id) return sinPermiso;

    if (team.coach_id === staff.id) return { ok: true, team: team as T };

    const { data: tc } = await db
        .from('team_coaches')
        .select('id')
        .eq('team_id', teamId)
        .eq('coach_id', staff.id)
        .maybeSingle();
    return tc ? { ok: true, team: team as T } : sinPermiso;
}
