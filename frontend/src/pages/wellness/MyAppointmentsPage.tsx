import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  CalendarDays, Clock, Stethoscope, Loader2, Sparkles, Baby, UserCircle,
  X, CheckCircle2, XCircle, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isFuture, isToday, isBefore, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface AppointmentRow {
  id: string;
  professional_id: string;
  athlete_id: string | null;
  athlete_name: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  service_type: string;
  status: string;
  price: number;
  is_courtesy: boolean;
  payment_status: string | null;
  notes: string | null;
  service_listing_id: string | null;
  professional_profile?: { full_name: string | null } | null;
  service_listing?: { name: string | null } | null;
}

const STATUS_TONE: Record<string, { label: string; className: string; icon: any }> = {
  pending:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-700 border-amber-200',         icon: Clock },
  confirmed: { label: 'Confirmada',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200',   icon: CheckCircle2 },
  completed: { label: 'Completada',  className: 'bg-slate-100 text-slate-700 border-slate-200',         icon: CheckCircle2 },
  cancelled: { label: 'Cancelada',   className: 'bg-rose-100 text-rose-700 border-rose-200',            icon: XCircle },
  no_show:   { label: 'No asistio',  className: 'bg-slate-100 text-slate-500 border-slate-200',         icon: XCircle },
};

function toneFor(status: string) {
  return STATUS_TONE[status] ?? STATUS_TONE.pending;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function MyAppointmentsPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const { data: children = [] } = useQuery({
    queryKey: ['my-children-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('children')
        .select('id, full_name')
        .eq('parent_id', user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const athleteIds = useMemo(() => {
    if (!user) return [];
    const ids: string[] = [user.id, ...children.map((c: any) => c.id)];
    return ids;
  }, [user, children]);

  const appointmentsQuery = useQuery({
    queryKey: ['my-appointments', athleteIds],
    queryFn: async () => {
      if (athleteIds.length === 0) return [];
      const { data, error } = await supabase
        .from('wellness_appointments')
        .select(`
          id, professional_id, athlete_id, athlete_name, appointment_date, appointment_time,
          duration_minutes, service_type, status, price, is_courtesy, payment_status,
          notes, service_listing_id,
          professional_profile:profiles!wellness_appointments_professional_id_fkey(full_name),
          service_listing:service_listings(name)
        `)
        .in('athlete_id', athleteIds)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
    enabled: athleteIds.length > 0,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('wellness_appointments')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cita cancelada');
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
    },
    onError: (err: any) => toast.error(err.message || 'No se pudo cancelar'),
  });

  const appointments = appointmentsQuery.data ?? [];

  const { upcoming, past } = useMemo(() => {
    const today = startOfToday();
    const u: AppointmentRow[] = [];
    const p: AppointmentRow[] = [];
    for (const a of appointments) {
      const date = parseISO(a.appointment_date + 'T' + a.appointment_time);
      const isUpcoming = (isFuture(date) || isToday(date)) && a.status !== 'cancelled' && a.status !== 'completed';
      if (isUpcoming) u.push(a); else p.push(a);
    }
    u.sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
    return { upcoming: u, past: p };
  }, [appointments]);

  const renderCard = (a: AppointmentRow) => {
    const tone = toneFor(a.status);
    const Icon = tone.icon;
    const date = parseISO(a.appointment_date + 'T' + a.appointment_time);
    const isForChild = a.athlete_id !== user?.id;
    const childName = isForChild
      ? children.find((c: any) => c.id === a.athlete_id)?.full_name ?? a.athlete_name
      : null;
    const professionalName = a.professional_profile?.full_name ?? 'Profesional';
    const serviceName = a.service_listing?.name ?? a.service_type.replace('_', ' ');
    const canCancel = a.status === 'pending' || a.status === 'confirmed';
    const isPast = isBefore(date, new Date());

    return (
      <Card key={a.id} className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className="h-10 w-10 bg-emerald-100 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">
                  {initials(professionalName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{serviceName}</h3>
                <p className="text-xs text-muted-foreground truncate">Con {professionalName}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] gap-1 shrink-0 ${tone.className}`}>
              <Icon className="h-3 w-3" />
              {tone.label}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(date, "EEE d MMM yyyy", { locale: es })}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {a.appointment_time.slice(0, 5)} · {a.duration_minutes} min
            </span>
            {isForChild && childName && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Baby className="h-3.5 w-3.5" />
                {childName}
              </span>
            )}
            {!isForChild && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <UserCircle className="h-3.5 w-3.5" />
                Para mi
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-sm font-semibold text-emerald-600">
              {a.is_courtesy || a.price === 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Cortesia
                </span>
              ) : (
                `$${a.price.toLocaleString('es-CO')} COP`
              )}
            </span>
            {canCancel && !isPast && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar cita</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Seguro que quieres cancelar tu cita de {serviceName} con {professionalName} el{' '}
                      {format(date, "EEE d MMM 'a las' HH:mm", { locale: es })}?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Volver</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelMutation.mutate(a.id)}
                      className="bg-rose-600 hover:bg-rose-700"
                    >
                      Cancelar cita
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mis Citas</h1>
            <p className="text-sm text-muted-foreground">Citas con profesionales de wellness y medicina deportiva.</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/explorar?category=services">
            <Search className="h-4 w-4" />
            Buscar profesional
          </Link>
        </Button>
      </div>

      {appointmentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming" className="gap-1.5">
              Próximas
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{upcoming.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-1.5">
              Historial
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{past.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6 space-y-3">
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center space-y-3">
                  <Stethoscope className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div>
                    <p className="font-medium">No tienes citas programadas</p>
                    <p className="text-sm text-muted-foreground">
                      Explora profesionales de wellness y medicina deportiva.
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/explorar?category=services">Buscar profesional</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              upcoming.map(renderCard)
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6 space-y-3">
            {past.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  Aún no tienes historial de citas.
                </CardContent>
              </Card>
            ) : (
              past.map(renderCard)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
