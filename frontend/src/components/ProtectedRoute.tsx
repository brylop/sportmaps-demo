import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('athlete' | 'parent' | 'coach' | 'school' | 'school_admin' | 'wellness_professional' | 'store_owner' | 'admin' | 'super_admin' | 'organizer' | 'reporter')[];
  skipOnboardingCheck?: boolean;
}

// These context roles always override role restrictions — they're admins
const PRIVILEGED_CONTEXT_ROLES = ['owner', 'admin', 'super_admin', 'school_admin'];

export function ProtectedRoute({ children, allowedRoles, skipOnboardingCheck = false }: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { onboardingStatus, loading: schoolLoading, currentUserRole } = useSchoolContext();
  const location = useLocation();

  if (authLoading || (schoolLoading && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow access even without profile - it will be created automatically
  if (allowedRoles && profile) {
    // If the user has a privileged school context role (e.g., owner, admin),
    // they bypass all role restrictions — they should see everything.
    const hasPrivilegedContextRole = currentUserRole && PRIVILEGED_CONTEXT_ROLES.includes(currentUserRole);
    const hasAllowedProfileRole = allowedRoles.includes(profile.role as any);

    if (!hasPrivilegedContextRole && !hasAllowedProfileRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Hard Gate for School Onboarding (REMOVED: Consolidated in Dashboard)
  // Hard Gate for Other Roles (REMOVED: Consolidated in Dashboard)

  return <>{children}</>;
}