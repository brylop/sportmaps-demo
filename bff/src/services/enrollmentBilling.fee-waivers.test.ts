/**
 * emitEnrollmentFees (POST /enrollments) — exoneración por alta.
 *   · Sin waivers: la llamada a la RPC es byte a byte la de siempre (9 args).
 *   · Los dos exonerados: ni se llama a la RPC (0 filas).
 *   · Uno solo: p_waive_* (firma de 11, migración 20261010124934).
 *   · Base sin la migración (PGRST202): reintenta con la firma vieja y anula
 *     la fila exonerada.
 *   · findActiveInsurance: mismo predicado que el dedupe de 12 meses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args: any }[],
  rpcImpl: null as null | ((args: any, n: number) => any),
  update: null as null | { payload: any; filters: any[] },
  select: null as null | { filters: any[] },
  selectRows: [] as any[],
}));

vi.mock('../config/supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args });
      if (state.rpcImpl) return state.rpcImpl(args, state.rpcCalls.length);
      return { data: [], error: null };
    },
    from: (table: string) => {
      if (table !== 'payments') throw new Error('tabla no mockeada: ' + table);
      return {
        update: (payload: any) => {
          const filters: any[] = [];
          state.update = { payload, filters };
          const q: any = {
            eq: (c: string, v: any) => { filters.push(['eq', c, v]); return q; },
            in: (c: string, v: any) => { filters.push(['in', c, v]); return q; },
            select: async () => {
              const ids: string[] = filters.find(f => f[1] === 'id')?.[2] ?? [];
              const cats: string[] = filters.find(f => f[1] === 'payment_category')?.[2] ?? [];
              const byId: Record<string, string> = { 'p-ins': 'inscripcion', 'p-seg': 'seguro' };
              return { data: ids.filter(id => cats.includes(byId[id])).map(id => ({ id })), error: null };
            },
          };
          return q;
        },
        select: () => {
          const filters: any[] = [];
          state.select = { filters };
          const q: any = {
            eq: (c: string, v: any) => { filters.push(['eq', c, v]); return q; },
            neq: (c: string, v: any) => { filters.push(['neq', c, v]); return q; },
            gt: (c: string, v: any) => { filters.push(['gt', c, v]); return q; },
            is: (c: string, v: any) => { filters.push(['is', c, v]); return q; },
            order: () => q,
            limit: async () => ({ data: state.selectRows, error: null }),
          };
          return q;
        },
      };
    },
  },
}));

const { emitEnrollmentFees, findActiveInsurance } = await import('./enrollmentBilling');

const opts = {
  schoolId: 'school-1',
  planId: 'plan-1',
  athleteCol: 'child_id' as const,
  athleteId: 'child-1',
  dueDate: '2026-10-10',
};

const BASE_ARGS = {
  p_school_id: 'school-1',
  p_plan_id: 'plan-1',
  p_child_id: 'child-1',
  p_user_id: null,
  p_unreg_id: null,
  p_parent_id: null,
  p_branch_id: null,
  p_due_date: '2026-10-10',
  p_person_name: null,
};

beforeEach(() => {
  state.rpcCalls = [];
  state.rpcImpl = null;
  state.update = null;
  state.select = null;
  state.selectRows = [];
});

describe('emitEnrollmentFees', () => {
  it('sin waivers: misma llamada de siempre, sin tocar payments', async () => {
    state.rpcImpl = () => ({ data: ['p-ins', 'p-seg'], error: null });
    const ids = await emitEnrollmentFees(opts);
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toEqual({ fn: 'emit_enrollment_fees', args: BASE_ARGS });
    expect(ids).toEqual(['p-ins', 'p-seg']);
    expect(state.update).toBeNull();
  });

  it('los dos exonerados: no se llama a la RPC (ninguna fila de inscripción/seguro)', async () => {
    const ids = await emitEnrollmentFees({ ...opts, waivers: { registration: true, insurance: true } });
    expect(state.rpcCalls).toHaveLength(0);
    expect(ids).toEqual([]);
  });

  it('solo seguro: p_waive_insurance=true, sin p_waive_registration', async () => {
    state.rpcImpl = () => ({ data: ['p-ins'], error: null });
    const ids = await emitEnrollmentFees({ ...opts, waivers: { insurance: true } });
    expect(state.rpcCalls[0].args).toEqual({ ...BASE_ARGS, p_waive_insurance: true });
    expect(ids).toEqual(['p-ins']);
  });

  it('base sin la migración (PGRST202): firma vieja + anula SOLO la fila exonerada', async () => {
    state.rpcImpl = (_a, n) => n === 1
      ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.emit_enrollment_fees(...)' } }
      : { data: ['p-ins', 'p-seg'], error: null };
    const ids = await emitEnrollmentFees({ ...opts, waivers: { registration: true } });
    expect(state.rpcCalls).toHaveLength(2);
    expect(state.rpcCalls[1].args).toEqual(BASE_ARGS);
    expect(state.update?.payload.status).toBe('cancelled');
    expect(state.update?.filters).toEqual(expect.arrayContaining([
      ['eq', 'school_id', 'school-1'],
      ['in', 'payment_category', ['inscripcion']],
      ['eq', 'status', 'pending'],
    ]));
    expect(ids).toEqual(['p-seg']);
  });

  it('otro error de la RPC: no reintenta, devuelve [] (nunca rompe el alta)', async () => {
    state.rpcImpl = () => ({ data: null, error: { code: '42501', message: 'permission denied' } });
    const ids = await emitEnrollmentFees({ ...opts, waivers: { registration: true }, log: { error: () => {} } });
    expect(state.rpcCalls).toHaveLength(1);
    expect(ids).toEqual([]);
  });
});

describe('findActiveInsurance', () => {
  it('adulto: categoría seguro, no anulado, 365 días hacia atrás, sin child_id', async () => {
    state.selectRows = [{ due_date: '2026-03-02' }];
    const since = await findActiveInsurance({ schoolId: 'school-1', athleteCol: 'user_id', athleteId: 'u-1', dueDate: '2026-10-10' });
    expect(since).toBe('2026-03-02');
    expect(state.select?.filters).toEqual(expect.arrayContaining([
      ['eq', 'school_id', 'school-1'],
      ['eq', 'payment_category', 'seguro'],
      ['neq', 'status', 'cancelled'],
      ['gt', 'due_date', '2025-10-10'],
      ['eq', 'user_id', 'u-1'],
      ['is', 'child_id', null],
    ]));
  });

  it('sin seguro vigente: null', async () => {
    const since = await findActiveInsurance({ schoolId: 'school-1', athleteCol: 'child_id', athleteId: 'c-1', dueDate: '2026-10-10' });
    expect(since).toBeNull();
    expect(state.select?.filters.find(f => f[0] === 'is')).toBeUndefined();
  });
});
