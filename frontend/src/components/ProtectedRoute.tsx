import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('athlete' | 'parent' | 'coach' | 'school' | 'wellness_professional' | 'store_owner' | 'admin' | 'organizer')[];
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

  // Hard Gate for School Onboarding (HU-0.2)
  // Hard Gate for School Onboarding (HU-0.2)
  // Keeps existing school context logic which is robust for multi-step school setup
  if (
    !skipOnboardingCheck &&
    (profile?.role === 'school' || currentUserRole === 'owner') &&
    onboardingStatus !== 'completed' &&
    location.pathname !== '/school-onboarding'
  ) {
    return <Navigate to="/school-onboarding" replace />;
  }

  // Hard Gate for Other Roles based on profile flag
  if (
    !skipOnboardingCheck &&
    profile &&
    profile.role !== 'school' && // School is handled above
    profile.onboarding_completed === false
  ) {
    let targetRoute = '';

    switch (profile.role) {
      case 'coach':
        targetRoute = '/coach-onboarding';
        break;
      case 'athlete':
        targetRoute = '/athlete-onboarding';
        break;
      case 'parent':
        targetRoute = '/parent-onboarding';
        break;
      case 'wellness_professional':
        targetRoute = '/wellness-onboarding';
        break;
      case 'store_owner':
        targetRoute = '/store-onboarding';
        break;
      case 'organizer':
        targetRoute = '/organizer-onboarding';
        break;
      default:
        // Admin or others might not have onboarding
        break;
    }

    if (targetRoute && location.pathname !== targetRoute) {
      return <Navigate to={targetRoute} replace />;
    }
  }

  return <>{children}</>;
}