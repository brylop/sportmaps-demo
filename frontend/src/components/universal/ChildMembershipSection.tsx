import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import { useMyPlan } from '@/hooks/useMyPlan';
import { useMyBookings } from '@/hooks/useSessionBookings';
import { OfferingBadge } from './OfferingBadge';
import { PlanProgressBar } from './PlanProgressBar';
import { Badge } from '@/components/ui/badge';

interface ChildMembershipSectionProps {
    childId: string;
}

/**
 * Sección expandible de "Plan de Membresía" en el perfil de un hijo (rol Padre).
 * Incluye barra de progreso, vigencia e historial de bookings.
 */
export function ChildMembershipSection({ childId }: ChildMembershipSectionProps) {
    const { activePlan, isLoading: planLoading } = useMyPlan(childId);
    const { data: bookingsData, isLoading: bookingsLoading } = useMyBookings(childId);

    if (planLoading) {
        return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
    }

    if (!activePlan || activePlan.status === 'no_plan') {
        return null;
    }

    const bookings = bookingsData?.bookings ?? [];

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Plan de Membresía
                    </CardTitle>
                    <OfferingBadge status={activePlan.status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm font-semibold">{activePlan.offeringName}</p>
                    {activePlan.planName && (
                        <p className="text-xs text-muted-foreground">{activePlan.planName}</p>
                    )}
                </div>

                <PlanProgressBar
                    used={activePlan.sessionsUsed}
                    max={activePlan.sessionsMax}
                    label="Sesiones del ciclo"
                />

                {activePlan.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                        Vigencia hasta: {new Date(activePlan.expiresAt).toLocaleDateString('es-CO')}
                        {activePlan.daysLeft !== null && ` (${activePlan.daysLeft} días restantes)`}
                    </p>
                )}

                {/* Historial de bookings recientes */}
                {bookings.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Historial reciente</p>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {bookings.slice(0, 10).map((booking: any) => (
                                <div
                                    key={booking.id}
                                    className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                                >
                                    <span>{new Date(booking.booked_at).toLocaleDateString('es-CO')}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                        {booking.status === 'attended' ? 'Asistió' :
                                         booking.status === 'confirmed' ? 'Reservado' :
                                         booking.status === 'cancelled' ? 'Cancelado' :
                                         booking.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
