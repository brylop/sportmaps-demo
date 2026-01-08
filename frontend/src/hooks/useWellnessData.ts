import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface WellnessAppointment {
  id: string;
  professional_id: string;
  athlete_id: string | null;
  athlete_name: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  service_type: string;
  status: string;
  notes: string | null;
  is_demo: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface WellnessEvaluation {
  id: string;
  health_record_id: string | null;
  professional_id: string;
  athlete_id: string;
  evaluation_type: string;
  evaluation_date: string;
  metrics: Record<string, unknown>;
  score: number | null;
  recommendations: string | null;
  follow_up_date: string | null;
  status: string;
  is_demo: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface HealthRecord {
  id: string;
  athlete_id: string;
  professional_id: string;
  record_type: string;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
  attachments: unknown[];
  is_demo: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useWellnessAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const appointmentsQuery = useQuery({
    queryKey: ['wellness-appointments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('wellness_appointments')
        .select('*')
        .eq('professional_id', user.id)
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      return data as WellnessAppointment[];
    },
    enabled: !!user,
  });

  const createAppointment = useMutation({
    mutationFn: async (appointment: Omit<Partial<WellnessAppointment>, 'professional_id'> & { 
      appointment_date: string; 
      appointment_time: string; 
      service_type: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      const { data, error } = await supabase
        .from('wellness_appointments')
        .insert({ 
          ...appointment, 
          professional_id: user.id 
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-appointments'] });
      toast({ title: 'Cita creada', description: 'La cita se ha programado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WellnessAppointment> & { id: string }) => {
      const { data, error } = await supabase
        .from('wellness_appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-appointments'] });
      toast({ title: 'Cita actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    appointments: appointmentsQuery.data ?? [],
    isLoading: appointmentsQuery.isLoading,
    error: appointmentsQuery.error,
    createAppointment,
    updateAppointment,
  };
}

export function useWellnessEvaluations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const evaluationsQuery = useQuery({
    queryKey: ['wellness-evaluations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('wellness_evaluations')
        .select('*')
        .eq('professional_id', user.id)
        .order('evaluation_date', { ascending: false });
      
      if (error) throw error;
      return data as WellnessEvaluation[];
    },
    enabled: !!user,
  });

  const createEvaluation = useMutation({
    mutationFn: async (evaluation: Omit<Partial<WellnessEvaluation>, 'professional_id'> & {
      athlete_id: string;
      evaluation_type: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      const { data, error } = await supabase
        .from('wellness_evaluations')
        .insert({ 
          ...evaluation, 
          professional_id: user.id 
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-evaluations'] });
      toast({ title: 'Evaluación creada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    evaluations: evaluationsQuery.data ?? [],
    isLoading: evaluationsQuery.isLoading,
    error: evaluationsQuery.error,
    createEvaluation,
  };
}

export function useHealthRecords() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recordsQuery = useQuery({
    queryKey: ['health-records', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as HealthRecord[];
    },
    enabled: !!user,
  });

  const createRecord = useMutation({
    mutationFn: async (record: Omit<Partial<HealthRecord>, 'professional_id'> & {
      athlete_id: string;
      record_type: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      const { data, error } = await supabase
        .from('health_records')
        .insert({ 
          ...record, 
          professional_id: user.id 
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      toast({ title: 'Ficha creada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    records: recordsQuery.data ?? [],
    isLoading: recordsQuery.isLoading,
    error: recordsQuery.error,
    createRecord,
  };
}

export function useWellnessStats() {
  const { appointments } = useWellnessAppointments();
  const { evaluations } = useWellnessEvaluations();
  const { records } = useHealthRecords();
  
  const today = new Date().toISOString().split('T')[0];
  
  return {
    totalPatients: new Set(records.map(r => r.athlete_id)).size,
    todayAppointments: appointments.filter(a => a.appointment_date === today).length,
    pendingAppointments: appointments.filter(a => a.status === 'pending').length,
    confirmedAppointments: appointments.filter(a => a.status === 'confirmed').length,
    pendingEvaluations: evaluations.filter(e => e.status === 'pending').length,
    completedEvaluations: evaluations.filter(e => e.status === 'completed').length,
  };
}
