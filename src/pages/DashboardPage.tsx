import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationList } from '@/components/dashboard/NotificationList';
import { InviteStudentModal } from '@/components/schools/InviteStudentModal';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { UserRole } from '@/types/dashboard';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch school ID for school role
  const { data: school } = useQuery({
    queryKey: ['user-school', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && profile?.role === 'school',
  });

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
        
        {/* Loading state while se carga el perfil */}
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
        {/* Quick Actions - Always show with modal handling for schools */}
        {config.quickActions && config.quickActions.length > 0 && (
          <QuickActions
            actions={config.quickActions.map((action) => {
              // Intercept "Gestionar Estudiantes" for schools to show modal
              if (profile?.role === 'school' && action.label === 'Gestionar Estudiantes') {
                return {
                  ...action,
                  onClick: () => setShowInviteModal(true),
                };
              }
              return action;
            })}
          />
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

      {/* Invite Student Modal for schools */}
      {profile?.role === 'school' && school && (
        <InviteStudentModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          schoolId={school.id}
        />
      )}
    </div>
  );
}