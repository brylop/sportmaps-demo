import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, Trophy, TrendingUp, Star, Calendar, Dumbbell, CheckCircle2, Clock } from 'lucide-react';
import { AthleteVisibleRoutines } from '@/components/athlete/AthleteVisibleRoutines';

export default function ChildProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Datos del hijo ──────────────────────────────────────────
  const { data: child, isLoading: loadingChild } = useQuery({
    queryKey: ['child', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*, teams(name, sport)')
        .eq('id', id)
        .eq('parent_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user?.id,
  });

  // ── Progreso académico (escuela) ────────────────────────────
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['academic-progress', id],
    queryFn: async () => {
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

  // ── Sesiones PT del hijo ────────────────────────────────────
  const { data: ptSessions, isLoading: loadingPT } = useQuery({
    queryKey: ['child-pt-sessions', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('id, name, status, session_date, trainer_id')
        .eq('client_id', id)
        .order('session_date', { ascending: false })
        .limit(20);
      if (error) throw error;

      // Resolver nombres de entrenadores
      if (!data || data.length === 0) return [];
      const trainerIds = [...new Set(data.map((s: any) => s.trainer_id).filter(Boolean))];
      const { data: profiles } = await (supabase as any)
        .from('trainer_profiles')
        .select('user_id, display_name')
        .in('user_id', trainerIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      return data.map((s: any) => ({ ...s, trainer_name: profileMap.get(s.trainer_id) ?? 'Entrenador' }));
    },
    enabled: !!id,
  });

  // ── Métricas corporales del hijo ────────────────────────────
  const { data: bodyMetrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['child-body-metrics', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('body_metrics')
        .select('*')
        .eq('client_id', id)
        .order('measured_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const getSkillColor   = (level: number) => level >= 80 ? 'text-green-500' : level >= 60 ? 'text-yellow-500' : 'text-red-500';
  const getProgressColor = (level: number) => level >= 80 ? 'bg-green-500' : level >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const averageLevel = progress?.length
    ? Math.round(progress.reduce((a, b) => a + b.skill_level, 0) / progress.length)
    : 0;

  const ptCompleted = ptSessions?.filter(s => s.status === 'completed').length ?? 0;
  const ptTotal     = ptSessions?.length ?? 0;
  const hasPT       = ptTotal > 0;
  const lastMetric  = bodyMetrics?.[0] ?? null;

  if (loadingChild || loadingProgress || loadingPT) {
    return <LoadingSpinner fullScreen text="Cargando progreso..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header sticky */}
      <div className="flex items-center gap-4 bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border/40 shadow-sm sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/children')} className="rounded-full hover:bg-primary/10 hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {child?.full_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{child?.full_name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Badge variant="outline" className="text-[9px] py-0 h-4 border-primary/20 text-primary uppercase">
                {(child as any)?.teams?.sport || 'Deporte'}
              </Badge>
              <span className="opacity-40">•</span>
              <span>{(child as any)?.teams?.name || 'Sin equipo'}</span>
              {hasPT && (
                <Badge variant="secondary" className="text-[9px] h-4">💪 Tiene PT</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden group">
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

        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 overflow-hidden group">
          <CardContent className="p-5 relative">
            <TrendingUp className="absolute -right-2 -bottom-2 h-16 w-16 text-blue-500/5 group-hover:scale-110 transition-transform duration-700" />
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                <TrendingUp className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Evaluaciones</p>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-black text-blue-500">{progress?.length || 0}</p>
              <p className="text-sm font-medium text-muted-foreground uppercase">Habilidades</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 overflow-hidden group">
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
              <p className="text-sm font-medium text-muted-foreground uppercase">de {ptTotal}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="school" className="space-y-4">
        <TabsList className={`grid w-full ${hasPT ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="school">🏫 Escuela</TabsTrigger>
          {hasPT && <TabsTrigger value="pt">💪 Entrenador PT</TabsTrigger>}
          {hasPT && <TabsTrigger value="body">📏 Métricas</TabsTrigger>}
        </TabsList>

        {/* Progreso escuela */}
        <TabsContent value="school">
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolución de Habilidades
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-8">
                {progress?.map(skill => (
                  <div key={skill.id} className="group/item">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-base group-hover/item:text-primary transition-colors">{skill.skill_name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(skill.evaluation_date).toLocaleDateString('es-CO')}
                        </div>
                      </div>
                      <div className={`text-2xl font-black ${getSkillColor(skill.skill_level)}`}>
                        {skill.skill_level}<span className="text-xs ml-0.5">%</span>
                      </div>
                    </div>
                    <div className="relative h-2.5 w-full bg-muted/50 rounded-full overflow-hidden border border-border/20">
                      <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${getProgressColor(skill.skill_level)}`}
                        style={{ width: `${skill.skill_level}%` }}
                      />
                    </div>
                    {skill.comments && (
                      <div className="mt-3 p-3 bg-muted/20 rounded-xl border-l-2 border-primary/40 italic text-sm text-muted-foreground">
                        "{skill.comments}"
                      </div>
                    )}
                  </div>
                ))}
                {(!progress || progress.length === 0) && (
                  <div className="text-center py-8">
                    <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aún no hay evaluaciones registradas</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sesiones PT */}
        {hasPT && (
          <TabsContent value="pt">
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/40">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  Sesiones con Entrenador Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {ptSessions?.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          session.status === 'completed'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {session.status === 'completed'
                            ? <CheckCircle2 className="h-5 w-5" />
                            : <Clock className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{session.name}</p>
                          <p className="text-xs text-muted-foreground">
                            💪 {session.trainer_name} · {new Date(session.session_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className={session.status === 'completed' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}>
                        {session.status === 'completed' ? '✅ Completada' : '⏳ Pendiente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Métricas corporales */}
        {hasPT && (
          <TabsContent value="body">
            <Card className="border-border/50">
              <CardHeader className="bg-muted/30 border-b border-border/40">
                <CardTitle className="text-lg font-bold">📏 Métricas Corporales</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {lastMetric ? (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Última medición: {new Date((lastMetric as any).measured_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {(lastMetric as any).source === 'trainer' && <Badge variant="secondary" className="ml-2 text-[10px]">💪 Por entrenador</Badge>}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Peso',          value: (lastMetric as any).weight_kg,      unit: 'kg' },
                        { label: 'Talla',          value: (lastMetric as any).height_cm,      unit: 'cm' },
                        { label: '% Grasa',        value: (lastMetric as any).body_fat_pct,   unit: '%'  },
                        { label: 'Masa muscular',  value: (lastMetric as any).muscle_mass_kg, unit: 'kg' },
                      ].map(({ label, value, unit }) => (
                        <div key={label} className="p-3 rounded-xl border bg-card text-center">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-xl font-bold mt-1">
                            {value != null ? `${value} ${unit}` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                    {/* Historial de peso */}
                    {(bodyMetrics?.filter(m => (m as any).weight_kg).length ?? 0) > 1 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Evolución de peso</p>
                        <div className="h-24 flex items-end gap-1.5">
                          {bodyMetrics?.filter(m => (m as any).weight_kg).slice(0, 8).reverse().map((m, i) => {
                            const vals = bodyMetrics.filter(x => (x as any).weight_kg).map(x => (x as any).weight_kg as number);
                            const min = Math.min(...vals), max = Math.max(...vals);
                            const pct = Math.max(10, (((m as any).weight_kg - min) / (max - min || 1)) * 100);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[9px] text-muted-foreground">{(m as any).weight_kg}</span>
                                <div className="w-full bg-primary/60 rounded-t" style={{ height: `${pct}%` }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay métricas corporales registradas aún.</p>
                    <p className="text-xs mt-1">El entrenador puede registrarlas desde su panel.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Biblioteca de Rutinas Visibles para el Hijo (Padre visualiza) ── */}
      <div className="mt-8">
        <AthleteVisibleRoutines childId={id} />
      </div>
    </div>
  );
}
