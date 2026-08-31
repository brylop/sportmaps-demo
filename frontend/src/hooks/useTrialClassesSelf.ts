import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';

// ─── Types ────────────────────────────────────────────────────────────────────
// Hermano de useTrialClasses.ts (owner), pero para el lado del padre/atleta
// en Mis Inscripciones. Ver docs/specs/mis-inscripciones-agenda-clases-prueba.md.

export type TrialPaymentMode = 'gateway' | 'manual' | 'en_sede';

export interface TrialSelfServiceSettings {
  school_id?: string;
  enabled: boolean;
  self_service_enabled: boolean;
  reschedule_cutoff_hours: number;
  payment_mode: TrialPaymentMode;
}

export interface TrialSelfCategory {
  id: string;
  name: string;
  description: string | null;
  price: number;
  /** Precio de repetición — vive en la categoría, no en la escuela (spec §3). */
  allow_repeat: boolean;
  repeat_price: number | null;
}

export interface TrialSelfJointSlot {
  slot_date: string;
  slot_start_time: string;
  slot_end_time: string;
  facility_availability_id: string;
  coach_availability_id: string;
}

export interface TrialSelfBooking {
  id: string;
  category_id: string;
  facility_id: string;
  coach_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  price_charged: number;
  status: 'agendada' | 'realizada' | 'no_show' | 'cancelada' | 'convertida';
  child_id: string | null;
  user_id: string | null;
  unregistered_athlete_id: string | null;
  prospect_name: string;
  is_minor: boolean;
  child_name: string | null;
}

/** Sujeto de la reserva — exactamente uno de los tres (spec §3.1). */
export type TrialSelfSubject =
  | { kind: 'child'; child_id: string }
  | { kind: 'self' }
  | { kind: 'new_sibling'; prospect_name: string; prospect_email: string; prospect_whatsapp: string; prospect_dob?: string };

export interface CreateTrialSelfPayload {
  category_id: string;
  facility_availability_id: string;
  coach_availability_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  subject: TrialSelfSubject;
}

export interface CreateTrialSelfResponse {
  id: string;
  price: number;
  is_first: boolean;
  payment_mode: TrialPaymentMode;
  email_sent: boolean;
}

function subjectToBody(subject: TrialSelfSubject) {
  if (subject.kind === 'child') return { child_id: subject.child_id };
  if (subject.kind === 'self') return { self: true };
  return {
    prospect_name: subject.prospect_name,
    prospect_email: subject.prospect_email,
    prospect_whatsapp: subject.prospect_whatsapp,
    prospect_dob: subject.prospect_dob,
  };
}

// ─── Hook: ajustes (owner/admin) ───────────────────────────────────────────────

export function useTrialClassSelfServiceSettings() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const KEY = ['trial-class-self-service-settings', schoolId];

  const { data: settings, isLoading } = useQuery<TrialSelfServiceSettings>({
    queryKey: KEY,
    queryFn: () => bffClient.get<TrialSelfServiceSettings>('/api/v1/trial-classes-self/settings'),
    enabled: !!schoolId,
  });

  const { mutateAsync: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: (payload: Omit<TrialSelfServiceSettings, 'school_id' | 'enabled'>) =>
      bffClient.put('/api/v1/trial-classes-self/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      toast({ title: '✅ Configuración de self-service guardada' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    },
  });

  return { settings, isLoading, saveSettings, isSaving };
}

// ─── Hook: agendamiento (padre/atleta) ─────────────────────────────────────────

export function useTrialClassesSelf() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const MY_BOOKINGS_KEY = ['trial-class-self-bookings', schoolId];
  const CATEGORIES_KEY = ['trial-class-self-categories', schoolId];

  const { data: myBookings = [], isLoading: isLoadingBookings } = useQuery<TrialSelfBooking[]>({
    queryKey: MY_BOOKINGS_KEY,
    queryFn: () => bffClient.get<TrialSelfBooking[]>('/api/v1/trial-classes-self'),
    enabled: !!schoolId,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<TrialSelfCategory[]>({
    queryKey: CATEGORIES_KEY,
    queryFn: () => bffClient.get<TrialSelfCategory[]>('/api/v1/trial-classes-self/categories'),
    enabled: !!schoolId,
  });

  // Solo hay algo que agendar si la escuela prendió el self-service Y tiene
  // al menos una categoría activa — evita mostrar el botón para una escuela
  // que todavía no configuró nada.
  const selfServiceAvailable = categories.length > 0;

  /** has_active_plan=true → esta persona ya es miembro (plan real, no de
   * prueba) en la escuela — no se le ofrece prueba, se la manda a agendar
   * desde su plan. Ver spec, decisión "validar plan antes de prueba". */
  const getEligibility = async (subject: { child_id: string } | { self: true }): Promise<{ isFirst: boolean; hasActivePlan: boolean }> => {
    const params = new URLSearchParams();
    if ('child_id' in subject) params.set('child_id', subject.child_id);
    else params.set('self', 'true');
    const { is_first, has_active_plan } = await bffClient.get<{ is_first: boolean; has_active_plan: boolean }>(`/api/v1/trial-classes-self/is-first?${params.toString()}`);
    return { isFirst: is_first, hasActivePlan: has_active_plan };
  };

  const getJointSlots = async (facilityId: string, coachId: string, from: string, to: string): Promise<TrialSelfJointSlot[]> => {
    const params = new URLSearchParams({ facilityId, coachId, from, to });
    return bffClient.get<TrialSelfJointSlot[]>(`/api/v1/trial-classes-self/slots?${params.toString()}`);
  };

  const { mutateAsync: createBooking, isPending: isCreating } = useMutation({
    mutationFn: (payload: CreateTrialSelfPayload) =>
      bffClient.post<CreateTrialSelfResponse>('/api/v1/trial-classes-self', {
        category_id: payload.category_id,
        facility_availability_id: payload.facility_availability_id,
        coach_availability_id: payload.coach_availability_id,
        scheduled_date: payload.scheduled_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        ...subjectToBody(payload.subject),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY });
      toast({ title: '✅ Clase de prueba agendada' });
    },
    onError: (error: any) => {
      // payment_period_conflict / too_late_to_reschedule llegan con prefijo
      // reconocible desde la RPC — se le puede dar un mensaje más específico
      // si hace falta más adelante; por ahora se muestra tal cual, ya es legible.
      toast({ title: 'No se pudo agendar', description: error.message, variant: 'destructive' });
    },
  });

  const { mutateAsync: rescheduleBooking, isPending: isRescheduling } = useMutation({
    mutationFn: (payload: { id: string; facility_availability_id: string; coach_availability_id: string; scheduled_date: string; start_time: string; end_time: string }) =>
      bffClient.patch(`/api/v1/trial-classes-self/${payload.id}/reschedule`, {
        facility_availability_id: payload.facility_availability_id,
        coach_availability_id: payload.coach_availability_id,
        scheduled_date: payload.scheduled_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY });
      toast({ title: '✅ Clase reprogramada' });
    },
    onError: (error: any) => {
      const tooLate = typeof error.message === 'string' && error.message.startsWith('too_late_to_reschedule');
      toast({
        title: tooLate ? 'Ya no se puede reprogramar sola' : 'No se pudo reprogramar',
        description: tooLate ? 'Quedan pocas horas para tu clase — contactá directamente a la escuela.' : error.message,
        variant: 'destructive',
      });
    },
  });

  const { mutateAsync: cancelBooking, isPending: isCanceling } = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      bffClient.patch(`/api/v1/trial-classes-self/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY });
      toast({ title: '✅ Clase de prueba cancelada' });
    },
    onError: (error: any) => {
      toast({ title: 'No se pudo cancelar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    myBookings,
    isLoadingBookings,
    categories,
    isLoadingCategories,
    selfServiceAvailable,
    getEligibility,
    getJointSlots,
    createBooking,
    isCreating,
    rescheduleBooking,
    isRescheduling,
    cancelBooking,
    isCanceling,
  };
}
