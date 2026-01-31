import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useState } from 'react';

export default function AttendanceSupervisionPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const isDemoMode = sessionStorage.getItem('demo_mode') === 'true';

  const demoSessions = [
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

  const sessions = isDemoMode ? demoSessions : [];

  const pendingSessions = sessions.filter(s => s.status === 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return (
          <Badge className="bg-green-500">
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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supervisión de Asistencias</h1>
        <p className="text-muted-foreground">Monitoreo de registro por entrenadores</p>
      </div>

      {pendingSessions.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{pendingSessions.length} sesiones pendientes de registro.</strong> Los siguientes entrenadores no han tomado la lista.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendario de Sesiones</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
