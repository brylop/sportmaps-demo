import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicPoll, useConfirmAttendance } from '@/hooks/usePolls';
import { useAuth } from '@/contexts/AuthContext';
import { PollSession } from '@/lib/api/polls.api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useMyPlan } from '@/hooks/useMyPlan';

// Token único por dispositivo para anti doble-voto
function getPollToken(): string {
  const key = 'sportmaps_poll_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export default function PublicPollPage() {
  const { pollId }                      = useParams<{ pollId: string }>();
  const { user } = useAuth();
  const { activePlan: enrollment } = useMyPlan();
  const { data: poll, isLoading, isError } = usePublicPoll(pollId!);
  const { mutate: confirm, isPending }  = useConfirmAttendance(pollId!);

  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [guestName, setGuestName]        = useState('');
  const [guestPhone, setGuestPhone]      = useState('');
  const [confirmed, setConfirmed]        = useState(false);
  const [confirmedSessions, setConfirmedSessions] = useState<PollSession[]>([]);

  const isRegistered = !!user;
  const pollToken    = getPollToken();

  const toggle = (sessionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (!poll || selected.size === 0) return;

    const sessionsToConfirm = [...selected];
    let completed = 0;

    sessionsToConfirm.forEach((sessionId) => {
      const payload = isRegistered
        ? { session_id: sessionId, user_id: user.id, enrollment_id: enrollment?.enrollmentId }
        : { session_id: sessionId, guest_name: guestName, guest_phone: guestPhone, poll_token: pollToken };

      confirm(payload, {
        onSuccess: () => {
          completed++;
          if (completed === sessionsToConfirm.length) {
            const sessions = poll.attendance_sessions.filter((s) => selected.has(s.id));
            setConfirmedSessions(sessions);
            setConfirmed(true);
          }
        },
      });
    });
  };

  const canConfirm = selected.size > 0 && (isRegistered || (guestName.trim().length > 0));

  if (isLoading) return <PublicPollSkeleton />;

  if (isError || !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-medium">Esta encuesta no está disponible</p>
          <p className="text-sm text-muted-foreground">
            Puede que ya haya sido cerrado o el link sea incorrecto.
          </p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              ¡Listo{isRegistered ? `, ${user.user_metadata?.full_name?.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tu asistencia quedó confirmada. El coach ya puede verte en la lista.
            </p>
          </div>
          <div className="space-y-2">
            {confirmedSessions.map((s) => (
              <div
                key={s.id}
                className="bg-primary/10 text-primary rounded-lg px-4 py-3 text-sm font-medium text-left"
              >
                {s.title}
              </div>
            ))}
          </div>
          {!isRegistered && (
            <div className="border rounded-lg p-4 text-left space-y-2">
              <p className="text-sm font-medium">¿Entrenas seguido?</p>
              <p className="text-xs text-muted-foreground">
                Crea tu cuenta y la próxima semana confirmas en un tap, sin llenar datos.
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => window.location.href = '/register'}
              >
                Crear cuenta gratis
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const maxPerDay = enrollment?.sessionsMax ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="px-5 pt-8 pb-5 border-b">
          {poll.school?.logo_url && (
            <img
              src={poll.school.logo_url}
              alt={poll.school.name}
              className="w-8 h-8 rounded-full object-cover mb-3"
            />
          )}
          <p className="text-xs text-muted-foreground">{poll.school?.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{poll.title}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(poll.poll_date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>

        {/* Usuario registrado */}
        {isRegistered && (
          <div className="mx-5 mt-4 flex items-center gap-3 bg-secondary rounded-lg px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              {user.user_metadata?.full_name?.slice(0, 2).toUpperCase() ?? 'TÚ'}
            </div>
            <div>
              <p className="text-sm font-medium">{user.user_metadata?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {enrollment?.planName ?? 'Sin plan activo'}
                {maxPerDay > 1 ? ` · ${selected.size}/${maxPerDay} clases` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Clases */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Selecciona las clases a las que vas
          </p>

          {poll.attendance_sessions.map((session) => {
            const isSelected  = selected.has(session.id);
            const isFull      = session.confirmed_count! >= session.max_capacity;
            const pct         = Math.round(
              ((session.confirmed_count ?? 0) / session.max_capacity) * 100
            );

            return (
              <button
                key={session.id}
                disabled={isFull && !isSelected}
                onClick={() => !isFull && toggle(session.id)}
                className={[
                  'w-full text-left border rounded-xl p-4 transition-all relative overflow-hidden',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isFull
                    ? 'border-border/40 opacity-60 cursor-not-allowed'
                    : 'border-border hover:border-border/80',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12">
                        <path
                          d="M2 6l3.5 3.5L10 3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{session.title}</span>
                      {isFull && (
                        <Badge variant="secondary" className="text-xs py-0">Lleno</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">{session.confirmed_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">van</p>
                  </div>
                </div>

                {/* Barra de ocupación */}
                <div className="mt-3 w-full bg-secondary rounded-full h-1">
                  <div
                    className={[
                      'h-1 rounded-full transition-all',
                      isSelected ? 'bg-primary' : 'bg-muted-foreground/30',
                    ].join(' ')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Formulario invitado */}
        {!isRegistered && selected.size > 0 && (
          <div className="px-5 pb-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tu información
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-sm">Nombre completo</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej: Carlos Mendoza"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Teléfono (WhatsApp)</Label>
                <Input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+57 300 000 0000"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hint plan */}
        {isRegistered && selected.size >= maxPerDay && (
          <p className="text-xs text-muted-foreground text-center px-5 pb-2">
            Límite de tu plan alcanzado ({maxPerDay} clase{maxPerDay > 1 ? 's' : ''} por día)
          </p>
        )}

        {/* Botón confirmar */}
        <div className="px-5 pb-10">
          <Button
            className="w-full h-12 text-base"
            disabled={!canConfirm || isPending}
            onClick={handleConfirm}
          >
            {isPending
              ? 'Confirmando...'
              : selected.size > 0
              ? `Confirmar ${selected.size} clase${selected.size > 1 ? 's' : ''}`
              : 'Selecciona una clase'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PublicPollSkeleton() {
  return (
    <div className="max-w-md mx-auto p-5 space-y-4 mt-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-56" />
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </div>
  );
}
