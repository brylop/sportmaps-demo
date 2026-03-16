import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from '@/hooks/useSchoolContext';

export interface Offering {
    id: string;
    school_id: string;
    branch_id: string | null;
    name: string;
    description: string | null;
    offering_type: 'membership' | 'session_pack' | 'court_booking' | 'tournament' | 'single_session';
    sport: string | null;
    is_active: boolean;
    sort_order: number;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    offering_plans?: OfferingPlan[];
}

export interface Enrollment {
    id: string;
    user_id: string;
    offering_plan_id: string;
    status: string;
    sessions_used: number;
    secondary_sessions_used: number;
    expires_at: string | null;
    profile?: {
        id: string;
        full_name: string;
        email: string;
    };
}

export interface OfferingPlan {
    id: string;
    offering_id: string;
    school_id: string;
    name: string;
    description: string | null;
    max_sessions: number | null;
    max_secondary_sessions: number;
    duration_days: number;
    auto_renew: boolean;
    price: number;
    currency: string;
    slot_duration_minutes: number | null;
    is_active: boolean;
    sort_order: number;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    enrollments?: Enrollment[];
}

export function useOfferings(type?: string) {
    const { schoolId } = useSchoolContext();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['offerings', schoolId, type],
        queryFn: async () => {
            const params = type ? `?type=${type}` : '';
            const res = await bffClient.get<{ offerings: Offering[] }>(
                `/api/v1/offerings${params}`
            );
            return res.offerings;
        },
        enabled: !!schoolId,
        staleTime: 5 * 60 * 1000,
    });

    const createOffering = useMutation({
        mutationFn: (data: Partial<Offering>) =>
            bffClient.post<{ offering: Offering }>('/api/v1/offerings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offerings', schoolId] });
        },
    });

    const updateOffering = useMutation({
        mutationFn: ({ id, ...data }: Partial<Offering> & { id: string }) =>
            bffClient.patch<{ offering: Offering }>(`/api/v1/offerings/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offerings', schoolId] });
        },
    });

    const deleteOffering = useMutation({
        mutationFn: (id: string) =>
            bffClient.delete<{ success: boolean }>(`/api/v1/offerings/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offerings', schoolId] });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            if (error?.status === 409) {
                console.warn('Offering con inscripciones activas:', error.message);
            }
        },
    });

    const createPlan = useMutation({
        mutationFn: ({ offeringId, ...data }: Partial<OfferingPlan> & { offeringId: string }) =>
            bffClient.post<{ plan: OfferingPlan }>(`/api/v1/offerings/${offeringId}/plans`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offerings', schoolId] });
        },
    });

    const updatePlan = useMutation({
        mutationFn: ({ offeringId, planId, ...data }: Partial<OfferingPlan> & { offeringId: string; planId: string }) =>
            bffClient.patch<{ plan: OfferingPlan }>(`/api/v1/offerings/${offeringId}/plans/${planId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offerings', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions'] });
        },
    });

    const deletePlan = useMutation({
        mutationFn: ({ offeringId, planId }: { offeringId: string; planId: string }) =>
            bffClient.delete<{ success: boolean }>(`/api/v1/offerings/${offeringId}/plans/${planId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['offerings', schoolId] });
        },
    });

    return {
        query,
        offerings: query.data ?? [],
        isLoading: query.isLoading,
        error: query.error,
        createOffering,
        updateOffering,
        deleteOffering,
        createPlan,
        updatePlan,
        deletePlan,
    };
}
