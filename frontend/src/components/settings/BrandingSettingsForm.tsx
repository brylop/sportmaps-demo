import { useState, useRef, useEffect } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useStorage } from '@/hooks/useStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, Save, Palette, Image as ImageIcon, Lock } from 'lucide-react';
import { useBranding, hexToHsl, DEFAULT_BRANDING } from '@/contexts/ThemeContext';
import { getUserFriendlyError } from '@/lib/error-translator';
import { bffClient } from '@/lib/api/bffClient';

// Regex hex estricto (mirror del BFF + RPC SQL). Anti-XSS via CSS var injection.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const CSRF_HEADERS = { 'X-Requested-With': 'SportMaps' };

interface BrandingResponse {
    ok: boolean;
    school_id?: string;
    logo_url?: string;
    branding_settings?: {
        primary_color: string;
        secondary_color: string;
        show_sportmaps_watermark: boolean;
    };
    error?: string;
    message?: string;
}

export function BrandingSettingsForm() {
    const { schoolId, refreshSchoolBranding } = useSchoolContext();
    const entitlements = useEntitlements();
    const { uploadFile, uploading } = useStorage();
    const { toast } = useToast();
    const currentBranding = useBranding();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [primaryColor, setPrimaryColor] = useState(currentBranding.primary_color);
    const [secondaryColor, setSecondaryColor] = useState(currentBranding.secondary_color);
    const [showWatermark, setShowWatermark] = useState(currentBranding.show_sportmaps_watermark);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const hasWhitelabel = entitlements.addons.whitelabel;

    // Re-init defaults cuando cambie schoolId o llegue el branding del context.
    useEffect(() => {
        if (!schoolId) return;
        setPrimaryColor(currentBranding.primary_color);
        setSecondaryColor(currentBranding.secondary_color);
        setShowWatermark(currentBranding.show_sportmaps_watermark);
        // logo_url viene del context via schoolBranding (que refreshSchoolBranding actualiza).
        // Pero para no anular un upload optimista, solo escribimos si esta null aun.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId, currentBranding.primary_color, currentBranding.secondary_color]);

    // Si el tier no incluye whitelabel, mostrar upsell y deshabilitar form.
    if (!entitlements.isLoading && !hasWhitelabel) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                        Personalización de Marca
                    </CardTitle>
                    <CardDescription>
                        La personalización de logo y colores es una característica de los planes Pro y superiores.
                        Tu plan actual usa el branding de SportMaps por defecto.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="default" className="gap-2">
                        <a href="/mi-plan">
                            <Palette className="h-4 w-4" />
                            Ver planes y actualizar
                        </a>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !schoolId) return;

        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: 'Archivo demasiado grande',
                description: 'El logo no debe superar los 2MB.',
                variant: 'destructive',
            });
            return;
        }

        // Validacion MIME del lado cliente (defense-in-depth, el bucket
        // tambien tiene allowed_mime_types en su config).
        const allowedMimes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimes.includes(file.type)) {
            toast({
                title: 'Formato no soportado',
                description: 'Solo aceptamos JPG, PNG, SVG o WEBP.',
                variant: 'destructive',
            });
            return;
        }

        try {
            // 1. Subir al bucket Storage. La RLS de storage.objects ya valida
            //    que el caller sea admin de esta school_id (folder=logos/<id>/).
            const publicUrl = await uploadFile(file, 'school-assets', `logos/${schoolId}`);
            if (!publicUrl) {
                throw new Error('upload_failed');
            }

            // 2. Persistir la URL en schools via BFF (RPC seguro, audit log).
            const res = await bffClient.put<BrandingResponse>(
                `/api/v1/schools/${schoolId}/branding`,
                { logo_url: publicUrl },
                CSRF_HEADERS,
            );

            if (!res.ok) {
                throw new Error(res.error || res.message || 'update_failed');
            }

            setLogoUrl(res.logo_url ?? publicUrl);
            await refreshSchoolBranding();

            toast({
                title: 'Logo actualizado',
                description: 'El logo de la academia ha sido cambiado exitosamente.',
            });
        } catch (error: any) {
            console.error('Error uploading logo:', error);
            toast({
                title: 'Error',
                description: getUserFriendlyError(error),
                variant: 'destructive',
            });
        }
    };

    const handleSaveBranding = async () => {
        if (!schoolId) return;

        // Validacion client-side antes de mandar al BFF (UX mejor que un 400).
        if (!HEX_RE.test(primaryColor)) {
            toast({
                title: 'Color principal inválido',
                description: 'Debe ser un color hexadecimal de 6 dígitos (#RRGGBB).',
                variant: 'destructive',
            });
            return;
        }
        if (!HEX_RE.test(secondaryColor)) {
            toast({
                title: 'Color secundario inválido',
                description: 'Debe ser un color hexadecimal de 6 dígitos (#RRGGBB).',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            const res = await bffClient.put<BrandingResponse>(
                `/api/v1/schools/${schoolId}/branding`,
                {
                    primary_color: primaryColor,
                    secondary_color: secondaryColor,
                    show_watermark: showWatermark,
                },
                CSRF_HEADERS,
            );

            if (!res.ok) {
                // Mensajes especificos para errores conocidos del RPC
                const code = res.error || 'unknown';
                const map: Record<string, string> = {
                    feature_not_available: 'Tu plan actual no incluye personalización de marca.',
                    rate_limited: 'Demasiados cambios recientes. Espera 1 hora.',
                    invalid_primary_color: 'Color principal inválido.',
                    invalid_secondary_color: 'Color secundario inválido.',
                    invalid_logo_url: 'La URL del logo no es válida.',
                    forbidden: 'No tienes permiso para modificar esta escuela.',
                };
                throw new Error(map[code] || res.message || code);
            }

            await refreshSchoolBranding();

            toast({
                title: 'Identidad Visual guardada',
                description: 'Los colores y configuraciones han sido actualizados.',
            });
        } catch (error: any) {
            console.error('Error saving branding:', error);
            toast({
                title: 'Error',
                description: getUserFriendlyError(error),
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    // ── Preview LOCAL al form (no global) ───────────────────────────────
    // Aplicamos las CSS vars del preview SOLO dentro del container del form
    // (data-branding-preview="local"). Esto evita el bug historico donde el
    // preview se escapaba a :root y pintaba a otros usuarios/escuelas.
    const previewStyle: React.CSSProperties = HEX_RE.test(primaryColor) && HEX_RE.test(secondaryColor)
        ? {
              ['--primary' as any]: hexToHsl(primaryColor),
              ['--secondary' as any]: hexToHsl(secondaryColor),
          }
        : {};

    return (
        <div
            data-branding-preview="local"
            style={previewStyle}
            className="space-y-6 animate-in fade-in duration-500"
        >
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
                                Máximo 2MB. PNG transparente o SVG recomendado. 512×512 px sugerido.
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
                        Solo afectan a tu escuela — no a otras escuelas ni a roles administrativos.
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
                            <Label htmlFor="secondary-color">Color Secundario (Sidebar)</Label>
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

                    {/* Preview local — usa los CSS vars del container del form */}
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            Vista previa (solo aquí, no afecta al resto de la app)
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="sm">Botón Principal</Button>
                            <Button size="sm" variant="secondary">Botón Secundario</Button>
                            <Button size="sm" variant="outline">Outline</Button>
                            <span className="text-sm text-primary font-medium">Texto en color principal</span>
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
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                                setPrimaryColor(DEFAULT_BRANDING.primary_color);
                                setSecondaryColor(DEFAULT_BRANDING.secondary_color);
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
                </CardContent>
            </Card>
        </div>
    );
}
