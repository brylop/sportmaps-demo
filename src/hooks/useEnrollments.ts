import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Enrollment {
  id: string;
  user_id: string;
  program_id: string;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentWithProgram extends Enrollment {
  program: {
    id: string;
    name: string;
    sport: string;
    schedule: string; // Necesario para el calendario
    school_id: string;
    school: {
      name: string;
      city: string;
    };
  };
}

/**
 * Hook para gestionar inscripciones
 * Maneja: Creación en DB, Sincronización con Calendario y Notificaciones
 */
export function useEnrollments() {
  const [enrollments, setEnrollments] = useState<EnrollmentWithProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  const fetchEnrollments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('enrollments')
        .select(`
          *,
          program:programs(
            id,
            name,
            sport,
            schedule,
            school_id,
            school:schools(name, city)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setEnrollments(data as unknown as EnrollmentWithProgram[] || []);
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Inscribe al usuario en un programa.
   * 1. Crea el registro en 'enrollments'
   * 2. Crea un evento en 'calendar_events' (para que aparezca en el calendario)
   * 3. Simula envío de email de confirmación
   */
  const createEnrollment = async (programId: string, programDetails?: { name: string, schedule: string }) => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    try {
      // 1. Validar duplicados
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('program_id', programId)
        .eq('status', 'active')
        .single();

      if (existing) {
        throw new Error('Ya estás inscrito en este programa');
      }

      // 2. Crear inscripción
      const { error: insertError, data: newEnrollment } = await supabase
        .from('enrollments')
        .insert({
          user_id: user.id,
          program_id: programId,
          start_date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Crear evento en el calendario (Sincronización)
      // Asumimos que la clase empieza "mañana" para el ejemplo, o parseamos el horario real
      if (programDetails) {
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(16, 0, 0, 0); // Default 4 PM

        await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: `Clase: ${programDetails.name}`,
          description: `Horario habitual: ${programDetails.schedule || 'Por definir'}`,
          event_type: 'training',
          start_time: nextDay.toISOString(),
          end_time: new Date(nextDay.getTime() + 60 * 60 * 1000).toISOString(), // 1 hora después
          all_day: false
        });
      }

      // 4. Simular envío de correo (Edge Function Mock)
      console.log(`[EMAIL MOCK] Enviando confirmación a ${user.email} y a la escuela...`);
      toast({
        title: '¡Inscripción Confirmada!',
        description: 'Te hemos enviado un correo con los detalles. Revisa tu calendario.',
      });

      await fetchEnrollments();
      return { success: true };
    } catch (err: any) {
      console.error('Error creating enrollment:', err);
      toast({
        title: 'Error',
        description: err.message || 'No se pudo completar la inscripción',
        variant: 'destructive',
      });
      return { success: false, error: err };
    }
  };

  const cancelEnrollment = async (enrollmentId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({ status: 'cancelled', end_date: new Date().toISOString().split('T')[0] })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      toast({
        title: 'Inscripción cancelada',
        description: 'La inscripción ha sido cancelada exitosamente',
      });

      await fetchEnrollments();
      return { success: true };
    } catch (err: any) {
      console.error('Error cancelling enrollment:', err);
      return { success: false, error: err };
    }
  };

  const activeEnrollments = enrollments.filter((e) => e.status === 'active');
  const pastEnrollments = enrollments.filter((e) => e.status !== 'active');

  return {
    enrollments,
    activeEnrollments,
    pastEnrollments,
    loading,
    error,
    refetch: fetchEnrollments,
    createEnrollment,
    cancelEnrollment,
  };
}