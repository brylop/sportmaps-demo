import { describe, it, expect, vi, beforeEach } from 'vitest';

// Builder encadenable: registra cada llamada y resuelve con `resultado` al final.
const calls: Array<[string, unknown[]]> = [];
let resultado: { data: Array<{ id: string }> | null; error: unknown } = { data: [], error: null };

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  for (const m of ['update', 'delete', 'eq', 'select']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, ko);
  return {
    supabase: {
      from: (tabla: string) => {
        calls.push(['from', [tabla]]);
        return builder;
      },
    },
  };
});

import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  NotificationsNotUpdatedError,
} from './markRead';

beforeEach(() => {
  calls.length = 0;
  resultado = { data: [], error: null };
});

describe('markAllNotificationsRead', () => {
  it('filtra por el usuario y las no leídas, y pide las filas cambiadas', async () => {
    resultado = { data: [{ id: 'a' }, { id: 'b' }], error: null };
    await expect(markAllNotificationsRead('u1', 2)).resolves.toBe(2);
    expect(calls).toEqual([
      ['from', ['notifications']],
      ['update', [{ read: true }]],
      ['eq', ['user_id', 'u1']],
      ['eq', ['read', false]],
      ['select', ['id']],
    ]);
  });

  // El bug 2026-10-24: la RLS filtraba el UPDATE (0 filas, sin error) y la UI
  // lo tomaba como éxito — el contador seguía en 8.
  it('0 filas cambiadas con no leídas visibles = error, no éxito silencioso', async () => {
    resultado = { data: [], error: null };
    await expect(markAllNotificationsRead('u1', 8)).rejects.toBeInstanceOf(NotificationsNotUpdatedError);
  });

  it('0 filas cuando no había nada sin leer no es error', async () => {
    await expect(markAllNotificationsRead('u1', 0)).resolves.toBe(0);
  });

  it('propaga el error de PostgREST', async () => {
    resultado = { data: null, error: { message: 'boom' } };
    await expect(markAllNotificationsRead('u1', 3)).rejects.toEqual({ message: 'boom' });
  });
});

describe('markNotificationRead', () => {
  it('acota por id y usuario', async () => {
    resultado = { data: [{ id: 'n1' }], error: null };
    await expect(markNotificationRead('u1', 'n1')).resolves.toBe(1);
    expect(calls).toContainEqual(['eq', ['id', 'n1']]);
    expect(calls).toContainEqual(['eq', ['user_id', 'u1']]);
  });

  it('0 filas = error', async () => {
    await expect(markNotificationRead('u1', 'n1')).rejects.toBeInstanceOf(NotificationsNotUpdatedError);
  });
});

describe('deleteNotification', () => {
  it('0 filas = error', async () => {
    await expect(deleteNotification('u1', 'n1')).rejects.toThrow('No se pudo eliminar');
  });

  it('borra por id y usuario', async () => {
    resultado = { data: [{ id: 'n1' }], error: null };
    await expect(deleteNotification('u1', 'n1')).resolves.toBe(1);
    expect(calls).toContainEqual(['delete', []]);
  });
});
