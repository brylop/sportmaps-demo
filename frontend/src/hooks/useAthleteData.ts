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
