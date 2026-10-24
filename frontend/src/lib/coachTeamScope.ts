/**
 * Alcance del ENTRENADOR sobre equipos y deportistas.
 *
 * Regla (migración 20261010201426_coach_alcance_equipos_contactos):
 *   · El coach EDITA solo los equipos que dirige (teams.coach_id o team_coaches,
 *     ambos = school_staff.id). No crea, no archiva, no borra, no cambia
 *     precio, sede ni entrenadores.
 *   · Excepción por escuela `coach_can_create_teams` (Carmel): crea equipos y
 *     gestiona los SUYOS (archivar/borrar incluidos), sin reasignar entrenador.
 *   · Teléfono/correo de acudientes: solo de los deportistas de sus equipos,
 *     salvo `coach_can_see_all_contacts`.
 *
 * La base lo hace cumplir (RLS + trigger); esto es para que la pantalla no
 * ofrezca botones que van a fallar ni liste lo que no corresponde.
 */
import { supabase } from '@/integrations/supabase/client';
import { modalityToSave } from '@/lib/sports/footballModality';

/** Roles que administran la escuela (mismo criterio que user_admin_school_ids()). */
export const SCHOOL_ADMIN_ROLES = ['owner', 'school', 'admin', 'school_admin', 'super_admin'] as const;

export function isSchoolAdminRole(role: string | null | undefined): boolean {
    return !!role && (SCHOOL_ADMIN_ROLES as readonly string[]).includes(role);
}

export interface TeamScopeCtx {
    role: string | null | undefined;
    /** school_settings.coach_can_create_teams */
    coachCanCreateTeams: boolean;
}

export function canCreateTeam(ctx: TeamScopeCtx): boolean {
    if (isSchoolAdminRole(ctx.role)) return true;
    return ctx.role === 'coach' && ctx.coachCanCreateTeams;
}

/** Editar datos deportivos (nombre, categoría, descripción, cupo, foto). */
export function canEditTeam(ctx: TeamScopeCtx, coachesThisTeam: boolean): boolean {
    if (isSchoolAdminRole(ctx.role)) return true;
    return ctx.role === 'coach' && coachesThisTeam;
}

/**
 * Archivar / reactivar / eliminar. Administración siempre. El coach solo en
 * escuelas con coach_can_create_teams y sobre equipos donde es el entrenador
 * PRINCIPAL (teams.coach_id) — exactamente lo que ya permitía la policy de
 * Carmel; para el resto de escuelas no aplica.
 */
export function canArchiveOrDeleteTeam(ctx: TeamScopeCtx, isPrincipalCoach: boolean): boolean {
    if (isSchoolAdminRole(ctx.role)) return true;
    return ctx.role === 'coach' && ctx.coachCanCreateTeams && isPrincipalCoach;
}

export interface TeamFormValues {
    name: string;
    description: string;
    sport: string;
    /** '11' | '7' | '5' | '' — solo cuenta si el deporte es Fútbol. */
    sport_modality?: string;
    level: string;
    max_students: number | '';
    location: string;
    price_monthly: number | '';
    coach_ids: string[];
    branch_ids: string[];
    status: string;
    image_url: string | null;
}

export interface TeamWriteCtx {
    isAdmin: boolean;
    isCreate: boolean;
    schoolId: string;
    branchId?: string | null;
    /** school_staff.id del coach que guarda (para crear en escuelas con coach_can_create_teams). */
    ownStaffId?: string | null;
}

/**
 * Qué se manda a `teams` y si se sincronizan team_coaches/team_branches.
 * Administración: todo, como siempre. Coach: solo datos deportivos; al crear
 * (solo con coach_can_create_teams) queda él como entrenador principal, sin
 * precio y activo. Nunca sincroniza team_coaches/team_branches (asignar
 * acceso es de administración; la RLS lo niega).
 */
export function buildTeamWritePayload(form: TeamFormValues, ctx: TeamWriteCtx) {
    const deportivo = {
        name: form.name,
        description: form.description,
        sport: form.sport,
        sport_modality: modalityToSave(form.sport, form.sport_modality),
        level: form.level,
        max_students: form.max_students === '' ? null : Number(form.max_students),
        location: form.location,
        image_url: form.image_url || null,
    };

    if (ctx.isAdmin) {
        return {
            syncRelations: true,
            payload: {
                ...deportivo,
                price_monthly: form.price_monthly === '' ? 0 : Number(form.price_monthly),
                coach_id: form.coach_ids.length > 0 ? form.coach_ids[0] : null,
                branch_id: form.branch_ids.length > 0 ? form.branch_ids[0] : (ctx.branchId || null),
                school_id: ctx.schoolId,
                status: form.status,
            } as Record<string, unknown>,
        };
    }

    if (ctx.isCreate) {
        return {
            syncRelations: false,
            payload: {
                ...deportivo,
                price_monthly: 0,
                coach_id: ctx.ownStaffId ?? null,
                branch_id: ctx.branchId || null,
                school_id: ctx.schoolId,
                status: 'active',
            } as Record<string, unknown>,
        };
    }

    return { syncRelations: false, payload: deportivo as Record<string, unknown> };
}

/** ¿El deportista (fila de school_athletes) está en alguno de estos equipos? */
export function athleteInTeams(
    row: { id: string; team_id?: string | null; enrolled_team_id?: string | null },
    teamIds: ReadonlySet<string>,
    enrolledAthleteIds?: ReadonlySet<string>,
): boolean {
    if (row.enrolled_team_id && teamIds.has(row.enrolled_team_id)) return true;
    if (row.team_id && teamIds.has(row.team_id)) return true;
    return !!enrolledAthleteIds?.has(row.id);
}

export interface CoachStaffRef { staffId: string | null; teamIds: string[] }

/** Escapa los comodines de LIKE (`%`, `_`, `\`) para comparar un correo literal con ilike. */
export function escapeLike(valor: string): string {
    return valor.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Ficha de staff y equipos del coach en esta escuela. Resuelve por
 * coach_auth_id y, si la ficha no está vinculada, por correo (sin distinguir
 * mayúsculas) — igual que user_coached_team_ids(). Falla CERRADO: sin ficha,
 * cero equipos (antes /students caía a toda la escuela).
 */
export async function fetchCoachTeams(schoolId: string): Promise<CoachStaffRef> {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const email = auth.user?.email;
    if (!uid || !schoolId) return { staffId: null, teamIds: [] };

    let { data: staff } = await (supabase as any)
        .from('school_staff')
        .select('id')
        .eq('school_id', schoolId)
        .eq('coach_auth_id', uid)
        .maybeSingle();
    if (!staff && email) {
        ({ data: staff } = await (supabase as any)
            .from('school_staff')
            .select('id')
            .eq('school_id', schoolId)
            .is('coach_auth_id', null)
            .ilike('email', escapeLike(email))
            .maybeSingle());
    }
    const staffId: string | null = staff?.id ?? null;
    if (!staffId) return { staffId: null, teamIds: [] };

    const [{ data: principal }, { data: asistente }] = await Promise.all([
        (supabase as any).from('teams').select('id').eq('school_id', schoolId).eq('coach_id', staffId),
        (supabase as any).from('team_coaches').select('team_id').eq('coach_id', staffId),
    ]);
    const teamIds = [...new Set([
        ...((principal ?? []) as { id: string }[]).map((t) => t.id),
        ...((asistente ?? []) as { team_id: string }[]).map((t) => t.team_id),
    ])];
    return { staffId, teamIds };
}

/** Deportistas con inscripción activa en estos equipos (ids de children / profiles / unregistered). */
export async function fetchAthleteIdsInTeams(teamIds: string[]): Promise<Set<string>> {
    if (teamIds.length === 0) return new Set();
    const { data } = await (supabase as any)
        .from('enrollments')
        .select('child_id, user_id, unregistered_athlete_id')
        .in('team_id', teamIds)
        .eq('status', 'active');
    const ids = new Set<string>();
    for (const e of (data ?? []) as any[]) {
        if (e.child_id) ids.add(e.child_id);
        if (e.user_id) ids.add(e.user_id);
        if (e.unregistered_athlete_id) ids.add(e.unregistered_athlete_id);
    }
    return ids;
}

/** Flags de alcance del coach. select('*') para no romper si la migración aún no está aplicada. */
export async function fetchCoachScopeSettings(schoolId: string): Promise<{ coachCanCreateTeams: boolean }> {
    if (!schoolId) return { coachCanCreateTeams: false };
    const { data } = await (supabase as any)
        .from('school_settings')
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle();
    return { coachCanCreateTeams: data?.coach_can_create_teams === true };
}
