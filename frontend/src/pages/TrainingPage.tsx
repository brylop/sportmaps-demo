<<<<<<< HEAD
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
    Dumbbell,
    Calendar,
    Clock,
    MapPin,
    Users,
    TrendingUp,
    Flame,
    Play,
    CheckCircle2,
    Timer,
    Target,
    Zap
} from 'lucide-react';

interface TrainingSession {
    id: string;
    title: string;
    type: 'strength' | 'cardio' | 'technique' | 'tactical' | 'recovery';
    date: string;
    time: string;
    duration: string;
    location: string;
    coach: string;
    intensity: 'low' | 'medium' | 'high';
    status: 'upcoming' | 'completed' | 'in-progress';
}

interface ExerciseSet {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weight?: string;
    duration?: string;
    completed: boolean;
}

export default function TrainingPage() {
    const { profile } = useAuth();

    const trainingSessions: TrainingSession[] = [
        {
            id: '1',
            title: 'Entrenamiento de Fuerza',
            type: 'strength',
            date: '2026-01-15',
            time: '16:00',
            duration: '90 min',
            location: 'Gimnasio Principal',
            coach: 'Carlos Mendez',
            intensity: 'high',
            status: 'upcoming'
        },
        {
            id: '2',
            title: 'Sesión Táctica',
            type: 'tactical',
            date: '2026-01-16',
            time: '17:30',
            duration: '60 min',
            location: 'Campo Norte',
            coach: 'Laura García',
            intensity: 'medium',
            status: 'upcoming'
        },
        {
            id: '3',
            title: 'Carrera de Resistencia',
            type: 'cardio',
            date: '2026-01-14',
            time: '07:00',
            duration: '45 min',
            location: 'Pista de Atletismo',
            coach: 'Miguel Torres',
            intensity: 'high',
            status: 'completed'
        },
        {
            id: '4',
            title: 'Técnica de Tiro',
            type: 'technique',
            date: '2026-01-13',
            time: '15:00',
            duration: '60 min',
            location: 'Campo Sur',
            coach: 'Ana López',
            intensity: 'medium',
            status: 'completed'
        }
    ];

    const todayExercises: ExerciseSet[] = [
        { id: '1', name: 'Calentamiento dinámico', sets: 1, reps: '10 min', completed: true },
        { id: '2', name: 'Sentadillas', sets: 4, reps: '12', weight: '60kg', completed: true },
        { id: '3', name: 'Press de banca', sets: 4, reps: '10', weight: '50kg', completed: false },
        { id: '4', name: 'Peso muerto', sets: 3, reps: '8', weight: '80kg', completed: false },
        { id: '5', name: 'Plancha', sets: 3, reps: '60 seg', completed: false },
        { id: '6', name: 'Estiramiento', sets: 1, reps: '15 min', completed: false }
    ];

    const weeklyStats = {
        totalSessions: 5,
        completedSessions: 3,
        totalMinutes: 285,
        caloriesBurned: 2400,
        streak: 12
    };

    const getTypeColor = (type: TrainingSession['type']) => {
        switch (type) {
            case 'strength': return 'bg-red-500/10 text-red-600';
            case 'cardio': return 'bg-orange-500/10 text-orange-600';
            case 'technique': return 'bg-blue-500/10 text-blue-600';
            case 'tactical': return 'bg-purple-500/10 text-purple-600';
            case 'recovery': return 'bg-green-500/10 text-green-600';
        }
    };

    const getTypeLabel = (type: TrainingSession['type']) => {
        switch (type) {
            case 'strength': return 'Fuerza';
            case 'cardio': return 'Cardio';
            case 'technique': return 'Técnica';
            case 'tactical': return 'Táctica';
            case 'recovery': return 'Recuperación';
        }
    };

    const getIntensityIcon = (intensity: TrainingSession['intensity']) => {
        switch (intensity) {
            case 'low': return <Zap className="h-4 w-4 text-green-500" />;
            case 'medium': return <><Zap className="h-4 w-4 text-yellow-500" /><Zap className="h-4 w-4 text-yellow-500" /></>;
            case 'high': return <><Zap className="h-4 w-4 text-red-500" /><Zap className="h-4 w-4 text-red-500" /><Zap className="h-4 w-4 text-red-500" /></>;
        }
    };

    const upcomingSessions = trainingSessions.filter(s => s.status === 'upcoming');
    const completedSessions = trainingSessions.filter(s => s.status === 'completed');
    const completedExercises = todayExercises.filter(e => e.completed).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Dumbbell className="h-8 w-8 text-primary" />
                        Entrenamientos
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Tu plan de entrenamiento y progreso
                    </p>
                </div>
                <Button className="bg-gradient-hero text-white hover:opacity-90">
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Sesión
                </Button>
            </div>

            {/* Weekly Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-6 w-6 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Esta Semana</p>
                                <p className="text-xl font-bold">{weeklyStats.completedSessions}/{weeklyStats.totalSessions}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Timer className="h-6 w-6 text-blue-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">Minutos</p>
                                <p className="text-xl font-bold">{weeklyStats.totalMinutes}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Flame className="h-6 w-6 text-orange-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">Calorías</p>
                                <p className="text-xl font-bold">{weeklyStats.caloriesBurned}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-6 w-6 text-green-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">Racha</p>
                                <p className="text-xl font-bold">{weeklyStats.streak} días</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Target className="h-6 w-6 text-purple-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">Hoy</p>
                                <p className="text-xl font-bold">{completedExercises}/{todayExercises.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Today's Workout */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Dumbbell className="h-5 w-5 text-primary" />
                            Entrenamiento de Hoy
                        </CardTitle>
                        <CardDescription>
                            {completedExercises} de {todayExercises.length} ejercicios completados
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {todayExercises.map((exercise, index) => (
                                <div
                                    key={exercise.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all animate-in slide-in-from-left ${exercise.completed
                                            ? 'bg-green-500/5 border-green-500/20'
                                            : 'bg-muted/30 border-border hover:bg-muted/50'
                                        }`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    {exercise.completed ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${exercise.completed ? 'line-through text-muted-foreground' : ''}`}>
                                            {exercise.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {exercise.sets > 1 && `${exercise.sets} x `}{exercise.reps}
                                            {exercise.weight && ` @ ${exercise.weight}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Sessions */}
                <Card className="lg:col-span-2">
                    <Tabs defaultValue="upcoming" className="h-full">
                        <CardHeader className="pb-2">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="upcoming">Próximas</TabsTrigger>
                                <TabsTrigger value="completed">Completadas</TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <CardContent>
                            <TabsContent value="upcoming" className="space-y-3 mt-0">
                                {upcomingSessions.map((session, index) => (
                                    <Card
                                        key={session.id}
                                        className="animate-in slide-in-from-right"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge className={getTypeColor(session.type)}>
                                                            {getTypeLabel(session.type)}
                                                        </Badge>
                                                        <div className="flex items-center">
                                                            {getIntensityIcon(session.intensity)}
                                                        </div>
                                                    </div>
                                                    <h3 className="font-semibold">{session.title}</h3>
                                                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(session.date).toLocaleDateString('es-ES', {
                                                                weekday: 'short',
                                                                day: 'numeric',
                                                                month: 'short'
                                                            })}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {session.time} ({session.duration})
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {session.location}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="h-3 w-3" />
                                                            {session.coach}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="outline">
                                                    Ver Detalles
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </TabsContent>

                            <TabsContent value="completed" className="space-y-3 mt-0">
                                {completedSessions.map((session, index) => (
                                    <Card
                                        key={session.id}
                                        className="border-green-500/20 bg-green-500/5 animate-in slide-in-from-right"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 hidden sm:block" />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge className={getTypeColor(session.type)}>
                                                            {getTypeLabel(session.type)}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-green-600 border-green-500/30">
                                                            Completado
                                                        </Badge>
                                                    </div>
                                                    <h3 className="font-semibold">{session.title}</h3>
                                                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(session.date).toLocaleDateString('es-ES', {
                                                                weekday: 'short',
                                                                day: 'numeric',
                                                                month: 'short'
                                                            })}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {session.duration}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
}
