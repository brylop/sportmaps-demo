import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  TrendingUp, MessageSquare, Award, Calendar, User, Dumbbell,
  CheckCircle2, Clock as ClockIcon, Trophy, ChevronDown, ChevronRight,
  BarChart3, Activity, Flame, Timer,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchParams, useParams } from 'react-router-dom';
import { AthleteVisibleRoutines } from '@/components/athlete/AthleteVisibleRoutines';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WellnessModule } from '@/components/wellness/WellnessModule';
import { useChildExerciseStats } from '@/hooks/useAthleteData';
import { PerformanceEvolutionSection } from '@/components/performance/PerformanceEvolutionSection';
import {
  groupPRsByMuscle, getDisplayName,
  MUSCLE_GROUP_CONFIG, type MuscleGroup,
} from '@/lib/trainer/muscleGroups';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PtSession {
  id: string;
  name: string;
  status: string;
  session_date: string;
  trainer_name: string;
  trainer_id: string;
  blocks?: any[];
  results?: {
    blocks_results?: any[];
    performance_note?: string;
    actual_duration_minutes?: number;
  };
}

// ── Modal detalle de sesión ───────────────────────────────────────────────────

function SessionDetailModal({
  session,
  onClose,
}: {
  session: PtSession | null;
  onClose: () => void;
}) {
  if (!session) return null;

  const blocks        = session.blocks ?? [];
  const blocksResults = session.results?.blocks_results ?? [];
  const note          = session.results?.performance_note;
  const duration      = session.results?.actual_duration_minutes;

  const getResult = (idx: number) =>
    blocksResults.find((r: any) => r.block_index === idx);

  const blockTypeLabel: Record<string, string> = {
    strength:    '💪 Fuerza',
    cardio:      '❤️ Cardio',
    hiit:        '⚡ HIIT',
    flexibility: '🧘 Flexibilidad',
    warmup:      '🌡️ Calentamiento',
    cooldown:    '☕ Vuelta calma',
  };

  return (
    <Dialog open={!!session} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">{session.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              {new Date(session.session_date + 'T12:00:00').toLocaleDateString('es-CO', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </span>
            <span className="flex items-center gap-1 text-xs">
              💪 {session.trainer_name}
            </span>
            {duration && (
              <span className="flex items-center gap-1 text-xs">
                <Timer className="h-3 w-3" />
                {duration} min
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Nota del entrenador */}
          {note && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                📝 Feedback del entrenador
              </p>
              <p className="text-sm text-muted-foreground italic">"{note}"</p>
            </div>
          )}

          {/* Bloques con resultados */}
          {blocks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Ejercicios realizados
              </p>
              {blocks.map((block: any, idx: number) => {
                const result    = getResult(idx);
                const completed = result?.completed ?? false;
                const typeLabel = blockTypeLabel[block.type] ?? block.type;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-colors ${
                      completed
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-muted/20 border-border/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm">{block.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">
                          {typeLabel}
                          {block.sets && ` · ${block.sets} sets`}
                          {block.reps && ` × ${block.reps} reps`}
                          {block.duration_minutes && ` · ${block.duration_minutes} min`}
                        </p>
                      </div>
                      {completed
                        ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        : <ClockIcon    className="h-5 w-5 text-muted-foreground shrink-0" />}
                    </div>

                    {/* Resultado real del ejercicio */}
                    {result && block.type === 'strength' && (
                      <div className="flex gap-4 mt-2 pt-2 border-t border-border/20">
                        {result.actual_weight && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Peso</p>
                            <p className="text-base font-black text-primary">{result.actual_weight}</p>
                          </div>
                        )}
                        {result.actual_reps && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Reps</p>
                            <p className="text-base font-black">{result.actual_reps}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* RPE para HIIT */}
                    {result?.actual_rpe && block.type === 'hiit' && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">RPE</p>
                        <p className="text-base font-black text-purple-500">
                          {result.actual_rpe}<span className="text-xs font-normal">/10</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Sesión sin bloques definidos</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PRs agrupados por grupo muscular ─────────────────────────────────────────

function MuscleGroupPRs({
  childId,
  onSelectExercise,
  selectedExercise,
}: {
  childId: string;
  onSelectExercise: (statType: string) => void;
  selectedExercise: string;
}) {
  const { data: exerciseStats, isLoading } = useChildExerciseStats(childId, 90);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const prs = exerciseStats?.prs ?? [];

  useEffect(() => {
    if (prs.length > 0) {
      // Abrir el primer grupo por defecto
      const grouped = groupPRsByMuscle(prs);
      const first   = grouped.keys().next().value;
      if (first) setOpenGroups(new Set([first]));
    }
  }, [prs.length]);

  if (isLoading) return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (prs.length === 0) return (
    <div className="text-center py-8 text-muted-foreground">
      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-20" />
      <p className="text-sm">Completa sesiones para ver records personales</p>
    </div>
  );

  const grouped = groupPRsByMuscle(prs);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) { next.delete(group); } else { next.add(group); }
      return next;
    });
  };

  const unitSuffix: Record<string, string> = {
    kg: 'kg', min: 'min', rpe: '/10', rep: 'reps',
  };

  return (
    <div className="space-y-2">
      {[...grouped.entries()].map(([group, groupPrs]) => {
        const cfg    = MUSCLE_GROUP_CONFIG[group as MuscleGroup];
        const isOpen = openGroups.has(group);

        return (
          <div key={group} className={`rounded-xl border overflow-hidden ${cfg.border}`}>
            {/* Header del grupo */}
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
              <div className="divide-y divide-border/30">
                {groupPrs.map(pr => (
                  <button
                    key={pr.stat_type}
                    className={`w-full flex items-center justify-between px-4 py-3 
                                text-left hover:bg-accent/30 transition-colors
                                ${selectedExercise === pr.stat_type ? 'bg-accent/50' : ''}`}
                    onClick={() => onSelectExercise(
                      selectedExercise === pr.stat_type ? '' : pr.stat_type
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {getDisplayName(pr.stat_type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pr.total_sets} registros
                        {pr.pr_date && ` · PR: ${new Date(pr.pr_date + 'T12:00:00')
                          .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
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
  );
}

// ── Gráfica de evolución de un ejercicio ─────────────────────────────────────

function ExerciseEvolutionChart({
  childId,
  statType,
}: {
  childId: string;
  statType: string;
}) {
  const { data: exerciseStats } = useChildExerciseStats(childId, 90);
  const series = exerciseStats?.evolution[statType] ?? [];

  const chartData = series.map(e => ({
    fecha: new Date(e.date + 'T12:00:00').toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short',
    }),
    valor: e.value,
    unit:  e.unit,
  }));

  if (chartData.length < 2) return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      Necesitas al menos 2 sesiones con este ejercicio para ver la gráfica.
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Progreso — {getDisplayName(statType)}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData}>
          <XAxis dataKey="fecha" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
          <RechartTooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(val: any) => [
              `${val} ${chartData[0]?.unit ?? ''}`,
              getDisplayName(statType),
            ]}
          />
          <Line
            type="monotone" dataKey="valor"
            stroke="hsl(var(--primary))" strokeWidth={2.5}
            dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AcademicProgressPage() {
  const { user }   = useAuth();
  const { id }     = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedChildId, setSelectedChildId] = useState<string>(
    id || searchParams.get('childId') || ''
  );
  const [selectedSession,  setSelectedSession]  = useState<PtSession | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  // ── Queries existentes ────────────────────────────────────────────────────

  const { data: childrenData } = useQuery({
    queryKey: ['children-nav', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const children = childrenData || [];

  useEffect(() => {
    const childId = id || searchParams.get('childId');
    if (childId && childId !== selectedChildId) setSelectedChildId(childId);
  }, [searchParams, id]);

  const handleChildChange = (id: string) => {
    setSelectedChildId(id);
    setSearchParams({ childId: id });
    setSelectedExercise('');
  };

  // Progreso escuela
  const { data: progressData, isLoading: loadingProgress } = useQuery({
    queryKey: ['academic-progress', selectedChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_progress')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('evaluation_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedChildId,
  });

  // Sesiones PT (con blocks y results para el modal)
  const { data: ptSessionsData, isLoading: loadingPT } = useQuery({
    queryKey: ['child-pt-sessions-full', selectedChildId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('id, name, status, session_date, trainer_id, blocks, results')
        .eq('client_id', selectedChildId)
        .order('session_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const trainerIds = [...new Set(data.map((s: any) => s.trainer_id).filter(Boolean))];
      const { data: profiles } = await (supabase as any)
        .from('trainer_profiles')
        .select('user_id, display_name')
        .in('user_id', trainerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p.display_name])
      );
      return data.map((s: any) => ({
        ...s,
        trainer_name: profileMap.get(s.trainer_id) ?? 'Entrenador',
      }));
    },
    enabled: !!selectedChildId,
  });

  // ── Stats derivadas ───────────────────────────────────────────────────────

  const averageLevel = progressData?.length
    ? Math.round(progressData.reduce((a, b) => a + b.skill_level, 0) / progressData.length)
    : 0;

  const ptCompleted = ptSessionsData?.filter((s: any) => s.status === 'completed').length ?? 0;
  const hasPT       = (ptSessionsData?.length ?? 0) > 0;

  // Actividad reciente (últimos 14 días) para gráfica de barras
  const activityByDate = (ptSessionsData ?? []).reduce(
    (acc: Record<string, number>, s: any) => {
      if (s.status === 'completed') {
        acc[s.session_date] = (acc[s.session_date] || 0) + 1;
      }
      return acc;
    },
    {}
  );
  const activityChartData = Object.entries(activityByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({
      dia: new Date(date + 'T12:00:00').toLocaleDateString('es-CO', {
        day: 'numeric', month: 'short',
      }),
      Sesiones: count,
    }));

  const getStars = (level: number) => '⭐️'.repeat(Math.ceil(level / 20));

  const selectedChild = children.find((c: any) => c.id === selectedChildId);

  if ((loadingProgress || loadingPT) && selectedChildId) {
    return <LoadingSpinner fullScreen text="Cargando análisis de rendimiento..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header con selector ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Alto Rendimiento</h1>
          <p className="text-muted-foreground mt-1">
            Análisis profundo del desarrollo de tus deportistas
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5 min-w-[280px]">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase font-black tracking-widest text-primary/70 mb-1">
                Deportista Seleccionado
              </p>
              <Select value={selectedChildId} onValueChange={handleChildChange}>
                <SelectTrigger className="h-8 border-none bg-transparent p-0 shadow-none focus:ring-0 text-foreground font-bold">
                  <SelectValue placeholder="Elegir deportista..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  {children?.map((child: any) => (
                    <SelectItem key={child.id} value={child.id} className="rounded-lg">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-primary/20">
                          <AvatarImage src={child.avatar_url} />
                          <AvatarFallback className="bg-primary text-[10px] text-white">
                            {child.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{child.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedChildId ? (
        <>
          {/* ── Tarjetas resumen ─────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-lg overflow-hidden group">
              <CardContent className="p-5 relative">
                <Trophy className="absolute -right-2 -bottom-2 h-16 w-16 text-primary/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Rendimiento</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-4xl font-black text-primary">{averageLevel}%</p>
                  <p className="text-sm font-medium text-muted-foreground uppercase">Promedio</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 shadow-lg overflow-hidden group">
              <CardContent className="p-5 relative">
                <TrendingUp className="absolute -right-2 -bottom-2 h-16 w-16 text-blue-500/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Evaluaciones</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-4xl font-black text-blue-500">{progressData?.length || 0}</p>
                  <p className="text-sm font-medium text-muted-foreground uppercase">Habilidades</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 shadow-lg overflow-hidden group">
              <CardContent className="p-5 relative">
                <Dumbbell className="absolute -right-2 -bottom-2 h-16 w-16 text-indigo-500/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Sesiones PT</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-4xl font-black text-indigo-500">{ptCompleted}</p>
                  <p className="text-sm font-medium text-muted-foreground uppercase">Completadas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <Tabs defaultValue="school" className="space-y-4">
            <TabsList className={`grid w-full ${hasPT ? 'grid-cols-3' : 'grid-cols-1'}`}>
              <TabsTrigger value="school">🏫 Escuela</TabsTrigger>
              {hasPT && <TabsTrigger value="pt">💪 Entrenador PT</TabsTrigger>}
              {hasPT && <TabsTrigger value="body">📏 Bienestar</TabsTrigger>}
            </TabsList>

            {/* ── TAB ESCUELA — 2 columnas ───────────────────────────────── */}
            <TabsContent value="school">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* Col 1: Lista de evaluaciones (60%) */}
                <div className="lg:col-span-3 space-y-4">
                  <Card className="border-border/40 rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-bold">Evolución de Habilidades</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {progressData?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground italic">
                          Sin evaluaciones registradas aún.
                        </div>
                      )}
                      {progressData
                        ?.filter((item, index, self) =>
                          index === self.findIndex(t => t.skill_name === item.skill_name)
                        )
                        .map(item => (
                          <div key={item.id} className="group/skill">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center group-hover/skill:bg-primary/5 transition-all">
                                  <Award className="h-4 w-4 text-muted-foreground group-hover/skill:text-primary" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm group-hover/skill:text-primary transition-colors">
                                    {item.skill_name}
                                  </p>
                                  <p className="text-[10px] text-yellow-500 font-bold">
                                    {getStars(item.skill_level)}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-primary border-primary/20">
                                {item.skill_level}%
                              </Badge>
                            </div>
                            <Progress value={item.skill_level} className="h-2" />
                            {item.comments && (
                              <p className="text-xs text-muted-foreground italic mt-2 pl-3 border-l-2 border-primary/30">
                                "{item.comments}"
                              </p>
                            )}
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Col 2: Estadísticas escuela (40%) */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border-border/40 rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40 pb-3">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Últimos Feedbacks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {progressData?.filter(i => i.comments).slice(0, 3).map(item => (
                        <div key={item.id} className="p-3 rounded-xl border border-border/40 bg-card">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-black mb-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(item.evaluation_date).toLocaleDateString('es-CO', {
                              day: 'numeric', month: 'short',
                            })}
                          </div>
                          <p className="text-xs font-bold">{item.skill_name}</p>
                          <p className="text-[11px] text-muted-foreground italic mt-0.5">
                            "{item.comments}"
                          </p>
                        </div>
                      ))}
                      {(!progressData || progressData.filter(i => i.comments).length === 0) && (
                        <p className="text-center text-muted-foreground italic text-sm py-4">
                          Sin feedback aún.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Promedio por habilidad */}
                  {(progressData?.length ?? 0) > 0 && (
                    <Card className="border-border/40 rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                          Resumen Global
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Promedio general</span>
                            <span className="font-black text-primary">{averageLevel}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Habilidades evaluadas</span>
                            <span className="font-black">{progressData?.length ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Con comentarios</span>
                            <span className="font-black">
                              {progressData?.filter(i => i.comments).length ?? 0}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <PerformanceEvolutionSection
                    childId={selectedChildId}
                    title="Rendimiento Deportivo"
                    description="Métricas de tu deporte"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── TAB PT — 2 columnas ───────────────────────────────────── */}
            {hasPT && (
              <TabsContent value="pt">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                  {/* Col 1: Lista de sesiones con modal (55%) */}
                  <div className="lg:col-span-3 space-y-4">

                    {/* Actividad reciente */}
                    {activityChartData.length > 0 && (
                      <Card className="border-border/40 rounded-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Actividad Reciente
                          </CardTitle>
                          <CardDescription>Sesiones completadas por día</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={100}>
                            <BarChart data={activityChartData} barSize={16}>
                              <XAxis dataKey="dia" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                              <YAxis hide allowDecimals={false} />
                              <RechartTooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                formatter={(val) => [`${val} sesión(es)`, '']}
                              />
                              <Bar dataKey="Sesiones" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {/* Lista de sesiones — clickeable */}
                    <Card className="border-border/40 rounded-2xl overflow-hidden">
                      <CardHeader className="bg-muted/30 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base font-bold">Historial de Sesiones</CardTitle>
                        </div>
                        <CardDescription>Toca una sesión para ver el detalle</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border/40">
                          {ptSessionsData?.map((session: any) => (
                            <button
                              key={session.id}
                              className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors text-left group"
                              onClick={() => session.status === 'completed'
                                ? setSelectedSession(session)
                                : null
                              }
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0
                                  ${session.status === 'completed'
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-primary/10 text-primary'
                                  }`}>
                                  {session.status === 'completed'
                                    ? <CheckCircle2 className="h-5 w-5" />
                                    : <ClockIcon    className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-semibold text-sm truncate
                                    ${session.status === 'completed'
                                      ? 'group-hover:text-primary transition-colors'
                                      : ''}`}>
                                    {session.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    💪 {session.trainer_name} ·{' '}
                                    {new Date(session.session_date + 'T12:00:00')
                                      .toLocaleDateString('es-CO', {
                                        day: 'numeric', month: 'short', year: 'numeric',
                                      })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge
                                  className={session.status === 'completed'
                                    ? 'bg-green-500/20 text-green-700 border-green-500/30'
                                    : ''}
                                >
                                  {session.status === 'completed' ? '✅ Completada' : '⏳ Pendiente'}
                                </Badge>
                                {session.status === 'completed' && (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                )}
                              </div>
                            </button>
                          ))}
                          {(ptSessionsData?.length ?? 0) === 0 && (
                            <div className="text-center py-12 text-muted-foreground italic">
                              No hay sesiones PT registradas.
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Col 2: Estadísticas PT (45%) */}
                  <div className="lg:col-span-2 space-y-4">

                    {/* Records Personales agrupados por grupo muscular */}
                    <Card className="border-border/40 rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          Records Personales
                        </CardTitle>
                        <CardDescription>Por grupo muscular · Toca para ver progreso</CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <MuscleGroupPRs
                          childId={selectedChildId}
                          onSelectExercise={setSelectedExercise}
                          selectedExercise={selectedExercise}
                        />
                      </CardContent>
                    </Card>

                    {/* Gráfica de progreso del ejercicio seleccionado */}
                    {selectedExercise && (
                      <Card className="border-border/40 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <CardContent className="p-4">
                          <ExerciseEvolutionChart
                            childId={selectedChildId}
                            statType={selectedExercise}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {!selectedExercise && (
                      <Card className="border-dashed border-border/40 rounded-2xl">
                        <CardContent className="p-6 text-center text-muted-foreground">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">Selecciona un ejercicio para ver su progresión</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ── TAB BIENESTAR — WellnessModule completo ───────────────── */}
            {hasPT && (
              <TabsContent value="body">
                <WellnessModule
                  clientId={selectedChildId}
                  clientName={selectedChild?.full_name}
                  isTrainer={false}
                />
              </TabsContent>
            )}
          </Tabs>

          {/* ── Biblioteca de Rutinas Visibles para el Hijo (Padre visualiza) ── */}
          <div className="mt-8">
            <AthleteVisibleRoutines childId={selectedChildId} />
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-16 pb-16 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-bold mb-2">Analítica Deportiva</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Selecciona un hijo en el menú superior para ver su análisis de
              rendimiento completo, métricas físicas y sesiones PT.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Modal detalle de sesión ──────────────────────────────────────── */}
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
