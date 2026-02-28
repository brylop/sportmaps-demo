import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useDashboardStats';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Campana de notificaciones global que vive en el header de AuthLayout.
 * Muestra un badge rojo animado cuando hay notificaciones sin leer.
 */
export function GlobalNotificationBell() {
    const navigate = useNavigate();
    const { data: notifications = [] } = useNotifications();

    const unreadCount = notifications.filter((n: any) => !n.read).length;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-9 w-9 hover:bg-accent transition-all duration-300"
                        onClick={() => navigate('/notifications')}
                        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
                    >
                        <Bell
                            className={`h-[18px] w-[18px] transition-all duration-300 ${unreadCount > 0
                                    ? 'text-primary animate-[bell-ring_0.5s_ease-in-out]'
                                    : 'text-muted-foreground'
                                }`}
                        />

                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm animate-in zoom-in-50 duration-300">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>
                        {unreadCount > 0
                            ? `${unreadCount} notificación${unreadCount > 1 ? 'es' : ''} sin leer`
                            : 'Sin notificaciones nuevas'}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
