import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { RoleContext } from '../lib/roleContexts';

// Persona real: perfil 'school' (dueña) que además es acudiente.
const PROFILE = { id: 'u1', email: 'yuly@x.co', full_name: 'Yuly', role: 'school' };

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: PROFILE, error: null })),
  };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', user_metadata: {} } } } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signOut: vi.fn(),
      },
      from: vi.fn(() => builder),
    },
  };
});

const fetchRoleContexts = vi.fn();
vi.mock('@/lib/roleContexts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/roleContexts')>();
  return { ...actual, fetchRoleContexts: (...a: unknown[]) => fetchRoleContexts(...a) };
});

const C = (viewRole: RoleContext['viewRole'], label: string): RoleContext => ({
  key: `${viewRole}:s1`, viewRole, memberRole: viewRole === 'school' ? 'owner' : (viewRole as RoleContext['memberRole']),
  schoolId: 's1', schoolName: 'Monster', label,
});
const DOS = [C('school', 'Administración'), C('parent', 'Como acudiente')];
const KEY = 'sportmaps_active_context_u1';

function Probe() {
  const { loading, profile, realRole, needsRoleChoice, activeRoleContext } = useAuth();
  if (loading) return <span data-testid="estado">loading</span>;
  return (
    <div>
      <span data-testid="estado">ready</span>
      <span data-testid="role">{profile?.role}</span>
      <span data-testid="real">{realRole}</span>
      <span data-testid="needs">{String(needsRoleChoice)}</span>
      <span data-testid="active">{activeRoleContext?.key ?? 'none'}</span>
    </div>
  );
}

const renderAuth = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider><Probe /></AuthProvider>
  </QueryClientProvider>,
);
const listo = () => waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('ready'));

describe('AuthContext — contextos de rol', () => {
  beforeEach(() => { localStorage.clear(); fetchRoleContexts.mockReset(); });

  it('un solo rol: profile.role es el real y no pide elegir', async () => {
    fetchRoleContexts.mockResolvedValue([]);
    renderAuth(); await listo();
    expect(screen.getByTestId('role')).toHaveTextContent('school');
    expect(screen.getByTestId('needs')).toHaveTextContent('false');
  });

  it('multirol sin elección: rol real y needsRoleChoice', async () => {
    fetchRoleContexts.mockResolvedValue(DOS);
    renderAuth(); await listo();
    expect(screen.getByTestId('role')).toHaveTextContent('school');
    expect(screen.getByTestId('needs')).toHaveTextContent('true');
  });

  it('multirol con elección válida: profile.role = viewRole, realRole intacto', async () => {
    localStorage.setItem(KEY, 'parent:s1');
    fetchRoleContexts.mockResolvedValue(DOS);
    renderAuth(); await listo();
    expect(screen.getByTestId('role')).toHaveTextContent('parent');
    expect(screen.getByTestId('real')).toHaveTextContent('school');
    expect(screen.getByTestId('needs')).toHaveTextContent('false');
  });

  it('elección guardada inválida: se ignora, se borra y se vuelve a preguntar', async () => {
    localStorage.setItem(KEY, 'athlete:s9');
    fetchRoleContexts.mockResolvedValue(DOS);
    renderAuth(); await listo();
    expect(screen.getByTestId('role')).toHaveTextContent('school');
    expect(screen.getByTestId('needs')).toHaveTextContent('true');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('dejó de ser multirol con una elección vieja: rol real y la clave se borra', async () => {
    localStorage.setItem(KEY, 'parent:s1');
    fetchRoleContexts.mockResolvedValue([]);
    renderAuth(); await listo();
    expect(screen.getByTestId('role')).toHaveTextContent('school');
    expect(screen.getByTestId('active')).toHaveTextContent('none');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('no suelta loading antes de resolver los contextos', async () => {
    let soltar!: (v: RoleContext[]) => void;
    fetchRoleContexts.mockReturnValue(new Promise((r) => { soltar = r; }));
    localStorage.setItem(KEY, 'parent:s1');
    renderAuth();
    await waitFor(() => expect(fetchRoleContexts).toHaveBeenCalled());
    expect(screen.getByTestId('estado')).toHaveTextContent('loading');
    soltar(DOS);
    await listo();
    expect(screen.getByTestId('role')).toHaveTextContent('parent');
  });
});
