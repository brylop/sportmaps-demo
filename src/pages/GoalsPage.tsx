import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Target, Plus, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  status: 'active' | 'completed' | 'pending';
}

export default function GoalsPage() {
  const { user } = useAuth();
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  const [goals] = useState<Goal[]>(isDemoUser ? [
    {
      id: '1',
      title: 'Mejorar velocidad de sprint',
      description: 'Reducir tiempo de 100m a menos de 12 segundos',
      targetDate: '2024-12-31',
      progress: 75,
      status: 'active',
    },
    {
      id: '2',
      title: 'Aumentar resistencia cardiovascular',
      description: 'Completar 5km en menos de 25 minutos',
      targetDate: '2024-11-30',
      progress: 100,
      status: 'completed',
    },
    {
      id: '3',
      title: 'Dominar tiro libre',
      description: 'Lograr 80% de efectividad en tiros libres',
      targetDate: '2025-01-15',
      progress: 45,
      status: 'active',
    },
  ] : []);

  const getStatusBadge = (status: Goal['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-[hsl(119,60%,32%)] text-white">Completado</Badge>;
      case 'active':
        return <Badge className="bg-[hsl(35,97%,55%)] text-white">En progreso</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-poppins">Mis Objetivos</h1>
          <p className="text-muted-foreground mt-1 font-poppins">
            Establece y rastrea tus metas deportivas
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Objetivo
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Objetivos</p>
                <p className="text-2xl font-bold font-poppins">{goals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(119,60%,32%)]/10">
                <CheckCircle2 className="h-6 w-6 text-[hsl(119,60%,32%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold font-poppins">
                  {goals.filter(g => g.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(35,97%,55%)]/10">
                <Clock className="h-6 w-6 text-[hsl(35,97%,55%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Progreso</p>
                <p className="text-2xl font-bold font-poppins">
                  {goals.filter(g => g.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <TrendingUp className="h-5 w-5 text-primary" />
            Mis Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold font-poppins">{goal.title}</h3>
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
                </div>
                {getStatusBadge(goal.status)}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium">{goal.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${goal.progress}%`,
                      backgroundColor: goal.status === 'completed' 
                        ? 'hsl(119, 60%, 32%)' 
                        : 'hsl(35, 97%, 55%)',
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Meta: {new Date(goal.targetDate).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          ))}

          {goals.length === 0 && (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-poppins">
                Aún no has establecido objetivos
              </p>
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Crear mi primer objetivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
