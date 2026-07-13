import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload, X, File as FileIcon, Loader2,
  CheckCircle2, AlertTriangle, ShieldCheck,
  Calendar, Hash, DollarSign, ScanLine,
} from 'lucide-react';
import { useStorage, BucketName } from '@/hooks/useStorage';
import { useReceiptValidator, ReceiptValidationResult, ConceptKind } from '@/hooks/useReceiptValidator';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  bucket: BucketName;
  path?: string;
  accept?: string;
  maxSizeMB?: number;
  onUploadComplete?: (url: string) => void;
  multiple?: boolean;
  validateReceipt?: boolean;
  onValidationResult?: (result: ReceiptValidationResult) => void;
  /** Monto esperado (del plan/payment) para validar contra el OCR. Solo aplica si conceptKind='fixed'. */
  expectedAmount?: number;
  /** 'fixed' = bloquea por monto y fecha (mensualidad/inscripcion fija).
   *  'lenient' = solo bloquea por fecha distinta a hoy (default). */
  conceptKind?: ConceptKind;
  /** Si la escuela permite abonos. Si es false, el OCR bloquea comprobantes
   *  por menos del esperado (conceptKind='fixed'). Default: false. */
  allowPartial?: boolean;
  /** Monto mínimo por abono (solo si allowPartial=true). */
  minPartialAmount?: number;
}

export function FileUpload({
  bucket,
  path,
  accept = '*/*',
  maxSizeMB = 5,
  onUploadComplete,
  multiple = false,
  validateReceipt = false,
  onValidationResult,
  expectedAmount,
  conceptKind = 'lenient',
  allowPartial = false,
  minPartialAmount,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validation, setValidation] = useState<ReceiptValidationResult | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  // FIX: guardar la URL ya subida para no volver a subir
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const { uploadFile, uploading } = useStorage();
  const { validate, validating } = useReceiptValidator();

  const reset = () => {
    setSelectedFiles([]);
    setValidation(null);
    setOcrProgress(0);
    setUploaded(false);
    setUploadedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setValidation(null);
    setOcrProgress(0);
    setUploaded(false);
    setUploadedUrl(null);

    const validSized = files.filter(file => file.size / (1024 * 1024) <= maxSizeMB);
    const toUse = multiple ? validSized : validSized.slice(0, 1);
    setSelectedFiles(toUse);

    if (!validateReceipt) {
      // Sin validacion: subir directo al seleccionar
      for (const file of toUse) {
        const url = await uploadFile(file, bucket, path);
        // FIX: verificar que url no sea null antes de llamar onUploadComplete
        if (url != null) {
          setUploadedUrl(url);
          setUploaded(true);
          onUploadComplete?.(url);
        }
      }
      return;
    }

    if (toUse.length === 0) return;

    // Con validacion: primero OCR, luego subir solo si pasa
    setOcrProgress(10);
    const progressInterval = setInterval(() => {
      // FIX: renombrado a 'prev' para evitar confusion con variable 'p' externa
      setOcrProgress(prev => (prev < 85 ? prev + 5 : prev));
    }, 300);

    try {
      let result: ReceiptValidationResult;
      try {
        result = await validate(toUse[0], { expectedAmount, conceptKind, allowPartial, minPartialAmount });
      } catch (ocrErr) {
        // OCR NO disponible (BFF 502/caído/cold-start). NO bloquear: subir el
        // comprobante igual y que la escuela lo valide visualmente. El OCR es
        // advisory, no un requisito para registrar el pago.
        console.warn('[OCR] no disponible; se sube el comprobante sin validación automática:', ocrErr);
        result = {
          valid: true,
          extractedDate: null,
          extractedAmount: null,
          extractedReference: null,
          extractedBank: null,
          extractedCurrency: null,
          rejectionReason: null,
        };
      }
      setOcrProgress(100);
      setValidation(result);
      onValidationResult?.(result);

      // Bloqueo SOLO cuando el OCR detecto conflicto duro: fecha distinta a hoy
      // (siempre) o monto distinto al esperado (solo en concept FIXED).
      // Si el OCR no detecto fecha/monto (o no estaba disponible), se sube y el
      // admin valida visualmente.
      if (!result.valid) {
        return;
      }

      if (!uploaded && uploadedUrl == null) {
        const url = await uploadFile(toUse[0], bucket, path);
        if (url != null) {
          setUploadedUrl(url);
          setUploaded(true);
          onUploadComplete?.(url);
        }
      } else if (uploadedUrl != null) {
        onUploadComplete?.(uploadedUrl);
      }
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setOcrProgress(0), 800);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setValidation(null);
    setUploaded(false);
    setUploadedUrl(null);
    onValidationResult?.({
      valid: false,
      extractedDate: null,
      extractedAmount: null,
      extractedReference: null,
      extractedBank: null,
      extractedCurrency: null,
      rejectionReason: null,
    });
  };

  const busy = uploading || validating;

  return (
    <div className="space-y-3">

      {/* Selector */}
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
          disabled={busy}
          className="flex-1"
        >
          {validating ? (
            <>
              <ScanLine className="w-4 h-4 mr-2 animate-pulse" />
              Leyendo comprobante...
            </>
          ) : uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Subiendo archivo...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {uploaded ? 'Cambiar archivo' : 'Seleccionar archivo'}
            </>
          )}
        </Button>
      </div>

      {/* Barra de progreso OCR */}
      {validating && ocrProgress > 0 && (
        <div className="space-y-1">
          <Progress value={ocrProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-center">
            Analizando comprobante... {ocrProgress}%
          </p>
        </div>
      )}

      {/* Archivos seleccionados */}
      {selectedFiles.length > 0 && !uploaded && (
        <div className="space-y-2">
          {selectedFiles.map((file, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(i)}
                  disabled={busy}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resultado de validacion */}
      {validation && !validating && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-300">

          {/* Bloqueo duro: concept fixed con monto/fecha en conflicto -> NO sube */}
          {!validation.valid && (
            <Alert className="border-red-300 bg-red-50 dark:bg-red-950/30">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription>
                <p className="font-semibold text-red-700 dark:text-red-400 mb-1">
                  Comprobante no valido
                </p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {validation.rejectionReason || 'No pudimos verificar el comprobante.'}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Aprobado */}
          {validation.valid && (
            <Alert className="border-green-300 bg-green-50 dark:bg-green-950/30">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <p className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Comprobante cargado ✓ — falta confirmar abajo
                </p>
                <div className="space-y-1.5">

                  {validation.extractedDate && (
                    <div className="flex items-center gap-2 text-xs text-green-800 dark:text-green-300">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span><strong>Fecha:</strong> {validation.extractedDate}</span>
                      <Badge className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100 text-[10px] h-4 px-1">
                        Hoy
                      </Badge>
                    </div>
                  )}

                  {validation.extractedAmount != null ? (
                    <div className="flex items-center gap-2 text-xs text-green-800 dark:text-green-300">
                      <DollarSign className="h-3 w-3 shrink-0" />
                      <span><strong>Monto:</strong> {new Intl.NumberFormat('es-CO', { style: 'currency', currency: validation.extractedCurrency || 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validation.extractedAmount)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <DollarSign className="h-3 w-3 shrink-0" />
                      <span>Monto no detectado</span>
                    </div>
                  )}

                  {validation.extractedReference ? (
                    <div className="flex items-center gap-2 text-xs text-green-800 dark:text-green-300">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span><strong>Referencia:</strong> {validation.extractedReference}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span>Numero de operacion no detectado</span>
                    </div>
                  )}

                  {/* Aviso de pago parcial: el comprobante es por menos del valor esperado */}
                  {expectedAmount != null && expectedAmount > 0 &&
                   validation.extractedAmount != null && validation.extractedAmount < expectedAmount && (
                    <div className="mt-1 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Pago parcial (abono).</strong> Detectamos {new Intl.NumberFormat('es-CO', { style: 'currency', currency: validation.extractedCurrency || 'COP', maximumFractionDigits: 0 }).format(validation.extractedAmount)} de {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(expectedAmount)}. Se registrará como abono; saldo pendiente {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(expectedAmount - validation.extractedAmount)}.
                      </span>
                    </div>
                  )}

                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tamano maximo: {maxSizeMB}MB - Formatos: imagenes (JPG/PNG) o PDF
      </p>
    </div>
  );
}