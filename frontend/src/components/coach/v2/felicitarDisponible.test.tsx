/** «¿Existe Felicitar?» sin provocar el 400 de list_kudos sin deportista. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const listar = vi.hoisted(() => vi.fn());
const pago = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/v2Contratos', () => ({
  listarFelicitaciones: listar,
  estadoConvocatoria: vi.fn(),
  estadoPagoEquipo: pago,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/api/bffClient', () => ({ bffClient: { get: vi.fn() } }));
vi.mock('@/lib/coachTeamScope', () => ({ fetchCoachTeams: vi.fn() }));

import { useEstadoPagoEquipo, useFelicitarDisponible, _olvidarFelicitarDisponible } from './useCoachV2Data';

const envoltorio = () => {
  const qc = new QueryClient();
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  listar.mockReset();
  _olvidarFelicitarDisponible();
});

describe('useFelicitarDisponible', () => {
  it('sin deportista real no pregunta (nada de list_kudos vacío)', () => {
    const { result } = renderHook(() => useFelicitarDisponible(null), { wrapper: envoltorio() });
    expect(listar).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('pregunta UNA vez con un deportista real y lo recuerda en la sesión', async () => {
    listar.mockResolvedValue({ data: [], error: null, noDisponible: false });
    const { result } = renderHook(() => useFelicitarDisponible({ childId: 'c1' }), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.data).toBe(true));
    expect(listar).toHaveBeenCalledWith({ childId: 'c1' }, 1);
    // Otra pantalla (otro QueryClient) ya no vuelve a preguntar.
    const otra = renderHook(() => useFelicitarDisponible({ childId: 'c2' }), { wrapper: envoltorio() });
    expect(otra.result.current.data).toBe(true);
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('si la RPC no existe, se oculta y tampoco se vuelve a preguntar', async () => {
    listar.mockResolvedValue({ data: null, error: null, noDisponible: true });
    const { result } = renderHook(() => useFelicitarDisponible({ athleteUserId: 'u1' }), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.data).toBe(false));
    const otra = renderHook(() => useFelicitarDisponible({ athleteUserId: 'u2' }), { wrapper: envoltorio() });
    expect(otra.result.current.data).toBe(false);
    expect(listar).toHaveBeenCalledTimes(1);
  });
});

describe('useEstadoPagoEquipo', () => {
  it('42501 «No diriges este equipo» = sin chips, sin error', async () => {
    pago.mockResolvedValue({ data: null, error: 'No tienes permiso para hacer esto.', noDisponible: false, codigo: '42501' });
    const { result } = renderHook(() => useEstadoPagoEquipo('t1', true), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.disponible).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('otro error sí queda como error (la pantalla avisa sin montos)', async () => {
    pago.mockResolvedValue({ data: null, error: 'Algo salió mal. Intenta de nuevo.', noDisponible: false, codigo: 'XX000' });
    const { result } = renderHook(() => useEstadoPagoEquipo('t1', true), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
