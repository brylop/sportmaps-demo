import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Program {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  sport: string;
  schedule: Json | null;
  price_monthly: number | null;
  age_min: number | null;
  age_max: number | null;
  max_students: number | null;
  current_students: number | null;
  active: boolean | null;
  image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Support Json type for schedule
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Custom hook for fetching programs by school
 * Includes helper functions for enrollment and participant management
 */
export function usePrograms(schoolId: string | undefined) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (schoolId) {
      fetchPrograms();
    }
  }, [schoolId]);

  const fetchPrograms = async () => {
    if (!schoolId) return;

    try {
      setLoading(true);
      setError(null);

      // Unified: now we fetch from 'teams' table
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .eq('school_id', schoolId)
        .eq('active', true)
        .order('name');

      if (fetchError) throw fetchError;

      // Map to the internal Program interface if necessary
      // Note: the column names in teams now match most of these
      setPrograms(data || []);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los programas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const enrollInProgram = async (programId: string, userId: string) => {
    try {
      const { error: enrollError } = await supabase.from('enrollments').insert({
        user_id: userId,
        program_id: programId,
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      });

      if (enrollError) throw enrollError;

      toast({
        title: '¡Inscripción exitosa!',
        description: 'Te has inscrito correctamente al programa',
      });

      // Refresh programs to update participant count
      await fetchPrograms();

      return { success: true };
    } catch (err: any) {
      console.error('Error enrolling:', err);
      toast({
        title: 'Error',
        description: err.message || 'No se pudo completar la inscripción',
        variant: 'destructive',
      });
      return { success: false, error: err };
    }
  };

  const getAgeRange = (program: Program) => {
    if (!program.age_min && !program.age_max) return 'Todas las edades';
    if (!program.age_max) return `${program.age_min}+ años`;
    if (!program.age_min) return `Hasta ${program.age_max} años`;
    return `${program.age_min}-${program.age_max} años`;
  };

  const getAvailability = (program: Program) => {
    if (!program.max_students) return { text: 'Cupos ilimitados', available: true };
    const available = program.max_students - (program.current_students || 0);
    return {
      text: available > 0 ? `${available} cupos disponibles` : 'Lleno',
      available: available > 0,
      count: available,
    };
  };

  return {
    programs,
    loading,
    error,
    refetch: fetchPrograms,
    enrollInProgram,
    getAgeRange,
    getAvailability,
  };
}
