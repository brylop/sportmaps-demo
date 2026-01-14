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
<<<<<<< HEAD
    schedule: string;
=======
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    school_id: string;
    school: {
      name: string;
      city: string;
    };
  };
}

<<<<<<< HEAD
=======
/**
 * Custom hook for managing user enrollments
 * Provides CRUD operations for enrollments with proper error handling
 */
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
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
<<<<<<< HEAD
        .select(`
=======
        .select(
          `
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          *,
          program:programs(
            id,
            name,
            sport,
<<<<<<< HEAD
            schedule,
            school_id,
            school:schools(name, city)
          )
        `)
=======
            school_id,
            school:schools(name, city)
          )
        `
        )
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
<<<<<<< HEAD
      setEnrollments(data as unknown as EnrollmentWithProgram[] || []);
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Crea una inscripción y envía correo de confirmación.
   */
  const createEnrollment = async (programId: string, programDetails?: { name: string, schedule: string, schoolName?: string }) => {
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

      // 2. Insertar en base de datos
      const { error: insertError } = await supabase
        .from('enrollments')
        .insert({
          user_id: user.id,
          program_id: programId,
          start_date: new Date().toISOString().split('T')[0],
          status: 'active',
        });

      if (insertError) throw insertError;

      // 3. Crear evento en calendario (opcional, si hay detalles)
      if (programDetails) {
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(16, 0, 0, 0); 

        await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: `Clase: ${programDetails.name}`,
          description: `Horario: ${programDetails.schedule || 'Por definir'}`,
          event_type: 'training',
          start_time: nextDay.toISOString(),
          end_time: new Date(nextDay.getTime() + 60 * 60 * 1000).toISOString(),
          all_day: false
        });
      }

      // 4. LLAMADA A EDGE FUNCTION PARA ENVIAR CORREO
      // Esto activará el envío real si la función está desplegada y tiene API Key
      const { error: functionError } = await supabase.functions.invoke('send-enrollment-confirmation', {
        body: {
          userEmail: user.email,
          userName: user.user_metadata?.full_name || 'Atleta',
          programName: programDetails?.name || 'Programa Deportivo',
          schoolName: programDetails?.schoolName || 'SportMaps',
          schedule: programDetails?.schedule || 'Por definir'
        }
      });

      if (functionError) {
        console.warn('No se pudo enviar el correo de confirmación (¿está desplegada la función?):', functionError);
        // No fallamos todo el proceso solo por el correo, pero avisamos en consola
      }

      toast({
        title: '¡Inscripción Exitosa!',
        description: 'Te has inscrito correctamente. Revisa tu correo y calendario.',
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
=======
      setEnrollments(data as EnrollmentWithProgram[] || []);
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar tus inscripciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
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
<<<<<<< HEAD
=======
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la inscripción',
        variant: 'destructive',
      });
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
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
<<<<<<< HEAD
    createEnrollment,
    cancelEnrollment,
  };
}
=======
    cancelEnrollment,
  };
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
