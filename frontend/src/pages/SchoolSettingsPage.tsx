import React, { useState, useEffect } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { Save, Settings, Bell, DollarSign, Clock, Shield, Building2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface SchoolSettingsData {
    id?: string;
    school_id: string;
    payment_cutoff_day: number;
    payment_grace_days: number;
    auto_generate_payments: boolean;
    reminder_enabled: boolean;
    reminder_days_before: number;
    late_fee_enabled: boolean;
    late_fee_percentage: number;
    allow_coach_messaging: boolean;
    require_payment_proof: boolean;
}

const DEFAULT_SETTINGS: Omit<SchoolSettingsData, 'school_id'> = {
    payment_cutoff_day: 5,
    payment_grace_days: 5,
    auto_generate_payments: true,
    reminder_enabled: true,
    reminder_days_before: 3,
    late_fee_enabled: false,
    late_fee_percentage: 5,
    allow_coach_messaging: true,
    require_payment_proof: true,
};

import { useNavigate } from 'react-router-dom';

export default function SchoolSettingsPage() {
    const { schoolId, schoolName } = useSchoolContext();
    const navigate = useNavigate();
    const [settings, setSettings] = useState<SchoolSettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (schoolId) loadSettings();
    }, [schoolId]);

    async function loadSettings() {
        if (!schoolId) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('school_settings')
                .select('*')
                .eq('school_id', schoolId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setSettings(data as unknown as SchoolSettingsData);
            } else {
                // Create default settings
                setSettings({ ...DEFAULT_SETTINGS, school_id: schoolId });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!settings || !schoolId) return;
        try {
            setSaving(true);
            const payload = {
                school_id: schoolId,
                payment_cutoff_day: settings.payment_cutoff_day,
                payment_grace_days: settings.payment_grace_days,
                auto_generate_payments: settings.auto_generate_payments,
                reminder_enabled: settings.reminder_enabled,
                reminder_days_before: settings.reminder_days_before,
                late_fee_enabled: settings.late_fee_enabled,
                late_fee_percentage: settings.late_fee_percentage,
                allow_coach_messaging: settings.allow_coach_messaging,
                require_payment_proof: settings.require_payment_proof,
            };

            if (settings.id) {
                const { error } = await supabase
                    .from('school_settings')
                    .update(payload)
                    .eq('id', settings.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('school_settings')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                setSettings(data as unknown as SchoolSettingsData);
            }

            toast.success('✅ Configuración guardada exitosamente');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast.error(error.message || 'Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    }

    const updateSetting = <K extends keyof SchoolSettingsData>(key: K, value: SchoolSettingsData[K]) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-64 bg-muted animate-pulse rounded" />
                <div className="grid gap-6 md:grid-cols-2">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Settings className="h-8 w-8 text-primary" />
                        Configuración de la Escuela
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Reglas de cobro, recordatorios y permisos para <span className="font-medium text-foreground">{schoolName}</span>.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto shadow-sm">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Payment Rules */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-emerald-500" />
                            Reglas de Cobro
                        </CardTitle>
                        <CardDescription>Configura cuándo y cómo se generan los cobros mensuales.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="due_day">Día de corte del mes</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="due_day"
                                    type="number"
                                    min={1}
                                    max={28}
                                    className="w-24"
                                    value={settings.payment_cutoff_day}
                                    onChange={(e) => updateSetting('payment_cutoff_day', e.target.value === '' ? ('' as any) : parseInt(e.target.value))}
                                />
                                <span className="text-sm text-muted-foreground">de cada mes</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="grace">Días de gracia</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="grace"
                                    type="number"
                                    min={0}
                                    max={15}
                                    className="w-24"
                                    value={settings.payment_grace_days}
                                    onChange={(e) => updateSetting('payment_grace_days', e.target.value === '' ? ('' as any) : parseInt(e.target.value))}
                                />
                                <span className="text-sm text-muted-foreground">días después del corte</span>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Generar cobros automáticos</Label>
                                <p className="text-xs text-muted-foreground">Crear pagos pendientes cada mes</p>
                            </div>
                            <Switch
                                checked={settings.auto_generate_payments}
                                onCheckedChange={(v) => updateSetting('auto_generate_payments', v)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Late Fees */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Mora y Penalización
                        </CardTitle>
                        <CardDescription>Configura si se aplican recargos por pago tardío.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Habilitar mora</Label>
                                <p className="text-xs text-muted-foreground">Aplicar recargo después del período de gracia</p>
                            </div>
                            <Switch
                                checked={settings.late_fee_enabled}
                                onCheckedChange={(v) => updateSetting('late_fee_enabled', v)}
                            />
                        </div>
                        {settings.late_fee_enabled && (
                            <div className="space-y-2 p-3 rounded-lg border bg-muted/30 animate-in fade-in slide-in-from-top-2">
                                <Label htmlFor="late_pct">Porcentaje de recargo</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="late_pct"
                                        type="number"
                                        min={1}
                                        max={50}
                                        className="w-24"
                                        value={settings.late_fee_percentage}
                                        onChange={(e) => updateSetting('late_fee_percentage', e.target.value === '' ? ('' as any) : parseInt(e.target.value))}
                                    />
                                    <span className="text-sm text-muted-foreground">% adicional</span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <Label className="font-medium">Exigir comprobante de pago</Label>
                                <p className="text-xs text-muted-foreground">Los padres deben subir foto del recibo</p>
                            </div>
                            <Switch
                                checked={settings.require_payment_proof}
                                onCheckedChange={(v) => updateSetting('require_payment_proof', v)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Reminders */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-blue-500" />
                            Recordatorios
                        </CardTitle>
                        <CardDescription>Configura las notificaciones automáticas de pago.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Enviar recordatorios</Label>
                                <p className="text-xs text-muted-foreground">Notificar a los padres antes del vencimiento</p>
                            </div>
                            <Switch
                                checked={settings.reminder_enabled}
                                onCheckedChange={(v) => updateSetting('reminder_enabled', v)}
                            />
                        </div>
                        {settings.reminder_enabled && (
                            <div className="space-y-2 p-3 rounded-lg border bg-muted/30 animate-in fade-in slide-in-from-top-2">
                                <Label htmlFor="reminder_days">Días antes del vencimiento</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="reminder_days"
                                        type="number"
                                        min={1}
                                        max={15}
                                        className="w-24"
                                        value={settings.reminder_days_before}
                                        onChange={(e) => updateSetting('reminder_days_before', e.target.value === '' ? ('' as any) : parseInt(e.target.value))}
                                    />
                                    <span className="text-sm text-muted-foreground">días antes</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Permissions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-purple-500" />
                            Permisos
                        </CardTitle>
                        <CardDescription>Controla qué pueden hacer los coaches y el staff.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Coaches pueden enviar mensajes</Label>
                                <p className="text-xs text-muted-foreground">Permitir comunicación directa coach → padres</p>
                            </div>
                            <Switch
                                checked={settings.allow_coach_messaging}
                                onCheckedChange={(v) => updateSetting('allow_coach_messaging', v)}
                            />
                        </div>

                        <Separator />

                        <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
                            <p className="text-xs text-muted-foreground text-center">
                                Más opciones de permisos estarán disponibles próximamente.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Infrastructure Management */}
                <Card className="md:col-span-2 bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Sedes e Infraestructura
                        </CardTitle>
                        <CardDescription>Gestiona tus sedes físicas y las instalaciones (canchas, gimnasios, etc.) disponibles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col items-center gap-2 border-primary/30 hover:bg-primary/10"
                                onClick={() => navigate('/branches')}
                            >
                                <MapPin className="h-6 w-6 text-primary" />
                                <div className="text-center">
                                    <div className="font-semibold">Gestionar Sedes</div>
                                    <div className="text-xs text-muted-foreground">Configurar sucursales y ubicaciones</div>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col items-center gap-2 border-primary/30 hover:bg-primary/10"
                                onClick={() => navigate('/facilities')}
                            >
                                <Building2 className="h-6 w-6 text-primary" />
                                <div className="text-center">
                                    <div className="font-semibold">Gestionar Instalaciones</div>
                                    <div className="text-xs text-muted-foreground">Canchas, espacios y equipamiento</div>
                                </div>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
