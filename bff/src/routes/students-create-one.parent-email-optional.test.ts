/**
 * Prueba end-to-end (contra la ruta real, con Supabase y auth mockeados) del
 * flag school_settings.parent_email_optional: la excepción de Carmel Club en
 * POST /api/v1/students/create-one (type "child").
 *
 * Objetivo: confirmar que
 *   1. sin el flag, parent_email sigue siendo obligatorio (comportamiento de
 *      siempre, para todas las escuelas que no sean Carmel);
 *   2. con el flag, se puede dar de alta al menor sin parent_email, y no se
 *      crea invitación para el acudiente;
 *   3. con el flag activo pero mandando un email (una escuela puede tenerlo
 *      igual), el flujo de invitación sigue funcionando sin cambios.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const state = vi.hoisted(() => ({
  auth: { schoolId: 'school-1', role: 'school_admin' as string, userId: 'user-1' },
  schoolSettings: {
    billing_cycle_type: null as string | null,
    payment_cutoff_day: null as number | null,
    require_payment_proof: null as boolean | null,
    coach_can_create_athletes: false,
    parent_email_optional: false,
  },
  existingInvite: null as { id: string } | null,
  captured: {} as Record<string, any>,
}));

vi.mock('../middlewares/authMiddleware', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.schoolId = state.auth.schoolId;
    req.role = state.auth.role;
    req.user = { id: state.auth.userId, email: 'coach@test.com' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

function chain(result: any) {
  const obj: any = {
    select: () => obj,
    eq: () => obj,
    in: () => obj,
    order: () => obj,
    maybeSingle: async () => result,
    single: async () => result,
  };
  return obj;
}

vi.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'schools') {
        return { select: () => chain({ data: { name: 'Escuela Test' }, error: null }) };
      }
      if (table === 'school_settings') {
        return { select: () => chain({ data: state.schoolSettings, error: null }) };
      }
      if (table === 'children') {
        return {
          insert: (payload: any) => {
            state.captured.childInsert = payload;
            return chain({ data: { id: 'child-test-id' }, error: null });
          },
        };
      }
      if (table === 'invitations') {
        return {
          select: () => chain({ data: state.existingInvite, error: null }),
          insert: (payload: any) => {
            state.captured.inviteInsert = payload;
            return chain({ data: { id: 'invite-test-id' }, error: null });
          },
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: async (payload: any) => {
            state.captured.auditInsert = payload;
            return { error: null };
          },
        };
      }
      throw new Error(`Tabla no mockeada en este test: ${table}`);
    },
  },
}));

const createOneRouter = (await import('./students-create-one.route')).default;

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.auth.role = 'school_admin';
  state.schoolSettings.parent_email_optional = false;
  state.existingInvite = null;
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

const basePayload = {
  type: 'child',
  full_name: 'Niño de Prueba',
  parent_name: 'Padre de Prueba',
  parent_phone: '3001234567',
  start_date: '2026-09-03',
  allow_duplicate: true,
};

async function postChild(body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/v1/students/create-one`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('POST /api/v1/students/create-one — parent_email_optional', () => {
  it('sin el flag: rechaza el alta de un menor sin parent_email (comportamiento default, todas las escuelas)', async () => {
    state.schoolSettings.parent_email_optional = false;
    const { status, body } = await postChild(basePayload);
    expect(status).toBe(400);
    expect(body.error).toMatch(/email del acudiente es obligatorio/i);
    expect(state.captured.childInsert).toBeUndefined(); // no llegó a crear el menor
  });

  it('con el flag (Carmel): acepta el alta sin parent_email y NO crea invitación', async () => {
    state.schoolSettings.parent_email_optional = true;
    const { status, body } = await postChild(basePayload);
    expect(status).toBe(201);
    expect(body.invitation_sent).toBe(false);
    expect(body.registration_link).toBeNull();
    // undefined (clave ausente) o null son equivalentes acá: Postgres omite la
    // columna igual que si fuera NULL explícito — lo que importa es que NO se
    // guardó ningún correo.
    expect(state.captured.childInsert.parent_email_temp == null).toBe(true);
    expect(state.captured.inviteInsert).toBeUndefined(); // nunca se llamó a invitations.insert
  });

  it('con el flag activo pero mandando un email igual: sigue creando la invitación (sin cambios)', async () => {
    state.schoolSettings.parent_email_optional = true;
    const { status, body } = await postChild({
      ...basePayload,
      parent_email: 'mama@test.com',
      send_invite: false, // evita el envío real de correo — no es lo que este test verifica
    });
    expect(status).toBe(201);
    expect(body.invitation_sent).toBe(true);
    expect(state.captured.inviteInsert.email).toBe('mama@test.com');
  });

  it('un email con formato inválido se sigue rechazando, tenga o no el flag', async () => {
    state.schoolSettings.parent_email_optional = true;
    const { status } = await postChild({ ...basePayload, parent_email: 'no-es-un-email' });
    expect(status).toBe(400);
  });
});
