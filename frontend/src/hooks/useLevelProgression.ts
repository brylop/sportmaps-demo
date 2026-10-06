import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import {
  createIndividualResult,
  getEligibility,
  getLevelProgressionSettings,
  getProgressionAthletes,
  setLevelProgressionEnabled,
  type NewIndividualResult,
} from '@/lib/school/levelProgression';

/** ¿La escuela tiene la progresión por puntaje? (school_settings.level_progression_enabled) */
export function useLevelProgressionEnabled() {
  const { schoolId } = useSchoolContext();
  const q = useQuery({
    queryKey: ['level-progression-settings', schoolId],
    queryFn: getLevelProgressionSettings,
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return { enabled: !!q.data?.level_progression_enabled, isLoading: q.isLoading };
}

export function useSetLevelProgressionEnabled() {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (enabled: boolean) => setLevelProgressionEnabled(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['level-progression-settings', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['level-progression-eligibility'] });
    },
  });
}

export function useProgressionAthletes(enabled: boolean) {
  const { schoolId } = useSchoolContext();
  return useQuery({
    queryKey: ['level-progression-athletes', schoolId],
    queryFn: getProgressionAthletes,
    enabled: enabled && !!schoolId,
    staleTime: 60 * 1000,
  });
}

export function useLevelEligibility(season: number, enabled: boolean) {
  const { schoolId } = useSchoolContext();
  return useQuery({
    queryKey: ['level-progression-eligibility', schoolId, season],
    queryFn: () => getEligibility(season),
    enabled: enabled && !!schoolId,
    retry: false,
  });
}

export function useCreateIndividualResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewIndividualResult) => createIndividualResult(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-results'] });
      queryClient.invalidateQueries({ queryKey: ['level-progression-eligibility'] });
    },
  });
}
