/**
 * IDOR de GET /reports/coach/:teamId (2026-10-10): el chequeo de escuela solo
 * corría para school_admin. resolverAccesoEquipo es ahora el gate de esa ruta
 * y de preview/pdf del informe de equipo.
 */
import { describe, it, expect } from 'vitest';
import { resolverAccesoEquipo } from './team-access.service';

const ESC_A = 'school-a';
const ESC_B = 'school-b';

// Base en memoria mínima con el mismo encadenado que supabase-js.
function fakeDb(rows: Record<string, any[]>) {
    return {
        from(tabla: string) {
            const filtros: [string, any][] = [];
            const q: any = {
                select: () => q,
                eq: (col: string, val: any) => { filtros.push([col, val]); return q; },
                maybeSingle: async () => {
                    const hit = (rows[tabla] ?? []).find((r) => filtros.every(([c, v]) => r[c] === v));
                    return { data: hit ?? null, error: null };
                },
            };
            return q;
        },
    };
}

const db = fakeDb({
    teams: [
        { id: 'team-propio', school_id: ESC_A, coach_id: 'staff-coach-a' },
        { id: 'team-asistente', school_id: ESC_A, coach_id: 'staff-otro' },
        { id: 'team-ajeno', school_id: ESC_A, coach_id: 'staff-otro' },
        { id: 'team-otra-escuela', school_id: ESC_B, coach_id: 'staff-coach-b' },
    ],
    school_staff: [
        { id: 'staff-coach-a', coach_auth_id: 'user-coach-a', school_id: ESC_A, status: 'active' },
        { id: 'staff-coach-b', coach_auth_id: 'user-coach-b', school_id: ESC_B, status: 'active' },
    ],
    team_coaches: [
        { id: 'tc-1', team_id: 'team-asistente', coach_id: 'staff-coach-a' },
    ],
});

const coachA = { role: 'coach', schoolId: ESC_A, userId: 'user-coach-a' };

describe('resolverAccesoEquipo', () => {
    it('coach de OTRA escuela → 404 (no confirma que el equipo exista)', async () => {
        const r = await resolverAccesoEquipo(db, coachA, 'team-otra-escuela');
        expect(r).toMatchObject({ ok: false, status: 404 });
    });

    it('owner/admin de otra escuela → 404 (antes solo se chequeaba school_admin)', async () => {
        for (const role of ['owner', 'admin', 'reporter', 'auditor', 'staff', 'school_admin']) {
            const r = await resolverAccesoEquipo(db, { role, schoolId: ESC_A, userId: 'x' }, 'team-otra-escuela');
            expect(r).toMatchObject({ ok: false, status: 404 });
        }
    });

    it('coach: su equipo (principal o asistente) sí; el de otro coach de su escuela → 403', async () => {
        expect((await resolverAccesoEquipo(db, coachA, 'team-propio')).ok).toBe(true);
        expect((await resolverAccesoEquipo(db, coachA, 'team-asistente')).ok).toBe(true);
        expect(await resolverAccesoEquipo(db, coachA, 'team-ajeno')).toMatchObject({ ok: false, status: 403 });
    });

    it('coach sin ficha de staff en la escuela → 403', async () => {
        const r = await resolverAccesoEquipo(db, { role: 'coach', schoolId: ESC_A, userId: 'nadie' }, 'team-propio');
        expect(r).toMatchObject({ ok: false, status: 403 });
    });

    it('administración ve todos los equipos de SU escuela', async () => {
        for (const role of ['owner', 'admin', 'school_admin']) {
            const r = await resolverAccesoEquipo(db, { role, schoolId: ESC_A, userId: 'x' }, 'team-ajeno');
            expect(r.ok).toBe(true);
        }
    });

    it('staff de plataforma (super_admin) cruza escuelas', async () => {
        const r = await resolverAccesoEquipo(db, { role: 'super_admin', schoolId: '', userId: 'x' }, 'team-otra-escuela');
        expect(r.ok).toBe(true);
    });

    it('sesión sin escuela o equipo inexistente → 404', async () => {
        expect(await resolverAccesoEquipo(db, { role: 'owner', schoolId: '', userId: 'x' }, 'team-propio')).toMatchObject({ status: 404 });
        expect(await resolverAccesoEquipo(db, coachA, 'no-existe')).toMatchObject({ status: 404 });
        expect(await resolverAccesoEquipo(db, coachA, '')).toMatchObject({ status: 404 });
    });
});
