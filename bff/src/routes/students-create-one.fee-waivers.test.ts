/**
 * POST /api/v1/students/create-one — exoneración de inscripción / seguro por alta.
 * Mocks clonados de students-create-one.first-payment-mode.test.ts.
 *
 *   1. REGRESIÓN: sin waive_*, el elemento enrollment_fees es el de siempre y
 *      no se toca payments ni audit_logs.
 *   2. Los dos exonerados: no viaja el elemento enrollment_fees (cero filas de
 *      inscripción/seguro), la mensualidad sí, y queda rastro en audit_logs.
 *   3. Uno solo: el elemento lleva waive_* (la RPC de 20261010124934 no
 *      inserta esa fila) y la red de seguridad anula lo exonerado si la base
 *      todavía corre la RPC vieja.
 *   4. Inscripción ya existente: sin elemento, sin auditoría (no hubo alta).
 *   5. Zod: waive_* no booleano → 400.
 *   6. first-payment-preview descuenta lo exonerado del total del día.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const state = vi.hoisted(() => ({
  auth: { schoolId: 'school-1', role: 'school_admin' as string, userId: 'user-1' },
  schoolSettings: {} as Record<string, any>,
  plan: {} as Record<string, any> | null,
  existingEnrollment: null as { id: string } | null,
  /** Simula la RPC vieja: devuelve filas de inscripción/seguro aunque se exoneren. */
  rpcReturnsFeeRows: false,
  /** Seguro vigente del atleta (lectura de first-payment-preview). */
  activeInsuranceRows: [] as { due_date: string }[],
  captured: {} as Record<string, any>,
}));

vi.mock('../middlewares/authMiddleware', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.schoolId = state.auth.schoolId;
    req.role = state.auth.role;
    req.user = { id: state.auth.userId, email: 'admin@test.com' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

function chain(result: () => any) {
  const obj: any = {
    select: () => obj,
    eq: () => obj,
    in: () => obj,
    order: () => obj,
    maybeSingle: async () => result(),
    single: async () => result(),
  };
  return obj;
}

/** update(...).eq().in().in().eq().select() — registra los filtros. */
function updateChain(payload: any) {
  const filters: any[] = [];
  state.captured.paymentsUpdate = { payload, filters };
  const obj: any = {
    eq: (c: string, v: any) => { filters.push(['eq', c, v]); return obj; },
    in: (c: string, v: any) => { filters.push(['in', c, v]); return obj; },
    select: async () => {
      const ids = filters.find(f => f[0] === 'in' && f[1] === 'id')?.[2] ?? [];
      const cats = filters.find(f => f[0] === 'in' && f[1] === 'payment_category')?.[2] ?? [];
      // pay-reg / pay-seg son las filas que devolvería la RPC vieja.
      const byCat: Record<string, string> = { 'pay-reg': 'inscripcion', 'pay-seg': 'seguro' };
      return { data: ids.filter((id: string) => cats.includes(byCat[id])).map((id: string) => ({ id })), error: null };
    },
  };
  return obj;
}

vi.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'schools') return { select: () => chain(() => ({ data: { name: 'Escuela Test' }, error: null })) };
      if (table === 'school_settings') return { select: () => chain(() => ({ data: state.schoolSettings, error: null })) };
      if (table === 'offering_plans') return { select: () => chain(() => ({ data: state.plan, error: null })) };
      if (table === 'teams') return { select: () => chain(() => ({ data: null, error: null })) };
      if (table === 'enrollments') return { select: () => chain(() => ({ data: state.existingEnrollment, error: null })) };
      if (table === 'children') {
        return { insert: () => chain(() => ({ data: { id: 'child-test-id' }, error: null })) };
      }
      if (table === 'unregistered_athletes') {
        return { insert: () => chain(() => ({ data: { id: 'ua-test-id' }, error: null })) };
      }
      if (table === 'invitations') {
        return {
          select: () => chain(() => ({ data: null, error: null })),
          insert: () => chain(() => ({ data: { id: 'invite-test-id' }, error: null })),
        };
      }
      if (table === 'payments') {
        return {
          update: (payload: any) => updateChain(payload),
          select: () => {
            const filters: any[] = [];
            state.captured.insuranceLookup = filters;
            const q: any = {
              eq: (c: string, v: any) => { filters.push(['eq', c, v]); return q; },
              neq: (c: string, v: any) => { filters.push(['neq', c, v]); return q; },
              gt: (c: string, v: any) => { filters.push(['gt', c, v]); return q; },
              is: (c: string, v: any) => { filters.push(['is', c, v]); return q; },
              order: () => q,
              limit: async () => ({ data: state.activeInsuranceRows, error: null }),
            };
            return q;
          },
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: async (payload: any) => {
            (state.captured.audit ??= []).push(payload);
            return { error: null };
          },
        };
      }
      throw new Error(`Tabla no mockeada en este test: ${table}`);
    },
    rpc: async (fn: string, args: any) => {
      state.captured.rpc = { fn, args };
      const ids: string[] = [];
      for (const [i, el] of (args.p_payments || []).entries()) {
        if (el.kind === 'enrollment_fees') {
          if (state.rpcReturnsFeeRows) ids.push('pay-reg', 'pay-seg');
        } else {
          ids.push(`pay-${i}`);
        }
      }
      return { data: { enrollment_id: args.p_enrollment ? 'enr-1' : null, payment_ids: ids }, error: null };
    },
  },
}));

const createOneRouter = (await import('./students-create-one.route')).default;

let server: http.Server;
let baseUrl: string;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-24T15:00:00Z'));
});
afterAll(() => { vi.useRealTimers(); });

beforeEach(async () => {
  state.schoolSettings = {
    billing_cycle_type: 'fixed_calendar',
    payment_cutoff_day: 5,
    require_payment_proof: true,
    coach_can_create_athletes: false,
    parent_email_optional: true,
    remaining_classes_billing_enabled: true,
    hours_session_block_minutes: 120,
  };
  state.plan = {
    name: 'Plan Prueba', price: '245000', duration_days: 30, max_sessions: 8,
    included_minutes_per_period: 1440, session_block_minutes: 180,
    registration_fee: '120000', insurance_fee: '150000',
  };
  state.existingEnrollment = null;
  state.rpcReturnsFeeRows = false;
  state.activeInsuranceRows = [];
  state.auth.role = 'school_admin';
  state.captured = {};

  const app = express();
  app.use(express.json());
  app.use('/api/v1/students', createOneRouter);
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const childPayload = {
  type: 'child',
  full_name: 'Atleta de Prueba',
  parent_name: 'Acudiente de Prueba',
  parent_phone: '3001234567',
  start_date: '2026-08-24',
  branch_id: '11111111-1111-4111-8111-111111111111',
  offering_plan_id: '22222222-2222-4222-8222-222222222222',
  offering_id: '33333333-3333-4333-8333-333333333333',
  allow_duplicate: true,
  send_invite: false,
};

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/v1/students/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const feeElement = () => state.captured.rpc.args.p_payments.find((p: any) => p.kind === 'enrollment_fees');

describe('create-one — sin exoneración (regresión)', () => {
  it('el elemento enrollment_fees es el de siempre y no se toca payments ni audit_logs', async () => {
    const { status } = await post('create-one', childPayload);
    expect(status).toBe(201);
    expect(feeElement()).toEqual({
      kind: 'enrollment_fees',
      plan_id: childPayload.offering_plan_id,
      child_id: 'child-test-id',
      branch_id: childPayload.branch_id,
      due_date: '2026-08-24',
      person_name: 'Atleta de Prueba',
    });
    expect(state.captured.paymentsUpdate).toBeUndefined();
    expect(state.captured.audit).toBeUndefined();
  });

  it('waive_* en false explícito = igual que ausente', async () => {
    await post('create-one', { ...childPayload, waive_registration_fee: false, waive_insurance_fee: false });
    expect(feeElement()).not.toHaveProperty('waive_registration_fee');
    expect(feeElement()).not.toHaveProperty('waive_insurance_fee');
    expect(state.captured.audit).toBeUndefined();
  });
});

describe('create-one — exoneración', () => {
  it('los dos exonerados: no viaja enrollment_fees; la mensualidad sí; queda auditoría', async () => {
    const { status } = await post('create-one', {
      ...childPayload, waive_registration_fee: true, waive_insurance_fee: true,
    });
    expect(status).toBe(201);
    const { args } = state.captured.rpc;
    expect(args.p_payments).toHaveLength(1);
    expect(args.p_payments[0]).toMatchObject({ amount: 245000, payment_type: 'subscription', child_id: 'child-test-id' });
    expect(feeElement()).toBeUndefined();

    expect(state.captured.audit).toHaveLength(1);
    expect(state.captured.audit[0]).toMatchObject({
      school_id: 'school-1',
      profile_id: 'user-1',
      table_name: 'enrollments',
      record_id: 'enr-1',
      action: 'enrollment_fees_waived',
      new_data: {
        offering_plan_id: childPayload.offering_plan_id,
        child_id: 'child-test-id',
        waive_registration_fee: true,
        waive_insurance_fee: true,
      },
    });
  });

  it('solo inscripción: el elemento lleva waive_registration_fee y no waive_insurance_fee', async () => {
    await post('create-one', { ...childPayload, waive_registration_fee: true });
    expect(feeElement()).toMatchObject({ kind: 'enrollment_fees', waive_registration_fee: true });
    expect(feeElement()).not.toHaveProperty('waive_insurance_fee');
    expect(state.captured.audit[0].new_data).toMatchObject({ waive_registration_fee: true, waive_insurance_fee: false });
  });

  it('solo seguro: el elemento lleva waive_insurance_fee', async () => {
    await post('create-one', { ...childPayload, waive_insurance_fee: true });
    expect(feeElement()).toMatchObject({ waive_insurance_fee: true });
    expect(feeElement()).not.toHaveProperty('waive_registration_fee');
  });

  it('RPC vieja (sin la migración): anula SOLO la fila exonerada, pendiente y de esta escuela', async () => {
    state.rpcReturnsFeeRows = true;
    const { status } = await post('create-one', { ...childPayload, waive_registration_fee: true });
    expect(status).toBe(201);
    const upd = state.captured.paymentsUpdate;
    expect(upd.payload.status).toBe('cancelled');
    expect(upd.filters).toEqual(expect.arrayContaining([
      ['eq', 'school_id', 'school-1'],
      ['in', 'payment_category', ['inscripcion']],
      ['eq', 'status', 'pending'],
    ]));
    expect(upd.filters.find((f: any[]) => f[1] === 'id')[2]).toEqual(['pay-0', 'pay-reg', 'pay-seg']);
  });

  it('atleta ya inscrito (no hay alta nueva): sin enrollment_fees ni auditoría', async () => {
    state.existingEnrollment = { id: 'ya-existe' };
    await post('create-one', { ...childPayload, waive_registration_fee: true, waive_insurance_fee: true });
    expect(state.captured.rpc.args.p_enrollment).toBeNull();
    expect(feeElement()).toBeUndefined();
    expect(state.captured.audit).toBeUndefined();
  });

  it('adulto sin cuenta: misma exoneración por la otra rama del alta', async () => {
    const { status } = await post('create-one', {
      type: 'unregistered_adult',
      full_name: 'Adulto de Prueba',
      start_date: '2026-08-24',
      branch_id: childPayload.branch_id,
      offering_plan_id: childPayload.offering_plan_id,
      offering_id: childPayload.offering_id,
      allow_duplicate: true,
      waive_insurance_fee: true,
    });
    expect(status).toBe(201);
    expect(feeElement()).toMatchObject({ unregistered_athlete_id: 'ua-test-id', waive_insurance_fee: true });
    expect(state.captured.audit[0].new_data).toMatchObject({ unregistered_athlete_id: 'ua-test-id', waive_insurance_fee: true });
  });

  it('coach (escuela que le permite altas): no puede exonerar → 403 sin crear nada', async () => {
    state.auth.role = 'coach';
    state.schoolSettings.coach_can_create_athletes = true;
    const { status, body } = await post('create-one', { ...childPayload, waive_insurance_fee: true });
    expect(status).toBe(403);
    expect(body.code).toBe('WAIVER_FORBIDDEN');
    expect(state.captured.rpc).toBeUndefined();
  });

  it('coach sin exonerar: el alta sigue igual', async () => {
    state.auth.role = 'coach';
    state.schoolSettings.coach_can_create_athletes = true;
    const { status } = await post('create-one', childPayload);
    expect(status).toBe(201);
  });

  it('waive_* no booleano → 400 sin crear nada', async () => {
    const { status } = await post('create-one', { ...childPayload, waive_registration_fee: 'si' });
    expect(status).toBe(400);
    expect(state.captured.rpc).toBeUndefined();
  });
});

describe('POST /first-payment-preview — exoneración', () => {
  it('el total del día descuenta lo exonerado', async () => {
    const base = { offering_plan_id: childPayload.offering_plan_id, start_date: '2026-08-24', classes_remaining: 2 };
    const full = await post('first-payment-preview', base);
    const sinIns = await post('first-payment-preview', { ...base, waive_registration_fee: true });
    const sinNada = await post('first-payment-preview', { ...base, waive_registration_fee: true, waive_insurance_fee: true });
    expect(full.body.total_today - sinIns.body.total_today).toBe(120000);
    expect(full.body.total_today - sinNada.body.total_today).toBe(120000 + 150000);
    // fees sigue informando el valor del plan (la UI lo tacha).
    expect(sinNada.body.fees).toEqual({ registration_fee: 120000, insurance_fee: 150000 });
  });
});

describe('POST /first-payment-preview — seguro vigente del atleta', () => {
  const base = { offering_plan_id: childPayload.offering_plan_id, start_date: '2026-08-24', classes_remaining: 2 };

  it('sin atleta: no consulta seguros y suma el seguro', async () => {
    const r = await post('first-payment-preview', base);
    expect(r.body.insurance_active_since).toBeNull();
    expect(r.body.fees_due_date).toBe('2026-08-24');
    expect(state.captured.insuranceLookup).toBeUndefined();
  });

  it('adulto con seguro de los últimos 12 meses: lo informa y no lo suma', async () => {
    const sin = await post('first-payment-preview', base);
    state.activeInsuranceRows = [{ due_date: '2026-03-02' }];
    const con = await post('first-payment-preview', { ...base, user_id: '44444444-4444-4444-8444-444444444444' });
    expect(con.body.insurance_active_since).toBe('2026-03-02');
    expect(sin.body.total_today - con.body.total_today).toBe(150000);
    expect(state.captured.insuranceLookup).toEqual(expect.arrayContaining([
      ['eq', 'payment_category', 'seguro'],
      ['eq', 'user_id', '44444444-4444-4444-8444-444444444444'],
      ['is', 'child_id', null],
      ['gt', 'due_date', '2025-08-24'],
    ]));
  });
});
