import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSchoolPerformanceMetrics,
  getSchoolPerformanceEntries,
  postPerformanceEntries,
  updatePerformanceEntry,
  deletePerformanceEntry,
  getSubjectPerformanceEvolution,
  getAthletePerformanceEntries,
  getAthletePerformanceEvolution,
  getTeamPerformanceRoster,
  type NewPerformanceEntry,
} from '@/lib/school/performanceQueries';

export function useTeamPerformanceRoster(params: { team_id?: string; offering_plan_id?: string }) {
  return useQuery({
    queryKey: ['team-performance-roster', params.team_id, params.offering_plan_id],
    queryFn: () => getTeamPerformanceRoster(params),
    enabled: !!(params.team_id || params.offering_plan_id),
  });
}

// ─── Escuela / Coach ──────────────────────────────────────────────────

export function useSchoolPerformanceMetrics() {
  return useQuery({
    queryKey: ['school-performance-metrics'],
    queryFn: getSchoolPerformanceMetrics,
    staleTime: 1000 * 60 * 10, // 10 min — el catálogo casi no cambia
  });
}

export function useSchoolPerformanceEntries(filters: {
  subject_type?: string;
  subject_id?: string;
  metric_key?: string;
  from_date?: string;
  to_date?: string;
}) {
  return useQuery({
    queryKey: ['school-performance-entries', filters],
    queryFn: () => getSchoolPerformanceEntries(filters),
    enabled: !!filters.subject_id, // no dispara hasta tener un sujeto seleccionado
  });
}

export function useSubjectPerformanceEvolution(subjectType?: string, subjectId?: string, days = 365) {
  return useQuery({
    queryKey: ['subject-performance-evolution', subjectType, subjectId, days],
    queryFn: () => getSubjectPerformanceEvolution(subjectType!, subjectId!, days),
    enabled: !!subjectType && !!subjectId,
  });
}

export function useCreatePerformanceEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entries, teamId }: { entries: NewPerformanceEntry[]; teamId?: string }) =>
      postPerformanceEntries(entries, teamId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['school-performance-entries'] });
      queryClient.invalidateQueries({ queryKey: ['team-performance-roster'] });
      const subjectId = variables.entries[0]?.subject_id;
      if (subjectId) {
        queryClient.invalidateQueries({ queryKey: ['subject-performance-evolution'] });
      }
    },
  });
}

export function useUpdatePerformanceEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { value?: number; notes?: string; recorded_at?: string } }) =>
      updatePerformanceEntry(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-performance-entries'] });
      queryClient.invalidateQueries({ queryKey: ['subject-performance-evolution'] });
    },
  });
}

export function useDeletePerformanceEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePerformanceEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-performance-entries'] });
      queryClient.invalidateQueries({ queryKey: ['subject-performance-evolution'] });
    },
  });
}

// ─── Atleta / Padre ───────────────────────────────────────────────────

export function useAthletePerformanceEntries(childId?: string) {
  return useQuery({
    queryKey: ['athlete-performance-entries', childId ?? 'self'],
    queryFn: () => getAthletePerformanceEntries(childId),
  });
}

export function useAthletePerformanceEvolution(childId?: string, days = 365) {
  return useQuery({
    queryKey: ['athlete-performance-evolution', childId ?? 'self', days],
    queryFn: () => getAthletePerformanceEvolution(childId, days),
  });
}
