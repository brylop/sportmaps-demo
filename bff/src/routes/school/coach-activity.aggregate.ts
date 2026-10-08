/**
 * Agregado puro de "Seguimiento deportivo" (spec
 * docs/specs/rediseno-seguimiento-deportivo.md, F4): qué hizo cada entrenador
 * en una semana. Cero Express y cero base: el router (coach-activity.ts) trae
 * las filas y esta función las cruza, para poder probarla sin Supabase.
 *
 * Identidades — dos ids distintos por entrenador, y cada tabla usa uno:
 *   · school_staff.id      → teams.coach_id, team_coaches.coach_id,
 *                            attendance_sessions.coach_id
 *   · coach_auth_id (auth) → training_sessions.created_by/updated_by,
 *                            attendance_sessions.created_by/finalized_by,
 *                            attendance_records.marked_by,
 *                            performance_entries.recorded_by,
 *                            training_mesocycle_evaluations.created_by
 *
 * Fechas: todo se compara como 'YYYY-MM-DD'. Los timestamptz se pasan a la
 * fecha de Colombia (UTC-5, sin horario de verano) antes de ubicarlos en una
 * semana: una evaluación del domingo 8 p. m. es del domingo, no del lunes UTC.
 */

export type CoachStatus = 'verde' | 'ambar' | 'rojo';

export interface StaffRow { id: string; full_name: string; coach_auth_id: string | null }
export interface TeamRow { id: string; name: string; coach_id: string | null; extra_coach_ids: string[] }
export interface TrainingSessionRow {
  id: string; team_id: string; session_date: string;
  created_by: string | null; updated_by: string | null;
  created_at: string | null; updated_at: string | null;
  objectives: unknown; blocks_count: number; microcycle_day_id: string | null;
}
export interface AttendanceSessionRow {
  id: string; team_id: string | null; session_date: string;
  coach_id: string | null; created_by: string | null; finalized_by: string | null;
  finalized: boolean | null; finalized_at: string | null; created_at: string | null;
}
export interface AttendanceRecordRow { session_id: string | null; marked_by: string | null; status: string | null; created_at: string | null }
export interface PerformanceEntryRow { recorded_by: string | null; subject_id: string; recorded_at: string }
export interface MesoEvalRow { created_by: string | null; created_at: string; mesocycle_id: string }
export interface MesocycleRow {
  id: string; team_id: string; starts_on: string; ends_on: string;
  n_sessions_planned: number | null; general_objective: string | null;
}

export interface CoachActivityInput {
  /** Lunes de la semana pedida (YYYY-MM-DD). */
  week: string;
  /** Hoy en Colombia (YYYY-MM-DD): la adherencia solo cuenta lo ya vencido. */
  today: string;
  /** Semanas de la serie para la gráfica (incluye la pedida). */
  weeksBack: number;
  staff: StaffRow[];
  teams: TeamRow[];
  trainingSessions: TrainingSessionRow[];
  attendanceSessions: AttendanceSessionRow[];
  attendanceRecords: AttendanceRecordRow[];
  performanceEntries: PerformanceEntryRow[];
  mesoEvaluations: MesoEvalRow[];
  mesocycles: MesocycleRow[];
  /** profiles.id → nombre, para "la creó …" en las sesiones. */
  profileNames: Record<string, string>;
}

export interface CoachTeamRef { id: string; name: string; role: 'titular' | 'adicional' }
export interface CoachWeekPoint { week: string; planned: number; lists: number; evaluations: number }
export interface CoachSessionItem {
  id: string; team_id: string; team_name: string; session_date: string;
  objective: string; blocks: number; in_mesocycle: boolean;
  created_by_name: string | null; created_by_coach: boolean;
}
export interface CoachAttendanceItem {
  id: string; team_id: string | null; team_name: string; session_date: string;
  present: number; total: number; finalized: boolean;
}
export interface CoachEvaluationDay { date: string; entries: number; athletes: number }
export interface CoachMesocycle {
  id: string; team_id: string; team_name: string; starts_on: string; ends_on: string;
  general_objective: string | null;
  planned_total: number; planned_to_date: number; done_to_date: number;
  /** done/planned_to_date en %, null si todavía no venció ninguna sesión. */
  adherence_pct: number | null;
}
export interface CoachActivity {
  staff_id: string;
  full_name: string;
  has_account: boolean;
  teams: CoachTeamRef[];
  last_activity_at: string | null;
  status: CoachStatus;
  sessions_planned_week: number;
  sessions_created_by_coach_week: number;
  attendance_sessions_week: number;
  days_with_list: number;
  evaluations_week: { entries: number; athletes: number };
  mesocycle_evaluations_week: number;
  mesocycles: CoachMesocycle[];
  weekly: CoachWeekPoint[];
  sessions: CoachSessionItem[];
  attendance: CoachAttendanceItem[];
  evaluations_by_day: CoachEvaluationDay[];
}
export interface CoachActivityResponse {
  week: string;
  week_end: string;
  weeks: string[];
  coaches: CoachActivity[];
  totals: { coaches: number; verde: number; ambar: number; rojo: number; sessions_planned: number; attendance_sessions: number; evaluations: number };
}

// ── Fechas ─────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;
const BOGOTA_OFFSET_MS = 5 * 3_600_000;

export function addDaysYmd(ymd: string, days: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha YYYY-MM-DD. */
export function mondayOf(ymd: string): string {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
  const dow = d.getUTCDay(); // 0 = domingo
  return addDaysYmd(ymd, dow === 0 ? -6 : 1 - dow);
}

/** timestamptz → fecha en Colombia. */
export function bogotaYmd(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidYmd(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return addDaysYmd(s, 0) === s;
}

const PRESENT = new Set(['present', 'late']);

/** Semáforo: verde = planificó Y tomó lista; ámbar = solo una de las dos (o
 *  solo evaluó); rojo = nada de nada en la semana. */
export function coachStatus(p: { planned: number; lists: number; evaluations: number }): CoachStatus {
  const planned = p.planned > 0;
  const lists = p.lists > 0;
  if (planned && lists) return 'verde';
  if (planned || lists || p.evaluations > 0) return 'ambar';
  return 'rojo';
}

export function objectiveText(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string').join(' · ');
  return '';
}

const maxIso = (a: string | null, b: string | null | undefined): string | null => {
  if (!b) return a;
  if (!a) return b;
  return Date.parse(b) > Date.parse(a) ? b : a;
};

// ── Agregado ───────────────────────────────────────────────────────────────
export function buildCoachActivity(input: CoachActivityInput): CoachActivityResponse {
  const { week, today, weeksBack } = input;
  const weekEnd = addDaysYmd(week, 6);
  const weeks = Array.from({ length: weeksBack }, (_, i) => addDaysYmd(week, -7 * (weeksBack - 1 - i)));
  const firstWeek = weeks[0];
  const inWeek = (ymd: string) => ymd >= week && ymd <= weekEnd;
  const weekIndex = (ymd: string): number => {
    if (ymd < firstWeek || ymd > weekEnd) return -1;
    return Math.floor((Date.parse(ymd) - Date.parse(firstWeek)) / (7 * DAY_MS));
  };

  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const teamName = (id: string | null) => (id && teamById.get(id)?.name) || 'Sin equipo';

  // Lista "tomada" = sesión de asistencia con registros o finalizada. Las
  // attendance_sessions vacías (cupos reservables, sesiones abiertas sin
  // marcar) no cuentan.
  const recordsBySession = new Map<string, AttendanceRecordRow[]>();
  for (const r of input.attendanceRecords) {
    if (!r.session_id) continue;
    const list = recordsBySession.get(r.session_id) ?? [];
    list.push(r);
    recordsBySession.set(r.session_id, list);
  }
  const takenLists = input.attendanceSessions.filter(
    (s) => s.finalized === true || (recordsBySession.get(s.id)?.length ?? 0) > 0,
  );
  // equipo → fechas con lista tomada (para la adherencia del mesociclo)
  const listDatesByTeam = new Map<string, Set<string>>();
  for (const s of takenLists) {
    if (!s.team_id) continue;
    const set = listDatesByTeam.get(s.team_id) ?? new Set<string>();
    set.add(s.session_date);
    listDatesByTeam.set(s.team_id, set);
  }

  const coaches: CoachActivity[] = input.staff.map((st) => {
    const auth = st.coach_auth_id;
    const teams: CoachTeamRef[] = [];
    for (const t of input.teams) {
      if (t.coach_id === st.id) teams.push({ id: t.id, name: t.name, role: 'titular' });
      else if (t.extra_coach_ids.includes(st.id)) teams.push({ id: t.id, name: t.name, role: 'adicional' });
    }
    teams.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'es') : a.role === 'titular' ? -1 : 1));
    const teamIds = new Set(teams.map((t) => t.id));

    const weekly: CoachWeekPoint[] = weeks.map((w) => ({ week: w, planned: 0, lists: 0, evaluations: 0 }));
    let lastActivity: string | null = null;

    // Sesiones planificadas: las de sus equipos + las que creó él en otro equipo.
    const sessions: CoachSessionItem[] = [];
    let createdByCoachWeek = 0;
    for (const s of input.trainingSessions) {
      const mine = !!auth && s.created_by === auth;
      if (auth && s.created_by === auth) lastActivity = maxIso(lastActivity, s.created_at);
      if (auth && s.updated_by === auth) lastActivity = maxIso(lastActivity, s.updated_at);
      if (!teamIds.has(s.team_id) && !mine) continue;
      const wi = weekIndex(s.session_date);
      if (wi >= 0) weekly[wi].planned += 1;
      if (!inWeek(s.session_date)) continue;
      if (mine) createdByCoachWeek += 1;
      sessions.push({
        id: s.id,
        team_id: s.team_id,
        team_name: teamName(s.team_id),
        session_date: s.session_date,
        objective: objectiveText(s.objectives),
        blocks: s.blocks_count,
        in_mesocycle: !!s.microcycle_day_id,
        created_by_name: s.created_by ? input.profileNames[s.created_by] ?? null : null,
        created_by_coach: mine,
      });
    }
    sessions.sort((a, b) => a.session_date.localeCompare(b.session_date) || a.team_name.localeCompare(b.team_name, 'es'));

    // Listas de asistencia atribuidas a la persona.
    const attendance: CoachAttendanceItem[] = [];
    const listDays = new Set<string>();
    for (const s of takenLists) {
      const recs = recordsBySession.get(s.id) ?? [];
      const markedByMe = !!auth && recs.some((r) => r.marked_by === auth);
      const isMine = s.coach_id === st.id
        || (!!auth && (s.created_by === auth || s.finalized_by === auth))
        || markedByMe;
      if (!isMine) continue;
      lastActivity = maxIso(lastActivity, s.finalized_at ?? s.created_at);
      if (auth) for (const r of recs) if (r.marked_by === auth) lastActivity = maxIso(lastActivity, r.created_at);
      const wi = weekIndex(s.session_date);
      if (wi >= 0) weekly[wi].lists += 1;
      if (!inWeek(s.session_date)) continue;
      listDays.add(s.session_date);
      attendance.push({
        id: s.id,
        team_id: s.team_id,
        team_name: teamName(s.team_id),
        session_date: s.session_date,
        present: recs.filter((r) => PRESENT.has(r.status ?? '')).length,
        total: recs.length,
        finalized: s.finalized === true,
      });
    }
    attendance.sort((a, b) => a.session_date.localeCompare(b.session_date) || a.team_name.localeCompare(b.team_name, 'es'));

    // Evaluaciones (performance_entries.recorded_by = su usuario).
    let entriesWeek = 0;
    const athletesWeek = new Set<string>();
    const byDay = new Map<string, { entries: number; athletes: Set<string> }>();
    if (auth) {
      for (const e of input.performanceEntries) {
        if (e.recorded_by !== auth) continue;
        lastActivity = maxIso(lastActivity, e.recorded_at);
        const day = bogotaYmd(e.recorded_at);
        const wi = weekIndex(day);
        if (wi >= 0) weekly[wi].evaluations += 1;
        if (!inWeek(day)) continue;
        entriesWeek += 1;
        athletesWeek.add(e.subject_id);
        const d = byDay.get(day) ?? { entries: 0, athletes: new Set<string>() };
        d.entries += 1;
        d.athletes.add(e.subject_id);
        byDay.set(day, d);
      }
    }
    let mesoEvalsWeek = 0;
    if (auth) {
      for (const e of input.mesoEvaluations) {
        if (e.created_by !== auth) continue;
        lastActivity = maxIso(lastActivity, e.created_at);
        if (inWeek(bogotaYmd(e.created_at))) mesoEvalsWeek += 1;
      }
    }

    // Mesociclo vigente por equipo (el más reciente que toca la semana).
    const mesocycles: CoachMesocycle[] = [];
    for (const team of teams) {
      const current = input.mesocycles
        .filter((m) => m.team_id === team.id && m.starts_on <= weekEnd && m.ends_on >= week)
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
      if (!current) continue;
      const cutoff = today < current.ends_on ? today : current.ends_on;
      const planned = input.trainingSessions.filter(
        (s) => s.team_id === team.id && s.session_date >= current.starts_on && s.session_date <= current.ends_on,
      );
      const dueDates = new Set(planned.filter((s) => s.session_date <= cutoff).map((s) => s.session_date));
      const listDates = listDatesByTeam.get(team.id) ?? new Set<string>();
      let done = 0;
      for (const d of dueDates) if (listDates.has(d)) done += 1;
      mesocycles.push({
        id: current.id,
        team_id: team.id,
        team_name: team.name,
        starts_on: current.starts_on,
        ends_on: current.ends_on,
        general_objective: current.general_objective,
        planned_total: Math.max(current.n_sessions_planned ?? 0, planned.length),
        planned_to_date: dueDates.size,
        done_to_date: done,
        adherence_pct: dueDates.size > 0 ? Math.round((done / dueDates.size) * 100) : null,
      });
    }

    const evaluationsCount = entriesWeek + mesoEvalsWeek;
    return {
      staff_id: st.id,
      full_name: st.full_name,
      has_account: !!auth,
      teams,
      last_activity_at: lastActivity,
      status: coachStatus({ planned: sessions.length, lists: attendance.length, evaluations: evaluationsCount }),
      sessions_planned_week: sessions.length,
      sessions_created_by_coach_week: createdByCoachWeek,
      attendance_sessions_week: attendance.length,
      days_with_list: listDays.size,
      evaluations_week: { entries: entriesWeek, athletes: athletesWeek.size },
      mesocycle_evaluations_week: mesoEvalsWeek,
      mesocycles,
      weekly,
      sessions,
      attendance,
      evaluations_by_day: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({ date, entries: d.entries, athletes: d.athletes.size })),
    };
  });

  // Primero los que necesitan atención (rojo, ámbar), luego por nombre.
  const order: Record<CoachStatus, number> = { rojo: 0, ambar: 1, verde: 2 };
  coaches.sort((a, b) => order[a.status] - order[b.status] || a.full_name.localeCompare(b.full_name, 'es'));

  return {
    week,
    week_end: weekEnd,
    weeks,
    coaches,
    totals: {
      coaches: coaches.length,
      verde: coaches.filter((c) => c.status === 'verde').length,
      ambar: coaches.filter((c) => c.status === 'ambar').length,
      rojo: coaches.filter((c) => c.status === 'rojo').length,
      sessions_planned: new Set(coaches.flatMap((c) => c.sessions.map((s) => s.id))).size,
      attendance_sessions: new Set(coaches.flatMap((c) => c.attendance.map((s) => s.id))).size,
      evaluations: coaches.reduce((n, c) => n + c.evaluations_week.entries + c.mesocycle_evaluations_week, 0),
    },
  };
}
