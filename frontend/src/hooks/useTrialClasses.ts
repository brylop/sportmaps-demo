import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrialClassStatus = 'agendada' | 'realizada' | 'no_show' | 'cancelada' | 'convertida';

export interface TrialClassCategory {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  /** Self-service (Mis Inscripciones): ¿permite agendar otra prueba después
   * de la primera, y a qué precio? Sin tope de veces — ver
   * docs/specs/mis-inscripciones-agenda-clases-prueba.md §3/§7. */
  allow_repeat: boolean;
  repeat_price: number | null;
}

export interface TrialClassCategoryPayload {
  name: string;
  description?: string;
  price: number;
  is_active?: boolean;
}

export interface TrialClassBooking {
  id: string;
  school_id: string;
  category_id: string;
  facility_id: string;
  coach_id: string;
  attendance_session_id: string | null;
  enrollment_id: string | null;
  unregistered_athlete_id: string | null;
  prospect_name: string;
  prospect_email: string;
  prospect_whatsapp: string;
  is_minor: boolean;
  child_name: string | null;
  scheduled_date: string;      // 'yyyy-MM-dd'
  start_time: string;          // 'HH:mm:ss'
  end_time: string;
  price_charged: number;
  status: TrialClassStatus;
  cancel_reason: string | null;
  confirmation_email_sent_at: string | null;
  whatsapp_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TrialClassSettings {
  school_id?: string;
  enabled: boolean;
  requires_approval: boolean;
}

export interface JointSlot {
  slot_date: string;
  slot_start_time: string;
  slot_end_time: string;
  facility_availability_id: string;
  coach_availability_id: string;
}

export interface CreateTrialBookingPayload {
  category_id: string;
  facility_availability_id: string;
  coach_availability_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  prospect_name: string;
  prospect_email: string;
  prospect_whatsapp: string;
  is_minor?: boolean;
  child_name?: string;
}

export interface CreateTrialBookingResponse {
  id: string;
  whatsapp_message: string;
  whatsapp_link: string;
  email_sent: boolean;
}

/** Devuelto al cancelar o reprogramar — mismo patrón de aviso que al crear. */
export interface BookingChangeNotice {
  success: boolean;
  email_sent?: boolean;
  whatsapp_message?: string;
  whatsapp_link?: string;
}

export interface RescheduleTrialBookingPayload {
  id: string;
  facility_availability_id: string;
  coach_availability_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrialClasses(filters?: { status?: TrialClassStatus; from?: string; to?: string }) {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const LIST_KEY = ['trial-class-bookings', schoolId, filters];
  const SETTINGS_KEY = ['trial-class-settings', schoolId];
  const CATEGORIES_KEY = ['trial-class-categories', schoolId];

  const { data: bookings = [], isLoading, isFetching, refetch } = useQuery<TrialClassBooking[]>({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      const qs = params.toString();
      return bffClient.get<TrialClassBooking[]>(`/api/v1/trial-classes${qs ? `?${qs}` : ''}`);
    },
    enabled: !!schoolId,
  });

  const { data: settings } = useQuery<TrialClassSettings>({
    queryKey: SETTINGS_KEY,
    queryFn: () => bffClient.get<TrialClassSettings>('/api/v1/trial-classes/settings'),
    enabled: !!schoolId,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<TrialClassCategory[]>({
    queryKey: CATEGORIES_KEY,
    queryFn: () => bffClient.get<TrialClassCategory[]>('/api/v1/trial-classes/categories'),
    enabled: !!schoolId,
  });

  const { mutateAsync: saveSettings, isPending: isSavingSettings } = useMutation({
    mutationFn: (payload: TrialClassSettings) => bffClient.put('/api/v1/trial-classes/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast({ title: '✅ Configuración guardada' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    },
  });

  const getJointSlots = async (facilityId: string, coachId: string, from: string, to: string): Promise<JointSlot[]> => {
    const params = new URLSearchParams({ facilityId, coachId, from, to });
    return bffClient.get<JointSlot[]>(`/api/v1/trial-classes/slots?${params.toString()}`);
  };

  const { mutateAsync: createBooking, isPending: isCreating } = useMutation({
    mutationFn: (payload: CreateTrialBookingPayload) =>
      bffClient.post<CreateTrialBookingResponse>('/api/v1/trial-classes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-class-bookings', schoolId] });
      toast({ title: '✅ Clase de prueba agendada' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo agendar', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: ({ id, status, cancel_reason }: { id: string; status: TrialClassStatus; cancel_reason?: string }) =>
      bffClient.patch<BookingChangeNotice>(`/api/v1/trial-classes/${id}/status`, { status, cancel_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-class-bookings', schoolId] });
      toast({ title: '✅ Estado actualizado' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo actualizar', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: resendConfirmation, isPending: isResending } = useMutation({
    mutationFn: (id: string) => bffClient.post(`/api/v1/trial-classes/${id}/resend-confirmation`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-class-bookings', schoolId] });
      toast({ title: '✅ Correo reenviado' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo reenviar', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: rescheduleBooking, isPending: isRescheduling } = useMutation({
    mutationFn: (payload: RescheduleTrialBookingPayload) =>
      bffClient.patch<BookingChangeNotice>(`/api/v1/trial-classes/${payload.id}/reschedule`, {
        facility_availability_id: payload.facility_availability_id,
        coach_availability_id: payload.coach_availability_id,
        scheduled_date: payload.scheduled_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-class-bookings', schoolId] });
      toast({ title: '✅ Clase reprogramada' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo reprogramar', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: createCategory, isPending: isCreatingCategory } = useMutation({
    mutationFn: (payload: TrialClassCategoryPayload) =>
      bffClient.post<{ id: string }>('/api/v1/trial-classes/categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      toast({ title: '✅ Categoría creada' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo crear la categoría', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: updateCategory, isPending: isUpdatingCategory } = useMutation({
    mutationFn: ({ id, ...payload }: TrialClassCategoryPayload & { id: string }) =>
      bffClient.put<{ id: string }>(`/api/v1/trial-classes/categories/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      toast({ title: '✅ Categoría actualizada' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo actualizar la categoría', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: setCategoryActive, isPending: isTogglingCategory } = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      bffClient.patch(`/api/v1/trial-classes/categories/${id}/active`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo actualizar la categoría', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: setCategoryRepeatPricing, isPending: isSavingRepeatPricing } = useMutation({
    mutationFn: ({ id, allow_repeat, repeat_price }: { id: string; allow_repeat: boolean; repeat_price: number | null }) =>
      bffClient.patch(`/api/v1/trial-classes/categories/${id}/repeat-pricing`, { allow_repeat, repeat_price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      toast({ title: '✅ Precio de repetición guardado' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
    },
  });

  const stats = {
    total: bookings.length,
    agendada: bookings.filter((b) => b.status === 'agendada').length,
    realizada: bookings.filter((b) => b.status === 'realizada').length,
    no_show: bookings.filter((b) => b.status === 'no_show').length,
    cancelada: bookings.filter((b) => b.status === 'cancelada').length,
    convertida: bookings.filter((b) => b.status === 'convertida').length,
  };

  return {
    bookings,
    isLoading,
    isFetching,
    refetch,
    stats,
    settings,
    saveSettings,
    isSavingSettings,
    getJointSlots,
    createBooking,
    isCreating,
    updateStatus,
    isUpdatingStatus,
    resendConfirmation,
    isResending,
    rescheduleBooking,
    isRescheduling,
    categories,
    isLoadingCategories,
    createCategory,
    isCreatingCategory,
    updateCategory,
    isUpdatingCategory,
    setCategoryActive,
    isTogglingCategory,
    setCategoryRepeatPricing,
    isSavingRepeatPricing,
  };
}
