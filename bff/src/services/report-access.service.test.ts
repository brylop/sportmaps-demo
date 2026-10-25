/**
 * B6 (entrenador-deportista-v2): publicar el informe grupal con permiso de la
 * escuela + IDOR de la nota por bloque. B4: el deportista pide su informe del
 * entreno sin child_id.
 */
import { describe, it, expect } from 'vitest';
import { puedePublicarInformeEquipo, puedeEscribirNotaBloque, resolverDeportistaPropio } from './report-access.service';

const ESC_A = 'school-a';
const ESC_B = 'school-b';

// Base en memoria con el encadenado de supabase-js que usa el servicio.
function fakeDb(rows: Record<string, any[]>) {
    return {
        from(tabla: string) {
            const filtros: ((r: any) => boolean)[] = [];
            const resultado = () => (rows[tabla] ?? []).filter((r) => filtros.every((f) => f(r)));
            const q: any = {
                select: () => q,
                limit: () => q,
                eq: (col: string, val: any) => { filtros.push((r) => r[col] === val); return q; },
                in: (col: string, vals: any[]) => { filtros.push((r) => vals.includes(r[col])); return q; },
                maybeSingle: async () => ({ data: resultado()[0] ?? null, error: null }),
                then: (ok: any, ko: any) => Promise.resolve({ data: resultado(), error: null }).then(ok, ko),
            };
            return q;
        },
    };
}

const base = {
    teams: [
        { id: 'team-propio', school_id: ESC_A, coach_id: 'staff-coach-a' },
        { id: 'team-ajeno', school_id: ESC_A, coach_id: 'staff-otro' },
        { id: 'team-otra-escuela', school_id: ESC_B, coach_id: 'staff-coach-b' },
    ],
    school_staff: [
        { id: 'staff-coach-a', coach_auth_id: 'user-coach-a', school_id: ESC_A, status: 'active' },
    ],
    team_coaches: [] as any[],
    team_reports: [
        { id: 'tr-propio', team_id: 'team-propio', school_id: ESC_A },
        { id: 'tr-ajeno', team_id: 'team-ajeno', school_id: ESC_A },
        { id: 'tr-otra', team_id: 'team-otra-escuela', school_id: ESC_B },
    ],
    athlete_reports: [
        { id: 'ar-a', school_id: ESC_A },
        { id: 'ar-b', school_id: ESC_B },
    ],
};

const coachA = { role: 'coach', schoolId: ESC_A, userId: 'user-coach-a' };
const ownerA = { role: 'owner', schoolId: ESC_A, userId: 'user-owner-a' };

describe('puedePublicarInformeEquipo', () => {
    it('escuela que NO delegó (school) → el coach no publica (403); el admin sí', async () => {
        const db = fakeDb({ ...base, school_settings: [{ school_id: ESC_A, reports_release_by: 'school' }] });
        expect(await puedePublicarInformeEquipo(db, coachA, 'team-propio')).toMatchObject({ ok: false, status: 403 });
        expect(await puedePublicarInformeEquipo(db, ownerA, 'team-propio')).toEqual({ ok: true });
    });

    it('escuela que delegó (coach) → el coach publica SU equipo, no el de otro coach', async () => {
        const db = fakeDb({ ...base, school_settings: [{ school_id: ESC_A, reports_release_by: 'coach' }] });
        expect(await puedePublicarInformeEquipo(db, coachA, 'team-propio')).toEqual({ ok: true });
        expect(await puedePublicarInformeEquipo(db, coachA, 'team-ajeno')).toMatchObject({ ok: false, status: 403 });
    });

    it('sin fila de ajustes → cuenta como «la escuela publica»', async () => {
        const db = fakeDb({ ...base, school_settings: [] });
        expect(await puedePublicarInformeEquipo(db, coachA, 'team-propio')).toMatchObject({ ok: false, status: 403 });
    });

    it('equipo de otra escuela → 404, también para plataforma con otra escuela en sesión', async () => {
        const db = fakeDb({ ...base, school_settings: [{ school_id: ESC_B, reports_release_by: 'coach' }] });
        expect(await puedePublicarInformeEquipo(db, ownerA, 'team-otra-escuela')).toMatchObject({ ok: false, status: 404 });
        expect(await puedePublicarInformeEquipo(db, { role: 'super_admin', schoolId: ESC_A, userId: 'x' }, 'team-otra-escuela'))
            .toMatchObject({ ok: false, status: 404 });
    });
});

describe('puedeEscribirNotaBloque (IDOR del report_id)', () => {
    const db = fakeDb(base);
    const siempre = async () => true;
    const nunca = async () => false;

    it('informe de equipo de OTRA escuela → 404 (antes se aceptaba)', async () => {
        for (const sesion of [ownerA, coachA]) {
            const r = await puedeEscribirNotaBloque(db, sesion, { report_type: 'team', report_id: 'tr-otra' }, siempre);
            expect(r).toMatchObject({ ok: false, status: 404 });
        }
    });

    it('coach: informe de su equipo sí; de un equipo que no dirige → 403', async () => {
        expect(await puedeEscribirNotaBloque(db, coachA, { report_type: 'team', report_id: 'tr-propio' }, siempre)).toEqual({ ok: true });
        expect(await puedeEscribirNotaBloque(db, coachA, { report_type: 'team', report_id: 'tr-ajeno' }, siempre))
            .toMatchObject({ ok: false, status: 403 });
    });

    it('admin: cualquier informe de equipo de su escuela', async () => {
        expect(await puedeEscribirNotaBloque(db, ownerA, { report_type: 'team', report_id: 'tr-ajeno' }, nunca)).toEqual({ ok: true });
    });

    it('informe de atleta: otra escuela → 404; coach que no lo ve por RLS → 403; que sí lo ve → ok', async () => {
        expect(await puedeEscribirNotaBloque(db, ownerA, { report_type: 'athlete', report_id: 'ar-b' }, siempre))
            .toMatchObject({ ok: false, status: 404 });
        expect(await puedeEscribirNotaBloque(db, coachA, { report_type: 'athlete', report_id: 'ar-a' }, nunca))
            .toMatchObject({ ok: false, status: 403 });
        expect(await puedeEscribirNotaBloque(db, coachA, { report_type: 'athlete', report_id: 'ar-a' }, siempre)).toEqual({ ok: true });
        expect(await puedeEscribirNotaBloque(db, ownerA, { report_type: 'athlete', report_id: 'ar-a' }, nunca)).toEqual({ ok: true });
    });

    it('id inexistente o sesión sin escuela → 404', async () => {
        expect(await puedeEscribirNotaBloque(db, ownerA, { report_type: 'team', report_id: 'no-existe' }, siempre)).toMatchObject({ status: 404 });
        expect(await puedeEscribirNotaBloque(db, { ...ownerA, schoolId: '' }, { report_type: 'team', report_id: 'tr-propio' }, siempre))
            .toMatchObject({ status: 404 });
    });
});

describe('rol staff = alcance de entrenador (b7)', () => {
    // `staff` está en STAFF_ROLES de las rutas, pero no es administración: antes
    // resolverAccesoEquipo lo dejaba pasar a todos los equipos de la escuela.
    const staffA = { role: 'staff', schoolId: ESC_A, userId: 'user-staff-a' };
    // Un staff que además dirige un equipo (ficha en school_staff vinculada).
    const staffCoach = { role: 'staff', schoolId: ESC_A, userId: 'user-coach-a' };
    const siempre = async () => true;
    const nunca = async () => false;

    it('publicar: staff sin equipos → 403 aunque la escuela delegue; si dirige el equipo, solo el suyo', async () => {
        const db = fakeDb({ ...base, school_settings: [{ school_id: ESC_A, reports_release_by: 'coach' }] });
        expect(await puedePublicarInformeEquipo(db, staffA, 'team-propio')).toMatchObject({ ok: false, status: 403 });
        expect(await puedePublicarInformeEquipo(db, staffA, 'team-ajeno')).toMatchObject({ ok: false, status: 403 });
        expect(await puedePublicarInformeEquipo(db, staffCoach, 'team-propio')).toEqual({ ok: true });
        expect(await puedePublicarInformeEquipo(db, staffCoach, 'team-ajeno')).toMatchObject({ ok: false, status: 403 });
    });

    it('publicar: escuela que NO delegó → staff 403 también en su equipo', async () => {
        const db = fakeDb({ ...base, school_settings: [{ school_id: ESC_A, reports_release_by: 'school' }] });
        expect(await puedePublicarInformeEquipo(db, staffCoach, 'team-propio')).toMatchObject({ ok: false, status: 403 });
    });

    it('nota en informe de equipo: staff sin equipos → 403; staff que dirige → solo el suyo', async () => {
        const db = fakeDb(base);
        expect(await puedeEscribirNotaBloque(db, staffA, { report_type: 'team', report_id: 'tr-ajeno' }, siempre))
            .toMatchObject({ ok: false, status: 403 });
        expect(await puedeEscribirNotaBloque(db, staffCoach, { report_type: 'team', report_id: 'tr-propio' }, nunca)).toEqual({ ok: true });
        expect(await puedeEscribirNotaBloque(db, staffCoach, { report_type: 'team', report_id: 'tr-ajeno' }, siempre))
            .toMatchObject({ ok: false, status: 403 });
    });

    it('nota en informe de atleta: staff depende de la RLS (como el coach), ya no pasa siempre', async () => {
        const db = fakeDb(base);
        expect(await puedeEscribirNotaBloque(db, staffA, { report_type: 'athlete', report_id: 'ar-a' }, nunca))
            .toMatchObject({ ok: false, status: 403 });
        expect(await puedeEscribirNotaBloque(db, staffA, { report_type: 'athlete', report_id: 'ar-a' }, siempre)).toEqual({ ok: true });
    });

    it('rol desconocido o vacío → mismo trato que el coach (fail-closed)', async () => {
        const db = fakeDb({ ...base, school_settings: [{ school_id: ESC_A, reports_release_by: 'coach' }] });
        expect(await puedePublicarInformeEquipo(db, { role: null, schoolId: ESC_A, userId: 'nadie' }, 'team-propio'))
            .toMatchObject({ ok: false, status: 403 });
    });
});

describe('resolverDeportistaPropio', () => {
    const db = fakeDb({
        enrollments: [
            { id: 'e1', team_id: 'team-propio', status: 'active', user_id: 'adulto', school_id: ESC_A },
            { id: 'e2', team_id: 'team-propio', status: 'active', unregistered_athlete_id: 'ficha-1', school_id: ESC_A },
            { id: 'e3', team_id: 'team-propio', status: 'cancelled', user_id: 'ex', school_id: ESC_A },
        ],
        profiles: [{ id: 'adulto', full_name: 'Ana Adulta' }],
        unregistered_athletes: [
            { id: 'ficha-1', full_name: 'Feli Ficha', linked_profile_id: 'cuenta-ficha' },
            { id: 'ficha-2', full_name: 'Otra', linked_profile_id: 'cuenta-sin-equipo' },
        ],
    });

    it('adulto inscrito con su cuenta → profile', async () => {
        expect(await resolverDeportistaPropio(db, 'adulto', 'team-propio'))
            .toEqual({ subjectType: 'profile', subjectId: 'adulto', schoolId: ESC_A, name: 'Ana Adulta' });
    });

    it('ficha vinculada e inscrita → unregistered', async () => {
        expect(await resolverDeportistaPropio(db, 'cuenta-ficha', 'team-propio'))
            .toEqual({ subjectType: 'unregistered', subjectId: 'ficha-1', schoolId: ESC_A, name: 'Feli Ficha' });
    });

    it('inscripción cancelada, ficha sin inscripción en el equipo o sin sesión → null', async () => {
        expect(await resolverDeportistaPropio(db, 'ex', 'team-propio')).toBeNull();
        expect(await resolverDeportistaPropio(db, 'cuenta-sin-equipo', 'team-propio')).toBeNull();
        expect(await resolverDeportistaPropio(db, undefined, 'team-propio')).toBeNull();
        expect(await resolverDeportistaPropio(db, 'adulto', 'team-ajeno')).toBeNull();
    });
});
