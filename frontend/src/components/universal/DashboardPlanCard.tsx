import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, Zap } from 'lucide-react';
import { useMyPlan, PlanData } from '@/hooks/useMyPlan';
import { OfferingBadge } from './OfferingBadge';
import { PlanProgressBar } from './PlanProgressBar';

interface DashboardPlanCardProps {
    childId?: string;
    title?: string;
}

/**
 * Card de plan para el Dashboard del atleta o padre.
 * Muestra el plan activo con barra de progreso y badge de estado.
 *
 * No renderiza nada si no hay plan (aislamiento para modelo Porras).
 */
export function DashboardPlanCard({ childId, title = 'Mi Plan' }: DashboardPlanCardProps) {
    const { activePlan, isLoading } = useMyPlan(childId);

    if (isLoading) {
        return (
            <Card className="animate-pulse">
                <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                    <div className="h-8 bg-muted rounded w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!activePlan || activePlan.status === 'no_plan') {
        return null;
    }

    return <PlanCardContent plan={activePlan} title={title} />;
}

function PlanCardContent({ plan, title }: { plan: PlanData; title: string }) {
    const showAlert = plan.status === 'expiring_soon' || plan.status === 'exhausted';

    return (
        <Card className={showAlert ? 'border-yellow-300 dark:border-yellow-700' : ''}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        {title}
                    </CardTitle>
                    <OfferingBadge status={plan.status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div>
                    <p className="text-sm font-semibold">{plan.offeringName ?? plan.teamName}</p>
                    {plan.planName && (
                        <p className="text-xs text-muted-foreground">{plan.planName}</p>
                    )}
                </div>

                <PlanProgressBar
                    used={plan.sessionsUsed}
                    max={plan.sessionsMax}
                    label="Sesiones"
                />

                {plan.daysLeft !== null && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        <span>
                            {plan.daysLeft === 0
                                ? 'Vence hoy'
                                : `${plan.daysLeft} día${plan.daysLeft !== 1 ? 's' : ''} restante${plan.daysLeft !== 1 ? 's' : ''}`
                            }
                        </span>
                    </div>
                )}

                {showAlert && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        {plan.status === 'exhausted'
                            ? 'Has agotado todas tus sesiones. Renueva tu plan.'
                            : 'Tu plan está por vencer. Renuévalo pronto.'
                        }
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
