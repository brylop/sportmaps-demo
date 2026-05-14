/**
 * <VendorDocUploadModal> — Permite al vendor subir o reemplazar su
 * documento de verificacion DESPUES del onboarding inicial.
 *
 * El onboarding (VendorOnboardingPage) es un flujo de una sola vez para
 * configurar la tienda. Cuando el admin pide actualizar el doc (rechazado,
 * vencido, otro motivo), el vendor entra aqui desde su dashboard sin
 * pasar por los 3 pasos del wizard.
 *
 * Flujo:
 *  1. Si ya hay doc, genera signed URL y muestra preview.
 *  2. Usuario elige nuevo archivo → upload a bucket vendor-docs.
 *  3. PATCH /vendor/profile/verification con la nueva URL.
 *  4. RPC notify_user a admins (vendedor "subio nuevo doc").
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Loader2, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Estado actual de verificacion (info para el copy). */
    status?: 'pending' | 'verified' | 'rejected' | null;
    /** URL actual del doc, si existe. */
    currentDocUrl?: string | null;
    /** Callback opcional cuando upload termina con exito. */
    onUploaded?: () => void;
}

export function VendorDocUploadModal({ open, onOpenChange, status, currentDocUrl, onUploaded }: Props) {
    const { session } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [currentSignedUrl, setCurrentSignedUrl] = useState<string | null>(null);
    const [loadingCurrent, setLoadingCurrent] = useState(false);

    // Cuando abre el modal, generar signed URL del doc actual (si hay).
    useEffect(() => {
        if (!open) return;
        setFile(null);
        setCurrentSignedUrl(null);
        if (!currentDocUrl) return;

        setLoadingCurrent(true);
        const match = currentDocUrl.match(/vendor-docs\/(.+?)(?:\?|$)/);
        const filePath = match ? decodeURIComponent(match[1]) : currentDocUrl.split('/').pop();
        if (!filePath) { setLoadingCurrent(false); return; }

        supabase.storage
            .from('vendor-docs')
            .createSignedUrl(filePath, 300)
            .then(({ data }) => {
                if (data) setCurrentSignedUrl(data.signedUrl);
            })
            .finally(() => setLoadingCurrent(false));
    }, [open, currentDocUrl]);

    const submit = async () => {
        if (!file || !session?.user.id) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('vendor-docs')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('vendor-docs')
                .getPublicUrl(fileName);

            const res = await fetch(`${API_URL}/api/v1/vendor/profile/verification`, {
                method: 'PUT',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ verification_doc_url: urlData.publicUrl }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || 'Error guardando documento');
            }

            toast({
                title: 'Documento enviado',
                description: 'Tu nuevo documento esta en revision. Te notificaremos cuando se complete.',
            });
            qc.invalidateQueries({ queryKey: ['vendor-profile'] });
            onUploaded?.();
            onOpenChange(false);
        } catch (e: any) {
            toast({
                title: 'Error al subir',
                description: e?.message || 'No se pudo guardar el documento.',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
        }
    };

    const isImage = currentSignedUrl && /\.(jpe?g|png)(\?|$)/i.test(currentSignedUrl);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        {currentDocUrl ? 'Actualizar documento de verificación' : 'Subir documento de verificación'}
                    </DialogTitle>
                    <DialogDescription>
                        Acepta cédula, RUT, Cámara de Comercio o tarjeta profesional. PDF / JPG / PNG, máx 5 MB.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Estado actual */}
                    {status && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Estado:</span>
                            <Badge
                                variant={
                                    status === 'verified' ? 'default'
                                    : status === 'rejected' ? 'destructive'
                                    : 'secondary'
                                }
                            >
                                {status === 'verified' ? 'Verificada'
                                    : status === 'rejected' ? 'Rechazada'
                                    : 'Pendiente'}
                            </Badge>
                        </div>
                    )}

                    {status === 'rejected' && (
                        <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>Tu documento anterior fue rechazado. Sube uno nuevo con mejor calidad o que corresponda al titular registrado.</p>
                        </div>
                    )}

                    {/* Preview del doc actual */}
                    {currentDocUrl && (
                        <div>
                            <Label className="text-xs">Documento actual</Label>
                            {loadingCurrent ? (
                                <div className="border rounded-md p-6 flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : currentSignedUrl ? (
                                isImage ? (
                                    <a href={currentSignedUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={currentSignedUrl} alt="Doc actual" className="w-full max-h-48 object-contain border rounded-md" />
                                    </a>
                                ) : (
                                    <a
                                        href={currentSignedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="border rounded-md p-4 flex items-center gap-2 hover:bg-muted"
                                    >
                                        <FileText className="h-5 w-5 text-primary" />
                                        <span className="text-sm flex-1">Ver documento (PDF)</span>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    </a>
                                )
                            ) : (
                                <p className="text-xs text-muted-foreground">No se pudo cargar el documento actual.</p>
                            )}
                        </div>
                    )}

                    {/* Upload nuevo */}
                    <div>
                        <Label className="text-xs">{currentDocUrl ? 'Subir nuevo documento (reemplaza el actual)' : 'Seleccionar archivo'}</Label>
                        <div className="border-2 border-dashed rounded-md p-6 text-center hover:bg-muted/50 transition-colors mt-1">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="vendor-doc-upload-modal"
                            />
                            <label htmlFor="vendor-doc-upload-modal" className="cursor-pointer block">
                                <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-1" />
                                {file ? (
                                    <p className="text-sm font-medium text-primary">{file.name}</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Haz clic para elegir un archivo</p>
                                )}
                            </label>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                        Cancelar
                    </Button>
                    <Button onClick={submit} disabled={!file || uploading}>
                        {uploading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        {currentDocUrl ? 'Reemplazar documento' : 'Subir documento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
