import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Dumbbell, Calendar, Clock, Play, Flame } from 'lucide-react';
import { useState } from 'react';

interface Training {
  id: string;
  title: string;
  type: string;
  duration: number;
  scheduledDate: string;
  status: 'completed' | 'pending' | 'missed';
  calories?: number;
}

export default function TrainingPage() {
  const { user } = useAuth();
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  const [trainings] = useState<Training[]>(isDemoUser ? [
    {
      id: '1',
      title: 'Entrenamiento de fuerza',
      type: 'Fuerza',
      duration: 60,
      scheduledDate: '2024-10-28T08:00:00',
      status: 'completed',
      calories: 450,
    },
    {
      id: '2',
      title: 'Cardio intensivo',
      type: 'Cardio',
      duration: 45,
      scheduledDate: '2024-10-29T07:00:00',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Técnica de balón',
      type: 'Técnica',
      duration: 90,
      scheduledDate: '2024-10-30T16:00:00',
      status: 'pending',
    },
  ] : []);

  const getStatusBadge = (status: Training['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-[hsl(119,60%,32%)] text-white">Completado</Badge>;
      case 'pending':
        return <Badge className="bg-[hsl(35,97%,55%)] text-white">Pendiente</Badge>;
      case 'missed':
        return <Badge variant="destructive">Perdido</Badge>;
    }
  };

  const todayTraining = trainings.find(t => t.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-poppins">Entrenamientos</h1>
        <p className="text-muted-foreground mt-1 font-poppins">
          Tu plan de entrenamiento personalizado
        </p>
      </div>

      {/* Today's Training Card */}
      {todayTraining && (
        <Card className="border-primary border-2 bg-gradient-to-br from-primary/10 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-poppins">Próximo entrenamiento</p>
                <h2 className="text-2xl font-bold font-poppins mt-1">{todayTraining.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {todayTraining.duration} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(todayTraining.scheduledDate).toLocaleDateString('es-CO')}
                  </span>
                </div>
              </div>
              <Button size="lg" className="gap-2">
                <Play className="h-5 w-5" />
                Iniciar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Dumbbell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Esta semana</p>
                <p className="text-2xl font-bold font-poppins">
                  {trainings.filter(t => t.status === 'completed').length} sesiones
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(35,97%,55%)]/10">
                <Flame className="h-6 w-6 text-[hsl(35,97%,55%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calorías quemadas</p>
                <p className="text-2xl font-bold font-poppins">
                  {trainings.reduce((acc, t) => acc + (t.calories || 0), 0)} kcal
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiempo total</p>
                <p className="text-2xl font-bold font-poppins">
                  {trainings.filter(t => t.status === 'completed').reduce((acc, t) => acc + t.duration, 0)} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Training List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <Calendar className="h-5 w-5 text-primary" />
            Plan de Entrenamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trainings.map((training) => (
            <div
              key={training.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold font-poppins">{training.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>{training.type}</span>
                    <span>•</span>
                    <span>{training.duration} min</span>
                    {training.calories && (
                      <>
                        <span>•</span>
                        <span>{training.calories} kcal</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(training.status)}
                {training.status === 'pending' && (
                  <Button size="sm" className="gap-1">
                    <Play className="h-4 w-4" />
                    Iniciar
                  </Button>
                )}
              </div>
            </div>
          ))}

          {trainings.length === 0 && (
            <div className="text-center py-8">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-poppins">
                No hay entrenamientos programados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
