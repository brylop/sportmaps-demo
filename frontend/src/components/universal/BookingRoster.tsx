import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlanProgressBar } from './PlanProgressBar';
import { SessionBooking } from '@/hooks/useSessionBookings';

interface BookingRosterProps {
    bookings: SessionBooking[];
    isLoading?: boolean;
}

const BOOKING_TYPE_BADGE: Record<string, { label: string; className: string }> = {
    reservation: { label: 'Reserva', className: 'bg-green-500/10 text-green-700 border-green-200' },
    drop_in: { label: 'Drop-in', className: 'bg-blue-500/10 text-blue-700 border-blue-200' },
    walk_in: { label: 'Walk-in', className: 'bg-gray-500/10 text-gray-500 border-gray-200' },
};

/**
 * Lista de atletas con reserva para una sesión (vista del Coach).
 * Muestra badge de tipo y mini indicador de sesiones restantes.
 */
export function BookingRoster({ bookings, isLoading }: BookingRosterProps) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                ))}
            </div>
        );
    }

    if (bookings.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-8">
                No hay reservas para esta sesión.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {bookings.map((booking) => (
                <BookingRosterRow key={booking.id} booking={booking} />
            ))}
        </div>
    );
}

function BookingRosterRow({ booking }: { booking: SessionBooking }) {
    const person = booking.person;
    const typeBadge = BOOKING_TYPE_BADGE[booking.booking_type] ?? BOOKING_TYPE_BADGE.walk_in;
    const plan = booking.enrollment?.plan;
    const sessionsUsed = booking.enrollment?.sessions_used ?? 0;
    const maxSessions = plan?.max_sessions ?? null;

    const initials = person?.full_name
        ?.split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ?? '?';

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Avatar className="h-8 w-8">
                <AvatarImage src={person?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{person?.full_name ?? 'Desconocido'}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeBadge.className}`}>
                        {typeBadge.label}
                    </Badge>
                    {booking.is_secondary && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Secundaria
                        </Badge>
                    )}
                </div>
                {plan && (
                    <div className="mt-1 max-w-[200px]">
                        <PlanProgressBar
                            used={sessionsUsed}
                            max={maxSessions}
                            compact
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
