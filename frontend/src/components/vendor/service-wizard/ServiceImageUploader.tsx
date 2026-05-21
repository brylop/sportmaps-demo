import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';

// Reusa el bucket de productos (ya configurado con politicas publicas)
// para no requerir una nueva migracion de storage.
const STORAGE_BUCKET = 'product-images';
const MAX_SIZE_MB    = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
    value:    string;
    onChange: (url: string) => void;
    vendorId?: string;
}

export function ServiceImageUploader({ value, onChange, vendorId }: Props) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast({ title: 'Formato no soportado', description: 'JPEG, PNG o WebP', variant: 'destructive' });
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast({ title: 'Imagen muy grande', description: `Maximo ${MAX_SIZE_MB} MB`, variant: 'destructive' });
            return;
        }

        setUploading(true);
        try {
            const namespace = vendorId || user?.id || 'anon';
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `${namespace}/services/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

            const { error: uploadErr } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(path, file, { upsert: false, contentType: file.type });

            if (uploadErr) {
                toast({ title: 'Error subiendo imagen', description: uploadErr.message, variant: 'destructive' });
                return;
            }

            const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            onChange(data.publicUrl);
        } finally {
            setUploading(false);
        }
    };

    if (value) {
        return (
            <div className="relative aspect-video w-full rounded-md overflow-hidden border bg-muted">
                <img src={value} alt="Portada del servicio" className="w-full h-full object-cover" />
                <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => onChange('')}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <label className="flex flex-col items-center justify-center aspect-video w-full rounded-md border-2 border-dashed cursor-pointer hover:bg-muted/50 transition-colors">
            <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {uploading ? (
                <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Subiendo...</span>
                </>
            ) : (
                <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">Subir imagen del servicio</span>
                    <span className="text-xs text-muted-foreground mt-1">JPEG, PNG o WebP · Max 5 MB</span>
                    <span className="text-xs text-muted-foreground">Recomendado: 1200x800px</span>
                </>
            )}
        </label>
    );
}
