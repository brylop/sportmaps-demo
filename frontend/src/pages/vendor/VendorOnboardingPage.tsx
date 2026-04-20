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
import { Store, Upload, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Transferencia Bancaria' },
  { id: 'wompi', label: 'Wompi Gateway' },
  { id: 'epayco', label: 'ePayco Gateway' },
  { id: 'cash', label: 'Efectivo / Presencial' },
];

const SERVICE_TYPES = [
  'Fisioterapia', 'Nutricion', 'Psicologia',
  'Medicina Deportiva', 'Entrenamiento Personal', 'Otro'
];

export default function VendorOnboardingPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const isWellness = profile?.role === 'wellness_professional';

  const [formData, setFormData] = useState({
    display_name: '',
    nit: '',
    city: '',
    description: '',
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [bankData, setBankData] = useState({
    bank_name: '', account_type: '', account_number: '',
    account_holder: '', account_document: '',
  });
  const [docFile, setDocFile] = useState<File | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleService = (s: string) => {
    setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const saveStep1And2 = async () => {
    if (!formData.display_name || !formData.city) {
      toast({ title: 'Error', description: 'Nombre y ciudad son requeridos', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        display_name: formData.display_name,
        description: formData.description,
        city: formData.city,
        nit: formData.nit,
        vendor_type: isWellness ? 'wellness' : 'store',
        email: session?.user?.email,
      };

      const res = await fetch(`${API_URL}/api/v1/vendor/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error guardando perfil');

      // Guardar metodos de pago
      await fetch(`${API_URL}/api/v1/vendor/profile/payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          payment_methods: paymentMethods,
          bank_data: paymentMethods.includes('bank_transfer') ? bankData : {},
        }),
      });

      setStep(3);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la informacion', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveStep3 = async () => {
    if (!docFile) {
      navigate('/vendor/dashboard');
      return;
    }

    setLoading(true);
    try {
      const fileExt = docFile.name.split('.').pop();
      const fileName = `${session?.user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-docs')
        .upload(fileName, docFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('vendor-docs')
        .getPublicUrl(fileName);

      const res = await fetch(`${API_URL}/api/v1/vendor/profile/verification`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ verification_doc_url: urlData.publicUrl }),
      });

      if (!res.ok) throw new Error('Error subiendo documento');

      toast({ title: 'Completado', description: 'Documento enviado para verificacion' });
      navigate('/vendor/dashboard');
    } catch (error) {
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
              <Store className="h-6 w-6" />
              {isWellness ? 'Portal Profesional' : 'Portal de Vendedor'}
            </h2>
            <div className="flex gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-2 w-12 rounded-full ${step >= s ? 'bg-primary' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
          <CardTitle>Configura tu perfil</CardTitle>
          <CardDescription>
            {step === 1 && 'Datos basicos de tu negocio o practica profesional'}
            {step === 2 && 'Configura como recibiras los pagos'}
            {step === 3 && 'Verificacion de identidad (RUT/NIT/Camara de Comercio)'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Nombre del negocio *</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  placeholder={isWellness ? 'Ej: Dr. Carlos Lopez - Fisioterapia' : 'Ej: SportGear Colombia'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>NIT / Cedula</Label>
                  <Input value={formData.nit} onChange={(e) => handleChange('nit', e.target.value)} placeholder="900.123.456-7" />
                </div>
                <div>
                  <Label>Ciudad *</Label>
                  <Input value={formData.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="Bogota" />
                </div>
              </div>
              <div>
                <Label>Descripcion</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder={isWellness ? 'Describe tus servicios y especialidad...' : 'Describe tu tienda y productos...'}
                  rows={3}
                />
              </div>

              {isWellness && (
                <div>
                  <Label className="mb-2 block">Servicios que ofreces</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICE_TYPES.map(s => (
                      <div key={s} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedServices.includes(s)}
                          onCheckedChange={() => toggleService(s)}
                        />
                        <span className="text-sm">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={() => setStep(2)} disabled={!formData.display_name || !formData.city}>
                Siguiente: Metodos de Pago
              </Button>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div className="space-y-4">
              <Label className="mb-2 block">Metodos de pago que aceptas</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(pm => (
                  <div
                    key={pm.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      paymentMethods.includes(pm.id) ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted'
                    }`}
                    onClick={() => togglePaymentMethod(pm.id)}
                  >
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm">{pm.label}</span>
                  </div>
                ))}
              </div>

              {paymentMethods.includes('bank_transfer') && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-medium">Datos bancarios</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Banco</Label>
                      <Input value={bankData.bank_name} onChange={(e) => setBankData(p => ({ ...p, bank_name: e.target.value }))} placeholder="Bancolombia" />
                    </div>
                    <div>
                      <Label>Tipo de cuenta</Label>
                      <Input value={bankData.account_type} onChange={(e) => setBankData(p => ({ ...p, account_type: e.target.value }))} placeholder="Ahorros" />
                    </div>
                    <div>
                      <Label>Numero de cuenta</Label>
                      <Input value={bankData.account_number} onChange={(e) => setBankData(p => ({ ...p, account_number: e.target.value }))} placeholder="123-456789-00" />
                    </div>
                    <div>
                      <Label>Titular</Label>
                      <Input value={bankData.account_holder} onChange={(e) => setBankData(p => ({ ...p, account_holder: e.target.value }))} placeholder="Nombre completo" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atras</Button>
                <Button onClick={saveStep1And2} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Siguiente: Verificacion
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Verification */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Perfil creado exitosamente</p>
                  <p className="text-xs text-green-700 mt-1">Sube un documento de verificacion para que tu cuenta sea aprobada mas rapido.</p>
                </div>
              </div>

              <div>
                <Label>Documento de verificacion (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">RUT, Camara de Comercio, Tarjeta Profesional, etc.</p>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="doc-upload"
                  />
                  <label htmlFor="doc-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    {docFile ? (
                      <p className="text-sm font-medium text-primary">{docFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Haz clic para subir un archivo</p>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/vendor/dashboard')} className="flex-1">
                  Omitir por ahora
                </Button>
                <Button onClick={saveStep3} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {docFile ? 'Enviar y continuar' : 'Ir al dashboard'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
