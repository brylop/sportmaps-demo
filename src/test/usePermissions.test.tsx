import { renderHook } from '@testing-library/react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock useAuth
vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('usePermissions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return default permissions when no user', () => {
        (useAuth as any).mockReturnValue({ profile: null });

        const { result } = renderHook(() => usePermissions());

        expect(result.current.can('dashboard:view')).toBe(false);
        expect(result.current.isAdmin()).toBe(false);
    });

    it('should allow admin everything', () => {
        (useAuth as any).mockReturnValue({
            profile: { role: 'admin' }
        });

        const { result } = renderHook(() => usePermissions());

        expect(result.current.isAdmin()).toBe(true);
        // Assuming admin has 'admin:all' or similar logic in real implementation
        expect(result.current.can('dashboard:view')).toBe(true);
    });

    it('should restrict athlete permissions', () => {
        (useAuth as any).mockReturnValue({
            profile: { role: 'athlete' }
        });

        const { result } = renderHook(() => usePermissions());

        expect(result.current.isAdmin()).toBe(false);
        expect(result.current.can('dashboard:view')).toBe(true); // Athletes usually can view dashboard
        expect(result.current.can('admin:users')).toBe(false); // Athletes cannot manage users
    });
});
