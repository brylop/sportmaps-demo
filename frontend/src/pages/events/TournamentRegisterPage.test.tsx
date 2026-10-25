import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TournamentRegisterPage from './TournamentRegisterPage';

const getForParticipant = vi.hoisted(() => vi.fn());
const register = vi.hoisted(() => vi.fn());
const kids = vi.hoisted(() => ({ value: [] as { id: string; full_name: string }[] }));

vi.mock('@/lib/api/tournaments', () => ({ getForParticipant, register }));
vi.mock('@/lib/api/bffClient', () => {
  class BFFError extends Error {
    constructor(public status: number, message: string) { super(message); }
  }
  return { BFFError };
});
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { role: 'parent' } }) }));
vi.mock('@/components/payment/PaymentCheckoutModal', () => ({ PaymentCheckoutModal: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: kids.value }).then(ok);
  return { supabase: { from: () => q } };
});

const BASE = {
  id: 't1', title: 'Copa Interna', sport: 'Fútbol', city: 'Bogotá', event_date: '2026-11-21', status: 'active',
  tournament_scope: 'internal', registrations_open: true, school_id: 's1', is_paid: true, payment_methods: ['efectivo'],
  categories: [{ id: 'cat1', division: 'General', level: '', category: 'Sub 12', rama: 'Mixto', age_min: null, age_max: null, active: true }],
  phases: [{ id: 'p1', phase_name: 'Única', valid_until: '2099-01-01', price_solo: 50000 }],
  my_registrations: [],
};

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/tournaments/t1/register']}>
      <Routes><Route path="/tournaments/:eventId/register" element={<TournamentRegisterPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('TournamentRegisterPage (V2)', () => {
  beforeEach(() => {
    getForParticipant.mockReset();
    register.mockReset();
    kids.value = [{ id: 'c1', full_name: 'Sofía Herrera' }, { id: 'c2', full_name: 'Tomás Herrera' }];
  });

  it('lo normal ya marcado: la única categoría queda elegida; falta elegir el hijo', async () => {
    getForParticipant.mockResolvedValue(BASE);
    pintar();
    expect(await screen.findByRole('heading', { name: 'Copa Interna' })).toBeInTheDocument();
    expect(screen.getByText(/cuesta .*50\.000 y se paga en efectivo en la escuela/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /General Sub 12 Mixto/ })).toHaveAttribute('aria-checked', 'true');
    const boton = screen.getByRole('button', { name: 'Inscribir' });
    expect(boton).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Sofía Herrera' }));
    expect(screen.getByRole('button', { name: 'Inscribir a Sofía' })).toBeEnabled();
    expect(register).not.toHaveBeenCalled();
  });

  it('hijo ya inscrito: estado en palabras y cómo pagar, sin volver a inscribir', async () => {
    getForParticipant.mockResolvedValue({
      ...BASE,
      my_registrations: [{ id: 'r1', category_id: 'cat1', child_id: 'c2', participant_name: 'Tomás', status: 'pending', payment_id: 'pay1', payment: { status: 'pending', amount: 50000, due_date: '2026-11-01' } }],
    });
    pintar();
    fireEvent.click(await screen.findByRole('radio', { name: 'Tomás Herrera' }));
    expect(screen.getByText('Tomás Herrera ya está inscrito/a')).toBeInTheDocument();
    expect(screen.getByText('Por aprobar')).toBeInTheDocument();
    expect(screen.getByText(/^Paga .*50\.000 en efectivo en la escuela\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inscribir/ })).toBeNull();
  });

  it('error al cargar ≠ torneo no encontrado', async () => {
    const { BFFError } = await import('@/lib/api/bffClient');
    getForParticipant.mockRejectedValueOnce(new (BFFError as unknown as new (s: number, m: string) => Error)(500, 'boom'));
    const { unmount } = pintar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el torneo');
    getForParticipant.mockResolvedValueOnce(BASE);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByRole('heading', { name: 'Copa Interna' })).toBeInTheDocument();
    unmount();

    getForParticipant.mockRejectedValueOnce(new (BFFError as unknown as new (s: number, m: string) => Error)(404, 'no'));
    pintar();
    expect(await screen.findByText('No encontramos este torneo')).toBeInTheDocument();
  });

  it('inscripciones cerradas: lo dice y deja ver resultados', async () => {
    getForParticipant.mockResolvedValue({ ...BASE, registrations_open: false });
    pintar();
    expect(await screen.findByText('Las inscripciones no están abiertas todavía')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver resultados' })).toBeInTheDocument();
  });
});
