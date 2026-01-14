import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    },
    enabled: !!user?.id,
  });

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Elige un equipo para ver reporte" />
            </SelectTrigger>
            <SelectContent>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name} - {team.sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
              </CardContent>
            </Card>
          </div>
        </>
      )}

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