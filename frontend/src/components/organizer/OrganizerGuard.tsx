import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function OrganizerGuard() {
  const { user, profile, loading: authLoading } = useAuth();
  const location = useLocation();
  const [organizerStatus, setOrganizerStatus] = useState<
    'loading' | 'not_found' | 'unverified' | 'verified' | 'error'
  >('loading');

  useEffect(() => {
    let isMounted = true;

    async function checkOrganizerStatus() {
      if (!user?.id || profile?.role !== 'organizer') {
        if (isMounted) setOrganizerStatus('loading');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('event_organizers')
          .select('is_verified')
          .eq('user_id', user.id)
          .single();

        if (!isMounted) return;

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found
            setOrganizerStatus('not_found');
          } else {
            console.error('Error fetching organizer profile:', error);
            setOrganizerStatus('error');
          }
          return;
        }

        if (data) {
          setOrganizerStatus(data.is_verified ? 'verified' : 'unverified');
        } else {
          setOrganizerStatus('not_found');
        }
      } catch (err) {
        console.error('Check organizer status error:', err);
        if (isMounted) setOrganizerStatus('error');
      }
    }

    if (!authLoading) {
      checkOrganizerStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [user, profile, authLoading]);

  if (authLoading || organizerStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si no está autenticado o no es organizador, lo sacamos
  if (!user || profile?.role !== 'organizer') {
    return <Navigate to="/dashboard" replace />;
  }

  // Si es la ruta de onboarding
  const isOnboardingRoute = location.pathname.includes('/organizer/onboarding');

  // Si no ha hecho onboarding y NO está en la ruta de onboarding, redirigir
  if (organizerStatus === 'not_found' && !isOnboardingRoute) {
    return <Navigate to="/organizer/onboarding" replace />;
  }

  // Si YA hizo onboarding y trata de entrar al onboarding, mandarlo al dashboard
  if ((organizerStatus === 'unverified' || organizerStatus === 'verified') && isOnboardingRoute) {
    return <Navigate to="/organizer/dashboard" replace />;
  }

  return (
    <div className="flex flex-col min-h-screen w-full">
      {organizerStatus === 'unverified' && !isOnboardingRoute && (
        <Alert variant="warning" className="rounded-none border-t-0 border-x-0 border-b-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verificación Pendiente</AlertTitle>
          <AlertDescription>
            Tu cuenta de organizador está pendiente de revisión. Sube los documentos requeridos en tu <a href="/organizer/profile" className="font-semibold underline">perfil</a> para habilitar todas las funciones.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex-1 w-full bg-background/50">
        <Outlet />
      </div>
    </div>
  );
}
