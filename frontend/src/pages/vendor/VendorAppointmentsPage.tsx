import { useEffect, useState } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, User } from 'lucide-react';

interface Appointment {
  id: string;
  athlete_name: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  service_type: string;
  status: string;
  notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function VendorAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('wellness_appointments')
        .select('*')
        .eq('professional_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true })
        .limit(50);

      if (!error && data) setAppointments(data as Appointment[]);
      setLoading(false);
    }

    fetchAppointments();
  }, [user]);

  const today = todayColombia();
  const upcoming = appointments.filter(a => a.appointment_date >= today && a.status !== 'cancelled');
  const past = appointments.filter(a => a.appointment_date < today || a.status === 'cancelled');

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis Citas</h1>
        <p className="text-muted-foreground">Gestiona las citas reservadas por tus pacientes</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No tienes citas aun</h3>
            <p className="text-muted-foreground text-sm">Cuando los atletas reserven tus servicios, las citas apareceran aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Proximas ({upcoming.length})</h2>
              <div className="grid gap-3">
                {upcoming.map(apt => (
                  <Card key={apt.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{apt.athlete_name || 'Paciente'}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {apt.appointment_time.slice(0, 5)} ({apt.duration_minutes} min)
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{apt.service_type}</Badge>
                        <Badge className={STATUS_COLORS[apt.status] || ''}>{apt.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Pasadas ({past.length})</h2>
              <div className="grid gap-2">
                {past.slice(0, 10).map(apt => (
                  <Card key={apt.id} className="opacity-60">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-sm">{apt.athlete_name || 'Paciente'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('es-CO')} - {apt.appointment_time.slice(0, 5)}
                          </p>
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[apt.status] || ''} variant="outline">{apt.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
