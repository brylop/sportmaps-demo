import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle2, XCircle, Clock, AlertCircle, Users, Lock, Edit2, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TeamItem { id: string; name: string; }
interface StudentItem { id: string; full_name: string; photo_url?: string; }
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
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);

  // ── 1. Equipos del entrenador ─────────────────────────────────────────────
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['coach-teams', schoolId, user?.id],
    queryFn: async () => {
      if (!schoolId || !user?.id) return [];

      let staffId: string | null = null;
      if (user.email) {
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (staffData) staffId = staffData.id;
      }

      const { data: teamsData, error } = await (supabase
        .from('teams')
        .select('id, name, coach_id, team_coaches(coach_id)')
        .eq('school_id', schoolId) as any);

      if (error) throw error;

      return (teamsData || [])
        .filter((team: any) => {
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

  // ── 2. Roster del equipo seleccionado ────────────────────────────────────
  const { data: roster = [], isLoading: loadingRoster } = useQuery<StudentItem[]>({
    queryKey: ['team-roster', selectedTeamId],
    queryFn: async () => {
      if (selectedTeamId) {
        const { data, error } = await (supabase.from('enrollments') as any)
          .select('child_id, children (id, full_name, avatar_url)')
          .eq('team_id', selectedTeamId)
          .eq('status', 'active');
        if (error) throw error;
        return data
          .filter((row: any) => row.children)
          .map((row: any) => ({
            id: row.children.id,
            full_name: row.children.full_name,
            photo_url: row.children.avatar_url ?? undefined,
          }));
      }

      if (selectedClassId) {
        const { data, error } = await supabase
          .from('class_enrollments')
          .select(`
            enrollment_id,
            enrollments!inner (
              child_id,
              students!inner (
                id,
                full_name,
                avatar_url
              )
            )
          `)
          .eq('class_id', selectedClassId);

        if (error) {
          console.error("Error fetching roster", error);
          throw error;
        }

        return (data || []).map((item: any) => ({
          id: item.enrollments?.students?.id,
          full_name: item.enrollments?.students?.full_name,
          photo_url: item.enrollments?.students?.avatar_url,
        })) as StudentItem[];
      }

      return [];
    },
    enabled: !!selectedTeamId,
  });

  // ── 3. Sesión de hoy (consulta al BFF) ────────────────────────────────────
  const {
    data: sessionData,
    isLoading: loadingSession,
  } = useQuery<{ session: AttendanceSession | null; records: { child_id: string; status: string }[] }>({
    queryKey: ['attendance-session', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return { session: null, records: [] };
      const token = await getBearerToken();
      const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${selectedTeamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error consultando sesión');
      return res.json();
    },
    enabled: !!selectedTeamId,
    // Al obtener la sesión existente, pre-cargar el estado de asistencia
    onSuccess: (data) => {
      if (data.records.length > 0) {
        const preloaded: Record<string, AttendanceStatus> = {};
        data.records.forEach((r) => {
          preloaded[r.child_id] = r.status as AttendanceStatus;
        });
        setAttendanceState(preloaded);
      }
    },
  } as any);

  const session = sessionData?.session ?? null;
  const isFinalized = session?.finalized === true;
  // El entrenador puede editar si la sesión existe pero no está finalizada
  const isEditMode = session !== null && !isFinalized;
  // Sin sesión aún → modo creación
  const isCreateMode = session === null;

  // ── 4. Guardar asistencia (POST al BFF) ───────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = Object.entries(attendanceState).map(([childId, status]) => ({
        childId,
        status,
      }));
      if (selectedTeamId) {
        if (records.length === 0) throw new Error('No hay asistencias para guardar.');
        const token = await getBearerToken();
        const res = await fetch(`${BFF_URL}/api/v1/attendance/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ teamId: selectedTeamId, records }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Error guardando asistencia');
        return body;
      }

      if (selectedClassId) {
        const { data: cls } = await supabase
          .from('classes')
          .select('program_id')
          .eq('id', selectedClassId)
          .single();

        if (!cls) throw new Error("Clase no encontrada");

        const recordsWithProgram = records.map(r => ({
          ...r,
          child_id: r.childId, // Map childId to child_id for generic logic
          program_id: cls.program_id,
          school_id: schoolId,
          class_id: selectedClassId,
          attendance_date: new Date().toISOString().split('T')[0],
          marked_by: user?.id
        }));

        const { error } = await supabase
          .from('attendance_records')
          .insert(recordsWithProgram);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedTeamId] });
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
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedTeamId] });
      toast({ title: '🏁 Sesión finalizada', description: 'Los datos quedan bloqueados para reportes.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al finalizar', description: err?.message, variant: 'destructive' });
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setAttendanceState({});
  };

  const markAllPresent = () => {
    const newState: Record<string, AttendanceStatus> = {};
    roster.forEach((s) => (newState[s.id] = 'present'));
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
          {loadingTeams ? (
            <LoadingSpinner text="Cargando equipos..." />
          ) : (
            <Select value={selectedTeamId} onValueChange={handleTeamChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu clase" />
              </SelectTrigger>
              <SelectContent>
                {teams.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No tienes equipos asignados
                  </div>
                ) : (
                  teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Contenido principal */}
      {selectedTeamId && (
        <>
          {loadingRoster || loadingSession ? (
            <LoadingSpinner text="Cargando..." />
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
                    {roster.length} estudiante{roster.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {!isFinalized && (
                  <Button
                    onClick={markAllPresent}
                    variant="outline"
                    size="sm"
                    disabled={roster.length === 0}
                  >
                    ✅ Todos Presentes
                  </Button>
                )}
              </div>

              {/* Lista de estudiantes */}
              {roster.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No hay estudiantes activos inscritos en este equipo.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {roster.map((student) => (
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
              {roster.length > 0 && !isFinalized && (
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
                        ? `Guardar cambios (${markedCount} / ${roster.length})`
                        : `Guardar asistencia (${markedCount} / ${roster.length})`}
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