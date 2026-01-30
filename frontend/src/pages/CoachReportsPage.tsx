import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { BarChart3, Download, TrendingUp, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function CoachReportsPage() {
  const { user, profile } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Check if user is demo account
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  // Demo teams data (only for demo users)
  const demoTeams = isDemoUser ? [
    {
      id: 'demo-team-1',
      coach_id: user?.id,
      name: 'Fútbol Sub-12',
      sport: 'Fútbol',
      age_group: 'Sub-12',
      season: '2024',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] : [];

  const { data: teamsData } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('coach_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const teams = teamsData && teamsData.length > 0 ? teamsData : (isDemoUser ? demoTeams : []);

  // Demo roster data (only for demo users)
  const demoRoster = isDemoUser ? [
    { id: 'player-1', team_id: selectedTeamId, player_name: 'Mateo Pérez', player_number: 10 },
    { id: 'player-2', team_id: selectedTeamId, player_name: 'Juan Vargas', player_number: 7 },
    { id: 'player-3', team_id: selectedTeamId, player_name: 'Camila Torres', player_number: 5 },
    { id: 'player-4', team_id: selectedTeamId, player_name: 'Santiago Rojas', player_number: 1 },
    { id: 'player-5', team_id: selectedTeamId, player_name: 'Valeria Gómez', player_number: 11 },
  ] : [];

  const { data: rosterData } = useQuery({
    queryKey: ['team-roster', selectedTeamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', selectedTeamId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTeamId && !selectedTeamId.startsWith('demo-'),
  });

  const roster = (rosterData && rosterData.length > 0) || !selectedTeamId.startsWith('demo-')
    ? rosterData
    : (isDemoUser ? demoRoster : []);

  // Demo results data (only for demo users)
  const demoResults = isDemoUser ? [
    {
      id: 'result-1',
      team_id: selectedTeamId,
      match_date: '2024-10-28',
      opponent: 'Tigres FC',
      home_score: 2,
      away_score: 2,
      is_home: true,
      match_type: 'Amistoso',
      created_at: new Date().toISOString(),
    },
    {
      id: 'result-2',
      team_id: selectedTeamId,
      match_date: '2024-10-18',
      opponent: 'Leones',
      home_score: 3,
      away_score: 1,
      is_home: true,
      match_type: 'Liga',
      created_at: new Date().toISOString(),
    },
  ] : [];

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ['match-results', selectedTeamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('team_id', selectedTeamId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTeamId && !selectedTeamId.startsWith('demo-'),
  });

  const results = (resultsData && resultsData.length > 0) || !selectedTeamId.startsWith('demo-')
    ? resultsData
    : demoResults;

  // Mock attendance data (en producción vendría de session_attendance)
  const attendanceData = [
    { name: 'Mateo Pérez', percentage: 100 },
    { name: 'Juan Vargas', percentage: 95 },
    { name: 'Santiago Rojas', percentage: 90 },
    { name: 'Valeria Gómez', percentage: 85 },
    { name: 'Camila Torres', percentage: 60 },
  ];

  // Mock scorer data
  const scorerData = [
    { name: 'Mateo Pérez', goals: 4 },
    { name: 'Valeria Gómez', goals: 2 },
    { name: 'Juan Vargas', goals: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground mt-1">
            Analiza el rendimiento de tu equipo
          </p>
        </div>
        <Button variant="outline" className="gap-2">
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
