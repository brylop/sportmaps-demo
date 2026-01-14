import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/dashboard';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardStatsData {
  activeEnrollments: number;
  upcomingEvents: number;
  completedActivities: number;
  attendanceRate: number;
  // School/Coach specific
  totalStudents?: number;
  activePrograms?: number;
  totalRevenue?: number;
  activeTeams?: number;
  totalPlayers?: number;
}

export function useDashboardStats(role: UserRole) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStatsData>({
    activeEnrollments: 0,
    upcomingEvents: 0,
    completedActivities: 0,
    attendanceRate: 0,
    activePrograms: 0,
    totalStudents: 0,
    totalRevenue: 0,
    activeTeams: 0,
    totalPlayers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && role) {
      fetchStats();
    }
  }, [user, role]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      if (role === 'athlete' || role === 'parent') {
        // 1. Contar inscripciones activas
        const { count: enrollmentCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active');

        setStats(prev => ({
          ...prev,
          activeEnrollments: enrollmentCount || 0,
          upcomingEvents: 0, // Pendiente de conectar con calendario
        }));
      }
      
      else if (role === 'school') {
        // 1. Obtener ID de la escuela del usuario (owner)
        const { data: schoolData } = await supabase
          .from('schools')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (schoolData) {
          // 2. Contar programas activos usando el ID de la escuela
          const { count: programsCount } = await supabase
            .from('programs')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolData.id)
            .eq('active', true);

          // 3. Calcular estudiantes
          // Paso A: Obtener IDs de mis programas para evitar joins complejos que rompen TS
          const { data: myPrograms } = await supabase
            .from('programs')
            .select('id')
            .eq('school_id', schoolData.id);
            
          const programIds = myPrograms?.map(p => p.id) || [];
          
          // Paso B: Contar inscripciones en esos programas
          let enrollmentsCount = 0;
          if (programIds.length > 0) {
            const { count } = await supabase
              .from('enrollments')
              .select('*', { count: 'exact', head: true })
              .in('program_id', programIds)
              .eq('status', 'active');
            enrollmentsCount = count || 0;
          }

          setStats(prev => ({
            ...prev,
            activePrograms: programsCount || 0,
            totalStudents: enrollmentsCount || 0,
          }));
        }
      }

      else if (role === 'coach') {
        // 1. Contar equipos asignados al entrenador
        const { count: teamsCount } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('coach_id', user.id);

        setStats(prev => ({
          ...prev,
          activeTeams: teamsCount || 0,
        }));
      }

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: fetchStats };
}