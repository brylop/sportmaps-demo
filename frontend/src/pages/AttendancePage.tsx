import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ChildItem {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id: string;
  child_id: string;
  attendance_date: string;
  status: string;
  program_id: string;
  teamName?: string;
  sessionFinalized?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: JSX.Element }> = {
  present: {
    label: 'Asistió',
    variant: 'default',
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
  },
  late: {
    label: 'Tarde',
    variant: 'secondary',
    icon: <Clock className="w-5 h-5 text-yellow-500" />,
  },
  excused: {
    label: 'Excusado',
    variant: 'secondary',
    icon: <AlertCircle className="w-5 h-5 text-blue-500" />,
  },
  absent: {
    label: 'Faltó',
    variant: 'destructive',
    icon: <XCircle className="w-5 h-5 text-red-500" />,
  },
};

// ── Componente ────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  // ── 1. Hijos del padre ──────────────────────────────────────────────────
  const { data: children = [], isLoading: loadingChildren } = useQuery<ChildItem[]>({
    queryKey: ['parent-children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name')
        .eq('parent_id', user?.id)
        .order('full_name');
      if (error) throw error;
      return data as ChildItem[];
    },
    enabled: !!user?.id,
  });

  // ── 2. Registros de asistencia del hijo seleccionado ────────────────────
  const {
    data: records = [],
    isLoading: loadingRecords,
    error,
    refetch,
  } = useQuery<AttendanceRecord[]>({
    queryKey: ['parent-attendance', selectedChildId],
    queryFn: async () => {
      if (!selectedChildId) return [];

      // Traer registros de attendance_records
      const { data: attendanceData, error: attErr } = await supabase
        .from('attendance_records')
        .select('child_id, attendance_date, status, program_id')
        .eq('child_id', selectedChildId)
        .order('attendance_date', { ascending: false });

      if (attErr) throw attErr;
      if (!attendanceData || attendanceData.length === 0) return [];

      // Resolver nombres de equipos
      const teamIds = [...new Set(attendanceData.map((r: any) => r.program_id))] as string[];
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
      const teamMap = Object.fromEntries((teamsData || []).map((t: any) => [t.id, t.name]));

      // Resolver estado de sesión (finalizada o no) para cada registro
      const dates = [...new Set(attendanceData.map((r: any) => r.attendance_date))] as string[];
      const { data: sessionsData } = await (supabase
        .from('attendance_sessions' as any)
        .select('team_id, session_date, finalized')
        .in('team_id', teamIds)
        .in('session_date', dates) as any);

      // Mapa: `${team_id}_${session_date}` → finalized
      const sessionMap = Object.fromEntries(
        (sessionsData || []).map((s: any) => [`${s.team_id}_${s.session_date}`, s.finalized])
      );

      return attendanceData.map((r: any, i: number) => ({
        id: `${r.child_id}_${r.attendance_date}_${r.program_id}_${i}`,
        child_id: r.child_id,
        attendance_date: r.attendance_date,
        status: r.status,
        program_id: r.program_id,
        teamName: teamMap[r.program_id] ?? '—',
        sessionFinalized: sessionMap[`${r.program_id}_${r.attendance_date}`] ?? false,
      }));
    },
    enabled: !!selectedChildId,
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = records.length > 0
    ? {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      late: records.filter((r) => r.status === 'late').length,
      excused: records.filter((r) => r.status === 'excused').length,
      absent: records.filter((r) => r.status === 'absent').length,
    }
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">
          Controla la asistencia de tus hijos a sus clases deportivas
        </p>
      </div>

      {/* Selector de hijo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Hijo</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingChildren ? (
            <LoadingSpinner text="Cargando..." />
          ) : (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un hijo para ver sus asistencias" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Contenido */}
      {selectedChildId && (
        <>
          {loadingRecords ? (
            <LoadingSpinner text="Cargando asistencias..." />
          ) : error ? (
            <ErrorState
              title="Error al cargar"
              message="No pudimos cargar las asistencias"
              onRetry={refetch}
            />
          ) : (
            <>
              {/* Stats */}
              {stats && (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold">{stats.total}</p>
                      <p className="text-sm text-muted-foreground">Clases Totales</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-green-500">{stats.present}</p>
                      <p className="text-sm text-muted-foreground">Asistencias</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-yellow-500">{stats.late}</p>
                      <p className="text-sm text-muted-foreground">Tardanzas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-blue-500">{stats.excused}</p>
                      <p className="text-sm text-muted-foreground">Excusadas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-red-500">{stats.absent}</p>
                      <p className="text-sm text-muted-foreground">Ausencias</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Historial */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <CardTitle>Historial de Asistencias</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {records.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay registros de asistencia aún.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {records.map((record) => {
                        const s = statusMap[record.status] ?? {
                          label: record.status,
                          variant: 'secondary' as const,
                          icon: <AlertCircle className="w-5 h-5" />,
                        };
                        return (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              {s.icon}
                              <div>
                                <p className="font-medium">
                                  {new Date(record.attendance_date + 'T12:00:00').toLocaleDateString('es-CO', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </p>
                                <p className="text-sm text-muted-foreground">{record.teamName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={s.variant}>{s.label}</Badge>
                              {!record.sessionFinalized && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                  En revisión
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!selectedChildId && !loadingChildren && children.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona un hijo</h3>
            <p className="text-muted-foreground">
              Elige un hijo del menú superior para ver sus asistencias
            </p>
          </CardContent>
        </Card>
      )}

      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No tienes hijos registrados en la plataforma.
          </CardContent>
        </Card>
      )}
    </div>
  );
}