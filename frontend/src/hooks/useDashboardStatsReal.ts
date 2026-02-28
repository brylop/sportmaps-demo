import { useRef, useState, useEffect } from 'react';
import { studentsAPI } from '@/lib/api/students';
import { classesAPI } from '@/lib/api/classes';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  // School stats
  students_count?: number;
  active_students?: number;
  classes_count?: number;
  active_classes?: number;
  total_enrolled?: number;
  monthly_revenue?: number;
  pending_payments?: number;

  // Parent stats
  children?: number;
  children_attendance?: string;
  upcoming_payments?: number;

  // Coach stats
  my_classes?: number;
  my_students?: number;

  // Common
  notifications?: number;
  messages?: number;
  activeTeams?: number;
  upcomingEvents?: number;
  attendanceRate?: number;
}

export function useDashboardStatsReal() {
  const { profile, user } = useAuth();
  const { schoolId, activeBranchId } = useSchoolContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to avoid infinite loops if dependencies change too fast
  const loadingRef = useRef(false);

  useEffect(() => {
    if (schoolId || profile?.role === 'coach' || profile?.role === 'parent') {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [profile, schoolId, activeBranchId]);

  const loadStats = async () => {
    if (!profile || loadingRef.current) {
      if (!schoolId && profile?.role !== 'coach' && profile?.role !== 'parent') {
        return;
      }
    }

    try {
      loadingRef.current = true;
      setLoading(true);

      if (profile?.role === 'school' || (profile?.role as any) === 'school_admin' || profile?.role === 'admin' || (profile?.role as any) === 'super_admin' || profile?.role === 'coach') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Revenue query with branch filter - only if schoolId exists
        let monthlyRevenue = 0;
        let pendingCount = 0;

        if (schoolId) {
          let revenueQuery = supabase
            .from('payments')
            .select('amount')
            .eq('school_id', schoolId)
            .eq('status', 'paid')
            .gte('payment_date', startOfMonth.toISOString());

          if (activeBranchId) {
            revenueQuery = revenueQuery.eq('branch_id', activeBranchId);
          }

          const { data: revenueData } = await (revenueQuery as any);
          monthlyRevenue = revenueData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

          // Pending payments query with branch filter
          let pendingQuery = supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('status', 'pending');

          if (activeBranchId) {
            pendingQuery = pendingQuery.eq('branch_id', activeBranchId);
          }

          const { count: pendingCountRes } = await (pendingQuery as any);
          pendingCount = pendingCountRes || 0;
        }

        const isCoach = profile?.role === 'coach';
        let coachIdFilter = undefined;

        if (isCoach && user?.email) {
          let staffQuery = supabase
            .from('school_staff')
            .select('id')
            .eq('email', user.email);
          if (schoolId) {
            staffQuery = staffQuery.eq('school_id', schoolId);
          }
          const { data: staffData } = await staffQuery.maybeSingle();

          if (staffData) {
            coachIdFilter = staffData.id;
          }
        }

        // Note: studentsAPI and classesAPI might need branchId support too
        // If schoolId is null but it's a coach, we can still get stats for that coach
        const [studentStats, classStats] = await Promise.all([
          schoolId || coachIdFilter
            ? studentsAPI.getStats(schoolId || '', activeBranchId, coachIdFilter)
            : Promise.resolve({ total: 0, active: 0, inactive: 0, by_grade: {} }),
          schoolId || coachIdFilter
            ? classesAPI.getStats(schoolId || '', activeBranchId, coachIdFilter)
            : Promise.resolve({ total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 }),
        ]).catch((err) => {
          console.error("Error fetching dashboard stats:", err);
          return [{ total: 0, active: 0, inactive: 0, by_grade: {} }, { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 }];
        });

        // Fetch upcoming events for coach
        let upcomingEventsCount = 0;
        if (coachIdFilter) {
          const today = new Date().toISOString().split('T')[0];
          const [{ data: legacyTeams }, { data: junctionTeams }] = await Promise.all([
            supabase.from('teams').select('id').eq('coach_id', coachIdFilter),
            supabase.from('team_coaches').select('team_id').eq('coach_id', coachIdFilter),
          ]);
          const teamIds = [...new Set([
            ...(legacyTeams || []).map(t => t.id),
            ...(junctionTeams || []).map(t => t.team_id),
          ])];

          if (teamIds.length > 0) {
            const { count: sessionCount } = await supabase
              .from('training_sessions')
              .select('id', { count: 'exact', head: true })
              .in('team_id', teamIds)
              .gte('session_date', today);
            upcomingEventsCount = sessionCount || 0;
          }
        }

        setStats({
          students_count: studentStats.total,
          active_students: studentStats.active,
          classes_count: classStats.total,
          active_classes: classStats.active,
          total_enrolled: classStats.total_enrolled,
          monthly_revenue: monthlyRevenue,
          pending_payments: pendingCount || 0,
          activeTeams: classStats.active, // Map active classes to activeTeams for coaches
          notifications: 0, // Fallback for now
          upcomingEvents: upcomingEventsCount,
          attendanceRate: 0, // Placeholder
        });
      } else if (profile.role === 'parent') {
        // Load parent-specific stats
        const { data: childrenData, count: childrenCount } = await (supabase
          .from('children') as any)
          .select('id', { count: 'exact' })
          .eq('parent_id', profile.id);

        const childIds = childrenData?.map(c => c.id) || [];

        // Fetch last 30 days attendance for all children
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);

        const { data: attendanceData } = await (supabase
          .from('attendance_records') as any)
          .select('status')
          .in('child_id', childIds)
          .gte('attendance_date', lastMonth.toISOString().split('T')[0]);

        const totalAttendance = attendanceData?.length || 0;
        const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
        const attendancePercentage = totalAttendance > 0
          ? Math.round((presentCount / totalAttendance) * 100)
          : 0;

        // Upcoming payments
        const { count: upcomingPayments } = await (supabase
          .from('payments') as any)
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', profile.id)
          .eq('status', 'pending');

        setStats({
          children: childrenCount || 0,
          children_attendance: `${attendancePercentage}%`,
          upcoming_payments: upcomingPayments || 0,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setStats(null);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  return { stats, loading, refresh: loadStats };
}
