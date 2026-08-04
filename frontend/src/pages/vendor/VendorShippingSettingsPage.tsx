import { useEffect, useState } from 'react';
import {
    useVendorShippingSettings, useUpdateVendorShippingSettings, useShippingCarriers,
    type VendorShippingSettings,
} from '@/hooks/useShipping';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Truck, Loader2, Save, MapPin, Package, RotateCcw } from 'lucide-react';

const DEFAULT_FORM: Partial<VendorShippingSettings> = {
    origin_city:              '',
    origin_state:             '',
    origin_postal_code:       '',
    origin_country:           'CO',
    default_box_length_cm:    null,
    default_box_width_cm:     null,
    default_box_height_cm:    null,
    default_weight_grams:     null,
    free_shipping_min_amount: null,
    ready_to_ship_hours:      24,
    accepts_pickup_in_store:  false,
    accepted_carrier_codes:   [],
    return_policy_days:       0,
    return_policy_text:       '',
};

export default function VendorShippingSettingsPage() {
    const { toast } = useToast();
    const { data: settings, isLoading } = useVendorShippingSettings();
    const { data: carriers = [] } = useShippingCarriers();
    const update = useUpdateVendorShippingSettings();

    const [form, setForm] = useState<Partial<VendorShippingSettings>>(DEFAULT_FORM);

    useEffect(() => {
        if (settings) setForm(settings);
    }, [settings]);

    const toggleCarrier = (code: string) => {
        const cur = form.accepted_carrier_codes || [];
        setForm(f => ({
            ...f,
            accepted_carrier_codes: cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code],
        }));
    };

    const handleSave = async () => {
        try {
            await update.mutateAsync({
                origin_city:              form.origin_city || null,
                origin_state:             form.origin_state || null,
                origin_postal_code:       form.origin_postal_code || null,
                origin_country:           form.origin_country || 'CO',
                default_box_length_cm:    form.default_box_length_cm ?? null,
                default_box_width_cm:     form.default_box_width_cm ?? null,
                default_box_height_cm:    form.default_box_height_cm ?? null,
                default_weight_grams:     form.default_weight_grams ?? null,
                free_shipping_min_amount: form.free_shipping_min_amount ?? null,
                ready_to_ship_hours:      form.ready_to_ship_hours || 24,
                accepts_pickup_in_store:  form.accepts_pickup_in_store || false,
                accepted_carrier_codes:   form.accepted_carrier_codes || [],
                return_policy_days:       form.return_policy_days || 0,
                return_policy_text:       form.return_policy_text || null,
            });
            toast({ title: 'Configuración guardada' });
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-3xl">
            <header>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="h-6 w-6 text-primary" />
                    Configuración de envíos
                </h1>
                <p className="text-sm text-muted-foreground">
                    Define desde dónde despachas, qué transportadoras aceptas y tus políticas de devolución.
                </p>
            </header>

            {/* Origen */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-5 w-5" /> Origen de despacho</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Ciudad *</Label>
                            <Input value={form.origin_city || ''} onChange={e => setForm(f => ({ ...f, origin_city: e.target.value }))} placeholder="Bogotá" />
                        </div>
                        <div>
                            <Label>Departamento</Label>
                            <Input value={form.origin_state || ''} onChange={e => setForm(f => ({ ...f, origin_state: e.target.value }))} placeholder="Cundinamarca" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Código postal</Label>
                            <Input value={form.origin_postal_code || ''} onChange={e => setForm(f => ({ ...f, origin_postal_code: e.target.value }))} placeholder="110111" />
                        </div>
                        <div>
                            <Label>País</Label>
                            <Input value={form.origin_country || 'CO'} onChange={e => setForm(f => ({ ...f, origin_country: e.target.value }))} maxLength={2} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Caja default + peso */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Package className="h-5 w-5" /> Empaque por defecto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Se usa para cotizar envíos cuando un producto no tiene dimensiones propias.</p>
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <Label className="text-xs">Largo (cm)</Label>
                            <Input type="number" value={form.default_box_length_cm ?? ''} onChange={e => setForm(f => ({ ...f, default_box_length_cm: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                        <div>
                            <Label className="text-xs">Ancho (cm)</Label>
                            <Input type="number" value={form.default_box_width_cm ?? ''} onChange={e => setForm(f => ({ ...f, default_box_width_cm: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                        <div>
                            <Label className="text-xs">Alto (cm)</Label>
                            <Input type="number" value={form.default_box_height_cm ?? ''} onChange={e => setForm(f => ({ ...f, default_box_height_cm: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                        <div>
                            <Label className="text-xs">Peso (g)</Label>
                            <Input type="number" value={form.default_weight_grams ?? ''} onChange={e => setForm(f => ({ ...f, default_weight_grams: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Tiempo de preparación (h)</Label>
                            <Input type="number" min={0} value={form.ready_to_ship_hours ?? 24} onChange={e => setForm(f => ({ ...f, ready_to_ship_hours: Number(e.target.value) }))} />
                        </div>
                        <div>
                            <Label className="text-xs">Envío gratis sobre (COP)</Label>
                            <Input type="number" value={form.free_shipping_min_amount ?? ''} onChange={e => setForm(f => ({ ...f, free_shipping_min_amount: e.target.value ? Number(e.target.value) : null }))} placeholder="200000" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Carriers aceptados */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Transportadoras que aceptas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {carriers.map(c => {
                            const active = (form.accepted_carrier_codes || []).includes(c.code);
                            return (
                                <label key={c.id} className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors ${
                                    active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                                }`}>
                                    <Checkbox checked={active} onCheckedChange={() => toggleCarrier(c.code)} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{c.name}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {c.coverage === 'intracity' ? 'Intra-ciudad' : c.coverage === 'national' ? 'Nacional' : 'Internacional'}
                                            {c.supports_cod && ' · COD'}
                                        </p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                        Si no marcas ninguna, los compradores verán todas las disponibles para su ruta.
                    </p>
                </CardContent>
            </Card>

            {/* Pickup en tienda */}
            <Card>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium">Permitir recoger en tienda</p>
                        <p className="text-xs text-muted-foreground">Los compradores pueden elegir retirar el pedido en tu dirección.</p>
                    </div>
                    <Switch checked={form.accepts_pickup_in_store || false} onCheckedChange={c => setForm(f => ({ ...f, accepts_pickup_in_store: c }))} />
                </CardContent>
            </Card>

            {/* Política de devolución */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Política de devolución</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label className="text-xs">Días para devolver tras recepción</Label>
                        <Input type="number" min={0} max={90} value={form.return_policy_days ?? 0} onChange={e => setForm(f => ({ ...f, return_policy_days: Number(e.target.value) }))} />
                        <p className="text-[11px] text-muted-foreground mt-1">0 = no aceptas devoluciones. Recomendado: 7-15 días para calzado / ropa.</p>
                    </div>
                    <div>
                        <Label className="text-xs">Texto público de la política</Label>
                        <Textarea rows={3} value={form.return_policy_text || ''} onChange={e => setForm(f => ({ ...f, return_policy_text: e.target.value }))} placeholder="Condiciones, exclusiones, quién paga el envío de retorno..." />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={update.isPending}>
                    {update.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Guardar configuración
                </Button>
            </div>
        </div>
    );
}
