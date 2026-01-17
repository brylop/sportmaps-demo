import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainingLogs, useAthleteStats, useTrainingAggregates } from '@/hooks/useAthleteData';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
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
                Activo
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Sesiones Totales</p>
            <p className="text-3xl font-bold">{totalSessions}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 30 días
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Flame className="h-8 w-8 text-orange-500" />
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                {totalCalories > 0 ? '+' + Math.round(totalCalories / totalSessions) + '/sesión' : '-'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Calorías Quemadas</p>
            <p className="text-3xl font-bold">{totalCalories.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              kcal totales
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Target className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                {maxSpeed > 0 ? maxSpeed + ' km/h' : '-'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Velocidad Máxima</p>
            <p className="text-3xl font-bold">{maxSpeed.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              km/h registrados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-purple-500" />
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                {Math.round(totalMinutes / 60)}h
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Tiempo de Entrenamiento</p>
            <p className="text-3xl font-bold">
              {totalMinutes}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              minutos totales
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
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
        </TabsContent>

        {/* Physical Tab */}
        <TabsContent value="physical" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
