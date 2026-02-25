import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
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
import WelcomeSplash from '@/components/WelcomeSplash';
import { UserRole, OnboardingStep } from '@/types/dashboard';
import { Plus, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { DashboardChecklist } from '@/components/dashboard/DashboardChecklist';
import { InvitationBanner } from '@/components/dashboard/InvitationBanner';
import { CoachProfileWizard } from '@/components/coach/CoachProfileWizard';
import { supabase } from '@/integrations/supabase/client';
import { getStepsForRole } from '@/lib/onboarding/getStepsForRole';

export default function DashboardPage() {
  const { profile, user, updateProfile } = useAuth();
  const { toast } = useToast();
  const { activeBranchId, activeBranchName } = useSchoolContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingInviteId = localStorage.getItem('pending_invite_id');
  const inviteUrlId = searchParams.get('invite');
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [invitation, setInvitation] = useState<any | null>(null); // Keep any for polymorphic invitation data for now, but remove explicit any when possible
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showCoachWizard, setShowCoachWizard] = useState(false);

  // Show welcome splash if it's the first time
  useEffect(() => {
    if (profile && profile.onboarding_started === false) {
      setShowWelcomeSplash(true);
    }
  }, [profile]);

  const handleCloseWelcome = async () => {
    setShowWelcomeSplash(false);
    try {
      await updateProfile({ onboarding_started: true });
    } catch (error) {
      console.error("Error updating onboarding_started:", error);
    }
  };

  // Get real stats from NEW hook (Multitenant aware)
  const { stats: realStats, loading: realStatsLoading } = useDashboardStatsReal();

  // Keep old hook for structure config
  const { data: statsData } = useDashboardStats((profile?.role as UserRole) || 'athlete');
  const config = useDashboardConfig((profile?.role as UserRole) || 'athlete', statsData);
  const { data: notifications } = useNotifications();

  const refreshOnboardingData = useCallback(async () => {
    if (!profile || !user) return;

    try {
      // Prioridad: 1. URL (?invite=...)  2. localStorage (pending_invite_id)
      const targetInviteId = inviteUrlId || pendingInviteId;

      if (targetInviteId && targetInviteId.length > 30) {
        console.log('Intentando auto-aceptar invitación:', targetInviteId);
        const { error: acceptError } = await (supabase.rpc as any)('accept_invitation_pro', {
          p_invite_id: targetInviteId
        });

        if (!acceptError) {
          console.log('Invitación aceptada con éxito');
          // Solo limpiar si tuvo éxito
          localStorage.removeItem('pending_invite_id');
          toast({
            title: '¡Invitación aceptada!',
            description: 'Te hemos vinculado correctamente con la academia.',
          });

          // Limpiar el parámetro de la URL sin recargar para mantener fluidez
          if (inviteUrlId) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }

          // RECargar para asegurar que los nuevos permisos (role en profiles) se apliquen
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          console.error('Error al aceptar invitación:', acceptError);
          // Si el error es que ya no es válida o ya se procesó, entonces sí limpiamos para evitar bucles de error
          if (acceptError.message?.includes('ya procesada') || acceptError.message?.includes('no válida')) {
            localStorage.removeItem('pending_invite_id');
          }
        }
      }


      // 1. Obtener estados del checklist (La función SQL maestra)
      const { data: status, error: statusError } = await (supabase.rpc as any)('get_onboarding_status');
      if (statusError) throw statusError;

      // 2. Buscar invitaciones pendientes usando RPC (más robusto contra RLS)
      let currentInvites = null;
      try {
        const { data: invData, error: invError } = await (supabase.rpc as any)('get_my_invitations');
        if (!invError && invData && invData.length > 0) {
          currentInvites = invData[0];
          setInvitation({
            id: currentInvites.id,
            school_name: currentInvites.school_name,
            role_to_assign: currentInvites.role_to_assign,
            parentName: currentInvites.parent_name,
            childName: currentInvites.child_name,
            programName: currentInvites.program_name
          });
        } else {
          setInvitation(null);
        }
      } catch (invErr) {
        console.warn('Invitations fetch error:', invErr);
      }

      // 3. Procesar resultados para el checklist
      if (status) {
        const steps = getStepsForRole(profile.role as UserRole, status);
        setOnboardingSteps(steps);

        if (steps.every(s => s.completed)) {
          setShowProfileBanner(false);
        }

        // 4. Integrar lógica del Coach Wizard
        if (profile.role === 'coach') {
          const isWizardIncomplete = !status.has_bio || !status.has_experience || !status.has_sports;
          setShowCoachWizard(isWizardIncomplete);
        }
        // Here we could sync status.has_school etc to state if needed
      }
    } catch (error) {
      console.error('Error refreshing onboarding data:', error);
    } finally {
      setLoadingStatus(false);
    }
  }, [profile, user, toast]);

  useEffect(() => {
    refreshOnboardingData();
  }, [refreshOnboardingData, config.onboardingSteps]);

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

  // Dashboard handles empty states via the Quick Start Checklist

  // Logic to determine stats to display
  const dynamicStats = config.stats.map((stat, index) => {
    // 2. REAL USER: SHOW REAL DATA
    if (realStats && !realStatsLoading) {
      if (profile.role === 'school' || (profile.role as string) === 'school_admin' || profile.role === 'admin' || (profile.role as any) === 'super_admin' || profile.role === 'coach') {
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
          // Programs (Config Index 1) - Label and value
          const count = realStats.classes_count || 0;
          const label = profile.role === 'coach' ? 'Equipos' : 'Programas';
          return {
            ...stat,
            label, // Override label if coach
            value: count,
            description: profile.role === 'coach' ? 'Equipos asignados' : 'Clases/Programas creados'
          };
        }
        if (index === 2) {
          // Coaches or third card
          const count = realStats.activeTeams || 0;
          return {
            ...stat,
            value: count,
            description: profile.role === 'coach' ? 'Actividades próximas' : 'Entrenadores activos'
          };
        }
        if (index === 3) {
          // Revenue or notifications
          return {
            ...stat,
            value: profile.role === 'coach' ? (realStats.notifications || 0) : formatCurrency(realStats.monthly_revenue || 0),
            description: profile.role === 'coach' ? 'Mensajes nuevos' : 'Ingresos confirmados este mes'
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

      {/* Welcome Message */}
      <WelcomeMessage
        role={profile.role as UserRole}
        userName={profile.full_name?.split(' ')[0]}
      />

      {/* Pending Enrollment Modal */}
      <PendingEnrollmentModal />

      {/* Profile Completion Banner */}
      {showProfileBanner && (
        <ProfileCompletionBanner onDismiss={() => setShowProfileBanner(false)} />
      )}

      {/* Invitations and Onboarding Checklist */}
      {invitation && (
        <InvitationBanner
          invitation={invitation}
          onAction={() => {
            setInvitation(null);
            refreshOnboardingData();
          }}
        />
      )}

      {onboardingSteps.length > 0 && !onboardingSteps.every(s => s.completed) && (
        <DashboardChecklist
          steps={onboardingSteps}
          onStepClick={(step) => {
            if (step.id === 'complete_profile' && profile.role === 'coach') {
              setShowCoachWizard(true);
            } else {
              navigate(step.href);
            }
          }}
        />
      )}

      {/* Coach Profile Wizard */}
      {profile.role === 'coach' && (
        <CoachProfileWizard
          open={showCoachWizard}
          onOpenChange={setShowCoachWizard}
          onSuccess={refreshOnboardingData}
        />
      )}

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

      {showWelcomeSplash && (
        <WelcomeSplash
          userRole={profile.role}
          userName={
            (profile.role === 'school' || profile.role === 'school_admin')
              ? (activeBranchName || 'Tu Academia')
              : (profile.full_name?.split(' ')[0] || 'Usuario')
          }
          onComplete={handleCloseWelcome}
        />
      )}
    </div>
  );
}
