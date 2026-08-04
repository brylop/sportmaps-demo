import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Sparkles, Plus, X, Trash2, ChevronLeft, ChevronRight, Loader2,
    Activity, MapPin, Video, Home, Layers, Clock, DollarSign, CheckCircle2,
} from 'lucide-react';
import { ServiceImageUploader } from './ServiceImageUploader';
import {
    SERVICE_TEMPLATES, SERVICE_TYPE_LABELS, MODALITY_LABELS, COMMON_AUDIENCES,
    VARIATION_PRESETS,
    type ServiceType, type Modality,
} from './serviceTemplates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Variation {
    name:             string;
    description?:     string;
    price:            number;
    duration_minutes: number;
}

interface ServiceFormState {
    name:                       string;
    description:                string;
    service_type:               ServiceType;
    subcategory:                string;
    modality:                   Modality[];
    target_audience:            string[];
    includes:                   string[];
    requirements:               string;
    price:                      number | '';
    duration_minutes:           number;
    image_url:                  string;
    visibility:                 'public' | 'school_only' | 'private';
    cancellation_policy_hours:  number;
    variations:                 Variation[];
}

const INITIAL: ServiceFormState = {
    name:                      '',
    description:               '',
    service_type:              'Fisioterapia',
    subcategory:               '',
    modality:                  [],
    target_audience:           [],
    includes:                  [],
    requirements:              '',
    price:                     '',
    duration_minutes:          60,
    image_url:                 '',
    visibility:                'public',
    cancellation_policy_hours: 24,
    variations:                [],
};

interface Props {
    open:           boolean;
    onOpenChange:   (open: boolean) => void;
    onCreated:      () => void;
    vendorId?:      string;
}

const MODALITY_ICONS: Record<Modality, React.ComponentType<{ className?: string }>> = {
    presencial: MapPin,
    virtual:    Video,
    domicilio:  Home,
    hibrido:    Layers,
};

export function ServiceWizard({ open, onOpenChange, onCreated, vendorId }: Props) {
    const { session } = useAuth();
    const { toast }   = useToast();
    const [step, setStep]     = useState(1);
    const [form, setForm]     = useState<ServiceFormState>(INITIAL);
    const [saving, setSaving] = useState(false);

    const template = SERVICE_TEMPLATES[form.service_type];

    useEffect(() => {
        if (!open) {
            setStep(1);
            setForm(INITIAL);
        }
    }, [open]);

    const set = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const applyTemplate = () => {
        const t = SERVICE_TEMPLATES[form.service_type];
        setForm(prev => ({
            ...prev,
            name:             prev.name || t.suggested_name,
            modality:         prev.modality.length ? prev.modality : t.suggested_modalities,
            target_audience:  prev.target_audience.length ? prev.target_audience : t.suggested_audiences,
            includes:         prev.includes.length ? prev.includes : t.suggested_includes,
            requirements:     prev.requirements || t.suggested_requirements,
            duration_minutes: prev.duration_minutes || t.suggested_duration,
            price:            prev.price || t.suggested_price,
            subcategory:      prev.subcategory || (t.suggested_subcategories[0] ?? ''),
        }));
        toast({ title: 'Plantilla aplicada', description: 'Revisa y ajusta los campos a tu medida.' });
    };

    const toggleModality = (m: Modality) => {
        set('modality', form.modality.includes(m) ? form.modality.filter(x => x !== m) : [...form.modality, m]);
    };

    const toggleAudience = (a: string) => {
        set('target_audience', form.target_audience.includes(a) ? form.target_audience.filter(x => x !== a) : [...form.target_audience, a]);
    };

    const addInclude = () => set('includes', [...form.includes, '']);
    const updateInclude = (i: number, v: string) =>
        set('includes', form.includes.map((x, idx) => idx === i ? v : x));
    const removeInclude = (i: number) =>
        set('includes', form.includes.filter((_, idx) => idx !== i));

    const addVariationFromPreset = (preset: typeof VARIATION_PRESETS[number]) => {
        if (typeof form.price !== 'number' || form.price <= 0) {
            toast({ title: 'Define primero el precio base', variant: 'destructive' });
            return;
        }
        const totalPrice = Math.round(form.price * preset.sessions * (1 - preset.discount_percent / 100));
        const newVar: Variation = {
            name:             preset.name + (preset.sessions > 1 ? ` (${preset.sessions} sesiones)` : ''),
            description:      preset.discount_percent > 0 ? `${preset.discount_percent}% de descuento` : undefined,
            price:            totalPrice,
            duration_minutes: form.duration_minutes,
        };
        set('variations', [...form.variations, newVar]);
    };

    const removeVariation = (i: number) =>
        set('variations', form.variations.filter((_, idx) => idx !== i));

    // ─── Validacion por paso ──────────────────────────────────────────────────
    const canAdvance = useMemo(() => {
        if (step === 1) {
            return form.service_type && form.name.trim().length > 2 && form.modality.length > 0;
        }
        if (step === 2) {
            return form.includes.filter(i => i.trim().length > 0).length >= 1;
        }
        return true;
    }, [step, form]);

    const handleSubmit = async () => {
        if (!form.name || typeof form.price !== 'number' || form.price < 0) {
            toast({ title: 'Faltan datos', description: 'Nombre y precio son requeridos.', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/vendor/services`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    name:                      form.name.trim(),
                    description:               form.description.trim() || null,
                    service_type:              form.service_type,
                    subcategory:               form.subcategory.trim() || null,
                    price:                     form.price,
                    duration_minutes:          form.duration_minutes,
                    image_url:                 form.image_url || null,
                    visibility:                form.visibility,
                    cancellation_policy_hours: form.cancellation_policy_hours,
                    modality:                  form.modality,
                    target_audience:           form.target_audience,
                    includes:                  form.includes.filter(i => i.trim().length > 0),
                    requirements:              form.requirements.trim() || null,
                    variations:                form.variations,
                }),
            });
            const json = await res.json();
            if (json.ok) {
                toast({ title: 'Servicio publicado en marketplace', description: 'Ya puede ser reservado por clientes.' });
                onCreated();
                onOpenChange(false);
            } else {
                toast({ title: 'Error', description: json.error, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'No se pudo crear el servicio', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear servicio profesional</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Paso {step} de 3 — {step === 1 ? 'Tipo y modalidad' : step === 2 ? 'Detalle del servicio' : 'Precio y media'}
                    </p>
                </DialogHeader>

                {/* Progress bar */}
                <div className="flex gap-2 mb-2">
                    {[1, 2, 3].map(n => (
                        <div
                            key={n}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? 'bg-primary' : 'bg-muted'}`}
                        />
                    ))}
                </div>

                {/* ─── PASO 1: Tipo + Modalidad + Nombre ─── */}
                {step === 1 && (
                    <div className="space-y-5">
                        <div>
                            <Label>Tipo de servicio *</Label>
                            <Select
                                value={form.service_type}
                                onValueChange={(v) => set('service_type', v as ServiceType)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {template.suggested_subcategories.length > 0 && (
                            <div>
                                <Label>Sub-especialidad</Label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {template.suggested_subcategories.map(sub => (
                                        <Badge
                                            key={sub}
                                            variant={form.subcategory === sub ? 'default' : 'outline'}
                                            className="cursor-pointer"
                                            onClick={() => set('subcategory', form.subcategory === sub ? '' : sub)}
                                        >
                                            {sub}
                                        </Badge>
                                    ))}
                                </div>
                                <Input
                                    className="mt-2"
                                    placeholder="O escribe una sub-especialidad propia"
                                    value={form.subcategory}
                                    onChange={(e) => set('subcategory', e.target.value)}
                                />
                            </div>
                        )}

                        <div>
                            <Label>Modalidad * (puedes elegir varias)</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                                {(Object.keys(MODALITY_LABELS) as Modality[]).map(m => {
                                    const Icon = MODALITY_ICONS[m];
                                    const selected = form.modality.includes(m);
                                    return (
                                        <button
                                            type="button"
                                            key={m}
                                            onClick={() => toggleModality(m)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-md border-2 transition-colors ${
                                                selected
                                                    ? 'border-primary bg-primary/5 text-primary'
                                                    : 'border-muted hover:border-muted-foreground/40'
                                            }`}
                                        >
                                            <Icon className="h-5 w-5 mb-1" />
                                            <span className="text-xs font-medium">{MODALITY_LABELS[m]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Nombre del servicio *</Label>
                                <p className="text-xs text-muted-foreground">Lo que vera el cliente en el marketplace</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={applyTemplate}>
                                <Sparkles className="h-3 w-3 mr-1" /> Usar plantilla
                            </Button>
                        </div>
                        <Input
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder={template.suggested_name || 'Ej: Sesion de fisioterapia deportiva'}
                        />
                    </div>
                )}

                {/* ─── PASO 2: Detalle ─── */}
                {step === 2 && (
                    <div className="space-y-5">
                        <div>
                            <Label>Descripcion corta</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => set('description', e.target.value)}
                                rows={3}
                                placeholder="Describe brevemente que hace especial a tu servicio (max 500 caracteres)"
                                maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground mt-1">{form.description.length}/500</p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label>Que incluye la sesion * (minimo 1)</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={addInclude}>
                                    <Plus className="h-3 w-3 mr-1" /> Agregar item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {form.includes.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic">
                                        Ej: "Evaluacion postural inicial", "Terapia manual", "Plan de ejercicios"
                                    </p>
                                )}
                                {form.includes.map((item, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="flex items-center text-muted-foreground">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <Input
                                            value={item}
                                            onChange={(e) => updateInclude(i, e.target.value)}
                                            placeholder="Ej: Evaluacion postural inicial"
                                            maxLength={120}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeInclude(i)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Para quien es</Label>
                            <p className="text-xs text-muted-foreground mb-2">Ayuda a los clientes correctos a encontrarte</p>
                            <div className="flex flex-wrap gap-2">
                                {COMMON_AUDIENCES.map(a => (
                                    <Badge
                                        key={a}
                                        variant={form.target_audience.includes(a) ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => toggleAudience(a)}
                                    >
                                        {a}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Requisitos previos del cliente</Label>
                            <Textarea
                                value={form.requirements}
                                onChange={(e) => set('requirements', e.target.value)}
                                rows={2}
                                placeholder="Ej: traer ropa comoda, estudios medicos recientes, llegar 5 min antes"
                                maxLength={300}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Politica de cancelacion (horas previas)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.cancellation_policy_hours}
                                    onChange={(e) => set('cancellation_policy_hours', parseInt(e.target.value || '0', 10))}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Cancelaciones con menos de {form.cancellation_policy_hours}h pueden generar penalizacion
                                </p>
                            </div>
                            <div>
                                <Label>Visibilidad</Label>
                                <Select
                                    value={form.visibility}
                                    onValueChange={(v) => set('visibility', v as ServiceFormState['visibility'])}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="public">Publico (marketplace)</SelectItem>
                                        <SelectItem value="school_only">Solo escuelas afiliadas</SelectItem>
                                        <SelectItem value="private">Privado (oculto)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── PASO 3: Precio + Media + Variaciones ─── */}
                {step === 3 && (
                    <div className="space-y-5">
                        <div>
                            <Label>Imagen del servicio</Label>
                            <ServiceImageUploader
                                value={form.image_url}
                                onChange={(url) => set('image_url', url)}
                                vendorId={vendorId}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Precio base (COP) *</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.price}
                                    onChange={(e) => set('price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    placeholder="80000"
                                />
                            </div>
                            <div>
                                <Label>Duracion (min)</Label>
                                <Input
                                    type="number"
                                    min={5}
                                    value={form.duration_minutes}
                                    onChange={(e) => set('duration_minutes', parseInt(e.target.value || '60', 10))}
                                />
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div>
                                    <Label>Paquetes (opcional)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Vende mas con paquetes de varias sesiones — el cliente paga upfront, tu agendas.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {VARIATION_PRESETS.filter(p => p.sessions > 1).map(p => (
                                    <Button
                                        key={p.name}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addVariationFromPreset(p)}
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        {p.name} (-{p.discount_percent}%)
                                    </Button>
                                ))}
                            </div>
                            {form.variations.length > 0 && (
                                <div className="space-y-2">
                                    {form.variations.map((v, i) => (
                                        <Card key={i}>
                                            <CardContent className="p-3 flex items-center justify-between">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{v.name}</p>
                                                    {v.description && (
                                                        <p className="text-xs text-muted-foreground">{v.description}</p>
                                                    )}
                                                </div>
                                                <span className="font-semibold mx-3">
                                                    ${v.price.toLocaleString('es-CO')}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeVariation(i)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Preview ─ como se vera en marketplace */}
                        <div>
                            <Label className="mb-2 block">Vista previa en el marketplace</Label>
                            <Card className="overflow-hidden max-w-xs">
                                <div className="relative aspect-[4/3] bg-muted">
                                    {form.image_url ? (
                                        <img src={form.image_url} alt={form.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            <Activity className="h-10 w-10" />
                                        </div>
                                    )}
                                    <Badge className="absolute top-2 left-2" variant="secondary">Servicio</Badge>
                                    {form.modality.length > 0 && (
                                        <div className="absolute bottom-2 left-2 flex gap-1">
                                            {form.modality.slice(0, 2).map(m => {
                                                const Icon = MODALITY_ICONS[m];
                                                return (
                                                    <Badge key={m} className="bg-background/90 text-foreground gap-1">
                                                        <Icon className="h-3 w-3" /> {MODALITY_LABELS[m]}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <CardContent className="p-3 space-y-1">
                                    <h4 className="font-semibold text-sm line-clamp-2">
                                        {form.name || 'Nombre de tu servicio'}
                                    </h4>
                                    {form.subcategory && (
                                        <p className="text-xs text-muted-foreground">{form.subcategory}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" /> {form.duration_minutes} min
                                    </div>
                                    <div className="flex items-center gap-1 pt-1">
                                        <DollarSign className="h-4 w-4 text-primary" />
                                        <span className="text-lg font-bold text-primary">
                                            {typeof form.price === 'number' ? form.price.toLocaleString('es-CO') : '0'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* ─── Footer: navegacion ─── */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(step - 1)}
                        disabled={step === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Atras
                    </Button>

                    {step < 3 ? (
                        <Button
                            type="button"
                            onClick={() => setStep(step + 1)}
                            disabled={!canAdvance}
                        >
                            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    ) : (
                        <Button type="button" onClick={handleSubmit} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Publicar en marketplace
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
