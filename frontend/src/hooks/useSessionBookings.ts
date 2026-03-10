import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from '@/hooks/useSchoolContext';

export interface SessionAvailability {
    session_id: string;
    session_date: string;
    team_id: string;
    max_capacity: number | null;
    current_bookings: number;
    available_spots: number | null;
    requires_capacity_check: boolean;
    is_full: boolean;
    finalized: boolean;
}

export interface SessionBooking {
    id: string;
    status: 'confirmed' | 'cancelled' | 'attended' | 'no_show';
    booking_type: 'reservation' | 'drop_in' | 'walk_in';
    is_secondary: boolean;
    booked_at: string;
    cancelled_at: string | null;
    user_id: string | null;
    child_id: string | null;
    enrollment_id: string;
    person?: { id: string; full_name: string; avatar_url: string | null } | null;
    enrollment?: {
        id: string;
        sessions_used: number;
        secondary_sessions_used: number;
        plan?: {
            name: string;
            max_sessions: number | null;
            max_secondary_sessions: number;
        } | null;
    } | null;
}

export function useSessionAvailability(sessionId: string | null) {
    const { schoolId } = useSchoolContext();

    return useQuery({
        queryKey: ['session-availability', schoolId, sessionId],
        queryFn: () =>
            bffClient.get<SessionAvailability>(`/api/v1/sessions/${sessionId}/availability`),
        enabled: !!schoolId && !!sessionId,
        staleTime: 30 * 1000,
    });
}

export function useSessionBookings(sessionId: string | null) {
    const { schoolId } = useSchoolContext();

    return useQuery({
        queryKey: ['session-bookings', schoolId, sessionId],
        queryFn: () =>
            bffClient.get<{ bookings: SessionBooking[] }>(`/api/v1/sessions/${sessionId}/bookings`),
        enabled: !!schoolId && !!sessionId,
        staleTime: 30 * 1000,
    });
}

export function useMyBookings(childId?: string) {
    const { schoolId } = useSchoolContext();

    const params = childId ? `?child_id=${childId}` : '';

    return useQuery({
        queryKey: ['my-bookings', schoolId, childId ?? 'self'],
        queryFn: () =>
            bffClient.get<{ bookings: any[] }>(`/api/v1/sessions/my-bookings${params}`),
        enabled: !!schoolId,
        staleTime: 60 * 1000,
    });
}

export function useBookingMutations() {
    const queryClient = useQueryClient();
    const { schoolId } = useSchoolContext();

    const bookSession = useMutation({
        mutationFn: ({ sessionId, ...body }: {
            sessionId: string;
            enrollment_id: string;
            user_id?: string;
            child_id?: string;
            is_secondary?: boolean;
            booking_type?: 'reservation' | 'drop_in' | 'walk_in';
        }) => bffClient.post<{ booking: SessionBooking }>(
            `/api/v1/sessions/${sessionId}/book`,
            body
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['session-availability'] });
            queryClient.invalidateQueries({ queryKey: ['session-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-plan', schoolId] });
        },
    });

    const cancelBooking = useMutation({
        mutationFn: (bookingId: string) =>
            bffClient.delete<{ success: boolean }>(`/api/v1/sessions/bookings/${bookingId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['session-availability'] });
            queryClient.invalidateQueries({ queryKey: ['session-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
        },
    });

    return { bookSession, cancelBooking };
}
