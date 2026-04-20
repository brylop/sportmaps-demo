import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';

export function useOfferingCoaches(offeringId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const key = ['offering-coaches', offeringId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => bffClient.get<{ assigned: any[]; available: any[] }>(
      `/api/v1/offerings/${offeringId}/coaches`
    ),
    enabled: !!offeringId,
  });

  const assign = useMutation({
    mutationFn: (coachId: string) =>
      bffClient.post(`/api/v1/offerings/${offeringId}/coaches`, { coachId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast({ title: '✅ Entrenador asignado al plan' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (assignmentId: string) =>
      bffClient.delete(`/api/v1/offerings/${offeringId}/coaches/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast({ title: '✅ Entrenador removido del plan' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return {
    assigned:  data?.assigned  ?? [],
    available: data?.available ?? [],
    isLoading,
    assign:    assign.mutate,
    remove:    remove.mutate,
    isAssigning: assign.isPending,
    isRemoving:  remove.isPending,
  };
}
