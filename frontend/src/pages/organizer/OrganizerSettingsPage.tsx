import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Settings,
  CreditCard,
  Bell,
  Shield,
  Save,
  Building,
} from 'lucide-react';
import { sanitizeName, sanitizeDigits, sanitizeNIT } from '@/lib/inputSanitizers';

interface OrganizerProfile {
  organization_name: string;
  nit: string;
  city: string;
  sports: string[];
  payment_methods: string[];
  bank_data: Record<string, any>;
  qr_smart_enabled: boolean;
  is_verified: boolean;
}

export default function OrganizerSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [bankData, setBankData] = useState({
    bank_name: '',
    account_type: 'savings',
    account_number: '',
    holder_name: '',
    holder_document: '',
  });
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [qrEnabled, setQrEnabled] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_organizers')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data as any);
        setBankData({
          bank_name: data.bank_data?.bank_name || '',
          account_type: data.bank_data?.account_type || 'savings',
          account_number: data.bank_data?.account_number || '',
          holder_name: data.bank_data?.holder_name || '',
          holder_document: data.bank_data?.holder_document || '',
        });
        setPaymentMethods(data.payment_methods || []);
        setQrEnabled(data.qr_smart_enabled || false);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankData = async () => {
    setSaving(true);
    try {
      await bffClient.put('/api/v1/organizer/profile', {
        bank_data: bankData,
      });
      toast({ title: 'Datos bancarios actualizados' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentMethods = async () => {
    setSaving(true);
    try {
      await bffClient.put('/api/v1/organizer/profile', {
        payment_methods: paymentMethods,
      });
      toast({ title: 'Métodos de pago actualizados' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await bffClient.put('/api/v1/organizer/profile', {
        qr_smart_enabled: qrEnabled,
      });
      toast({ title: 'Preferencias actualizadas' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods(prev =>
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            {profile?.organization_name || 'Organizador'}
            {profile?.is_verified && ' • Verificado'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="payments">
        <TabsList className="mb-6">
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <Building className="h-4 w-4" />
            Datos Bancarios
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferencias
          </TabsTrigger>
        </TabsList>

        {/* Tab: Payment Methods */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pago Aceptados</CardTitle>
              <CardDescription>
                Selecciona los métodos de pago que aceptarás en tus eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 'bank_transfer', label: 'Transferencia Bancaria', desc: 'Transferencia manual con comprobante' },
                { id: 'wompi', label: 'Wompi', desc: 'Tarjetas, PSE, Nequi, Bancolombia' },
                { id: 'cash', label: 'Efectivo', desc: 'Pago presencial el día del evento' },
              ].map(method => (
                <div key={method.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-muted-foreground">{method.desc}</p>
                  </div>
                  <Switch
                    checked={paymentMethods.includes(method.id)}
                    onCheckedChange={() => togglePaymentMethod(method.id)}
                  />
                </div>
              ))}
              <Button onClick={handleSavePaymentMethods} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Métodos'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Bank Data */}
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Datos Bancarios</CardTitle>
              <CardDescription>
                Información para recibir pagos por transferencia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Banco</Label>
                  <Input
                    value={bankData.bank_name}
                    onChange={e => setBankData(prev => ({ ...prev, bank_name: sanitizeName(e.target.value) }))}
                    placeholder="Ej: Bancolombia"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label>Tipo de Cuenta</Label>
                  <Select
                    value={bankData.account_type}
                    onValueChange={v => setBankData(prev => ({ ...prev, account_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Ahorros</SelectItem>
                      <SelectItem value="checking">Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número de Cuenta</Label>
                  <Input
                    value={bankData.account_number}
                    onChange={e => setBankData(prev => ({ ...prev, account_number: sanitizeDigits(e.target.value) }))}
                    placeholder="0000000000"
                    maxLength={20}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label>Nombre del Titular</Label>
                  <Input
                    value={bankData.holder_name}
                    onChange={e => setBankData(prev => ({ ...prev, holder_name: sanitizeName(e.target.value) }))}
                    placeholder="Nombre completo"
                    maxLength={150}
                  />
                </div>
                <div>
                  <Label>Documento del Titular</Label>
                  <Input
                    value={bankData.holder_document}
                    onChange={e => setBankData(prev => ({ ...prev, holder_document: sanitizeNIT(e.target.value) }))}
                    placeholder="NIT o CC"
                    maxLength={20}
                  />
                </div>
              </div>
              <Button onClick={handleSaveBankData} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Datos Bancarios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Preferences */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias</CardTitle>
              <CardDescription>
                Configura el comportamiento de tu cuenta de organizador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium">QR Smart Dinámico</p>
                  <p className="text-sm text-muted-foreground">
                    Genera códigos QR dinámicos para check-in en tus eventos
                  </p>
                </div>
                <Switch
                  checked={qrEnabled}
                  onCheckedChange={setQrEnabled}
                />
              </div>

              <Button onClick={handleSavePreferences} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Preferencias'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
