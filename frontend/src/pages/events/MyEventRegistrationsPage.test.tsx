import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyEventRegistrationsPage from './MyEventRegistrationsPage';

const get = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const rol = vi.hoisted(() => ({ value: 'parent' as string }));

vi.mock('@/lib/api/bffClient', () => ({ bffClient: { get } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }), toast }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: { role: rol.value } }) }));
vi.mock('@/hooks/useSchoolContext', () => ({ useSchoolContext: () => ({ currentUserRole: rol.value }) }));

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/my-event-registrations']}>
      <MyEventRegistrationsPage />
    </MemoryRouter>,
  );
}

const REG = {
  id: 'r1', event_id: 'e1', participant_name: 'Sofía Herrera', participant_role: 'athlete', status: 'pending',
  payment_status: 'pending', child_id: 'c1', created_at: '2026-10-01T15:00:00Z',
  events: { id: 'e1', title: 'Copa Campestre', sport: 'fútbol', event_date: '2026-11-21', city: 'Bogotá', slug: 'copa-campestre', status: 'published' },
};

describe('MyEventRegistrationsPage (V2)', () => {
  beforeEach(() => {
    get.mockReset();
    toast.mockReset();
    rol.value = 'parent';
  });

  it('un error del BFF se ve como error con Reintentar, nunca como «sin inscripciones» ni toast', async () => {
    get.mockRejectedValueOnce(new Error('Error interno del servidor'));
    pintar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus inscripciones a eventos');
    expect(screen.queryByText(/Aún no hay inscripciones/)).toBeNull();
    expect(toast).not.toHaveBeenCalled();

    get.mockResolvedValueOnce([REG]);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Copa Campestre')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('vacío: dice que no hay y no ofrece Explorar (apagado para todos)', async () => {
    get.mockResolvedValueOnce([]);
    pintar();
    expect(await screen.findByText('Aún no hay inscripciones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explorar/i })).toBeNull();
  });

  it('lista con estados en palabras de la familia y el enlace al evento', async () => {
    get.mockResolvedValueOnce([REG]);
    pintar();
    expect(await screen.findByText('Tienes 1 inscripción; 1 está por aprobar.')).toBeInTheDocument();
    expect(screen.getByText('Por aprobar')).toBeInTheDocument();
    expect(screen.getByText('Pago pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver evento/ })).toBeInTheDocument();
  });

  it('acudiente: un solo «Volver», a su pestaña; otros roles conservan su flecha', async () => {
    get.mockResolvedValue([]);
    const { unmount } = pintar();
    expect(await screen.findByRole('button', { name: 'Volver a Calendario' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Volver/ })).toHaveLength(1);
    unmount();

    rol.value = 'athlete';
    pintar();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mis inscripciones a eventos' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });
});
