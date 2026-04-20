import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const VENDOR_ROLES = ['store_owner', 'wellness_professional'];

export function VendorGuard() {
  const { user, profile, loading: authLoading } = useAuth();
  const location = useLocation();
  const [vendorStatus, setVendorStatus] = useState<
    'loading' | 'not_found' | 'pending' | 'verified' | 'rejected' | 'error'
  >('loading');

  useEffect(() => {
    let isMounted = true;

    async function checkVendorStatus() {
      if (!user?.id || !VENDOR_ROLES.includes(profile?.role || '')) {
        if (isMounted) setVendorStatus('loading');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vendor_profiles')
          .select('verification_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching vendor profile:', error);
          setVendorStatus('error');
          return;
        }

        if (data) {
          setVendorStatus(data.verification_status as any);
        } else {
          setVendorStatus('not_found');
        }
      } catch (err) {
        console.error('Check vendor status error:', err);
        if (isMounted) setVendorStatus('error');
      }
    }

    if (!authLoading) {
      checkVendorStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [user, profile, authLoading]);

  if (authLoading || vendorStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !VENDOR_ROLES.includes(profile?.role || '')) {
    return <Navigate to="/dashboard" replace />;
  }

  const isOnboardingRoute = location.pathname.includes('/vendor/onboarding');

  // Sin perfil y no en onboarding → redirigir a onboarding
  if (vendorStatus === 'not_found' && !isOnboardingRoute) {
    return <Navigate to="/vendor/onboarding" replace />;
  }

  // Ya tiene perfil y trata de entrar al onboarding → mandarlo al dashboard
  if (vendorStatus !== 'not_found' && isOnboardingRoute) {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  return (
    <div className="flex flex-col min-h-screen w-full">
      {vendorStatus === 'pending' && !isOnboardingRoute && (
        <Alert variant="default" className="rounded-none border-t-0 border-x-0 border-b-2 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Verificacion Pendiente</AlertTitle>
          <AlertDescription className="text-amber-700">
            Tu cuenta de vendedor esta pendiente de verificacion. Algunas funciones estaran limitadas hasta que se complete la revision.
          </AlertDescription>
        </Alert>
      )}
      {vendorStatus === 'rejected' && !isOnboardingRoute && (
        <Alert variant="destructive" className="rounded-none border-t-0 border-x-0 border-b-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verificacion Rechazada</AlertTitle>
          <AlertDescription>
            Tu solicitud de verificacion fue rechazada. Contacta soporte para mas informacion.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex-1 w-full bg-background/50">
        <Outlet />
      </div>
    </div>
  );
}
