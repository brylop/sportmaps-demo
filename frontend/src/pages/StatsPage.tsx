import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTrainingLogs, useAthleteUnifiedStats, useAthleteStatSources, useBodyMetrics } from '@/hooks/useAthleteData';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  BarChart3, TrendingUp, Trophy, Target, Calendar,
  Activity, Clock, Flame, Scale, Ruler, HeartPulse, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StatsPage() {
  const { data: sources, isLoading: loadingSources } = useAthleteStatSources();
  const { data: metrics, isLoading: loadingMetrics } = useBodyMetrics(1);
  const [activeSource, setActiveSource] = useState<string>('all');

  const selectedSource = sources?.find(s => s.school_id === activeSource);
  const context = activeSource === 'all' ? 'all' : (selectedSource?.type ?? 'all');
  const sourceId = activeSource === 'all' ? undefined : activeSource;

  const { data: stats, isLoading: statsLoading } = useAthleteUnifiedStats(context as any, sourceId);
  const { data: trainingLogs, isLoading: logsLoading } = useTrainingLogs();

  const isLoading = statsLoading || logsLoading;

  // Datos de las tarjetas — vienen del BFF unificado
  const totalSessions  = stats?.sessions_total  ?? 0;
  const totalCalories  = stats?.total_calories  ?? 0;
  const totalMinutes   = stats?.total_minutes   ?? 0;

  // Distribución de intensidad (solo de logs libres — los PT no tienen intensity en training_logs)
  const logs = trainingLogs ?? [];
  const intensityBreakdown = {
    max:    logs.filter(l => l.intensity === 'max').length,
    high:   logs.filter(l => l.intensity === 'high').length,
    medium: logs.filter(l => l.intensity === 'medium').length,
    low:    logs.filter(l => l.intensity === 'low').length,
  };

  // Gráfica de actividad reciente (últimos 7 logs libres)
  const performanceData = logs.slice(0, 7).reverse().map(log => ({
    day:   new Date(log.training_date).toLocaleDateString('es', { weekday: 'short' }),
    value: Math.min(100, Math.round((log.duration_minutes / 90) * 100)),
    type:  log.exercise_type,
  }));

  const hasSources = sources && sources.length > 1;

  if (isLoading) return <LoadingSpinner fullScreen text="Cargando estadísticas..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Estadísticas
        </h1>
        <p className="text-muted-foreground mt-1">Tu rendimiento y progreso deportivo</p>
      </div>

      {/* Selector de contexto */}
      {hasSources && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Ver:</span>
          {[{ id: 'all', label: '📊 Todo' }, ...sources.map(s => ({
            id: s.school_id,
            label: `${s.type === 'pt' ? '💪' : '🏫'} ${s.name}`,
          }))].map(opt => (
            <button
              key={opt.id}
              onClick={() => setActiveSource(opt.id)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                activeSource === opt.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Tarjetas principales — datos del BFF */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-border/50 hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-[10px]">Activo</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Sesiones Totales</p>
            <p className="text-2xl font-bold">{totalSessions}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Últimos 30 días</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-border/50 hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 text-[10px]">
                {totalCalories > 0 && totalSessions > 0
                  ? '+' + Math.round(totalCalories / totalSessions) + '/sesión'
                  : '-'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Calorías Quemadas</p>
            <p className="text-2xl font-bold">{totalCalories.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">kcal totales</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-border/50 hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-500" />
              </div>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[10px]">
                {stats?.sessions_pt ?? 0} PT · {stats?.sessions_free ?? 0} libre
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Sesiones PT</p>
            <p className="text-2xl font-bold">{stats?.sessions_pt ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-1">con entrenador personal</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-border/50 hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-purple-500" />
              </div>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 text-[10px]">
                {Math.round(totalMinutes / 60)}h total
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Tiempo de Entrenamiento</p>
            <p className="text-2xl font-bold">{totalMinutes}</p>
            <p className="text-[10px] text-muted-foreground mt-1">minutos totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose PT vs Libre (solo si context = all y hay datos PT) */}
      {activeSource === 'all' && (stats?.sessions_pt ?? 0) > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Entrenador Personal', sessions: stats?.sessions_pt ?? 0, minutes: stats?.minutes_pt ?? 0, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'Escuela',             sessions: stats?.sessions_school ?? 0, minutes: stats?.minutes_school ?? 0, color: 'text-green-600', bg: 'bg-green-500/10' },
            { label: 'Actividad Libre',     sessions: stats?.sessions_free ?? 0, minutes: stats?.minutes_free ?? 0, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map(item => (
            <Card key={item.label} className="border-border/50">
              <CardContent className="p-3">
                <p className={`text-xs font-medium ${item.color}`}>{item.label}</p>
                <p className="text-xl font-bold mt-1">{item.sessions} <span className="text-sm font-normal text-muted-foreground">sesiones</span></p>
                <p className="text-xs text-muted-foreground">{item.minutes} min</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="physical">Físico</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* Rendimiento */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Actividad Reciente
                </CardTitle>
                <CardDescription>Tus últimas sesiones de actividad libre</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 ? (
                  <div className="h-48 flex items-end justify-between gap-2">
                    {performanceData.map((data, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all hover:scale-105"
                          style={{ height: `${Math.max(4, data.value)}%` }}
                        />
                        <span className="text-xs text-muted-foreground">{data.day}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    No hay datos de entrenamiento aún
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Distribución de Intensidad
                </CardTitle>
                <CardDescription>Actividad libre por nivel de intensidad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {logs.length > 0 ? (
                  [
                    { label: 'Máxima', key: 'max', color: 'bg-red-500' },
                    { label: 'Alta',   key: 'high', color: 'bg-orange-500' },
                    { label: 'Media',  key: 'medium', color: 'bg-yellow-500' },
                    { label: 'Baja',   key: 'low', color: 'bg-green-500' },
                  ].map(({ label, key, color }) => (
                    <div key={key}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${color}`} />
                          {label}
                        </span>
                        <span className="text-sm font-medium">
                          {intensityBreakdown[key as keyof typeof intensityBreakdown]} sesiones
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} transition-all`}
                          style={{ width: `${logs.length > 0 ? (intensityBreakdown[key as keyof typeof intensityBreakdown] / logs.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No hay datos de intensidad aún
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Físico — Métricas corporales reales */}
        <TabsContent value="physical" className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          {metrics && metrics.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Peso */}
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Scale className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Peso Actual</span>
                    </div>
                    <p className="text-2xl font-bold">{metrics[0].weight_kg} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                  </CardContent>
                </Card>

                {/* IMC */}
                <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                      <Activity className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">IMC</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {(() => {
                        const w = metrics[0].weight_kg;
                        const h = metrics[0].height_cm;
                        if (!w || !h) return '—';
                        // Robustez: Si la talla es < 3, asumimos que ya está en metros (ej: 1.70)
                        const heightM = h > 3 ? h / 100 : h;
                        return (w / Math.pow(heightM, 2)).toFixed(1);
                      })()}
                    </p>
                    <div className="mt-1">
                      {(() => {
                        const w = metrics[0].weight_kg;
                        const h = metrics[0].height_cm;
                        if (!w || !h) return null;
                        const heightM = h > 3 ? h / 100 : h;
                        const val = w / Math.pow(heightM, 2);
                        
                        let status = { label: 'Normal', color: 'text-green-600 bg-green-500/10' };
                        if (val < 18.5) status = { label: 'Bajo peso', color: 'text-blue-500 bg-blue-500/10' };
                        else if (val < 25) status = { label: 'Normal', color: 'text-green-600 bg-green-500/10' };
                        else if (val < 30) status = { label: 'Sobrepeso', color: 'text-orange-500 bg-orange-500/10' };
                        else status = { label: 'Obesidad', color: 'text-red-500 bg-red-500/10' };

                        return (
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* % Grasa */}
                <Card className="bg-gradient-to-br from-orange-500/5 to-transparent border-orange-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-orange-500">
                      <HeartPulse className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">% Grasa</span>
                    </div>
                    <p className="text-2xl font-bold">{metrics[0].body_fat_pct ?? '—'} <span className="text-xs font-normal text-muted-foreground">%</span></p>
                  </CardContent>
                </Card>

                {/* Masa Muscular */}
                <Card className="bg-gradient-to-br from-green-500/5 to-transparent border-green-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Músculo</span>
                    </div>
                    <p className="text-2xl font-bold">{metrics[0].muscle_mass_kg ?? '—'} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                  </CardContent>
                </Card>
              </div>

              {/* Acceso a Wellness */}
              <Card className="overflow-hidden border-dashed">
                <CardContent className="p-0">
                  <Link
                    to="/wellness"
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Ruler className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Ver detalle de bienestar</p>
                        <p className="text-xs text-muted-foreground">Medidas corporales y evolución completa</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Métricas Físicas</CardTitle>
                <CardDescription>Evolución de tus medidas corporales</CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="mb-4">No has registrado mediciones corporales recientemente.</p>
                <Button asChild variant="outline">
                  <Link to="/wellness">Ir a Mi Bienestar</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Historial */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Entrenamientos</CardTitle>
              <CardDescription>Actividad libre registrada</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length > 0 ? (
                <div className="space-y-3">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{log.exercise_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.training_date).toLocaleDateString('es', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                        {log.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{log.notes}"</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{log.duration_minutes} min</p>
                        <Badge variant="outline" className={
                          log.intensity === 'max'    ? 'border-red-500 text-red-500' :
                          log.intensity === 'high'   ? 'border-orange-500 text-orange-500' :
                          log.intensity === 'medium' ? 'border-yellow-500 text-yellow-600' :
                                                       'border-green-500 text-green-500'
                        }>
                          {log.intensity === 'max' ? 'Máxima' : log.intensity === 'high' ? 'Alta' : log.intensity === 'medium' ? 'Media' : 'Baja'}
                        </Badge>
                        {log.calories_burned && (
                          <p className="text-xs text-muted-foreground mt-1">{log.calories_burned} kcal</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay entrenamientos registrados aún</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
