import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TrainingLog {
  id: string;
  athlete_id: string;
  training_date: string;
  exercise_type: string;
  duration_minutes: number;
  intensity: 'low' | 'medium' | 'high' | 'max';
  calories_burned: number | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface AthleteStat {
  id: string;
  athlete_id: string;
  stat_date: string;
  stat_type: string;
  value: number;
  unit: string;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export function useTrainingLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['training-logs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_logs')
        .select('*')
        .order('training_date', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as TrainingLog[];
    },
    enabled: !!user?.id,
  });
}

export function useAthleteStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['athlete-stats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_stats')
        .select('*')
        .order('stat_date', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as AthleteStat[];
    },
    enabled: !!user?.id,
  });
}

// Aggregate stats from training logs
export function useTrainingAggregates() {
  const { data: logs, isLoading } = useTrainingLogs();

  if (isLoading || !logs) {
    return {
      totalSessions: 0,
      totalMinutes: 0,
      totalCalories: 0,
      avgDuration: 0,
      isLoading,
    };
  }

  const totalSessions = logs.length;
  const totalMinutes = logs.reduce((acc, log) => acc + log.duration_minutes, 0);
  const totalCalories = logs.reduce((acc, log) => acc + (log.calories_burned || 0), 0);
  const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

  return {
    totalSessions,
    totalMinutes,
    totalCalories,
    avgDuration,
    isLoading,
  };
}

export interface AthleteGoal {
  id: string;
  athlete_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  progress: number;
  status: 'active' | 'completed' | 'pending' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export function useAthleteGoals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['athlete-goals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AthleteGoal[];
    },
    enabled: !!user?.id,
  });
}

export interface AthleteDashboardRPC {
  trainings_this_month: number;
  current_level: string | null;
  next_session_days: number | null;
  pending_payments_total: number;
  active_enrollments: number;
  active_teams: number;
  age_category: string;
}

export function useAthleteDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['athlete-dashboard-stats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_athlete_dashboard_stats');
      if (error) throw error;
      return data as unknown as AthleteDashboardRPC;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

import {
  getAthleteTrainingToday,
  getAthleteUnifiedStats,
  getAthleteStatSources,
  getBodyMetrics,
  type UnifiedStats,
  type StatSource,
  type TrainingTodayResponse,
} from '@/lib/athlete/queries';

// Sesión de hoy (PT + actividad libre)
export function useAthleteTrainingToday() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['athlete-training-today', user?.id],
    queryFn: getAthleteTrainingToday,
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minuto
  });
}

// Estadísticas unificadas desde BFF (PT + escuela + libre)
export function useAthleteUnifiedStats(
  context: 'all' | 'pt' | 'school' | 'free' = 'all',
  sourceId?: string,
  days = 30,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['athlete-unified-stats', user?.id, context, sourceId, days],
    queryFn: () => getAthleteUnifiedStats(context, sourceId, days),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });
}

// Fuentes disponibles del atleta (escuelas + entrenadores PT)
export function useAthleteStatSources() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['athlete-stat-sources', user?.id],
    queryFn: getAthleteStatSources,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// Métricas corporales del atleta
export function useBodyMetrics(limit = 30) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['athlete-body-metrics', user?.id, limit],
    queryFn: () => getBodyMetrics(limit),
    enabled: !!user?.id,
  });
}
