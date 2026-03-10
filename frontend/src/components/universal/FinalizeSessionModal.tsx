import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SessionBooking } from '@/hooks/useSessionBookings';

interface FinalizeSessionModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    bookings: SessionBooking[];
    isLoading?: boolean;
}

/**
 * Modal de confirmación para finalizar sesión.
 * Muestra desglose de sesiones que se descontarán a cada atleta.
 */
export function FinalizeSessionModal({
    open,
    onClose,
    onConfirm,
    bookings,
    isLoading,
}: FinalizeSessionModalProps) {
    const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');

    return (
        <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar sesión</AlertDialogTitle>
                    <AlertDialogDescription>
                        Se marcarán como asistentes y se descontarán sesiones a los siguientes atletas:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="max-h-[300px] overflow-y-auto space-y-2 my-4">
                    {confirmedBookings.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No hay reservas confirmadas en esta sesión.
                        </p>
                    ) : (
                        confirmedBookings.map((booking) => {
                            const person = booking.person;
                            const plan = booking.enrollment?.plan;
                            const used = booking.is_secondary
                                ? (booking.enrollment?.secondary_sessions_used ?? 0)
                                : (booking.enrollment?.sessions_used ?? 0);
                            const max = booking.is_secondary
                                ? (plan?.max_secondary_sessions ?? null)
                                : (plan?.max_sessions ?? null);

                            return (
                                <div
                                    key={booking.id}
                                    className="flex items-center justify-between p-2 rounded border text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                            {person?.full_name ?? 'Desconocido'}
                                        </span>
                                        {booking.is_secondary && (
                                            <Badge variant="outline" className="text-[10px]">Sec</Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {max !== null
                                            ? `${used}/${max} → ${used + 1}/${max}`
                                            : 'Sin límite'
                                        }
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isLoading || confirmedBookings.length === 0}
                    >
                        {isLoading ? 'Finalizando...' : `Finalizar (${confirmedBookings.length} atletas)`}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
