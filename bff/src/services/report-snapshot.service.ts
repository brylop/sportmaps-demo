/**
 * Arma el snapshot del Informe Mensual del Atleta.
 *
 * El snapshot es la ÚNICA fuente de la vista del padre, del correo y del PDF
 * (spec §8.4). Se congela al publicar: un informe que la familia ya leyó no
 * puede cambiar en silencio si mañana se corrige una medición.
 *
 * Vive en el BFF y no en SQL a propósito — decisión D-G de
 * `docs/plan-f1-informes-backend.md`: el cálculo de deltas, bandas y destacados
 * ya existe en el frontend, varias columnas que necesita no están versionadas, y
 * dos implementaciones del mismo ranking terminan divergiendo.
 *
 * ⚠️ GEMELO: el ranking de abajo es la contraparte de `pickHighlights` /
 * `pickToWorkOn` / `computeDelta` en `frontend/src/lib/school/performanceDisplay.ts`.
 * Son dos paquetes distintos, así que no se puede importar. Si se cambia el
 * criterio de uno hay que cambiar el otro, o el padre y el coach verán números
 * distintos del mismo mes. Los informes YA publicados no se ven afectados: leen
 * el snapshot congelado, no recalculan.
 */
import { supabase } from '../config/supabase';
import {
    getMetricCatalog,
    computeBand,
    type Band,
    type MetricDefinition,
} from './metric-catalog.service';

export type SubjectType = 'profile' | 'child' | 'unregistered';

export interface SnapshotMetric {
    metric_key: string;
    /** Rótulo de familia si existe; si no, el técnico. Resuelto acá, no en la UI. */
    label: string;
    hint: string | null;
    category: string | null;
    unit: string | null;
    higher_is_better: boolean;
    value: number;
    previous: number | null;
    delta: number | null;
    /** Δ relativo al rango de las bandas, o al valor previo. Ordena los destacados. */
    score: number | null;
    band: Band | null;
    measured_at: string;
}

/** Acumulados de fútbol DENTRO del periodo del informe -- derivados de
 *  match_lineup_players/football_match_events, no de performance_entries.
 *  null si el atleta no juega fútbol o no tuvo actividad este mes. */
export interface FootballSummary {
    matches_played: number;
    minutes_played: number;
    goals: number;
    own_goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
}

export interface ReportSnapshot {
    version: 1;
    generated_at: string;
    period: { year: number; month: number; label: string };
    athlete: { name: string; subject_type: SubjectType; subject_id: string };
    school: { id: string; name: string };
    teams: { id: string; name: string }[];
    governing_team: { id: string; name: string } | null;
    team_notes: { team_id: string; team_name: string; body: string }[];
    coach_note: string | null;
    attendance: { present: number; total: number; pct: number | null };
    highlights: SnapshotMetric[];
    to_work_on: SnapshotMetric[];
    metrics: SnapshotMetric[];
    football: FootballSummary | null;
}

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Columna de `enrollments` / `attendance_records` según el tipo de sujeto. */
function athleteColumn(t: SubjectType): 'user_id' | 'child_id' | 'unregistered_athlete_id' {
    return t === 'profile' ? 'user_id' : t === 'child' ? 'child_id' : 'unregistered_athlete_id';
}

/** Ancho de la banda verde→roja, para normalizar mejoras entre métricas. */
function metricRange(def: MetricDefinition): number | null {
    const values = def.thresholds
        .flatMap((t) => [t.min_value, t.max_value])
        .filter((v): v is number => typeof v === 'number');
    if (values.length < 2) return null;
    const span = Math.max(...values) - Math.min(...values);
    return span > 0 ? span : null;
}

/**
 * Cuánto mejoró, comparable entre métricas.
 *
 * Con bandas: Δ dividido por el ancho de la banda — «subió media banda».
 * Sin bandas: Δ relativo al valor previo. Los dos números no son estrictamente
 * comparables, y por eso las métricas en cm (sin bandas por edad todavía)
 * puntúan más bajo que las de 0-10. Se corrige solo cuando el coach cargue
 * normas por edad; no se compensa con un factor inventado.
 */
function improvementScore(def: MetricDefinition, current: number, previous: number | null): number | null {
    if (previous === null) return null;
    const raw = current - previous;
    const signed = def.higher_is_better ? raw : -raw;
    if (signed === 0) return 0;

    const range = metricRange(def);
    if (range) return signed / range;
    if (previous !== 0) return signed / Math.abs(previous);
    return null;
}

/**
 * Una medición por métrica: la última del periodo, más la anterior a ella (de
 * cualquier fecha) para poder calcular el delta. Sin la previa no hay «mejoró».
 */
async function loadMetricSeries(
    schoolId: string,
    subjectType: SubjectType,
    subjectId: string,
    periodEnd: Date,
    periodStart: Date,
) {
    const { data, error } = await supabase
        .from('performance_entries')
        .select('metric_key, value, recorded_at')
        .eq('school_id', schoolId)
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .lte('recorded_at', periodEnd.toISOString())
        .order('recorded_at', { ascending: true });

    if (error) throw error;

    const porMetrica = new Map<string, { value: number; recorded_at: string }[]>();
    for (const row of (data ?? []) as any[]) {
        const arr = porMetrica.get(row.metric_key) ?? [];
        arr.push({ value: Number(row.value), recorded_at: row.recorded_at });
        porMetrica.set(row.metric_key, arr);
    }

    // Solo entran las métricas medidas DENTRO del periodo: el informe de agosto
    // no habla de una métrica que solo se midió en junio.
    const resultado = new Map<string, { current: { value: number; recorded_at: string }; previous: number | null }>();
    for (const [key, serie] of porMetrica) {
        const ultima = serie[serie.length - 1];
        if (new Date(ultima.recorded_at) < periodStart) continue;
        resultado.set(key, {
            current: ultima,
            previous: serie.length >= 2 ? serie[serie.length - 2].value : null,
        });
    }
    return resultado;
}

/**
 * Asistencia del mes. `attendance_records` guarda una fila por atleta y día con
 * su estado; presente y tarde cuentan como asistencia.
 */
async function loadAttendance(
    schoolId: string,
    subjectType: SubjectType,
    subjectId: string,
    periodStart: Date,
    periodEnd: Date,
) {
    const columna = athleteColumn(subjectType);
    const { data, error } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('school_id', schoolId)
        .eq(columna, subjectId)
        .gte('attendance_date', periodStart.toISOString().slice(0, 10))
        .lte('attendance_date', periodEnd.toISOString().slice(0, 10));

    // La asistencia es un adorno del informe, no su razón de ser: si falla, el
    // informe igual sale. Sin esto un esquema distinto de attendance_records
    // tumbaría toda la publicación.
    if (error) return { present: 0, total: 0, pct: null };

    const filas = (data ?? []) as { status: string }[];
    const total = filas.length;
    const present = filas.filter((r) => r.status === 'present' || r.status === 'late').length;
    return { present, total, pct: total > 0 ? Math.round((present / total) * 100) : null };
}

/**
 * Acumulados de fútbol del periodo: alineaciones (minutos) + eventos (goles,
 * asistencias, tarjetas), acotados a partidos cuya fecha cae dentro del mes.
 * Igual que loadAttendance: es un complemento del informe, no su razón de
 * ser -- si algo falla, el informe sale igual sin la sección de fútbol.
 */
async function loadFootballSummary(
    schoolId: string,
    subjectType: SubjectType,
    subjectId: string,
    periodStart: Date,
    periodEnd: Date,
): Promise<FootballSummary | null> {
    try {
        const { data: lineupRows, error: lineupErr } = await supabase
            .from('match_lineup_players')
            .select('minutes_played, match_lineups!inner(source_type, source_id)')
            .eq('school_id', schoolId)
            .eq('subject_type', subjectType)
            .eq('subject_id', subjectId);
        if (lineupErr) throw lineupErr;

        const rows = (lineupRows ?? []) as any[];
        if (rows.length === 0) return null;

        const teamMatchIds = rows
            .filter((r) => r.match_lineups.source_type === 'team_match')
            .map((r) => r.match_lineups.source_id);
        const tournamentMatchIds = rows
            .filter((r) => r.match_lineups.source_type === 'tournament_match')
            .map((r) => r.match_lineups.source_id);

        const periodStartDate = periodStart.toISOString().slice(0, 10);
        const periodEndDate = periodEnd.toISOString().slice(0, 10);

        const [teamMatchesInPeriod, tournamentMatchesInPeriod] = await Promise.all([
            teamMatchIds.length > 0
                ? supabase.from('match_results').select('id')
                    .in('id', teamMatchIds)
                    .gte('match_date', periodStartDate)
                    .lte('match_date', periodEndDate)
                : Promise.resolve({ data: [] as { id: string }[] }),
            tournamentMatchIds.length > 0
                ? supabase.from('tournament_matches').select('id')
                    .in('id', tournamentMatchIds)
                    .gte('scheduled_at', periodStart.toISOString())
                    .lte('scheduled_at', periodEnd.toISOString())
                : Promise.resolve({ data: [] as { id: string }[] }),
        ]);

        const qualifyingIds = new Set([
            ...((teamMatchesInPeriod.data ?? []) as { id: string }[]).map((m) => m.id),
            ...((tournamentMatchesInPeriod.data ?? []) as { id: string }[]).map((m) => m.id),
        ]);

        const rowsInPeriod = rows.filter((r) => qualifyingIds.has(r.match_lineups.source_id));
        if (rowsInPeriod.length === 0) return null;

        const matches_played = rowsInPeriod.filter((r) => r.minutes_played && r.minutes_played > 0).length;
        const minutes_played = rowsInPeriod.reduce((sum, r) => sum + (r.minutes_played ?? 0), 0);

        const { data: eventRows, error: eventsErr } = await supabase
            .from('football_match_events')
            .select('type, source_id')
            .eq('school_id', schoolId)
            .eq('subject_type', subjectType)
            .eq('subject_id', subjectId);
        if (eventsErr) throw eventsErr;

        const eventsInPeriod = ((eventRows ?? []) as { type: string; source_id: string }[])
            .filter((e) => qualifyingIds.has(e.source_id));

        const counts = { goals: 0, own_goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
        for (const e of eventsInPeriod) {
            if (e.type === 'goal') counts.goals++;
            else if (e.type === 'own_goal') counts.own_goals++;
            else if (e.type === 'assist') counts.assists++;
            else if (e.type === 'yellow') counts.yellow_cards++;
            else if (e.type === 'red') counts.red_cards++;
        }

        return { matches_played, minutes_played, ...counts };
    } catch {
        return null;
    }
}

export interface BuildSnapshotInput {
    schoolId: string;
    subjectType: SubjectType;
    subjectId: string;
    year: number;
    month: number;
    /** Equipo que manda la fecha (D17). Puede ser null: atleta sin equipo (D-C). */
    governingTeamId: string | null;
    coachNote: string | null;
}

export async function buildReportSnapshot(input: BuildSnapshotInput): Promise<ReportSnapshot> {
    const { schoolId, subjectType, subjectId, year, month, governingTeamId, coachNote } = input;

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    // ── Nombre del atleta y de la escuela ────────────────────────────────────
    const tablaSujeto = subjectType === 'profile' ? 'profiles'
        : subjectType === 'child' ? 'children'
        : 'unregistered_athletes';

    const [sujetoRes, escuelaRes] = await Promise.all([
        supabase.from(tablaSujeto).select('full_name').eq('id', subjectId).maybeSingle(),
        supabase.from('schools').select('id, name, category_id, sports_categories(name)').eq('id', schoolId).maybeSingle(),
    ]);

    const athleteName = (sujetoRes.data as any)?.full_name || 'El atleta';
    const schoolName = (escuelaRes.data as any)?.name || 'la escuela';
    const sportCategoryId = (escuelaRes.data as any)?.category_id as string | null;
    const sportCategoryName = ((escuelaRes.data as any)?.sports_categories?.name as string | undefined)?.toLowerCase();
    const isFootball = sportCategoryName === 'fútbol' || sportCategoryName === 'futbol';

    // ── Equipos del atleta vigentes en el periodo ────────────────────────────
    const columna = athleteColumn(subjectType);
    const { data: inscripciones } = await supabase
        .from('enrollments')
        .select('team_id, teams(id, name)')
        .eq('school_id', schoolId)
        .eq(columna, subjectId)
        .not('team_id', 'is', null)
        .lte('start_date', periodEnd.toISOString().slice(0, 10));

    const teams = ((inscripciones ?? []) as any[])
        .map((r) => r.teams)
        .filter((t): t is { id: string; name: string } => !!t);

    const governingTeam = governingTeamId
        ? teams.find((t) => t.id === governingTeamId) ?? null
        : null;

    // ── Notas de TODOS sus equipos del periodo (D17) ─────────────────────────
    // No solo la del gobernante: el snapshot promete «las notas de todos sus
    // equipos», y con el día más tardío gobernando ya vencieron todos los plazos.
    let teamNotes: ReportSnapshot['team_notes'] = [];
    if (teams.length > 0) {
        const { data: notas } = await supabase
            .from('team_report_notes')
            .select('team_id, body')
            .eq('school_id', schoolId)
            .eq('period_year', year)
            .eq('period_month', month)
            .in('team_id', teams.map((t) => t.id));

        teamNotes = ((notas ?? []) as any[]).map((n) => ({
            team_id: n.team_id,
            team_name: teams.find((t) => t.id === n.team_id)?.name ?? 'Equipo',
            body: n.body,
        }));
    }

    // ── Métricas ─────────────────────────────────────────────────────────────
    const [series, attendance, football] = await Promise.all([
        loadMetricSeries(schoolId, subjectType, subjectId, periodEnd, periodStart),
        loadAttendance(schoolId, subjectType, subjectId, periodStart, periodEnd),
        isFootball ? loadFootballSummary(schoolId, subjectType, subjectId, periodStart, periodEnd) : Promise.resolve(null),
    ]);

    // getMetricCatalog devuelve un array; se indexa por metric_key para no
    // recorrerlo una vez por medición.
    const definiciones = sportCategoryId
        ? await getMetricCatalog([sportCategoryId], { includeInactive: true })
        : [];
    const catalogo = new Map<string, MetricDefinition>(definiciones.map((d) => [d.metric_key, d]));

    const metrics: SnapshotMetric[] = [];
    for (const [key, punto] of series) {
        const def = catalogo.get(key);
        if (!def) continue; // métrica sin catálogo: no hay forma de nombrarla al padre

        metrics.push({
            metric_key: key,
            // El rótulo de familia se resuelve ACÁ y queda congelado: si mañana
            // el coach lo cambia, el informe que el padre ya leyó no se altera.
            label: def.parent_label ?? def.display_name,
            hint: def.parent_hint,
            category: def.category,
            unit: def.unit,
            higher_is_better: def.higher_is_better,
            value: punto.current.value,
            previous: punto.previous,
            delta: punto.previous === null ? null : punto.current.value - punto.previous,
            score: improvementScore(def, punto.current.value, punto.previous),
            band: computeBand(punto.current.value, def.thresholds),
            measured_at: punto.current.recorded_at,
        });
    }

    // Lo mejor de cada área, no el top-3 global: comparar entre categorías es lo
    // más débil (táctica y técnica son 0-6 y físico mezcla cm, reps y segundos),
    // y una familia entiende mejor un avance por área.
    const mejorPorCategoria = new Map<string, SnapshotMetric>();
    for (const m of metrics) {
        if (m.score === null || m.score <= 0) continue;
        const cat = m.category ?? 'other';
        const previo = mejorPorCategoria.get(cat);
        if (!previo || (m.score ?? 0) > (previo.score ?? 0)) mejorPorCategoria.set(cat, m);
    }
    const highlights = [...mejorPorCategoria.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Primero lo rojo, después lo amarillo; dentro de cada banda, lo peor arriba.
    const orden: Record<string, number> = { red: 0, yellow: 1 };
    const toWorkOn = metrics
        .filter((m) => m.band === 'red' || m.band === 'yellow')
        .sort((a, b) => (orden[a.band!] - orden[b.band!]) || ((a.score ?? 0) - (b.score ?? 0)))
        .slice(0, 3);

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        period: { year, month, label: `${MESES[month - 1]} ${year}` },
        athlete: { name: athleteName, subject_type: subjectType, subject_id: subjectId },
        school: { id: schoolId, name: schoolName },
        teams,
        governing_team: governingTeam,
        team_notes: teamNotes,
        coach_note: coachNote,
        attendance,
        highlights,
        to_work_on: toWorkOn,
        metrics,
        football,
    };
}
