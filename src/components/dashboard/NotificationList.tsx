import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationItem } from '@/types/dashboard';
import { Bell, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface NotificationListProps {
  title?: string;
  notifications: NotificationItem[];
}

export function NotificationList({ title = 'Notificaciones Recientes', notifications }: NotificationListProps) {
  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'warning':
        return AlertCircle;
      default:
        return Info;
    }
  };

  const getIconColor = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-orange-500';
      default:
        return 'text-primary';
    }
  };

  return (
    <Card className="hover:shadow-card transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((notification) => {
            const Icon = getIcon(notification.type);
            return (
              <div
                key={notification.id}
                className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                  notification.read ? 'opacity-60' : 'bg-primary/5'
                }`}
              >
                <Icon className={`h-4 w-4 mt-1 flex-shrink-0 ${getIconColor(notification.type)}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{notification.title}</p>
                  <p className="text-muted-foreground text-sm">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{notification.timestamp}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
