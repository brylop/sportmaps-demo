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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Upload, CreditCard, CheckCircle2, Loader2, Package, Wrench } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Transferencia Bancaria' },
    { id: 'wompi',         label: 'Wompi Gateway' },
    { id: 'mercadopago',   label: 'MercadoPago' },
    { id: 'cash',          label: 'Efectivo / Presencial' },
];

// Bancos colombianos (tradicionales + neobancos / billeteras)
const COLOMBIAN_BANKS: { group: string; options: { value: string; label: string }[] }[] = [
    {
        group: 'Bancos tradicionales',
        options: [
            { value: 'bancolombia',      label: 'Bancolombia' },
            { value: 'davivienda',       label: 'Davivienda' },
            { value: 'banco_bogota',     label: 'Banco de Bogotá' },
            { value: 'bbva',             label: 'BBVA Colombia' },
            { value: 'av_villas',        label: 'Banco AV Villas' },
            { value: 'banco_popular',    label: 'Banco Popular' },
            { value: 'banco_occidente',  label: 'Banco de Occidente' },
            { value: 'itau',             label: 'Itaú Colombia' },
            { value: 'scotiabank',       label: 'Scotiabank Colpatria' },
            { value: 'banco_caja_social',label: 'Banco Caja Social' },
            { value: 'banco_falabella',  label: 'Banco Falabella' },
            { value: 'banco_agrario',    label: 'Banco Agrario' },
            { value: 'banco_pichincha',  label: 'Banco Pichincha' },
            { value: 'banco_gnb',        label: 'Banco GNB Sudameris' },
            { value: 'banco_serfinanza', label: 'Banco Serfinanza' },
            { value: 'bancoomeva',       label: 'Bancoomeva' },
            { value: 'banco_cooperativo_coopcentral', label: 'Banco Cooperativo Coopcentral' },
            { value: 'bancow',           label: 'BancoW' },
            { value: 'bancamia',         label: 'Bancamía' },
        ],
    },
    {
        group: 'Neobancos / Billeteras digitales',
        options: [
            { value: 'nequi',     label: 'Nequi' },
            { value: 'daviplata', label: 'Daviplata' },
            { value: 'lulo_bank', label: 'Lulo Bank' },
            { value: 'nu',        label: 'Nu Colombia' },
            { value: 'rappipay',  label: 'RappiPay' },
            { value: 'movii',     label: 'Movii' },
            { value: 'powwi',     label: 'Powwi' },
            { value: 'tpaga',     label: 'tpaga' },
            { value: 'iris',      label: 'Iris (Bancolombia)' },
            { value: 'ualá',      label: 'Ualá' },
        ],
    },
];

// Tipos de cuenta — incluye cuentas tradicionales + billeteras + BRE-B (interoperabilidad)
const ACCOUNT_TYPES: { value: string; label: string; hint?: string }[] = [
    { value: 'ahorros',   label: 'Cuenta de ahorros' },
    { value: 'corriente', label: 'Cuenta corriente' },
    { value: 'nequi',     label: 'Nequi',     hint: 'Solo número de celular' },
    { value: 'daviplata', label: 'Daviplata', hint: 'Solo número de celular' },
    { value: 'bre_b',     label: 'Bre-B',     hint: 'Llave única interoperable (celular, correo, cédula o @llave)' },
    { value: 'wallet',    label: 'Otra billetera digital' },
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
            if (paymentMethods.length > 0) {
                await fetch(`${API_URL}/api/v1/vendor/profile/payment`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        payment_methods: paymentMethods,
                        bank_data: paymentMethods.includes('bank_transfer') ? bankData : {},
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

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl shadow-xl">
                <CardHeader className="bg-primary/5 border-b pb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                            <Store className="h-6 w-6" />
                            {hasExistingProfile ? 'Configura tu Tienda' : 'Activar Mi Tienda'}
                        </h2>
                        <div className="flex gap-2">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`h-2 w-12 rounded-full ${step >= s ? 'bg-primary' : 'bg-slate-200'}`} />
                            ))}
                        </div>
                    </div>
                    <CardTitle>
                        {step === 1 && (hasExistingProfile ? 'Datos de tu negocio' : 'Cuéntanos qué vendes')}
                        {step === 2 && 'Cómo cobras'}
                        {step === 3 && 'Verificación de identidad'}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && 'Información básica que aparecerá en tu perfil público.'}
                        {step === 2 && 'Elige los métodos con los que vas a recibir pagos.'}
                        {step === 3 && 'Sube un documento (cédula, RUT, Cámara de Comercio o tarjeta profesional) para verificar tu identidad y aparecer destacado.'}
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
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
                                    <Input value={formData.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="Bogotá" />
                                </div>
                            </div>
                            <div>
                                <Label>Teléfono / WhatsApp</Label>
                                <Input value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+57 300 1234567" />
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

                            {hasExistingProfile && existingProfile?.verification_status === 'pending' && (
                                <button
                                    type="button"
                                    onClick={() => setStep(3)}
                                    className="w-full text-xs text-primary hover:underline mt-1"
                                >
                                    Solo quiero subir el documento de verificación →
                                </button>
                            )}
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

                            {paymentMethods.includes('bank_transfer') && (() => {
                                const isWalletType = ['nequi', 'daviplata', 'bre_b', 'wallet'].includes(bankData.account_type);
                                const accountPlaceholder =
                                    bankData.account_type === 'nequi' || bankData.account_type === 'daviplata'
                                        ? '300 123 4567'
                                        : bankData.account_type === 'bre_b'
                                        ? '@tu_llave  /  correo  /  cédula  /  celular'
                                        : '123-456789-00';
                                const accountLabel = isWalletType ? 'Número / Llave' : 'Número de cuenta';

                                return (
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-sm font-medium">Datos para recibir pagos</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Banco / Entidad</Label>
                                            <Select
                                                value={bankData.bank_name}
                                                onValueChange={(v) => setBankData(p => ({ ...p, bank_name: v }))}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                                                <SelectContent>
                                                    {COLOMBIAN_BANKS.map(g => (
                                                        <SelectGroup key={g.group}>
                                                            <SelectLabel>{g.group}</SelectLabel>
                                                            {g.options.map(o => (
                                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Tipo de cuenta</Label>
                                            <Select
                                                value={bankData.account_type}
                                                onValueChange={(v) => setBankData(p => ({ ...p, account_type: v }))}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                                                <SelectContent>
                                                    {ACCOUNT_TYPES.map(t => (
                                                        <SelectItem key={t.value} value={t.value}>
                                                            <div className="flex flex-col text-left">
                                                                <span>{t.label}</span>
                                                                {t.hint && <span className="text-[11px] text-muted-foreground">{t.hint}</span>}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>{accountLabel}</Label>
                                            <Input
                                                value={bankData.account_number}
                                                onChange={(e) => setBankData(p => ({ ...p, account_number: e.target.value }))}
                                                placeholder={accountPlaceholder}
                                            />
                                        </div>
                                        <div>
                                            <Label>Titular</Label>
                                            <Input
                                                value={bankData.account_holder}
                                                onChange={(e) => setBankData(p => ({ ...p, account_holder: e.target.value }))}
                                                placeholder="Nombre completo"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Cédula del titular</Label>
                                            <Input
                                                value={bankData.account_document}
                                                onChange={(e) => setBankData(p => ({ ...p, account_document: e.target.value }))}
                                                placeholder="1.020.345.678"
                                            />
                                        </div>
                                    </div>
                                    {bankData.account_type === 'bre_b' && (
                                        <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-2">
                                            Bre-B es el sistema interoperable del Banco de la República. Tu llave puede ser
                                            tu celular, correo, cédula o un alias <code>@nombre</code>.
                                        </p>
                                    )}
                                </div>
                                );
                            })()}

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
                </CardContent>
            </Card>
        </div>
    );
}
