import { useQuery } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from '@/hooks/useSchoolContext';

export type PlanStatus = 'active' | 'expiring_soon' | 'exhausted' | 'expired' | 'no_plan';

export interface PlanData {
    enrollmentId: string;
    planName: string | null;
    offeringName: string | null;
    offeringType: string | null;
    sport: string | null;
    sessionsUsed: number;
    sessionsMax: number | null;
    secondaryUsed: number;
    secondaryMax: number;
    percentUsed: number | null;
    status: PlanStatus;
    daysLeft: number | null;
    sessionsRemaining: number | null;
    expiresAt: string | null;
    teamName: string | null;
    teamId: string | null;
}

interface UseMyPlanResult {
    plans: PlanData[];
    activePlan: PlanData | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Hook para obtener el plan activo del atleta o de un hijo.
 * Consume GET /api/v1/enrollments/my-plan
 *
 * @param childId - ID del hijo (si el padre consulta). Omitir para atleta adulto.
 */
export function useMyPlan(childId?: string): UseMyPlanResult {
    const { schoolId } = useSchoolContext();

    const query = useQuery({
        queryKey: ['my-plan', schoolId, childId ?? 'self'],
        queryFn: async () => {
            const params = childId ? `?child_id=${childId}` : '';
            const res = await bffClient.get<{ enrollments: Record<string, unknown>[] }>(
                `/api/v1/enrollments/my-plan${params}`
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return res.enrollments.map((e: any): PlanData => ({
                enrollmentId: e.id,
                planName: e.offering_plan?.name ?? null,
                offeringName: e.offering?.name ?? null,
                offeringType: e.offering?.offering_type ?? null,
                sport: e.offering?.sport ?? e.team?.sport ?? null,
                sessionsUsed: e.sessions_used ?? 0,
                sessionsMax: e.offering_plan?.max_sessions ?? null,
                secondaryUsed: e.secondary_sessions_used ?? 0,
                secondaryMax: e.offering_plan?.max_secondary_sessions ?? 0,
                percentUsed: e.computed?.percent_used ?? null,
                status: (e.computed?.plan_status as PlanStatus) ?? 'no_plan',
                daysLeft: e.computed?.days_left ?? null,
                sessionsRemaining: e.computed?.sessions_remaining ?? null,
                expiresAt: e.expires_at,
                teamName: e.team?.name ?? null,
                teamId: e.team_id ?? null,
            }));
        },
        enabled: !!schoolId,
        staleTime: 2 * 60 * 1000,
    });

    const plans = query.data ?? [];

    return {
        plans,
        activePlan: plans.find((p) => p.status === 'active' || p.status === 'expiring_soon') ?? plans[0] ?? null,
        isLoading: query.isLoading,
        error: query.error as Error | null,
        refetch: query.refetch,
    };
}
