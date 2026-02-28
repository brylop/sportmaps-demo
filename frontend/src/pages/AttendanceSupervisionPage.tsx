import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  AlertCircle, CheckCircle2, Clock, XCircle, Lock, Edit2, Users,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SessionRow {
  id: string;
  team_id: string;
  session_date: string;
  finalized: boolean;
  finalized_at?: string;
  teams: { name: string; coach_id: string };
  coachName?: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  totalCount: number;
}

interface AttendanceRecord {
  child_id: string;
  status: string;
  childName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: Date) => d.toISOString().split('T')[0];

const statusLabel: Record<string, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Tarde',
  excused: 'Excusado',
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'present') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'absent') return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === 'late') return <Clock className="w-4 h-4 text-yellow-500" />;
  return <AlertCircle className="w-4 h-4 text-blue-500" />;
};

// ── Componente ────────────────────────────────────────────────────────────────
export default function AttendanceSupervisionPage() {
  const { schoolId } = useSchoolContext();
  const [date, setDate] = useState<Date>(new Date());
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const selectedDate = fmt(date);

  // ── 1. Sesiones del día seleccionado ────────────────────────────────────
  const { data: sessions = [], isLoading: loadingSessions } = useQuery<SessionRow[]>({
    queryKey: ['supervision-sessions', schoolId, selectedDate],
    queryFn: async () => {
      if (!schoolId) return [];

      // Sesiones registradas ese día
      const { data: sessionsData, error: sessErr } = await (supabase
        .from('attendance_sessions' as any)
        .select('id, team_id, session_date, finalized, finalized_at, teams(name, coach_id)')
        .eq('session_date', selectedDate) as any);

      if (sessErr) throw sessErr;

      const rows = (sessionsData || []) as any[];

      // Resolver nombres de coaches desde profiles
      const coachIds = [...new Set(rows.map((r: any) => r.teams?.coach_id).filter(Boolean))] as string[];
      let profileMap: Record<string, string> = {};
      if (coachIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', coachIds);
        profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
      }

      // Conteos de asistencia por sesión
      const teamIds = rows.map((r: any) => r.team_id);
      const recordsMap: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};

      if (teamIds.length > 0) {
        const { data: records } = await supabase
          .from('attendance_records')
          .select('child_id, status, program_id')
          .in('program_id', teamIds)
          .eq('attendance_date', selectedDate);

        (records || []).forEach((r: any) => {
          if (!recordsMap[r.program_id]) {
            recordsMap[r.program_id] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
          }
          recordsMap[r.program_id].total++;
          if (r.status === 'present') recordsMap[r.program_id].present++;
          else if (r.status === 'absent') recordsMap[r.program_id].absent++;
          else if (r.status === 'late') recordsMap[r.program_id].late++;
          else if (r.status === 'excused') recordsMap[r.program_id].excused++;
        });
      }

      return rows.map((r: any) => ({
        id: r.id,
        team_id: r.team_id,
        session_date: r.session_date,
        finalized: r.finalized,
        finalized_at: r.finalized_at,
        teams: r.teams,
        coachName: profileMap[r.teams?.coach_id] ?? 'Sin asignar',
        ...(recordsMap[r.team_id] ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 }),
        presentCount: recordsMap[r.team_id]?.present ?? 0,
        absentCount: recordsMap[r.team_id]?.absent ?? 0,
        lateCount: recordsMap[r.team_id]?.late ?? 0,
        excusedCount: recordsMap[r.team_id]?.excused ?? 0,
        totalCount: recordsMap[r.team_id]?.total ?? 0,
      })) as SessionRow[];
    },
    enabled: !!schoolId,
  });

  // ── 2. Equipos sin sesión ese día (pendientes) ──────────────────────────
  const { data: pendingTeams = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['supervision-pending', schoolId, selectedDate],
    queryFn: async () => {
      if (!schoolId) return [];

      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('status', 'active');

      const registeredIds = new Set(sessions.map((s) => s.team_id));
      return (allTeams || []).filter((t: any) => !registeredIds.has(t.id));
    },
    enabled: !!schoolId && sessions.length >= 0,
  });

  // ── 3. Detalle de estudiantes de la sesión seleccionada ─────────────────
  const { data: detailRecords = [], isLoading: loadingDetail } = useQuery<AttendanceRecord[]>({
    queryKey: ['session-detail', selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession) return [];

      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('child_id, status')
        .eq('program_id', selectedSession.team_id)
        .eq('attendance_date', selectedSession.session_date);

      if (error) throw error;

      const childIds = (records || []).map((r: any) => r.child_id);
      if (childIds.length === 0) return [];

      const { data: children } = await supabase
        .from('children')
        .select('id, full_name')
        .in('id', childIds);

      const nameMap = Object.fromEntries((children || []).map((c: any) => [c.id, c.full_name]));

      return (records || []).map((r: any) => ({
        child_id: r.child_id,
        status: r.status,
        childName: nameMap[r.child_id] ?? 'Desconocido',
      })).sort((a, b) => a.childName.localeCompare(b.childName));
    },
    enabled: !!selectedSession,
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supervisión de Asistencias</h1>
        <p className="text-muted-foreground">Monitoreo de registro por entrenadores</p>
      </div>

      {/* Alerta de equipos sin registro */}
      {pendingTeams.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{pendingTeams.length} equipo{pendingTeams.length !== 1 ? 's' : ''} sin registro</strong>{' '}
            para el {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}:{' '}
            {pendingTeams.map((t) => t.name).join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendario de Sesiones</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Lista de sesiones */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Sesiones —{' '}
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <LoadingSpinner text="Cargando sesiones..." />
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No hay sesiones registradas para este día.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className="w-full text-left flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{session.teams?.name}</h3>
                        {session.finalized ? (
                          <Badge className="bg-green-500 gap-1">
                            <Lock className="w-3 h-3" /> Finalizada
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Edit2 className="w-3 h-3" /> En edición
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {session.coachName}
                      </p>
                      {session.totalCount > 0 && (
                        <div className="flex gap-3 mt-2 text-sm">
                          <span className="text-green-600">✓ {session.presentCount}</span>
                          <span className="text-yellow-600">⏱ {session.lateCount}</span>
                          <span className="text-blue-600">◎ {session.excusedCount}</span>
                          <span className="text-red-600">✗ {session.absentCount}</span>
                          <span className="text-muted-foreground">/ {session.totalCount} total</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground ml-4">Ver detalle →</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal detalle de sesión */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSession?.teams?.name} —{' '}
              {selectedSession &&
                new Date(selectedSession.session_date + 'T12:00:00').toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'long',
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            {selectedSession?.finalized ? (
              <Badge className="bg-green-500 gap-1"><Lock className="w-3 h-3" /> Finalizada</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><Edit2 className="w-3 h-3" /> En edición</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Entrenador: {selectedSession?.coachName}
            </span>
          </div>

          {loadingDetail ? (
            <LoadingSpinner text="Cargando estudiantes..." />
          ) : detailRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Sin registros.</p>
          ) : (
            <div className="space-y-2">
              {detailRecords.map((record) => (
                <div
                  key={record.child_id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={record.status} />
                    <span className="font-medium text-sm">{record.childName}</span>
                  </div>
                  <Badge
                    variant={
                      record.status === 'present' ? 'default'
                        : record.status === 'late' ? 'secondary'
                          : record.status === 'excused' ? 'secondary'
                            : 'destructive'
                    }
                  >
                    {statusLabel[record.status] ?? record.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}