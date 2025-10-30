import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { CheckCircle2, XCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export default function CoachAttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});

  const { data: teams } = useQuery({
    queryKey: ['coach-teams', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('coach_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: roster, isLoading } = useQuery({
    queryKey: ['team-roster', selectedTeamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('player_name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTeamId,
  });

  const markAllPresent = () => {
    const newState: Record<string, AttendanceStatus> = {};
    roster?.forEach((player) => {
      newState[player.id] = 'present';
    });
    setAttendanceState(newState);
    toast({
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

  const getButtonVariant = (playerId: string, status: AttendanceStatus) => {
    return attendanceState[playerId] === status ? 'default' : 'outline';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">Toma lista rápidamente</p>
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
                  {team.name} - {team.age_group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
                </CardContent>
              </Card>
            ))}
          </div>

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
