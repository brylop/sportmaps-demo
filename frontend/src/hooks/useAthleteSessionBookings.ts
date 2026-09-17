import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSchoolContext } from './useSchoolContext';
import { bffClient } from '@/lib/api/bffClient';
import { useAuth } from '@/contexts/AuthContext';

async function bff<T>(
  path: string,
  init?: RequestInit,
  childId?: string,
  branchId?: string | null,
): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const params: string[] = [];
  if (childId) params.push(`child_id=${childId}`);
  if (branchId) params.push(`branch_id=${branchId}`);
  let queryString = '';
  if (params.length > 0) {
    queryString = (path.includes('?') ? '&' : '?') + params.join('&');
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
  school_id?: string | null;
  sessions_left: number | null;   // null = ilimitado
  booking_status: 'open' | 'full' | 'already_booked' | 'no_credits';
  already_booked: boolean;
  school_type?: string;
  // Piloto "agendamiento flexible de banco de horas": presentes solo cuando
  // la escuela tiene el flag y el plan es de horas — de default_minutes
  // hasta max_bookable_minutes se puede pedir una sesión personalizada.
  default_minutes?: number;
  max_bookable_minutes?: number;
  available_for_personal_classes?: boolean;
  available_for_group_classes?: boolean;
}

// Piloto "agendamiento flexible de banco de horas" — modo "Por bloque": el
// backend genera un candidato por CADA hora de inicio posible (necesario
// para que "Personalizada" pueda arrancar en cualquier hora y desde ahí
// extender la duración), así que acá se colapsa esa misma lista a bloques
// fijos sin solapar (05-07, 07-09, 09-11...) para la vista "Por bloque".
// Solo toca sesiones del piloto (traen default_minutes) — el resto
// (grupales/personales normales fuera del piloto) queda intacto, cada hora
// sigue siendo su propia tarjeta. Compartido entre "Mis Inscripciones" y el
// link público de agendamiento — el mismo criterio en los dos lugares.
export function collapseOverlappingBlocks<T extends Pick<BookableSession, 'start_time' | 'end_time' | 'default_minutes' | 'coach' | 'available_for_personal_classes'>>(sessions: T[]): T[] {
  const flexible = sessions.filter(s => s.default_minutes != null);
  const rest = sessions.filter(s => s.default_minutes == null);

  const byGroup: Record<string, T[]> = {};
  flexible.forEach(s => {
    const type = s.available_for_personal_classes ? 'p' : 'g';
    const key = `${s.coach?.id ?? ''}_${type}`;
    (byGroup[key] ??= []).push(s);
  });

  const collapsed: T[] = [];
  Object.values(byGroup).forEach(group => {
    const sorted = [...group].sort((a, b) => a.start_time.localeCompare(b.start_time));
    let cursorEnd: string | null = null;
    sorted.forEach(s => {
      if (cursorEnd === null || s.start_time >= cursorEnd) {
        collapsed.push(s);
        cursorEnd = s.end_time;
      }
    });
  });

  return [...rest, ...collapsed];
}

// Piloto "agendamiento flexible de banco de horas" — sesión personalizada:
// grilla de horas ATÓMICAS reales (no los bloques ya armados de
// BookableSession) para que el usuario pueda tocar horas sueltas
// consecutivas y armar su propio bloque de 3h, 4h, etc.
export interface FlexibleHourGridGroup {
  enrollment_id: string;
  school_id: string;
  coach_id: string;
  coach: { id: string; full_name: string } | null;
  session_date: string;
  kind: 'personal' | 'group';
  default_minutes: number;
  hours: { avail_id: string; start_time: string; end_time: string; busy: boolean }[];
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
  school_id?: string | null;
  school_type?: string;
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
  session_type?: 'personal' | 'group';
}

export function useAvailableSessions(childId?: string) {
  const { schoolId, activeBranchId } = useSchoolContext();
  const { user } = useAuth();
  return useQuery<{ sessions: BookableSession[]; flexible_hour_grid?: FlexibleHourGridGroup[] }>({
    queryKey: ['athlete-available-sessions', schoolId, activeBranchId, childId],
    queryFn: () => bff('/athlete/available', undefined, childId, activeBranchId),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!schoolId && !!user?.id,
  });
}

export function useUpcomingSessions(childId?: string) {
  const { schoolId, activeBranchId } = useSchoolContext();
  const { user } = useAuth();
  return useQuery<{ sessions: BookableSession[] }>({
    queryKey: ['athlete-upcoming-sessions', schoolId, activeBranchId, childId],
    queryFn: () => bff('/athlete/upcoming', undefined, childId, activeBranchId),
    staleTime: 60_000,
    enabled: !!schoolId && !!user?.id,
  });
}

export function useMyBookings(childId?: string) {
  const { schoolId, activeBranchId } = useSchoolContext();
  const { user } = useAuth();
  return useQuery<MyBooking[]>({
    queryKey: ['athlete-my-bookings', schoolId, activeBranchId, childId],
    queryFn: () => bff('/athlete/my-bookings', undefined, childId, activeBranchId),
    staleTime: 60_000,
    enabled: !!schoolId && !!user?.id,
  });
}

export function useMySecondaryBookings(childId?: string) {
  const { schoolId, activeBranchId } = useSchoolContext();
  return useQuery<MyBooking[]>({
    queryKey: ['athlete-my-secondary-bookings', schoolId, activeBranchId, childId],
    queryFn: () => bff('/athlete/secondary-bookings', undefined, childId, activeBranchId),
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
  return useMutation({
    mutationFn: (payload: { session_id: string; enrollment_id: string; duration_minutes?: number }) =>
      bff('/athlete/book-session', { method: 'POST', body: JSON.stringify({ ...payload, child_id: childId }) }),
    onSuccess: () => {
      // Prefix-match so we invalidate every (schoolId, branchId, childId) variant.
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useBookSecondarySession(childId?: string) {
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ['athlete-my-secondary-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useCancelBooking(childId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      bff(`/athlete/cancel-booking?booking_id=${bookingId}${childId ? `&child_id=${childId}` : ''}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useCancelSecondaryBooking(childId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      bff(`/athlete/cancel-secondary?booking_id=${bookingId}${childId ? `&child_id=${childId}` : ''}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-my-secondary-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-available-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
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

// ─── PT Availability ──────────────────────────────────────────────────────────

export interface PTAvailabilitySlot {
  availability_id: string;
  session_date: string; // Nueva: para filtrar en el front
  start_time: string;
  end_time: string;
  available_for_personal_classes: boolean;
  available_for_group_classes: boolean;
  is_booked: boolean;
  is_my_booking: boolean;
  session_id: string | null;
  coach: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface PTAvailabilityResponse {
  date: string;
  slots: PTAvailabilitySlot[];
  sessions_left: number | null;
  trainer_id: string;
  enrollment_id: string;
  available_days?: number[];
}

export function usePTAvailability(enrollmentId: string, childId?: string) {
  return useQuery({
    queryKey: ['pt-availability', enrollmentId, childId],
    queryFn: () => bffClient.get<PTAvailabilityResponse>(`/api/v1/athlete/training/pt-availability?enrollment_id=${enrollmentId}${childId ? `&child_id=${childId}` : ''}`),
    enabled: !!enrollmentId,
    staleTime: 30 * 1000,
  });
}

/**
 * Prefetech data for PT availability to avoid lag when opening the modal
 */
export function prefetchPTAvailability(queryClient: any, enrollmentId: string, childId?: string) {
  return queryClient.prefetchQuery({
    queryKey: ['pt-availability', enrollmentId, childId],
    queryFn: () => bffClient.get<PTAvailabilityResponse>(`/api/v1/athlete/training/pt-availability?enrollment_id=${enrollmentId}${childId ? `&child_id=${childId}` : ''}`),
    staleTime: 30 * 1000,
  });
}

export function useBookPTSession(childId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { enrollment_id: string; session_date: string; session_time: string; notes?: string; session_type?: 'personal' | 'group' }) =>
      bffClient.post('/api/v1/athlete/training/book-pt-session', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['pt-availability'] });
      queryClient.invalidateQueries({ queryKey: ['training-today'] });
    },
  });
}

export function useCancelPTSession(childId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      bffClient.delete(`/api/v1/athlete/training/cancel-pt-session?plan_id=${planId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['pt-availability'] });
      queryClient.invalidateQueries({ queryKey: ['training-today'] });
    },
  });
}

export function useUpdatePTAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: 'completed' | 'assigned' }) =>
      bffClient.patch(`/api/v1/trainer/availability/session/${sessionId}/attendance`, { status }),
    onSuccess: () => {
      // Corregido: era 'trainer-schedule', la key real del componente es 'coach-pt-sessions'
      queryClient.invalidateQueries({ queryKey: ['coach-pt-sessions'] });
    },
  });
}

export function useHandleNoShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, action }: { sessionId: string; action: 'return_credit' | 'deduct' }) =>
      bffClient.patch(`/api/v1/trainer/availability/session/${sessionId}/no-show`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-pt-sessions'] });
    },
  });
}
