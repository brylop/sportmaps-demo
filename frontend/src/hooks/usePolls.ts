import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pollsApi, CreatePollPayload, ConfirmAttendancePayload } from '../lib/api/polls.api';
import { useSchoolContext } from './useSchoolContext';
import { toast } from 'sonner';

const POLLS_KEY = 'attendance-polls';

// ── Lista de polls ────────────────────────────────────────────────────────────
export function usePolls(filters?: { status?: string; date?: string }) {
  const { schoolId } = useSchoolContext();
  return useQuery({
    queryKey: [POLLS_KEY, schoolId, filters],
    queryFn:  () => pollsApi.list(filters),
    enabled:  !!schoolId,
  });
}

// ── Poll público (sin auth) ───────────────────────────────────────────────────
export function usePublicPoll(pollId: string) {
  return useQuery({
    queryKey: [POLLS_KEY, 'public', pollId],
    queryFn:  () => pollsApi.getPublic(pollId),
    enabled:  !!pollId,
    retry:    1,
  });
}

// ── Resultados del poll (admin/coach) ─────────────────────────────────────────
export function usePollResults(pollId: string) {
  const { schoolId } = useSchoolContext();
  return useQuery({
    queryKey: [POLLS_KEY, 'results', pollId],
    queryFn:  () => pollsApi.getResults(pollId),
    enabled:  !!pollId && !!schoolId,
  });
}

// ── Crear poll ────────────────────────────────────────────────────────────────
export function useCreatePoll() {
  const qc = useQueryClient();
  const { schoolId } = useSchoolContext();

  return useMutation({
    mutationFn: (payload: CreatePollPayload) => pollsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POLLS_KEY, schoolId] });
      toast.success('Poll creado correctamente');
    },
    onError: () => toast.error('Error al crear el poll'),
  });
}

// ── Cerrar poll ───────────────────────────────────────────────────────────────
export function useClosePoll() {
  const qc = useQueryClient();
  const { schoolId } = useSchoolContext();

  return useMutation({
    mutationFn: (pollId: string) => pollsApi.close(pollId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POLLS_KEY, schoolId] });
      toast.success('Poll cerrado');
    },
    onError: () => toast.error('Error al cerrar el poll'),
  });
}

// ── Eliminar poll ─────────────────────────────────────────────────────────────
export function useDeletePoll() {
  const qc = useQueryClient();
  const { schoolId } = useSchoolContext();

  return useMutation({
    mutationFn: (pollId: string) => pollsApi.delete(pollId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POLLS_KEY, schoolId] });
      toast.success('Poll eliminado');
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se puede eliminar un poll con confirmaciones'),
  });
}

// ── Confirmar asistencia (público) ────────────────────────────────────────────
export function useConfirmAttendance(pollId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConfirmAttendancePayload) =>
      pollsApi.confirmAttendance(pollId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POLLS_KEY, 'public', pollId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Error al confirmar asistencia'),
  });
}

// ── Agregar confirmación manual (admin/coach) ─────────────────────────────────
export function useAddManualConfirmation(pollId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, ...payload }: {
      sessionId: string;
      user_id?: string;
      enrollment_id?: string;
      guest_name?: string;
      guest_phone?: string;
    }) => pollsApi.addManualConfirmation(pollId, sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POLLS_KEY, 'results', pollId] });
      toast.success('Atleta agregado a la clase');
    },
    onError: () => toast.error('Error al agregar atleta'),
  });
}

// ── Eliminar confirmación ─────────────────────────────────────────────────────
export function useDeleteConfirmation(pollId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, bookingId }: { sessionId: string; bookingId: string }) =>
      pollsApi.deleteConfirmation(pollId, sessionId, bookingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POLLS_KEY, 'results', pollId] });
      toast.success('Confirmación eliminada');
    },
    onError: () => toast.error('Error al eliminar confirmación'),
  });
}
