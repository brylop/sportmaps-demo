import { useState } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingShell, type ShellStep } from '@/components/onboarding/OnboardingShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle, Users, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/error-translator';
import { toast } from 'sonner';

export default function ParentOnboarding() {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [dob, setDob] = useState(profile?.date_of_birth ?? '');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.onboarding_completed) return <Navigate to="/dashboard" replace />;

  const step1Done = fullName.trim().length >= 2 && phone.trim().length >= 7;

  // Persiste el perfil del padre y cierra el onboarding. `next` decide a dónde
  // navegar: al dashboard o directo a "Mis Hijos" para registrar al primero.
  const finish = async (next: '/dashboard' | '/children') => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          date_of_birth: dob || null,
        })
        .eq('id', user.id);
      if (error) throw error;

      const { error: rpcError } = await (supabase.rpc as any)('complete_onboarding');
      if (rpcError) throw rpcError;

      await updateProfile({}, { silent: true });
      toast.success('¡Listo! Tu cuenta quedó configurada.');
      navigate(next, { replace: true });
    } catch (err) {
      console.error('Parent onboarding failed:', err);
      toast.error(getUserFriendlyError(err));
      setSaving(false);
    }
  };

  const steps: ShellStep[] = [
    { id: 'datos', title: 'Tus datos', description: 'Información personal de contacto', icon: UserCircle, done: step > 1 || step1Done },
    { id: 'hijos', title: 'Tus hijos', description: 'Registra a tus deportistas', icon: Users, done: false },
  ];

  const footer = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setStep((p) => Math.max(1, p - 1))} disabled={step === 1 || saving}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
      </Button>
      {step < 2 ? (
        <Button onClick={() => setStep(2)} disabled={!step1Done}>
          Siguiente <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => finish('/dashboard')} disabled={saving}>
            Más tarde
          </Button>
          <Button onClick={() => finish('/children')} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Agregar a mi hijo/a
          </Button>
        </div>
      )}
    </>
  );

  return (
    <OnboardingShell
      title="Bienvenido a SportMaps"
      steps={steps}
      currentStep={step - 1}
      onStepChange={(idx) => idx + 1 <= step && setStep(idx + 1)}
      footer={footer}
    >
      {step === 1 && (
        <div className="space-y-4">
          {profile?.avatar_url && (
            <div className="flex justify-center">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage src={profile.avatar_url} className="object-cover" />
                <AvatarFallback>{fullName.charAt(0) || 'P'}</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre y apellido" maxLength={120} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono / WhatsApp *</Label>
              <PhoneInput value={phone} onChange={setPhone} placeholder="Número de celular" />
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={dob ?? ''} onChange={(e) => setDob(e.target.value)} max={todayColombia()} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Registra a tus deportistas</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Crea la ficha de cada hijo/a (datos, deporte y ficha médica) para inscribirlos en academias,
            pagar mensualidades y seguir su progreso. Puedes hacerlo ahora o más tarde desde <strong>Mis Hijos</strong>.
          </p>
        </div>
      )}
    </OnboardingShell>
  );
}
