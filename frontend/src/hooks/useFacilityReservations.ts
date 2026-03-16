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

  const { data: reservations = [], isLoading } = useQuery<FacilityReservation[]>({
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

      // 2. Fetch reservations for those facilities
      const { data, error } = await supabase
        .from('facility_reservations')
        .select(`
          *,
          facility:facilities ( name, type, capacity ),
          requester:profiles!facility_reservations_user_id_fkey ( full_name, email )
        `)
        .in('facility_id', ids)
        .order('reservation_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data as any) as FacilityReservation[];
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

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: '✅ Reserva creada', description: 'La reserva fue registrada exitosamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al crear', description: error.message, variant: 'destructive' });
    },
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  const { mutateAsync: updateReservation, isPending: isUpdating } = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateReservationPayload }) => {
      const { data, error } = await supabase
        .from('facility_reservations')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: '✅ Reserva actualizada' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
    },
  });

  // ── QUICK STATUS HELPERS ──────────────────────────────────────────────────

  const approveReservation = async (id: string) => {
    if (!user) return;
    await updateReservation({
      id,
      payload: {
        status: 'confirmed',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      },
    });
    toast({ title: '✅ Reserva confirmada' });
  };

  const cancelReservation = async (id: string) => {
    await updateReservation({ id, payload: { status: 'cancelled' } });
    toast({ title: 'Reserva cancelada' });
  };

  const completeReservation = async (id: string) => {
    await updateReservation({ id, payload: { status: 'completed' } });
  };

  // ── DELETE (hard) — sólo aplica a registros propios o via admin ───────────

  const { mutateAsync: deleteReservation, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('facility_reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: 'Reserva eliminada', description: 'El registro fue removido permanentemente.' });
    },
    onError: (error: any) => {
      // Si RLS bloquea el DELETE directo, intentamos cancelar como fallback
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
