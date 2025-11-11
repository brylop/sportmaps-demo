import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, File as FileIcon } from 'lucide-react';
import { useStorage, BucketName } from '@/hooks/useStorage';
import { Card } from '@/components/ui/card';

interface FileUploadProps {
  bucket: BucketName;
  path?: string;
  accept?: string;
  maxSizeMB?: number;
  onUploadComplete?: (url: string) => void;
  multiple?: boolean;
}

export function FileUpload({
  bucket,
  path,
  accept = '*/*',
  maxSizeMB = 5,
  onUploadComplete,
  multiple = false
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { uploadFile, uploading } = useStorage();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file sizes
    const validFiles = files.filter(file => {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return false;
      }
      return true;
    });

    setSelectedFiles(multiple ? validFiles : validFiles.slice(0, 1));
  };

  const handleUpload = async () => {
    for (const file of selectedFiles) {
      const url = await uploadFile(file, bucket, path);
      if (url && onUploadComplete) {
        onUploadComplete(url);
      }
    }
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Seleccionar Archivo{multiple ? 's' : ''}
        </Button>
        
        {selectedFiles.length > 0 && (
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Subiendo...' : `Subir (${selectedFiles.length})`}
          </Button>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tamaño máximo: {maxSizeMB}MB
      </p>
    </div>
  );
}
