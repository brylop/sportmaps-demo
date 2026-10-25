/**
 * Mensajes del acudiente V2: sin mensajes dice que al club se le escribe por
 * WhatsApp (con el enlace del celular del club, nunca un número inventado),
 * y si hay mensajes se listan y se leen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MensajesV2, conversaciones, type MensajeV2 } from './MensajesV2';

const base = { userId: 'yo', isLoading: false, isError: false, onRetry: vi.fn(), schoolName: 'Club Demo' };

const m = (id: string, de: string, para: string, content: string, read = true): MensajeV2 => ({
  id, sender_id: de, recipient_id: para, subject: '', content, read, created_at: '2026-10-20T10:00:00Z', other_user_name: de === 'yo' ? 'Profe Laura' : 'Profe Laura',
});

describe('MensajesV2', () => {
  it('vacío: manda a WhatsApp del club', () => {
    render(<MensajesV2 {...base} messages={[]} whatsapp="https://wa.me/573001112233" />);
    expect(screen.getByText('No tienes mensajes')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Escribirle al club/ });
    expect(link).toHaveAttribute('href', 'https://wa.me/573001112233');
  });

  it('vacío y el club sin celular: no inventa un número', () => {
    render(<MensajesV2 {...base} messages={[]} whatsapp={null} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Club Demo todavía no registró un WhatsApp/)).toBeInTheDocument();
  });

  it('error: distinto del vacío y con reintentar', () => {
    const onRetry = vi.fn();
    render(<MensajesV2 {...base} onRetry={onRetry} isError messages={[]} whatsapp={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus mensajes');
    expect(screen.queryByText('No tienes mensajes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('con mensajes: lista por persona y abre la conversación', () => {
    const msgs = [m('2', 'laura', 'yo', 'Mañana no hay clase', false), m('1', 'yo', 'laura', 'Hola profe')];
    render(<MensajesV2 {...base} messages={msgs} whatsapp={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Profe Laura/ }));
    expect(screen.getByRole('heading', { name: 'Profe Laura' })).toBeInTheDocument();
    expect(screen.getByText('Hola profe')).toBeInTheDocument();
    expect(screen.getByText('Mañana no hay clase')).toBeInTheDocument();
  });
});

describe('conversaciones', () => {
  it('deja el último mensaje por persona', () => {
    const msgs = [m('3', 'ana', 'yo', 'c'), m('2', 'laura', 'yo', 'b'), m('1', 'yo', 'laura', 'a')];
    expect(conversaciones(msgs, 'yo').map((x) => x.id)).toEqual(['3', '2']);
  });
});
