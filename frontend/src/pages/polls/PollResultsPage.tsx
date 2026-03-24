import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Share2, Lock, UserPlus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePollResults, useClosePoll, useDeleteConfirmation } from '@/hooks/usePolls';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { SessionBooking, PollSession } from '@/lib/api/polls.api';
import { AddConfirmationDialog } from '@/pages/polls/components/AddConfirmationDialog';
import { toast } from 'sonner';

export default function PollResultsPage() {
  const { pollId }                    = useParams<{ pollId: string }>();
  const navigate                      = useNavigate();
  const { currentUserRole }           = useSchoolContext();
  const { data: poll, isLoading }     = usePollResults(pollId!);
  const { mutate: closePoll }         = useClosePoll();
  const { mutate: deleteConfirmation } = useDeleteConfirmation(pollId!);
  const [addToSession, setAddToSession] = useState<PollSession | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<{
    booking: SessionBooking; session: PollSession
  } | null>(null);

  const isAdmin = ['owner', 'admin', 'school_admin'].includes(currentUserRole ?? '');

  const handleShare = () => {
    const url = `${window.location.origin}/poll/${pollId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado al portapapeles');
  };

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  if (isLoading) return <ResultsSkeleton />;
  if (!poll)     return <div className="p-6 text-muted-foreground">Poll no encontrado</div>;

  const totalConfirmed = poll.attendance_sessions.reduce(
    (acc, s) => acc + (s.session_bookings?.length ?? 0), 0
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{poll.title}</h1>
              <Badge variant={poll.status === 'open' ? 'default' : 'secondary'}>
                {poll.status === 'open' ? 'Abierto' : 'Cerrado'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(poll.poll_date), "EEEE d 'de' MMMM", { locale: es })}
              {' · '}
              <span className="font-medium">{totalConfirmed} confirmados</span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              Compartir
            </Button>
            {poll.status === 'open' && (
              <Button variant="outline" size="sm" onClick={() => closePoll(poll.id)}>
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Cerrar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sesiones */}
      <div className="space-y-4">
        {poll.attendance_sessions.map((session) => {
          const bookings = session.session_bookings ?? [];
          const pct = Math.round((bookings.length / (session.max_capacity ?? 20)) * 100);

          return (
            <Card key={session.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">{session.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}
                      {session.coach && ` · ${session.coach.full_name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{bookings.length} / {session.max_capacity}</p>
                    <p className="text-xs text-muted-foreground">confirmados</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-2">
                {bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Sin confirmaciones aún</p>
                )}

                {bookings.map((booking) => {
                  const name = booking.user?.full_name ?? booking.unregistered?.full_name ?? '—';
                  const phone = booking.user?.phone ?? booking.unregistered?.phone;
                  const isGuest = !booking.user;
                  const plan = booking.enrollment?.offering_plan?.name;

                  return (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 py-1.5 border-b last:border-0"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={booking.user?.avatar_url} />
                        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{name}</span>
                          {isGuest && (
                            <Badge variant="outline" className="text-xs py-0 h-4">
                              Invitado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {plan ?? phone ?? 'Sin plan asignado'}
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(booking.booked_at), 'h:mm a')}
                      </p>

                      {isAdmin && (
                        <button
                          onClick={() => setBookingToDelete({ booking, session })}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 text-muted-foreground"
                    onClick={() => setAddToSession(session)}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Agregar manualmente
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog agregar manual */}
      {addToSession && (
        <AddConfirmationDialog
          poll={poll}
          session={addToSession}
          onClose={() => setAddToSession(null)}
        />
      )}

      {/* Confirmar eliminar booking */}
      <AlertDialog
        open={!!bookingToDelete}
        onOpenChange={() => setBookingToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar confirmación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la asistencia de{' '}
              <strong>
                {bookingToDelete?.booking.user?.full_name ??
                  bookingToDelete?.booking.unregistered?.full_name}
              </strong>{' '}
              de la clase <strong>{bookingToDelete?.session.title}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (bookingToDelete) {
                  deleteConfirmation({
                    sessionId: bookingToDelete.session.id,
                    bookingId: bookingToDelete.booking.id,
                  });
                }
                setBookingToDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
    </div>
  );
}
