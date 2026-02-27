import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { BarChart3, Download, TrendingUp, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';


export default function CoachReportsPage() {
  const { user, profile } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const { data: teamsResult = [] } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // 1. Obtener staffId si existe
      let staffId = null;
      if (user.email) {
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (staffData) staffId = staffData.id;
      }

      // 2. Traer todos los equipos donde el usuario es coach (directo o via tabla de relación)
      const { data: teamsData, error } = await (supabase
        .from('teams')
        .select('id, name, coach_id, age_group, team_coaches(coach_id)') as any);

      if (error) throw error;

      // 3. Filtrar
      return (teamsData || []).filter((team: any) => {
        const isDirectCoach = team.coach_id === user.id || (staffId && team.coach_id === staffId);
        const isAssignedInTable = team.team_coaches?.some(
          (tc: any) => tc.coach_id === user.id || (staffId && tc.coach_id === staffId)
        );
        return isDirectCoach || isAssignedInTable;
      }).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id,
  });

  const teams = teamsResult || [];

  const { data: report, isLoading } = useQuery({
    queryKey: ['team-report', selectedTeamId],
    queryFn: async () => {
      return await bffClient.get<{
        team: any;
        roster: any[];
        results: any[];
        attendance: any[];
        scorers: any[];
      }>(`/api/v1/reports/coach/${selectedTeamId}`);
    },
    enabled: !!selectedTeamId && !selectedTeamId.startsWith('demo-'),
  });

  const roster = report?.roster || [];
  const results = report?.results || [];
  const attendanceData = report?.attendance || [];
  const scorerData = report?.scorers || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground mt-1">
            Analiza el rendimiento de tu equipo
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.print()}>
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu equipo" />
            </SelectTrigger>
            <SelectContent>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name} - {team.age_group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTeamId && (
        <>
          {/* Reporte de Asistencia */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle>Asistencia General - Octubre</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {attendanceData.map((player) => (
                <div key={player.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{player.name}</p>
                    <span className="text-sm font-semibold">
                      {player.percentage}%
                      {player.percentage < 70 && ' ⚠️'}
                    </span>
                  </div>
                  <Progress
                    value={player.percentage}
                    className={player.percentage < 70 ? 'bg-red-100' : ''}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reporte de Goleadores */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle>Goleadores - Temporada 2025</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scorerData.map((player, index) => (
                  <div
                    key={player.name}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <p className="font-medium">{player.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{player.goals}</p>
                      <p className="text-xs text-muted-foreground">goles</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas Rápidas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">{roster?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Jugadores Totales</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-3xl font-bold">{results?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Partidos Jugados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-3xl font-bold">90%</p>
                  <p className="text-sm text-muted-foreground">Asist. Promedio</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!selectedTeamId && teams && teams.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona tu equipo</h3>
            <p className="text-muted-foreground">
              Elige un equipo del menú superior para ver reportes
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <LoadingSpinner text="Generando reportes..." />}
    </div>
  );
}
