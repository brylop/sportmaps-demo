import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { UserRole } from '@/types/dashboard';

export interface DashboardStats {
  children: number;
  teams: number;
  products: number;
  orders: number;
  appointments: number;
  evaluations: number;
  programs: number;
  activePrograms: number;
  notifications: number;
  unreadNotifications: number;
  payments: number;
  pendingPayments: number;
  totalStudents: number;
  totalRevenue: number;
  activeEnrollments: number;
  upcomingEvents: number;
  completedActivities: number;
  attendanceRate: number;
  activeTeams: number;
}

export function useDashboardStats(role?: UserRole) {
  const { user, profile } = useAuth();
  const { schoolId, activeBranchId, totalBranches } = useSchoolContext();
  const effectiveRole = role || profile?.role;

  return useQuery({
    queryKey: ['dashboard-stats', user?.id, effectiveRole, schoolId, activeBranchId],
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
        activePrograms: 0,
        notifications: 0,
        unreadNotifications: 0,
        payments: 0,
        pendingPayments: 0,
        totalStudents: 0,
        totalRevenue: 0,
        activeEnrollments: 0,
        upcomingEvents: 0,
        completedActivities: 0,
        attendanceRate: 0,
        activeTeams: 0
      };

      // Notifications for all roles
      const { data: notifData, count: notifCount } = await supabase
        .from('notifications')
        .select('id, read', { count: 'exact' })
        .eq('user_id', user.id);

      stats.notifications = notifCount || 0;
      stats.unreadNotifications = notifData?.filter(n => !n.read).length || 0;

      if (effectiveRole === 'parent') {
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

        // Active enrollments for children
        // This is a bit complex as enrollments are linked to children, not parent directly usually
        // But for MVP/Demo we might link via user_id or handle via children IDs. 
        // For now, let's keep it simple or strictly query if table structure supports it.
        // Assuming enrollments might have parent_id or we query children first.
        // Let's rely on what was working:
        const { count: activeEnrollments } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id) // Assuming enrolling user is tracked
          .eq('status', 'active');
        stats.activeEnrollments = activeEnrollments || 0;
      }

      if (effectiveRole === 'coach') {
        // Resolve school_staff.id from email (teams.coach_id = school_staff.id, NOT auth.users.id)
        let coachStaffId: string | undefined;
        if (user.email) {
          const { data: staffData } = await supabase
            .from('school_staff')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          coachStaffId = staffData?.id;
        }

        if (coachStaffId) {
          // Query teams via direct coach_id AND team_coaches junction
          const [{ count: directCount }, { count: junctionCount }] = await Promise.all([
            supabase.from('teams').select('id', { count: 'exact', head: true }).eq('coach_id', coachStaffId),
            supabase.from('team_coaches').select('team_id', { count: 'exact', head: true }).eq('coach_id', coachStaffId),
          ]);
          const teamCount = Math.max(directCount || 0, junctionCount || 0);
          stats.teams = teamCount;
          stats.activeTeams = teamCount;
        }
      }

      if (effectiveRole === 'store_owner') {
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

      if (effectiveRole === 'wellness_professional') {
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

      if (effectiveRole === 'school' || effectiveRole === 'admin') {
        try {
          const { data: schoolStats, error: rpcError } = await supabase
            .rpc('get_school_dashboard_stats', {
              p_user_id: user.id,
              p_branch_id: activeBranchId || null
            });

          if (rpcError) throw rpcError;

          if (schoolStats) {
            const s = schoolStats as any;
            stats.programs = s.programs || 0;
            stats.activePrograms = s.active_programs || 0;
            stats.activeTeams = s.active_teams || 0;
            stats.totalStudents = s.total_students || 0;
            stats.pendingPayments = s.pending_payments || 0;
            stats.totalRevenue = s.total_revenue || 0;

            if (effectiveRole === 'admin') {
              stats.teams = totalBranches || 0;
            } else {
              stats.teams = s.programs || 0;
            }
          }
        } catch (error) {
          console.warn('Error fetching school stats via RPC, falling back to 0:', error);
        }
      }

      // Default/Athlete role specific
      if (effectiveRole === 'athlete') {
        const { count: enrollmentCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active');
        stats.activeEnrollments = enrollmentCount || 0;
      }

      return stats;
    },
    enabled: !!user?.id,
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
        .select('id, title, message, type, link, read, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
