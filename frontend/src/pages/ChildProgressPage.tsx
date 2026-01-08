import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, Trophy, TrendingUp, Star, Calendar } from 'lucide-react';

export default function ChildProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  // Fetch child info
  const { data: child, isLoading: loadingChild } = useQuery({
    queryKey: ['child', id],
    queryFn: async () => {
      if (id?.startsWith('demo-')) {
        // Return demo child
        return {
          id,
          full_name: id === 'demo-1' ? 'Mateo Pérez' : 'Sofía Pérez',
          sport: id === 'demo-1' ? 'Fútbol' : 'Tenis',
          team_name: id === 'demo-1' ? 'Fútbol Sub-12' : 'Tenis Infantil',
        };
      }
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('id', id)
        .eq('parent_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user?.id,
  });

  // Fetch academic progress
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['academic-progress', id],
    queryFn: async () => {
      if (id?.startsWith('demo-') || isDemoUser) {
        // Return demo progress
        return [
          { id: '1', skill_name: 'Control del balón', skill_level: 85, comments: 'Excelente mejora', evaluation_date: '2024-10-15' },
          { id: '2', skill_name: 'Velocidad', skill_level: 72, comments: 'Buen progreso', evaluation_date: '2024-10-15' },
          { id: '3', skill_name: 'Trabajo en equipo', skill_level: 90, comments: 'Sobresaliente', evaluation_date: '2024-10-15' },
          { id: '4', skill_name: 'Técnica de pase', skill_level: 78, comments: 'Mejorando cada semana', evaluation_date: '2024-10-10' },
          { id: '5', skill_name: 'Resistencia', skill_level: 65, comments: 'Necesita más práctica', evaluation_date: '2024-10-10' },
        ];
      }
      const { data, error } = await supabase
        .from('academic_progress')
        .select('*')
        .eq('child_id', id)
        .order('evaluation_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const getSkillColor = (level: number) => {
    if (level >= 80) return 'text-green-500';
    if (level >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getProgressColor = (level: number) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const calculateAverage = () => {
    if (!progress?.length) return 0;
    let total = 0;
    for (const p of progress) {
      total += p.skill_level;
    }
    return Math.round(total / progress.length);
  };
  const averageLevel = calculateAverage();

  if (loadingChild || loadingProgress) {
    return <LoadingSpinner fullScreen text="Cargando progreso..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/children')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-poppins">Progreso de {child?.full_name}</h1>
          <p className="text-muted-foreground mt-1">
            {child?.sport} - {child?.team_name}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Promedio General</p>
                <p className="text-3xl font-bold font-poppins">{averageLevel}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Habilidades Evaluadas</p>
                <p className="text-3xl font-bold font-poppins">{progress?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mejor Habilidad</p>
                <p className="text-lg font-bold font-poppins">
                  {progress?.length ? progress.reduce((a, b) => a.skill_level > b.skill_level ? a : b).skill_name : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skills Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <Trophy className="h-5 w-5 text-primary" />
            Progreso por Habilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {progress?.map((skill) => (
            <div key={skill.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{skill.skill_name}</span>
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(skill.evaluation_date).toLocaleDateString('es-CO')}
                  </Badge>
                </div>
                <span className={`font-bold ${getSkillColor(skill.skill_level)}`}>
                  {skill.skill_level}%
                </span>
              </div>
              <div className="relative">
                <Progress value={skill.skill_level} className="h-3" />
                <div 
                  className={`absolute top-0 left-0 h-3 rounded-full transition-all ${getProgressColor(skill.skill_level)}`}
                  style={{ width: `${skill.skill_level}%` }}
                />
              </div>
              {skill.comments && (
                <p className="text-sm text-muted-foreground italic">"{skill.comments}"</p>
              )}
            </div>
          ))}

          {(!progress || progress.length === 0) && (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aún no hay evaluaciones registradas</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
