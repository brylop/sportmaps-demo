/**
 * Pagos únicos (inscripción y seguro) en el editor de planes.
 *
 * Lo que se vigila:
 *   · Crear o RENOMBRAR un plan (offering) o una tarifa (offering_plan) con un
 *     nombre de inscripción/matrícula/seguro/póliza → 400 con el mensaje de producto,
 *     sin escribir nada.
 *   · Un plan viejo que ya se llama así sigue editable si no le cambian el nombre.
 *   · «Aplicar a todos»: un solo UPDATE acotado a la escuela; 0 se guarda como NULL;
 *     un campo ausente no se toca.
 *
 * Cero red: Supabase en memoria.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
    tables: {} as Record<string, Row[]>,
    writes: [] as { table: string; op: 'insert' | 'update'; payload: any; ids?: string[] }[],
}));

vi.mock('../config/supabase', () => {
    function builder(table: string) {
        let rows: Row[] = [...(db.tables[table] ?? [])];
        let op: 'select' | 'insert' | 'update' = 'select';
        let payload: any = null;
        const result = () => {
            if (op === 'insert') {
                const row = { id: `${table}-new`, ...payload };
                db.writes.push({ table, op, payload });
                return { data: [row], error: null };
            }
            if (op === 'update') {
                db.writes.push({ table, op, payload, ids: rows.map((r) => r.id) });
                rows.forEach((r) => Object.assign(r, payload));
                return { data: rows.map((r) => ({ ...r })), error: null };
            }
            return { data: rows, error: null };
        };
        const api: any = {
            select: () => api,
            insert: (r: Row) => { op = 'insert'; payload = r; return api; },
            update: (p: Row) => { op = 'update'; payload = p; return api; },
            eq: (c: string, v: any) => { rows = rows.filter((r) => r[c] === v); return api; },
            in: (c: string, vs: any[]) => { rows = rows.filter((r) => vs.includes(r[c])); return api; },
            order: () => api,
            maybeSingle: async () => { const r = result(); return { data: r.data[0] ?? null, error: null }; },
            single: async () => { const r = result(); return { data: r.data[0] ?? null, error: null }; },
            then: (ok: any, ko: any) => Promise.resolve(result()).then(ok, ko),
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } };
});

import offeringsRouter from './offerings';
import { bloquearNombreDePlan, PAGO_UNICO_NO_ES_PLAN_MSG } from '../utils/pagosUnicos';

const SCHOOL = 'school-1';
const OTHER = 'school-2';
const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function fakeRes() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.body = b; return res; };
    return res;
}

function handler(method: string, path: string) {
    const layer = (offeringsRouter as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
    if (!layer) throw new Error(`ruta no encontrada: ${method} ${path}`);
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
}

async function call(method: string, path: string, params: Row, body: Row) {
    const res = fakeRes();
    await handler(method, path)({ params, body, schoolId: SCHOOL, query: {} } as any, res);
    return res;
}

beforeEach(() => {
    db.writes = [];
    db.tables = {
        offerings: [
            { id: 'off-1', school_id: SCHOOL, name: 'Fútbol infantil' },
            { id: 'off-viejo', school_id: SCHOOL, name: 'Inscripción anual' },
        ],
        offering_plans: [
            { id: U(1), school_id: SCHOOL, offering_id: 'off-1', name: 'Mensual 3 días', registration_fee: null, insurance_fee: null },
            { id: U(2), school_id: SCHOOL, offering_id: 'off-1', name: 'Seguro', registration_fee: null, insurance_fee: null },
            { id: U(3), school_id: OTHER, offering_id: 'off-x', name: 'Mensual otra escuela', registration_fee: 1, insurance_fee: 1 },
        ],
        school_settings: [],
    };
});

describe('bloquearNombreDePlan', () => {
    it('bloquea inscripción, matrícula, seguro y póliza (con y sin tilde, sin importar mayúsculas)', () => {
        for (const n of ['Inscripción', 'INSCRIPCION 2026', 'Matrícula', 'matricula', 'Seguro de accidentes', 'Póliza', 'poliza']) {
            expect(bloquearNombreDePlan(n, null)).toBe(true);
        }
    });
    it('no bloquea nombres normales ni PATCH sin nombre', () => {
        expect(bloquearNombreDePlan('Mensual 3 días', null)).toBe(false);
        expect(bloquearNombreDePlan(undefined, 'Seguro')).toBe(false);
    });
    it('un plan viejo que ya se llama así se puede guardar si el nombre no cambia', () => {
        expect(bloquearNombreDePlan('Seguro', 'Seguro')).toBe(false);
        expect(bloquearNombreDePlan(' seguro ', 'Seguro')).toBe(false);
        expect(bloquearNombreDePlan('Seguro 2027', 'Seguro')).toBe(true);
    });
});

describe('guard en el BFF', () => {
    it('POST /:id/plans con nombre «Inscripción» → 400 con el mensaje y sin insertar', async () => {
        const res = await call('post', '/:id/plans', { id: 'off-1' }, { name: 'Inscripción', price: 120000 });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe(PAGO_UNICO_NO_ES_PLAN_MSG);
        expect(res.body.code).toBe('PAGO_UNICO_NO_ES_PLAN');
        expect(db.writes).toHaveLength(0);
    });

    it('POST /:id/plans con nombre normal y pagos únicos → crea con los dos campos', async () => {
        const res = await call('post', '/:id/plans', { id: 'off-1' }, {
            name: 'Mensual 2 días', price: 150000, registration_fee: 120000, insurance_fee: 150000,
        });
        expect(res.statusCode).toBe(201);
        expect(db.writes[0].payload).toMatchObject({ registration_fee: 120000, insurance_fee: 150000 });
    });

    it('POST / (offering) con nombre «Seguro escolar» → 400', async () => {
        const res = await call('post', '/', {}, { name: 'Seguro escolar', offering_type: 'membership' });
        expect(res.statusCode).toBe(400);
        expect(db.writes).toHaveLength(0);
    });

    it('PATCH tarifa: renombrar a «Póliza» → 400', async () => {
        const res = await call('patch', '/:offeringId/plans/:planId', { offeringId: 'off-1', planId: U(1) }, { name: 'Póliza' });
        expect(res.statusCode).toBe(400);
        expect(db.writes).toHaveLength(0);
    });

    it('PATCH tarifa vieja llamada «Seguro» sin cambiarle el nombre → se guarda', async () => {
        const res = await call('patch', '/:offeringId/plans/:planId', { offeringId: 'off-1', planId: U(2) }, { name: 'Seguro', price: 1000 });
        expect(res.statusCode).toBe(200);
        expect(db.writes[0]).toMatchObject({ table: 'offering_plans', op: 'update' });
    });

    it('PATCH offering viejo «Inscripción anual» sin renombrar → se guarda', async () => {
        const res = await call('patch', '/:id', { id: 'off-viejo' }, { name: 'Inscripción anual', description: 'x' });
        expect(res.statusCode).toBe(200);
    });

    it('PATCH tarifa: registration_fee null (vacío) se guarda como null', async () => {
        const res = await call('patch', '/:offeringId/plans/:planId', { offeringId: 'off-1', planId: U(1) }, { registration_fee: null, insurance_fee: null });
        expect(res.statusCode).toBe(200);
        expect(db.writes[0].payload).toMatchObject({ registration_fee: null, insurance_fee: null });
    });
});

describe('POST /one-time-fees/apply (aplicar a todos)', () => {
    it('un solo UPDATE, solo filas de la escuela, 0 → NULL', async () => {
        const res = await call('post', '/one-time-fees/apply', {}, {
            plan_ids: [U(1), U(2), U(3)], registration_fee: 120000, insurance_fee: 0,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.updated).toBe(2);
        expect(db.writes).toHaveLength(1);
        expect(db.writes[0].payload).toEqual({ registration_fee: 120000, insurance_fee: null });
        expect(db.writes[0].ids).toEqual([U(1), U(2)]);
        expect(db.tables.offering_plans.find((p) => p.id === U(3))?.registration_fee).toBe(1);
    });

    it('un campo ausente no se toca', async () => {
        await call('post', '/one-time-fees/apply', {}, { plan_ids: [U(1)], insurance_fee: 150000 });
        expect(db.writes[0].payload).toEqual({ insurance_fee: 150000 });
    });

    it('sin campos o sin planes → 400', async () => {
        expect((await call('post', '/one-time-fees/apply', {}, { plan_ids: [U(1)] })).statusCode).toBe(400);
        expect((await call('post', '/one-time-fees/apply', {}, { plan_ids: [], registration_fee: 1 })).statusCode).toBe(400);
        expect((await call('post', '/one-time-fees/apply', {}, { plan_ids: [U(1)], registration_fee: -5 })).statusCode).toBe(400);
        expect(db.writes).toHaveLength(0);
    });
});
