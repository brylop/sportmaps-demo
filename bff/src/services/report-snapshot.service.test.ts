// Tests unitarios de la lógica de agregación del snapshot de Evaluación
// Post-Entrenamiento (docs/specs/evaluacion-post-entrenamiento.md §3.4).
//
// Hoy esta lógica solo estaba cubierta por 2 tests E2E reales + tsc, sin red
// automática en CI. Cubre:
//   1. La regla más importante: 'distribution' (task_comprehension,
//      satisfaction) NUNCA promedia — siempre {value,label,n,pct}[].
//      'avg' (rpe_borg, self_effort_pct, coach_effort_rating) SÍ promedia.
//      'count' (focus_*) cuenta veces seleccionada sobre el total de
//      respuestas, con `n` = veces que se cargó rpe_borg en el periodo.
//   2. buildReportSnapshot(): metrics_session vacío cuando no hay mediciones
//      de sesión en el periodo, y separación limpia entre los dos sistemas
//      de agregación ('latest' vive en `metrics`, nunca en `metrics_session`).
//   3. Casos borde de loadSessionMetrics: cero mediciones, métrica sin
//      catálogo descartada en silencio, 'latest' excluida.
//
// Mock del cliente Supabase: builder encadenable en memoria que aplica los
// filtros (eq/gte/lte/in/not) sobre filas fijas por tabla, igual que el
// patrón ya usado en notification.service.test.ts.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MetricDefinition } from './metric-catalog.service';

type Row = Record<string, any>;

function applyOp(rows: Row[], op: string, args: any[]): Row[] {
    const [col, ...rest] = args;
    switch (op) {
        case 'eq': return rows.filter((r) => r[col] === rest[0]);
        case 'neq': return rows.filter((r) => r[col] !== rest[0]);
        case 'gte': return rows.filter((r) => r[col] >= rest[0]);
        case 'lte': return rows.filter((r) => r[col] <= rest[0]);
        case 'gt': return rows.filter((r) => r[col] > rest[0]);
        case 'lt': return rows.filter((r) => r[col] < rest[0]);
        case 'in': return rows.filter((r) => (rest[0] as any[]).includes(r[col]));
        case 'not': {
            const [subOp, val] = rest;
            if (subOp === 'is') return rows.filter((r) => (val === null ? r[col] != null : r[col] !== val));
            return rows;
        }
        default: return rows;
    }
}

const h = vi.hoisted(() => {
    const state: { tables: Record<string, Row[]> } = { tables: {} };

    function makeBuilder(table: string) {
        const filters: [string, any[]][] = [];
        const b: any = {};
        b.select = (..._args: any[]) => b;
        b.order = (..._args: any[]) => b;
        for (const m of ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in', 'not']) {
            b[m] = (...args: any[]) => { filters.push([m, args]); return b; };
        }
        const resolveRows = () =>
            filters.reduce((acc, [op, args]) => applyOp(acc, op, args), state.tables[table] ?? []);
        b.maybeSingle = () => Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
        b.single = () => Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
        b.then = (res: any, rej: any) => Promise.resolve({ data: resolveRows(), error: null }).then(res, rej);
        return b;
    }

    return {
        state,
        supabase: { from: (t: string) => makeBuilder(t) },
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));

import { loadSessionMetrics, buildReportSnapshot } from './report-snapshot.service';

beforeEach(() => {
    h.state.tables = {};
});

/** Fixture mínima de MetricDefinition, con overrides puntuales por test. */
function metricDef(overrides: Partial<MetricDefinition> & { metric_key: string; aggregation: MetricDefinition['aggregation'] }): MetricDefinition {
    return {
        id: overrides.metric_key,
        metric_key: overrides.metric_key,
        display_name: overrides.metric_key,
        parent_label: null,
        parent_hint: null,
        data_type: 'number',
        unit: null,
        category: 'wellness',
        subcategory: null,
        min_value: null,
        max_value: null,
        higher_is_better: true,
        is_active: true,
        options: null,
        required: false,
        thresholds: [],
        ...overrides,
    };
}

const SCHOOL_ID = 's1';
const SUBJECT_TYPE = 'profile' as const;
const SUBJECT_ID = 'a1';
const PERIOD_START = new Date('2026-01-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-01-31T23:59:59.000Z');

/** Siembra performance_entries de tipo 'session' para loadSessionMetrics. */
function seedSessionEntries(entries: { metric_key: string; value: number; recorded_at?: string }[]) {
    h.state.tables.performance_entries = entries.map((e) => ({
        school_id: SCHOOL_ID,
        subject_type: SUBJECT_TYPE,
        subject_id: SUBJECT_ID,
        context_type: 'session',
        recorded_at: e.recorded_at ?? '2026-01-15T10:00:00.000Z',
        metric_key: e.metric_key,
        value: e.value,
    }));
}

describe('loadSessionMetrics — regla de agregación por tipo', () => {
    it('distribution (task_comprehension, satisfaction) NUNCA promedia: devuelve {value,label,n,pct}[], nunca avg', async () => {
        seedSessionEntries([
            { metric_key: 'task_comprehension', value: 1 },
            { metric_key: 'task_comprehension', value: 1 },
            { metric_key: 'task_comprehension', value: 2 },
            { metric_key: 'satisfaction', value: 5 },
            { metric_key: 'satisfaction', value: 5 },
        ]);
        const catalogo = new Map([
            ['task_comprehension', metricDef({
                metric_key: 'task_comprehension',
                aggregation: 'distribution',
                options: [{ value: 1, label: 'Entendió todo' }, { value: 2, label: 'Le costó' }],
            })],
            ['satisfaction', metricDef({
                metric_key: 'satisfaction',
                aggregation: 'distribution',
                options: [{ value: 5, label: 'Muy satisfecho' }, { value: 1, label: 'Nada satisfecho' }],
            })],
        ]);

        const result = await loadSessionMetrics(SCHOOL_ID, SUBJECT_TYPE, SUBJECT_ID, PERIOD_START, PERIOD_END, catalogo);

        const comprension = result.find((m) => m.metric_key === 'task_comprehension')!;
        expect(comprension).toBeDefined();
        expect(comprension.aggregation).toBe('distribution');
        expect(comprension.avg).toBeUndefined();
        expect(comprension.count).toBeUndefined();
        expect(comprension.n).toBe(3);
        expect(comprension.distribution).toEqual([
            { value: 1, label: 'Entendió todo', n: 2, pct: 66.7 },
            { value: 2, label: 'Le costó', n: 1, pct: 33.3 },
        ]);

        const satisfaccion = result.find((m) => m.metric_key === 'satisfaction')!;
        expect(satisfaccion.aggregation).toBe('distribution');
        expect(satisfaccion.avg).toBeUndefined();
        expect(satisfaccion.distribution).toEqual([
            { value: 5, label: 'Muy satisfecho', n: 2, pct: 100 },
            { value: 1, label: 'Nada satisfecho', n: 0, pct: 0 },
        ]);
    });

    it("avg (rpe_borg, self_effort_pct, coach_effort_rating) SÍ promedia", async () => {
        seedSessionEntries([
            { metric_key: 'rpe_borg', value: 5 },
            { metric_key: 'rpe_borg', value: 6 },
            { metric_key: 'rpe_borg', value: 7 },
        ]);
        const catalogo = new Map([
            ['rpe_borg', metricDef({ metric_key: 'rpe_borg', aggregation: 'avg' })],
        ]);

        const result = await loadSessionMetrics(SCHOOL_ID, SUBJECT_TYPE, SUBJECT_ID, PERIOD_START, PERIOD_END, catalogo);

        expect(result).toHaveLength(1);
        expect(result[0].aggregation).toBe('avg');
        expect(result[0].avg).toBe(6);
        expect(result[0].distribution).toBeUndefined();
        expect(result[0].n).toBe(3);
    });

    it("count (focus_*) cuenta veces seleccionada; n = veces que se cargó rpe_borg (ancla de sesión respondida)", async () => {
        seedSessionEntries([
            { metric_key: 'rpe_borg', value: 5 },
            { metric_key: 'rpe_borg', value: 6 },
            { metric_key: 'rpe_borg', value: 7 },
            { metric_key: 'rpe_borg', value: 4 },
            { metric_key: 'focus_tactics', value: 1 },
            { metric_key: 'focus_tactics', value: 1 },
            { metric_key: 'focus_tactics', value: 1 },
        ]);
        const catalogo = new Map([
            ['rpe_borg', metricDef({ metric_key: 'rpe_borg', aggregation: 'avg' })],
            ['focus_tactics', metricDef({ metric_key: 'focus_tactics', aggregation: 'count' })],
        ]);

        const result = await loadSessionMetrics(SCHOOL_ID, SUBJECT_TYPE, SUBJECT_ID, PERIOD_START, PERIOD_END, catalogo);

        const foco = result.find((m) => m.metric_key === 'focus_tactics')!;
        expect(foco.aggregation).toBe('count');
        expect(foco.n).toBe(4); // 4 sesiones respondidas (rpe_borg), no 3 (veces seleccionado)
        expect(foco.count).toBe(3);
        expect(foco.avg).toBeUndefined();
        expect(foco.distribution).toBeUndefined();
    });
});

describe('loadSessionMetrics — casos borde', () => {
    it('cero mediciones en el periodo → array vacío, no error', async () => {
        seedSessionEntries([]);
        const catalogo = new Map([
            ['rpe_borg', metricDef({ metric_key: 'rpe_borg', aggregation: 'avg' })],
        ]);

        const result = await loadSessionMetrics(SCHOOL_ID, SUBJECT_TYPE, SUBJECT_ID, PERIOD_START, PERIOD_END, catalogo);

        expect(result).toEqual([]);
    });

    it('métrica sin definición en el catálogo se descarta silenciosamente', async () => {
        seedSessionEntries([
            { metric_key: 'rpe_borg', value: 5 },
            { metric_key: 'metrica_fantasma', value: 1 },
        ]);
        // El catálogo solo conoce rpe_borg; metrica_fantasma no tiene definición.
        const catalogo = new Map([
            ['rpe_borg', metricDef({ metric_key: 'rpe_borg', aggregation: 'avg' })],
        ]);

        const result = await loadSessionMetrics(SCHOOL_ID, SUBJECT_TYPE, SUBJECT_ID, PERIOD_START, PERIOD_END, catalogo);

        expect(result).toHaveLength(1);
        expect(result.some((m) => m.metric_key === 'metrica_fantasma')).toBe(false);
    });

    it("métricas con aggregation='latest' quedan FUERA de metrics_session (viven en `metrics`)", async () => {
        seedSessionEntries([
            { metric_key: 'rpe_borg', value: 5 },
            { metric_key: 'jump_height', value: 45 }, // física periódica, 'latest'
        ]);
        const catalogo = new Map([
            ['rpe_borg', metricDef({ metric_key: 'rpe_borg', aggregation: 'avg' })],
            ['jump_height', metricDef({ metric_key: 'jump_height', aggregation: 'latest' })],
        ]);

        const result = await loadSessionMetrics(SCHOOL_ID, SUBJECT_TYPE, SUBJECT_ID, PERIOD_START, PERIOD_END, catalogo);

        expect(result).toHaveLength(1);
        expect(result[0].metric_key).toBe('rpe_borg');
        expect(result.some((m) => m.metric_key === 'jump_height')).toBe(false);
    });
});

describe('buildReportSnapshot — separación entre metrics y metrics_session', () => {
    function seedBaseSubjectAndSchool(sportCategoryName = 'Baloncesto') {
        h.state.tables.profiles = [{ id: SUBJECT_ID, full_name: 'Juan Pérez' }];
        h.state.tables.schools = [{
            id: SCHOOL_ID,
            name: 'Escuela X',
            category_id: 'cat1',
            sports_categories: { name: sportCategoryName },
        }];
        h.state.tables.enrollments = [];
        h.state.tables.team_report_notes = [];
        h.state.tables.attendance_records = [];
        h.state.tables.sport_metric_thresholds = [];
    }

    it('metrics_session: [] cuando no hay mediciones de sesión en el periodo (no explota ni trae basura)', async () => {
        seedBaseSubjectAndSchool();
        // Solo hay una medición 'latest' (física periódica), sin context_type='session'.
        h.state.tables.performance_entries = [{
            school_id: SCHOOL_ID,
            subject_type: SUBJECT_TYPE,
            subject_id: SUBJECT_ID,
            context_type: 'physical_test',
            metric_key: 'jump_height',
            value: 45,
            recorded_at: '2026-01-10T00:00:00.000Z',
        }];
        h.state.tables.sport_metric_definitions = [{
            id: 'd1',
            metric_key: 'jump_height',
            display_name: 'Salto vertical',
            parent_label: null,
            parent_hint: null,
            data_type: 'number',
            unit: 'cm',
            category: 'fisico',
            subcategory: null,
            min_value: null,
            max_value: null,
            higher_is_better: true,
            is_active: true,
            aggregation: 'latest',
            options: null,
            required: false,
            sport_category_id: 'cat1',
        }];

        const snapshot = await buildReportSnapshot({
            schoolId: SCHOOL_ID,
            subjectType: SUBJECT_TYPE,
            subjectId: SUBJECT_ID,
            year: 2026,
            month: 1,
            governingTeamId: null,
            coachNote: null,
        });

        expect(snapshot.metrics_session).toEqual([]);
        // La métrica 'latest' sigue viva en `metrics` (última-vs-anterior), no se pierde.
        expect(snapshot.metrics.some((m) => m.metric_key === 'jump_height')).toBe(true);
    });

    it('no mezcla los dos sistemas: latest solo en `metrics`, avg/distribution/count solo en `metrics_session`', async () => {
        seedBaseSubjectAndSchool();
        h.state.tables.performance_entries = [
            {
                school_id: SCHOOL_ID, subject_type: SUBJECT_TYPE, subject_id: SUBJECT_ID,
                context_type: 'physical_test', metric_key: 'jump_height', value: 45,
                recorded_at: '2026-01-10T00:00:00.000Z',
            },
            {
                school_id: SCHOOL_ID, subject_type: SUBJECT_TYPE, subject_id: SUBJECT_ID,
                context_type: 'session', metric_key: 'rpe_borg', value: 5,
                recorded_at: '2026-01-12T00:00:00.000Z',
            },
            {
                school_id: SCHOOL_ID, subject_type: SUBJECT_TYPE, subject_id: SUBJECT_ID,
                context_type: 'session', metric_key: 'rpe_borg', value: 7,
                recorded_at: '2026-01-20T00:00:00.000Z',
            },
        ];
        h.state.tables.sport_metric_definitions = [
            {
                id: 'd1', metric_key: 'jump_height', display_name: 'Salto vertical',
                parent_label: null, parent_hint: null, data_type: 'number', unit: 'cm',
                category: 'fisico', subcategory: null, min_value: null, max_value: null,
                higher_is_better: true, is_active: true, aggregation: 'latest',
                options: null, required: false, sport_category_id: 'cat1',
            },
            {
                id: 'd2', metric_key: 'rpe_borg', display_name: 'Percepción de esfuerzo (BORG)',
                parent_label: 'Cansancio', parent_hint: null, data_type: 'number', unit: null,
                category: 'wellness', subcategory: null, min_value: 0, max_value: 10,
                higher_is_better: false, is_active: true, aggregation: 'avg',
                options: null, required: true, sport_category_id: 'cat1',
            },
        ];

        const snapshot = await buildReportSnapshot({
            schoolId: SCHOOL_ID,
            subjectType: SUBJECT_TYPE,
            subjectId: SUBJECT_ID,
            year: 2026,
            month: 1,
            governingTeamId: null,
            coachNote: null,
        });

        expect(snapshot.metrics.map((m) => m.metric_key)).toEqual(['jump_height']);
        expect(snapshot.metrics_session).toHaveLength(1);
        expect(snapshot.metrics_session[0]).toMatchObject({ metric_key: 'rpe_borg', aggregation: 'avg', avg: 6, n: 2 });
        // Sin cruce: rpe_borg no aparece en `metrics`, jump_height no aparece en `metrics_session`.
        expect(snapshot.metrics.some((m) => m.metric_key === 'rpe_borg')).toBe(false);
        expect(snapshot.metrics_session.some((m: any) => m.metric_key === 'jump_height')).toBe(false);
    });
});
