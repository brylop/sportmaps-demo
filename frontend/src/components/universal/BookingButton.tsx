import { Button } from '@/components/ui/button';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';

export type BookingStatus =
    | 'available'
    | 'booked'
    | 'full'
    | 'no_plan'
    | 'not_bookable'
    | 'expired'
    | 'exhausted'
    | 'loading';

interface BookingButtonProps {
    status: BookingStatus;
    onBook: () => void;
    onCancel: () => void;
    disabled?: boolean;
    size?: 'sm' | 'default';
    className?: string;
}

const STATUS_CONFIG: Record<BookingStatus, {
    label: string;
    variant: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
    icon?: React.ElementType;
    action: 'book' | 'cancel' | 'none';
}> = {
    available: { label: 'Reservar', variant: 'default', action: 'book' },
    booked: { label: 'Cancelar reserva', variant: 'outline', icon: Check, action: 'cancel' },
    full: { label: 'Lleno', variant: 'secondary', icon: X, action: 'none' },
    no_plan: { label: 'Sin plan activo', variant: 'ghost', icon: AlertCircle, action: 'none' },
    not_bookable: { label: '', variant: 'ghost', action: 'none' },
    expired: { label: 'Plan vencido', variant: 'ghost', icon: AlertCircle, action: 'none' },
    exhausted: { label: 'Sesiones agotadas', variant: 'ghost', icon: AlertCircle, action: 'none' },
    loading: { label: 'Reservando...', variant: 'default', icon: Loader2, action: 'none' },
};

/**
 * Botón de reserva con estados contextuales.
 *
 * 'not_bookable' = escuela en modo tradicional → no renderiza nada.
 */
export function BookingButton({
    status,
    onBook,
    onCancel,
    disabled,
    size = 'sm',
    className = '',
}: BookingButtonProps) {
    if (status === 'not_bookable') return null;

    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    const handleClick = () => {
        if (config.action === 'book') onBook();
        else if (config.action === 'cancel') onCancel();
    };

    return (
        <Button
            variant={config.variant}
            size={size}
            disabled={disabled || config.action === 'none'}
            onClick={handleClick}
            className={className}
        >
            {Icon && (
                <Icon className={`h-4 w-4 mr-1 ${status === 'loading' ? 'animate-spin' : ''}`} />
            )}
            {config.label}
        </Button>
    );
}
