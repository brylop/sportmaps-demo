import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface StudentCSVRow {
  name: string;
  parent: string;
  phone: string;
  monthlyFee: string;
  rowNumber: number;
  errors: string[];
  isValid: boolean;
}

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (students: StudentCSVRow[]) => void;
}

export function CSVImportModal({ open, onOpenChange, onImport }: CSVImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<StudentCSVRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [globalError, setGlobalError] = useState('');
  const { toast } = useToast();

  const validateRow = (row: Omit<StudentCSVRow, 'errors' | 'isValid'>, rowNumber: number): StudentCSVRow => {
    const errors: string[] = [];

    // Validate name
    if (!row.name || row.name.trim().length < 2) {
      errors.push('Nombre debe tener al menos 2 caracteres');
    } else if (row.name.length > 100) {
      errors.push('Nombre muy largo (máx 100 caracteres)');
    }

    // Validate parent
    if (!row.parent || row.parent.trim().length < 2) {
      errors.push('Nombre del acudiente es requerido');
    }

    // Validate phone
    const phoneDigits = row.phone.replace(/\D/g, '');
    if (!row.phone || phoneDigits.length < 7) {
      errors.push('Teléfono inválido (mín 7 dígitos)');
    } else if (phoneDigits.length > 15) {
      errors.push('Teléfono muy largo');
    }

    // Validate monthly fee
    const feeValue = parseInt(row.monthlyFee.replace(/\D/g, ''));
    if (!row.monthlyFee || isNaN(feeValue)) {
      errors.push('Mensualidad debe ser un número');
    } else if (feeValue <= 0) {
      errors.push('Mensualidad debe ser mayor a 0');
    } else if (feeValue > 10000000) {
      errors.push('Mensualidad parece incorrecta');
    }

    return {
      ...row,
      rowNumber,
      errors,
      isValid: errors.length === 0,
    };
  };

  const parseCSV = (text: string): StudentCSVRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('El archivo debe contener al menos una fila de datos');
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const nameIndex = headers.findIndex(h => h.includes('nombre') || h === 'name');
    const parentIndex = headers.findIndex(h => h.includes('padre') || h.includes('acudiente') || h === 'parent');
    const phoneIndex = headers.findIndex(h => h.includes('telefono') || h.includes('teléfono') || h === 'phone');
    const feeIndex = headers.findIndex(h => h.includes('mensualidad') || h.includes('fee') || h.includes('monto'));

    if (nameIndex === -1 || parentIndex === -1 || phoneIndex === -1 || feeIndex === -1) {
      throw new Error('El CSV debe contener columnas: Nombre, Padre/Acudiente, Teléfono, Mensualidad');
    }

    const students: StudentCSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length >= 4 || values.some(v => v.length > 0)) {
        const rawRow = {
          name: values[nameIndex] || '',
          parent: values[parentIndex] || '',
          phone: values[phoneIndex] || '',
          monthlyFee: values[feeIndex] || '',
          rowNumber: i + 1,
        };
        students.push(validateRow(rawRow, i + 1));
      }
    }

    return students;
  };

  const handleFile = useCallback((file: File) => {
    setGlobalError('');
    setFileName(file.name);

    if (!file.name.endsWith('.csv')) {
      setGlobalError('Por favor selecciona un archivo CSV');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        setParsedData(data);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Error al procesar el archivo');
        setParsedData([]);
      }
    };
    reader.readAsText(file);
  }, []);

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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const validRows = parsedData.filter(r => r.isValid);
  const invalidRows = parsedData.filter(r => !r.isValid);

  const handleImport = () => {
    if (validRows.length === 0) {
      toast({
        title: 'No hay filas válidas',
        description: 'Corrige los errores en el archivo CSV antes de importar',
        variant: 'destructive',
      });
      return;
    }
    
    onImport(validRows);
    toast({
      title: 'Importación exitosa',
      description: `Se importaron ${validRows.length} estudiantes${invalidRows.length > 0 ? `. ${invalidRows.length} filas con errores fueron omitidas.` : ''}`,
    });
    
    // Reset state and close
    setParsedData([]);
    setFileName('');
    setGlobalError('');
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setParsedData([]);
      setFileName('');
      setGlobalError('');
    }
    onOpenChange(open);
  };

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/\D/g, ''));
    if (isNaN(num)) return value;
    return `$${num.toLocaleString('es-CO')}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Estudiantes desde CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}
              ${parsedData.length > 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-500' : ''}
            `}
          >
            {parsedData.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-medium">{fileName}</p>
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-green-500">
                    {validRows.length} válidos
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="destructive">
                      {invalidRows.length} con errores
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-1">Arrastra tu archivo CSV aquí</p>
                <p className="text-sm text-muted-foreground mb-4">o haz clic para seleccionar</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="csv-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    Seleccionar archivo
                  </label>
                </Button>
              </>
            )}
          </div>

          {/* Global Error Message */}
          {globalError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{globalError}</span>
            </div>
          )}

          {/* CSV Format Help */}
          {parsedData.length === 0 && !globalError && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Formato esperado del CSV:</p>
              <code className="text-xs bg-muted p-2 rounded block">
                Nombre,Padre,Teléfono,Mensualidad<br />
                Juan Pérez,Carlos Pérez,+57 300 123 4567,150000<br />
                María García,Ana García,+57 310 234 5678,150000
              </code>
            </div>
          )}

          {/* Preview Table with Validation Status */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Fila</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Padre/Acudiente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Mensualidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 15).map((row) => (
                    <TableRow key={row.rowNumber} className={!row.isValid ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive max-w-[150px] truncate" title={row.errors.join(', ')}>
                              {row.errors[0]}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${!row.name ? 'text-destructive' : ''}`}>
                        {row.name || '—'}
                      </TableCell>
                      <TableCell className={!row.parent ? 'text-destructive' : ''}>
                        {row.parent || '—'}
                      </TableCell>
                      <TableCell>{row.phone || '—'}</TableCell>
                      <TableCell>{formatCurrency(row.monthlyFee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 15 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted/50">
                  ... y {parsedData.length - 15} filas más
                </div>
              )}
            </div>
          )}

          {/* Error Summary */}
          {invalidRows.length > 0 && (
            <div className="bg-destructive/10 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">
                ⚠️ {invalidRows.length} fila{invalidRows.length > 1 ? 's' : ''} con errores (serán omitidas):
              </p>
              <ul className="text-xs text-destructive space-y-1 max-h-32 overflow-y-auto">
                {invalidRows.slice(0, 10).map((row) => (
                  <li key={row.rowNumber}>
                    <strong>Fila {row.rowNumber}:</strong> {row.errors.join(', ')}
                  </li>
                ))}
                {invalidRows.length > 10 && (
                  <li className="text-muted-foreground">... y {invalidRows.length - 10} errores más</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validRows.length === 0}
          >
            Importar {validRows.length > 0 && `(${validRows.length} válidos)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
