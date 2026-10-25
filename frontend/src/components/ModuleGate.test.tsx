/**
 * Módulo sin contratar: solo quien puede abrir /mi-plan ve «Ver planes y
 * activar». A los demás (coach en /coach-plans) el botón los mandaba a «no
 * autorizado»; se les dice que lo pida la administración.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const s = vi.hoisted(() => ({ rol: 'school' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: { role: s.rol } }) }));
vi.mock('@/hooks/useSchoolContext', () => ({ useSchoolContext: () => ({ currentUserRole: s.rol }) }));
vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({ isLoading: false, hasAddon: () => false, isModuleEnabled: () => true }),
}));

import { ModuleGate } from './ModuleGate';

describe('ModuleGate · módulo sin contratar', () => {
  it('la escuela ve «Ver planes y activar» hacia /mi-plan', () => {
    s.rol = 'school';
    render(<ModuleGate moduleKey="finanzas_contabilidad"><p>adentro</p></ModuleGate>);
    expect(screen.getByRole('link', { name: 'Ver planes y activar' })).toHaveAttribute('href', '/mi-plan');
    expect(screen.queryByText('adentro')).toBeNull();
  });

  it('el coach no ve el botón: se le pide hablar con la administración', () => {
    s.rol = 'coach';
    render(<ModuleGate moduleKey="finanzas_contabilidad" roles={['coach']}><p>adentro</p></ModuleGate>);
    expect(screen.queryByRole('link', { name: /Ver planes/ })).toBeNull();
    expect(screen.getByText(/Pídele a la administración que lo active/)).toBeInTheDocument();
    expect(screen.queryByText('adentro')).toBeNull();
  });
});
