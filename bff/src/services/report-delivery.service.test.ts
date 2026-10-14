/**
 * Envío del Informe Mensual: el emisor diario corre a la vez en los 3 BFF
 * (dev/stg/prod) contra una sola base. Cada informe se RECLAMA
 * (send_claimed_at, con lease) antes de mandar el correo; si el envío falla se
 * libera para la próxima corrida.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    inserts: {} as Record<string, Record<string, any>[]>,
    sinColumnaLease: false,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas = [...(estado.tablas[tabla] ?? [])];
        const condiciones: ((f: any) => boolean)[] = [];
        let parche: any = null;
        let insertadas: any[] | null = null;
        const filtrar = (k: (f: any) => boolean) => { condiciones.push(k); filas = filas.filter(k); return api; };
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => filtrar((f) => f[c] === v),
            in: (c: string, vs: readonly any[]) => filtrar((f) => vs.includes(f[c])),
            is: (c: string, _v: null) => filtrar((f) => (f[c] ?? null) === null),
            lte: (c: string, v: any) => filtrar((f) => f[c] != null && f[c] <= v),
            // Solo la forma que usa el servicio: 'col.is.null,col.lt.<iso>'.
            or: (expr: string) => {
                const conds = expr.split(',').map((s) => {
                    const [c, op, ...r] = s.split('.');
                    const v = r.join('.');
                    return (f: any) => (op === 'is' ? (f[c] ?? null) === null : op === 'lt' ? f[c] != null && f[c] < v : false);
                });
                return filtrar((f) => conds.some((k) => k(f)));
            },
            order: () => api,
            limit: () => api,
            update: (patch: any) => { parche = patch; return api; },
            insert: (rows: any) => {
                insertadas = Array.isArray(rows) ? rows : [rows];
                (estado.inserts[tabla] ??= []).push(...insertadas);
                return api;
            },
            then: (ok: any, ko: any) => {
                if (parche && estado.sinColumnaLease && 'send_claimed_at' in parche) {
                    return Promise.resolve({
                        data: null, error: { code: 'PGRST204', message: "Could not find the 'send_claimed_at' column" },
                    }).then(ok, ko);
                }
                if (parche) {
                    // UPDATE condicional atómico: re-evalúa las condiciones sobre el
                    // estado ACTUAL de la fila, como haría Postgres.
                    filas = filas.filter((f) => condiciones.every((k) => k(f)));
                    filas.forEach((f) => Object.assign(f, parche));
                }
                return Promise.resolve({ data: insertadas ?? filas, error: null }).then(ok, ko);
            },
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

vi.mock('../utils/schoolBrandingResolver', () => ({
    resolveSchoolBranding: async () => ({ schoolName: 'Escuela', hasWhitelabel: false }),
}));
vi.mock('../utils/emailLayout', () => ({ buildBrandedEmail: () => '<html></html>' }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { deliverPublishedReports, SEND_LEASE_MS } = await import('./report-delivery.service');

const snapshot = {
    athlete: { name: 'Ana Pérez' },
    period: { label: 'septiembre 2026' },
    highlights: [], metrics: [], team_notes: [], coach_note: null,
    attendance: { pct: null, present: 0, total: 0 },
};

const informe = (id: string, extra: Record<string, any> = {}) => ({
    id, school_id: 'esc-1', period_year: 2026, period_month: 9, status: 'publicado',
    sent_at: null, send_claimed_at: null, subject_type: 'child', subject_id: 'nino-' + id,
    recipient_id: 'papa-' + id, snapshot, scheduled_for: '2026-10-01', team_id: 't1', ...extra,
});

const correosEnviados = () =>
    fetchMock.mock.calls.flatMap((c) => JSON.parse(c[1].body).batch.map((b: any) => b.to));

beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' });
    estado.sinColumnaLease = false;
    estado.inserts = {};
    estado.tablas = {
        athlete_reports: [informe('r1'), informe('r2')],
        profiles: [{ id: 'papa-r1', email: 'p1@x.co' }, { id: 'papa-r2', email: 'p2@x.co' }],
    };
});

describe('deliverPublishedReports — reclamo antes de enviar', () => {
    it('tres procesos a la vez: cada familia recibe UN correo', async () => {
        const salidas = await Promise.all([1, 2, 3].map(() => deliverPublishedReports('esc-1', 2026, 9)));
        expect(correosEnviados().sort()).toEqual(['p1@x.co', 'p2@x.co']);
        expect(salidas.reduce((n, s) => n + s.sent, 0)).toBe(2);
        expect(estado.inserts.notifications ?? []).toHaveLength(2);
        expect(estado.tablas.athlete_reports.every((r) => r.sent_at)).toBe(true);
    });

    it('reclamo vigente de otro proceso: no se reenvía', async () => {
        estado.tablas.athlete_reports[0].send_claimed_at = new Date().toISOString();
        const r = await deliverPublishedReports('esc-1', 2026, 9);
        expect(correosEnviados()).toEqual(['p2@x.co']);
        expect(r.results.find((x) => x.report_id === 'r1')?.reason).toMatch(/otro proceso/);
    });

    it('lease vencido (el proceso murió a mitad): se retoma', async () => {
        estado.tablas.athlete_reports[0].send_claimed_at = new Date(Date.now() - SEND_LEASE_MS - 60_000).toISOString();
        await deliverPublishedReports('esc-1', 2026, 9);
        expect(correosEnviados().sort()).toEqual(['p1@x.co', 'p2@x.co']);
    });

    it('si falla el envío se libera el reclamo y no se sella sent_at', async () => {
        fetchMock.mockResolvedValue({ ok: false, text: async () => 'boom' });
        const r = await deliverPublishedReports('esc-1', 2026, 9);
        expect(r.sent).toBe(0);
        expect(estado.tablas.athlete_reports.every((x) => x.sent_at === null && x.send_claimed_at === null)).toBe(true);
        expect(estado.inserts.notifications ?? []).toHaveLength(0);

        fetchMock.mockResolvedValue({ ok: true, text: async () => '' });
        const r2 = await deliverPublishedReports('esc-1', 2026, 9);
        expect(r2.sent).toBe(2);
    });

    it('sin la columna send_claimed_at (migración sin aplicar): reclama por sent_at, sigue sin duplicar', async () => {
        estado.sinColumnaLease = true;
        await Promise.all([1, 2, 3].map(() => deliverPublishedReports('esc-1', 2026, 9)));
        expect(correosEnviados().sort()).toEqual(['p1@x.co', 'p2@x.co']);
        expect(estado.tablas.athlete_reports.every((r) => r.sent_at)).toBe(true);
    });
});
