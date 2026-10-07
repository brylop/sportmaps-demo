import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSchoolAthleteAvailability } from '@/lib/clinical/api';
import type { SchoolAthleteAvailability } from '@/lib/clinical/types';

/**
 * Disponibilidad médica de los atletas de una escuela (coach / staff).
 * Solo trae lo que el profesional y la familia autorizaron compartir
 * (consentimiento 'compartir_disponibilidad'); nunca diagnóstico.
 */
export function useSchoolAthleteAvailability(schoolId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['clinical', 'school-availability', schoolId],
    queryFn: () => getSchoolAthleteAvailability(schoolId as string),
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
    // Si la base todavía no tiene la RPC, no reintentar en bucle.
    retry: 1,
  });

  const { byChildId, byProfileId } = useMemo(() => {
    const byChild = new Map<string, SchoolAthleteAvailability>();
    const byProfile = new Map<string, SchoolAthleteAvailability>();
    for (const row of query.data ?? []) {
      if (row.child_id) byChild.set(row.child_id, row);
      if (row.profile_id) byProfile.set(row.profile_id, row);
    }
    return { byChildId: byChild, byProfileId: byProfile };
  }, [query.data]);

  return {
    list: query.data ?? [],
    byChildId,
    byProfileId,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
