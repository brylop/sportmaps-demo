<<<<<<< HEAD
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
=======
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  children: number;
  teams: number;
  products: number;
  orders: number;
  appointments: number;
  evaluations: number;
  programs: number;
  notifications: number;
  unreadNotifications: number;
  payments: number;
  pendingPayments: number;
}

export function useDashboardStats() {
  const { user, profile } = useAuth();
  const role = profile?.role;

  return useQuery({
    queryKey: ['dashboard-stats', user?.id, role],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user?.id) throw new Error('No user');

      const stats: DashboardStats = {
        children: 0,
        teams: 0,
        products: 0,
        orders: 0,
        appointments: 0,
        evaluations: 0,
        programs: 0,
        notifications: 0,
        unreadNotifications: 0,
        payments: 0,
        pendingPayments: 0,
      };

      // Notifications for all roles
      const { data: notifData, count: notifCount } = await supabase
        .from('notifications')
        .select('id, read', { count: 'exact' })
        .eq('user_id', user.id);
      
      stats.notifications = notifCount || 0;
      stats.unreadNotifications = notifData?.filter(n => !n.read).length || 0;

      if (role === 'parent') {
        const { count: childCount } = await supabase
          .from('children')
          .select('id', { count: 'exact' })
          .eq('parent_id', user.id);
        stats.children = childCount || 0;

        const { data: payData, count: payCount } = await supabase
          .from('payments')
          .select('id, status', { count: 'exact' })
          .eq('parent_id', user.id);
        stats.payments = payCount || 0;
        stats.pendingPayments = payData?.filter(p => p.status === 'pending').length || 0;
      }

      if (role === 'coach') {
        const { count: teamCount } = await supabase
          .from('teams')
          .select('id', { count: 'exact' })
          .eq('coach_id', user.id);
        stats.teams = teamCount || 0;
      }

      if (role === 'store_owner') {
        const { count: prodCount } = await supabase
          .from('products')
          .select('id', { count: 'exact' })
          .eq('vendor_id', user.id);
        stats.products = prodCount || 0;

        const { count: orderCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact' });
        stats.orders = orderCount || 0;
      }

      if (role === 'wellness_professional') {
        const { count: apptCount } = await supabase
          .from('wellness_appointments')
          .select('id', { count: 'exact' })
          .eq('professional_id', user.id);
        stats.appointments = apptCount || 0;

        const { count: evalCount } = await supabase
          .from('wellness_evaluations')
          .select('id', { count: 'exact' })
          .eq('professional_id', user.id);
        stats.evaluations = evalCount || 0;
      }

      if (role === 'school') {
        const { data: school } = await supabase
          .from('schools')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        if (school) {
          const { count: progCount } = await supabase
            .from('programs')
            .select('id', { count: 'exact' })
            .eq('school_id', school.id);
          stats.programs = progCount || 0;
        }
      }

      return stats;
    },
    enabled: !!user?.id && !!role,
    staleTime: 30000,
  });
}

export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
