interface SessionCapacityBarProps {
    current: number;
    max: number | null;
    showLabel?: boolean;
    className?: string;
}

/**
 * Barra visual de aforo de una sesión.
 * Verde < 70%, amarillo 70-90%, rojo > 90%, bloqueado si = max.
 *
 * Si max es null, muestra "Sin límite".
 */
export function SessionCapacityBar({ current, max, showLabel = true, className = '' }: SessionCapacityBarProps) {
    if (max === null) {
        return <span className="text-xs text-muted-foreground">Sin límite</span>;
    }

    const pct = max > 0 ? Math.round((current / max) * 100) : 0;
    const color =
        pct >= 100 ? 'bg-red-500' :
        pct >= 90 ? 'bg-red-400' :
        pct >= 70 ? 'bg-yellow-400' :
        'bg-green-500';

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden min-w-[60px]">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${color}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            {showLabel && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {current}/{max}
                </span>
            )}
        </div>
    );
}
