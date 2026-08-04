import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, PauseCircle, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { VendorDocUploadModal } from './VendorDocUploadModal';

type VendorGate =
  | { state: 'loading' }
  | { state: 'no_profile' }
  | { state: 'inactive' }
  | { state: 'active'; verification: 'pending' | 'verified' | 'rejected'; docUrl: string | null }
  | { state: 'error' };

// Autorizacion por vendor_profile (no por role).
// Cualquier user con vendor_profile activo accede al panel "Mi Tienda".
// coach, school, parent, athlete pueden activar via /vendor/onboarding.
export function VendorGuard() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [gate, setGate] = useState<VendorGate>({ state: 'loading' });
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkVendorProfile() {
      if (!user?.id) {
        if (isMounted) setGate({ state: 'loading' });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vendor_profiles')
          .select('id, is_active, verification_status, verification_doc_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching vendor profile:', error);
          setGate({ state: 'error' });
          return;
        }

        if (!data) {
          setGate({ state: 'no_profile' });
          return;
        }

        if (!data.is_active) {
          setGate({ state: 'inactive' });
          return;
        }

        setGate({
          state: 'active',
          verification: (data.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected',
          docUrl: (data as any).verification_doc_url ?? null,
        });
      } catch (err) {
        console.error('Check vendor profile error:', err);
        if (isMounted) setGate({ state: 'error' });
      }
    }

    if (!authLoading) {
      checkVendorProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  if (authLoading || gate.state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isOnboardingRoute = location.pathname.includes('/vendor/onboarding');

  // Sin perfil de vendedor → mandar a activar tienda (onboarding)
  if (gate.state === 'no_profile' && !isOnboardingRoute) {
    return <Navigate to="/vendor/onboarding" replace />;
  }

  // Inactivo → puede reactivar desde onboarding
  if (gate.state === 'inactive' && !isOnboardingRoute) {
    return <Navigate to="/vendor/onboarding" replace state={{ reactivate: true }} />;
  }

  // Ya tiene perfil activo y trata de entrar al onboarding → enviarlo al dashboard
  if (gate.state === 'active' && isOnboardingRoute) {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  const showActiveBanners = gate.state === 'active' && !isOnboardingRoute;
  const showUploadCta = showActiveBanners && (gate.verification === 'pending' || gate.verification === 'rejected');

  return (
    <div className="flex flex-col min-h-screen w-full">
      {showActiveBanners && gate.verification === 'pending' && (
        <Alert variant="default" className="rounded-none border-t-0 border-x-0 border-b-2 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div className="flex items-start justify-between gap-3 w-full">
            <div className="flex-1">
              <AlertTitle className="text-amber-800">Verificacion pendiente</AlertTitle>
              <AlertDescription className="text-amber-700">
                {gate.docUrl
                    ? 'Tu documento esta en revision. Si necesitas actualizarlo, puedes subir uno nuevo.'
                    : 'Sube un documento (cedula, RUT, Camara de Comercio) para acelerar la revision y aparecer destacado.'}
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 bg-white hover:bg-amber-100 shrink-0"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              {gate.docUrl ? 'Actualizar documento' : 'Subir documento'}
            </Button>
          </div>
        </Alert>
      )}
      {showActiveBanners && gate.verification === 'rejected' && (
        <Alert variant="destructive" className="rounded-none border-t-0 border-x-0 border-b-2">
          <AlertTriangle className="h-4 w-4" />
          <div className="flex items-start justify-between gap-3 w-full">
            <div className="flex-1">
              <AlertTitle>Verificacion rechazada</AlertTitle>
              <AlertDescription>
                Tu solicitud fue rechazada. Sube un nuevo documento o contacta soporte.
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-red-700 hover:bg-red-50 shrink-0"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Subir nuevo documento
            </Button>
          </div>
        </Alert>
      )}
      {gate.state === 'inactive' && isOnboardingRoute && (
        <Alert variant="default" className="rounded-none border-t-0 border-x-0 border-b-2 bg-slate-50 border-slate-200">
          <PauseCircle className="h-4 w-4 text-slate-600" />
          <AlertTitle className="text-slate-800">Mi Tienda esta pausada</AlertTitle>
          <AlertDescription className="text-slate-700">
            Tu tienda esta desactivada. Completa el formulario para reactivarla.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex-1 w-full bg-background/50">
        <Outlet />
      </div>

      {showUploadCta && (
        <VendorDocUploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          status={gate.verification}
          currentDocUrl={gate.docUrl}
          onUploaded={() => {
            // Refrescar el gate para que muestre el nuevo doc.
            setGate(prev => prev.state === 'active' ? { ...prev } : prev);
          }}
        />
      )}
    </div>
  );
}
