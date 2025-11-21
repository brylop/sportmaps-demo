import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { TrendingUp, MessageSquare, Award, Calendar, User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';

// Define explicit interfaces for better type safety
interface Child {
  id: string;
  full_name: string;
  parent_id: string;
}

interface ProgressItem {
  id: string;
  child_id: string;
  skill_name: string;
  skill_level: number;
  evaluation_date: string;
  comments: string | null;
  coach_id?: string;
}

export default function AcademicProgressPage() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  // Check if user is demo account
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  // Demo children only for demo users
  const demoChildren: Child[] = isDemoUser ? [
    { id: 'demo-1', full_name: 'Mateo Pérez', parent_id: user?.id || 'demo-parent' },
    { id: 'demo-2', full_name: 'Sofía Pérez', parent_id: user?.id || 'demo-parent' },
  ] : [];

  // Fetch children associated with the parent
  const { data: childrenData, isLoading: loadingChildren } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user.id);
      
      if (error) throw error;
      return data as Child[];
    },
    enabled: !!user?.id,
  });

  const children = (childrenData && childrenData.length > 0) ? childrenData : demoChildren;

  // Auto-select first child if available and none selected
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // Demo progress data only for demo users
  const demoProgress: ProgressItem[] = isDemoUser ? [
    {
      id: 'prog-1',
      child_id: selectedChildId,
      skill_name: 'Técnica de pase',
      skill_level: 85,
      evaluation_date: '2024-10-28',
      comments: 'Excelente mejora en la precisión de los pases. Demuestra gran control del balón.',
    },
    {
      id: 'prog-2',
      child_id: selectedChildId,
      skill_name: 'Condición física',
      skill_level: 78,
      evaluation_date: '2024-10-25',
      comments: 'Buena resistencia. Sigue trabajando en velocidad.',
    },
    {
      id: 'prog-3',
      child_id: selectedChildId,
      skill_name: 'Trabajo en equipo',
      skill_level: 92,
      evaluation_date: '2024-10-20',
      comments: 'Sobresaliente. Siempre apoya a sus compañeros.',
    },
  ] : [];

  // Fetch academic progress for the selected child
  const { data: progressData, isLoading: loadingProgress, error, refetch } = useQuery({
    queryKey: ['academic-progress', selectedChildId],
    queryFn: async () => {
      if (!selectedChildId) return [];
      
      const { data, error } = await supabase
        .from('academic_progress')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('evaluation_date', { ascending: false });
      
      if (error) throw error;
      return data as ProgressItem[];
    },
    enabled: !!selectedChildId && !selectedChildId.startsWith('demo-'),
  });

  const progress = (progressData && progressData.length > 0) || (!selectedChildId.startsWith('demo-') && progressData)
    ? progressData
    : (selectedChildId.startsWith('demo-') ? demoProgress : []);

  const getStars = (level: number) => {
    const stars = Math.ceil(level / 20);
    return '⭐️'.repeat(stars);
  };

  const getSkillColor = (level: number) => {
    if (level >= 90) return "bg-green-500";
    if (level >= 70) return "bg-blue-500";
    if (level >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loadingChildren) {
    return <LoadingSpinner fullScreen text="Cargando información..." />;
  }

  if (!children || children.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Progreso Académico</h1>
        <EmptyState
          icon={User}
          title="No tienes hijos registrados"
          description="Agrega a tus hijos en la sección 'Mis Hijos' para ver su progreso académico y deportivo."
          actionLabel="Ir a Mis Hijos"
          onAction={() => window.location.href = '/children'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Progreso Académico</h1>
          <p className="text-muted-foreground mt-1">
            Seguimiento del desarrollo deportivo de tus hijos
          </p>
        </div>
        
        <div className="w-full md:w-64">
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un hijo" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingProgress ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner text="Cargando evaluaciones..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Error al cargar"
          message="No pudimos cargar el progreso académico. Por favor intenta nuevamente."
          onRetry={refetch}
        />
      ) : !progress || progress.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Aún no hay evaluaciones"
          description="Tu hijo aún no tiene registros de progreso académico. Las evaluaciones de sus entrenadores aparecerán aquí."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Skills Overview */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle>Habilidades Actuales</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Filter unique skills to show latest status */}
              {progress
                .filter((item, index, self) =>
                  index === self.findIndex((t) => t.skill_name === item.skill_name)
                )
                .map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.skill_name}</span>
                        <span className="text-xs text-muted-foreground" title="Nivel de habilidad">
                          {getStars(item.skill_level)}
                        </span>
                      </div>
                      <Badge variant={item.skill_level >= 80 ? "default" : "secondary"}>
                        {item.skill_level}%
                      </Badge>
                    </div>
                    <Progress 
                      value={item.skill_level} 
                      className="h-2" 
                      // Custom logic for color could be added via inline styles or className manipulation if component supports it
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      Última actualización: {new Date(item.evaluation_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* History / Comments */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle>Historial de Evaluaciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {progress
                .filter((item) => item.comments)
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-background">
                          {item.skill_name}
                        </Badge>
                        <Badge className={item.skill_level >= 80 ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"}>
                          {item.skill_level}%
                        </Badge>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(item.evaluation_date).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    
                    {item.comments && (
                      <div className="bg-muted/30 p-3 rounded-md mt-1">
                        <p className="text-sm text-foreground italic">"{item.comments}"</p>
                      </div>
                    )}
                  </div>
                ))}

              {progress.filter((item) => item.comments).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No hay evaluaciones con comentarios detallados aún</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}