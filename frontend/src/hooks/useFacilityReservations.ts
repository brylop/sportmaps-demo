import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResvStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface FacilityReservation {
  id: string;
  facility_id: string;
  user_id: string;
  team_id: string | null;
  reservation_date: string;       // 'yyyy-MM-dd'
  start_time: string;             // 'HH:mm:ss'
  end_time: string;
  status: ResvStatus;
  price: number;
  participants: number;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  facility: { name: string; type: string; capacity: number } | null;
  requester: { full_name: string | null; email: string } | null;
  isSessionBooking?: boolean;
}

export interface CreateReservationPayload {
  facility_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  price: number;
  notes?: string;
  status?: ResvStatus;
}

export interface UpdateReservationPayload {
  facility_id?: string;
  reservation_date?: string;
  start_time?: string;
  end_time?: string;
  price?: number;
  notes?: string;
  status?: ResvStatus;
  approved_by?: string;
  approved_at?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFacilityReservations() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const QUERY_KEY = ['facility-reservations', schoolId];

  // ── READ ──────────────────────────────────────────────────────────────────

  const { data: reservations = [], isLoading, isFetching, refetch } = useQuery<FacilityReservation[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!schoolId) return [];

      // 1. Get facility IDs for this school
      const { data: facilityIds } = await supabase
        .from('facilities')
        .select('id')
        .eq('school_id', schoolId);

      if (!facilityIds || facilityIds.length === 0) return [];

      const ids = facilityIds.map(f => f.id);

      // 2. Fetch reservations from facility_reservations and session_bookings
      const [resvResult, sbResult] = await Promise.all([
        supabase
          .from('facility_reservations')
          .select(`
            *,
            facility:facilities ( name, type, capacity ),
            requester:profiles!facility_reservations_user_id_fkey ( full_name, email )
          `)
          .in('facility_id', ids),
        supabase
          .from('session_bookings')
          .select(`
            id,
            status,
            created_at,
            user_id,
            child_id,
            unregistered_athlete_id,
            unregistered_athlete:unregistered_athletes ( full_name, email, phone ),
            profile:profiles ( full_name, email ),
            child:children ( full_name ),
            session:attendance_sessions!inner (
              id,
              session_date,
              start_time,
              end_time,
              facility_id,
              facility:facilities ( id, name, type, capacity )
            )
          `)
          .eq('school_id', schoolId)
      ]);

      if (resvResult.error) throw resvResult.error;
      if (sbResult.error) {
        console.error('Error fetching session bookings in useFacilityReservations:', sbResult.error);
        throw sbResult.error;
      }

      // 3. Map session_bookings to the same FacilityReservation format
      const mappedSessionBookings: FacilityReservation[] = (sbResult.data || [])
        .filter((sb: any) => sb.session && sb.session.facility)
        .map((sb: any) => {
          let requesterName = 'Invitado';
          let requesterEmail = '—';
          
          if (sb.unregistered_athlete) {
            requesterName = sb.unregistered_athlete.full_name || 'Invitado';
            requesterEmail = sb.unregistered_athlete.email || '—';
          } else if (sb.child) {
            requesterName = sb.child.full_name;
            requesterEmail = sb.profile?.email || '—';
          } else if (sb.profile) {
            requesterName = sb.profile.full_name;
            requesterEmail = sb.profile.email || '—';
          }

          return {
            id: sb.id,
            facility_id: sb.session.facility.id,
            user_id: sb.user_id || sb.unregistered_athlete_id || '',
            team_id: null,
            reservation_date: sb.session.session_date,
            start_time: sb.session.start_time,
            end_time: sb.session.end_time,
            status: sb.status as ResvStatus,
            price: 0,
            participants: 1,
            notes: sb.unregistered_athlete ? 'Clase de cortesía (Invitado)' : 'Reserva de socio / plan',
            approved_by: null,
            approved_at: null,
            created_at: sb.created_at,
            updated_at: sb.created_at,
            facility: {
              name: sb.session.facility.name,
              type: sb.session.facility.type,
              capacity: sb.session.facility.capacity
            },
            requester: {
              full_name: requesterName,
              email: requesterEmail
            },
            isSessionBooking: true
          };
        });

      const merged = [
        ...((resvResult.data || []) as any[]),
        ...mappedSessionBookings
      ];

      // Sort by reservation_date desc, then start_time asc
      return merged.sort((a, b) => {
        const dateCompare = b.reservation_date.localeCompare(a.reservation_date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
    },
    enabled: !!schoolId,
  });

  // ── CREATE ────────────────────────────────────────────────────────────────

  const { mutateAsync: createReservation, isPending: isCreating } = useMutation({
    mutationFn: async (payload: CreateReservationPayload) => {
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('facility_reservations')
        .insert({
          ...payload,
          user_id: user.id,
          status: payload.status ?? 'confirmed',
        })
        .select()
        .single();

      if (error) {
        if (error.message?.includes('facility_slot_conflict')) {
          throw new Error('Ese horario ya está ocupado por otra reserva. Elige otro horario.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-roster'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-session'] });
      toast({ title: '✅ Reserva creada', description: 'La reserva fue registrada exitosamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al crear', description: error.message, variant: 'destructive' });
    },
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  const { mutateAsync: updateReservation, isPending: isUpdating } = useMutation({
    mutationFn: async ({ id, payload, isSessionBooking }: { id: string; payload: UpdateReservationPayload; isSessionBooking?: boolean }) => {
      if (isSessionBooking) {
        const { data, error } = await supabase
          .from('session_bookings')
          .update({
            status: payload.status,
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('facility_reservations')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.message?.includes('facility_slot_conflict')) {
          throw new Error('Ese horario ya está ocupado por otra reserva. Elige otro horario.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-roster'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-session'] });
      toast({ title: '✅ Reserva actualizada' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
    },
  });

  // ── QUICK STATUS HELPERS ──────────────────────────────────────────────────

  const approveReservation = async (id: string) => {
    if (!user) return;
    const isSessionBooking = reservations.find(r => r.id === id)?.isSessionBooking;
    await updateReservation({
      id,
      payload: {
        status: 'confirmed',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      },
      isSessionBooking
    });
  };

  const cancelReservation = async (id: string) => {
    const isSessionBooking = reservations.find(r => r.id === id)?.isSessionBooking;
    await updateReservation({ id, payload: { status: 'cancelled' }, isSessionBooking });
  };

  const completeReservation = async (id: string) => {
    const isSessionBooking = reservations.find(r => r.id === id)?.isSessionBooking;
    await updateReservation({ id, payload: { status: 'completed' }, isSessionBooking });
  };

  // ── DELETE (hard) — sólo aplica a registros propios o via admin ───────────

  const { mutateAsync: deleteReservation, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const isSessionBooking = reservations.find(r => r.id === id)?.isSessionBooking;
      if (isSessionBooking) {
        const { error } = await supabase
          .from('session_bookings')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('facility_reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-roster'] });
      queryClient.invalidateQueries({ queryKey: ['supervision-session'] });
      toast({ title: 'Reserva eliminada', description: 'El registro fue removido permanentemente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    },
  });

  // ── DERIVED ───────────────────────────────────────────────────────────────

  const stats = {
    total: reservations.length,
    confirmed: reservations.filter((r) => r.status === 'confirmed').length,
    pending: reservations.filter((r) => r.status === 'pending').length,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
    completed: reservations.filter((r) => r.status === 'completed').length,
  };

  // Fetch booked slots for a specific facility + date (used inside modals)
  const getBookedSlots = async (facilityId: string, date: Date, excludeId?: string) => {
    const { data } = await supabase
      .from('facility_reservations')
      .select('start_time, id')
      .eq('facility_id', facilityId)
      .eq('reservation_date', format(date, 'yyyy-MM-dd'))
      .in('status', ['pending', 'confirmed']);

    return (data ?? [])
      .filter((r) => r.id !== excludeId)
      .map((r) => r.start_time.slice(0, 5)); // 'HH:mm'
  };

  return {
    reservations,
    isLoading,
    isFetching,
    refetch,
    stats,
    // mutations
    createReservation,
    isCreating,
    updateReservation,
    isUpdating,
    deleteReservation,
    isDeleting,
    // helpers
    approveReservation,
    cancelReservation,
    completeReservation,
    getBookedSlots,
  };
}

