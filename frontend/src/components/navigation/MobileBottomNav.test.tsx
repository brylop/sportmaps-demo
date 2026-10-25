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
import { ACUDIENTE_V2 } from '@/lib/feature-flags';

const enlace = (texto: string) => screen.getByText(texto).closest('a')!;

describe('MobileBottomNav · Chat', () => {
    it('escuela: Chat → buzón de WhatsApp, y se marca activo estando en /whatsapp', () => {
        auth.role = 'school';
        render(<MemoryRouter initialEntries={['/whatsapp?tab=bandeja']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Chat')).toHaveAttribute('href', '/whatsapp?tab=conversaciones');
        expect(enlace('Chat').className).toContain('text-primary');
    });

    it('entrenador: sigue en /messages', () => {
        auth.role = 'coach';
        render(<MemoryRouter initialEntries={['/dashboard']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Chat')).toHaveAttribute('href', '/messages');
    });
});

// Con VITE_ACUDIENTE_V2=false (reversa) la barra del acudiente vuelve a la anterior.
describe.skipIf(!ACUDIENTE_V2)('MobileBottomNav · acudiente V2', () => {
    it('cinco pestañas en orden y la quinta es «Más»; sin Chat', () => {
        auth.role = 'parent';
        render(<MemoryRouter initialEntries={['/dashboard']}><MobileBottomNav /></MemoryRouter>);
        const textos = Array.from(screen.getByTestId('mobile-bottom-nav').querySelectorAll('a')).map((a) => a.textContent);
        expect(textos).toEqual(['Inicio', 'Calendario', 'Hijos', 'Pagos', 'Más']);
        expect(enlace('Más')).toHaveAttribute('href', '/mas');
        expect(screen.queryByText('Chat')).toBeNull();
    });

    it('las pantallas que viven dentro de una pestaña la encienden', () => {
        auth.role = 'parent';
        const { unmount } = render(<MemoryRouter initialEntries={['/my-cards']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Más').className).toContain('text-primary');
        unmount();
        render(<MemoryRouter initialEntries={['/estado-cuenta']}><MobileBottomNav /></MemoryRouter>);
        expect(enlace('Pagos').className).toContain('text-primary');
        expect(enlace('Inicio').className).not.toContain('text-primary');
    });
});
