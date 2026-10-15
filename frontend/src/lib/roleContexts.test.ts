import { beforeEach, describe, expect, it, vi } from 'vitest';

// Respuestas por tabla; cada test las arma. El builder imita la cadena
// .select().eq().eq() de supabase-js y resuelve con { data, error }.
const respuestas: Record<string, { data: unknown[] | null; error: unknown }> = {};
vi.mock('@/integrations/supabase/client', () => {
  const builder = (tabla: string) => {
    const b = {
      select: () => b,
      eq: () => b,
      then: (ok: (v: unknown) => void, ko?: (e: unknown) => void) =>
        Promise.resolve(respuestas[tabla] ?? { data: [], error: null }).then(ok, ko),
    };
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

import { fetchRoleContexts, safeInternalPath } from './roleContexts';

const ESCUELA = { school_id: 'monster', schools: { name: "Monster's Volley Club" } };
const set = (tabla: string, data: unknown[]) => { respuestas[tabla] = { data, error: null }; };

beforeEach(() => {
  for (const k of Object.keys(respuestas)) delete respuestas[k];
});

describe('fetchRoleContexts', () => {
  it('acudiente + atleta en la misma escuela (caso Yuly): 2 contextos', async () => {
    set('school_members', [{ ...ESCUELA, role: 'athlete' }]);
    set('enrollments', [ESCUELA]);
    set('children', [{ id: 'hijo', ...ESCUELA, enrollments: [{ status: 'active', school_id: 'monster' }] }]);
    const ctx = await fetchRoleContexts('yuly', 'parent');
    expect(ctx.map((c) => c.viewRole).sort()).toEqual(['athlete', 'parent']);
  });

  it('un solo rol: no hay selector (lista vacía)', async () => {
    set('children', [{ id: 'hijo', ...ESCUELA, enrollments: [{ status: 'active', school_id: 'monster' }] }]);
    expect(await fetchRoleContexts('papa', 'parent')).toEqual([]);
  });

  it('acudiente en dos escuelas NO es multirol', async () => {
    set('children', [
      { id: 'h1', ...ESCUELA, enrollments: [{ status: 'active', school_id: 'monster' }] },
      { id: 'h2', school_id: 'otra', schools: { name: 'Otra' }, enrollments: [{ status: 'active', school_id: 'otra' }] },
    ]);
    expect(await fetchRoleContexts('papa', 'parent')).toEqual([]);
  });

  it('hijo sin inscripción activa no cuenta como acudiente', async () => {
    set('enrollments', [ESCUELA]);
    set('children', [{ id: 'hijo', ...ESCUELA, enrollments: [{ status: 'cancelled', school_id: 'monster' }] }]);
    expect(await fetchRoleContexts('x', 'athlete')).toEqual([]);
  });

  it('owner que juega: administración + atleta', async () => {
    set('school_members', [{ ...ESCUELA, role: 'owner' }]);
    set('enrollments', [ESCUELA]);
    const ctx = await fetchRoleContexts('secretaria', 'school');
    expect(ctx.map((c) => c.viewRole).sort()).toEqual(['athlete', 'school']);
  });

  it("admin DE ESCUELA nunca se presenta como 'admin' de plataforma", async () => {
    set('school_members', [{ ...ESCUELA, role: 'admin' }]);
    set('children', [{ id: 'hijo', ...ESCUELA, enrollments: [{ status: 'active', school_id: 'monster' }] }]);
    const ctx = await fetchRoleContexts('x', 'parent');
    expect(ctx.map((c) => c.viewRole)).not.toContain('admin');
    expect(ctx.map((c) => c.viewRole)).toContain('school_admin');
  });

  it('coach con hijo en el club: entrenador + acudiente', async () => {
    set('school_members', [{ ...ESCUELA, role: 'coach' }]);
    set('children', [{ id: 'hijo', ...ESCUELA, enrollments: [{ status: 'active', school_id: 'monster' }] }]);
    const ctx = await fetchRoleContexts('coach', 'coach');
    expect(ctx.map((c) => c.viewRole).sort()).toEqual(['coach', 'parent']);
  });

  it('perfiles de plataforma o de negocio quedan fuera (F2)', async () => {
    set('school_members', [{ ...ESCUELA, role: 'owner' }]);
    set('enrollments', [ESCUELA]);
    for (const rol of ['admin', 'super_admin', 'personal_trainer', 'organizer', 'wellness_professional', 'store_owner']) {
      expect(await fetchRoleContexts('x', rol)).toEqual([]);
    }
  });

  it('si una consulta falla, la app sigue como siempre (sin contextos)', async () => {
    set('enrollments', [ESCUELA]);
    respuestas.children = { data: null, error: { message: 'boom' } };
    expect(await fetchRoleContexts('x', 'parent')).toEqual([]);
  });
});

describe('safeInternalPath', () => {
  it.each([
    ['/mis-pagos?x=1#a', '/mis-pagos?x=1#a'],
    ['/dashboard', '/dashboard'],
    [null, '/dashboard'],
    ['', '/dashboard'],
    ['dashboard', '/dashboard'],
    ['//evil.com', '/dashboard'],
    ['/\\evil.com', '/dashboard'],
    ['/\t/evil.com', '/dashboard'],
    ['/\n/evil.com', '/dashboard'],
    ['https://evil.com', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/elegir-rol', '/dashboard'],
    ['/elegir-rol?redirectTo=/x', '/dashboard'],
  ])('%j → %j', (raw, esperado) => {
    expect(safeInternalPath(raw as string | null)).toBe(esperado);
  });
});
