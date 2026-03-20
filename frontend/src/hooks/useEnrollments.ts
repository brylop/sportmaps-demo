import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from './useSchoolContext';
import { useToast } from '@/hooks/use-toast';

// ── Tipos que refleja el nuevo shape del BFF ─────────────────────────────────

export interface EnrollmentComputed {
  plan_status: 'active' | 'expired' | 'exhausted' | 'expiring_soon' | 'no_plan';
  percent_used: number | null;
  days_left: number | null;
  sessions_remaining: number | null;
}

export interface OfferingPlan {
  id: string;
  name: string;
  max_sessions: number | null;
  max_secondary_sessions: number;
  duration_days: number;
  price: number;
  offering_id: string | null;
}

export interface Offering {
  id: string;
  name: string;
  offering_type: string;
  sport: string;
}

export interface Team {
  id: string;
  name: string;
  sport: string;
  price_monthly: number | null;
}

// Shape exacto que devuelve GET /api/v1/enrollments/my-plan
export interface RawEnrollment {
  id: string;
  status: string;
  start_date: string;
  expires_at: string | null;
  sessions_used: number;
  secondary_sessions_used: number;
  // Plan
  offering_plan_id: string | null;
  offering_id: string | null;
  offering_plan: OfferingPlan | null;
  offering: Offering | null;
  // Equipo
  team_id: string | null;
  team: Team | null;
  // Precio ya resuelto por el BFF según el tipo
  price_monthly: number | null;
  currency: string;
  // Computed por el BFF
  computed: EnrollmentComputed;
}

// Shape normalizado que consumen TeamCard y PlanCard
export interface NormalizedEnrollment extends RawEnrollment {
  // Objeto unificado para el nombre/sport/school que usan las cards
  program: {
    id: string;
    name: string;
    sport: string;
    school_id?: string;
    school: { name: string; city: string };
  };
  // Solo presente en planes, null en equipos
  plan_details: {
    id: string;
    name: string;
    max_sessions: number | null;
    max_secondary_sessions: number;
    duration_days: number;
    price: number;
    secondary_session_label: string;
  } | null;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchMyPlan(childId?: string): Promise<{ enrollments: RawEnrollment[] }> {
  const url = childId
    ? `/api/v1/enrollments/my-plan?child_id=${childId}`
    : '/api/v1/enrollments/my-plan';
  return bffClient.request<{ enrollments: RawEnrollment[] }>('GET', url);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useEnrollments(childId?: string) {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['enrollments', schoolId, childId],
    queryFn: () => fetchMyPlan(childId),
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  const rawEnrollments = data?.enrollments ?? [];

  // ── Normalización — sin mezclar campos de team y plan ───────────────────
  const activeEnrollments: NormalizedEnrollment[] = rawEnrollments
    .filter(e => e.status === 'active')
    .map(e => {
      // ── Enrollment de PLAN ─────────────────────────────────────────────
      if (e.offering_plan_id && e.offering_plan) {
        return {
          ...e,
          program: {
            id: e.offering?.id ?? e.offering_plan.id,
            name: e.offering?.name ?? e.offering_plan.name,
            sport: e.offering?.sport ?? '',
            school: { name: '', city: '' },
          },
          plan_details: {
            id: e.offering_plan.id,
            name: e.offering_plan.name,
            max_sessions: e.offering_plan.max_sessions,
            max_secondary_sessions: e.offering_plan.max_secondary_sessions,
            duration_days: e.offering_plan.duration_days,
            price: e.offering_plan.price,
            // El BFF no devuelve metadata aún — valor por defecto
            secondary_session_label: 'GYM',
          },
        };
      }

      // ── Enrollment de EQUIPO ───────────────────────────────────────────
      return {
        ...e,
        program: {
          id: e.team?.id ?? e.team_id ?? '',
          name: e.team?.name ?? 'Equipo',
          sport: e.team?.sport ?? '',
          school: { name: '', city: '' },
        },
        plan_details: null,
      };
    });

  const pastEnrollments = rawEnrollments.filter(e => e.status !== 'active');

  // ── cancelEnrollment — pendiente de implementar desde el owner ───────────
  // Por ahora se deja sin exponer para no habilitar el flujo desde el atleta.
  // Se implementará en el módulo de gestión del owner en una iteración posterior.

  return {
    enrollments: rawEnrollments,
    activeEnrollments,
    pastEnrollments,
    loading,
    error,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId, childId] }),
  };
}