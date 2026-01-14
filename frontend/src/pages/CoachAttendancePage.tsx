<<<<<<< HEAD
import { useState, useEffect } from 'react';
=======
import { useState } from 'react';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
<<<<<<< HEAD
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { CheckCircle2, XCircle, Clock, AlertCircle, Users, Calendar as CalendarIcon, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface Team {
  id: string;
  name: string;
  age_group: string | null;
}

interface TeamMember {
  id: string;
  player_name: string;
  player_number: number | null;
  position: string | null;
}

export default function CoachAttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});

  // 1. Cargar Equipos del Entrenador
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, age_group')
        .eq('coach_id', user.id);
      
      if (error) throw error;
      return data as Team[];
=======
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { CheckCircle2, XCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export default function CoachAttendancePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});

  // Check if user is demo account
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  // Demo teams data (only for demo users)
  const demoTeams = isDemoUser ? [
    {
      id: 'demo-team-1',
      coach_id: user?.id,
      name: 'Fútbol Sub-12',
      sport: 'Fútbol',
      age_group: 'Sub-12',
      season: '2024',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] : [];

  const { data: teamsData } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('coach_id', user?.id);
      if (error) throw error;
      return data;
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    },
    enabled: !!user?.id,
  });

<<<<<<< HEAD
  // 2. Cargar Roster (Jugadores) del Equipo Seleccionado
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['team-roster', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return [];
=======
  const teams = teamsData && teamsData.length > 0 ? teamsData : (isDemoUser ? demoTeams : []);

  // Demo roster data (only for demo users)
  const demoRoster = isDemoUser ? [
    {
      id: 'player-1',
      team_id: selectedTeamId,
      player_name: 'Mateo Pérez',
      player_number: 10,
      position: 'Delantero',
      parent_contact: '+57 300 123 4567',
      created_at: new Date().toISOString(),
    },
    {
      id: 'player-2',
      team_id: selectedTeamId,
      player_name: 'Juan Vargas',
      player_number: 7,
      position: 'Medio',
      parent_contact: '+57 310 234 5678',
      created_at: new Date().toISOString(),
    },
    {
      id: 'player-3',
      team_id: selectedTeamId,
      player_name: 'Camila Torres',
      player_number: 5,
      position: 'Defensa',
      parent_contact: '+57 320 345 6789',
      created_at: new Date().toISOString(),
    },
    {
      id: 'player-4',
      team_id: selectedTeamId,
      player_name: 'Santiago Rojas',
      player_number: 1,
      position: 'Portero',
      parent_contact: '+57 315 456 7890',
      created_at: new Date().toISOString(),
    },
    {
      id: 'player-5',
      team_id: selectedTeamId,
      player_name: 'Valeria Gómez',
      player_number: 11,
      position: 'Delantero',
      parent_contact: '+57 318 567 8901',
      created_at: new Date().toISOString(),
    },
  ] : [];

  const { data: rosterData, isLoading } = useQuery({
    queryKey: ['team-roster', selectedTeamId],
    queryFn: async () => {
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('player_name');
<<<<<<< HEAD
      
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!selectedTeamId,
  });

  // 3. Cargar Asistencia Existente (si ya se tomó lista ese día)
  useQuery({
    queryKey: ['existing-attendance', selectedTeamId, date],
    queryFn: async () => {
      if (!selectedTeamId || !roster || roster.length === 0) return null;
      
      const dateStr = format(date, 'yyyy-MM-dd');
      const playerIds = roster.map(p => p.id);

      // Nota: En un caso real, 'attendance' debería linkear con 'team_members' o 'children'
      // Aquí asumimos que el ID guardado en attendance corresponde al ID de team_members para simplificar la demo
      const { data, error } = await supabase
        .from('attendance')
        .select('child_id, status')
        .in('child_id', playerIds)
        .eq('class_date', dateStr);

      if (error) {
        console.error('Error fetching attendance:', error);
        return null;
      }

      // Actualizar el estado local con lo que viene de la DB
      if (data && data.length > 0) {
        const savedState: Record<string, AttendanceStatus> = {};
        data.forEach((record: any) => {
          savedState[record.child_id] = record.status as AttendanceStatus;
        });
        setAttendanceState(savedState);
      } else {
        setAttendanceState({}); // Limpiar si no hay registros para esta fecha
      }
      return data;
    },
    enabled: !!selectedTeamId && !!roster && roster.length > 0,
  });

  // 4. Guardar Asistencia
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeamId) return;
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const updates = Object.entries(attendanceState).map(([playerId, status]) => ({
        child_id: playerId, // Usamos el ID del jugador como child_id
        class_date: dateStr,
        status: status,
        // En un escenario real, también guardaríamos team_id o session_id
      }));

      if (updates.length === 0) return;

      // Upsert: Insertar o Actualizar si ya existe (requiere constraint en DB child_id + class_date)
      // Si no hay constraint, lo ideal es borrar y re-insertar o usar upsert con onConflict
      const { error } = await supabase
        .from('attendance')
        .upsert(updates, { onConflict: 'child_id,class_date' } as any); // Asumiendo constraint

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: '✅ Asistencia guardada',
        description: `Se registraron datos para ${Object.keys(attendanceState).length} jugadores.`,
      });
      queryClient.invalidateQueries({ queryKey: ['existing-attendance'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la asistencia. ' + error.message,
        variant: 'destructive',
      });
    }
  });

  const markAllPresent = () => {
    if (!roster) return;
    const newState: Record<string, AttendanceStatus> = {};
    roster.forEach((player) => {
=======
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTeamId && !selectedTeamId.startsWith('demo-'),
  });

  const roster = (rosterData && rosterData.length > 0) || !selectedTeamId.startsWith('demo-')
    ? rosterData
    : demoRoster;

  const markAllPresent = () => {
    const newState: Record<string, AttendanceStatus> = {};
    roster?.forEach((player) => {
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      newState[player.id] = 'present';
    });
    setAttendanceState(newState);
    toast({
<<<<<<< HEAD
      title: 'Todos presentes',
      description: 'Se han marcado todos los jugadores como presentes.',
    });
  };

=======
      title: '✅ Todos marcados como presentes',
      description: 'Puedes ajustar individualmente si es necesario',
    });
  };

  const getStatusIcon = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'late':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'excused':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
  const getButtonVariant = (playerId: string, status: AttendanceStatus) => {
    return attendanceState[playerId] === status ? 'default' : 'outline';
  };

<<<<<<< HEAD
  if (teamsLoading) {
    return <LoadingSpinner fullScreen text="Cargando equipos..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Toma de Asistencia</h1>
          <p className="text-muted-foreground mt-1">Registra la asistencia de tus entrenamientos</p>
        </div>
        
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              locale={es}
            />
          </PopoverContent>
        </Popover>
=======
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">Toma lista rápidamente</p>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu equipo" />
            </SelectTrigger>
            <SelectContent>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
<<<<<<< HEAD
                  {team.name} {team.age_group ? `- ${team.age_group}` : ''}
=======
                  {team.name} - {team.age_group}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

<<<<<<< HEAD
      {!selectedTeamId ? (
        <EmptyState
          icon={Users}
          title="Selecciona un equipo"
          description="Elige un equipo del menú superior para comenzar a tomar lista."
        />
      ) : rosterLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner text="Cargando jugadores..." />
        </div>
      ) : !roster || roster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Equipo sin jugadores"
          description="Este equipo aún no tiene jugadores registrados."
        />
      ) : (
        <>
          <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <p className="font-medium">{roster.length} jugadores en lista</p>
            </div>
            <Button onClick={markAllPresent} variant="secondary" size="sm">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar Todos Presentes
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roster.map((player) => (
              <Card key={player.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 flex items-center gap-4 border-b bg-card/50">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {player.player_number ? `#${player.player_number}` : '##'}
                    </div>
                    <div>
                      <p className="font-semibold truncate">{player.player_name}</p>
                      <p className="text-xs text-muted-foreground">{player.position || 'Sin posición'}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant={getButtonVariant(player.id, 'present')}
                      onClick={() => setAttendanceState(prev => ({ ...prev, [player.id]: 'present' }))}
                      className={cn(attendanceState[player.id] === 'present' && "bg-green-600 hover:bg-green-700")}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Presente
                    </Button>
                    
                    <Button
                      size="sm"
                      variant={getButtonVariant(player.id, 'absent')}
                      onClick={() => setAttendanceState(prev => ({ ...prev, [player.id]: 'absent' }))}
                      className={cn(attendanceState[player.id] === 'absent' && "bg-red-600 hover:bg-red-700")}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Ausente
                    </Button>
                    
                    <Button
                      size="sm"
                      variant={getButtonVariant(player.id, 'late')}
                      onClick={() => setAttendanceState(prev => ({ ...prev, [player.id]: 'late' }))}
                      className={cn(attendanceState[player.id] === 'late' && "bg-yellow-500 hover:bg-yellow-600 text-white")}
                    >
                      <Clock className="w-3 h-3 mr-1" /> Tarde
                    </Button>
                    
                    <Button
                      size="sm"
                      variant={getButtonVariant(player.id, 'excused')}
                      onClick={() => setAttendanceState(prev => ({ ...prev, [player.id]: 'excused' }))}
                      className={cn(attendanceState[player.id] === 'excused' && "bg-blue-500 hover:bg-blue-600 text-white")}
                    >
                      <AlertCircle className="w-3 h-3 mr-1" /> Excusa
                    </Button>
                  </div>
=======
      {selectedTeamId && roster && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <p className="font-medium">{roster.length} jugadores</p>
            </div>
            <Button onClick={markAllPresent} variant="outline" size="sm">
              ✅ Marcar Todos Presentes
            </Button>
          </div>

          <div className="space-y-3">
            {roster.map((player) => (
              <Card key={player.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold">
                        #{player.player_number}
                      </div>
                      <div>
                        <p className="font-semibold">{player.player_name}</p>
                        <p className="text-sm text-muted-foreground">{player.position}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={getButtonVariant(player.id, 'present')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [player.id]: 'present',
                          }))
                        }
                        className="gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Presente
                      </Button>
                      <Button
                        size="sm"
                        variant={getButtonVariant(player.id, 'absent')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [player.id]: 'absent',
                          }))
                        }
                        className="gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Ausente
                      </Button>
                      <Button
                        size="sm"
                        variant={getButtonVariant(player.id, 'late')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [player.id]: 'late',
                          }))
                        }
                        className="gap-2"
                      >
                        <Clock className="w-4 h-4" />
                        Tarde
                      </Button>
                      <Button
                        size="sm"
                        variant={getButtonVariant(player.id, 'excused')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [player.id]: 'excused',
                          }))
                        }
                        className="gap-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Excusado
                      </Button>
                    </div>
                  </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                </CardContent>
              </Card>
            ))}
          </div>

<<<<<<< HEAD
          <div className="sticky bottom-6 flex justify-end">
            <Button
              className="shadow-lg w-full md:w-auto px-8"
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={Object.keys(attendanceState).length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>Guardando...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Asistencia ({Object.keys(attendanceState).length})
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
=======
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              toast({
                title: '✅ Asistencia guardada',
                description: `Registrada para ${Object.keys(attendanceState).length} jugadores`,
              });
            }}
            disabled={Object.keys(attendanceState).length === 0}
          >
            Guardar Asistencia
          </Button>
        </>
      )}

      {!selectedTeamId && teams && teams.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona tu equipo</h3>
            <p className="text-muted-foreground">
              Elige un equipo del menú superior para tomar asistencia
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <LoadingSpinner text="Cargando roster..." />}
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
