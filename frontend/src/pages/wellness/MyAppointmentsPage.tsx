import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle, CalendarDays, Clock, Stethoscope, Loader2, Sparkles, Baby, UserCircle,
  X, Search, HeartPulse, MapPin, Video, ExternalLink, Hourglass,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cancelMyAppointment } from '@/lib/clinical/api';
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, clinicalErrorMessage } from '@/lib/clinical/labels';
import {
  APPOINTMENT_STATUS_TONE_DARK, MODALITY_LABEL, appointmentStamp, formatCOP, listMyClientAppointments,
  nowColombiaStamp, type ClientAppointment,
} from '@/lib/clinical/agenda-extra';
import { dayToLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancelling, setCancelling] = useState<ClientAppointment | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => { if (cancelling) setReason(''); }, [cancelling]);

  const childrenQ = useQuery({
    queryKey: ['my-children-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('children').select('id, full_name').eq('parent_id', user.id);
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
    enabled: !!user,
  });
  const children = useMemo(() => childrenQ.data ?? [], [childrenQ.data]);
  const childIds = useMemo(() => children.map((c) => c.id).sort(), [children]);

  const appointmentsQuery = useQuery({
    queryKey: ['my-wellness-appointments', user?.id, childIds],
    queryFn: () => listMyClientAppointments(),
    enabled: !!user && childrenQ.isFetched,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => cancelMyAppointment(id, why || undefined),
    onSuccess: () => {
      toast.success('Cita cancelada', { description: 'Le avisamos al profesional.' });
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ['my-wellness-appointments'] });
    },
    onError: (err: unknown) => toast.error(clinicalErrorMessage(err)),
  });

  const now = nowColombiaStamp();
  const { upcoming, past } = useMemo(() => {
    const all = appointmentsQuery.data ?? [];
    const u = all
      .filter((a) => appointmentStamp(a) >= now && (a.status === 'pending' || a.status === 'confirmed'))
      .sort((a, b) => appointmentStamp(a).localeCompare(appointmentStamp(b)));
    const ids = new Set(u.map((a) => a.id));
    return { upcoming: u, past: all.filter((a) => !ids.has(a.id)) };
  }, [appointmentsQuery.data, now]);

  const renderCard = (a: ClientAppointment) => {
    const date = dayToLocalDate(a.appointment_date);
    const childName = a.child_id ? children.find((c) => c.id === a.child_id)?.full_name ?? a.athlete_name : null;
    const isMine = !a.child_id && a.athlete_id === user?.id;
    const professionalName = a.professional?.full_name ?? 'Profesional';
    const serviceName = a.service_listing?.name ?? a.service_type;
    const canCancel = (a.status === 'pending' || a.status === 'confirmed') && appointmentStamp(a) > now;

    return (
      <Card key={a.id} className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                {a.professional?.avatar_url && <AvatarImage src={a.professional.avatar_url} className="object-cover" />}
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-300">
                  {initials(professionalName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{serviceName}</h3>
                <p className="text-xs text-muted-foreground truncate">Con {professionalName}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn('text-[10px] shrink-0', APPOINTMENT_STATUS_TONE[a.status], APPOINTMENT_STATUS_TONE_DARK[a.status])}>
              {APPOINTMENT_STATUS_LABEL[a.status]}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 capitalize">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(date, "EEE d MMM yyyy", { locale: es })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {a.appointment_time.slice(0, 5)} · {a.duration_minutes} min
            </span>
            {childName ? (
              <span className="inline-flex items-center gap-1"><Baby className="h-3.5 w-3.5" />{childName}</span>
            ) : isMine ? (
              <span className="inline-flex items-center gap-1"><UserCircle className="h-3.5 w-3.5" />Para mí</span>
            ) : a.athlete_name ? (
              <span className="inline-flex items-center gap-1"><UserCircle className="h-3.5 w-3.5" />{a.athlete_name}</span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              {a.modality === 'virtual' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
              {MODALITY_LABEL[a.modality]}{a.modality !== 'virtual' && a.location ? ` · ${a.location}` : ''}
            </span>
          </div>

          {a.status === 'pending' && (
            <div className="flex gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Hourglass className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Por confirmar: el profesional debe aceptar la solicitud. Te avisaremos.
            </div>
          )}
          {a.modality === 'virtual' && a.meeting_url && a.status === 'confirmed' && (
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
              <a href={a.meeting_url} target="_blank" rel="noreferrer">
                <Video className="mr-1.5 h-3.5 w-3.5" />Entrar a la videollamada<ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          )}
          {a.status === 'cancelled' && a.cancellation_reason && (
            <p className="text-xs text-muted-foreground">Motivo: {a.cancellation_reason}</p>
          )}

          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {a.is_courtesy || a.price === 0 ? (
                <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />Cortesía</span>
              ) : (
                <span title="Valor de referencia; el pago se acuerda con el profesional">
                  {formatCOP(a.price)} COP
                  {a.payment_status === 'paid'
                    ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">· Pagada</span>
                    : <span className="ml-1.5 text-xs font-normal text-muted-foreground">· Se acuerda con el profesional</span>}
                </span>
              )}
            </span>
            {canCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={() => setCancelling(a)}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const isLoading = childrenQ.isLoading || appointmentsQuery.isLoading;
  const error = childrenQ.error ?? appointmentsQuery.error;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mis citas</h1>
            <p className="text-sm text-muted-foreground">Citas con profesionales de salud y bienestar.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/salud"><HeartPulse className="h-4 w-4" />Ver mi plan de salud</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/explorar?category=services"><Search className="h-4 w-4" />Buscar profesional</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{clinicalErrorMessage(error)}</p>
            <Button variant="outline" onClick={() => { childrenQ.refetch(); appointmentsQuery.refetch(); }}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upcoming' | 'past')}>
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
                    <p className="text-sm text-muted-foreground">Explora profesionales de salud y medicina deportiva.</p>
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

      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Cancelar cita</DialogTitle>
            <DialogDescription>
              {cancelling && (
                <>
                  {cancelling.service_listing?.name ?? cancelling.service_type} con{' '}
                  {cancelling.professional?.full_name ?? 'el profesional'} el{' '}
                  {format(dayToLocalDate(cancelling.appointment_date), "EEEE d 'de' MMMM", { locale: es })} a las{' '}
                  {cancelling.appointment_time.slice(0, 5)}. Le avisaremos al profesional.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="my-cancel-reason">Motivo (opcional)</Label>
            <Textarea
              id="my-cancel-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: se me cruzó con un partido"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={cancelMutation.isPending}>Volver</Button>
            <Button
              variant="destructive"
              onClick={() => cancelling && cancelMutation.mutate({ id: cancelling.id, why: reason.trim() })}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
