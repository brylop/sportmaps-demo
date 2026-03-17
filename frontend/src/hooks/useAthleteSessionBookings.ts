import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchoolContext } from './useSchoolContext';
import { bffClient } from '@/lib/api/bffClient';

async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const fullPath = `/api/v1/session-bookings${path}`;
  
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

export function useAvailableSessions() {
  const { schoolId } = useSchoolContext();
  return useQuery<{ sessions: BookableSession[] }>({
    queryKey: ['athlete-available-sessions', schoolId],
    queryFn: () => bff('/athlete/available'),
    staleTime: 60_000,
    enabled: !!schoolId,
  });
}

export function useUpcomingSessions() {
  const { schoolId } = useSchoolContext();
  return useQuery<{ sessions: BookableSession[] }>({
    queryKey: ['athlete-upcoming-sessions', schoolId],
    queryFn: () => bff('/athlete/upcoming'),
    staleTime: 60_000,
    enabled: !!schoolId,
  });
}

export function useMyBookings() {
  return useQuery<MyBooking[]>({
    queryKey: ['athlete-my-bookings'],
    queryFn: () => bff('/athlete/my-bookings'),
    staleTime: 30_000,
  });
}

export function useMySecondaryBookings() {
  return useQuery<MyBooking[]>({
    queryKey: ['athlete-my-secondary-bookings'],
    queryFn: () => bff('/athlete/secondary-bookings'),
    staleTime: 30_000,
  });
}

export function useFacilitySlots(facilityId: string, date: string | null) {
  const { schoolId } = useSchoolContext();
  return useQuery<{ slots: { start: string; end: string; available: boolean; already_booked: boolean }[]; facility_name: string }>({
    queryKey: ['facility-slots', facilityId, date, schoolId],
    queryFn: () => bff(`/facility/${facilityId}/slots?date=${date}`),
    enabled: !!date && !!facilityId && !!schoolId,
    staleTime: 30_000,
  });
}

export function useBookSession() {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (payload: { session_id: string; enrollment_id: string }) =>
      bff('/athlete/book-session', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-upcoming-sessions', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useBookSecondarySession() {
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
      bff('/athlete/book-secondary', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-my-secondary-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (bookingId: string) =>
      bff(`/athlete/${bookingId}/cancel`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-upcoming-sessions', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useCancelSecondaryBooking() {
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolContext();
  return useMutation({
    mutationFn: (bookingId: string) =>
      bff(`/athlete/secondary/${bookingId}/cancel`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-my-secondary-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}
export function useAthleteFacilities() {
  return useQuery({
    queryKey: ['athlete-facilities'],
    queryFn: () => bff<{ facilities: { id: string; name: string; type: string; school_id: string }[] }>('/athlete/facilities'),
    staleTime: 5 * 60 * 1000,
  });
}
