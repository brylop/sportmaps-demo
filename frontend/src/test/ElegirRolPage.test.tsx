import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ElegirRolPage from '../pages/ElegirRolPage';
import { useAuth } from '../contexts/AuthContext';
import type { RoleContext } from '../lib/roleContexts';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
// ElegirRolPage importa lib/roleContexts, que importa el cliente de Supabase: sin
// este doble, el test depende de que exista un .env (y falla en CI y en worktrees limpios).
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const ctx = (viewRole: RoleContext['viewRole'], schoolId: string, schoolName: string, label: string): RoleContext => ({
  key: `${viewRole}:${schoolId}`, viewRole, memberRole: viewRole === 'school' ? 'owner' : (viewRole as RoleContext['memberRole']),
  schoolId, schoolName, label,
});

const switchRoleContext = vi.fn();

function renderPage(route: string, roleContexts: RoleContext[]) {
  (useAuth as any).mockReturnValue({
    user: { id: 'u1' }, profile: { full_name: 'Yuly Pérez', role: 'parent' }, loading: false,
    roleContexts, activeRoleContext: null, switchRoleContext,
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/elegir-rol" element={<ElegirRolPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const misma = [ctx('parent', 's1', 'Monster Volley', 'Como acudiente'), ctx('athlete', 's1', 'Monster Volley', 'Como atleta')];
const distintas = [ctx('parent', 's1', 'Monster Volley', 'Como acudiente'), ctx('school', 's2', 'Club Norte', 'Administración')];

describe('ElegirRolPage', () => {
  beforeEach(() => switchRoleContext.mockReset());

  it('lista los contextos de la persona', () => {
    renderPage('/elegir-rol', misma);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Como acudiente')).toBeInTheDocument();
    expect(screen.getByText('Como atleta')).toBeInTheDocument();
  });

  it('NO muestra la escuela si todos los roles son en la misma', () => {
    renderPage('/elegir-rol', misma);
    expect(screen.queryByText(/Monster Volley/)).not.toBeInTheDocument();
  });

  it('muestra la escuela si los roles están en escuelas distintas', () => {
    renderPage('/elegir-rol', distintas);
    expect(screen.getByText(/Monster Volley/)).toBeInTheDocument();
    expect(screen.getByText(/Club Norte/)).toBeInTheDocument();
  });

  it('sin contextos (un solo rol) va directo al dashboard', () => {
    renderPage('/elegir-rol', []);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  const elegirYEntrar = () => {
    fireEvent.click(screen.getByText('Como atleta'));
    fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
  };

  it('llama switchRoleContext con el destino interno pedido', () => {
    renderPage(`/elegir-rol?redirectTo=${encodeURIComponent('/mis-pagos?tab=1')}`, misma);
    elegirYEntrar();
    expect(switchRoleContext).toHaveBeenCalledWith('athlete:s1', '/mis-pagos?tab=1');
  });

  it.each([
    ['//evil.com'],
    ['/\\evil.com'],
    ['/\t/evil.com'],
    ['https://evil.com'],
    ['/elegir-rol'],
    ['/elegir-rol?redirectTo=/x'],
  ])('rechaza el destino %j y usa /dashboard', (raw) => {
    renderPage(`/elegir-rol?redirectTo=${encodeURIComponent(raw)}`, misma);
    elegirYEntrar();
    expect(switchRoleContext).toHaveBeenCalledWith('athlete:s1', '/dashboard');
  });

  it('sin redirectTo usa /dashboard', () => {
    renderPage('/elegir-rol', misma);
    elegirYEntrar();
    expect(switchRoleContext).toHaveBeenCalledWith('athlete:s1', '/dashboard');
  });
});
