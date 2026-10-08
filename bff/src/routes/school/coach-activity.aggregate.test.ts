/**
 * Agregado de "Seguimiento deportivo" (F4): semáforo por entrenador, conteos
 * de la semana, atribución por staff.id vs auth id, serie de 8 semanas y
 * adherencia del mesociclo. Cero base: solo la función pura.
 */
import { describe, expect, it } from 'vitest';
import {
  addDaysYmd, bogotaYmd, buildCoachActivity, coachStatus, isValidYmd, mondayOf,
  type CoachActivityInput,
} from './coach-activity.aggregate';

const WEEK = '2026-10-05'; // lunes

function base(overrides: Partial<CoachActivityInput> = {}): CoachActivityInput {
  return {
    week: WEEK,
    today: '2026-10-08',
    weeksBack: 8,
    staff: [
      { id: 'st-ana', full_name: 'Ana', coach_auth_id: 'u-ana' },
      { id: 'st-beto', full_name: 'Beto', coach_auth_id: 'u-beto' },
      { id: 'st-caro', full_name: 'Caro', coach_auth_id: null },
    ],
    teams: [
      { id: 't-sub11', name: 'Sub 11', coach_id: 'st-ana', extra_coach_ids: ['st-beto'] },
      { id: 't-sub13', name: 'Sub 13', coach_id: 'st-beto', extra_coach_ids: [] },
    ],
    trainingSessions: [],
    attendanceSessions: [],
    attendanceRecords: [],
    performanceEntries: [],
    mesoEvaluations: [],
    mesocycles: [],
    profileNames: { 'u-ana': 'Ana', 'u-beto': 'Beto', 'u-owner': 'Mauricio' },
    ...overrides,
  };
}

const ts = (id: string, team_id: string, session_date: string, created_by: string | null = null) => ({
  id, team_id, session_date, created_by, updated_by: created_by,
  created_at: `${session_date}T15:00:00Z`, updated_at: `${session_date}T15:00:00Z`,
  objectives: 'Pase corto', blocks_count: 3, microcycle_day_id: null,
});

const as = (id: string, team_id: string, session_date: string, coach_id: string | null, finalized = true) => ({
  id, team_id, session_date, coach_id, created_by: null, finalized_by: null,
  finalized, finalized_at: finalized ? `${session_date}T23:00:00Z` : null, created_at: `${session_date}T22:00:00Z`,
});

describe('fechas', () => {
  it('mondayOf lleva cualquier día a su lunes (domingo incluido)', () => {
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
    expect(mondayOf('2026-10-08')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
  });
  it('bogotaYmd: el domingo 8 p. m. en Colombia sigue siendo domingo', () => {
    expect(bogotaYmd('2026-10-12T01:00:00Z')).toBe('2026-10-11');
    expect(bogotaYmd('2026-10-12T06:00:00Z')).toBe('2026-10-12');
  });
  it('isValidYmd rechaza fechas imposibles y formatos raros', () => {
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('2026-10-5')).toBe(false);
    expect(isValidYmd(undefined)).toBe(false);
    expect(isValidYmd('2026-10-05')).toBe(true);
    expect(addDaysYmd('2026-12-29', 7)).toBe('2027-01-05');
  });
});

describe('coachStatus', () => {
  it('verde solo con planificación Y lista', () => {
    expect(coachStatus({ planned: 2, lists: 1, evaluations: 0 })).toBe('verde');
  });
  it('ámbar con una sola de las dos, o solo evaluaciones', () => {
    expect(coachStatus({ planned: 2, lists: 0, evaluations: 0 })).toBe('ambar');
    expect(coachStatus({ planned: 0, lists: 3, evaluations: 0 })).toBe('ambar');
    expect(coachStatus({ planned: 0, lists: 0, evaluations: 5 })).toBe('ambar');
  });
  it('rojo sin nada', () => {
    expect(coachStatus({ planned: 0, lists: 0, evaluations: 0 })).toBe('rojo');
  });
});

describe('buildCoachActivity', () => {
  it('sin datos: todos en rojo, 8 semanas en la serie y orden rojo primero', () => {
    const r = buildCoachActivity(base());
    expect(r.week_end).toBe('2026-10-11');
    expect(r.weeks).toHaveLength(8);
    expect(r.weeks[7]).toBe(WEEK);
    expect(r.weeks[0]).toBe('2026-08-17');
    expect(r.coaches.every((c) => c.status === 'rojo')).toBe(true);
    expect(r.totals).toMatchObject({ coaches: 3, rojo: 3, verde: 0, ambar: 0 });
  });

  it('equipos titular/adicional por school_staff.id', () => {
    const r = buildCoachActivity(base());
    const beto = r.coaches.find((c) => c.staff_id === 'st-beto')!;
    expect(beto.teams).toEqual([
      { id: 't-sub13', name: 'Sub 13', role: 'titular' },
      { id: 't-sub11', name: 'Sub 11', role: 'adicional' },
    ]);
    const caro = r.coaches.find((c) => c.staff_id === 'st-caro')!;
    expect(caro.has_account).toBe(false);
    expect(caro.teams).toEqual([]);
  });

  it('cuenta sesiones de sus equipos y listas atribuidas; semáforo verde/ámbar', () => {
    const r = buildCoachActivity(base({
      trainingSessions: [
        ts('s1', 't-sub11', '2026-10-06', 'u-owner'),
        ts('s2', 't-sub11', '2026-10-08', 'u-ana'),
        ts('s-old', 't-sub11', '2026-09-29', 'u-ana'), // semana anterior
        ts('s-out', 't-sub11', '2026-10-13', 'u-ana'), // semana siguiente
      ],
      attendanceSessions: [
        as('a1', 't-sub11', '2026-10-06', 'st-ana'),
        as('a2', 't-sub11', '2026-10-08', 'st-ana'),
        as('a-open', 't-sub11', '2026-10-09', 'st-ana', false), // sin registros ni finalizar
      ],
      attendanceRecords: [
        { session_id: 'a1', marked_by: 'u-ana', status: 'present', created_at: '2026-10-06T22:10:00Z' },
        { session_id: 'a1', marked_by: 'u-ana', status: 'absent', created_at: '2026-10-06T22:10:00Z' },
        { session_id: 'a1', marked_by: 'u-ana', status: 'late', created_at: '2026-10-06T22:10:00Z' },
      ],
    }));
    const ana = r.coaches.find((c) => c.staff_id === 'st-ana')!;
    expect(ana.sessions_planned_week).toBe(2);
    expect(ana.sessions_created_by_coach_week).toBe(1);
    expect(ana.sessions.map((s) => s.created_by_name)).toEqual(['Mauricio', 'Ana']);
    expect(ana.attendance_sessions_week).toBe(2);
    expect(ana.days_with_list).toBe(2);
    expect(ana.attendance[0]).toMatchObject({ id: 'a1', present: 2, total: 3 });
    expect(ana.status).toBe('verde');
    // Beto es adicional en Sub 11: ve las sesiones del equipo, pero las listas
    // son de Ana (coach_id) → ámbar.
    const beto = r.coaches.find((c) => c.staff_id === 'st-beto')!;
    expect(beto.sessions_planned_week).toBe(2);
    expect(beto.attendance_sessions_week).toBe(0);
    expect(beto.status).toBe('ambar');
    // Serie: la semana anterior tiene 1 planificada para Ana.
    expect(ana.weekly[6]).toMatchObject({ week: '2026-09-28', planned: 1, lists: 0 });
    expect(ana.weekly[7]).toMatchObject({ week: WEEK, planned: 2, lists: 2 });
    expect(r.totals.sessions_planned).toBe(2);
    expect(r.totals.attendance_sessions).toBe(2);
  });

  it('una lista sin coach_id se atribuye por marked_by (auth id)', () => {
    const r = buildCoachActivity(base({
      attendanceSessions: [as('a1', 't-sub13', '2026-10-07', null, false)],
      attendanceRecords: [{ session_id: 'a1', marked_by: 'u-beto', status: 'present', created_at: '2026-10-07T22:00:00Z' }],
    }));
    const beto = r.coaches.find((c) => c.staff_id === 'st-beto')!;
    expect(beto.attendance_sessions_week).toBe(1);
    expect(beto.last_activity_at).toBe('2026-10-07T22:00:00Z');
  });

  it('evaluaciones: entradas, deportistas distintos y día en hora Colombia', () => {
    const r = buildCoachActivity(base({
      performanceEntries: [
        { recorded_by: 'u-ana', subject_id: 'k1', recorded_at: '2026-10-07T20:00:00Z' },
        { recorded_by: 'u-ana', subject_id: 'k1', recorded_at: '2026-10-07T20:00:00Z' },
        { recorded_by: 'u-ana', subject_id: 'k2', recorded_at: '2026-10-07T20:00:00Z' },
        // lunes 00:30 UTC = domingo 4 de oct en Colombia → semana anterior
        { recorded_by: 'u-ana', subject_id: 'k3', recorded_at: '2026-10-05T00:30:00Z' },
        { recorded_by: 'u-beto', subject_id: 'k9', recorded_at: '2026-10-07T20:00:00Z' },
      ],
      mesoEvaluations: [{ created_by: 'u-ana', created_at: '2026-10-08T15:00:00Z', mesocycle_id: 'm1' }],
    }));
    const ana = r.coaches.find((c) => c.staff_id === 'st-ana')!;
    expect(ana.evaluations_week).toEqual({ entries: 3, athletes: 2 });
    expect(ana.mesocycle_evaluations_week).toBe(1);
    expect(ana.evaluations_by_day).toEqual([{ date: '2026-10-07', entries: 3, athletes: 2 }]);
    expect(ana.weekly[6].evaluations).toBe(1);
    expect(ana.status).toBe('ambar');
    expect(r.totals.evaluations).toBe(5);
  });

  it('adherencia del mesociclo: solo cuenta lo ya vencido', () => {
    const r = buildCoachActivity(base({
      mesocycles: [
        { id: 'm-old', team_id: 't-sub11', starts_on: '2026-08-01', ends_on: '2026-08-31', n_sessions_planned: 8, general_objective: null },
        { id: 'm1', team_id: 't-sub11', starts_on: '2026-09-28', ends_on: '2026-10-25', n_sessions_planned: 8, general_objective: 'Salida' },
      ],
      trainingSessions: [
        ts('s1', 't-sub11', '2026-09-29'),
        ts('s2', 't-sub11', '2026-10-01'),
        ts('s3', 't-sub11', '2026-10-06'),
        ts('s4', 't-sub11', '2026-10-13'), // futura: no cuenta
      ],
      attendanceSessions: [
        as('a1', 't-sub11', '2026-09-29', 'st-ana'),
        as('a3', 't-sub11', '2026-10-06', 'st-ana'),
      ],
    }));
    const ana = r.coaches.find((c) => c.staff_id === 'st-ana')!;
    expect(ana.mesocycles).toHaveLength(1);
    expect(ana.mesocycles[0]).toMatchObject({
      id: 'm1', planned_total: 8, planned_to_date: 3, done_to_date: 2, adherence_pct: 67,
    });
  });
});
