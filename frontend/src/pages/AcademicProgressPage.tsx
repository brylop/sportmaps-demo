import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { TrendingUp, MessageSquare, Award, Calendar, User, Dumbbell, CheckCircle2, Clock as ClockIcon, Trophy, Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchParams, useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AcademicProgressPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChildId, setSelectedChildId] = useState<string>(id || searchParams.get('childId') || '');

  // 1. Hijos del padre
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

  // Sincronizar estado si cambia el query param o path param
  useEffect(() => {
    const childId = id || searchParams.get('childId');
    if (childId && childId !== selectedChildId) {
      setSelectedChildId(childId);
    }
  }, [searchParams, id]);

  const handleChildChange = (id: string) => {
    setSelectedChildId(id);
    setSearchParams({ childId: id });
  };

  // 2. Progreso deportivo (Escuela)
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

  // 3. Sesiones PT + Nombres de Entrenadores
  const { data: ptSessionsData, isLoading: loadingPT } = useQuery({
    queryKey: ['child-pt-sessions-full', selectedChildId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('id, name, status, session_date, trainer_id')
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
      
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      return data.map((s: any) => ({ 
        ...s, 
        trainer_name: profileMap.get(s.trainer_id) ?? 'Entrenador' 
      }));
    },
    enabled: !!selectedChildId,
  });

  // 4. Métricas Corporales
  const { data: bodyMetricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['child-body-metrics-full', selectedChildId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('body_metrics')
        .select('*')
        .eq('client_id', selectedChildId)
        .order('measured_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedChildId,
  });

  // Stats para las tarjetas
  const averageLevel = progressData?.length
    ? Math.round(progressData.reduce((a, b) => a + b.skill_level, 0) / progressData.length)
    : 0;
  
  const ptCompleted = ptSessionsData?.filter(s => s.status === 'completed').length ?? 0;
  const hasPT = (ptSessionsData?.length ?? 0) > 0;
  const lastMetric = bodyMetricsData?.[0] ?? null;

  const getStars = (level: number) => '⭐️'.repeat(Math.ceil(level / 20));

  if ((loadingProgress || loadingPT || loadingMetrics) && selectedChildId) {
    return <LoadingSpinner fullScreen text="Cargando análisis de rendimiento..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header con Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Alto Rendimiento</h1>
          <p className="text-muted-foreground mt-1">Análisis profundo del desarrollo de tus deportistas</p>
        </div>
        
        <Card className="border-primary/20 bg-primary/5 min-w-[280px]">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase font-black tracking-widest text-primary/70 mb-1">Deportista Seleccionado</p>
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
                          <AvatarFallback className="bg-primary text-[10px] text-white">{child.full_name?.charAt(0)}</AvatarFallback>
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
          {/* Tarjetas de Resumen Premium */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-lg shadow-primary/5 overflow-hidden group">
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

            <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 shadow-lg shadow-blue-500/5 overflow-hidden group">
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

            <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 shadow-lg shadow-indigo-500/5 overflow-hidden group">
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

          {/* Sistema de Pestañas Premium */}
          <Tabs defaultValue="school" className="space-y-4">
            <TabsList className={`grid w-full ${hasPT ? 'grid-cols-3' : 'grid-cols-1'}`}>
              <TabsTrigger value="school">🏫 Escuela</TabsTrigger>
              {hasPT && <TabsTrigger value="pt">💪 Entrenador PT</TabsTrigger>}
              {hasPT && <TabsTrigger value="body">📏 Métricas</TabsTrigger>}
            </TabsList>

            <TabsContent value="school" className="space-y-6">
              <Card className="border-border/40 shadow-xl shadow-primary/5 rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-bold">Evolución Competitiva</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {progressData
                    ?.filter((item, index, self) => index === self.findIndex(t => t.skill_name === item.skill_name))
                    .map(item => (
                      <div key={item.id} className="group/skill">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center group-hover/skill:bg-primary/5 transition-all">
                              <Award className="h-5 w-5 text-muted-foreground group-hover/skill:text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground group-hover/skill:text-primary transition-colors">{item.skill_name}</p>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-yellow-600">
                                {getStars(item.skill_level)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-primary border-primary/20">{item.skill_level}%</Badge>
                        </div>
                        <Progress value={item.skill_level} className="h-2" />
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card className="border-border/40 rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-bold">Feedback del Entrenador</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {progressData?.filter(i => i.comments).map(item => (
                    <div key={item.id} className="p-4 rounded-xl border border-border/40 bg-card hover:bg-muted/5 transition-all">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-black mb-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.evaluation_date).toLocaleDateString()}
                      </div>
                      <p className="font-bold mb-1">{item.skill_name}</p>
                      <p className="text-sm text-muted-foreground italic pl-3 border-l-2 border-primary/40">"{item.comments}"</p>
                    </div>
                  ))}
                  {(!progressData || progressData.filter(i => i.comments).length === 0) && (
                    <div className="text-center py-8 text-muted-foreground italic">No hay evaluaciones con comentarios aún.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pt">
              <Card className="border-border/40 rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold">Historial PT</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {ptSessionsData?.map(session => (
                      <div key={session.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${session.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
                            {session.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <ClockIcon className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{session.name}</p>
                            <p className="text-xs text-muted-foreground">💪 {session.trainer_name} · {new Date(session.session_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge className={session.status === 'completed' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}>{session.status === 'completed' ? '✅ Completada' : '⏳ Pendiente'}</Badge>
                      </div>
                    ))}
                    {(ptSessionsData?.length ?? 0) === 0 && (
                      <div className="text-center py-12 text-muted-foreground italic">No hay sesiones PT registradas.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="body">
              <Card className="border-border/40 rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold">Métricas Corporales</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {lastMetric ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Peso', value: (lastMetric as any).weight_kg, unit: 'kg' },
                          { label: 'Talla', value: (lastMetric as any).height_cm, unit: 'cm' },
                          { label: '% Grasa', value: (lastMetric as any).body_fat_pct, unit: '%' },
                          { label: 'Masa Muscular', value: (lastMetric as any).muscle_mass_kg, unit: 'kg' },
                        ].map(m => (
                          <div key={m.label} className="p-4 rounded-xl border bg-card text-center shadow-sm">
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">{m.label}</p>
                            <p className="text-xl font-black mt-1 text-primary">{m.value || '--'} <span className="text-[10px] font-medium text-muted-foreground">{m.unit}</span></p>
                          </div>
                        ))}
                      </div>
                      
                      {bodyMetricsData && bodyMetricsData.length > 1 && (
                        <div className="pt-4 border-t border-border/40">
                          <p className="text-xs font-bold text-muted-foreground mb-4 uppercase">Evolución de Peso (Últimas 8 mediciones)</p>
                          <div className="h-24 flex items-end gap-2">
                            {bodyMetricsData.slice(0, 8).reverse().map((m: any, i) => {
                               const weights = bodyMetricsData.map((x: any) => x.weight_kg).filter(Boolean);
                               const min = Math.min(...weights), max = Math.max(...weights);
                               const height = Math.max(15, ((m.weight_kg - min) / (max - min || 1)) * 100);
                               return (
                                 <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                   <div className="w-full bg-primary/40 rounded-t-lg transition-all hover:bg-primary" style={{ height: `${height}%` }} title={`${m.weight_kg}kg`} />
                                   <span className="text-[8px] text-muted-foreground">{new Date(m.measured_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                                 </div>
                               );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground italic">
                      No hay métricas corporales registradas aún.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="pt-16 pb-16 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-bold mb-2">Analítica Deportiva</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Selecciona un hijo en el menú superior para ver su análisis de rendimiento completo, métricas físicas y sesiones PT.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
