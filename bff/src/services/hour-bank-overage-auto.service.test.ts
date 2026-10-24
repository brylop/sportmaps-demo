import { describe, it, expect, vi, beforeEach } from 'vitest';

const tablas: Record<string, any> = {};
const inserts: { tabla: string; valores: any }[] = [];
const rpcs: { fn: string; args: any }[] = [];
let rpcRespuesta: (args: any) => { data?: any; error?: any } = () => ({ data: { payment_id: 'PAGO' } });
let errorEnAjustes: any = null;

function cadena(tabla: string, op: 'select' | 'insert', valores?: any) {
    const c: any = new Proxy({}, {
        get(_t, prop: string) {
            if (prop === 'then') {
                return (res: any) => {
                    if (op === 'insert') { inserts.push({ tabla, valores }); return res({ data: null, error: null }); }
                    if (tabla === 'school_settings' && errorEnAjustes) return res({ data: null, error: errorEnAjustes });
                    return res({ data: tablas[tabla] ?? [], error: null });
                };
            }
            if (prop === 'maybeSingle') return () => Promise.resolve({ data: (tablas[tabla] ?? [])[0] ?? null, error: null });
            return () => c;
        },
    });
    return c;
}

vi.mock('../config/supabase', () => ({
    supabase: {
        from: (tabla: string) => ({
            select: () => cadena(tabla, 'select'),
            insert: (v: any) => cadena(tabla, 'insert', v),
        }),
        rpc: async (fn: string, args: any) => { rpcs.push({ fn, args }); return { error: null, data: null, ...rpcRespuesta(args) }; },
    },
}));

import { cumpleTopes, confirmarSugeridas, runHourBankOverageAutoConfirm } from './hour-bank-overage-auto.service';

function preparar(over: Record<string, any> = {}) {
    for (const k of Object.keys(tablas)) delete tablas[k];
    inserts.length = 0; rpcs.length = 0; errorEnAjustes = null;
    rpcRespuesta = () => ({ data: { payment_id: 'PAGO' } });
    tablas.hour_bank_overage_charges = [
        { id: 'X1', enrollment_id: 'E1', billable_hours: 1, amount: 26778 },
        { id: 'X2', enrollment_id: 'E2', billable_hours: 3, amount: 80000 },
    ];
    tablas.enrollments = [
        { id: 'E1', status: 'active', child_id: 'C1', user_id: null },
        { id: 'E2', status: 'active', child_id: 'C2', user_id: null },
    ];
    tablas.children = [{ id: 'C1', parent_id: 'PA1' }, { id: 'C2', parent_id: 'PA2' }];
    Object.assign(tablas, over);
}

describe('cumpleTopes', () => {
    it('sin ningún tope definido NUNCA cumple (confirmación automática apagada)', () => {
        expect(cumpleTopes({ horas: 1, monto: 1 }, { maxHoras: null, maxMonto: null })).toBe(false);
        expect(cumpleTopes({ horas: 1, monto: 1 }, { maxHoras: 0, maxMonto: 0 })).toBe(false);
    });
    it('con un solo tope se exige ese', () => {
        expect(cumpleTopes({ horas: 2, monto: 999999 }, { maxHoras: 2, maxMonto: null })).toBe(true);
        expect(cumpleTopes({ horas: 3, monto: 1 }, { maxHoras: 2, maxMonto: null })).toBe(false);
    });
    it('con los dos topes se exigen LOS DOS', () => {
        expect(cumpleTopes({ horas: 2, monto: 50000 }, { maxHoras: 2, maxMonto: 60000 })).toBe(true);
        expect(cumpleTopes({ horas: 2, monto: 70000 }, { maxHoras: 2, maxMonto: 60000 })).toBe(false);
        expect(cumpleTopes({ horas: 3, monto: 10 }, { maxHoras: 2, maxMonto: 60000 })).toBe(false);
    });
});

describe('confirmarSugeridas', () => {
    beforeEach(() => preparar());

    it('«Cobrar todos» (sin topes): confirma todas las elegibles y deja rastro por cada una', async () => {
        const r = await confirmarSugeridas({ schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'manual' });
        expect(r.confirmados).toBe(2);
        expect(rpcs.map((x) => x.fn)).toEqual(['confirm_hour_bank_overage', 'confirm_hour_bank_overage']);
        expect(inserts.filter((i) => i.tabla === 'audit_logs')).toHaveLength(2);
        expect(inserts[0].valores.action).toBe('hour_bank_overage_confirmed');
    });

    it('automática: solo lo que cumple los topes; lo demás queda sin tocar', async () => {
        const r = await confirmarSugeridas({
            schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'auto', topes: { maxHoras: 2, maxMonto: null },
        });
        expect(r.confirmados).toBe(1);
        expect(r.omitidos).toEqual([{ id: 'X2', motivo: 'tope' }]);
        expect(rpcs).toHaveLength(1);
        expect(rpcs[0].args.p_id).toBe('X1');
        expect(inserts[0].valores.action).toBe('hour_bank_overage_auto_confirmed');
    });

    it('no cobra inscripciones que no están activas', async () => {
        preparar({ enrollments: [
            { id: 'E1', status: 'cancelled', child_id: 'C1', user_id: null },
            { id: 'E2', status: 'active', child_id: 'C2', user_id: null },
        ] });
        const r = await confirmarSugeridas({ schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'manual' });
        expect(r.confirmados).toBe(1);
        expect(r.omitidos).toContainEqual({ id: 'X1', motivo: 'inscripcion_inactiva' });
    });

    it('no cobra solo lo del dueño de la escuela (sus hijas o su propia cuenta)', async () => {
        preparar({ children: [{ id: 'C1', parent_id: 'OWNER' }, { id: 'C2', parent_id: 'PA2' }] });
        const r = await confirmarSugeridas({ schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'auto', topes: { maxHoras: 5, maxMonto: null } });
        expect(r.confirmados).toBe(1);
        expect(r.omitidos).toContainEqual({ id: 'X1', motivo: 'dueno' });
        expect(rpcs[0].args.p_id).toBe('X2');
    });

    it('correrlo dos veces no duplica: lo ya decidido vuelve como omitido', async () => {
        rpcRespuesta = () => ({ data: { error: 'not_suggested', status: 'confirmed' } });
        const r = await confirmarSugeridas({ schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'manual' });
        expect(r.confirmados).toBe(0);
        expect(r.omitidos.every((o) => o.motivo === 'ya_decidido')).toBe(true);
        expect(inserts).toHaveLength(0);
    });

    it('un error de la RPC en una no frena a las demás', async () => {
        let n = 0;
        rpcRespuesta = () => (++n === 1 ? { error: { message: 'falló algo' } } : { data: { payment_id: 'PAGO2' } });
        const r = await confirmarSugeridas({ schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'manual' });
        expect(r.errores).toHaveLength(1);
        expect(r.confirmados).toBe(1);
    });

    it('sin sugeridas no hace nada', async () => {
        preparar({ hour_bank_overage_charges: [] });
        const r = await confirmarSugeridas({ schoolId: 'S1', actorId: 'OWNER', ownerId: 'OWNER', origen: 'manual' });
        expect(r.confirmados).toBe(0);
        expect(rpcs).toHaveLength(0);
    });
});

describe('runHourBankOverageAutoConfirm', () => {
    beforeEach(() => preparar());

    it('escuela sin topes → no hace nada', async () => {
        tablas.school_settings = [{ school_id: 'S1', hour_bank_overage_auto_confirm_max_hours: null, hour_bank_overage_auto_confirm_max_amount: null }];
        const r = await runHourBankOverageAutoConfirm();
        expect(r).toEqual({ escuelas: 0, confirmados: 0 });
        expect(rpcs).toHaveLength(0);
    });

    it('sin columnas de la migración → no rompe', async () => {
        errorEnAjustes = { message: 'column does not exist' };
        expect(await runHourBankOverageAutoConfirm()).toEqual({ escuelas: 0, confirmados: 0 });
    });

    it('escuela con tope de horas: confirma lo elegible a nombre del dueño', async () => {
        tablas.school_settings = [{ school_id: 'S1', hour_bank_overage_auto_confirm_max_hours: 2, hour_bank_overage_auto_confirm_max_amount: null }];
        tablas.schools = [{ owner_id: 'OWNER' }];
        const r = await runHourBankOverageAutoConfirm();
        expect(r).toEqual({ escuelas: 1, confirmados: 1 });
        expect(rpcs[0].args.p_actor).toBe('OWNER');
    });
});
