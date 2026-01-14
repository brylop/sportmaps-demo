<<<<<<< HEAD
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
=======
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
<<<<<<< HEAD
import { AlertCircle, CheckCircle2, Clock, CalendarDays } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Session {
  id: string;
  program_name: string;
  coach_name: string;
  session_date: string;
  status: 'registered' | 'pending' | 'scheduled';
  attendance: {
    present: number;
    total: number;
  };
}
=======
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useState } from 'react';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

export default function AttendanceSupervisionPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

<<<<<<< HEAD
  // Fetch sessions for the selected date
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['attendance-supervision', date?.toISOString()],
    queryFn: async () => {
      if (!date) return [];
      
      const dateStr = format(date, 'yyyy-MM-dd');

      // 1. Get sessions for this date
      // Note: This assumes a 'training_sessions' table exists. 
      // If not, we might need to query 'programs' and infer sessions from schedules.
      // For this implementation, we'll simulate fetching from a joined query structure 
      // that would likely exist in a real production schema.
      
      /* Ideal Query (Pseudo-code):
         SELECT 
           ts.id, 
           p.name as program_name, 
           pr.full_name as coach_name,
           ts.session_date,
           (SELECT count(*) FROM enrollments e WHERE e.program_id = p.id AND e.status = 'active') as total_students,
           (SELECT count(*) FROM session_attendance sa WHERE sa.session_id = ts.id AND sa.status = 'present') as present_students
         FROM training_sessions ts
         JOIN programs p ON ts.program_id = p.id
         JOIN profiles pr ON p.coach_id = pr.id
         WHERE ts.session_date = $dateStr
      */

      // Since we might not have 'training_sessions' populated or fully linked in the current types,
      // we will fetch programs and simulate sessions for the demo purposes if real data is missing,
      // BUT we will try to structure it as close to the real fetch as possible.

      const { data: programsData, error } = await supabase
        .from('programs')
        .select(`
          id,
          name,
          school_id,
          schedule,
          profiles:school_id ( full_name ) -- Assuming school_id owner or we need a direct coach_id relation
        `)
        .eq('active', true);

      if (error) throw error;

      // Mocking the session data transformation for now since we don't have a direct 'sessions' table 
      // populated with date-specific records in the provided schema context.
      // In a real scenario, you would query the 'training_sessions' table.
      
      return programsData.map((program: any) => {
        // Randomize status for demo purposes on the selected date
        const isPast = date < new Date();
        const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        
        let status: 'registered' | 'pending' | 'scheduled' = 'scheduled';
        if (isPast || (isToday && Math.random() > 0.5)) {
           status = Math.random() > 0.3 ? 'registered' : 'pending';
        }

        return {
          id: `session-${program.id}`,
          program_name: program.name,
          coach_name: 'Entrenador Asignado', // We'd get this from relation
          session_date: dateStr,
          status: status,
          attendance: {
            present: status === 'registered' ? Math.floor(Math.random() * 15) + 5 : 0,
            total: 20
          }
        } as Session;
      });
    },
    enabled: !!date
  });

  const pendingSessions = sessions?.filter(s => s.status === 'pending') || [];
=======
  const sessions = [
    {
      id: '1',
      program: 'Fútbol Sub-12',
      coach: 'Luis F. Rodríguez',
      date: '2024-10-28',
      status: 'registered',
      attendance: { present: 18, total: 20 },
    },
    {
      id: '2',
      program: 'Tenis Infantil',
      coach: 'Diana Silva',
      date: '2024-10-29',
      status: 'pending',
      attendance: { present: 0, total: 8 },
    },
    {
      id: '3',
      program: 'Fútbol Sub-10',
      coach: 'Luis F. Rodríguez',
      date: '2024-10-28',
      status: 'registered',
      attendance: { present: 17, total: 18 },
    },
    {
      id: '4',
      program: 'Voleibol Juvenil',
      coach: 'Sin asignar',
      date: '2024-10-30',
      status: 'scheduled',
      attendance: { present: 0, total: 8 },
    },
  ];

  const pendingSessions = sessions.filter(s => s.status === 'pending');
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return (
<<<<<<< HEAD
          <Badge className="bg-green-500 hover:bg-green-600">
=======
          <Badge className="bg-green-500">
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Registrada
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pendiente
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Programada
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
<<<<<<< HEAD
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Supervisión de Asistencias</h1>
          <p className="text-muted-foreground mt-1">
            Monitoreo del registro de asistencia por parte de los entrenadores
          </p>
        </div>
=======
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supervisión de Asistencias</h1>
        <p className="text-muted-foreground">Monitoreo de registro por entrenadores</p>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      </div>

      {pendingSessions.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
<<<<<<< HEAD
            <strong>{pendingSessions.length} sesiones pendientes de registro</strong> para el día seleccionado. 
            Es necesario recordar a los entrenadores tomar la lista.
=======
            <strong>{pendingSessions.length} sesiones pendientes de registro.</strong> Los siguientes entrenadores no han tomado la lista.
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
<<<<<<< HEAD
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Calendario</CardTitle>
=======
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendario de Sesiones</CardTitle>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
<<<<<<< HEAD
              locale={es}
=======
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
<<<<<<< HEAD
            <CardTitle>
              Sesiones del {date ? format(date, "d 'de' MMMM, yyyy", { locale: es }) : 'Selecciona una fecha'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8">
                <LoadingSpinner text="Cargando sesiones..." />
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No hay sesiones programadas"
                description="No se encontraron clases o entrenamientos para esta fecha."
              />
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{session.program_name}</h3>
                        {getStatusBadge(session.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {session.coach_name}
                      </p>
                      
                      {session.status === 'registered' && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="text-muted-foreground">Asistencia:</span>
                          <div className="flex items-center gap-1 font-medium">
                            <span className="text-green-600">{session.attendance.present}</span>
                            <span className="text-muted-foreground">/</span>
                            <span>{session.attendance.total}</span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({Math.round((session.attendance.present / session.attendance.total) * 100)}%)
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      {/* Actions could go here, e.g., "Ver Detalle", "Enviar Recordatorio" */}
                    </div>
                  </div>
                ))}
              </div>
            )}
=======
            <CardTitle>Estado de Sesiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{session.program}</h3>
                    <p className="text-sm text-muted-foreground">
                      {session.coach} • {new Date(session.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                    {session.status === 'registered' && (
                      <p className="text-sm mt-1">
                        Asistencia: {session.attendance.present}/{session.attendance.total} estudiantes
                      </p>
                    )}
                  </div>
                  <div>{getStatusBadge(session.status)}</div>
                </div>
              ))}
            </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </CardContent>
        </Card>
      </div>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
