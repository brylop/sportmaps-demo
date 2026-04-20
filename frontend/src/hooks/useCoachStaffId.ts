import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';

/**
 * Hook reutilizable para obtener el registro de 'school_staff' (el ID administrativo)
 * del usuario autenticado en la escuela actual.
 * 
 * Resuelve el desacople entre auth.uid() y school_staff.id usando coach_auth_id.
 */
export function useCoachStaffId() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();

  const { data: staffRecord, isLoading, error, refetch } = useQuery({
    queryKey: ['staff-record', user?.id, schoolId],
    queryFn: async () => {
      if (!user?.id || !schoolId) return null;
      
      const { data, error } = await supabase
        .from('school_staff')
        .select('id, full_name, school_id')
        .eq('coach_auth_id', user.id)
        .eq('school_id', schoolId)
        .maybeSingle();

      if (error) {
        console.error('[useCoachStaffId] Error resolving staff_id:', error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id && !!schoolId,
    staleTime: 5 * 60 * 1000, // 5 minutos de caché
  });

  return {
    staffId: staffRecord?.id ?? null,
    staffRecord,
    isLoading,
    error,
    refetch
  };
}
