import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle2, XCircle, Clock, AlertCircle, Users, Lock, Edit2, Flag, CalendarCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Badge } from '@/components/ui/badge';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TeamItem { id: string; name: string; }
interface StudentItem { id: string; full_name: string; photo_url?: string; athlete_type?: 'adult' | 'child' }
interface AttendanceSession {
  id: string;
  team_id: string;
  session_date: string;
  finalized: boolean;
  finalized_at?: string;
}

// ── Helper: obtener el JWT del usuario actual ─────────────────────────────────
async function getBearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('No autenticado');
  return token;
}

// Ajusta esta variable a la URL base de tu BFF
const BFF_URL = import.meta.env.VITE_BFF_URL ?? '';

// ── Componente ────────────────────────────────────────────────────────────────
export default function CoachAttendancePage() {
  const { user, profile } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);

  const isTeam = selectedItem.startsWith('team:');
  const isSession = selectedItem.startsWith('session:');
  const selectedTeamId = isTeam ? selectedItem.split(':')[1] : '';
  const selectedSessionId = isSession ? selectedItem.split(':')[1] : '';

  const isAdmin = ['admin', 'super_admin', 'school_admin', 'school'].includes(profile?.role || '');

  // ── 0. Perfil Staff del Entrenador ────────────────────────────────────────
  const { data: staffData } = useQuery({
    queryKey: ['staff-profile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase.from('school_staff').select('id').eq('email', user.email).maybeSingle();
      return data;
    },
    enabled: !!user?.email
  });
  const staffId = staffData?.id;

  // ── 1. Equipos del entrenador ─────────────────────────────────────────────
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['coach-teams', schoolId, user?.id, staffId, isAdmin],
    queryFn: async () => {
      if (!schoolId || !user?.id) return [];

      const { data: teamsData, error } = await (supabase
        .from('teams')
        .select('id, name, coach_id, team_coaches(coach_id)')
        .eq('school_id', schoolId) as any);

      if (error) throw error;

      return (teamsData || [])
        .filter((team: any) => {
          if (isAdmin) return true;
          const isDirectCoach = team.coach_id === user.id || (staffId && team.coach_id === staffId);
          const isAssigned = team.team_coaches?.some(
            (tc: any) => tc.coach_id === user.id || (staffId && tc.coach_id === staffId)
          );
          return isDirectCoach || isAssigned;
        })
        .sort((a: any, b: any) => a.name.localeCompare(b.name)) as TeamItem[];
    },
    enabled: !!schoolId && !!user?.id,
  });

  // ── 1.5. Clases Programadas Hoy (Planes) ──────────────────────────────────
  const { data: planSessions = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['coach-plan-sessions', schoolId, user?.id, staffId, isAdmin],
    queryFn: async () => {
      if (!schoolId || (!user?.id && !staffId && !isAdmin)) return [];
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('attendance_sessions')
        .select(`
          id, start_time, end_time, title,
          offering_plans!attendance_sessions_offering_id_fkey(name)
        `)
        .eq('school_id', schoolId)
        .eq('session_date', today)
        .not('offering_id', 'is', null)
        .not('finalized', 'is', true);

      if (!isAdmin) {
        query = query.eq('coach_id', staffId || user!.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.title || s.offering_plans?.name || 'Clase de Plan',
        start_time: s.start_time,
        end_time: s.end_time
      }));
    },
    enabled: !!schoolId && (!!user?.id || !!staffId || isAdmin),
  });

  // ── 2. Roster del equipo seleccionado ────────────────────────────────────
  const { data: roster = [], isLoading: loadingRoster } = useQuery<StudentItem[]>({
    queryKey: ['team-roster', selectedTeamId],
    queryFn: async () => {
      if (selectedTeamId) {
        const { data: athletes, error } = await (supabase as any)
          .from('school_athletes')
          .select('id, full_name, avatar_url, athlete_type')
          .eq('enrolled_team_id', selectedTeamId)
          .eq('is_active', true);

        if (error) throw error;
        return (athletes || []).map((a: any) => ({
          id: a.id,
          full_name: a.full_name,
          photo_url: a.avatar_url ?? undefined,
          athlete_type: a.athlete_type
        }));
      }

      return [];
    },
    enabled: !!selectedTeamId,
  });

  // ── 3. Sesión Activa (consulta al BFF o Supabase) ────────────────────────
  const {
    data: sessionData,
    isLoading: loadingSession,
  } = useQuery<{ session: AttendanceSession | null; records: { child_id?: string; user_id?: string; status: string }[] }>({
    queryKey: ['attendance-session', selectedItem],
    queryFn: async () => {
      if (!selectedItem) return { session: null, records: [] };
      if (isTeam) {
        const token = await getBearerToken();
        const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${selectedTeamId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error consultando sesión');
        return res.json();
      } else if (isSession) {
        const { data: session, error: sErr } = await supabase
          .from('attendance_sessions')
          .select('id, team_id, session_date, finalized, finalized_at, created_by, created_at')
          .eq('id', selectedSessionId)
          .single();
        if (sErr) throw sErr;

        const { data: records, error: rErr } = await supabase
          .from('attendance_records')
          .select('child_id, user_id, status')
          .eq('attendance_date', session.session_date); 
          // Note: records without team_id but with attendance_date

        return { session, records: records || [] };
      }
      return { session: null, records: [] };
    },
    enabled: !!selectedItem,
    // Al obtener la sesión existente, pre-cargar el estado de asistencia
    onSuccess: (data) => {
      if (data?.records?.length > 0) {
        const preloaded: Record<string, AttendanceStatus> = {};
        data.records.forEach((r) => {
          const athleteId = r.child_id ?? r.user_id;
          if (athleteId) preloaded[athleteId] = r.status as AttendanceStatus;
        });
        setAttendanceState(preloaded);
      }
    },
  } as any);

  const session = sessionData?.session ?? null;
  // ── 3.5. Reservas (Drop-ins) para la sesión activa ───────────────────────
  const activeSessionId = isSession ? selectedSessionId : session?.id;
  const { data: sessionBookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['session-bookings', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      const token = await getBearerToken();
      const res = await fetch(`${BFF_URL}/api/v1/session-bookings/${activeSessionId}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.bookings || [];
    },
    enabled: !!activeSessionId
  });

  // ── Combinar Roster ──────────────────────────────────────────────────────
  const combinedRoster = useMemo(() => {
    const base = [...roster];
    const baseIds = new Set(base.map(r => r.id));

    sessionBookings.forEach((b: any) => {
      if (b.person && !baseIds.has(b.person.id)) {
        base.push({
          id: b.person.id,
          full_name: b.person.full_name,
          photo_url: b.person.avatar_url,
          athlete_type: b.child_id ? 'child' : 'adult',
          is_booking: true
        } as any);
        baseIds.add(b.person.id);
      }
    });
    
    return base.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [roster, sessionBookings]);

  const isFinalized = session?.finalized === true;
  // El entrenador puede editar si la sesión existe pero no está finalizada
  const isEditMode = session !== null && !isFinalized;
  // Sin sesión aún → modo creación
  const isCreateMode = session === null;

  // ── 4. Guardar asistencia (POST al BFF) ───────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = Object.entries(attendanceState).map(([athleteId, status]) => {
        const student = combinedRoster.find(s => s.id === athleteId);
        return {
          childId: student?.athlete_type === 'adult' ? null : athleteId,
          userId: student?.athlete_type === 'adult' ? athleteId : null,
          status,
        };
      });

      if (selectedItem) {
        if (records.length === 0) throw new Error('No hay asistencias para guardar.');
        const token = await getBearerToken();
        const payload: any = { records };
        if (isTeam) payload.teamId = selectedTeamId;
        if (isSession) payload.sessionId = selectedSessionId;

        const res = await fetch(`${BFF_URL}/api/v1/attendance/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Error guardando asistencia');
        return body;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      toast({ title: '✅ Asistencia guardada', description: 'Puedes editarla o finalizarla cuando quieras.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al guardar', description: err?.message, variant: 'destructive' });
    },
  });

  // ── 5. Finalizar sesión (PATCH al BFF) ───────────────────────────────────
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!session?.id) throw new Error('No hay sesión activa para finalizar.');
      const token = await getBearerToken();
      const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${session.id}/finalize`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error finalizando sesión');
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      toast({ title: '🏁 Sesión finalizada', description: 'Los datos quedan bloqueados para reportes.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al finalizar', description: err?.message, variant: 'destructive' });
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleItemChange = (val: string) => {
    setSelectedItem(val);
    setAttendanceState({});
  };

  const markAllPresent = () => {
    const newState: Record<string, AttendanceStatus> = {};
    combinedRoster.forEach((s) => (newState[s.id] = 'present'));
    setAttendanceState(newState);
    toast({ title: '✅ Todos marcados como presentes' });
  };

  const getButtonVariant = (studentId: string, status: AttendanceStatus) =>
    attendanceState[studentId] === status ? 'default' : 'outline';

  const markedCount = Object.keys(attendanceState).length;
  const isBusy = saveMutation.isPending || finalizeMutation.isPending;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">Toma lista rápidamente</p>
      </div>

      {/* Selector de equipo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Clase / Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTeams || loadingPlans ? (
            <LoadingSpinner text="Cargando clases..." />
          ) : (
            <Select value={selectedItem} onValueChange={handleItemChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu clase o grupo" />
              </SelectTrigger>
              <SelectContent>
                {teams.length === 0 && planSessions.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No tienes equipos asignados ni clases programadas
                  </div>
                ) : (
                  <>
                    {teams.length > 0 && <SelectGroup>
                      <SelectLabel>Tus Equipos Regulares</SelectLabel>
                      {teams.map((team) => (
                        <SelectItem key={`team:${team.id}`} value={`team:${team.id}`}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>}

                    {planSessions.length > 0 && <SelectGroup>
                      <SelectLabel>Clases Reservadas Hoy</SelectLabel>
                      {planSessions.map((ps: any) => (
                        <SelectItem key={`session:${ps.id}`} value={`session:${ps.id}`}>
                          {ps.name} ({ps.start_time.substring(0,5)} - {ps.end_time.substring(0,5)})
                        </SelectItem>
                      ))}
                    </SelectGroup>}
                  </>
                )}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Contenido principal */}
      {selectedItem && (
        <>
          {loadingRoster || loadingSession || loadingBookings ? (
            <LoadingSpinner text="Cargando lista de estudiantes..." />
          ) : (
            <>
              {/* Banner de estado de sesión */}
              {isFinalized && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
                  <Lock className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Sesión finalizada</p>
                    <p className="text-sm">
                      Los registros de hoy están bloqueados y disponibles en reportes.
                    </p>
                  </div>
                </div>
              )}

              {isEditMode && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                  <Edit2 className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Asistencia guardada — en edición</p>
                    <p className="text-sm">
                      Puedes ajustar los estados y guardar cambios. Finaliza la sesión cuando estés listo.
                    </p>
                  </div>
                </div>
              )}

              {/* Cabecera de lista */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <p className="font-medium">
                    {combinedRoster.length} estudiante{combinedRoster.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {!isFinalized && (
                  <Button
                    onClick={markAllPresent}
                    variant="outline"
                    size="sm"
                    disabled={combinedRoster.length === 0}
                  >
                    ✅ Todos Presentes
                  </Button>
                )}
              </div>

              {/* Lista de estudiantes */}
              {combinedRoster.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No hay estudiantes listados para esta clase o grupo.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {combinedRoster.map((student: any) => (
                    <Card key={student.id}>
                      <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Avatar + nombre */}
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold overflow-hidden shrink-0">
                              {student.photo_url ? (
                                <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                              ) : (
                                student.full_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{student.full_name}</p>
                              {student.is_booking && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex items-center gap-1">
                                  <CalendarCheck className="w-3 h-3" />
                                  Reserva
                                </Badge>
                              )}
                              {attendanceState[student.id] === 'present' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              {attendanceState[student.id] === 'absent' && <XCircle className="w-4 h-4 text-red-500" />}
                              {attendanceState[student.id] === 'late' && <Clock className="w-4 h-4 text-yellow-500" />}
                              {attendanceState[student.id] === 'excused' && <AlertCircle className="w-4 h-4 text-blue-500" />}
                            </div>
                          </div>

                          {/* Botones de estado — deshabilitados si la sesión está finalizada */}
                          <div className="flex gap-2 flex-wrap">
                            {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant={getButtonVariant(student.id, s)}
                                disabled={isFinalized}
                                onClick={() =>
                                  setAttendanceState((prev) => ({ ...prev, [student.id]: s }))
                                }
                                className="gap-1"
                              >
                                {s === 'present' && <><CheckCircle2 className="w-4 h-4" /> Presente</>}
                                {s === 'absent' && <><XCircle className="w-4 h-4" /> Ausente</>}
                                {s === 'late' && <><Clock className="w-4 h-4" /> Tarde</>}
                                {s === 'excused' && <><AlertCircle className="w-4 h-4" /> Excusado</>}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Acciones del pie */}
              {combinedRoster.length > 0 && !isFinalized && (
                <div className="sticky bottom-16 sm:bottom-0 z-10 bg-background/95 backdrop-blur border-t pt-3 pb-3 px-0 -mx-0 flex flex-col sm:flex-row gap-3">
                  {/* Guardar / Guardar cambios */}
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => saveMutation.mutate()}
                    disabled={markedCount === 0 || isBusy}
                  >
                    {saveMutation.isPending
                      ? 'Guardando...'
                      : isEditMode
                        ? `Guardar cambios (${markedCount} / ${combinedRoster.length})`
                        : `Guardar asistencia (${markedCount} / ${combinedRoster.length})`}
                  </Button>

                  {/* Finalizar sesión — solo visible si ya fue guardada al menos una vez */}
                  {isEditMode && (
                    <Button
                      variant="destructive"
                      size="lg"
                      className="gap-2 sm:w-auto"
                      onClick={() => setFinalizeDialogOpen(true)}
                      disabled={isBusy}
                    >
                      <Flag className="w-4 h-4" />
                      {finalizeMutation.isPending ? 'Finalizando...' : 'Finalizar sesión'}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Dialog confirmación finalizar sesión */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              Finalizar sesión
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <span className="block">
                Estás a punto de cerrar la sesión de asistencia de hoy para{' '}
                <strong>{teams.find((t) => t.id === selectedTeamId)?.name}</strong>.
              </span>
              <span className="block text-amber-600 font-medium">
                Una vez finalizada, los registros quedarán bloqueados y no podrán modificarse.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFinalizeDialogOpen(false)}
              disabled={finalizeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={finalizeMutation.isPending}
              onClick={() => {
                setFinalizeDialogOpen(false);
                finalizeMutation.mutate();
              }}
            >
              {finalizeMutation.isPending ? 'Finalizando...' : 'Sí, finalizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Estado vacío inicial */}
      {!selectedTeamId && !loadingTeams && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona tu clase</h3>
            <p className="text-muted-foreground">
              Elige una clase del menú superior para tomar asistencia
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}