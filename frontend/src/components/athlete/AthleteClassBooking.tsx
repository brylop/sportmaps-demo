import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Users, CheckCircle2, XCircle, Zap, ChevronRight, CalendarCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useAvailableSessions, useMyBookings,
  useBookSession, useCancelBooking,
  BookableSession, MyBooking,
} from '@/hooks/useAthleteSessionBookings';
import { getSportVisual } from '@/lib/sportVisuals';
import { SPORTS_CATALOG } from '@/lib/constants/sportsCatalog';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDate(d: string) {
  if (!d) return '';
  try {
    return format(parseISO(d), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return d;
  }
}

function groupByDate(sessions: BookableSession[]) {
  return sessions.reduce<Record<string, BookableSession[]>>((acc, s) => {
    acc[s.session_date] = [...(acc[s.session_date] ?? []), s];
    return acc;
  }, {});
}

// ─── Tab: Clases disponibles ──────────────────────────────────────────────────

function AvailableTab({ childId }: { childId?: string }) {
  const { data, isLoading } = useAvailableSessions(childId);
  const { mutate: book, isPending } = useBookSession();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<BookableSession | null>(null);

  if (isLoading) return <SkeletonList />;

  const sessions = data?.sessions ?? [];
  const open = sessions.filter((s) => s.booking_status === 'open' || s.booking_status === 'already_booked');

  if (open.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-sm">No hay clases programadas</p>
        <p className="text-xs text-muted-foreground mt-1">Las próximas clases aparecerán aquí cuando estén disponibles</p>
      </div>
    );
  }

  const grouped = groupByDate(open);

  return (
    <>
      <div className="space-y-5">
        {Object.entries(grouped).map(([date, daySessions]) => (
          <div key={date}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 capitalize">
              {fmtDate(date)}
            </p>
            <div className="space-y-2">
              {daySessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onBook={() => setConfirming(s)}
                  isBooking={isPending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(o) => { if (!o) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reserva</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>¿Reservar esta clase?</p>
                <div className="rounded-lg border p-3 space-y-1 text-foreground">
                  <p className="font-semibold">{confirming?.team.name}</p>
                  <p className="text-muted-foreground capitalize">{fmtDate(confirming?.session_date ?? '')}</p>
                  <p className="text-muted-foreground">{fmtTime(confirming?.start_time ?? '')} — {fmtTime(confirming?.end_time ?? '')}</p>
                  {confirming?.coach?.name && (
                    <p className="text-muted-foreground">Coach: {confirming.coach.name}</p>
                  )}
                  {confirming?.sessions_left !== null && (
                    <p className="text-amber-600 text-xs font-medium">
                      Te quedan {confirming?.sessions_left} sesión(es) después de esta reserva.
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                if (!confirming) return;
                book(
                  { session_id: confirming.id, enrollment_id: confirming.enrollment_id },
                  {
                    onSuccess: () => {
                      toast({ title: 'Clase reservada ✓', description: `${fmtDate(confirming.session_date)} ${fmtTime(confirming.start_time)}` });
                      setConfirming(null);
                    },
                    onError: (err: any) => {
                      toast({ title: 'No se pudo reservar', description: err.message, variant: 'destructive' });
                      setConfirming(null);
                    },
                  }
                );
              }}
            >
              {isPending ? 'Reservando...' : 'Sí, reservar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, onBook, isBooking }: {
  session: BookableSession;
  onBook: () => void;
  isBooking: boolean;
}) {
  const sportEntry = SPORTS_CATALOG.find((s) => s.nombre === session.team.sport);
  const visual = getSportVisual(sportEntry?.slug ?? session.team.sport ?? '');

  const statusColors = {
    open:           'bg-green-500/10 text-green-600 border-green-200',
    already_booked: 'bg-blue-500/10 text-blue-600 border-blue-200',
    full:           'bg-red-500/10 text-red-500 border-red-200',
    no_credits:     'bg-amber-500/10 text-amber-600 border-amber-200',
  };
  const statusLabel = {
    open:           'Disponible',
    already_booked: 'Reservada',
    full:           'Llena',
    no_credits:     'Sin créditos',
  };

  return (
    <Card className="overflow-hidden border-border/50 hover:border-border transition-colors">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className={`w-1 shrink-0 ${session.already_booked ? 'bg-blue-500' : session.booking_status === 'open' ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
          <div className="flex-1 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <span className="text-xl">{visual.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{session.team.name}</p>
                <Badge variant="outline" className={`text-[9px] h-4 px-1.5 border ${statusColors[session.booking_status]}`}>
                  {statusLabel[session.booking_status]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fmtTime(session.start_time)} — {fmtTime(session.end_time)}
                </span>
                {session.coach?.name && (
                  <span className="truncate">Coach: {session.coach.name}</span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {session.available_spots}/{session.max_capacity}
                </span>
                {session.sessions_left !== null && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Zap className="h-3 w-3" />
                    {session.sessions_left} restantes
                  </span>
                )}
              </div>
            </div>
            {session.already_booked ? (
              <div className="flex items-center gap-1 text-xs text-blue-600 font-medium shrink-0">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Reservada</span>
              </div>
            ) : session.booking_status === 'open' ? (
              <Button size="sm" onClick={onBook} disabled={isBooking} className="shrink-0 h-8 text-xs gap-1">
                <CalendarCheck className="h-3.5 w-3.5" />
                Reservar
              </Button>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Mis reservas ────────────────────────────────────────────────────────

function MyBookingsTab({ childId }: { childId?: string }) {
  const { data: bookings, isLoading } = useMyBookings(childId);
  const { mutate: cancel, isPending } = useCancelBooking();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState<MyBooking | null>(null);

  if (isLoading) return <SkeletonList />;
  if (!bookings || bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-sm">Sin reservas activas</p>
        <p className="text-xs text-muted-foreground mt-1">Ve a "Clases disponibles" para agendar una clase</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {bookings.map((b) => {
          const s = b.attendance_sessions;
          if (!s) return null;
          const isPast = new Date(s.session_date) < new Date();
          return (
            <Card key={b.id} className="overflow-hidden border-border/50">
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  <div className={`w-1 shrink-0 ${isPast || s.finalized ? 'bg-muted-foreground/30' : 'bg-blue-500'}`} />
                  <div className="flex-1 px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">
                          {b.enrollments?.offering_plans?.name ?? b.enrollments?.teams?.name ?? 'Clase'}
                        </p>
                        {s.finalized && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Finalizada</Badge>
                        )}
                        {b.status === 'attended' && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-green-600">Asistió</Badge>
                        )}
                        {b.status === 'no_show' && (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">No asistió</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="capitalize">{fmtDate(s.session_date)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtTime(s.start_time)} — {fmtTime(s.end_time)}
                        </span>
                        {s.school_staff?.full_name && (
                          <span>Coach: {s.school_staff.full_name}</span>
                        )}
                      </div>
                    </div>
                    {!isPast && !s.finalized && b.status === 'confirmed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelling(b)}
                        className="shrink-0 h-8 px-2 text-xs hover:bg-destructive/10 hover:text-destructive gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Cancelar</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o) setCancelling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro? Se cancelará tu reserva y se devolverá el crédito a tu plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={() => {
                if (!cancelling) return;
                cancel(cancelling.id, {
                  onSuccess: () => {
                    toast({ title: 'Reserva cancelada', description: 'Tu crédito fue devuelto.' });
                    setCancelling(null);
                  },
                  onError: (err: any) => {
                    toast({ title: 'Error al cancelar', description: err.message, variant: 'destructive' });
                    setCancelling(null);
                  },
                });
              }}
            >
              {isPending ? 'Cancelando...' : 'Sí, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse border border-border/30" />
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface AthleteClassBookingProps {
  mode?: 'all' | 'available' | 'my';
  childId?: string;
}

export function AthleteClassBooking({ mode = 'all', childId }: AthleteClassBookingProps) {
  const [tab, setTab] = useState<'available' | 'my'>(
    mode === 'all' ? 'available' : (mode as 'available' | 'my')
  );

  return (
    <div className="space-y-4">
      {mode === 'all' && (
        <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border/30 w-fit">
          {[
            { key: 'available', label: 'Clases disponibles' },
            { key: 'my',        label: 'Mis reservas' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === key
                  ? 'bg-background text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'available' ? <AvailableTab childId={childId} /> : <MyBookingsTab childId={childId} />}
    </div>
  );
}
