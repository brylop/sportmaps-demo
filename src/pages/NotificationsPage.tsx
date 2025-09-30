import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Trash2,
  Check,
  Filter
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    href: string;
  };
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Partido próximo',
    message: 'Tienes un partido mañana a las 10:00 AM vs Academia Norte',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
    action: { label: 'Ver detalles', href: '/calendar' }
  },
  {
    id: '2',
    type: 'success',
    title: 'Asistencia confirmada',
    message: 'Tu asistencia al entrenamiento de hoy ha sido registrada',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    read: false
  },
  {
    id: '3',
    type: 'info',
    title: 'Nuevo mensaje del entrenador',
    message: 'El entrenador Carlos ha enviado información sobre el próximo torneo',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    read: true,
    action: { label: 'Ver mensaje', href: '/messages' }
  },
  {
    id: '4',
    type: 'success',
    title: 'Pago procesado',
    message: 'Tu pago de mensualidad ha sido procesado correctamente',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    read: true
  },
  {
    id: '5',
    type: 'info',
    title: 'Actualización de horario',
    message: 'El entrenamiento del viernes se ha movido a las 17:00',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    read: true
  }
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    const icons = {
      success: CheckCircle,
      warning: AlertCircle,
      error: AlertCircle,
      info: Info
    };
    return icons[type];
  };

  const getIconColor = (type: Notification['type']) => {
    const colors = {
      success: 'text-green-600',
      warning: 'text-orange-500',
      error: 'text-red-600',
      info: 'text-primary'
    };
    return colors[type];
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Hace un momento';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} minutos`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`;
    return `Hace ${Math.floor(seconds / 86400)} días`;
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Notificaciones
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-sm">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Mantente al día con todas tus actualizaciones
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" className="gap-2">
            <Check className="h-4 w-4" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                Todas ({notifications.length})
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                No leídas ({unreadCount})
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay notificaciones</h3>
              <p className="text-muted-foreground">
                {filter === 'unread' 
                  ? 'Has leído todas tus notificaciones'
                  : 'No tienes notificaciones en este momento'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification, index) => {
            const Icon = getIcon(notification.type);
            return (
              <Card
                key={notification.id}
                className={`transition-all hover:shadow-md animate-in slide-in-from-left ${
                  !notification.read ? 'border-primary/50 bg-primary/5' : ''
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full bg-background ${getIconColor(notification.type)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm">
                          {notification.title}
                          {!notification.read && (
                            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-primary" />
                          )}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {getTimeAgo(notification.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        {notification.action && (
                          <Button size="sm" variant="outline">
                            {notification.action.label}
                          </Button>
                        )}
                        {!notification.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(notification.id)}
                            className="gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Marcar como leída
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNotification(notification.id)}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
