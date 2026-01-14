import { useState } from 'react';
<<<<<<< HEAD
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
=======
import { useQuery } from '@tanstack/react-query';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Trophy, TrendingUp, Calendar, Plus, Target, Users, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface Team {
  id: string;
  name: string;
  sport: string;
}

interface MatchResult {
  id: string;
  opponent: string;
  home_score: number;
  away_score: number;
  is_home: boolean;
  match_date: string;
  match_type: string;
  notes?: string;
}

export default function CoachReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state para nuevo resultado
  const [newResult, setNewResult] = useState({
    opponent: '',
    my_score: '',
    opponent_score: '',
    is_home: true,
    match_date: new Date().toISOString().split('T')[0],
    match_type: 'League', // Default
    notes: ''
  });

  // 1. Cargar Equipos
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['coach-teams-reports', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport')
        .eq('coach_id', user.id);
      
      if (error) throw error;
      return data as Team[];
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    },
    enabled: !!user?.id,
  });

<<<<<<< HEAD
  // 2. Cargar Resultados del Equipo Seleccionado
  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['team-results', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('match_date', { ascending: false });

      if (error) throw error;
      return data as MatchResult[];
    },
    enabled: !!selectedTeamId,
  });

  // 3. Mutación para guardar resultado
  const createResultMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeamId) return;

      // Mapear scores basado en si jugamos de local o visitante
      const home_score = newResult.is_home ? Number(newResult.my_score) : Number(newResult.opponent_score);
      const away_score = newResult.is_home ? Number(newResult.opponent_score) : Number(newResult.my_score);

      const { error } = await supabase
        .from('match_results')
        .insert({
          team_id: selectedTeamId,
          opponent: newResult.opponent,
          home_score,
          away_score,
          is_home: newResult.is_home,
          match_date: newResult.match_date,
          match_type: newResult.match_type,
          notes: newResult.notes
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-results'] });
      toast({ title: '✅ Resultado registrado correctamente' });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error al guardar el resultado', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setNewResult({
      opponent: '',
      my_score: '',
      opponent_score: '',
      is_home: true,
      match_date: new Date().toISOString().split('T')[0],
      match_type: 'League',
      notes: ''
    });
  };

  // Cálculos de Estadísticas
  const stats = {
    played: results?.length || 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0
  };

  if (results) {
    results.forEach(match => {
      const myScore = match.is_home ? match.home_score : match.away_score;
      const oppScore = match.is_home ? match.away_score : match.home_score;

      stats.goalsFor += myScore;
      stats.goalsAgainst += oppScore;

      if (myScore > oppScore) stats.wins++;
      else if (myScore === oppScore) stats.draws++;
      else stats.losses++;
    });
  }

  const pieData = [
    { name: 'Victorias', value: stats.wins, color: '#22c55e' }, // green-500
    { name: 'Empates', value: stats.draws, color: '#eab308' }, // yellow-500
    { name: 'Derrotas', value: stats.losses, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  if (teamsLoading) return <LoadingSpinner fullScreen text="Cargando equipos..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reportes y Resultados</h1>
          <p className="text-muted-foreground mt-1">
            Analiza el rendimiento de tus equipos
          </p>
        </div>
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
<<<<<<< HEAD
              <SelectValue placeholder="Elige un equipo para ver reporte" />
=======
              <SelectValue placeholder="Selecciona tu equipo" />
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </SelectTrigger>
            <SelectContent>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
<<<<<<< HEAD
                  {team.name} - {team.sport}
=======
                  {team.name} - {team.age_group}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

<<<<<<< HEAD
      {!selectedTeamId ? (
        <EmptyState
          icon={Trophy}
          title="Selecciona un equipo"
          description="Elige un equipo arriba para ver sus estadísticas y resultados."
        />
      ) : resultsLoading ? (
        <LoadingSpinner text="Cargando resultados..." />
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Partidos Jugados</p>
                  <h3 className="text-2xl font-bold">{stats.played}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full text-green-600">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Victorias</p>
                  <h3 className="text-2xl font-bold">{stats.wins}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Goles a Favor</p>
                  <h3 className="text-2xl font-bold">{stats.goalsFor}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-full text-red-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Goles en Contra</p>
                  <h3 className="text-2xl font-bold">{stats.goalsAgainst}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Results List */}
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Historial de Partidos</CardTitle>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Resultado
                </Button>
              </CardHeader>
              <CardContent>
                {stats.played === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="Sin partidos registrados"
                    description="Registra el primer resultado de la temporada."
                    className="py-8"
                  />
                ) : (
                  <div className="space-y-4">
                    {results?.map((match) => {
                      const myScore = match.is_home ? match.home_score : match.away_score;
                      const oppScore = match.is_home ? match.away_score : match.home_score;
                      const isWin = myScore > oppScore;
                      const isDraw = myScore === oppScore;
                      
                      return (
                        <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:shadow-sm transition-all">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={isWin ? 'default' : isDraw ? 'secondary' : 'destructive'}>
                                {isWin ? 'Victoria' : isDraw ? 'Empate' : 'Derrota'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), "d MMM yyyy", { locale: es })}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="font-bold text-lg">{myScore}</span>
                              <span className="text-muted-foreground text-sm">vs</span>
                              <span className="font-bold text-lg">{oppScore}</span>
                              <span className="font-medium">{match.opponent}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({match.is_home ? 'Local' : 'Visitante'})
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {stats.played === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Sin datos suficientes
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              </CardContent>
            </Card>
          </div>
        </>
      )}

<<<<<<< HEAD
      {/* Register Result Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Resultado de Partido</DialogTitle>
            <DialogDescription>Guarda los detalles del encuentro para las estadísticas.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input 
                  type="date" 
                  value={newResult.match_date}
                  onChange={(e) => setNewResult({...newResult, match_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Partido</Label>
                <Select 
                  value={newResult.match_type} 
                  onValueChange={(val) => setNewResult({...newResult, match_type: val})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="League">Liga / Torneo</SelectItem>
                    <SelectItem value="Friendly">Amistoso</SelectItem>
                    <SelectItem value="Cup">Copa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rival (Equipo Oponente)</Label>
              <Input 
                placeholder="Ej: Club Los Tigres" 
                value={newResult.opponent}
                onChange={(e) => setNewResult({...newResult, opponent: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Nuestros Goles</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={newResult.my_score}
                  onChange={(e) => setNewResult({...newResult, my_score: e.target.value})}
                />
              </div>
              <div className="text-center pb-3 font-bold text-muted-foreground">VS</div>
              <div className="space-y-2">
                <Label>Goles Rival</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={newResult.opponent_score}
                  onChange={(e) => setNewResult({...newResult, opponent_score: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="is-home" 
                checked={newResult.is_home}
                onCheckedChange={(checked) => setNewResult({...newResult, is_home: checked})}
              />
              <Label htmlFor="is-home">Jugamos de Local</Label>
            </div>

            <div className="space-y-2">
              <Label>Notas del Partido</Label>
              <Textarea 
                placeholder="Comentarios sobre el rendimiento, clima, incidencias..."
                value={newResult.notes}
                onChange={(e) => setNewResult({...newResult, notes: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createResultMutation.mutate()}
              disabled={!newResult.opponent || newResult.my_score === '' || newResult.opponent_score === '' || createResultMutation.isPending}
            >
              {createResultMutation.isPending ? 'Guardando...' : 'Guardar Resultado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
