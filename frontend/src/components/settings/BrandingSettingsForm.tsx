import { useState, useRef, useEffect } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useStorage } from '@/hooks/useStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Loader2, Save, Palette, Image as ImageIcon } from 'lucide-react';
import { useTheme, useBranding } from '@/contexts/ThemeContext';
import { getUserFriendlyError } from '@/lib/error-translator';

export function BrandingSettingsForm() {
    const { schoolId, refreshSchoolBranding } = useSchoolContext();
    const { uploadFile, uploading } = useStorage();
    const { toast } = useToast();
    const { setPreviewBranding } = useTheme();
    const currentBranding = useBranding();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [primaryColor, setPrimaryColor] = useState(currentBranding.primary_color);
    const [secondaryColor, setSecondaryColor] = useState(currentBranding.secondary_color);
    const [showWatermark, setShowWatermark] = useState(currentBranding.show_sportmaps_watermark);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Load branding data on mount or schoolId change
    useEffect(() => {
        async function fetchAndInit() {
            if (!schoolId) return;

            const { data, error } = await supabase
                .from('schools')
                .select('logo_url, branding_settings')
                .eq('id', schoolId)
                .maybeSingle();

            if (data && !error) {
                const schoolData = data as any;
                setLogoUrl(schoolData.logo_url);
                const settings = schoolData.branding_settings as any;
                // Initialize with DB values or fallback to default SportMaps branding (Green/Orange)
                setPrimaryColor(settings?.primary_color || '#248223');
                setSecondaryColor(settings?.secondary_color || '#FB9F1E');
                setShowWatermark(settings?.show_sportmaps_watermark ?? true);
            }
        }

        fetchAndInit();
    }, [schoolId]);

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !schoolId) return;

        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: "Archivo demasiado grande",
                description: "El logo no debe superar los 2MB.",
                variant: "destructive",
            });
            return;
        }

        try {
            // Force subfolder to be 'logos/{schoolId}'
            const publicUrl = await uploadFile(file, `school-assets`, `logos/${schoolId}`);

            if (publicUrl) {
                const { error } = await supabase
                    .from('schools')
                    .update({
                        logo_url: publicUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', schoolId);

                if (error) throw error;

                setLogoUrl(publicUrl);
                await refreshSchoolBranding(); // Update whole app context

                toast({
                    title: "Logo actualizado",
                    description: "El logo de la academia ha sido cambiado exitosamente.",
                });
            }
        } catch (error: any) {
            console.error('Error uploading logo:', error);
            toast({
                title: "Error",
                description: getUserFriendlyError(error),
                variant: "destructive",
            });
        }
    };

    const handleSaveBranding = async () => {
        if (!schoolId) return;
        setSaving(true);

        try {
            const brandingSettings = {
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                show_sportmaps_watermark: showWatermark
            };

            const { error } = await supabase
                .from('schools')
                .update({
                    branding_settings: brandingSettings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', schoolId);

            if (error) throw error;

            await refreshSchoolBranding(); // Update whole app context

            toast({
                title: "Identidad Visual guardada",
                description: "Los colores y configuraciones han sido actualizados.",
            });
        } catch (error: any) {
            console.error('Error saving branding:', error);
            toast({
                title: "Error",
                description: getUserFriendlyError(error),
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    // Live preview effect via Context instead of direct DOM manipulation
    useEffect(() => {
        setPreviewBranding({
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            show_sportmaps_watermark: showWatermark
        });

        return () => {
            // Revert preview on unmount
            setPreviewBranding(null);
        }
    }, [primaryColor, secondaryColor, showWatermark, setPreviewBranding]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        Logo de la Academia
                    </CardTitle>
                    <CardDescription>
                        Sube el logo oficial que se mostrará en la barra lateral, invitaciones y documentos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        <div className="h-24 w-24 rounded-md border flex items-center justify-center bg-muted/30 overflow-hidden relative">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                            ) : (
                                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                            )}
                        </div>
                        <div className="space-y-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/jpeg,image/png,image/svg+xml,image/webp"
                                onChange={handleLogoUpload}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Camera className="h-4 w-4" />
                                )}
                                {uploading ? 'Subiendo...' : 'Cambiar Logo'}
                            </Button>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Se recomienda una imagen PNG transparente o SVG. Tamaño mínimo sugerido 512x512px.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        Colores y Personalización
                    </CardTitle>
                    <CardDescription>
                        Configura los colores principales que se aplicarán a los botones, enlaces y acentos visuales en la plataforma.
                        Para escuelas nuevas, se recomienda iniciar con los colores de SportMaps.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label htmlFor="primary-color">Color Principal (Botones, Acentos)</Label>
                            <div className="flex gap-3">
                                <div
                                    className="w-10 h-10 rounded-md border shadow-sm shrink-0"
                                    style={{ backgroundColor: primaryColor }}
                                />
                                <Input
                                    id="primary-color"
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="h-10 w-full cursor-pointer p-1"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="secondary-color">Color Secundario (Fondo de Sidebar)</Label>
                            <div className="flex gap-3">
                                <div
                                    className="w-10 h-10 rounded-md border shadow-sm shrink-0"
                                    style={{ backgroundColor: secondaryColor }}
                                />
                                <Input
                                    id="secondary-color"
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="h-10 w-full cursor-pointer p-1"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Marca de agua de SportMaps</Label>
                                <p className="text-sm text-muted-foreground">
                                    Mostrar discretamente "Powered by SportMaps" junto a tu logo.
                                </p>
                            </div>
                            <Switch
                                checked={showWatermark}
                                onCheckedChange={setShowWatermark}
                            />
                        </div>
                    </div>

                    <div className="pt-6 flex items-center justify-between border-t border-muted/50">
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                            Previsualización en tiempo real activa
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => {
                                    setPrimaryColor('#248223');
                                    setSecondaryColor('#FB9F1E');
                                    setShowWatermark(true);
                                }}
                            >
                                <Palette className="h-4 w-4 mr-2" />
                                Restablecer a SportMaps
                            </Button>
                            <Button onClick={handleSaveBranding} disabled={saving || !schoolId} className="gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saving ? 'Guardando...' : 'Guardar Identidad Visual'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
