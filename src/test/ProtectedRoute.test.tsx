import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Helper to render in router
const renderWithRouter = (ui: React.ReactNode, { route = '/' } = {}) => {
    window.history.pushState({}, 'Test page', route);
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
