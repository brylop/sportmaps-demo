import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCompetitionResults,
  createCompetitionResult,
  updateCompetitionResult,
  deleteCompetitionResult,
  type NewCompetitionResult,
  type ResultType,
} from '@/lib/school/competitionResultsQueries';

export function useCompetitionResults(filters: { team_id?: string; result_type?: ResultType }) {
  return useQuery({
    queryKey: ['competition-results', filters],
    queryFn: () => getCompetitionResults(filters),
    enabled: !!filters.team_id,
  });
}

export function useCreateCompetitionResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCompetitionResult) => createCompetitionResult(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-results'] });
    },
  });
}

export function useUpdateCompetitionResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NewCompetitionResult> }) =>
      updateCompetitionResult(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-results'] });
    },
  });
}

export function useDeleteCompetitionResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompetitionResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-results'] });
    },
  });
}
