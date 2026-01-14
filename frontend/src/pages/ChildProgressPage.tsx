import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { TrendingUp, Award, Target } from 'lucide-react';

export default function ChildProgressPage() {
  const { childId } = useParams<{ childId: string }>();

  const { data: child, isLoading: loadingChild } = useQuery({
    queryKey: ['child', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('id', childId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['progress', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_progress')
        .select('*')
        .eq('child_id', childId)
        .order('evaluation_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loadingChild || loadingProgress) {
    return <LoadingSpinner fullScreen text="Cargando progreso..." />;
  }

  if (!child) {
    return <ErrorState message="Hijo no encontrado" />;
  }

  const averageLevel = progress && progress.length > 0
    ? Math.round(progress.reduce((sum, p) => sum + p.skill_level, 0) / progress.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Progreso de {child.full_name}</h1>
        <p className="text-muted-foreground mt-1">
          Seguimiento de habilidades y desarrollo deportivo
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Nivel Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{averageLevel}/10</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Habilidades Evaluadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{progress?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Deporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{child.sport || 'No especificado'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Habilidades Deportivas</CardTitle>
        </CardHeader>
        <CardContent>
          {!progress || progress.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay evaluaciones de progreso disponibles
            </div>
          ) : (
            <div className="space-y-6">
              {progress.map((skill) => (
                <div key={skill.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{skill.skill_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Evaluado el{' '}
                        {new Date(skill.evaluation_date).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-primary">
                      {skill.skill_level}/10
                    </span>
                  </div>
                  <Progress value={skill.skill_level * 10} className="h-2" />
                  {skill.comments && (
                    <p className="text-sm text-muted-foreground italic">
                      "{skill.comments}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
