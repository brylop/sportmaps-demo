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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createStudentWithPendingPayment } from '@/hooks/useSchoolContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

interface ParsedStudent {
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  grade?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  monthly_fee: number;
}

export function CSVImportModal({ open, onClose, onSuccess, schoolId }: CSVImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const { toast } = useToast();

  const DEFAULT_FEE = 150000;

  const parseCSV = (text: string): ParsedStudent[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const students: ParsedStudent[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      students.push({
        full_name: row.full_name || row.nombre || '',
        email: row.email || '',
        phone: row.phone || row.telefono || '',
        date_of_birth: row.date_of_birth || row.fecha_nacimiento || '',
        gender: row.gender || row.genero || '',
        grade: row.grade || row.grado || '',
        parent_name: row.parent_name || row.nombre_acudiente || '',
        parent_email: row.parent_email || row.email_acudiente || '',
        parent_phone: row.parent_phone || row.telefono_acudiente || '',
        monthly_fee: parseInt(row.monthly_fee || row.mensualidad) || DEFAULT_FEE,
      });
    }

    return students.filter(s => s.full_name);
  };

  const handleFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor selecciona un archivo CSV',
        variant: 'destructive',
      });
      return;
    }

    // Parse CSV locally
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const students = parseCSV(text);
      setParsedStudents(students);
      if (students.length === 0) {
        toast({
          title: 'CSV vacío',
          description: 'No se encontraron estudiantes en el archivo',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(selectedFile);

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const handleUpload = async () => {
    if (parsedStudents.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress(5);

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < parsedStudents.length; i++) {
        const s = parsedStudents[i];
        setUploadProgress(Math.round(((i + 1) / parsedStudents.length) * 90));

        try {
          await createStudentWithPendingPayment({
            fullName: s.full_name,
            dateOfBirth: s.date_of_birth || undefined,
            parentEmail: s.parent_email || undefined,
            parentPhone: s.parent_phone || undefined,
            parentName: s.parent_name || undefined,
            schoolId,
            monthlyFee: s.monthly_fee,
            programName: s.grade || 'Importado CSV',
          });
          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push({ row: i + 2, error: err.message || 'Error desconocido' });
        }
      }

      setUploadProgress(100);
      setResult({ success: successCount, failed: failedCount, errors });

      if (successCount > 0) {
        toast({
          title: '¡Importación exitosa!',
          description: `${successCount} estudiante${successCount > 1 ? 's' : ''} importado${successCount > 1 ? 's' : ''} con pago pendiente`,
        });
        setTimeout(() => onSuccess(), 1500);
      }

      if (failedCount > 0) {
        toast({
          title: 'Algunas filas fallaron',
          description: `${failedCount} fila${failedCount > 1 ? 's' : ''} con errores`,
          variant: 'destructive',
        });
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error al procesar archivo',
        description: error.message || 'Por favor intenta de nuevo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setParsedStudents([]);
    setUploadProgress(0);
    setUploading(false);
    onClose();
  };

  const downloadTemplate = () => {
    const template = `full_name,email,phone,date_of_birth,gender,grade,parent_name,parent_email,parent_phone,monthly_fee
Juan Pérez García,juan.perez@email.com,3001234567,2012-05-15,male,6A,María García,maria.garcia@email.com,3009876543,150000
Ana Martínez López,ana.martinez@email.com,3102345678,2011-08-20,female,7B,Carlos Martínez,carlos.martinez@email.com,3108765432,180000
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
      description: 'Edita el archivo y súbelo para importar estudiantes (incluye columna monthly_fee)',
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
            Sube un archivo CSV con la lista de estudiantes. Se crearán con pago pendiente asociado a la escuela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <Alert>
            <Download className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                ¿Primera vez? Descarga la plantilla CSV (incluye columna <code>monthly_fee</code>)
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
                    {(file.size / 1024).toFixed(2)} KB — {parsedStudents.length} estudiantes detectados
                  </p>
                </div>
                {!uploading && !result && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFile(null); setParsedStudents([]); }}
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

          {/* Preview Table */}
          {parsedStudents.length > 0 && !uploading && !result && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Acudiente</TableHead>
                    <TableHead className="text-xs">Teléfono</TableHead>
                    <TableHead className="text-xs">Mensualidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStudents.slice(0, 5).map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-1">{s.full_name}</TableCell>
                      <TableCell className="text-xs py-1">{s.parent_name || '-'}</TableCell>
                      <TableCell className="text-xs py-1">{s.parent_phone || '-'}</TableCell>
                      <TableCell className="text-xs py-1 font-semibold">{formatCurrency(s.monthly_fee)}</TableCell>
                    </TableRow>
                  ))}
                  {parsedStudents.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-1">
                        ... y {parsedStudents.length - 5} más
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  Creando estudiantes y pagos pendientes...
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
                      Estudiantes importados con pago pendiente
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
                  <li><code>parent_name</code> - Nombre del padre/madre</li>
                  <li><code>parent_email</code> - Email del padre/madre</li>
                  <li><code>parent_phone</code> - Teléfono del padre/madre</li>
                  <li><code>monthly_fee</code> - <strong>Mensualidad en COP</strong> (ej: 150000)</li>
                  <li><code>date_of_birth</code> - Fecha de nacimiento (YYYY-MM-DD)</li>
                  <li><code>grade</code> - Grado o nivel (opcional)</li>
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
              disabled={parsedStudents.length === 0 || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {parsedStudents.length} Estudiante{parsedStudents.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
