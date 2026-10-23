/**
 * plan-change-detector.job con una base simulada que SÍ aplica los filtros
 * (eq / in / not / gt / gte / lt) y el UPDATE condicionado: es lo que hace
 * seguro el cambio con varios BFF a la vez.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    updates: [] as Array<{ tabla: string; id: any; patch: any }>,
    lecturaFalla: null as string | null,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        // Los filtros se guardan y se evalúan al EJECUTAR (como Postgres): así dos UPDATE
        // concurrentes sobre la misma fila no pueden ver ambos el estado viejo.
        const filtros: Array<(f: Record<string, any>) => boolean> = [];
        let parche: any = null;
        let insertar: any[] | null = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filtros.push((f) => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filtros.push((f) => vs.includes(f[c])); return api; },
            not: (c: string) => { filtros.push((f) => f[c] != null); return api; },
            gt: (c: string, v: any) => { filtros.push((f) => Number(f[c]) > Number(v)); return api; },
            gte: (c: string, v: any) => { filtros.push((f) => f[c] != null && String(f[c]) >= String(v)); return api; },
            or: () => api,
            limit: () => api,
            update: (p: any) => { parche = p; return api; },
            insert: (r: any) => { insertar = Array.isArray(r) ? r : [r]; return api; },
            then: (ok: any, ko: any) => {
                if (estado.lecturaFalla && tabla === estado.lecturaFalla) {
                    return Promise.resolve({ data: null, error: { message: 'boom' } }).then(ok, ko);
                }
                if (insertar) {
                    (estado.tablas[tabla] ??= []).push(...insertar.map((r) => ({ created_at: new Date().toISOString(), ...r })));
                    return Promise.resolve({ data: insertar, error: null }).then(ok, ko);
                }
                if (parche) estado.antesDeUpdate?.(tabla);
                const filas = (estado.tablas[tabla] ?? []).filter((f) => filtros.every((fn) => fn(f)));
                if (parche) {
                    filas.forEach((f) => { Object.assign(f, parche); estado.updates.push({ tabla, id: f.id, patch: parche }); });
                }
                return Promise.resolve({ data: filas, error: null }).then(ok, ko);
            },
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

const { runPlanChangeDetector, escuelasAutorizadas } = await import('./plan-change-detector.job');

const ESC = 'esc-1';
const hoy = () => new Date().toISOString().slice(0, 10);
const mesActual = () => {
    const d = new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
};
const mesPrevio = () => {
    const { y, m } = mesActual();
    return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
};

const pagoDe = (id: string, hijo: string, amount: number, per: { y: number; m: number }, fecha = hoy()) => ({
    id, school_id: ESC, child_id: hijo, user_id: null, unregistered_athlete_id: null, amount, status: 'paid',
    payment_category: 'mensualidad', period_year: per.y, period_month: per.m, payment_date: fecha,
});

beforeEach(() => {
    estado.updates = [];
    estado.lecturaFalla = null;
    estado.antesDeUpdate = null;
    const { y, m } = mesActual();
    const prev = mesPrevio();
    const haceUnMes = new Date(Date.now() - 32 * 86_400_000).toISOString().slice(0, 10);
    estado.tablas = {
        schools: [{ id: ESC, owner_id: 'dueno-1', name: 'Dynasty' }],
        offering_plans: [
            { id: 'elite', school_id: ESC, name: 'ELITE', price: 180000, is_active: true },
            { id: 'pro', school_id: ESC, name: 'PRO', price: 150000, is_active: true },
            { id: 'start', school_id: ESC, name: 'START', price: 90000, is_active: true },
            { id: 'basic', school_id: ESC, name: 'BASIC', price: 90000, is_active: true },
        ],
        enrollments: [
            { id: 'e-ana', school_id: ESC, child_id: 'ana', user_id: null, unregistered_athlete_id: null, offering_plan_id: 'elite', monthly_fee: 180000, fee_is_manual: false, status: 'active' },
            { id: 'e-beto', school_id: ESC, child_id: 'beto', user_id: null, unregistered_athlete_id: null, offering_plan_id: 'elite', monthly_fee: 180000, fee_is_manual: false, status: 'active' },
            { id: 'e-cata', school_id: ESC, child_id: 'cata', user_id: null, unregistered_athlete_id: null, offering_plan_id: 'elite', monthly_fee: 180000, fee_is_manual: true, status: 'active' },
            { id: 'e-dani', school_id: ESC, child_id: 'dani', user_id: null, unregistered_athlete_id: null, offering_plan_id: 'elite', monthly_fee: 180000, fee_is_manual: false, status: 'active' },
            { id: 'e-eli', school_id: ESC, child_id: 'eli', user_id: null, unregistered_athlete_id: null, offering_plan_id: 'elite', monthly_fee: 180000, fee_is_manual: false, status: 'active' },
        ],
        payments: [
            // Ana: dos periodos seguidos a $150.000 → cambia a Pro.
            pagoDe('p-ana-1', 'ana', 150000, prev, haceUnMes), pagoDe('p-ana-2', 'ana', 150000, { y, m }),
            // Beto: primera vez a $150.000 → solo avisa.
            pagoDe('p-beto', 'beto', 150000, { y, m }),
            // Cata: valor pactado a mano → solo avisa.
            pagoDe('p-cata-1', 'cata', 150000, prev, haceUnMes), pagoDe('p-cata-2', 'cata', 150000, { y, m }),
            // Dani: $90.000 dos periodos → ambiguo (Start/Basic): solo avisa.
            pagoDe('p-dani-1', 'dani', 90000, prev, haceUnMes), pagoDe('p-dani-2', 'dani', 90000, { y, m }),
            // Eli: pagó lo esperado → nada.
            pagoDe('p-eli', 'eli', 180000, { y, m }),
        ],
        notifications: [],
    };
});

const planDe = (enr: string) => estado.tablas.enrollments.find((e) => e.id === enr)!;
const avisos = () => estado.tablas.notifications;

describe('runPlanChangeDetector', () => {
    it('sin escuelas configuradas no hace nada', async () => {
        const r = await runPlanChangeDetector({ schoolIds: [] });
        expect(r).toMatchObject({ revisados: 0, cambiados: 0, avisados: 0 });
        expect(escuelasAutorizadas({ PLAN_CHANGE_AUTO_SCHOOL_IDS: ' a, b ,,c' } as any)).toEqual(['a', 'b', 'c']);
        expect(escuelasAutorizadas({} as any)).toEqual([]);
    });

    it('cambia solo al que lleva dos periodos, y a nadie más', async () => {
        const r = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r.cambiados).toBe(1);
        expect(planDe('e-ana')).toMatchObject({ offering_plan_id: 'pro', monthly_fee: 150000 });
        for (const otro of ['e-beto', 'e-cata', 'e-dani', 'e-eli']) {
            expect(planDe(otro)).toMatchObject({ offering_plan_id: 'elite', monthly_fee: 180000 });
        }
    });

    it('avisa a la dueña: 1 cambio aplicado + 3 por decidir (beto, cata, dani); nada por quien pagó bien', async () => {
        const r = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r.avisados).toBe(3);
        const porTipo = (t: string) => avisos().filter((n) => n.type === t);
        expect(porTipo('plan_change_applied')).toHaveLength(1);
        expect(porTipo('plan_change_suggestion').map((n) => n.data.motivo).sort()).toEqual(['ambiguo', 'fee_manual', 'primera_vez']);
        expect(avisos().every((n) => n.user_id === 'dueno-1' && n.school_id === ESC && n.data?.clave)).toBe(true);
    });

    it('idempotente: correrlo dos veces no cambia ni avisa de nuevo', async () => {
        await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        const antes = avisos().length;
        const r2 = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r2.cambiados).toBe(0);
        expect(r2.avisados).toBe(0);
        expect(avisos()).toHaveLength(antes);
    });

    it('dos instancias a la vez: el plan cambia una sola vez', async () => {
        const [a, b] = await Promise.all([
            runPlanChangeDetector({ schoolIds: [ESC], log: {} }),
            runPlanChangeDetector({ schoolIds: [ESC], log: {} }),
        ]);
        expect(a.cambiados + b.cambiados).toBe(1);
        expect(estado.updates.filter((u) => u.id === 'e-ana')).toHaveLength(1);
    });

    it('dryRun: no escribe nada y devuelve lo que haría', async () => {
        const r = await runPlanChangeDetector({ schoolIds: [ESC], dryRun: true, log: {} });
        expect(estado.updates).toHaveLength(0);
        expect(avisos()).toHaveLength(0);
        expect(r.cambiados).toBe(0);
        expect(r.detalle.find((d) => d.decision === 'cambiar')).toMatchObject({ plan_viejo: 'ELITE', plan_nuevo: 'PRO', aplicado: false });
        expect(r.detalle.filter((d) => d.decision === 'avisar')).toHaveLength(3);
    });

    it('no toca cobros: solo escribe en enrollments y notifications', async () => {
        await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(new Set(estado.updates.map((u) => u.tabla))).toEqual(new Set(['enrollments']));
    });

    it('ya cambiado a mano: el mismo pago queda consistente y no genera nada', async () => {
        Object.assign(planDe('e-ana'), { offering_plan_id: 'pro', monthly_fee: 150000 });
        const r = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r.cambiados).toBe(0);
        expect(avisos().find((n) => n.data?.atleta === 'child_id:ana')).toBeUndefined();
    });

    it('un pago fuera de la ventana de 3 días no se revisa', async () => {
        const viejo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
        estado.tablas.payments.forEach((p) => { p.payment_date = viejo; });
        const r = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r.revisados).toBe(0);
    });

    it('una escuela no autorizada no se mira', async () => {
        const r = await runPlanChangeDetector({ schoolIds: ['otra'], log: {} });
        expect(r.revisados).toBe(0);
        expect(planDe('e-ana').offering_plan_id).toBe('elite');
    });

    it('si falla una lectura, no cambia nada y lo cuenta como error', async () => {
        estado.lecturaFalla = 'payments';
        const r = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r.errores).toBeGreaterThan(0);
        expect(estado.updates).toHaveLength(0);
    });

    it('si el plan cambió entre la lectura y el UPDATE, no pisa ni avisa (reclamo condicionado)', async () => {
        // Otro proceso ya pasó a Ana a otro plan justo antes de nuestro UPDATE.
        estado.antesDeUpdate = (tabla) => { if (tabla === 'enrollments') planDe('e-ana').offering_plan_id = 'start'; };
        const r = await runPlanChangeDetector({ schoolIds: [ESC], log: {} });
        expect(r.cambiados).toBe(0);
        expect(planDe('e-ana').offering_plan_id).toBe('start');
        expect(avisos().filter((n) => n.type === 'plan_change_applied')).toHaveLength(0);
    });
});
