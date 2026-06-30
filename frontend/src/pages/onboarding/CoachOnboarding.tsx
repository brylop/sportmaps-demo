import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CoachProfileWizard } from '@/components/coach/CoachProfileWizard';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Onboarding full-screen para entrenadores. Reutiliza al 100% el
 * CoachProfileWizard (datos básicos + certificaciones, persistido en
 * coach_profiles vía coachesAPI). Al terminar, marca onboarding_completed
 * y lleva al dashboard. El wizard se mantiene abierto (onboarding obligatorio).
 */
export default function CoachOnboarding() {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.onboarding_completed) return <Navigate to="/dashboard" replace />;

  const handleSuccess = async () => {
    try {
      const { error } = await (supabase.rpc as any)('complete_onboarding');
      if (error) throw error;
      await updateProfile({}, { silent: true });
      toast.success('¡Perfil profesional listo!');
    } catch (err) {
      console.error('Coach onboarding completion failed:', err);
    } finally {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Configura tu perfil de entrenador</h1>
        <p className="text-muted-foreground text-sm">Completa tu información profesional para activar tu cuenta.</p>
      </div>
      <CoachProfileWizard
        open={open}
        // Onboarding obligatorio: si el wizard intenta cerrarse, lo reabrimos.
        onOpenChange={() => setOpen(true)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
