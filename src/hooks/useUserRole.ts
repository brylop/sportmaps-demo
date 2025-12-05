import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'athlete' | 'parent' | 'coach' | 'school' | 'wellness_professional' | 'store_owner' | 'admin';

/**
 * Hook to check if the current user has a specific role
 * Uses the secure has_role database function
 */
export function useHasRole(role: AppRole) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['has_role', user?.id, role],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: role
      });

      if (error) {
        console.error('Error checking role:', error);
        return false;
      }

      return data as boolean;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get all roles for the current user
 */
export function useUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user_roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc('get_user_roles', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return data as AppRole[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  return useHasRole('admin');
}
