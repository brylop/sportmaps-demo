import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Users } from 'lucide-react';
import { useTeamPerformanceRoster } from '@/hooks/usePerformanceData';
import { useFootballSeasonStats } from '@/hooks/useFootballData';

interface FootballSeasonStatsProps {
  teamId: string;
}

/**
 * Acumulados de temporada por jugador (partidos, minutos, goles, asistencias,
 * tarjetas) -- derivados de match_lineup_players/football_match_events en el
 * BFF (GET /football/season-stats), no de una carga manual.
 */
export function FootballSeasonStats({ teamId }: FootballSeasonStatsProps) {
  const { data: roster, isLoading: loadingRoster } = useTeamPerformanceRoster({ team_id: teamId });
  const { data: statsData, isLoading: loadingStats } = useFootballSeasonStats(teamId);

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of roster?.subjects ?? []) {
      map.set(`${s.subject_type}:${s.subject_id}`, s.full_name);
    }
    return (subjectType: string, subjectId: string) => map.get(`${subjectType}:${subjectId}`) ?? 'Jugador';
  }, [roster]);

  const sortedStats = useMemo(
    () => [...(statsData?.stats ?? [])].sort((a, b) => b.goals - a.goals || b.matches_played - a.matches_played),
    [statsData]
  );

  if (loadingRoster || loadingStats) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Cargando estadísticas...</span>
      </div>
    );
  }

  if (sortedStats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">
          Todavía no hay alineaciones ni eventos cargados para este equipo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedStats.map((s) => {
        const key = `${s.subject_type}:${s.subject_id}`;
        return (
          <Card key={key} className="border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                {nameOf(s.subject_type, s.subject_id).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{nameOf(s.subject_type, s.subject_id)}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Users className="w-2.5 h-2.5" /> {s.matches_played} PJ · {s.minutes_played}'
                </div>
              </div>
              <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[55%]">
                {s.goals > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-green-600 border-green-500/30 bg-green-500/5">
                    ⚽ {s.goals}
                  </Badge>
                )}
                {s.assists > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-blue-600 border-blue-500/30 bg-blue-500/5">
                    🅰️ {s.assists}
                  </Badge>
                )}
                {s.yellow_cards > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-yellow-600 border-yellow-500/30 bg-yellow-500/5">
                    🟨 {s.yellow_cards}
                  </Badge>
                )}
                {s.red_cards > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-red-700 border-red-600/30 bg-red-600/5">
                    🟥 {s.red_cards}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
