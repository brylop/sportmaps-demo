interface PlanProgressBarProps {
    used: number;
    max: number | null;
    label?: string;
    compact?: boolean;
    className?: string;
}

/**
 * Barra de progreso de uso de sesiones de un plan.
 * Alerta visual automática cuando used/max > 0.85.
 *
 * compact = true muestra solo la barra, sin labels.
 */
export function PlanProgressBar({ used, max, label, compact = false, className = '' }: PlanProgressBarProps) {
    if (max === null) {
        return (
            <span className="text-sm text-muted-foreground">
                {label ?? 'Ilimitado'}
            </span>
        );
    }

    const pct = max > 0 ? Math.round((used / max) * 100) : 0;
    const remaining = Math.max(0, max - used);
    const color =
        pct >= 85 ? 'bg-red-500' :
        pct >= 60 ? 'bg-yellow-400' :
        'bg-green-500';

    if (compact) {
        return (
            <div className={`flex items-center gap-1.5 ${className}`}>
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden min-w-[40px]">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${color}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {used}/{max}
                </span>
            </div>
        );
    }

    return (
        <div className={`space-y-1 ${className}`}>
            {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
            <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${color}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{used} usadas</span>
                <span>{remaining} restantes</span>
            </div>
        </div>
    );
}
