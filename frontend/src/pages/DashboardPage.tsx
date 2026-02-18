import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationList } from '@/components/dashboard/NotificationList';
import { WelcomeMessage } from '@/components/dashboard/WelcomeMessage';
import { ProfileCompletionBanner } from '@/components/dashboard/ProfileCompletionBanner';
import { PendingEnrollmentModal } from '@/components/dashboard/PendingEnrollmentModal';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { useNotifications, useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardStatsReal } from '@/hooks/useDashboardStatsReal'; // Import the new hook
import { EmptyDashboardState } from '@/components/dashboard/EmptyDashboardState';
import { UserRole } from '@/types/dashboard';
import { Plus, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { activeBranchId, activeBranchName } = useSchoolContext();
  const navigate = useNavigate();
  const [showProfileBanner, setShowProfileBanner] = useState(true);

  // Get real stats from NEW hook (Multitenant aware)
  const { stats: realStats, loading: realStatsLoading } = useDashboardStatsReal();

  // Keep old hook for structure config
  const { data: statsData } = useDashboardStats((profile?.role as UserRole) || 'athlete');
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete', statsData);
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

  // COLD START CHECK:
  // If school owner has no active branch (meaning they skipped onboarding or DB is empty), show Empty State.
  if (profile.role === 'school' && !activeBranchId) {
    return <EmptyDashboardState userName={profile.full_name?.split(' ')[0] || 'Director'} />;
  }

  // Logic to determine stats to display
  const dynamicStats = config.stats.map((stat, index) => {
    // 2. REAL USER: SHOW REAL DATA
    if (realStats && !realStatsLoading) {
      if (profile.role === 'school') {
        if (index === 0) {
          // Students (Config Index 0)
          const count = realStats.students_count || 0;
          return {
            ...stat,
            value: count,
            description: count > 0
              ? `${count} estudiante${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}`
              : 'Agrega tu primer estudiante'
          };
        }
        if (index === 1) {
          // Programs (Config Index 1)
          const count = realStats.classes_count || 0;
          return {
            ...stat,
            value: count,
            description: 'Clases/Programas creados'
          };
        }
        if (index === 2) {
          // Coaches (Config Index 2)
          // Currently mapping activeTeams as proxy for coaches or just placeholder 0
          const count = realStats.activeTeams || 0;
          return {
            ...stat,
            value: count,
            description: 'Entrenadores activos'
          };
        }
        if (index === 3) {
          // Revenue (Config Index 3)
          return {
            ...stat,
            value: formatCurrency(realStats.monthly_revenue || 0),
            description: 'Ingresos confirmados este mes'
          };
        }
      }

      // Add logic for Parent real stats here if useDashboardStatsReal supports it
      if (profile.role === 'parent') {
        if (index === 0) {
          return {
            ...stat,
            value: realStats.children || 0,
            description: 'Hijos inscritos en academias'
          };
        }
        if (index === 1) {
          return {
            ...stat,
            value: realStats.children_attendance || '0%',
            description: 'Asistencia promedio (30 días)'
          };
        }
        if (index === 2) {
          return {
            ...stat,
            value: realStats.upcoming_payments || 0,
            description: 'Mensualidades pendientes'
          };
        }
      }
    }

    return stat;
  });

  // Transform notifications for display (Demo vs Real)
  let displayNotifications;

  displayNotifications = notifications?.slice(0, 5).map(n => ({
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

      {/* Pending Enrollment Modal */}
      <PendingEnrollmentModal />

      {/* Profile Completion Banner */}
      {showProfileBanner && (
        <ProfileCompletionBanner onDismiss={() => setShowProfileBanner(false)} />
      )}

      {/* Welcome Message */}
      <WelcomeMessage
        role={profile.role as UserRole}
        userName={profile.full_name?.split(' ')[0]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold font-poppins tracking-tight">{config.title}</h2>
            {activeBranchId && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 animate-in fade-in slide-in-from-left-2">
                <MapPin className="h-3 w-3 mr-1" />
                {activeBranchName}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground font-poppins">{config.description}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dynamicStats.map((stat, index) => (
          <div key={index} data-tour={
            index === 0 ? 'revenue-card' :
              index === 1 ? 'students-card' :
                index === 2 ? 'programs-card' :
                  'notifications-card'
          }>
            <StatCard {...stat} />
          </div>
        ))}
      </div>



      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions - Always show */}
        {config.quickActions && config.quickActions.length > 0 && (
          <div data-tour="quick-actions">
            <QuickActions actions={config.quickActions} />
          </div>
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

        {/* Notifications - Show real or demo notifications */}
        {displayNotifications && displayNotifications.length > 0 && (
          <NotificationList notifications={displayNotifications} />
        )}
      </div>
    </div>
  );
}
