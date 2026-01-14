import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationList } from '@/components/dashboard/NotificationList';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { UserRole } from '@/types/dashboard';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  
  // 1. Obtener estadísticas reales
  // El hook useDashboardStats se encarga de traer los datos frescos de Supabase
  const { stats, loading: statsLoading } = useDashboardStats((profile?.role as UserRole) || 'athlete');
  
  // 2. Pasar estadísticas a la configuración para actualizar la UI
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete', stats);

  // Redirect users to onboarding if they haven't completed setup
  useEffect(() => {
    if (!profile || !user) return;

    // Verificamos si el onboarding está marcado como completado en localStorage
    const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`);
    
    if (!hasCompletedOnboarding) {
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
        default:
          break;
      }
    }
  }, [profile, user, navigate]);

  // Mostrar spinner mientras cargamos perfil o estadísticas
  if (!profile || statsLoading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="sr-only">Cargando panel</span>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Actualizando tu panel...</p>
          </div>
        </div>
      </div>
    </div>
  );

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
          <StatCard 
            key={index} 
            {...stat} 
          />
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

        {/* Notifications - Only show if there are notifications */}
        {config.notifications && config.notifications.length > 0 && (
          <NotificationList notifications={config.notifications} />
        )}
      </div>
    </div>
  );
}