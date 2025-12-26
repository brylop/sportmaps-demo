import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationList } from '@/components/dashboard/NotificationList';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { useDashboardStats, useNotifications } from '@/hooks/useDashboardStats';
import { UserRole } from '@/types/dashboard';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete');
  const { data: stats } = useDashboardStats();
  const { data: notifications } = useNotifications();

  // Redirect users to onboarding if they haven't completed setup
  useEffect(() => {
    if (!profile || !user) return;

    const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`);
    
    if (!hasCompletedOnboarding) {
      // Redirect each role to their respective onboarding
      switch (profile.role) {
        case 'school':
          navigate('/school-onboarding');
          break;
        case 'coach':
          navigate('/coach-onboarding');
          break;
        case 'athlete':
          navigate('/athlete-onboarding');
          break;
        case 'wellness_professional':
          navigate('/wellness-onboarding');
          break;
        case 'store_owner':
          navigate('/store-onboarding');
          break;
        // parent doesn't need onboarding, they go directly to dashboard
        default:
          break;
      }
    }
  }, [profile, user, navigate]);

  if (!profile) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="sr-only">Cargando panel</span>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Cargando tu panel...</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Override static stats with real data
  const dynamicStats = config.stats.map((stat, index) => {
    if (!stats) return stat;
    
    // Map specific stats based on role
    if (profile.role === 'parent') {
      if (index === 0) return { ...stat, value: stats.children, description: stats.children > 0 ? 'Hijos registrados' : 'Aún no has agregado hijos' };
      if (index === 3) return { ...stat, value: stats.unreadNotifications, description: 'Sin leer' };
    }
    if (profile.role === 'coach') {
      if (index === 0) return { ...stat, value: stats.teams, description: stats.teams > 0 ? 'Equipos activos' : 'Aún no tienes equipos' };
    }
    if (profile.role === 'store_owner') {
      if (index === 0) return { ...stat, value: stats.products, description: stats.products > 0 ? 'En tu catálogo' : 'Crea tu primer producto' };
      if (index === 2) return { ...stat, value: stats.orders, description: 'Pedidos totales' };
    }
    if (profile.role === 'wellness_professional') {
      if (index === 1) return { ...stat, value: stats.appointments, description: 'Citas programadas' };
      if (index === 2) return { ...stat, value: stats.evaluations, description: 'Evaluaciones realizadas' };
    }
    if (profile.role === 'school') {
      if (index === 1) return { ...stat, value: stats.programs, description: stats.programs > 0 ? 'Programas activos' : 'Crea tu primer programa' };
    }
    
    return stat;
  });

  // Transform notifications for display
  const displayNotifications = notifications?.slice(0, 5).map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type as 'info' | 'warning' | 'success',
    read: n.read || false,
    timestamp: new Date(n.created_at).toLocaleDateString('es', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{config.title}</h2>
        <p className="text-muted-foreground">{config.description}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dynamicStats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions - Always show */}
        {config.quickActions && config.quickActions.length > 0 && (
          <QuickActions actions={config.quickActions} />
        )}

        {/* Activities - Only show if there are activities */}
        {config.activities && config.activities.length > 0 && (
          <div className="md:col-span-2 lg:col-span-1">
            <ActivityList
              title="Próximas Actividades"
              activities={config.activities}
            />
          </div>
        )}

        {/* Notifications - Show real notifications */}
        {displayNotifications && displayNotifications.length > 0 && (
          <NotificationList notifications={displayNotifications} />
        )}
      </div>
    </div>
  );
}
