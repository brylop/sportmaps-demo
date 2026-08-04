import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ResourceAvailability {
  id: string;
  school_id: string;
  coach_id?: string;       // presente solo si resourceType='coach'
  facility_id?: string;    // presente solo si resourceType='facility'
  day_of_week: number;
  start_time: string;
  end_time: string;
  available_for_group_classes?: boolean;    // solo aplica a coach
  available_for_personal_classes?: boolean; // solo aplica a coach
  max_group_capacity: number | null;
  created_at: string;
  updated_at: string;
}
export type CoachAvailability = ResourceAvailability; // alias retrocompatible

export interface ResourceAvailabilityInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  available_for_group_classes?: boolean;
  available_for_personal_classes?: boolean;
  max_group_capacity?: number | null;
}
export type CoachAvailabilityInput = ResourceAvailabilityInput;

export function useResourceAvailability(
  resourceType: 'coach' | 'facility',
  resourceId: string,
  schoolId: string,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const basePath = resourceType === 'coach'
    ? `/api/v1/school-staff/${resourceId}/availability`
    : `/api/v1/facilities/${resourceId}/availability`;
  const queryKey = [`${resourceType}-availability`, resourceId];

  const { data: availability = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { bffClient } = await import('@/lib/api/bffClient');
      return bffClient.get<ResourceAvailability[]>(basePath);
    },
    enabled: !!resourceId && !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: ResourceAvailabilityInput) => {
      const { bffClient } = await import('@/lib/api/bffClient');
      return bffClient.post<ResourceAvailability>(basePath, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: '✅ Horario guardado', description: 'La disponibilidad se guardó correctamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // updateMutation: se deja igual (va directo a supabase sobre coach_availability) — SOLO
  // aplica cuando resourceType='coach'. Si resourceType='facility' no se usa (el modal de
  // instalación no expone edición inline, solo crear/eliminar, igual que el patrón actual).
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: ResourceAvailabilityInput & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('coach_availability')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: '✅ Horario actualizado',
        description: 'Los cambios se guardaron correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { bffClient } = await import('@/lib/api/bffClient');
      return bffClient.delete(`${basePath}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: '✅ Horario eliminado', description: 'La disponibilidad se removió correctamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    availability, isLoading, error, refetch,
    createAvailability: createMutation.mutate,
    updateAvailability: updateMutation.mutate,
    deleteAvailability: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Alias retrocompatible — CoachPlansPage.tsx / TrainerAvailability.tsx siguen funcionando sin tocarlos
export function useCoachAvailability(coachId: string, schoolId: string) {
  return useResourceAvailability('coach', coachId, schoolId);
}
export function useFacilityAvailability(facilityId: string, schoolId: string) {
  return useResourceAvailability('facility', facilityId, schoolId);
}

// Agregar atleta a clase grupal
export async function addAthleteToGroupClass(
  availabilityId: string,
  athleteId: string,
  schoolId: string
) {
  const { data, error } = await (supabase as any)
    .from('group_class_athletes')
    .insert({
      coach_availability_id: availabilityId,
      athlete_id: athleteId,
      school_id: schoolId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Obtener atletas de una clase grupal
export async function getGroupClassAthletes(availabilityId: string) {
  const { data, error } = await (supabase as any)
    .from('group_class_athletes')
    .select('athlete_id, athletes:athlete_id(full_name)')
    .eq('coach_availability_id', availabilityId);

  if (error) throw error;
  return data || [];
}

// Remover atleta de clase grupal
export async function removeAthleteFromGroupClass(id: string) {
  const { error } = await (supabase as any)
    .from('group_class_athletes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
