import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Trophy, Plus, TrendingUp, Minus, Equal, Trash2 } from 'lucide-react';
import { MatchResultFormDialog } from '@/components/coach/MatchResultFormDialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ResultsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch teams
  const { data: teams } = useQuery({
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

  // Fetch match results
  const { data: results, isLoading } = useQuery({
    queryKey: ['match-results', selectedTeamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('match_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTeamId,
  });

  // Create result mutation
  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await supabase
        .from('match_results')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-results', selectedTeamId] });
      toast({ title: '✅ Resultado registrado' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete result mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('match_results')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-results', selectedTeamId] });
      toast({ title: 'Resultado eliminado' });
      setDeleteId(null);
    },
  });

  const getMatchResult = (match: any) => {
    const ourScore = match.is_home ? match.home_score : match.away_score;
    const theirScore = match.is_home ? match.away_score : match.home_score;
    if (ourScore > theirScore) return 'win';
    if (ourScore < theirScore) return 'loss';
    return 'draw';
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'loss': return <Minus className="w-5 h-5 text-red-500" />;
      case 'draw': return <Equal className="w-5 h-5 text-yellow-500" />;
      default: return null;
    }
  };

  const getResultLabel = (result: string) => {
    switch (result) {
      case 'win': return 'Victoria';
      case 'loss': return 'Derrota';
      case 'draw': return 'Empate';
      default: return '';
    }
  };

  const stats = results ? {
    wins: results.filter((m) => getMatchResult(m) === 'win').length,
    draws: results.filter((m) => getMatchResult(m) === 'draw').length,
    losses: results.filter((m) => getMatchResult(m) === 'loss').length,
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resultados</h1>
          <p className="text-muted-foreground mt-1">
            Registra y consulta resultados de partidos
          </p>
        </div>
        <Button 
          className="gap-2" 
          onClick={() => setDialogOpen(true)}
          disabled={!selectedTeamId}
        >
          <Plus className="w-4 h-4" />
          Registrar Resultado
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
                  {team.name} - {team.age_group || team.sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTeamId && stats && (
        <>
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold">Récord de la Temporada</h3>
              </div>
              <div className="flex items-center justify-center gap-8 text-center">
                <div>
                  <p className="text-4xl font-bold text-green-500">{stats.wins}</p>
                  <p className="text-sm text-muted-foreground">Victorias</p>
                </div>
                <div className="text-2xl text-muted-foreground">-</div>
                <div>
                  <p className="text-4xl font-bold text-yellow-500">{stats.draws}</p>
                  <p className="text-sm text-muted-foreground">Empates</p>
                </div>
                <div className="text-2xl text-muted-foreground">-</div>
                <div>
                  <p className="text-4xl font-bold text-red-500">{stats.losses}</p>
                  <p className="text-sm text-muted-foreground">Derrotas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading && <LoadingSpinner text="Cargando resultados..." />}

          <Card>
            <CardHeader>
              <CardTitle>Historial de Partidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results?.map((match) => {
                  const result = getMatchResult(match);
                  const ourScore = match.is_home ? match.home_score : match.away_score;
                  const theirScore = match.is_home ? match.away_score : match.home_score;

                  return (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getResultIcon(result)}
                        <div>
                          <p className="font-semibold">vs {match.opponent}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(match.match_date).toLocaleDateString('es-CO', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {ourScore} - {theirScore}
                          </p>
                          <Badge
                            variant={
                              result === 'win' ? 'default' :
                              result === 'draw' ? 'secondary' : 'destructive'
                            }
                          >
                            {getResultLabel(result)}
                          </Badge>
                        </div>
                        <Badge variant="outline">{match.match_type}</Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setDeleteId(match.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {results && results.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No hay resultados registrados aún</p>
                    <Button 
                      className="mt-4 gap-2"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Primer Resultado
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedTeamId && teams && teams.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona tu equipo</h3>
            <p className="text-muted-foreground">
              Elige un equipo del menú superior para ver sus resultados
            </p>
          </CardContent>
        </Card>
      )}

      {teams && teams.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No tienes equipos</h3>
            <p className="text-muted-foreground">
              Primero debes crear un equipo en la sección de Equipos
            </p>
          </CardContent>
        </Card>
      )}

      {selectedTeamId && (
        <MatchResultFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={createMutation.mutate}
          teamId={selectedTeamId}
          isLoading={createMutation.isPending}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar resultado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
