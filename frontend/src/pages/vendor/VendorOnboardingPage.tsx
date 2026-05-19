import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OnboardingShell, type ShellStep } from '@/components/onboarding/OnboardingShell';
import { CityCombobox } from '@/components/common/CityCombobox';
import { BankCombobox } from '@/components/common/BankCombobox';
import { PhoneInput } from '@/components/ui/phone-input';
import { Store, Upload, CreditCard, CheckCircle2, Loader2, Package, Wrench, ShieldCheck } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Transferencia Bancaria' },
    { id: 'wompi',         label: 'Wompi Gateway' },
    { id: 'mercadopago',   label: 'MercadoPago' },
    { id: 'cash',          label: 'Efectivo / Presencial' },
];

const SERVICE_TYPES = [
    'Fisioterapia', 'Nutricion', 'Psicologia',
    'Medicina Deportiva', 'Entrenamiento Personal', 'Otro',
];

type SellWhat = 'products' | 'services' | 'both';

function defaultSellWhatForRole(role: string | undefined): SellWhat {
    switch (role) {
        case 'wellness_professional':
        case 'personal_trainer':
        case 'coach':
            return 'services';
        case 'external_vendor':
        case 'store_owner':
        case 'school':
        case 'school_admin':
            return 'products';
        default:
            return 'products';
    }
}

function defaultVendorTypeForRole(role: string | undefined): 'store' | 'wellness' | 'school' | 'personal_trainer' | 'coach' {
    switch (role) {
        case 'wellness_professional': return 'wellness';
        case 'personal_trainer':      return 'personal_trainer';
        case 'school':
        case 'school_admin':          return 'school';
        case 'coach':                 return 'coach';
        default:                      return 'store';
    }
}

export default function VendorOnboardingPage() {
    const { session, profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data: existingProfile, isLoading: vpLoading, refetch } = useVendorProfile();

    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    const hasExistingProfile = !!existingProfile;

    const [sellWhat, setSellWhat] = useState<SellWhat>(defaultSellWhatForRole(profile?.role as string));

    const [formData, setFormData] = useState({
        display_name: '',
        nit: '',
        city: '',
        phone: '',
        description: '',
    });
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
    const [bankData, setBankData] = useState({
        bank_name: '', account_type: '', account_number: '',
        account_holder: '', account_document: '',
    });
    // Pagos adicionales unificados con school/trainer
    const [nequi, setNequi]       = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [docFile, setDocFile] = useState<File | null>(null);

    // Pre-llenar form con datos del vendor_profile si ya existe
    useEffect(() => {
        if (existingProfile) {
            setFormData(prev => ({
                ...prev,
                display_name: existingProfile.display_name ?? prev.display_name,
            }));
            // Pre-seleccionar sellWhat según capabilities existentes
            const caps = existingProfile.capabilities ?? {};
            if (caps.can_sell_products && caps.can_sell_services) setSellWhat('both');
            else if (caps.can_sell_services) setSellWhat('services');
            else setSellWhat('products');
        }
    }, [existingProfile]);

    const capabilitiesFromSelection = useMemo(() => ({
        can_sell_products: sellWhat === 'products' || sellWhat === 'both',
        can_sell_services: sellWhat === 'services' || sellWhat === 'both',
    }), [sellWhat]);

    // El selector "qué vendes" se muestra SIEMPRE — incluso para roles
    // historicamente forzados a servicios (wellness, personal_trainer).
    // Un wellness puede ahora tambien vender productos relacionados, etc.
    // El default por rol sigue aplicando como pre-seleccion via
    // defaultSellWhatForRole, pero el usuario puede cambiar.
    const showSellWhatSelector = true;

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleService = (s: string) => {
        setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const togglePaymentMethod = (id: string) => {
        setPaymentMethods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
    };

    // Step 1+2: crear/actualizar vendor_profile vía RPC + persistir métodos de pago.
    const saveStep1And2 = async () => {
        if (!formData.display_name || !formData.city) {
            toast({ title: 'Falta información', description: 'Nombre y ciudad son requeridos.', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            const vendorType = hasExistingProfile
                ? existingProfile!.vendor_type
                : defaultVendorTypeForRole(profile?.role as string);

            // RPC enable_vendor_profile — crea o reactiva + setea capabilities
            const { error: rpcError } = await (supabase.rpc as any)('enable_vendor_profile', {
                p_vendor_type:       vendorType,
                p_can_sell_products: capabilitiesFromSelection.can_sell_products,
                p_can_sell_services: capabilitiesFromSelection.can_sell_services,
                p_display_name:      formData.display_name,
                p_description:       formData.description || null,
                p_city:              formData.city || null,
                p_phone:             formData.phone || null,
            });

            if (rpcError) {
                console.error('enable_vendor_profile error', rpcError);
                throw new Error(rpcError.message || 'No se pudo activar Mi Tienda.');
            }

            // Persistir métodos de pago vía BFF (mismo endpoint que ya existía)
            if (paymentMethods.length > 0 || nequi || whatsapp) {
                await fetch(`${API_URL}/api/v1/vendor/profile/payment`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        payment_methods: paymentMethods,
                        bank_data:       paymentMethods.includes('bank_transfer') ? bankData : {},
                        nequi_number:    nequi || null,
                        whatsapp_number: whatsapp || null,
                    }),
                }).catch(err => {
                    console.warn('No se pudo guardar payment methods (no bloqueante):', err);
                });
            }

            await refetch();
            setStep(3);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error?.message || 'No se pudo guardar la información.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const saveStep3 = async () => {
        if (!docFile) {
            navigate('/vendor/dashboard');
            return;
        }

        setSaving(true);
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
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ verification_doc_url: urlData.publicUrl }),
            });

            if (!res.ok) throw new Error('Error subiendo documento');

            toast({ title: 'Listo', description: 'Documento enviado para verificación.' });
            navigate('/vendor/dashboard');
        } catch (error: any) {
            toast({ title: 'Error', description: error?.message || 'No se pudo subir el documento.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (vpLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const shellSteps: ShellStep[] = [
        {
            id: 'business',
            title: 'Negocio',
            description: hasExistingProfile ? 'Datos de tu negocio' : 'Cuéntanos qué vendes',
            icon: Store,
            done: step > 1,
        },
        {
            id: 'payments',
            title: 'Pagos',
            description: 'Cómo recibirás los cobros',
            icon: CreditCard,
            done: step > 2,
        },
        {
            id: 'verification',
            title: 'Verificación',
            description: 'Documento de identidad (opcional)',
            icon: ShieldCheck,
            done: false,
        },
    ];

    return (
        <OnboardingShell
            title={hasExistingProfile ? 'Configura tu Tienda' : 'Activar Mi Tienda'}
            eyebrow="Configuración inicial"
            steps={shellSteps}
            currentStep={step - 1}
            onStepChange={(idx) => idx + 1 <= step && setStep(idx + 1)}
        >
                    {/* Step 1: ¿Qué vendes? + Info básica */}
                    {step === 1 && (
                        <div className="space-y-5">
                            {showSellWhatSelector && (
                                <div>
                                    <Label className="mb-2 block">¿Qué quieres vender?</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'products' as SellWhat, label: 'Productos', icon: Package, desc: 'Ropa, zapatos, suplementos, equipamiento' },
                                            { id: 'services' as SellWhat, label: 'Servicios', icon: Wrench, desc: 'Asesorías, sesiones, planes' },
                                            { id: 'both'     as SellWhat, label: 'Ambos',     icon: Store, desc: 'Combina productos y servicios' },
                                        ].map(opt => {
                                            const Icon = opt.icon;
                                            const active = sellWhat === opt.id;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setSellWhat(opt.id)}
                                                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                                                        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted'
                                                    }`}
                                                >
                                                    <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                                                    <span className="text-sm font-semibold">{opt.label}</span>
                                                    <span className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label>Nombre del negocio *</Label>
                                <Input
                                    value={formData.display_name}
                                    onChange={(e) => handleChange('display_name', e.target.value)}
                                    placeholder={
                                        capabilitiesFromSelection.can_sell_services && !capabilitiesFromSelection.can_sell_products
                                            ? 'Ej: Dr. Carlos López - Fisioterapia'
                                            : 'Ej: SportGear Colombia'
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>NIT / Cédula</Label>
                                    <Input value={formData.nit} onChange={(e) => handleChange('nit', e.target.value)} placeholder="900.123.456-7" />
                                </div>
                                <div>
                                    <Label>Ciudad *</Label>
                                    <CityCombobox value={formData.city} onChange={(v) => handleChange('city', v)} />
                                </div>
                            </div>
                            <div>
                                <Label>Teléfono / WhatsApp</Label>
                                <PhoneInput value={formData.phone} onChange={(v) => handleChange('phone', v)} placeholder="Número de celular" />
                            </div>
                            <div>
                                <Label>Descripción</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    placeholder="¿Qué te diferencia? ¿A quién le vendes?"
                                    rows={3}
                                />
                            </div>

                            {capabilitiesFromSelection.can_sell_services && (
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

                            <Button
                                className="w-full"
                                onClick={() => setStep(2)}
                                disabled={!formData.display_name || !formData.city}
                            >
                                Siguiente: Métodos de pago
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Métodos de pago */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <Label className="mb-2 block">Métodos de pago que aceptas</Label>
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

                            {/* Bloque de pagos unificado con school/trainer: Nequi + Banco + Cuenta + WhatsApp */}
                            <div className="space-y-3 border-t pt-4">
                                <h4 className="text-sm font-medium">Datos para recibir pagos</h4>

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
                                    <>
                                        <div className="space-y-2">
                                            <Label>Banco *</Label>
                                            <BankCombobox value={bankData.bank_name} onChange={(v) => setBankData(p => ({ ...p, bank_name: v }))} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Tipo de cuenta *</Label>
                                                <Select
                                                    value={bankData.account_type}
                                                    onValueChange={(val) => setBankData(p => ({ ...p, account_type: val }))}
                                                >
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
                                                    onChange={(e) => setBankData(p => ({ ...p, account_number: e.target.value.replace(/\D/g, '') }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Titular *</Label>
                                                <Input
                                                    placeholder="Nombre completo"
                                                    value={bankData.account_holder}
                                                    onChange={(e) => setBankData(p => ({ ...p, account_holder: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>CC / NIT *</Label>
                                                <Input
                                                    placeholder="900.123.456-7"
                                                    value={bankData.account_document}
                                                    onChange={(e) => setBankData(p => ({ ...p, account_document: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-2">
                                    <Label>WhatsApp de contacto</Label>
                                    <PhoneInput value={whatsapp} onChange={setWhatsapp} placeholder="Número de celular" />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
                                <Button onClick={saveStep1And2} disabled={saving} className="flex-1">
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Activar y continuar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Verificación */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-green-800">Mi Tienda activada</p>
                                    <p className="text-xs text-green-700 mt-1">
                                        Sube un documento para acelerar la verificación y aparecer destacado en el marketplace.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Label>Documento de verificación (opcional)</Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                    <strong>Persona natural:</strong> cédula de ciudadanía. <br/>
                                    <strong>Persona jurídica:</strong> RUT, Cámara de Comercio. <br/>
                                    <strong>Profesional:</strong> tarjeta profesional o licencia.
                                </p>
                                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
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
                                <Button onClick={saveStep3} disabled={saving} className="flex-1">
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {docFile ? 'Enviar y continuar' : 'Ir al dashboard'}
                                </Button>
                            </div>
                        </div>
                    )}
        </OnboardingShell>
    );
}
