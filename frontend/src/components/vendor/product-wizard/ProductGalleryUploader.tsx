import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, Image as ImageIcon, X, Star, StarOff, Loader2 } from 'lucide-react';

const STORAGE_BUCKET = 'product-images';
const MAX_IMAGES = 8;
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
    /** Lista de URLs en orden. El indice 0 se considera la principal. */
    images:    string[];
    onChange:  (images: string[]) => void;
    /** Identifica al vendor para namespacing en storage. Opcional. */
    vendorId?: string;
}

/**
 * Galeria multi-imagen para productos.
 * - Sube a Supabase Storage (bucket: product-images)
 * - Hasta 8 imagenes
 * - Maximo 5 MB / imagen
 * - JPEG / PNG / WebP
 * - Drag para reordenar (futuro). Por ahora: click estrella para hacer principal.
 *
 * NOTA: la captura nativa con cámara, set 360° y modelos 3D viven en R6.
 * Esta version usa solo file picker estándar.
 */
export function ProductGalleryUploader({ images, onChange, vendorId }: Props) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const remaining = MAX_IMAGES - images.length;
        if (remaining <= 0) {
            toast({ title: `Máximo ${MAX_IMAGES} imágenes`, variant: 'destructive' });
            return;
        }

        const toUpload = Array.from(files).slice(0, remaining);

        setUploading(true);
        const uploadedUrls: string[] = [];

        try {
            for (const file of toUpload) {
                if (!ACCEPTED_TYPES.includes(file.type)) {
                    toast({ title: `${file.name}: formato no soportado`, description: 'JPEG, PNG o WebP', variant: 'destructive' });
                    continue;
                }
                if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                    toast({ title: `${file.name}: muy grande`, description: `Máximo ${MAX_SIZE_MB} MB`, variant: 'destructive' });
                    continue;
                }

                const namespace = vendorId || user?.id || 'anon';
                const ext = file.name.split('.').pop() || 'jpg';
                const path = `${namespace}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

                const { error: uploadErr } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(path, file, { upsert: false, contentType: file.type });

                if (uploadErr) {
                    console.error('upload error', uploadErr);
                    toast({ title: `Error subiendo ${file.name}`, description: uploadErr.message, variant: 'destructive' });
                    continue;
                }

                const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
                uploadedUrls.push(data.publicUrl);
            }

            if (uploadedUrls.length > 0) {
                onChange([...images, ...uploadedUrls]);
                toast({ title: `${uploadedUrls.length} imagen(es) subidas` });
            }
        } finally {
            setUploading(false);
        }
    };

    const remove = (url: string) => onChange(images.filter(u => u !== url));

    const makePrimary = (url: string) => {
        const others = images.filter(u => u !== url);
        onChange([url, ...others]);
    };

    return (
        <div>
            <Label className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" />
                Galería de imágenes ({images.length}/{MAX_IMAGES})
            </Label>

            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                {images.map((url, idx) => (
                    <div key={url} className="relative aspect-square rounded-lg border overflow-hidden group bg-muted">
                        <img src={url} alt={`imagen ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />

                        {idx === 0 && (
                            <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                Principal
                            </span>
                        )}

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {idx !== 0 && (
                                <button type="button" onClick={() => makePrimary(url)}
                                        className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white"
                                        title="Hacer principal">
                                    <Star className="h-3.5 w-3.5 text-amber-500" />
                                </button>
                            )}
                            <button type="button" onClick={() => remove(url)}
                                    className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white"
                                    title="Eliminar">
                                <X className="h-3.5 w-3.5 text-destructive" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Slot de upload */}
                {images.length < MAX_IMAGES && (
                    <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                        {uploading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <>
                                <Upload className="h-6 w-6 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground mt-1 text-center px-1">Subir imagen</span>
                            </>
                        )}
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={e => handleFiles(e.target.files)}
                            disabled={uploading}
                        />
                    </label>
                )}
            </div>

            <p className="text-xs text-muted-foreground mt-2">
                JPEG/PNG/WebP, máx 5MB c/u. La primera es la principal. (Captura con cámara y modelos 3D llegan en próxima versión.)
            </p>
        </div>
    );
}
