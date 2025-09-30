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
    school_id: string;
    school: {
      name: string;
      city: string;
    };
  };
}

/**
 * Custom hook for managing user enrollments
 * Provides CRUD operations for enrollments with proper error handling
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
        .select(
          `
          *,
          program:programs(
            id,
            name,
            sport,
            school_id,
            school:schools(name, city)
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
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
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la inscripción',
        variant: 'destructive',
      });
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
    cancelEnrollment,
  };
}
