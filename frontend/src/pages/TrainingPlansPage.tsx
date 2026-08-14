import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Plus, Calendar, Target, ClipboardList, Trash2, Activity, Users, Loader2, TrendingUp, Trophy } from 'lucide-react';
import { TrainingPlanFormDialog } from '@/components/coach/TrainingPlanFormDialog';
import { TeamPerformanceEntryModal } from '@/components/school/TeamPerformanceEntryModal';
import { FootballDashboardModal } from '@/components/school/FootballDashboardModal';
import { PerformanceEntryModal } from '@/components/school/PerformanceEntryModal';
import { AthleteEvolutionModal } from '@/components/school/AthleteEvolutionModal';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default function TrainingPlansPage() {
  const { user } = useAuth();
  const { schoolId, activeBranchId, currentUserRole } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState<'teams' | 'plans'>('teams');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [footballDialogOpen, setFootballDialogOpen] = useState(false);
  const [individualStudent, setIndividualStudent] = useState<any>(null);
  const [evolutionStudent, setEvolutionStudent] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['coach-teams', user?.id, schoolId, activeBranchId, currentUserRole],
    queryFn: async () => {
      if (!user?.id || !schoolId) return [];

      const { data: staffData } = await supabase
        .from('school_staff')
        .select('id')
        .eq('coach_auth_id', user.id)
        .eq('school_id', schoolId)
        .maybeSingle();
      const staffId = staffData?.id;

      const { data: teamsData, error } = await (supabase
        .from('teams')
        .select('id, name, coach_id, age_group, sport, branch_id, image_url, team_coaches(coach_id)')
        .eq('school_id', schoolId) as any);

      if (error) throw error;

      const isAdminRole = ['owner', 'admin', 'school_admin', 'school', 'super_admin'].includes(currentUserRole || '');

      let filteredTeams = teamsData || [];

      if (isAdminRole) {
        if (activeBranchId) {
          filteredTeams = filteredTeams.filter((t: any) => t.branch_id === activeBranchId || !t.branch_id);
        }
      } else if (currentUserRole === 'coach') {
        filteredTeams = filteredTeams.filter((team: any) => {
          const isDirectCoach = team.coach_id === user.id || (staffId && team.coach_id === staffId);
          const isAssignedInTable = team.team_coaches?.some(
            (tc: any) => tc.coach_id === user.id || (staffId && tc.coach_id === staffId)
          );
          return isDirectCoach || isAssignedInTable;
        });
      } else {
        filteredTeams = [];
      }

      return filteredTeams.sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id && !!schoolId,
  });

  // Fetch offering plans
  const { data: offeringPlans } = useQuery({
    queryKey: ['school-offering-plans', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('offering_plans')
        .select('id, name, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch active roster for the team or plan
  const activeId = filterType === 'teams' ? selectedTeamId : selectedPlanId;
  const { data: roster = [], isLoading: loadingRoster } = useQuery<any[]>({
    queryKey: ['performance-roster-list', filterType, activeId],
    queryFn: async () => {
      if (!activeId || !schoolId) return [];
      const { data, error } = await (supabase as any)
        .from('school_athletes')
        .select('id, full_name, athlete_type, enrolled_team_id, offering_plan_id')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .eq(filterType === 'teams' ? 'enrolled_team_id' : 'offering_plan_id', activeId);

      if (error) throw error;
      return (data || []).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!activeId && !!schoolId,
  });

  // Fetch training plans (only for teams)
  const { data: plans, isLoading } = useQuery({
    queryKey: ['training-plans', selectedTeamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('plan_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: filterType === 'teams' && !!selectedTeamId,
  });

  // Create plan mutation
  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await supabase
        .from('training_plans')
        .insert({ ...input, school_id: schoolId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-plans', selectedTeamId] });
      toast({ title: '✅ Plan creado', description: 'El plan de entrenamiento se ha guardado' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete plan mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-plans', selectedTeamId] });
      toast({ title: 'Plan eliminado' });
      setDeleteId(null);
    },
  });

  const selectedName = filterType === 'teams'
    ? (teams?.find((t: any) => t.id === selectedTeamId)?.name || 'Equipo')
    : (offeringPlans?.find((p: any) => p.id === selectedPlanId)?.name || 'Plan');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Métricas y Rendimiento</h1>
          <p className="text-muted-foreground mt-1">
            Planifica y gestiona tus sesiones y evaluaciones de rendimiento
          </p>
        </div>
        {filterType === 'teams' && selectedTeamId && (
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Crear Plan
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sección Izquierda: Selectores + Planes (Col 1 y 2) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Panel de Selección</CardTitle>
              <CardDescription>Escoge el grupo de deportistas a visualizar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={filterType}
                onValueChange={(val) => {
                  setFilterType(val as 'teams' | 'plans');
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="teams" className="font-semibold">👥 Equipos</TabsTrigger>
                  <TabsTrigger value="plans" className="font-semibold">🎟️ Planes</TabsTrigger>
                </TabsList>
              </Tabs>

              {filterType === 'teams' ? (
                <div className="space-y-1.5">
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="w-full bg-background">
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
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Selecciona tu plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {offeringPlans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Listado de Planes de Entrenamiento */}
          {filterType === 'teams' && selectedTeamId && (
            <div className="space-y-4">
              {isLoading && <LoadingSpinner text="Cargando planes..." />}

              {plans && plans.length > 0 && plans.map((plan) => {
                const drills = Array.isArray(plan.drills) ? plan.drills : [];

                return (
                  <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            <CardTitle className="text-lg">
                              {new Date(plan.plan_date).toLocaleDateString('es-CO', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Target className="w-4 h-4" />
                            <span>{plan.objectives}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Editar</Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeleteId(plan.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {plan.warmup && (
                        <div>
                          <Badge variant="secondary" className="mb-2">Calentamiento</Badge>
                          <p className="text-sm text-muted-foreground">{plan.warmup}</p>
                        </div>
                      )}

                      {drills.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" />
                            Ejercicios
                          </h4>
                          <div className="space-y-3">
                            {drills.map((drill: any, index: number) => (
                              <div key={index} className="p-3 rounded-lg border bg-accent/50">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{drill.name}</p>
                                    {drill.focus && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        Enfoque: {drill.focus}
                                      </p>
                                    )}
                                  </div>
                                  {drill.duration && (
                                    <Badge variant="outline">{drill.duration}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {plan.materials && (
                        <div>
                          <h4 className="font-semibold mb-2">Materiales</h4>
                          <p className="text-sm text-muted-foreground">{plan.materials}</p>
                        </div>
                      )}

                      {plan.notes && (
                        <div className="pt-3 border-t">
                          <h4 className="font-semibold mb-2">Notas</h4>
                          <p className="text-sm text-muted-foreground italic">{plan.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {plans && plans.length === 0 && !isLoading && (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No hay planes aún</h3>
                    <p className="text-muted-foreground mb-4">
                      Crea tu primer plan de entrenamiento
                    </p>
                    <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                      <Plus className="w-4 h-4" />
                      Crear Primer Plan
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}



          {filterType === 'plans' && selectedPlanId && (
            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
              <CardContent className="pt-6 text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <h3 className="text-lg font-semibold mb-2">Planes de Entrenamiento</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Los planes de entrenamiento y sesiones se organizan por Equipos. 
                  Para planificar, selecciona la pestaña de <strong>Equipos</strong>. 
                  Usa el panel de la derecha para evaluar el rendimiento de los deportistas de este Plan.
                </p>
              </CardContent>
            </Card>
          )}

          {!activeId && (
            <Card>
              <CardContent className="pt-6 text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <h3 className="text-lg font-semibold mb-2">Selecciona un grupo</h3>
                <p className="text-muted-foreground">
                  Elige un {filterType === 'teams' ? 'equipo' : 'plan de oferta'} del menú para comenzar
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sección Derecha: Roster de Estudiantes & Botones de Evaluación */}
        <div className="space-y-6">
          {activeId && (
            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {filterType === 'teams' && (() => {
                      const selectedTeam = teams?.find((t: any) => t.id === selectedTeamId);
                      return selectedTeam?.image_url ? (
                        <img 
                          src={selectedTeam.image_url} 
                          alt={selectedTeam.name} 
                          className="w-10 h-10 rounded-full object-cover border border-border/50 bg-background shadow-sm shrink-0" 
                        />
                      ) : null;
                    })()}
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Roster ({roster.length})
                      </CardTitle>
                      <CardDescription className="truncate max-w-[200px]">
                        {selectedName}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => setPerformanceDialogOpen(true)}
                    disabled={roster.length === 0}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Evaluar Lote
                  </Button>
                  {(() => {
                    const selectedTeam = teams?.find((t: any) => t.id === selectedTeamId);
                    const isFootball = selectedTeam?.sport?.toLowerCase() === 'futbol' || selectedTeam?.sport?.toLowerCase() === 'fútbol';
                    return filterType === 'teams' && isFootball && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 shrink-0"
                        onClick={() => setFootballDialogOpen(true)}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        Fútbol
                      </Button>
                    );
                  })()}
                </div>
              </CardHeader>
              <CardContent className="p-3 flex-1">
                {loadingRoster ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Cargando deportistas...</span>
                  </div>
                ) : roster.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground italic text-xs">
                    Sin deportistas activos inscritos en este {filterType === 'teams' ? 'equipo' : 'plan'}.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {roster.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-lg border bg-card/60 hover:bg-accent/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{student.full_name}</p>
                          {student.athlete_type === 'adult' && (
                            <Badge variant="outline" className="text-[9px] h-3.5 py-0 px-1 mt-0.5">
                              Adulto
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 px-2 gap-1"
                            onClick={() => setEvolutionStudent(student)}
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            Evolución
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-primary hover:text-primary hover:bg-primary/10 px-2 gap-1"
                            onClick={() => setIndividualStudent(student)}
                          >
                            <Activity className="w-3.5 h-3.5" />
                            Evaluar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {filterType === 'teams' && selectedTeamId && (
        <TrainingPlanFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={createMutation.mutate}
          teamId={selectedTeamId}
          isLoading={createMutation.isPending}
        />
      )}



      {activeId && (
        <TeamPerformanceEntryModal
          open={performanceDialogOpen}
          onClose={() => setPerformanceDialogOpen(false)}
          teamId={filterType === 'teams' ? selectedTeamId : undefined}
          offeringPlanId={filterType === 'plans' ? selectedPlanId : undefined}
          teamName={selectedName}
          teamImageUrl={filterType === 'teams' ? teams?.find((t: any) => t.id === selectedTeamId)?.image_url : undefined}
        />
      )}

      {footballDialogOpen && filterType === 'teams' && selectedTeamId && (
        <FootballDashboardModal
          open={footballDialogOpen}
          onClose={() => setFootballDialogOpen(false)}
          teamId={selectedTeamId}
          teamName={selectedName}
        />
      )}

      {individualStudent && (
        <PerformanceEntryModal
          open={!!individualStudent}
          onClose={() => setIndividualStudent(null)}
          subjectType={individualStudent.athlete_type === 'adult' ? 'profile' : (individualStudent.athlete_type === 'child' ? 'child' : 'unregistered')}
          subjectId={individualStudent.id}
          subjectName={individualStudent.full_name}
        />
      )}

      {evolutionStudent && (
        <AthleteEvolutionModal
          open={!!evolutionStudent}
          onClose={() => setEvolutionStudent(null)}
          subjectType={evolutionStudent.athlete_type === 'adult' ? 'profile' : (evolutionStudent.athlete_type === 'child' ? 'child' : 'unregistered')}
          subjectId={evolutionStudent.id}
          subjectName={evolutionStudent.full_name}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan?</AlertDialogTitle>
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
