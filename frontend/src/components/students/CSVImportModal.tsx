import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { studentsAPI } from '@/lib/api/students';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

export function CSVImportModal({ open, onClose, onSuccess, schoolId }: CSVImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor selecciona un archivo CSV',
        variant: 'destructive',
      });
      return;
    }
    setFile(selectedFile);
    setResult(null);
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(10);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await studentsAPI.bulkUpload(file, schoolId);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setResult({
        success: response.success,
        failed: response.failed,
        errors: response.errors,
      });

      if (response.success > 0) {
        toast({
          title: '¡Importación exitosa!',
          description: `${response.success} estudiante${response.success > 1 ? 's' : ''} importado${response.success > 1 ? 's' : ''} correctamente`,
        });

        // Wait a bit before calling onSuccess
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }

      if (response.failed > 0) {
        toast({
          title: 'Algunas filas fallaron',
          description: `${response.failed} fila${response.failed > 1 ? 's' : ''} con errores`,
          variant: 'destructive',
        });
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error al subir archivo',
        description: error.message || 'Por favor intenta de nuevo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    // Allow closing even if uploading to prevent trapped users
    setFile(null);
    setResult(null);
    setUploadProgress(0);
    setUploading(false); // Force reset
    onClose();
  };

  const downloadTemplate = () => {
    const template = `full_name,email,phone,date_of_birth,gender,grade,parent_name,parent_email,parent_phone
Juan Pérez García,juan.perez@email.com,3001234567,2012-05-15,male,6A,María García,maria.garcia@email.com,3009876543
Ana Martínez López,ana.martinez@email.com,3102345678,2011-08-20,female,7B,Carlos Martínez,carlos.martinez@email.com,3108765432
`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_estudiantes.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Plantilla descargada',
      description: 'Edita el archivo y súbelo para importar estudiantes',
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Estudiantes desde CSV
          </DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con la lista de estudiantes para importarlos masivamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <Alert>
            <Download className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                ¿Primera vez? Descarga la plantilla CSV para empezar
              </span>
              <Button variant="link" size="sm" onClick={downloadTemplate} className="h-auto p-0">
                Descargar plantilla
              </Button>
            </AlertDescription>
          </Alert>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}
              ${file ? 'bg-green-50 dark:bg-green-950/20 border-green-500' : ''}
            `}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <div>
                  <p className="font-medium text-lg">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                {!uploading && !result && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    Cambiar archivo
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium text-lg mb-2">Arrastra tu archivo CSV aquí</p>
                <p className="text-sm text-muted-foreground mb-4">
                  o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="csv-upload"
                  disabled={uploading}
                />
                <Button variant="outline" asChild>
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    Seleccionar archivo CSV
                  </label>
                </Button>
              </>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  Subiendo y procesando estudiantes...
                </span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {uploadProgress}% completado
              </p>
            </div>
          )}

          {/* Results */}
          {result && !uploading && (
            <div className="space-y-3">
              <div className="flex gap-3">
                {result.success > 0 && (
                  <div className="flex-1 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900 dark:text-green-100">
                        {result.success} exitosos
                      </span>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Estudiantes importados correctamente
                    </p>
                  </div>
                )}

                {result.failed > 0 && (
                  <div className="flex-1 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-900 dark:text-red-100">
                        {result.failed} fallidos
                      </span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Filas con errores
                    </p>
                  </div>
                )}
              </div>

              {/* Error Details */}
              {result.errors.length > 0 && (
                <div className="bg-destructive/10 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Errores encontrados:
                  </p>
                  <ul className="text-xs text-destructive space-y-1">
                    {result.errors.slice(0, 10).map((err, index) => (
                      <li key={index}>
                        <strong>Fila {err.row}:</strong> {err.error}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-muted-foreground">
                        ... y {result.errors.length - 10} errores más
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* CSV Format Help */}
          {!file && !uploading && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">📋 Formato esperado del CSV:</p>
              <div className="text-xs space-y-2">
                <p><strong>Columnas requeridas:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li><code>full_name</code> - Nombre completo del estudiante (requerido)</li>
                  <li><code>email</code> - Email del estudiante (opcional)</li>
                  <li><code>phone</code> - Teléfono (opcional)</li>
                  <li><code>date_of_birth</code> - Fecha de nacimiento (YYYY-MM-DD)</li>
                  <li><code>gender</code> - male, female, other (opcional)</li>
                  <li><code>grade</code> - Grado o nivel (opcional)</li>
                  <li><code>parent_name</code> - Nombre del padre/madre</li>
                  <li><code>parent_email</code> - Email del padre/madre</li>
                  <li><code>parent_phone</code> - Teléfono del padre/madre</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir y Procesar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
