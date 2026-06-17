import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('athlete' | 'parent' | 'coach' | 'school' | 'school_admin' | 'wellness_professional' | 'store_owner' | 'admin' | 'super_admin' | 'organizer' | 'reporter')[];
  skipOnboardingCheck?: boolean;
  /** When true, allowedRoles is enforced strictly — school context roles do NOT bypass. */
  strictRoleCheck?: boolean;
}

// These context roles always override role restrictions — they're admins
const PRIVILEGED_CONTEXT_ROLES = ['owner', 'admin', 'super_admin', 'school_admin'];

export function ProtectedRoute({ children, allowedRoles, skipOnboardingCheck = false, strictRoleCheck = false }: ProtectedRouteProps) {
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
    return <Navigate to="/login" replace />;
  }

  // Selección de rol diferida: usuarios que entraron por OAuth (Google) sin
  // rol asignado deben elegirlo antes de usar la app. skipOnboardingCheck
  // exime a la propia pantalla de selección para evitar bucle de redirección.
  if (
    !skipOnboardingCheck &&
    profile?.needs_role_selection &&
    location.pathname !== '/onboarding/role'
  ) {
    return <Navigate to="/onboarding/role" replace />;
  }

  // Allow access even without profile - it will be created automatically
  if (allowedRoles && profile) {
    const hasAllowedProfileRole = allowedRoles.includes(profile.role as any);

    if (strictRoleCheck) {
      // Strict mode: only profile.role counts. Used by routes that consume
      // platform-wide RPCs gated server-side (e.g. super-admin-only pages).
      if (!hasAllowedProfileRole) {
        return <Navigate to="/unauthorized" replace />;
      }
    } else {
      // Default: privileged context roles bypass.
      const hasPrivilegedContextRole = currentUserRole && PRIVILEGED_CONTEXT_ROLES.includes(currentUserRole);
      if (!hasPrivilegedContextRole && !hasAllowedProfileRole) {
        return <Navigate to="/unauthorized" replace />;
      }
    }
  }

  // Hard Gate for School Onboarding (REMOVED: Consolidated in Dashboard)
  // Hard Gate for Other Roles (REMOVED: Consolidated in Dashboard)

  return <>{children}</>;
}