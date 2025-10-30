import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { TrendingUp, MessageSquare, Award } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

export default function AcademicProgressPage() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  // Demo children
  const demoChildren = [
    { id: 'demo-1', full_name: 'Mateo Pérez', parent_id: user?.id },
    { id: 'demo-2', full_name: 'Sofía Pérez', parent_id: user?.id },
  ];

  const { data: childrenData } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const children = childrenData && childrenData.length > 0 ? childrenData : demoChildren;

  // Demo progress data
  const demoProgress = [
    {
      id: 'prog-1',
      child_id: selectedChildId,
      skill_name: 'Técnica de pase',
      skill_level: 85,
      evaluation_date: '2024-10-28',
      comments: 'Excelente mejora en la precisión de los pases. Demuestra gran control del balón.',
      children: { full_name: 'Mateo Pérez' },
    },
    {
      id: 'prog-2',
      child_id: selectedChildId,
      skill_name: 'Condición física',
      skill_level: 78,
      evaluation_date: '2024-10-25',
      comments: 'Buena resistencia. Sigue trabajando en velocidad.',
      children: { full_name: 'Mateo Pérez' },
    },
    {
      id: 'prog-3',
      child_id: selectedChildId,
      skill_name: 'Trabajo en equipo',
      skill_level: 92,
      evaluation_date: '2024-10-20',
      comments: 'Sobresaliente. Siempre apoya a sus compañeros.',
      children: { full_name: 'Mateo Pérez' },
    },
  ];

  const { data: progressData, isLoading, error, refetch } = useQuery({
    queryKey: ['academic-progress', selectedChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_progress')
        .select('*, children(full_name)')
        .eq('child_id', selectedChildId)
        .order('evaluation_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChildId && !selectedChildId.startsWith('demo-'),
  });

  const progress = (progressData && progressData.length > 0) || !selectedChildId.startsWith('demo-')
    ? progressData
    : demoProgress;

  const getStars = (level: number) => {
    const stars = Math.ceil(level / 20);
    return '⭐️'.repeat(stars);
  };

  if (isLoading && selectedChildId) {
    return <LoadingSpinner fullScreen text="Cargando progreso académico..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Progreso Académico</h1>
        <p className="text-muted-foreground mt-1">
          Seguimiento del desarrollo deportivo de tus hijos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Hijo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un hijo para ver su progreso" />
            </SelectTrigger>
            <SelectContent>
              {children?.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedChildId && progress && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle>Habilidades Actuales</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {progress
                .filter((item, index, self) =>
                  index === self.findIndex((t) => t.skill_name === item.skill_name)
                )
                .map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.skill_name}</span>
                        <span className="text-lg">{getStars(item.skill_level)}</span>
                      </div>
                      <Badge variant="secondary">{item.skill_level}%</Badge>
                    </div>
                    <Progress value={item.skill_level} className="h-2" />
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle>Historial de Evaluaciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {progress
                .filter((item) => item.comments)
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.evaluation_date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="font-medium">{item.skill_name}</p>
                      </div>
                      <Badge>{item.skill_level}%</Badge>
                    </div>
                    {item.comments && (
                      <p className="text-sm text-muted-foreground mt-2">{item.comments}</p>
                    )}
                  </div>
                ))}

              {progress.filter((item) => item.comments).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No hay evaluaciones con comentarios aún</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedChildId && children && children.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona un hijo</h3>
            <p className="text-muted-foreground">
              Elige un hijo del menú superior para ver su progreso académico
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <ErrorState
          title="Error al cargar"
          message="No pudimos cargar el progreso académico"
          onRetry={refetch}
        />
      )}
    </div>
  );
}
