import { bffClient } from './bffClient';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface PollSession {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  confirmed_count?: number;
  team?: { id: string; name: string; sport: string };
  coach?: { id: string; full_name: string };
  session_bookings?: SessionBooking[];
}

export interface AttendancePoll {
  id: string;
  title: string;
  poll_date: string;
  status: 'open' | 'closed';
  school_id: string;
  created_at: string;
  created_by?: { id: string; full_name: string };
  attendance_sessions: PollSession[];
  school?: { id: string; name: string; logo_url?: string };
}

export interface SessionBooking {
  id: string;
  status: string;
  booked_at: string;
  booking_type: string;
  user?: { id: string; full_name: string; phone?: string; avatar_url?: string };
  unregistered?: { id: string; full_name: string; phone?: string };
  enrollment?: {
    id: string;
    status: string;
    offering_plan?: { id: string; name: string; max_sessions: number };
  };
}

export interface CreatePollPayload {
  title: string;
  poll_date: string;
  sessions: {
    title: string;
    start_time: string;
    end_time: string;
    max_capacity?: number;
    coach_id?: string;
    team_id?: string;
  }[];
}

export interface ConfirmAttendancePayload {
  session_id: string;
  // Registrado
  user_id?: string;
  enrollment_id?: string;
  // Invitado
  guest_name?: string;
  guest_phone?: string;
  poll_token?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export const pollsApi = {
  list: (filters?: { status?: string; date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date) params.append('date', filters.date);
    const queryString = params.toString();
    return bffClient.get<AttendancePoll[]>(`/api/v1/polls${queryString ? `?${queryString}` : ''}`);
  },

  getPublic: (pollId: string) =>
    bffClient.get<AttendancePoll>(`/api/v1/polls/${pollId}/public`, undefined, true),

  getResults: (pollId: string) =>
    bffClient.get<AttendancePoll>(`/api/v1/polls/${pollId}/results`),

  create: (payload: CreatePollPayload) =>
    bffClient.post<{ poll: AttendancePoll; sessions: PollSession[] }>('/api/v1/polls', payload),

  close: (pollId: string) =>
    bffClient.patch<AttendancePoll>(`/api/v1/polls/${pollId}/close`, {}),

  delete: (pollId: string) =>
    bffClient.delete(`/api/v1/polls/${pollId}`),

  confirmAttendance: (pollId: string, payload: ConfirmAttendancePayload) =>
    bffClient.post(`/api/v1/polls/${pollId}/confirm`, payload, undefined, true),

  addManualConfirmation: (
    pollId: string,
    sessionId: string,
    payload: { user_id?: string; enrollment_id?: string; guest_name?: string; guest_phone?: string }
  ) => bffClient.post(`/api/v1/polls/${pollId}/sessions/${sessionId}/confirmations`, payload),

  updateConfirmation: (
    pollId: string,
    sessionId: string,
    bookingId: string,
    payload: { status?: string; session_id?: string; correction_reason?: string }
  ) => bffClient.patch(`/api/v1/polls/${pollId}/sessions/${sessionId}/confirmations/${bookingId}`, payload),

  deleteConfirmation: (pollId: string, sessionId: string, bookingId: string) =>
    bffClient.delete(`/api/v1/polls/${pollId}/sessions/${sessionId}/confirmations/${bookingId}`),
};
