import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';

/**
 * Estado de la resolución de la ficha. Existe porque `staffId === null` tapaba
 * tres situaciones distintas y las pantallas las trataban igual: todavía
 * cargando, la consulta falló, o el usuario no tiene ficha de staff.
 *
 * Costó caro: `staff_select_policy` hacía SELECT sobre auth.users y devolvía
 * 42501 para CUALQUIER autenticado. El hook tiraba el error, la pantalla solo
 * leía `staffId`, y el entrenador veía una lista de equipos vacía — idéntica a
 * "no tienes equipos asignados". Nadie se enteró hasta que llamó una escuela.
 */
export type EstadoFichaStaff = 'cargando' | 'error' | 'sin-ficha' | 'ok';

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

  const habilitado = !!user?.id && !!schoolId;
  const estado: EstadoFichaStaff =
    !habilitado || isLoading ? 'cargando'
    : error                  ? 'error'
    : staffRecord?.id        ? 'ok'
    :                          'sin-ficha';

  return {
    staffId: staffRecord?.id ?? null,
    staffRecord,
    isLoading,
    error,
    /** Usar esto para decidir qué mostrar. `staffId === null` NO distingue error de "sin ficha". */
    estado,
    refetch
  };
}
