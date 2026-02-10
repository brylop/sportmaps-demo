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
import { useNotifications, useDashboardStats } from '@/hooks/useDashboardStats';
import { UserRole } from '@/types/dashboard';
import { DemoTour } from '@/components/demo/DemoTour';
import { DemoConversionModal } from '@/components/modals/DemoConversionModal';
import { studentsAPI } from '@/lib/api/students';
import { classesAPI } from '@/lib/api/classes';
import { getDemoSchoolData, getDemoParentData, formatCurrency } from '@/lib/demo-data';
import { Plus } from 'lucide-react';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [realStats, setRealStats] = useState<{
    students: number;
    classes: number;
    activeClasses: number;
    totalEnrolled: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Get real stats from hook (Supabase/Backend)
  const { data: statsData } = useDashboardStats((profile?.role as UserRole) || 'athlete');
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete', statsData);
  const { data: notifications } = useNotifications();

  // Check if in demo mode
  const isDemoMode = sessionStorage.getItem('demo_mode') === 'true';
  const demoRole = sessionStorage.getItem('demo_role') || 'school';

  // Get demo data objects
  const demoSchoolData = getDemoSchoolData();
  const demoParentData = getDemoParentData();

  // Load real stats from MongoDB API (Specifically for School role which needs separate API calls currently)
  // Ideally this should be moved to useDashboardStats hook entirely, but keeping strict separation for now as requested
  useEffect(() => {
    const loadRealStats = async () => {
      if (!profile || profile.role !== 'school') {
        setLoadingStats(false);
        return;
      }

      try {
        setLoadingStats(true);
        const schoolId = profile.id || 'demo-school';

        // Fetch real stats from MongoDB backend
        const [studentsData, classesStats] = await Promise.all([
          studentsAPI.getStats(schoolId).catch(() => ({ total: 0, active: 0, inactive: 0, by_grade: {} })),
          classesAPI.getStats(schoolId).catch(() => ({ total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 }))
        ]);

        setRealStats({
          students: studentsData.total,
          classes: classesStats.total,
          activeClasses: classesStats.active,
          totalEnrolled: classesStats.total_enrolled
        });
      } catch (error) {
        console.error('Error loading real stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    loadRealStats();
  }, [profile]);

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

  // Logic to determine stats to display
  const dynamicStats = config.stats.map((stat, index) => {
    // 1. DEMO MODE: ALWAYS SHOW FAKE ABUNDANT DATA
    if (isDemoMode) {
      if (profile.role === 'school') {
        if (index === 0) return { ...stat, value: formatCurrency(demoSchoolData.monthly_revenue), description: 'Ingresos este mes (Demo)' };
        if (index === 1) return { ...stat, value: demoSchoolData.students_count, description: `${demoSchoolData.students_count} estudiantes activos` };
        if (index === 2) return { ...stat, value: demoSchoolData.programs.length, description: 'Programas activos' };
        if (index === 3) return { ...stat, value: demoSchoolData.pending_payments, description: 'Pagos pendientes' };
      }
      if (profile.role === 'parent') {
        if (index === 0) return { ...stat, value: demoParentData.children.length, description: 'Hijos registrados (Demo)' };
        if (index === 1) return { ...stat, value: '95%', description: 'Asistencia promedio' };
        if (index === 2) return { ...stat, value: demoParentData.upcoming_payments.length, description: 'Pagos próximos' };
        if (index === 3) return { ...stat, value: 2, description: 'Notificaciones' };
      }
      return stat;
    }

    // 2. REAL USER: SHOW REAL DATA (useDashboardConfig already loaded it from useDashboardStats, 
    // but we might need to override School specifics if they come from separate API)

    // For School role, override with MongoDB API data if available
    if (profile.role === 'school' && realStats && !loadingStats) {
      if (index === 0) {
        // Revenue - Placeholder for now until connected to real payments
        return { ...stat, value: '$0', description: 'Configura pagos' };
      }
      if (index === 1) {
        return {
          ...stat,
          value: realStats.students,
          description: realStats.students > 0
            ? `${realStats.students} estudiante${realStats.students !== 1 ? 's' : ''}`
            : 'Agrega tu primer estudiante'
        };
      }
      if (index === 2) {
        return {
          ...stat,
          value: realStats.classes,
          description: realStats.classes > 0
            ? `${realStats.activeClasses} activa${realStats.activeClasses !== 1 ? 's' : ''}`
            : 'Crea tu primera clase'
        };
      }
      if (index === 3) {
        return {
          ...stat,
          value: realStats.totalEnrolled,
          description: 'Estudiantes inscritos'
        };
      }
    }

    // For Parent and other roles, useDashboardConfig already has the correct 0s from useDashboardStats
    // No manual override needed here, ensuring Clean State for new users!

    return stat;
  });

  // Transform notifications for display (Demo vs Real)
  let displayNotifications;

  if (isDemoMode && profile.role === 'school') {
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

      {/* Parent Dashboard: Children Section */}
      {profile?.role === 'parent' && isDemoMode && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold tracking-tight">Mis Hijos</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {demoParentData.children.map((child, i) => (
              <div key={i} className="bg-card text-card-foreground rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold">{child.name}</h4>
                    <p className="text-sm text-muted-foreground">{child.program}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Asistencia</span>
                    <span className="font-medium">{child.attendance}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Próxima clase</span>
                    <span className="font-medium text-right">{child.next_class}</span>
                  </div>
                  <div className="pt-2">
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-50 text-green-700 hover:bg-green-100">
                      Activo
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {/* Add Child Button */}
            <div className="bg-muted/30 border-dashed border-2 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors cursor-pointer text-muted-foreground hover:text-primary">
              <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center border shadow-sm">
                <Plus className="h-5 w-5" />
              </div>
              <p className="font-medium">Registrar otro hijo</p>
            </div>
          </div>
        </div>
      )}

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
