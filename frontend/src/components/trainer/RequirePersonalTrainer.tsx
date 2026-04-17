import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Guard para rutas de entrenador personal.
 * Pasa si:
 *  - isPersonalTrainer (escuela provisioned encontrada en DB) O
 *  - profile.role === 'personal_trainer' (fallback si schools query falla o está pendiente)
 * - Si está cargando → no renderiza nada
 */
export function RequirePersonalTrainer() {
  const { isPersonalTrainer, loading, profile, trainerOnboardingStatus } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const isTrainer = isPersonalTrainer || profile?.role === 'personal_trainer';
  if (!isTrainer) return <Navigate to="/unauthorized" replace />;

  if (trainerOnboardingStatus !== 'completed' && !location.pathname.includes('/onboarding')) {
    return <Navigate to="/trainer/onboarding" replace />;
  }

  return <Outlet />;
}
