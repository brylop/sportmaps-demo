import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Activity } from 'lucide-react';

interface WeeklyLoadPanelProps {
  microcycleId: string;
}

interface AthleteWeeklyLoadRow {
  child_id: string | null;
  user_id: string | null;
  unregistered_athlete_id: string | null;
  full_name: string;
  avatar_url: string | null;
  sessions_count: number;
  total_ua: number;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function WeeklyLoadPanel({ microcycleId }: WeeklyLoadPanelProps) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['athlete-weekly-load', microcycleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('athlete_weekly_load', {
        p_microcycle_id: microcycleId,
      });
      if (error) throw error;
      return (data || []) as AthleteWeeklyLoadRow[];
    },
    enabled: !!microcycleId,
  });

  if (isLoading) return null;

  const athletes = rows || [];
  const hasLoad = athletes.some((row) => (row.total_ua || 0) > 0);

  return (
    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Carga por atleta
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasLoad ? (
          <p className="text-xs text-muted-foreground">
            Sin carga registrada esta semana — hace falta RPE en las sesiones y asistencia tomada.
          </p>
        ) : (
          <div className="space-y-1">
            {athletes.map((row, idx) => {
              const key = row.child_id || row.user_id || row.unregistered_athlete_id || String(idx);
              return (
                <div key={key} className="flex items-center gap-2 py-1 text-xs border-b last:border-b-0">
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarImage src={row.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] font-semibold">
                      {getInitials(row.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate flex-1 font-medium">{row.full_name}</span>
                  <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                    {row.sessions_count} {row.sessions_count === 1 ? 'sesión' : 'sesiones'}
                  </Badge>
                  <span className="shrink-0 w-16 text-right font-semibold">
                    {row.total_ua ?? 0} <span className="text-muted-foreground font-normal">UA</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
