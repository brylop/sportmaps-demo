import { useState, useRef, useCallback } from 'react';
import { useStorage, BucketName } from '@/hooks/useStorage';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
  bucket?: BucketName;
  path?: string;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  compact?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  bucket = 'school-assets',
  path,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeMB = 5,
  className,
  compact = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading } = useStorage();
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const preview = localPreview || value;

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    if (file.size > maxSizeMB * 1024 * 1024) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setLocalPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const url = await uploadFile(file, bucket, path);
    if (url) {
      onChange(url);
      setLocalPreview(null);
    } else {
      setLocalPreview(null);
    }
  }, [bucket, path, maxSizeMB, onChange, uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = () => {
    setLocalPreview(null);
    onRemove?.();
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {preview ? (
          <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-border/50 bg-muted shrink-0">
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-16 w-16 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-all shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        )}
        <div className="text-xs text-muted-foreground">
          <p className="font-medium">Clic o arrastra una imagen</p>
          <p>JPG, PNG o WebP. Max {maxSizeMB}MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden',
          dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5',
          preview ? 'border-solid border-border/50' : '',
        )}
      >
        {preview ? (
          <div className="relative aspect-video max-h-48">
            <img
              src={preview}
              alt="Preview"
              className="h-full w-full object-cover rounded-lg"
            />
            {uploading && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Subiendo...</span>
                </div>
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-7 w-7 rounded-lg shadow-md bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-7 w-7 rounded-lg shadow-md"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-3 py-8 px-4 w-full cursor-pointer"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <ImagePlus className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {uploading ? 'Subiendo imagen...' : 'Haz clic o arrastra una imagen'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG o WebP. Maximo {maxSizeMB}MB
              </p>
            </div>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
