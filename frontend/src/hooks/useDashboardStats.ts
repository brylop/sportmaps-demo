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
