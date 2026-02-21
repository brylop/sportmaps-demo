import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('athlete' | 'parent' | 'coach' | 'school' | 'school_admin' | 'wellness_professional' | 'store_owner' | 'admin' | 'super_admin' | 'organizer')[];
  skipOnboardingCheck?: boolean;
}

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
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Hard Gate for School Onboarding (REMOVED: Consolidated in Dashboard)
  // Hard Gate for Other Roles (REMOVED: Consolidated in Dashboard)

  return <>{children}</>;
}