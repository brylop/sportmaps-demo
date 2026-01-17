import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationList } from '@/components/dashboard/NotificationList';
import { WelcomeMessage } from '@/components/dashboard/WelcomeMessage';
import { ProfileCompletionBanner } from '@/components/dashboard/ProfileCompletionBanner';
import { PendingEnrollmentModal } from '@/components/dashboard/PendingEnrollmentModal';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { useDashboardStats, useNotifications } from '@/hooks/useDashboardStats';
import { UserRole } from '@/types/dashboard';
import { DemoTour } from '@/components/demo/DemoTour';
import { DemoConversionModal } from '@/components/modals/DemoConversionModal';
import { getDemoSchoolData, getDemoParentData, formatCurrency } from '@/lib/demo-data';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete');
  const { data: stats } = useDashboardStats();
  const { data: notifications } = useNotifications();
  
  // Check if in demo mode
  const isDemoMode = sessionStorage.getItem('demo_mode') === 'true';
  const demoRole = sessionStorage.getItem('demo_role') || 'school';

  // Redirect users to onboarding if they haven't completed setup (skip for demo users)
  useEffect(() => {
    if (!profile || !user || isDemoMode) return;

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
  }, [profile, user, navigate, isDemoMode]);

  // Get demo data if in demo mode
  const demoSchoolData = isDemoMode && profile?.role === 'school' ? getDemoSchoolData() : null;
  const demoParentData = isDemoMode && profile?.role === 'parent' ? getDemoParentData() : null;

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

  // Override static stats with real or demo data
  const dynamicStats = config.stats.map((stat, index) => {
    // If demo mode, use demo data
    if (isDemoMode) {
      if (profile.role === 'school' && demoSchoolData) {
        if (index === 0) return { ...stat, value: formatCurrency(demoSchoolData.monthly_revenue), description: 'Ingresos este mes' };
        if (index === 1) return { ...stat, value: demoSchoolData.students_count, description: `${demoSchoolData.students_count} estudiantes activos` };
        if (index === 2) return { ...stat, value: demoSchoolData.programs.length, description: 'Programas activos' };
        if (index === 3) return { ...stat, value: demoSchoolData.pending_payments, description: 'Pagos pendientes' };
      }
      if (profile.role === 'parent' && demoParentData) {
        if (index === 0) return { ...stat, value: demoParentData.children.length, description: 'Hijos registrados' };
        if (index === 1) return { ...stat, value: demoParentData.children[0]?.attendance + '%', description: 'Asistencia promedio' };
        if (index === 2) return { ...stat, value: demoParentData.upcoming_payments.length, description: 'Pagos próximos' };
      }
    }
    
    // Otherwise use real stats if available
    if (!stats) return stat;
    
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

  // Transform notifications for display (use demo if in demo mode)
  let displayNotifications;
  if (isDemoMode && demoSchoolData) {
    displayNotifications = demoSchoolData.notifications.map((n, idx) => ({
      id: `demo-${idx}`,
      title: n.type === 'success' ? '💰 Pago Recibido' : n.type === 'warning' ? '⚠️ Atención' : 'ℹ️ Información',
      message: n.message,
      type: n.type,
      read: false,
      timestamp: n.time
    }));
  } else {
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
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Demo Tour */}
      {isDemoMode && (
        <DemoTour 
          role={demoRole as any} 
          onComplete={() => {
            // Tour completed
            console.log('Tour completed');
          }}
        />
      )}

      {/* Demo Conversion Modal */}
      {isDemoMode && <DemoConversionModal role={demoRole} />}

      {/* Pending Enrollment Modal */}
      <PendingEnrollmentModal />

      {/* Profile Completion Banner - hide in demo mode */}
      {!isDemoMode && showProfileBanner && (
        <ProfileCompletionBanner onDismiss={() => setShowProfileBanner(false)} />
      )}

      {/* Welcome Message */}
      <WelcomeMessage 
        role={profile.role as UserRole} 
        userName={profile.full_name?.split(' ')[0]}
      />

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold font-poppins tracking-tight">{config.title}</h2>
        <p className="text-muted-foreground font-poppins">{config.description}</p>
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
