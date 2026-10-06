/**
 * POST /api/v1/students/create-one — first_payment_mode (F7) y alta atómica (B6).
 * Mocks clonados de students-create-one.parent-email-optional.test.ts.
 *
 *   1. REGRESIÓN: sin first_payment_mode, el cobro que llega a la RPC es
 *      exactamente el de siempre (calcFirstPayment, mismo concepto, período).
 *   2. remaining_classes con el flag: dos filas (parcial + mes siguiente) +
 *      inscripción/seguro, y la inscripción guarda el modo.
 *   3. Rechazos 400 ANTES de crear al menor (flag apagado, clases fuera de rango,
 *      plan sin clases definidas).
 *   4. periodo_ocupado de la RPC → 409.
 *   5. POST /first-payment-preview usa la misma fórmula.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { calcFirstPayment } from '../utils/prorationUtils';

const state = vi.hoisted(() => ({
  auth: { schoolId: 'school-1', role: 'school_admin' as string, userId: 'user-1' },
  schoolSettings: {} as Record<string, any>,
  plan: {} as Record<string, any> | null,
  existingEnrollment: null as { id: string } | null,
  rpcError: null as { message: string } | null,
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

vi.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'schools') return { select: () => chain(() => ({ data: { name: 'Escuela Test' }, error: null })) };
      if (table === 'school_settings') return { select: () => chain(() => ({ data: state.schoolSettings, error: null })) };
      if (table === 'offering_plans') return { select: () => chain(() => ({ data: state.plan, error: null })) };
      if (table === 'teams') return { select: () => chain(() => ({ data: null, error: null })) };
      if (table === 'enrollments') return { select: () => chain(() => ({ data: state.existingEnrollment, error: null })) };
      if (table === 'children') {
        return {
          insert: (payload: any) => {
            state.captured.childInsert = payload;
            return chain(() => ({ data: { id: 'child-test-id' }, error: null }));
          },
        };
      }
      if (table === 'invitations') {
        return {
          select: () => chain(() => ({ data: null, error: null })),
          insert: (payload: any) => {
            state.captured.inviteInsert = payload;
            return chain(() => ({ data: { id: 'invite-test-id' }, error: null }));
          },
        };
      }
      if (table === 'audit_logs') return { insert: async () => ({ error: null }) };
      throw new Error(`Tabla no mockeada en este test: ${table}`);
    },
    rpc: async (fn: string, args: any) => {
      state.captured.rpc = { fn, args };
      if (state.rpcError) return { data: null, error: state.rpcError };
      return {
        data: { enrollment_id: args.p_enrollment ? 'enr-1' : null, payment_ids: (args.p_payments || []).map((_: any, i: number) => `pay-${i}`) },
        error: null,
      };
    },
  },
}));

const createOneRouter = (await import('./students-create-one.route')).default;

let server: http.Server;
let baseUrl: string;

beforeAll(() => {
  // Solo Date: el alta del 24/08/2026 con "hoy" = ese mismo día.
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
  // PGC8x3 de Dreamers.
  state.plan = {
    name: 'PGC8x3', price: '723000', duration_days: 30, max_sessions: 8,
    included_minutes_per_period: 1440, session_block_minutes: 180,
    registration_fee: '120000', insurance_fee: '150000',
  };
  state.existingEnrollment = null;
  state.rpcError = null;
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
  full_name: 'Niña de Prueba',
  parent_name: 'Madre de Prueba',
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

describe('create-one — sin first_payment_mode (regresión)', () => {
  it('manda a la RPC exactamente el cobro de hoy + la inscripción/seguro', async () => {
    const { status, body } = await post('create-one', childPayload);
    expect(status).toBe(201);
    expect(body.enrollments_created).toBe(1);
    expect(body.payment_created).toBe(true);

    const { fn, args } = state.captured.rpc;
    expect(fn).toBe('create_enrollment_with_payments');
    expect(args.p_school_id).toBe('school-1');
    expect(args.p_enrollment).toEqual({
      status: 'active', start_date: '2026-08-24', child_id: 'child-test-id',
      offering_plan_id: childPayload.offering_plan_id, offering_id: childPayload.offering_id,
      monthly_fee: 723000,
    });

    const calc = calcFirstPayment('2026-08-24', 723000, 'fixed_calendar', 5);
    expect(args.p_payments).toHaveLength(2);
    // El payload histórico de students-create-one (antes de F-C), campo por campo.
    expect(args.p_payments[0]).toEqual({
      child_id:         'child-test-id',
      school_id:        'school-1',
      branch_id:        childPayload.branch_id,
      team_id:          null,
      offering_plan_id: childPayload.offering_plan_id,
      amount:           calc.amount,
      concept:          `Plan PGC8x3 — ${calc.description} — Niña de Prueba`,
      due_date:         calc.dueDate,
      status:           'pending',
      payment_type:     'subscription',
      period_year:      calc.periodYear,
      period_month:     calc.periodMonth,
    });
    expect(args.p_payments[1]).toEqual({
      kind: 'enrollment_fees',
      plan_id: childPayload.offering_plan_id,
      child_id: 'child-test-id',
      branch_id: childPayload.branch_id,
      due_date: '2026-08-24',
      person_name: 'Niña de Prueba',
    });
  });

  it('si ya hay una inscripción igual, no crea otra ni cobra inscripción/seguro (D18)', async () => {
    state.existingEnrollment = { id: 'ya-existe' };
    const { status } = await post('create-one', childPayload);
    expect(status).toBe(201);
    const { args } = state.captured.rpc;
    expect(args.p_enrollment).toBeNull();
    expect(args.p_payments.find((p: any) => p.kind === 'enrollment_fees')).toBeUndefined();
  });
});

describe('create-one — remaining_classes', () => {
  it('dos filas (parcial 180.750 + septiembre completo) + inscripción/seguro; guarda el modo', async () => {
    const { status } = await post('create-one', {
      ...childPayload, first_payment_mode: 'remaining_classes', classes_remaining: 2,
    });
    expect(status).toBe(201);
    const { args } = state.captured.rpc;
    expect(args.p_enrollment.first_payment_mode).toBe('remaining_classes');
    const [partial, next, fees] = args.p_payments;
    expect(partial).toMatchObject({ amount: 180750, due_date: '2026-08-24', period_year: 2026, period_month: 8, payment_category: 'mensualidad' });
    expect(next).toMatchObject({ amount: 723000, due_date: '2026-09-05', period_year: 2026, period_month: 9, payment_category: 'mensualidad' });
    expect(fees.kind).toBe('enrollment_fees');
  });

  it('D14b: parcial vence el 1° del mes siguiente', async () => {
    await post('create-one', {
      ...childPayload, first_payment_mode: 'remaining_classes', classes_remaining: 2, partial_due: 'next_month_first',
    });
    expect(state.captured.rpc.args.p_payments[0].due_date).toBe('2026-09-01');
  });

  it('full_month explícito = cobro de hoy, y guarda el modo', async () => {
    await post('create-one', { ...childPayload, first_payment_mode: 'full_month' });
    const { args } = state.captured.rpc;
    expect(args.p_enrollment.first_payment_mode).toBe('full_month');
    expect(args.p_payments[0].amount).toBe(calcFirstPayment('2026-08-24', 723000, 'fixed_calendar', 5).amount);
  });

  it('flag apagado → 400 sin crear al menor', async () => {
    state.schoolSettings.remaining_classes_billing_enabled = false;
    const { status, body } = await post('create-one', { ...childPayload, first_payment_mode: 'remaining_classes', classes_remaining: 2 });
    expect(status).toBe(400);
    expect(body.code).toBe('REMAINING_CLASSES_NOT_AVAILABLE');
    expect(state.captured.childInsert).toBeUndefined();
    expect(state.captured.rpc).toBeUndefined();
  });

  it('clases fuera de rango → 400', async () => {
    const r1 = await post('create-one', { ...childPayload, first_payment_mode: 'remaining_classes', classes_remaining: 8 });
    expect(r1.status).toBe(400);
    const r2 = await post('create-one', { ...childPayload, first_payment_mode: 'remaining_classes' });
    expect(r2.status).toBe(400);
    expect(state.captured.childInsert).toBeUndefined();
  });

  it('plan sin clases definidas → 400', async () => {
    state.plan = { ...state.plan!, included_minutes_per_period: null, max_sessions: null };
    const { status } = await post('create-one', { ...childPayload, first_payment_mode: 'remaining_classes', classes_remaining: 2 });
    expect(status).toBe(400);
  });

  it('plan no mensual → 400', async () => {
    state.plan = { ...state.plan!, duration_days: 1 };
    const { status } = await post('create-one', { ...childPayload, first_payment_mode: 'remaining_classes', classes_remaining: 2 });
    expect(status).toBe(400);
  });
});

describe('create-one — alta atómica', () => {
  it('periodo_ocupado de la RPC → 409', async () => {
    state.rpcError = { message: 'periodo_ocupado:2026-08' };
    const { status, body } = await post('create-one', childPayload);
    expect(status).toBe(409);
    expect(body.code).toBe('PERIODO_OCUPADO');
    expect(body.period).toBe('2026-08');
  });
});

describe('POST /first-payment-preview', () => {
  it('devuelve las filas con la misma fórmula y el total del día', async () => {
    const { status, body } = await post('first-payment-preview', {
      offering_plan_id: childPayload.offering_plan_id, start_date: '2026-08-24', classes_remaining: 2,
    });
    expect(status).toBe(200);
    expect(body.eligible).toBe(true);
    expect(body.classes_per_period).toBe(8);
    expect(body.source).toBe('minutes');
    expect(body.rows.map((r: any) => r.amount)).toEqual([180750, 723000]);
    expect(body.total_today).toBe(180750 + 120000 + 150000);
  });

  it('sin flag: no elegible, sin filas', async () => {
    state.schoolSettings.remaining_classes_billing_enabled = false;
    const { status, body } = await post('first-payment-preview', {
      offering_plan_id: childPayload.offering_plan_id, start_date: '2026-08-24', classes_remaining: 2,
    });
    expect(status).toBe(200);
    expect(body.eligible).toBe(false);
    expect(body.rows).toEqual([]);
  });
});
