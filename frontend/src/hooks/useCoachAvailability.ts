import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CoachAvailability {
  id: string;
  school_id: string;
  coach_id: string;
  day_of_week: number; // 0=Lunes, 1=Martes, ..., 6=Domingo
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  available_for_group_classes: boolean;
  available_for_personal_classes: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoachAvailabilityInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  available_for_group_classes: boolean;
  available_for_personal_classes: boolean;
}

export function useCoachAvailability(coachId: string, schoolId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch disponibilidad del entrenador
  const { data: availability = [], isLoading, error, refetch } = useQuery({
    queryKey: ['coach-availability', coachId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('coach_availability')
        .select('*')
        .eq('coach_id', coachId)
        .eq('school_id', schoolId)
        .order('day_of_week, start_time');

      if (error) throw error;
      return data as CoachAvailability[];
    },
    enabled: !!coachId && !!schoolId,
  });

  // Crear disponibilidad
  const createMutation = useMutation({
    mutationFn: async (input: CoachAvailabilityInput) => {
      const { data, error } = await (supabase as any)
        .from('coach_availability')
        .insert({
          school_id: schoolId,
          coach_id: coachId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-availability', coachId] });
      toast({
        title: '✅ Horario agregado',
        description: 'La disponibilidad se guardó correctamente',
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

  // Actualizar disponibilidad
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: CoachAvailabilityInput & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['coach-availability', coachId] });
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

  // Eliminar disponibilidad
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('coach_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-availability', coachId] });
      toast({
        title: '✅ Horario eliminado',
        description: 'La disponibilidad se removió correctamente',
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

  return {
    availability,
    isLoading,
    error,
    refetch,
    createAvailability: createMutation.mutate,
    updateAvailability: updateMutation.mutate,
    deleteAvailability: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
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
