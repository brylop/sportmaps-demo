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
import { Building, Upload, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { sanitizeText, sanitizeNIT, sanitizeDigits, sanitizeCity, sanitizeName } from '@/lib/inputSanitizers';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AVAILABLE_SPORTS = [
  'Porrismo',
  'Fútbol',
  'Baloncesto',
  'Voleibol',
  'Natación',
  'Patinaje',
  'Gimnasia',
  'Ciclismo',
  'Atletismo',
  'General'
];

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Transferencia Bancaria' },
  { id: 'wompi', label: 'Wompi Gateway' },
  { id: 'cash', label: 'Efectivo / Presencial' }
];

export default function OrganizerOnboardingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [orgData, setOrgData] = useState({
    organization_name: '',
    nit: '',
    city: '',
    bio: '',
  });
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [bankData, setBankData] = useState({
    bank_name: '',
    account_type: '',
    account_number: '',
    account_holder: '',
    account_document: ''
  });

  const [docFile, setDocFile] = useState<File | null>(null);

  const toggleSport = (sport: string) => {
    setSelectedSports(prev => 
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    );
  };

  const togglePaymentMethod = (methodId: string) => {
    setPaymentMethods(prev => 
      prev.includes(methodId) ? prev.filter(m => m !== methodId) : [...prev, methodId]
    );
  };

  const handleOrgDataChange = (field: string, value: string) => {
    setOrgData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankDataChange = (field: string, value: string) => {
    setBankData(prev => ({ ...prev, [field]: value }));
  };

  const saveProfilePhase1And2 = async () => {
    if (!orgData.organization_name || !orgData.nit || !orgData.city) {
      toast({ title: 'Error', description: 'Por favor completa los datos obligatorios', variant: 'destructive' });
      return;
    }
    if (selectedSports.length === 0) {
      toast({ title: 'Error', description: 'Selecciona al menos un deporte', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...orgData,
        sports: selectedSports,
        payment_methods: paymentMethods,
        bank_data: paymentMethods.includes('bank_transfer') ? bankData : {}
      };

      const response = await fetch(`${API_URL}/api/v1/organizer/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error al guardar el perfil');
      }

      setStep(3);
    } catch (error) {
      console.error(error);
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
      // 1. Upload to Supabase Storage
      const fileExt = docFile.name.split('.').pop();
      const fileName = `${session?.user.id}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organizer-docs')
        .upload(fileName, docFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('organizer-docs')
        .getPublicUrl(fileName);

      // 2. Update Organizer Profile
      const response = await fetch(`${API_URL}/api/v1/organizer/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ verification_doc_url: urlData.publicUrl })
      });

      if (!response.ok) throw new Error('Error al actualizar doc_url');

      toast({ title: 'Completado', description: 'Documento subido correctamente' });
      navigate('/organizer/home');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo subir el documento', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="bg-primary/5 border-b pb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Building className="h-6 w-6" />
              Portal de Organizador
            </h2>
            <div className="flex gap-2">
              {[1, 2, 3].map(s => (
                <div 
                  key={s} 
                  className={`h-2 w-12 rounded-full ${step >= s ? 'bg-primary' : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </div>
          <CardTitle>Configura tu perfil</CardTitle>
          <CardDescription>
            {step === 1 && 'Datos básicos de tu organización para iniciar'}
            {step === 2 && 'Configura cómo recibirás los pagos de los equipos'}
            {step === 3 && 'Verificación de identidad (RFC/NIT/Cámara de Comercio)'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la Organización *</Label>
                  <Input value={orgData.organization_name} onChange={e => handleOrgDataChange('organization_name', sanitizeText(e.target.value))} placeholder="Ej. Capital Cheer" maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label>NIT / Documento Legal *</Label>
                  <Input value={orgData.nit} onChange={e => handleOrgDataChange('nit', sanitizeNIT(e.target.value))} placeholder="Ej. 900.123.456-7" maxLength={20} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad Principal *</Label>
                  <Input value={orgData.city} onChange={e => handleOrgDataChange('city', sanitizeCity(e.target.value))} placeholder="Bogotá" maxLength={100} />
                </div>
              </div>
              
              <div className="space-y-2 pt-2">
                <Label>Deportes (selecciona al menos uno) *</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SPORTS.map(sport => (
                    <Badge 
                      key={sport} 
                      variant={selectedSports.includes(sport) ? 'default' : 'outline'}
                      className="cursor-pointer px-3 py-1 text-sm"
                      onClick={() => toggleSport(sport)}
                    >
                      {sport}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>Biografía / Descripción General (Opcional)</Label>
                <Textarea value={orgData.bio} onChange={e => handleOrgDataChange('bio', sanitizeText(e.target.value))} placeholder="Descripción que verán las academias..." maxLength={500} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-3">
                <Label className="text-base">Selecciona los medios de pago que aceptarás</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map(method => (
                    <div key={method.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <Checkbox 
                        id={method.id} 
                        checked={paymentMethods.includes(method.id)}
                        onCheckedChange={() => togglePaymentMethod(method.id)}
                      />
                      <label htmlFor={method.id} className="text-sm font-medium leading-none cursor-pointer flex-1">
                        {method.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {paymentMethods.includes('bank_transfer') && (
                <div className="mt-4 p-4 border rounded-xl bg-slate-50 space-y-4">
                  <h4 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Datos Bancarios</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Banco</Label>
                      <Input value={bankData.bank_name} onChange={e => handleBankDataChange('bank_name', sanitizeName(e.target.value))} placeholder="Ej. Bancolombia" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Cuenta</Label>
                      <Select value={bankData.account_type} onValueChange={(val) => setBankData(prev => ({...prev, account_type: val}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ahorros">Ahorros</SelectItem>
                          <SelectItem value="corriente">Corriente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número de Cuenta</Label>
                      <Input value={bankData.account_number} onChange={e => handleBankDataChange('account_number', sanitizeDigits(e.target.value))} placeholder="0000000000" maxLength={20} inputMode="numeric" />
                    </div>
                    <div className="space-y-2">
                      <Label>Titular / A nombre de</Label>
                      <Input value={bankData.account_holder} onChange={e => handleBankDataChange('account_holder', sanitizeName(e.target.value))} placeholder="Nombre completo" maxLength={150} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>NIT/Documento del titular</Label>
                      <Input value={bankData.account_document} onChange={e => handleBankDataChange('account_document', sanitizeNIT(e.target.value))} placeholder="Ej. 900.123.456-7" maxLength={20} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-2" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">¡Datos guardados con éxito!</h3>
                <p className="text-muted-foreground max-w-md">
                  Para habilitar los cobros a escuelas y la publicación de eventos, necesitamos verificar tu identidad corporativa.
                </p>
              </div>

              <div className="w-full max-w-md border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                <Label htmlFor="doc-upload" className="cursor-pointer font-semibold text-primary hover:underline">
                  Seleccionar archivo PDF o Imagen
                </Label>
                <Input 
                  id="doc-upload" 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: 'Archivo muy grande', description: 'El archivo no puede superar 5MB', variant: 'destructive' });
                        e.target.value = '';
                        return;
                      }
                      setDocFile(file);
                    }
                  }}
                />
                {docFile && (
                  <div className="mt-4 p-2 bg-green-100 text-green-800 rounded text-sm break-all font-medium">
                    {docFile.name}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Sube una copia reciente de RUT, Cámara de Comercio o documento legal equivalente. Max 5MB.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between border-t p-6 bg-slate-50/50">
          {step > 1 && step < 3 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
              Atrás
            </Button>
          )}
          {step === 1 && <div />} {/* Spacer */}
          
          {step < 3 ? (
            <Button 
              onClick={step === 2 ? saveProfilePhase1And2 : () => setStep(step + 1)}
              disabled={loading}
              className="ml-auto"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === 2 ? 'Guardar y Continuar' : 'Siguiente'}
            </Button>
          ) : (
            <div className="flex gap-4 ml-auto w-full md:w-auto">
              <Button variant="ghost" onClick={() => navigate('/organizer/home')} disabled={loading}>
                Saltar por ahora
              </Button>
              <Button onClick={saveProfilePhase3} disabled={loading || !docFile} className="flex-1 md:flex-none">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar para verificación
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
