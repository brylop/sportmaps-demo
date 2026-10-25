/**
 * Quién puede tocar los informes de equipo (B6 de docs/specs/entrenador-deportista-v2.md).
 *
 * El BFF corre con service role: estas funciones SON el gate de las rutas de
 * `routes/school/reports.ts` que no pasan por una RPC con chequeo propio
 * (`publish_team_report_system` exige service_role y no mira al caller).
 *
 * 1. Publicar el informe GRUPAL: la administración siempre; el entrenador solo
 *    si la escuela delegó la publicación («Quién publica y envía» =
 *    `school_settings.reports_release_by = 'coach'`) y solo sus equipos.
 *    Antes la ruta era solo de admin y el «Publicar» del coach daba 403 aunque
 *    la escuela se lo permitiera.
 *
 * 2. Nota por bloque (PUT /reports/team-section-note): el `report_id` venía del
 *    body sin validar (IDOR). Un staff podía colgar notas en informes de OTRA
 *    escuela (la fila quedaba con su school_id y el report_id ajeno) y un coach
 *    en los de equipos que no dirige — y la nota 'general' del informe de
 *    equipo es justo la que viaja a las familias.
 */
import { resolverAccesoEquipo, type SesionEquipo } from './team-access.service';

type Db = { from: (tabla: string) => any };

export const ROLES_ADMIN_INFORMES = ['owner', 'super_admin', 'admin', 'school_admin'] as const;

export type Resultado =
    | { ok: true }
    | { ok: false; status: 403 | 404; error: string };

const esAdmin = (role?: string | null) => (ROLES_ADMIN_INFORMES as readonly string[]).includes(role ?? '');

/**
 * Todo lo que no es administración se trata como ENTRENADOR: solo sus equipos.
 * Las rutas de informes admiten también el rol `staff` (STAFF_ROLES de
 * routes/school/reports.ts) y `resolverAccesoEquipo` deja pasar a cualquier rol
 * distinto de `coach` a TODOS los equipos de la escuela: un `staff` podía
 * publicar el informe de cualquier equipo y escribir notas en cualquier
 * informe (b7 de la revisión V2). Hoy no hay miembros activos con ese rol,
 * pero el middleware lo asigna desde school_members.role: se cierra aquí, en el
 * gate, sin tocar las otras rutas que comparten STAFF_ROLES. Si ese `staff`
 * además dirige equipos (school_staff.coach_auth_id), los suyos sí le quedan.
 */
const comoEntrenadorSiNoEsAdmin = (sesion: SesionEquipo): SesionEquipo =>
    esAdmin(sesion.role) ? sesion : { ...sesion, role: 'coach' };

/** ¿Puede publicar el informe de equipo de `teamId`? */
export async function puedePublicarInformeEquipo(db: Db, sesionOriginal: SesionEquipo, teamId: string): Promise<Resultado> {
    const sesion = comoEntrenadorSiNoEsAdmin(sesionOriginal);
    const acceso = await resolverAccesoEquipo(db, sesion, teamId);
    if (!acceso.ok) return { ok: false, status: acceso.status, error: acceso.error };
    // La ruta escribe team_reports con req.schoolId: el equipo tiene que ser de
    // esa escuela también para plataforma (resolverAccesoEquipo la deja cruzar).
    if (acceso.team.school_id !== sesion.schoolId) {
        return { ok: false, status: 404, error: 'Equipo no encontrado.' };
    }
    if (esAdmin(sesion.role)) return { ok: true };

    const { data: ajustes } = await db
        .from('school_settings')
        .select('reports_release_by')
        .eq('school_id', acceso.team.school_id)
        .maybeSingle();

    if ((ajustes as any)?.reports_release_by !== 'coach') {
        return { ok: false, status: 403, error: 'En esta escuela la publicación la hace la administración.' };
    }
    return { ok: true };
}

export interface DestinoNota {
    report_type: 'athlete' | 'team';
    report_id: string;
}

/**
 * ¿Puede escribir una nota de bloque sobre ese informe?
 * `coachVeInformeAtleta` resuelve, COMO EL USUARIO (RLS de athlete_reports →
 * coach_can_see_report), si un coach ve ese informe individual.
 */
export async function puedeEscribirNotaBloque(
    db: Db,
    sesionOriginal: SesionEquipo,
    destino: DestinoNota,
    coachVeInformeAtleta: (reportId: string) => Promise<boolean>,
): Promise<Resultado> {
    const sesion = comoEntrenadorSiNoEsAdmin(sesionOriginal);
    const noEncontrado = { ok: false as const, status: 404 as const, error: 'Informe no encontrado.' };
    if (!sesion.schoolId || !destino.report_id) return noEncontrado;

    if (destino.report_type === 'team') {
        const { data: informe } = await db
            .from('team_reports')
            .select('id, team_id, school_id')
            .eq('id', destino.report_id)
            .maybeSingle();
        if (!informe || informe.school_id !== sesion.schoolId) return noEncontrado;

        const acceso = await resolverAccesoEquipo(db, sesion, informe.team_id);
        return acceso.ok ? { ok: true } : { ok: false, status: acceso.status, error: acceso.error };
    }

    const { data: informe } = await db
        .from('athlete_reports')
        .select('id, school_id')
        .eq('id', destino.report_id)
        .maybeSingle();
    if (!informe || informe.school_id !== sesion.schoolId) return noEncontrado;

    if (esAdmin(sesion.role)) return { ok: true };
    return (await coachVeInformeAtleta(destino.report_id))
        ? { ok: true }
        : { ok: false, status: 403, error: 'Este informe no es de tus equipos.' };
}

export interface DeportistaPropio {
    subjectType: 'profile' | 'unregistered';
    subjectId: string;
    schoolId: string;
    name: string;
}

/**
 * B4: el deportista con cuenta pide SU informe del entreno (vista grupal con
 * su dato encima). Resuelve quién es él dentro de `teamId`, sin child_id:
 *   · adulto inscrito con su cuenta → enrollments.user_id = yo
 *   · ficha vinculada a su cuenta  → unregistered_athletes.linked_profile_id = yo
 *     y esa ficha inscrita en el equipo
 * Solo inscripciones ACTIVAS, igual que la vista del acudiente. null = no es
 * deportista de ese equipo (la ruta responde 403).
 */
export async function resolverDeportistaPropio(db: Db, userId: string | undefined, teamId: string): Promise<DeportistaPropio | null> {
    if (!userId || !teamId) return null;

    const { data: propia } = await db
        .from('enrollments')
        .select('id, school_id')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
    if (propia?.school_id) {
        const { data: perfil } = await db.from('profiles').select('full_name').eq('id', userId).maybeSingle();
        return { subjectType: 'profile', subjectId: userId, schoolId: propia.school_id, name: perfil?.full_name ?? '' };
    }

    const { data: fichas } = await db
        .from('unregistered_athletes')
        .select('id, full_name')
        .eq('linked_profile_id', userId);
    const ids = ((fichas ?? []) as { id: string }[]).map((f) => f.id);
    if (ids.length === 0) return null;

    const { data: deFicha } = await db
        .from('enrollments')
        .select('unregistered_athlete_id, school_id')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .in('unregistered_athlete_id', ids)
        .limit(1)
        .maybeSingle();
    if (!deFicha?.school_id) return null;

    const ficha = (fichas as { id: string; full_name: string | null }[]).find((f) => f.id === deFicha.unregistered_athlete_id);
    return {
        subjectType: 'unregistered',
        subjectId: deFicha.unregistered_athlete_id,
        schoolId: deFicha.school_id,
        name: ficha?.full_name ?? '',
    };
}
