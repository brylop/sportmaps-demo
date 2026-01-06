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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentCSVRow {
  name: string;
  parent: string;
  phone: string;
  monthlyFee: string;
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
  const [error, setError] = useState('');
  const { toast } = useToast();

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
      if (values.length >= 4 && values[nameIndex]) {
        students.push({
          name: values[nameIndex],
          parent: values[parentIndex],
          phone: values[phoneIndex],
          monthlyFee: values[feeIndex],
        });
      }
    }

    return students;
  };

  const handleFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);

    if (!file.name.endsWith('.csv')) {
      setError('Por favor selecciona un archivo CSV');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        setParsedData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
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

  const handleImport = () => {
    if (parsedData.length === 0) return;
    
    onImport(parsedData);
    toast({
      title: 'Importación exitosa',
      description: `Se importaron ${parsedData.length} estudiantes correctamente`,
    });
    
    // Reset state and close
    setParsedData([]);
    setFileName('');
    setError('');
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setParsedData([]);
      setFileName('');
      setError('');
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
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
                <p className="text-sm text-muted-foreground">
                  {parsedData.length} estudiantes listos para importar
                </p>
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

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* CSV Format Help */}
          {parsedData.length === 0 && !error && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Formato esperado del CSV:</p>
              <code className="text-xs bg-muted p-2 rounded block">
                Nombre,Padre,Teléfono,Mensualidad<br />
                Juan Pérez,Carlos Pérez,+57 300 123 4567,150000<br />
                María García,Ana García,+57 310 234 5678,150000
              </code>
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Padre/Acudiente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Mensualidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.parent}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{formatCurrency(row.monthlyFee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 10 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted/50">
                  ... y {parsedData.length - 10} estudiantes más
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedData.length === 0}
          >
            Importar {parsedData.length > 0 && `(${parsedData.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
