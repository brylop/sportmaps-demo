import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsApi, AttendancePoll, ConfirmAttendancePayload } from '@/lib/api/polls.api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { toast } from 'sonner';

// ── Queries ─────────────────────────────────────────────────────────────────

export function usePolls(filters?: { status?: string; date?: string }) {
  const { schoolId } = useSchoolContext();

  return useQuery({
    queryKey: ['polls', schoolId, filters],
    queryFn: () => pollsApi.list(filters),
    enabled: !!schoolId,
    staleTime: 30_000,
  });
}

export function usePublicPoll(pollId: string) {
  return useQuery({
    queryKey: ['poll-public', pollId],
    queryFn: () => pollsApi.getPublic(pollId),
    enabled: !!pollId,
    staleTime: 15_000,
  });
}

export function usePollResults(pollId: string) {
  const { schoolId } = useSchoolContext();

  return useQuery({
    queryKey: ['poll-results', schoolId, pollId],
    queryFn: () => pollsApi.getResults(pollId),
    enabled: !!schoolId && !!pollId,
    staleTime: 15_000,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

export function useCreatePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pollsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      toast.success('Encuesta creada');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al crear la encuesta');
    },
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pollId: string) => pollsApi.close(pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      queryClient.invalidateQueries({ queryKey: ['poll-results'] });
      toast.success('Encuesta cerrada');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al cerrar la encuesta');
    },
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pollId: string) => pollsApi.delete(pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      toast.success('Encuesta eliminada');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al eliminar. ¿Tiene confirmaciones?');
    },
  });
}

export function useConfirmAttendance(pollId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConfirmAttendancePayload) => pollsApi.confirmAttendance(pollId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll-public', pollId] });
      queryClient.invalidateQueries({ queryKey: ['poll-results'] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al confirmar asistencia');
    },
  });
}

export function useAddManualConfirmation(pollId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, ...payload }: {
      sessionId: string;
      user_id?: string;
      enrollment_id?: string;
      guest_name?: string;
      guest_phone?: string;
    }) => pollsApi.addManualConfirmation(pollId, sessionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll-results'] });
      toast.success('Asistencia registrada');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al registrar asistencia');
    },
  });
}

export function useDeleteConfirmation(pollId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, bookingId }: { sessionId: string; bookingId: string }) =>
      pollsApi.deleteConfirmation(pollId, sessionId, bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll-results'] });
      toast.success('Confirmación eliminada');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al eliminar confirmación');
    },
  });
}
