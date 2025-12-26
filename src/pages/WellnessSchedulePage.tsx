import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { mockAppointments, getWellnessStats } from '@/lib/mock-data';

const statusConfig = {
  pending: { label: 'Pendiente', variant: 'secondary' as const, color: 'text-yellow-500' },
  confirmed: { label: 'Confirmada', variant: 'default' as const, color: 'text-green-500' },
  completed: { label: 'Completada', variant: 'outline' as const, color: 'text-blue-500' },
  cancelled: { label: 'Cancelada', variant: 'destructive' as const, color: 'text-red-500' }
};

export default function WellnessSchedulePage() {
  const stats = getWellnessStats();
  const todayAppointments = mockAppointments.filter(a => a.date === '2025-12-26');
  const tomorrowAppointments = mockAppointments.filter(a => a.date === '2025-12-27');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agenda de Citas</h1>
          <p className="text-muted-foreground">Gestiona tus citas y consultas</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Cita
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Citas Hoy</p>
                <p className="text-2xl font-bold">{stats.todayAppointments}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmedAppointments}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingAppointments}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pacientes Activos</p>
                <p className="text-2xl font-bold">{stats.activePatients}</p>
              </div>
              <User className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Citas de Hoy (26 Dic)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay citas programadas para hoy
              </p>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appointment) => {
                  const status = statusConfig[appointment.status];
                  return (
                    <div key={appointment.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{appointment.client_name}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {appointment.time} - {appointment.service}
                        </p>
                        {appointment.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{appointment.notes}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">Ver</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Citas de Mañana (27 Dic)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tomorrowAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay citas programadas para mañana
              </p>
            ) : (
              <div className="space-y-4">
                {tomorrowAppointments.map((appointment) => {
                  const status = statusConfig[appointment.status];
                  return (
                    <div key={appointment.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{appointment.client_name}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {appointment.time} - {appointment.service}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Ver</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
