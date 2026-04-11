/**
 * SportMapsPaySettings — Configuración de pagos online para owners/admins
 *
 * Lee y actualiza school_settings para controlar:
 * - Activación/desactivación de ePayco
 * - Porcentaje de fee
 * - Quién paga el fee (parent/school/split)
 * - Día de transferencia a la escuela
 * - Aceptación de términos de SportMaps Pay
 */

import { useState, useEffect } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CreditCard, Shield, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PaySettings {
    epayco_enabled: boolean;
    online_fee_pct: number;
    fee_payer: 'parent' | 'school' | 'split';
    transfer_day: string;
    sportmaps_pay_terms_accepted_at: string | null;
    sportmaps_pay_terms_accepted_by: string | null;
}

const TRANSFER_DAYS = [
    { value: 'monday', label: 'Lunes' },
    { value: 'wednesday', label: 'Miércoles' },
    { value: 'friday', label: 'Viernes' },
];

const FEE_PAYERS = [
    { value: 'parent', label: 'Padre/Atleta (recomendado)', description: 'El fee se suma al monto del pago' },
    { value: 'school', label: 'Escuela', description: 'El fee se descuenta del monto recibido' },
    { value: 'split', label: 'Compartido 50/50', description: 'Mitad para cada parte' },
];

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

export function SportMapsPaySettings() {
    const { schoolId } = useSchoolContext();
    const { user } = useAuth();
    const [settings, setSettings] = useState<PaySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    useEffect(() => {
        if (schoolId) loadSettings();
    }, [schoolId]);

    async function loadSettings() {
        if (!schoolId) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('school_settings')
                .select('epayco_enabled, online_fee_pct, fee_payer, transfer_day, sportmaps_pay_terms_accepted_at, sportmaps_pay_terms_accepted_by')
                .eq('school_id', schoolId)
                .single();

            if (error) throw error;

            const s = data as any;
            setSettings({
                epayco_enabled: s?.epayco_enabled ?? false,
                online_fee_pct: Number(s?.online_fee_pct ?? 3),
                fee_payer: s?.fee_payer ?? 'parent',
                transfer_day: s?.transfer_day ?? 'monday',
                sportmaps_pay_terms_accepted_at: s?.sportmaps_pay_terms_accepted_at ?? null,
                sportmaps_pay_terms_accepted_by: s?.sportmaps_pay_terms_accepted_by ?? null,
            });
            setTermsAccepted(!!s?.sportmaps_pay_terms_accepted_at);
        } catch (error) {
            console.error('Error loading pay settings:', error);
            toast.error('Error al cargar configuración de pagos.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!schoolId || !settings) return;

        try {
            setSaving(true);

            const updateData: Record<string, any> = {
                epayco_enabled: settings.epayco_enabled,
                online_fee_pct: settings.online_fee_pct,
                fee_payer: settings.fee_payer,
                transfer_day: settings.transfer_day,
            };

            // Si es la primera vez que activa y acepta términos
            if (settings.epayco_enabled && !settings.sportmaps_pay_terms_accepted_at && termsAccepted) {
                updateData.sportmaps_pay_terms_accepted_at = new Date().toISOString();
                updateData.sportmaps_pay_terms_accepted_by = user?.id;
            }

            const { error } = await supabase
                .from('school_settings')
                .update(updateData)
                .eq('school_id', schoolId);

            if (error) throw error;

            toast.success('✅ Configuración de pagos guardada.');
            loadSettings(); // Recargar
        } catch (error: any) {
            console.error('Error saving pay settings:', error);
            toast.error(error.message || 'Error al guardar.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (!settings) return null;

    // Ejemplo de cálculo para preview
    const exampleBase = 100000;
    const exampleFee = Math.round(exampleBase * (settings.online_fee_pct / 100));
    const exampleTotal = exampleBase + exampleFee;

    return (
        <Card className="border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    SportMaps Pay
                    {settings.epayco_enabled ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                            Activo
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-xs">Inactivo</Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    Permite a tus padres y atletas pagar online con tarjeta, PSE o Nequi a través de ePayco.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* ── Toggle principal ──────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="epayco-toggle" className="text-base font-medium">
                            Activar pagos online
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Habilita el botón "Pagar online" en la vista de pagos de los padres.
                        </p>
                    </div>
                    <Switch
                        id="epayco-toggle"
                        checked={settings.epayco_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, epayco_enabled: checked })}
                    />
                </div>

                <Separator />

                {/* ── Configuración (solo si está activo o se va a activar) ── */}
                {(settings.epayco_enabled || settings.sportmaps_pay_terms_accepted_at) && (
                    <>
                        {/* Fee */}
                        <div className="space-y-3">
                            <Label htmlFor="fee-pct" className="text-sm font-medium">
                                Porcentaje de procesamiento
                            </Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="fee-pct"
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={settings.online_fee_pct}
                                    onChange={(e) => setSettings({ ...settings, online_fee_pct: parseFloat(e.target.value) || 0 })}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                            </div>

                            {/* Preview del cálculo */}
                            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                                <p className="font-medium text-xs text-muted-foreground mb-2">Ejemplo con mensualidad de {formatCurrency(exampleBase)}:</p>
                                <div className="flex justify-between">
                                    <span>Base</span>
                                    <span>{formatCurrency(exampleBase)}</span>
                                </div>
                                <div className="flex justify-between text-amber-600">
                                    <span>Fee ({settings.online_fee_pct}%)</span>
                                    <span>+{formatCurrency(exampleFee)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-1">
                                    <span>Total padre paga</span>
                                    <span>{formatCurrency(exampleTotal)}</span>
                                </div>
                                <div className="flex justify-between text-green-600 text-xs mt-1">
                                    <span>Tu escuela recibe</span>
                                    <span>{formatCurrency(exampleBase)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quién paga */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">¿Quién paga el fee?</Label>
                            <Select
                                value={settings.fee_payer}
                                onValueChange={(v) => setSettings({ ...settings, fee_payer: v as any })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FEE_PAYERS.map(({ value, label, description }) => (
                                        <SelectItem key={value} value={value}>
                                            <div>
                                                <p className="font-medium">{label}</p>
                                                <p className="text-xs text-muted-foreground">{description}</p>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Día de transferencia */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Día de transferencia</Label>
                            <p className="text-xs text-muted-foreground">
                                Día en que SportMaps transfiere los fondos acumulados a tu cuenta bancaria.
                            </p>
                            <Select
                                value={settings.transfer_day}
                                onValueChange={(v) => setSettings({ ...settings, transfer_day: v })}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRANSFER_DAYS.map(({ value, label }) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator />

                        {/* ── Términos ──────────────────────────────────────── */}
                        {settings.sportmaps_pay_terms_accepted_at ? (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>
                                    Términos aceptados el{' '}
                                    {new Date(settings.sportmaps_pay_terms_accepted_at).toLocaleDateString('es-CO')}
                                </span>
                            </div>
                        ) : settings.epayco_enabled ? (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-sm">
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="mt-0.5"
                                        />
                                        <span>
                                            Acepto los términos y condiciones de SportMaps Pay.
                                            Entiendo que SportMaps cobrará un {settings.online_fee_pct}% por cada transacción procesada online.
                                        </span>
                                    </label>
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        {/* ── Seguridad ─────────────────────────────────────── */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Shield className="h-4 w-4 text-green-600" />
                            <span>Pagos procesados de forma segura por ePayco. SportMaps nunca ve los datos de tarjeta.</span>
                        </div>
                    </>
                )}

                {/* ── Botón guardar ─────────────────────────────────────── */}
                <Button
                    onClick={handleSave}
                    disabled={saving || (settings.epayco_enabled && !settings.sportmaps_pay_terms_accepted_at && !termsAccepted)}
                    className="w-full"
                >
                    {saving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" />Guardar configuración de pagos</>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
