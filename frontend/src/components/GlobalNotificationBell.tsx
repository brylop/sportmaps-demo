import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useDashboardStats';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const TYPE_STYLES: Record<string, string> = {
  warning:  'bg-amber-100 text-amber-700 border-amber-200',
  success:  'bg-green-100 text-green-700 border-green-200',
  error:    'bg-red-100 text-red-700 border-red-200',
  info:     'bg-blue-100 text-blue-700 border-blue-200',
};

export function GlobalNotificationBell() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const { data: notifications = [] } = useNotifications();
  const unreadCount   = notifications.filter((n: any) => !n.read).length;

  const markRead = async (id: string, link?: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (link) navigate(link);
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1)   return 'Ahora';
    if (diff < 60)  return `Hace ${diff}m`;
    if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
    return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 hover:bg-accent transition-all duration-300"
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
        >
          <Bell className={`h-[18px] w-[18px] transition-all duration-300 ${
            unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'
          }`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm animate-in zoom-in-50 duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            {unreadCount > 0 && (
              <Badge className="h-5 text-[10px] px-1.5 bg-destructive">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sin notificaciones</p>
            </div>
          ) : (
            notifications.slice(0, 10).map((n: any) => (
              <div
                key={n.id}
                onClick={() => markRead(n.id, n.link)}
                className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors border-b last:border-0 ${
                  !n.read ? 'bg-primary/5' : ''
                }`}
              >
                {/* Indicador no leído */}
                <div className="mt-1.5 flex-shrink-0">
                  <div className={`h-2 w-2 rounded-full ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold truncate ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTime(n.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                  {n.link && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                      <ExternalLink className="h-3 w-3" />
                      Ver detalle
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => navigate('/notifications')}
              >
                Ver todas las notificaciones
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
