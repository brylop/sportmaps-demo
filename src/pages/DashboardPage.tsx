import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationList } from '@/components/dashboard/NotificationList';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { UserRole } from '@/types/dashboard';

export default function DashboardPage() {
  const { profile } = useAuth();
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete');

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{config.title}</h2>
        <p className="text-muted-foreground">{config.description}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {config.stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activities */}
        {config.activities && config.activities.length > 0 && (
          <div className="md:col-span-2 lg:col-span-1">
            <ActivityList
              title="Próximas Actividades"
              activities={config.activities}
            />
          </div>
        )}

        {/* Quick Actions */}
        {config.quickActions && config.quickActions.length > 0 && (
          <QuickActions actions={config.quickActions} />
        )}

        {/* Notifications */}
        {config.notifications && config.notifications.length > 0 && (
          <NotificationList notifications={config.notifications} />
        )}
      </div>
    </div>
  );
}