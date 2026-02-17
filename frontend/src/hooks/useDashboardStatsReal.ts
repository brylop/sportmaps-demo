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
}

export function useDashboardStatsReal() {
  const { profile } = useAuth();
  const { schoolId, activeBranchId } = useSchoolContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to avoid infinite loops if dependencies change too fast
  const loadingRef = useRef(false);

  useEffect(() => {
    if (schoolId) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [profile, schoolId, activeBranchId]);

  const loadStats = async () => {
    if (!profile || !schoolId || loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);

      if (profile.role === 'school' || profile.role === 'admin' || profile.role === 'coach') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Revenue query with branch filter
        let revenueQuery = supabase
          .from('payments')
          .select('amount')
          .eq('school_id', schoolId)
          .eq('status', 'paid')
          .gte('payment_date', startOfMonth.toISOString());

        if (activeBranchId) {
          revenueQuery = revenueQuery.eq('branch_id', activeBranchId);
        }

        const { data: revenueData } = await revenueQuery;
        const monthlyRevenue = revenueData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        // Pending payments query with branch filter
        let pendingQuery = supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('status', 'pending');

        if (activeBranchId) {
          pendingQuery = pendingQuery.eq('branch_id', activeBranchId);
        }

        const { count: pendingCount } = await pendingQuery;

        // Note: studentsAPI and classesAPI might need branchId support too
        const [studentStats, classStats] = await Promise.all([
          studentsAPI.getStats(schoolId, activeBranchId).catch(() => ({ total: 0, active: 0, inactive: 0, by_grade: {} })),
          classesAPI.getStats(schoolId, activeBranchId).catch(() => ({ total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 })),
        ]);

        setStats({
          students_count: studentStats.total,
          active_students: studentStats.active,
          classes_count: classStats.total,
          active_classes: classStats.active,
          total_enrolled: classStats.total_enrolled,
          monthly_revenue: monthlyRevenue,
          pending_payments: pendingCount || 0,
        });
      } else if (profile.role === 'parent') {
        // Load parent-specific stats
        const { data: childrenData, count: childrenCount } = await supabase
          .from('children')
          .select('id', { count: 'exact' })
          .eq('parent_id', profile.id);

        const childIds = childrenData?.map(c => c.id) || [];

        // Fetch last 30 days attendance for all children
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);

        const { data: attendanceData } = await supabase
          .from('attendance_records')
          .select('status')
          .in('student_id', childIds)
          .gte('attendance_date', lastMonth.toISOString().split('T')[0]);

        const totalAttendance = attendanceData?.length || 0;
        const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
        const attendancePercentage = totalAttendance > 0
          ? Math.round((presentCount / totalAttendance) * 100)
          : 0;

        // Upcoming payments
        const { count: upcomingPayments } = await supabase
          .from('payments')
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
