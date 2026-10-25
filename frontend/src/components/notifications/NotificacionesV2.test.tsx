/**
 * Notificaciones del acudiente V2: solo presentación. Comprueba la frase de
 * no leídas, que «Marcar todas» y abrir/eliminar llamen a la lógica que trae
 * la página (markRead.ts), y que carga, vacío y error se vean distintos.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificacionesV2, resumenNoLeidas, type NotificacionesV2Props, type NotificacionV2 } from './NotificacionesV2';

const cobro: NotificacionV2 = { id: 'n1', title: 'Nuevo cobro', message: 'Mensualidad de noviembre', created_at: '2026-10-20T10:00:00Z', read: false, link: '/my-payments' };
const viejo: NotificacionV2 = { id: 'n2', title: 'Clase movida', message: 'Ya podés ver el horario', created_at: '2026-10-01T10:00:00Z', read: true, link: null };
const sinLink: NotificacionV2 = { id: 'n3', title: 'Aviso', message: 'Texto', created_at: '2026-10-02T10:00:00Z', read: false, link: null };

function setup(over: Partial<NotificacionesV2Props> = {}) {
  const props: NotificacionesV2Props = {
    notifications: [cobro, viejo, sinLink],
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    filter: 'all',
    onFilter: vi.fn(),
    timeAgo: () => 'hace 2 días',
    onOpen: vi.fn(),
    onMarkRead: vi.fn(),
    onDelete: vi.fn(),
    onMarkAll: vi.fn(),
    ...over,
  };
  render(<NotificacionesV2 {...props} />);
  return props;
}

describe('NotificacionesV2', () => {
  it('una frase y un botón: cuántas sin leer y «Marcar todas como leídas»', () => {
    const p = setup();
    expect(screen.getByText('Tienes 2 sin leer.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(p.onMarkAll).toHaveBeenCalledTimes(1);
  });

  it('tocar una notificación con enlace la abre; sin enlace se marca leída aparte', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Nuevo cobro/ }));
    expect(p.onOpen).toHaveBeenCalledWith(cobro);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída' }));
    expect(p.onMarkRead).toHaveBeenCalledWith('n3');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar «Clase movida»' }));
    expect(p.onDelete).toHaveBeenCalledWith('n2');
  });

  it('el texto guardado en la base se muestra tal cual llegó', () => {
    setup();
    expect(screen.getByText('Ya podés ver el horario')).toBeInTheDocument();
  });

  it('sin no leídas no ofrece «Marcar todas»', () => {
    setup({ notifications: [viejo] });
    expect(screen.getByText('Estás al día.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).not.toBeInTheDocument();
  });

  it('vacío, carga y error son distintos', () => {
    const { unmount } = render(<NotificacionesV2 {...{ ...baseVacio() }} />);
    expect(screen.getByText('No tienes notificaciones')).toBeInTheDocument();
    unmount();

    setup({ isLoading: true, notifications: [] });
    expect(screen.getByLabelText('Cargando tus notificaciones')).toBeInTheDocument();
    expect(screen.queryByText('No tienes notificaciones')).not.toBeInTheDocument();
  });

  it('error: lo dice y deja reintentar', () => {
    const p = setup({ isError: true, notifications: [] });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus notificaciones');
    expect(screen.queryByText('Estás al día.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(p.onRetry).toHaveBeenCalled();
  });
});

function baseVacio(): NotificacionesV2Props {
  return {
    notifications: [], isLoading: false, isError: false, onRetry: vi.fn(), filter: 'all', onFilter: vi.fn(),
    timeAgo: () => '', onOpen: vi.fn(), onMarkRead: vi.fn(), onDelete: vi.fn(), onMarkAll: vi.fn(),
  };
}

describe('resumenNoLeidas', () => {
  it('singular y plural', () => {
    expect(resumenNoLeidas(0)).toBe('Estás al día.');
    expect(resumenNoLeidas(1)).toBe('Tienes 1 sin leer.');
    expect(resumenNoLeidas(4)).toBe('Tienes 4 sin leer.');
  });
});
