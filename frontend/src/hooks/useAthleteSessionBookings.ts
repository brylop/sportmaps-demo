import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchoolContext } from './useSchoolContext';
import { bffClient } from '@/lib/api/bffClient';

async function bff<T>(path: string, init?: RequestInit, childId?: string): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  let queryString = '';
  if (childId) {
    queryString = path.includes('?') ? `&child_id=${childId}` : `?child_id=${childId}`;
  }
  const fullPath = `/api/v1/session-bookings${path}${queryString}`;
  
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    return bffClient.request<T>(method as any, fullPath, body, init?.headers as any);
  }
  
  return bffClient.request<T>(method as any, fullPath, undefined, init?.headers as any);
}

export interface BookableSession {
  id: string;
  session_date: string;           // 'YYYY-MM-DD'
  start_time: string;             // 'HH:MM:SS'
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  available_spots: number;
  team: { id: string; name: string; sport: string };
  coach: { id: string; name: string; full_name?: string; specialty?: string } | null;
  enrollment_id: string | null;
  offering_id: string | null;
  sessions_left: number | null;   // null = ilimitado
  booking_status: 'open' | 'full' | 'already_booked' | 'no_credits';
  already_booked: boolean;
}

export interface MyBooking {
  id: string;
  status: 'confirmed' | 'attended' | 'cancelled' | 'no_show';
  booking_type: string;
  is_secondary: boolean;
  booked_at: string;
  reservation_date?: string; // Para secundarias
  start_time?: string;      // Para secundarias
  end_time?: string;        // Para secundarias
  facilities?: { id: string; name: string }; // Para secundarias
  enrollment_id: string;
  attendance_sessions?: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    finalized: boolean;
    school_staff: { id: string; full_name: string } | null;
  };
  enrollments?: {
    offering_plans: { name: string } | null;
    teams: { name: string } | null;
  };
}

export function useAvailableSessions(childId?: string) {
  const { schoolId } = useSchoolContext();
  return useQuery<{ sessions: BookableSession[] }>({
    queryKey: ['athlete-available-sessions', schoolId, childId],
    queryFn: () => bff('/athlete/available', undefined, childId),
    staleTime: 0,
    refetchInterval: 30_000,
    enabled: !!schoolId,
  });
}

export function useUpcomingSessions(childId?: string) {
  const { schoolId } = useSchoolContext();
  return useQuery<{ sessions: BookableSession[] }>({
    queryKey: ['athlete-upcoming-sessions', schoolId, childId],
    queryFn: () => bff('/athlete/upcoming', undefined, childId),
    staleTime: 60_000,
    enabled: !!schoolId,
  });
}

export function useMyBookings(childId?: string) {
  const { schoolId } = useSchoolContext();
  return useQuery<MyBooking[]>({
    queryKey: ['athlete-my-bookings', schoolId, childId],
    queryFn: () => bff('/athlete/my-bookings', undefined, childId),
    staleTime: 30_000,
    enabled: !!schoolId,
  });
}

export function useMySecondaryBookings(childId?: string) {
  const { schoolId } = useSchoolContext();
  return useQuery<MyBooking[]>({
    queryKey: ['athlete-my-secondary-bookings', schoolId, childId],
    queryFn: () => bff('/athlete/secondary-bookings', undefined, childId),
    staleTime: 30_000,
    enabled: !!schoolId,
  });
}

export function useFacilitySlots(facilityId: string, date: string | null, childId?: string) {
  const { schoolId } = useSchoolContext();
  return useQuery<{ slots: { start: string; end: string; available: boolean; already_booked: boolean }[]; facility_name: string }>({
    queryKey: ['facility-slots', facilityId, date, schoolId, childId],
    queryFn: () => bff(`/facility/${facilityId}/slots?date=${date}`, undefined, childId),
    enabled: !!date && !!facilityId && !!schoolId,
    staleTime: 30_000,
  });
}

export function useBookSession(childId?: string) {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (payload: { session_id: string; enrollment_id: string }) =>
      bff('/athlete/book-session', { method: 'POST', body: JSON.stringify({ ...payload, child_id: childId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-upcoming-sessions', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-my-bookings', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId, childId] });
    },
  });
}

export function useBookSecondarySession(childId?: string) {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (payload: { 
      enrollment_id: string; 
      facility_id: string; 
      reservation_date: string; 
      slots: { start_time: string; end_time: string }[];
      notes?: string;
    }) =>
      bff('/athlete/book-secondary', { method: 'POST', body: JSON.stringify({ ...payload, child_id: childId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-my-secondary-bookings', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId, childId] });
    },
  });
}

export function useCancelBooking(childId?: string) {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (bookingId: string) =>
      bff(`/athlete/cancel-booking?booking_id=${bookingId}${childId ? `&child_id=${childId}` : ''}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-upcoming-sessions', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-my-bookings', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId, childId] });
    },
  });
}

export function useCancelSecondaryBooking(childId?: string) {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (bookingId: string) =>
      bff(`/athlete/cancel-secondary?booking_id=${bookingId}${childId ? `&child_id=${childId}` : ''}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-my-secondary-bookings', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions', schoolId, childId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId, childId] });
    },
  });
}
export function useAthleteFacilities(childId?: string) {
  return useQuery({
    queryKey: ['athlete-facilities', childId],
    queryFn: () => bff<{ facilities: { id: string; name: string; type: string; school_id: string }[] }>('/athlete/facilities', undefined, childId),
    staleTime: 5 * 60 * 1000,
  });
}
