import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  useAthleteUnifiedStats, 
  useAthleteStatSources, 
  useBodyMetrics,
  useAthleteExerciseStats,
  useAthleteTrainingHistory 
} from '@/hooks/useAthleteData';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  BarChart3, TrendingUp, Trophy, Target, Calendar,
  Activity, Clock, Flame, Scale, Ruler, HeartPulse, ChevronRight, Dumbbell,
  ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  groupPRsByMuscle, getDisplayName,
  MUSCLE_GROUP_CONFIG, type MuscleGroup,
} from '@/lib/trainer/muscleGroups';

export default function StatsPage() {
  const { data: sources, isLoading: loadingSources } = useAthleteStatSources();
  const { data: metrics, isLoading: loadingMetrics } = useBodyMetrics(1);
  const [activeSource, setActiveSource] = useState<string>('all');

  const selectedSource = sources?.find(s => s.school_id === activeSource);
  const context = activeSource === 'all' ? 'all' : (selectedSource?.type ?? 'all');
  const sourceId = activeSource === 'all' ? undefined : activeSource;

  const { data: stats, isLoading: statsLoading } = useAthleteUnifiedStats(context as any, sourceId);
  const { data: exerciseStats } = useAthleteExerciseStats(90, sourceId);
  const { data: history } = useAthleteTrainingHistory(30);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Abrir el grupo con más datos por defecto
  const groupedPRs = groupPRsByMuscle(exerciseStats?.prs ?? []);
  if (openGroups.size === 0 && groupedPRs.size > 0) {
    const first = groupedPRs.keys().next().value;
    if (first) setOpenGroups(new Set([first]));
  }

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) { next.delete(group); } else { next.add(group); }
      return next;
    });
  };

  const isLoading = statsLoading;

  // Datos de las tarjetas — vienen del BFF unificado
  const totalSessions  = stats?.sessions_total  ?? 0;
  const totalCalories  = stats?.total_calories  ?? 0;
  const totalMinutes   = stats?.total_minutes   ?? 0;

  // Helpers para categorizar PRs
  const prsByCategory = (cat: string) =>
    (exerciseStats?.prs ?? []).filter(p => p.category === cat);

  const categoryConfig = {
    strength:    { label: '💪 Fuerza',       color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    unit: 'kg',  valueSuffix: 'kg'  },
    cardio:      { label: '❤️ Cardio',        color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   unit: 'min', valueSuffix: 'min' },
    hiit:        { label: '⚡ HIIT',          color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', unit: 'rpe', valueSuffix: '/10' },
    flexibility: { label: '🧘 Flexibilidad',  color: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  unit: 'min', valueSuffix: 'min' },
  };

  // Gráfica de actividad: agrupar history por fecha
  const activityByDate = (history ?? []).reduce((acc: Record<string, { pt: number; free: number }>, item: any) => {
    const date = item._date;
    if (!acc[date]) acc[date] = { pt: 0, free: 0 };
    if (item._type === 'pt_session' && item.status === 'completed') acc[date].pt += 1;
    if (item._type === 'free_activity') acc[date].free += 1;
    return acc;
  }, {});

  const activityChartData = Object.entries(activityByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14) // últimos 14 días
    .map(([date, counts]: [string, any]) => ({
      day: new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
      PT:  counts.pt,
      Libre: counts.free,
    }));

  // Evolución del ejercicio seleccionado
  const evolutionData = selectedExercise
    ? (exerciseStats?.evolution[selectedExercise] ?? []).map(e => ({
        fecha: new Date(e.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        valor: e.value,
        unit:  e.unit,
      }))
    : [];

  const activeCats = (['strength', 'cardio', 'hiit', 'flexibility'] as const)
    .filter(cat => prsByCategory(cat).length > 0);

  const freeHistory = (history ?? []).filter((item: any) => item._type === 'free_activity');

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
        <TabsContent value="performance" className="space-y-6">

          {/* ── 1. Actividad reciente ─────────────────────────────────── */}
          <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>Sesiones en los últimos 14 días</CardDescription>
                </div>
                <div className="flex gap-4 text-[10px] uppercase font-bold tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    <span className="text-muted-foreground">PT</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Libre</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {activityChartData.length > 0 ? (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChartData} barSize={16} barGap={4}>
                      <defs>
                        <linearGradient id="barGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="barGradientIndigo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="day" 
                        tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis hide allowDecimals={false} />
                      <RechartTooltip
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                        contentStyle={{ 
                          fontSize: 12, 
                          borderRadius: '12px', 
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--background))',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                        }}
                        itemStyle={{ padding: '2px 0' }}
                      />
                      <Bar dataKey="PT" fill="url(#barGradientIndigo)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Libre" fill="url(#barGradientPrimary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-accent/20 rounded-xl border border-dashed">
                  <Calendar className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Sin actividad en las últimas 2 semanas</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 2. Records Personales por grupo muscular ────────────────── */}
          {(exerciseStats?.prs ?? []).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-bold tracking-tight">Records Personales</h3>
                <span className="text-xs text-muted-foreground ml-1">
                  · Toca un ejercicio para ver su progresión
                </span>
              </div>

              <div className="space-y-2">
                {[...groupedPRs.entries()].map(([group, groupPrs]) => {
                  const cfg    = MUSCLE_GROUP_CONFIG[group as MuscleGroup];
                  const isOpen = openGroups.has(group);

                  const unitSuffix: Record<string, string> = {
                    kg: 'kg', min: 'min', rpe: '/10', rep: 'reps',
                  };

                  return (
                    <div key={group} className={`rounded-xl border border-border/40 overflow-hidden ${cfg.border}`}>
                      {/* Header acordeón */}
                      <button
                        className={`w-full flex items-center justify-between px-4 py-3
                                    ${cfg.bg} hover:opacity-90 transition-opacity text-left`}
                        onClick={() => toggleGroup(group)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cfg.emoji}</span>
                          <span className={`text-sm font-black ${cfg.color}`}>{cfg.label}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1.5 border-0 ${cfg.bg} ${cfg.color}`}
                          >
                            {groupPrs.length}
                          </Badge>
                        </div>
                        {isOpen
                          ? <ChevronDown  className={`h-4 w-4 ${cfg.color}`} />
                          : <ChevronRight className={`h-4 w-4 ${cfg.color}`} />}
                      </button>

                      {/* Ejercicios del grupo */}
                      {isOpen && (
                        <div className="divide-y divide-border/30 bg-card">
                          {groupPrs.map(pr => (
                            <button
                              key={pr.stat_type}
                              className={`w-full flex items-center justify-between px-4 py-3
                                          text-left hover:bg-accent/30 transition-colors
                                          ${selectedExercise === pr.stat_type ? 'bg-accent/50' : ''}`}
                              onClick={() =>
                                setSelectedExercise(
                                  selectedExercise === pr.stat_type ? '' : pr.stat_type
                                )
                              }
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">
                                  {getDisplayName(pr.stat_type)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {pr.total_sets} registros
                                  {pr.pr_date && ` · PR: ${new Date(pr.pr_date + 'T12:00:00')
                                    .toLocaleDateString('es-CO', {
                                      day: 'numeric', month: 'short',
                                    })}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <p className={`text-lg font-black ${cfg.color}`}>
                                  {pr.best_value}
                                  <span className="text-xs font-normal text-muted-foreground ml-0.5">
                                    {unitSuffix[pr.unit] ?? pr.unit}
                                  </span>
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3. Progreso de un ejercicio ──────────────────────────── */}
          {(exerciseStats?.prs ?? []).length > 0 && (
            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Análisis de Progreso
                    </CardTitle>
                    <CardDescription>Evolución de carga y rendimiento histórico</CardDescription>
                  </div>
                    {!selectedExercise && (
                      <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                        <SelectTrigger className="w-full md:w-[240px] bg-background">
                          <SelectValue placeholder="O busca un ejercicio..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[...groupedPRs.entries()].flatMap(([group, prs]) =>
                            prs.map(pr => (
                              <SelectItem key={pr.stat_type} value={pr.stat_type}>
                                <span className="flex items-center gap-2">
                                  <span>{MUSCLE_GROUP_CONFIG[group as MuscleGroup]?.emoji}</span>
                                  <span className="font-medium">{getDisplayName(pr.stat_type)}</span>
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedExercise && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setSelectedExercise('')}
                      >
                        × Limpiar selección
                      </Button>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-accent/10 rounded-2xl p-6 border border-border/20">
                  {evolutionData.length >= 2 ? (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolutionData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="fecha" 
                            tick={{ fontSize: 10, opacity: 0.5 }} 
                            tickLine={false} 
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, opacity: 0.5 }} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <RechartTooltip
                            contentStyle={{ 
                              fontSize: 12, 
                              borderRadius: '12px', 
                              border: '1px solid hsl(var(--border))',
                              backgroundColor: 'hsl(var(--background))',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(val) => [
                              <span className="font-bold text-primary">{val} {evolutionData[0]?.unit ?? ''}</span>,
                              exerciseStats?.prs.find(p => p.stat_type === selectedExercise)?.display_name
                            ]}
                          />
                          <Line
                            type="monotone" 
                            dataKey="valor"
                            stroke="hsl(var(--primary))" 
                            strokeWidth={3}
                            dot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                            animationDuration={1500}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : selectedExercise ? (
                    <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground text-center px-8">
                       <TrendingUp className="h-10 w-10 mb-2 opacity-10" />
                       <p className="text-sm font-medium">Datos insuficientes</p>
                       <p className="text-xs opacity-60">Registra al menos 2 sesiones con este ejercicio para ver la tendencia.</p>
                    </div>
                  ) : (
                    <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground text-center">
                       <BarChart3 className="h-10 w-10 mb-2 opacity-10" />
                       <p className="text-sm">Selecciona un ejercicio del menú anterior</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state general */}
          {activeCats.length === 0 && activityChartData.length === 0 && (
            <Card className="border-dashed py-16">
              <CardContent className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
                  <BarChart3 className="h-8 w-8 text-muted-foreground opacity-30" />
                </div>
                <h3 className="text-lg font-bold">Sin datos de rendimiento</h3>
                <p className="text-sm text-muted-foreground max-w-[280px] mt-2">
                  Completa sesiones con tu entrenador o registra actividad libre para empezar a ver tus métricas.
                </p>
                <Button className="mt-8 rounded-full" asChild>
                   <Link to="/training">Ir a Entrenar</Link>
                </Button>
              </CardContent>
            </Card>
          )}

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
              {freeHistory.length > 0 ? (
                <div className="space-y-3">
                  {freeHistory.map((log: any) => (
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
