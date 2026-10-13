/**
 * «Chat» de la barra de abajo: para la escuela abre el buzón de WhatsApp
 * (2026-10-13); los demás roles siguen en /messages hasta que se decida.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ role: 'school' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: { role: auth.role } }) }));
vi.mock('@/hooks/useMySchoolStore', () => ({ useMySchoolStore: () => ({ showStore: false }) }));

import { MobileBottomNav } from './MobileBottomNav';

const enlace = (texto: string) => screen.getByText(texto).closest('a')!;

describe('MobileBottomNav · Chat', () => {
    it('escuela: Chat → buzón de WhatsApp, y se marca activo estando en /whatsapp', () => {
        auth.role = 'school';
        render(<MemoryRouter initialEntries={['/whatsapp?tab=bandeja']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Chat')).toHaveAttribute('href', '/whatsapp?tab=conversaciones');
        expect(enlace('Chat').className).toContain('text-primary');
    });

    it('acudiente y entrenador: siguen en /messages', () => {
        auth.role = 'parent';
        const { unmount } = render(<MemoryRouter initialEntries={['/dashboard']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Chat')).toHaveAttribute('href', '/messages');
        unmount();
        auth.role = 'coach';
        render(<MemoryRouter initialEntries={['/dashboard']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Chat')).toHaveAttribute('href', '/messages');
    });
});
