import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyEnrollmentsPage from './MyEnrollmentsPage';

const s = vi.hoisted(() => ({
  role: 'parent' as string,
  enrollments: { activeEnrollments: [] as unknown[], loading: false, error: null as unknown, refetch: () => {} },
  bookings: [] as unknown[],
  facilities: [] as unknown[],
}));

const { q, mut } = vi.hoisted(() => ({
  q: (data: unknown) => ({ data, isLoading: false, error: null, refetch: () => {} }),
  mut: () => ({ mutate: () => {}, isPending: false }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { role: s.role } }) }));
vi.mock('@/hooks/useSchoolContext', () => ({ useSchoolContext: () => ({ currentUserRole: s.role, schoolId: 'sch1' }) }));
vi.mock('@/hooks/useEnrollments', () => ({ useEnrollments: () => s.enrollments }));
vi.mock('@/hooks/useTrialClassesSelf', () => ({ useTrialClassesSelf: () => ({ selfServiceAvailable: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/access/HourBankBalanceCard', () => ({ HourBankBalanceCard: () => null }));
vi.mock('@/components/school/TrialClassSelfModal', () => ({ TrialClassSelfModal: () => null }));
vi.mock('@/components/booking/CompactSessionSlot', () => ({ CompactSessionSlot: () => null }));
vi.mock('@/components/booking/HourGridPicker', () => ({ HourGridPicker: () => null }));
vi.mock('@/hooks/useAthleteSessionBookings', () => ({
  useMyBookings: () => q(s.bookings),
  useMySecondaryBookings: () => q([]),
  useAthleteFacilities: () => q({ facilities: s.facilities }),
  useAvailableSessions: () => q({ sessions: [] }),
  useFacilitySlots: () => q({ slots: [] }),
  usePTAvailability: () => q(null),
  useCancelBooking: mut, useCancelSecondaryBooking: mut, useCancelPTSession: mut,
  useBookSession: mut, useBookSecondarySession: mut, useBookPTSession: mut,
  prefetchPTAvailability: vi.fn(),
  collapseOverlappingBlocks: (x: unknown) => x,
}));
vi.mock('@/integrations/supabase/client', () => {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => Promise.resolve({ data: [{ id: 'c1', full_name: 'Sofía Herrera', avatar_url: null }], error: null });
  return { supabase: { from: () => b } };
});

const PLAN = {
  id: 'e1', status: 'active', offering_plan_id: 'op1', team_id: null, expires_at: null,
  sessions_used: 0, secondary_sessions_used: 0,
  offering: { name: 'Natación' }, offering_plan: { name: 'Mensualidad Natación' },
  program: { name: 'Natación', sport: 'natacion', school_type: 'academy', school: { name: 'Club', city: 'Bogotá' } },
  plan_details: { name: 'Mensualidad Natación', max_sessions: null, max_secondary_sessions: 0, secondary_session_label: 'GYM' },
};
const FACILITIES = Array.from({ length: 14 }, (_, i) => ({ id: `f${i}`, name: `Cancha ${i + 1}`, type: 'cancha', school_id: 'sch1' }));

function pintar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/enrollments']}>
        <MyEnrollmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyEnrollmentsPage (V2)', () => {
  beforeEach(() => {
    s.role = 'parent';
    s.enrollments = { activeEnrollments: [PLAN], loading: false, error: null, refetch: vi.fn() };
    s.bookings = [];
    s.facilities = FACILITIES;
  });

  it('una frase y un botón arriba; sin tarjetas de conteo ni botones a Explorar', async () => {
    pintar();
    expect(await screen.findByText('Sofía tiene 1 plan activo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agendar clase/ })).toBeInTheDocument();
    expect(screen.getByText('Mensualidad Natación')).toBeInTheDocument();
    expect(screen.queryByText(/Buscar equipos|Ver membresías/)).toBeNull();
    expect(screen.queryByText('Portal Familiar')).toBeNull();
  });

  it('las instalaciones van en Reservas y, si el plan no trae reservas, plegadas', async () => {
    pintar();
    fireEvent.click(await screen.findByRole('tab', { name: /Reservas/ }));
    expect(screen.getByText('Instalaciones de la escuela (14)')).toBeInTheDocument();
    expect(screen.getByText('El plan de Sofía no incluye reservas de instalaciones.')).toBeInTheDocument();
    // Se conserva la función: la lista sigue ahí (dentro del plegable) con su «Reservar».
    expect(screen.getAllByRole('button', { name: /^Reservar Cancha/ })).toHaveLength(14);
  });

  it('con reservas en el plan: lista compacta con «Reservar» y el resto a un toque', async () => {
    s.enrollments = {
      ...s.enrollments,
      activeEnrollments: [{ ...PLAN, plan_details: { ...PLAN.plan_details, max_secondary_sessions: 4 }, secondary_sessions_used: 1 }],
    };
    pintar();
    fireEvent.click(await screen.findByRole('tab', { name: /Reservas/ }));
    expect(screen.getByText('Quedan 3 reservas de 4 en el plan.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Reservar Cancha/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver las 14 instalaciones' }));
    expect(screen.getAllByRole('button', { name: /^Reservar Cancha/ })).toHaveLength(14);
  });

  it('un error al cargar no se ve como «sin equipos ni planes»', async () => {
    const refetch = vi.fn();
    s.enrollments = { activeEnrollments: [], loading: false, error: new Error('500'), refetch };
    pintar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las inscripciones');
    expect(screen.queryByText(/no tiene equipos ni planes/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('deportista adulto: de «tú», mismo contenido', async () => {
    s.role = 'athlete';
    pintar();
    expect(await screen.findByRole('heading', { name: 'Mis inscripciones' })).toBeInTheDocument();
    expect(screen.getByText('Tienes 1 plan activo.')).toBeInTheDocument();
  });
});
