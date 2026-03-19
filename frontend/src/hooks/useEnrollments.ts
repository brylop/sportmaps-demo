import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from './useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Enrollment {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  status: string;
  offering_plan_id: string | null;
  offering_id: string | null;           // ← AÑADIR
  secondary_sessions_used: number;      // ← AÑADIR
  created_at: string;
  updated_at: string;
}

async function fetchMyPlan() {
  return bffClient.request<{ enrollments: any[] }>('GET', '/api/v1/enrollments/my-plan');
}

export function useEnrollments() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['enrollments', schoolId],
    queryFn: fetchMyPlan,
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  const rawEnrollments = data?.enrollments ?? [];

  // Normaliza al shape que espera MyEnrollmentsPage (TeamCard / PlanCard)
  const activeEnrollments = rawEnrollments
    .filter((e: any) => e.status === 'active')
    .map((e: any) => ({
      ...e,
      // offering_id resuelto desde el BFF (offering_plans → offerings)
      offering_id: e.offering?.id ?? e.offering_plan?.offering_id ?? null,
      // Precio unificado desde el BFF
      price_monthly: e.price_monthly ?? e.offering_plan?.price ?? e.team?.price_monthly ?? null,
      currency: e.currency ?? 'COP',
      // Objeto program que usan TeamCard y PlanCard
      program: e.team
        ? {
            id:        e.team.id,
            name:      e.team.name,
            sport:     e.team.sport ?? '',
            school_id: e.school_id,
            school:    { name: '', city: '' },
          }
        : {
            id:        e.offering?.id ?? e.offering_plan_id,
            name:      e.offering?.name ?? e.offering_plan?.name ?? 'Plan',
            sport:     e.offering?.sport ?? '',
            school_id: e.school_id,
            school:    { name: '', city: '' },
          },
      // Objeto plan_details que usa PlanCard
      plan_details: e.offering_plan
        ? {
            ...e.offering_plan,
            price: e.offering_plan?.price,
            currency: e.offering_plan?.currency,
            secondary_session_label:
              e.offering_plan?.metadata?.secondary_session_label ?? 'GYM',
          }
        : null,
    }));

  const pastEnrollments = rawEnrollments.filter((e: any) => e.status !== 'active');

  const cancelEnrollment = async (enrollmentId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({
          status:   'cancelled',
          end_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      toast({
        title:       'Inscripción cancelada',
        description: 'La inscripción ha sido cancelada exitosamente',
      });

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId] });
      return { success: true };
    } catch (err: any) {
      toast({
        title:       'Error',
        description: 'No se pudo cancelar la inscripción',
        variant:     'destructive',
      });
      return { success: false, error: err };
    }
  };

  return {
    enrollments:       rawEnrollments,
    activeEnrollments,
    pastEnrollments,
    loading,
    error,
    refetch,
    cancelEnrollment,
  };
}
