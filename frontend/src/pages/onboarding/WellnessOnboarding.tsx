import { useState } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingShell, type ShellStep } from '@/components/onboarding/OnboardingShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/phone-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CityCombobox } from '@/components/common/CityCombobox';
import { UserCircle, HeartPulse, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/error-translator';
import { toast } from 'sonner';

const SPECIALTIES = [
  'Fisioterapia',
  'Nutrición',
  'Psicología Deportiva',
  'Medicina Deportiva',
  'Kinesiología',
  'Preparación Física',
  'Masoterapia',
];

export default function WellnessOnboarding() {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [dob, setDob] = useState(profile?.date_of_birth ?? '');
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [description, setDescription] = useState(profile?.bio ?? '');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.onboarding_completed) return <Navigate to="/dashboard" replace />;

  const toggleSpecialty = (s: string) =>
    setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const step1Done = fullName.trim().length >= 2 && phone.trim().length >= 7;
  const step2Done = displayName.trim().length >= 2 && specialties.length > 0 && !!city;

  const handleFinish = async () => {
    setSaving(true);
    try {
      // 1. Datos base del perfil de usuario.
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          date_of_birth: dob || null,
          bio: description.trim() || null,
          preferences: { ...(profile?.preferences ?? {}), wellness_specialties: specialties },
        })
        .eq('id', user.id);
      if (profErr) throw profErr;

      // 2. Perfil de vendedor (vendor_type='wellness'). La fila la crea el
      //    trigger auto_create_vendor_profile al asignar el rol; aquí la
      //    completamos. Upsert por si el trigger no corrió.
      const { error: vendorErr } = await (supabase as any)
        .from('vendor_profiles')
        .upsert(
          {
            user_id: user.id,
            vendor_type: 'wellness',
            display_name: displayName.trim(),
            description: description.trim() || null,
            phone: phone.trim(),
            city,
            capabilities: { can_sell_products: false, can_sell_services: true },
            is_active: true,
          },
          { onConflict: 'user_id' },
        );
      if (vendorErr) throw vendorErr;

      const { error: rpcError } = await (supabase.rpc as any)('complete_onboarding');
      if (rpcError) throw rpcError;

      await updateProfile({}, { silent: true });
      toast.success('¡Perfil profesional creado!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Wellness onboarding failed:', err);
      toast.error(getUserFriendlyError(err));
      setSaving(false);
    }
  };

  const steps: ShellStep[] = [
    { id: 'datos', title: 'Tus datos', description: 'Información personal de contacto', icon: UserCircle, done: step > 1 || step1Done },
    { id: 'practica', title: 'Tu práctica', description: 'Especialidades y perfil público', icon: HeartPulse, done: false },
  ];

  const canAdvance = step === 1 ? step1Done : step2Done;

  const footer = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setStep((p) => Math.max(1, p - 1))} disabled={step === 1 || saving}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
      </Button>
      {step < 2 ? (
        <Button onClick={() => setStep(2)} disabled={!canAdvance}>
          Siguiente <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      ) : (
        <Button onClick={handleFinish} disabled={saving || !canAdvance}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Finalizar
        </Button>
      )}
    </>
  );

  return (
    <OnboardingShell
      title="Configura tu perfil profesional"
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
                <AvatarFallback>{fullName.charAt(0) || 'W'}</AvatarFallback>
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
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre público / consultorio *</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ej: Centro de Fisioterapia Deportiva" maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Especialidades *</Label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <Badge
                  key={s}
                  variant={specialties.includes(s) ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1.5 text-sm hover:bg-primary/10"
                  onClick={() => toggleSpecialty(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Selecciona al menos una.</p>
          </div>
          <div className="space-y-2">
            <Label>Ciudad principal *</Label>
            <CityCombobox value={city} onChange={setCity} />
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe tus servicios y experiencia..." maxLength={500} rows={3} />
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
