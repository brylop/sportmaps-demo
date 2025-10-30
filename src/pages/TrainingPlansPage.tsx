import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Plus, Calendar, Target, ClipboardList } from 'lucide-react';

export default function TrainingPlansPage() {
  const { user } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

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

  const { data: plans, isLoading } = useQuery({
    queryKey: ['training-plans', selectedTeamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('plan_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTeamId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planes de Entrenamiento</h1>
          <p className="text-muted-foreground mt-1">
            Planifica y estructura tus sesiones
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Crear Plan
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

      {selectedTeamId && plans && (
        <div className="space-y-4">
          {plans.map((plan) => {
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
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Calentamiento */}
                  {plan.warmup && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge variant="secondary">Calentamiento</Badge>
                      </h4>
                      <p className="text-sm text-muted-foreground">{plan.warmup}</p>
                    </div>
                  )}

                  {/* Ejercicios */}
                  {drills.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Ejercicios
                      </h4>
                      <div className="space-y-3">
                        {drills.map((drill: any, index: number) => (
                          <div
                            key={index}
                            className="p-3 rounded-lg border bg-accent/50"
                          >
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

                  {/* Materiales */}
                  {plan.materials && (
                    <div>
                      <h4 className="font-semibold mb-2">Materiales</h4>
                      <p className="text-sm text-muted-foreground">{plan.materials}</p>
                    </div>
                  )}

                  {/* Notas */}
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

          {plans.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No hay planes aún</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primer plan de entrenamiento
                </p>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Crear Primer Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!selectedTeamId && teams && teams.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona tu equipo</h3>
            <p className="text-muted-foreground">
              Elige un equipo del menú superior para ver sus planes
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <LoadingSpinner text="Cargando planes..." />}
    </div>
  );
}
