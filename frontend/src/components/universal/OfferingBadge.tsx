import { Badge } from '@/components/ui/badge';

type OfferingStatus = 'active' | 'expiring_soon' | 'exhausted' | 'expired' | 'no_plan';

interface OfferingBadgeProps {
    status: OfferingStatus;
    label?: string;
    className?: string;
}

const STATUS_CONFIG: Record<OfferingStatus, { className: string; text: string }> = {
    active: {
        className: 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800',
        text: 'Activo',
    },
    expiring_soon: {
        className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400 dark:border-yellow-800',
        text: 'Por vencer',
    },
    exhausted: {
        className: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800',
        text: 'Agotado',
    },
    expired: {
        className: 'bg-gray-500/10 text-gray-500 border-gray-200 dark:text-gray-400 dark:border-gray-700',
        text: 'Vencido',
    },
    no_plan: {
        className: 'bg-transparent text-muted-foreground border-muted',
        text: 'Sin plan',
    },
};

export function OfferingBadge({ status, label, className = '' }: OfferingBadgeProps) {
    const config = STATUS_CONFIG[status];
    return (
        <Badge variant="outline" className={`${config.className} ${className}`}>
            {label ?? config.text}
        </Badge>
    );
}
