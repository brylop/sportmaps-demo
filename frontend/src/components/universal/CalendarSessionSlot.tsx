import { useSessionAvailability, useBookingMutations } from '@/hooks/useSessionBookings';
import { useMyPlan } from '@/hooks/useMyPlan';
import { SessionCapacityBar } from './SessionCapacityBar';
import { BookingButton, BookingStatus } from './BookingButton';
import { useToast } from '@/hooks/use-toast';

interface CalendarSessionSlotProps {
    sessionId: string;
    teamName: string;
    sessionDate: string;
    /** ID del booking si ya tiene reserva en esta sesión */
    existingBookingId?: string | null;
    /** ID del enrollment para hacer la reserva */
    enrollmentId?: string;
    /** Si es reserva para un hijo */
    childId?: string;
    userId?: string;
    className?: string;
}

/**
 * Slot de sesión en el calendario con indicador de aforo y botón de reserva.
 * Solo se renderiza cuando features.selfBooking = true.
 */
export function CalendarSessionSlot({
    sessionId,
    teamName,
    sessionDate,
    existingBookingId,
    enrollmentId,
    childId,
    userId,
    className = '',
}: CalendarSessionSlotProps) {
    const { toast } = useToast();
    const { data: availability, isLoading } = useSessionAvailability(sessionId);
    const { plans } = useMyPlan(childId);
    const { bookSession, cancelBooking } = useBookingMutations();

    const activePlan = plans.find((p) => p.status === 'active' || p.status === 'expiring_soon');

    const getBookingStatus = (): BookingStatus => {
        if (bookSession.isPending || cancelBooking.isPending) return 'loading';
        if (existingBookingId) return 'booked';
        if (!activePlan) return 'no_plan';
        if (activePlan.status === 'expired') return 'expired';
        if (activePlan.status === 'exhausted') return 'exhausted';
        if (availability?.is_full) return 'full';
        return 'available';
    };

    const handleBook = () => {
        if (!enrollmentId) return;
        bookSession.mutate(
            {
                sessionId,
                enrollment_id: enrollmentId,
                ...(childId ? { child_id: childId } : { user_id: userId }),
                booking_type: 'reservation',
            },
            {
                onSuccess: () => toast({ title: 'Reserva confirmada' }),
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            }
        );
    };

    const handleCancel = () => {
        if (!existingBookingId) return;
        cancelBooking.mutate(existingBookingId, {
            onSuccess: () => toast({ title: 'Reserva cancelada' }),
            onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
        });
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border bg-card ${className}`}>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{teamName}</p>
                <p className="text-xs text-muted-foreground">{sessionDate}</p>
                {availability && (
                    <SessionCapacityBar
                        current={availability.current_bookings}
                        max={availability.max_capacity}
                        className="mt-1"
                    />
                )}
            </div>
            <div className="ml-3">
                <BookingButton
                    status={getBookingStatus()}
                    onBook={handleBook}
                    onCancel={handleCancel}
                    disabled={isLoading}
                />
            </div>
        </div>
    );
}
