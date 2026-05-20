import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building, Upload, CreditCard, CheckCircle2, Loader2, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { sanitizeText, sanitizeNIT, sanitizeDigits, sanitizeName } from '@/lib/inputSanitizers';
import { OnboardingShell, type ShellStep } from '@/components/onboarding/OnboardingShell';
import { CityCombobox } from '@/components/common/CityCombobox';
import { BankCombobox } from '@/components/common/BankCombobox';
import { PhoneInput } from '@/components/ui/phone-input';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AVAILABLE_SPORTS = [
  'Porrismo', 'Fútbol', 'Baloncesto', 'Voleibol', 'Natación',
  'Patinaje', 'Gimnasia', 'Ciclismo', 'Atletismo', 'General',
];

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Transferencia Bancaria' },
  { id: 'wompi',         label: 'Wompi Gateway' },
  { id: 'cash',          label: 'Efectivo / Presencial' },
];

export default function OrganizerOnboardingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state — paso 1: datos de la organizacion
  const [orgData, setOrgData] = useState({
    organization_name: '',
    nit: '',
    city: '',
    bio: '',
  });
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  // Form state — paso 2: pagos (mismo bloque que school/trainer/vendor)
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [nequi, setNequi]       = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bankData, setBankData] = useState({
    bank_name: '',
    account_type: '',
    account_number: '',
    account_holder: '',
    account_document: '',
  });

  // Form state — paso 3: verificacion
  const [docFile, setDocFile] = useState<File | null>(null);

  const toggleSport = (sport: string) =>
    setSelectedSports(prev => prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]);

  const togglePaymentMethod = (id: string) =>
    setPaymentMethods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleOrgDataChange = (field: string, value: string) =>
    setOrgData(prev => ({ ...prev, [field]: value }));

  // Persiste pasos 1 y 2 al avanzar de "Pagos" a "Verificacion"
  const saveProfilePhase1And2 = async () => {
    if (!orgData.organization_name || !orgData.nit || !orgData.city) {
      toast({ title: 'Datos incompletos', description: 'Completa nombre, NIT y ciudad.', variant: 'destructive' });
      return;
    }
    if (selectedSports.length === 0) {
      toast({ title: 'Datos incompletos', description: 'Selecciona al menos un deporte.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...orgData,
        sports:          selectedSports,
        payment_methods: paymentMethods,
        bank_data:       paymentMethods.includes('bank_transfer') ? bankData : {},
        nequi_number:    nequi || null,
        whatsapp_number: whatsapp || null,
      };

      const response = await fetch(`${API_URL}/api/v1/organizer/profile`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al guardar el perfil');

      setStep(3);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo guardar la información', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveProfilePhase3 = async () => {
    if (!docFile) {
      navigate('/organizer/home');
      return;
    }
    setLoading(true);
    try {
      const fileExt = docFile.name.split('.').pop();
      const fileName = `${session?.user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('organizer-docs').upload(fileName, docFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('organizer-docs').getPublicUrl(fileName);

      const response = await fetch(`${API_URL}/api/v1/organizer/profile`, {
        method:  'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ verification_doc_url: urlData.publicUrl }),
      });

      if (!response.ok) throw new Error('Error al actualizar doc_url');

      toast({ title: 'Completado', description: 'Documento subido correctamente' });
      navigate('/organizer/home');
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo subir el documento', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Validacion por step para habilitar/deshabilitar Siguiente.
  const step1Done = !!orgData.organization_name && !!orgData.nit && !!orgData.city && selectedSports.length > 0;
  // Step 2 es opcional pero si se eligio bank_transfer hay que completar bank info.
  const step2BankOk = !paymentMethods.includes('bank_transfer')
                   || (!!bankData.bank_name && !!bankData.account_type && !!bankData.account_number);
  const step2Done = step2BankOk;

  const shellSteps: ShellStep[] = [
    { id: 'organization', title: 'Organización', description: 'Datos básicos y deportes que cubres', icon: Building,    done: step > 1 || step1Done },
    { id: 'payments',     title: 'Pagos',        description: 'Cómo recibirás los cobros',         icon: CreditCard,  done: step > 2 },
    { id: 'verification', title: 'Verificación', description: 'Sube un documento legal',           icon: ShieldCheck, done: false },
  ];

  const canAdvance = step === 1 ? step1Done : step === 2 ? step2Done : false;

  const footer = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setStep(prev => Math.max(1, prev - 1))}
        disabled={step === 1 || loading}
      >
        <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
      </Button>
      <div className="flex items-center gap-2">
        {step < 3 && (
          <Button
            onClick={step === 2 ? saveProfilePhase1And2 : () => setStep(step + 1)}
            disabled={loading || !canAdvance}
            title={canAdvance ? 'Continuar' : 'Completa los campos requeridos para continuar'}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {step === 2 ? 'Guardar y continuar' : 'Siguiente'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {step === 3 && (
          <>
            <Button variant="ghost" onClick={() => navigate('/organizer/home')} disabled={loading}>
              Saltar por ahora
            </Button>
            <Button onClick={saveProfilePhase3} disabled={loading || !docFile}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar para verificación
            </Button>
          </>
        )}
      </div>
    </>
  );

  return (
    <OnboardingShell
      title="Portal de Organizador"
      eyebrow="Configuración inicial"
      steps={shellSteps}
      currentStep={step - 1}
      onStepChange={(idx) => idx + 1 <= step && setStep(idx + 1)}
      footer={footer}
    >
      {/* Step 1: datos organizacion */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la organización *</Label>
              <Input
                value={orgData.organization_name}
                onChange={(e) => handleOrgDataChange('organization_name', sanitizeText(e.target.value))}
                placeholder="Ej: Capital Cheer"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>NIT / Documento Legal *</Label>
              <Input
                value={orgData.nit}
                onChange={(e) => handleOrgDataChange('nit', sanitizeNIT(e.target.value))}
                placeholder="900.123.456-7"
                maxLength={20}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ciudad principal *</Label>
              <CityCombobox value={orgData.city} onChange={(v) => handleOrgDataChange('city', v)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deportes que cubres *</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SPORTS.map((sport) => (
                <Badge
                  key={sport}
                  variant={selectedSports.includes(sport) ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1.5 text-sm hover:bg-primary/10"
                  onClick={() => toggleSport(sport)}
                >
                  {sport}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Selecciona al menos uno.</p>
          </div>

          <div className="space-y-2">
            <Label>Biografía / Descripción (opcional)</Label>
            <Textarea
              value={orgData.bio}
              onChange={(e) => handleOrgDataChange('bio', sanitizeText(e.target.value))}
              placeholder="Descripción que verán las academias..."
              maxLength={500}
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Step 2: pagos unificados */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Métodos de pago que aceptas</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 border p-3 rounded-lg cursor-pointer transition-colors ${
                    paymentMethods.includes(m.id) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => togglePaymentMethod(m.id)}
                >
                  <Checkbox checked={paymentMethods.includes(m.id)} onCheckedChange={() => togglePaymentMethod(m.id)} />
                  <span className="text-sm font-medium">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Número Nequi</Label>
            <Input
              type="tel"
              maxLength={10}
              placeholder="Número de 10 dígitos"
              value={nequi}
              onChange={(e) => setNequi(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          {paymentMethods.includes('bank_transfer') && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Datos bancarios
              </h4>
              <div className="space-y-2">
                <Label>Banco *</Label>
                <BankCombobox value={bankData.bank_name} onChange={(v) => setBankData(p => ({ ...p, bank_name: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de cuenta *</Label>
                  <Select value={bankData.account_type} onValueChange={(v) => setBankData(p => ({ ...p, account_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ahorros">Ahorros</SelectItem>
                      <SelectItem value="corriente">Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número de cuenta *</Label>
                  <Input
                    placeholder="123-456789-00"
                    value={bankData.account_number}
                    onChange={(e) => setBankData(p => ({ ...p, account_number: sanitizeDigits(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Titular</Label>
                  <Input
                    placeholder="Nombre completo"
                    value={bankData.account_holder}
                    onChange={(e) => setBankData(p => ({ ...p, account_holder: sanitizeName(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIT/CC del titular</Label>
                  <Input
                    placeholder="900.123.456-7"
                    value={bankData.account_document}
                    onChange={(e) => setBankData(p => ({ ...p, account_document: sanitizeNIT(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>WhatsApp de contacto</Label>
            <PhoneInput value={whatsapp} onChange={setWhatsapp} placeholder="Número de celular" />
          </div>
        </div>
      )}

      {/* Step 3: verificacion */}
      {step === 3 && (
        <div className="space-y-4 flex flex-col items-center text-center py-2">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">¡Datos guardados!</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Para habilitar cobros y publicar eventos, necesitamos verificar tu identidad corporativa.
            </p>
          </div>

          <label
            htmlFor="doc-upload"
            className="w-full border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-primary">Seleccionar archivo PDF o imagen</span>
            <Input
              id="doc-upload"
              type="file"
              className="hidden"
              accept=".pdf,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast({ title: 'Archivo muy grande', description: 'Máx 5MB', variant: 'destructive' });
                  e.target.value = '';
                  return;
                }
                setDocFile(file);
              }}
            />
            {docFile && (
              <span className="mt-3 px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                {docFile.name}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Sube RUT, Cámara de Comercio o documento legal equivalente. Máx 5MB.
            </p>
          </label>
        </div>
      )}
    </OnboardingShell>
  );
}
