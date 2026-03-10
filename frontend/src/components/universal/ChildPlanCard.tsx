import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, User } from 'lucide-react';
import { useMyPlan } from '@/hooks/useMyPlan';
import { OfferingBadge } from './OfferingBadge';
import { PlanProgressBar } from './PlanProgressBar';

interface ChildPlanCardProps {
    childId: string;
    childName: string;
}

/**
 * Card de plan de un hijo para el Dashboard del padre.
 * Muestra alerta si ≤ 2 sesiones restantes o plan por vencer en 5 días.
 */
export function ChildPlanCard({ childId, childName }: ChildPlanCardProps) {
    const { activePlan, isLoading } = useMyPlan(childId);

    if (isLoading) {
        return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
    }

    if (!activePlan || activePlan.status === 'no_plan') {
        return null;
    }

    const showAlert =
        activePlan.status === 'expiring_soon' ||
        activePlan.status === 'exhausted' ||
        (activePlan.sessionsRemaining !== null && activePlan.sessionsRemaining <= 2) ||
        (activePlan.daysLeft !== null && activePlan.daysLeft <= 5);

    return (
        <Card className={showAlert ? 'border-yellow-300 dark:border-yellow-700' : ''}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {childName}
                    </CardTitle>
                    <OfferingBadge status={activePlan.status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {activePlan.planName && (
                    <p className="text-xs text-muted-foreground">{activePlan.offeringName} — {activePlan.planName}</p>
                )}

                <PlanProgressBar
                    used={activePlan.sessionsUsed}
                    max={activePlan.sessionsMax}
                />

                {activePlan.daysLeft !== null && activePlan.daysLeft <= 5 && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        <CalendarClock className="h-3 w-3" />
                        <span>
                            {activePlan.daysLeft === 0 ? 'Vence hoy' : `Vence en ${activePlan.daysLeft} día${activePlan.daysLeft !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                )}

                {activePlan.sessionsRemaining !== null && activePlan.sessionsRemaining <= 2 && activePlan.sessionsRemaining > 0 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        Solo quedan {activePlan.sessionsRemaining} sesión{activePlan.sessionsRemaining !== 1 ? 'es' : ''}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
