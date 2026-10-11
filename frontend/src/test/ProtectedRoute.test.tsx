import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolContext } from '../hooks/useSchoolContext';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../hooks/useSchoolContext', () => ({
    useSchoolContext: vi.fn(),
}));

// Helper to render in router
const renderWithRouter = (ui: React.ReactNode, { route = '/' } = {}) => {
    window.history.pushState({}, 'Test page', route);
    (useSchoolContext as any).mockReturnValue({
        loading: false,
        onboardingStatus: 'completed',
        currentUserRole: null
    });
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/" element={ui} />
                <Route path="/login" element={<div>Login Page</div>} />
                <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('ProtectedRoute', () => {
    it('shows loading spinner when loading', () => {
        (useAuth as any).mockReturnValue({ loading: true });

        // ProtectedRoute renders null or spinner when loading
        // Adjust selector based on your actual spinner implementation
        const { container } = renderWithRouter(
            <ProtectedRoute>
                <div>Protected Content</div>
            </ProtectedRoute>
        );

        // Assuming Loader2 is used which renders an svg
        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to login when not authenticated', () => {
        (useAuth as any).mockReturnValue({ loading: false, user: null });

        renderWithRouter(
            <ProtectedRoute>
                <div>Protected Content</div>
            </ProtectedRoute>
        );

        expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it('renders children when authenticated and no specific role required', () => {
        (useAuth as any).mockReturnValue({ loading: false, user: { id: '1' }, profile: { role: 'athlete' } });

        renderWithRouter(
            <ProtectedRoute>
                <div>Protected Content</div>
            </ProtectedRoute>
        );

        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('redirects to unauthorized if role does not match', () => {
        (useAuth as any).mockReturnValue({
            loading: false,
            user: { id: '1' },
            profile: { role: 'athlete' }
        });

        renderWithRouter(
            <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Content</div>
            </ProtectedRoute>
        );

        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });

    it('allows access if role matches', () => {
        (useAuth as any).mockReturnValue({
            loading: false,
            user: { id: '1' },
            profile: { role: 'admin' }
        });

        renderWithRouter(
            <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Content</div>
            </ProtectedRoute>
        );

        expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });
});


// ─── Membresía de escuela vs allowedRoles (2026-10-10) ───────────────────────
// Antes, owner/admin/school_admin de CUALQUIER escuela saltaban allowedRoles:
// entraban por URL a /admin/users, /admin/analytics, /pacientes… Ahora la
// membresía solo cuenta en rutas que admiten administración de escuela.
describe('ProtectedRoute — membresía de escuela respeta allowedRoles', () => {
    const renderCon = (
        ui: React.ReactNode,
        ctx: { currentUserRole: string | null; schoolId: string | null },
    ) => {
        (useSchoolContext as any).mockReturnValue({
            loading: false,
            onboardingStatus: 'completed',
            ...ctx,
        });
        return render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={ui} />
                    <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
                </Routes>
            </MemoryRouter>
        );
    };
    const sesion = (role: string) =>
        (useAuth as any).mockReturnValue({ loading: false, user: { id: 'u1' }, profile: { role } });

    it('dueño de escuela NO entra a una ruta /admin estricta', () => {
        sesion('school');
        renderCon(
            <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                <div>Admin Content</div>
            </ProtectedRoute>,
            { currentUserRole: 'owner', schoolId: 's1' },
        );
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });

    it('admin de escuela (membresía admin) NO entra a /admin/users aunque fuera no estricta', () => {
        sesion('school');
        renderCon(
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <div>Admin Content</div>
            </ProtectedRoute>,
            { currentUserRole: 'admin', schoolId: 's1' },
        );
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });

    it('el super admin de plataforma (perfil) sí entra a la ruta estricta', () => {
        sesion('super_admin');
        renderCon(
            <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                <div>Admin Content</div>
            </ProtectedRoute>,
            { currentUserRole: null, schoolId: null },
        );
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('dueño con perfil personal_trainer sigue entrando a las rutas de SU escuela', () => {
        sesion('personal_trainer');
        renderCon(
            <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                <div>School Content</div>
            </ProtectedRoute>,
            { currentUserRole: 'owner', schoolId: 's1' },
        );
        expect(screen.getByText('School Content')).toBeInTheDocument();
    });

    it('school_admin por membresía entra a una ruta que solo lista school', () => {
        sesion('school_admin');
        renderCon(
            <ProtectedRoute allowedRoles={['school']}>
                <div>School Content</div>
            </ProtectedRoute>,
            { currentUserRole: 'school_admin', schoolId: 's1' },
        );
        expect(screen.getByText('School Content')).toBeInTheDocument();
    });

    it('dueño de escuela NO entra a rutas clínicas del profesional de salud', () => {
        sesion('school');
        renderCon(
            <ProtectedRoute allowedRoles={['wellness_professional']}>
                <div>Pacientes</div>
            </ProtectedRoute>,
            { currentUserRole: 'owner', schoolId: 's1' },
        );
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });

    it('admin de escuela NO entra a rutas de tienda que solo listan store_owner/admin', () => {
        sesion('school');
        renderCon(
            <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                <div>Proveedores</div>
            </ProtectedRoute>,
            { currentUserRole: 'admin', schoolId: 's1' },
        );
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });

    it("el 'owner' de onboarding sin escuela activa (perfil reporter) no cuenta como membresía", () => {
        sesion('reporter');
        renderCon(
            <ProtectedRoute allowedRoles={['school', 'school_admin']}>
                <div>School Content</div>
            </ProtectedRoute>,
            { currentUserRole: 'owner', schoolId: null },
        );
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });

    it('coach por membresía no entra a una ruta solo de escuela', () => {
        sesion('coach');
        renderCon(
            <ProtectedRoute allowedRoles={['school', 'school_admin']}>
                <div>School Content</div>
            </ProtectedRoute>,
            { currentUserRole: 'coach', schoolId: 's1' },
        );
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });
});
