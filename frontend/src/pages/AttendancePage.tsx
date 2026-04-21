import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, CheckCircle2, XCircle, Clock, AlertCircle, Dumbbell, User } from 'lucide-react';

export default function AttendancePage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChildId, setSelectedChildId] = useState<string>(id || searchParams.get('childId') || '');

  // ── 1. Hijos del padre ──────────────────────────────────────────────────
  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent-children-attendance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name, avatar_url')
        .eq('parent_id', user?.id)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Sincronizar estado si cambia el query param
  useEffect(() => {
    const childId = searchParams.get('childId');
    if (childId && childId !== selectedChildId) {
      setSelectedChildId(childId);
    }
  }, [searchParams]);

  const handleChildChange = (id: string) => {
    setSelectedChildId(id);
    setSearchParams({ childId: id });
  };

  // ── 2. Asistencia escuela ───────────────────────────────────────────────
  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', selectedChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('class_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChildId,
  });

  // ── 3. Sesiones PT ──────────────────────────────────────────────────────
  const { data: ptSessions } = useQuery({
    queryKey: ['child-pt-attendance', selectedChildId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('id, name, status, session_date, trainer_id')
        .eq('client_id', selectedChildId)
        .in('status', ['completed', 'assigned'])
        .order('session_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedChildId,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'absent':  return <XCircle className="h-5 w-5 text-red-500" />;
      case 'late':    return <Clock className="h-5 w-5 text-yellow-500" />;
      default:        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Presente</Badge>;
      case 'absent':  return <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-500/30">Ausente</Badge>;
      case 'late':    return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Tardanza</Badge>;
      default:        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const stats = {
    total: attendance?.length || 0,
    present: attendance?.filter(a => a.status === 'present').length || 0,
    late: attendance?.filter(a => a.status === 'late').length || 0,
    absent: attendance?.filter(a => a.status === 'absent').length || 0,
  };

  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
  const hasPT = (ptSessions?.length ?? 0) > 0;
  const ptPresent = ptSessions?.filter(s => s.status === 'completed').length ?? 0;

  if (loadingChildren || (loadingAttendance && selectedChildId)) {
    return <LoadingSpinner fullScreen text="Cargando asistencias..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header unificado con selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registro de Asistencia</h1>
          <p className="text-muted-foreground mt-1">
            Seguimiento de puntualidad y constancia deportiva
          </p>
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
                  {children.map((child: any) => (
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
          {/* Summary Cards Premium */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-lg shadow-primary/5 overflow-hidden group">
              <CardContent className="p-5 relative">
                <Calendar className="absolute -right-2 -bottom-2 h-16 w-16 text-primary/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Tasa</p>
                </div>
                <p className="text-4xl font-black text-primary">{attendanceRate}%</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20 shadow-lg shadow-green-500/5 overflow-hidden group">
              <CardContent className="p-5 relative">
                <CheckCircle2 className="absolute -right-2 -bottom-2 h-16 w-16 text-green-500/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Presente</p>
                </div>
                <p className="text-4xl font-black text-green-600 dark:text-green-500">{stats.present}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-500/20 shadow-lg shadow-red-500/5 overflow-hidden group">
              <CardContent className="p-5 relative">
                <XCircle className="absolute -right-2 -bottom-2 h-16 w-16 text-red-500/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Ausente</p>
                </div>
                <p className="text-4xl font-black text-red-600 dark:text-red-500">{stats.absent}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent border-yellow-500/20 shadow-lg shadow-yellow-500/5 overflow-hidden group">
              <CardContent className="p-5 relative">
                <Clock className="absolute -right-2 -bottom-2 h-16 w-16 text-yellow-500/5 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Tardanza</p>
                </div>
                <p className="text-4xl font-black text-yellow-600 dark:text-yellow-500">{stats.late}</p>
              </CardContent>
            </Card>

            {hasPT && (
              <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 shadow-lg overflow-hidden group md:col-span-4">
                <CardContent className="p-4 flex items-center gap-6">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Entrenador Personal</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="text-2xl font-black text-indigo-500 mr-1">{ptPresent}</span>
                      sesiones completadas de {ptSessions?.length ?? 0} asignadas
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Historial de Clases
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {attendance?.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-all group/row">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                        record.status === 'present' ? 'bg-green-500/10 text-green-500' :
                        record.status === 'absent' ? 'bg-red-500/10 text-red-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {getStatusIcon(record.status)}
                      </div>
                      <div>
                        <p className="font-bold text-foreground group-hover/row:text-primary transition-colors capitalize">
                          {new Date(record.class_date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mt-0.5">
                          Año {new Date(record.class_date).getFullYear()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                ))}
                {(!attendance || attendance.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No hay registros de asistencia escolar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {hasPT && (
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/40">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  Sesiones de Entrenador Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {ptSessions?.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-all group/row">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                          session.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                        }`}>
                          {session.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground group-hover/row:text-primary transition-colors">{session.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mt-0.5">
                            {new Date(session.session_date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                      </div>
                      <Badge className={session.status === 'completed' ? 'bg-green-500/20 text-green-700 border-green-500/30' : 'bg-primary/10 text-primary border-primary/20'}>
                        {session.status === 'completed' ? '✅ Completada' : '⏳ Pendiente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opactiy-20" />
            <h3 className="text-lg font-semibold mb-2">Selecciona un deportista</h3>
            <p className="text-muted-foreground">Elige un hijo para ver su historial completo de asistencias</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}