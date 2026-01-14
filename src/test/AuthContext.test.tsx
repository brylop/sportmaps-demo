import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
            onAuthStateChange: vi.fn().mockReturnValue({
                data: { subscription: { unsubscribe: vi.fn() } }
            }),
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
        }),
    },
}));

// Test component that uses auth context
function TestConsumer() {
    const { user, loading, profile } = useAuth();
    return (
        <div>
            <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
            <span data-testid="user">{user ? 'authenticated' : 'anonymous'}</span>
            <span data-testid="role">{profile?.role || 'no-role'}</span>
        </div>
    );
}

// Helper to render with providers
function renderWithProviders(ui: React.ReactElement) {
    return render(
        <BrowserRouter>
            <AuthProvider>
                {ui}
            </AuthProvider>
        </BrowserRouter>
    );
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial State', () => {
        it('should start with loading state', () => {
            renderWithProviders(<TestConsumer />);

            // Initially should be loading
            expect(screen.getByTestId('loading')).toHaveTextContent('loading');
        });

        it('should show anonymous when no session exists', async () => {
            renderWithProviders(<TestConsumer />);

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('ready');
            });

            expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
        });
    });

    describe('useAuth hook', () => {
        it('should throw error when used outside AuthProvider', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                render(<TestConsumer />);
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('Profile Roles', () => {
        it('should show no-role when profile is null', async () => {
            renderWithProviders(<TestConsumer />);

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('ready');
            });

            expect(screen.getByTestId('role')).toHaveTextContent('no-role');
        });
    });
});

describe('AuthProvider', () => {
    it('should render children correctly', async () => {
        renderWithProviders(
            <div data-testid="child">Child Content</div>
        );

        expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
    });
});
