// Dashboard stats hook with real API data
import { useEffect, useState } from 'react';
import { studentsAPI } from '@/lib/api/students';
import { classesAPI } from '@/lib/api/classes';
import { useAuth } from '@/contexts/AuthContext';

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [profile]);

  const loadStats = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const schoolId = profile.id || 'demo-school';

      if (profile.role === 'school') {
        // Load real school stats
        const [studentStats, classStats] = await Promise.all([
          studentsAPI.getStats(schoolId).catch(() => ({ total: 0, active: 0, inactive: 0, by_grade: {} })),
          classesAPI.getStats(schoolId).catch(() => ({ total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 })),
        ]);

        setStats({
          students_count: studentStats.total,
          active_students: studentStats.active,
          classes_count: classStats.total,
          active_classes: classStats.active,
          total_enrolled: classStats.total_enrolled,
          monthly_revenue: 0, // TODO: Implement payments stats
          pending_payments: 0, // TODO: Implement payments stats
        });
      } else if (profile.role === 'parent') {
        // TODO: Load parent-specific stats
        setStats({
          children: 0,
          children_attendance: '0%',
          upcoming_payments: 0,
        });
      } else if (profile.role === 'coach') {
        // TODO: Load coach-specific stats
        setStats({
          my_classes: 0,
          my_students: 0,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refresh: loadStats };
}
