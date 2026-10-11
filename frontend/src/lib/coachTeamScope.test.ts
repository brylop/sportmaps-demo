import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }));

import {
    canCreateTeam,
    canEditTeam,
    canArchiveOrDeleteTeam,
    buildTeamWritePayload,
    athleteInTeams,
    escapeLike,
    isSchoolAdminRole,
    type TeamFormValues,
} from './coachTeamScope';
import { hasPermission } from './permissions';

const ADMINS = ['owner', 'school', 'admin', 'school_admin', 'super_admin'];

const form: TeamFormValues = {
    name: 'Sub 13',
    description: 'desc',
    sport: 'Fútbol',
    level: 'Sub 13',
    max_students: 20,
    location: 'Cancha 2',
    price_monthly: 120000,
    coach_ids: ['staff-otro', 'staff-yo'],
    branch_ids: ['sede-1'],
    status: 'inactive',
    image_url: null,
};

describe('permisos de equipos por rol', () => {
    it('la matriz estática ya no le da teams:create ni teams:delete al coach', () => {
        expect(hasPermission('coach' as any, 'teams:create')).toBe(false);
        expect(hasPermission('coach' as any, 'teams:delete')).toBe(false);
        expect(hasPermission('coach' as any, 'teams:edit')).toBe(true);
        for (const r of ['owner', 'school', 'school_admin', 'admin', 'super_admin']) {
            expect(hasPermission(r as any, 'teams:delete')).toBe(true);
        }
    });

    it('crear: administración siempre; coach solo con coach_can_create_teams', () => {
        for (const role of ADMINS) expect(canCreateTeam({ role, coachCanCreateTeams: false })).toBe(true);
        expect(canCreateTeam({ role: 'coach', coachCanCreateTeams: false })).toBe(false);
        expect(canCreateTeam({ role: 'coach', coachCanCreateTeams: true })).toBe(true);
        expect(canCreateTeam({ role: 'parent', coachCanCreateTeams: true })).toBe(false);
        expect(canCreateTeam({ role: 'reporter', coachCanCreateTeams: true })).toBe(false);
    });

    it('editar: el coach solo los equipos que dirige', () => {
        expect(canEditTeam({ role: 'coach', coachCanCreateTeams: false }, true)).toBe(true);
        expect(canEditTeam({ role: 'coach', coachCanCreateTeams: false }, false)).toBe(false);
        expect(canEditTeam({ role: 'admin', coachCanCreateTeams: false }, false)).toBe(true);
    });

    it('archivar/eliminar: administración; coach solo con el flag y siendo el principal (Carmel)', () => {
        for (const role of ADMINS) expect(canArchiveOrDeleteTeam({ role, coachCanCreateTeams: false }, false)).toBe(true);
        expect(canArchiveOrDeleteTeam({ role: 'coach', coachCanCreateTeams: false }, true)).toBe(false);
        expect(canArchiveOrDeleteTeam({ role: 'coach', coachCanCreateTeams: true }, false)).toBe(false);
        expect(canArchiveOrDeleteTeam({ role: 'coach', coachCanCreateTeams: true }, true)).toBe(true);
    });

    it('isSchoolAdminRole', () => {
        for (const r of ADMINS) expect(isSchoolAdminRole(r)).toBe(true);
        for (const r of ['coach', 'parent', 'athlete', 'reporter', 'accountant', null, undefined, '']) {
            expect(isSchoolAdminRole(r as any)).toBe(false);
        }
    });
});

describe('buildTeamWritePayload', () => {
    it('administración: todo, como siempre, y sincroniza entrenadores/sedes', () => {
        const { payload, syncRelations } = buildTeamWritePayload(form, { isAdmin: true, isCreate: false, schoolId: 'esc' });
        expect(syncRelations).toBe(true);
        expect(payload).toMatchObject({
            price_monthly: 120000, coach_id: 'staff-otro', branch_id: 'sede-1', school_id: 'esc', status: 'inactive',
        });
    });

    it('coach editando: solo datos deportivos (ni precio, ni estado, ni sede, ni entrenador)', () => {
        const { payload, syncRelations } = buildTeamWritePayload(form, { isAdmin: false, isCreate: false, schoolId: 'esc' });
        expect(syncRelations).toBe(false);
        for (const k of ['price_monthly', 'status', 'branch_id', 'coach_id', 'school_id']) {
            expect(payload).not.toHaveProperty(k);
        }
        expect(payload).toMatchObject({ name: 'Sub 13', level: 'Sub 13', max_students: 20 });
    });

    it('coach creando (coach_can_create_teams): queda él de principal, precio 0, activo, sin sync', () => {
        const { payload, syncRelations } = buildTeamWritePayload(form, {
            isAdmin: false, isCreate: true, schoolId: 'esc', branchId: 'sede-x', ownStaffId: 'staff-yo',
        });
        expect(syncRelations).toBe(false);
        expect(payload).toMatchObject({
            coach_id: 'staff-yo', price_monthly: 0, status: 'active', school_id: 'esc', branch_id: 'sede-x',
        });
    });
});

describe('athleteInTeams', () => {
    const propios = new Set(['t1', 't2']);
    it('por equipo inscrito, por team_id legacy o por inscripción activa', () => {
        expect(athleteInTeams({ id: 'a', enrolled_team_id: 't1' }, propios)).toBe(true);
        expect(athleteInTeams({ id: 'a', team_id: 't2' }, propios)).toBe(true);
        expect(athleteInTeams({ id: 'a', enrolled_team_id: 'otro' }, propios, new Set(['a']))).toBe(true);
    });
    it('deportista de otro equipo: fuera', () => {
        expect(athleteInTeams({ id: 'b', enrolled_team_id: 'otro', team_id: null }, propios, new Set(['a']))).toBe(false);
        expect(athleteInTeams({ id: 'b' }, new Set())).toBe(false);
    });
});

describe('escapeLike', () => {
    it('escapa los comodines para comparar el correo literal', () => {
        expect(escapeLike('juan_perez%x@mail.com')).toBe('juan\\_perez\\%x@mail.com');
        expect(escapeLike('a\\b@c.co')).toBe('a\\\\b@c.co');
    });
});
