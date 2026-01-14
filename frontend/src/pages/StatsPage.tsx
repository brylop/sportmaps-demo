import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
<<<<<<< HEAD
=======
import { useTrainingLogs, useAthleteStats, useTrainingAggregates } from '@/hooks/useAthleteData';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import {
  BarChart3,
  TrendingUp,
  Trophy,
  Target,
  Calendar,
  Activity,
  Clock,
  Flame
} from 'lucide-react';

export default function StatsPage() {
<<<<<<< HEAD
  const { profile } = useAuth();

  const performanceData = [
    { month: 'Ene', value: 65 },
    { month: 'Feb', value: 72 },
    { month: 'Mar', value: 68 },
    { month: 'Abr', value: 78 },
    { month: 'May', value: 85 },
    { month: 'Jun', value: 82 }
  ];

  const stats = {
    overall: {
      matches: 45,
      wins: 32,
      draws: 8,
      losses: 5,
      goals: 87,
      assists: 34,
      minutesPlayed: 3420
    },
    recent: {
      last5: ['W', 'W', 'D', 'W', 'L'],
      streak: 3,
      form: 85
    },
    personal: {
      topSpeed: 32.5,
      distance: 245.3,
      stamina: 92,
      technique: 88
    }
  };

  const winRate = Math.round((stats.overall.wins / stats.overall.matches) * 100);
=======
  const { profile, user } = useAuth();
  const { data: trainingLogs, isLoading: logsLoading } = useTrainingLogs();
  const { data: athleteStats, isLoading: statsLoading } = useAthleteStats();
  const aggregates = useTrainingAggregates();

  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');
  const isLoading = logsLoading || statsLoading;

  // Calculate stats from real data or use defaults
  const totalSessions = trainingLogs?.length || 0;
  const totalMinutes = trainingLogs?.reduce((acc, log) => acc + log.duration_minutes, 0) || 0;
  const totalCalories = trainingLogs?.reduce((acc, log) => acc + (log.calories_burned || 0), 0) || 0;
  
  // Get specific stats
  const maxSpeed = athleteStats?.find(s => s.stat_type === 'Velocidad máxima')?.value || 0;
  const totalDistance = athleteStats?.filter(s => s.stat_type === 'Distancia recorrida')
    .reduce((acc, s) => acc + Number(s.value), 0) || 0;
  const totalSprints = athleteStats?.filter(s => s.stat_type === 'Sprints')
    .reduce((acc, s) => acc + Number(s.value), 0) || 0;

  // Group training by week for chart
  const performanceData = trainingLogs?.slice(0, 7).reverse().map(log => ({
    day: new Date(log.training_date).toLocaleDateString('es', { weekday: 'short' }),
    value: Math.min(100, Math.round((log.duration_minutes / 90) * 100)),
    type: log.exercise_type
  })) || [];

  // Recent intensity distribution
  const intensityBreakdown = {
    max: trainingLogs?.filter(l => l.intensity === 'max').length || 0,
    high: trainingLogs?.filter(l => l.intensity === 'high').length || 0,
    medium: trainingLogs?.filter(l => l.intensity === 'medium').length || 0,
    low: trainingLogs?.filter(l => l.intensity === 'low').length || 0,
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando estadísticas..." />;
  }

  const hasData = totalSessions > 0;
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Estadísticas
        </h1>
        <p className="text-muted-foreground mt-1">
          Tu rendimiento y progreso deportivo
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Trophy className="h-8 w-8 text-primary" />
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
<<<<<<< HEAD
                +12%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Tasa de Victoria</p>
            <p className="text-3xl font-bold">{winRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overall.wins} victorias en {stats.overall.matches} partidos
=======
                Activo
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Sesiones Totales</p>
            <p className="text-3xl font-bold">{totalSessions}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 30 días
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
<<<<<<< HEAD
              <Target className="h-8 w-8 text-orange-500" />
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                Top 5%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Goles</p>
            <p className="text-3xl font-bold">{stats.overall.goals}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overall.assists} asistencias
=======
              <Flame className="h-8 w-8 text-orange-500" />
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                {totalCalories > 0 ? '+' + Math.round(totalCalories / totalSessions) + '/sesión' : '-'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Calorías Quemadas</p>
            <p className="text-3xl font-bold">{totalCalories.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              kcal totales
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
<<<<<<< HEAD
              <Flame className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                {stats.recent.streak} partidos
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Racha Actual</p>
            <p className="text-3xl font-bold">{stats.recent.streak}W</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sin perder
=======
              <Target className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                {maxSpeed > 0 ? maxSpeed + ' km/h' : '-'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Velocidad Máxima</p>
            <p className="text-3xl font-bold">{maxSpeed.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              km/h registrados
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-purple-500" />
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
<<<<<<< HEAD
                57h
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Minutos Jugados</p>
            <p className="text-3xl font-bold">
              {Math.round(stats.overall.minutesPlayed / 60)}h
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Este mes
=======
                {Math.round(totalMinutes / 60)}h
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Tiempo de Entrenamiento</p>
            <p className="text-3xl font-bold">
              {totalMinutes}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              minutos totales
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="physical">Físico</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
<<<<<<< HEAD
                  Evolución Mensual
                </CardTitle>
                <CardDescription>
                  Tu rendimiento en los últimos 6 meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-2">
                  {performanceData.map((data, index) => (
                    <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all hover:scale-105 animate-in slide-in-from-bottom"
                        style={{
                          height: `${data.value}%`,
                          animationDelay: `${index * 100}ms`
                        }}
                      />
                      <span className="text-xs text-muted-foreground">{data.month}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Form */}
=======
                  Actividad Reciente
                </CardTitle>
                <CardDescription>
                  Tus últimas sesiones de entrenamiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 ? (
                  <div className="h-64 flex items-end justify-between gap-2">
                    {performanceData.map((data, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all hover:scale-105 animate-in slide-in-from-bottom"
                          style={{
                            height: `${data.value}%`,
                            animationDelay: `${index * 100}ms`
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{data.day}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No hay datos de entrenamiento aún
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Intensity Distribution */}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
<<<<<<< HEAD
                  Forma Reciente
                </CardTitle>
                <CardDescription>
                  Últimos 5 partidos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 justify-center">
                  {stats.recent.last5.map((result, index) => (
                    <div
                      key={index}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white animate-in zoom-in ${
                        result === 'W' ? 'bg-green-500' :
                        result === 'D' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {result}
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Forma</span>
                    <span className="text-sm font-medium">{stats.recent.form}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-1000 animate-in slide-in-from-left"
                      style={{ width: `${stats.recent.form}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Estadísticas Detalladas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Partidos Jugados</p>
                  <p className="text-2xl font-bold">{stats.overall.matches}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Victorias / Empates / Derrotas</p>
                  <p className="text-2xl font-bold">
                    {stats.overall.wins} / {stats.overall.draws} / {stats.overall.losses}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Goles + Asistencias</p>
                  <p className="text-2xl font-bold">
                    {stats.overall.goals + stats.overall.assists}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
=======
                  Distribución de Intensidad
                </CardTitle>
                <CardDescription>
                  Cómo se distribuyen tus entrenamientos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasData ? (
                  <>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                          Máxima
                        </span>
                        <span className="text-sm font-medium">{intensityBreakdown.max} sesiones</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${totalSessions > 0 ? (intensityBreakdown.max / totalSessions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                          Alta
                        </span>
                        <span className="text-sm font-medium">{intensityBreakdown.high} sesiones</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${totalSessions > 0 ? (intensityBreakdown.high / totalSessions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                          Media
                        </span>
                        <span className="text-sm font-medium">{intensityBreakdown.medium} sesiones</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${totalSessions > 0 ? (intensityBreakdown.medium / totalSessions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                          Baja
                        </span>
                        <span className="text-sm font-medium">{intensityBreakdown.low} sesiones</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${totalSessions > 0 ? (intensityBreakdown.low / totalSessions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No hay datos de intensidad aún
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        </TabsContent>

        {/* Physical Tab */}
        <TabsContent value="physical" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
<<<<<<< HEAD
                <CardTitle>Capacidades Físicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Resistencia</span>
                    <span className="text-sm font-medium">{stats.personal.stamina}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-600"
                      style={{ width: `${stats.personal.stamina}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Técnica</span>
                    <span className="text-sm font-medium">{stats.personal.technique}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{ width: `${stats.personal.technique}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Velocidad</span>
                    <span className="text-sm font-medium">{stats.personal.topSpeed} km/h</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                      style={{ width: '88%' }}
                    />
                  </div>
=======
                <CardTitle>Métricas de Rendimiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Distancia Total</span>
                  <span className="font-bold">{totalDistance.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Velocidad Máxima</span>
                  <span className="font-bold">{maxSpeed} km/h</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Sprints Totales</span>
                  <span className="font-bold">{totalSprints}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Promedio por Sesión</span>
                  <span className="font-bold">
                    {totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0} min
                  </span>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
<<<<<<< HEAD
                <CardTitle>Métricas de Rendimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Distancia Recorrida</span>
                    <span className="font-bold">{stats.personal.distance} km</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Velocidad Máxima</span>
                    <span className="font-bold">{stats.personal.topSpeed} km/h</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Promedio por Partido</span>
                    <span className="font-bold">
                      {(stats.personal.distance / stats.overall.matches).toFixed(1)} km
                    </span>
                  </div>
                </div>
=======
                <CardTitle>Estadísticas Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                {athleteStats && athleteStats.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {athleteStats.slice(0, 6).map((stat) => (
                      <div key={stat.id} className="flex justify-between items-center p-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{stat.stat_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(stat.stat_date).toLocaleDateString('es')}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {stat.value} {stat.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No hay estadísticas registradas
                  </div>
                )}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
<<<<<<< HEAD
              <CardTitle>Próximamente</CardTitle>
              <CardDescription>
                Historial completo de partidos y eventos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Esta sección estará disponible próximamente
                </p>
              </div>
=======
              <CardTitle>Historial de Entrenamientos</CardTitle>
              <CardDescription>
                Tus sesiones de entrenamiento recientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trainingLogs && trainingLogs.length > 0 ? (
                <div className="space-y-3">
                  {trainingLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{log.exercise_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.training_date).toLocaleDateString('es', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{log.duration_minutes} min</p>
                        <Badge 
                          variant="outline"
                          className={
                            log.intensity === 'max' ? 'border-red-500 text-red-500' :
                            log.intensity === 'high' ? 'border-orange-500 text-orange-500' :
                            log.intensity === 'medium' ? 'border-yellow-500 text-yellow-600' :
                            'border-green-500 text-green-500'
                          }
                        >
                          {log.intensity === 'max' ? 'Máxima' :
                           log.intensity === 'high' ? 'Alta' :
                           log.intensity === 'medium' ? 'Media' : 'Baja'}
                        </Badge>
                        {log.calories_burned && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {log.calories_burned} kcal
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay entrenamientos registrados aún
                  </p>
                </div>
              )}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
