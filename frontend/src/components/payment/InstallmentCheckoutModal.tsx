import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileUpload } from '@/components/common/FileUpload';
import { Loader2, CheckCircle2, AlertCircle, Calendar as CalendarIcon, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface InstallmentCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  schoolId: string;
  parentId: string;
  balancePending: number;
  onSuccess?: () => void;
}

export function InstallmentCheckoutModal({
  open,
  onOpenChange,
  paymentId,
  schoolId,
  parentId,
  balancePending,
  onSuccess
}: InstallmentCheckoutModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrData, setOcrData] = useState<{ date: string | null; amount: number | null } | null>(null);
  const { toast } = useToast();

  const handleUploadComplete = async (url: string) => {
    setReceiptUrl(url);
    analyzeWithOCR(url);
  };

  const analyzeWithOCR = async (url: string) => {
    setAnalyzing(true);
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('payment-receipts')
        .download(url.split('/').pop() || '');

      if (downloadError) throw downloadError;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
      });
      reader.readAsDataURL(fileData);
      const base64 = await base64Promise;

      const { data, error } = await supabase.functions.invoke('analyze-receipt', {
        body: { imageBase64: base64, mimeType: fileData.type }
      });

      if (error) throw error;

      if (data) {
        setOcrData({
          date: data.orc_date,
          amount: data.orc_amount
        });
        
        if (data.orc_amount) setAmount(data.orc_amount.toString());
        if (data.orc_date) setReceiptDate(data.orc_date);
      }
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptUrl) {
      toast({ title: 'Falta comprobante', description: 'Por favor sube una imagen de tu pago.', variant: 'destructive' });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un valor válido para el abono.', variant: 'destructive' });
      return;
    }

    if (processing) return;
    setProcessing(true);
    try {
      // 1. Cargar settings de la escuela
      const { data: settings } = await supabase
        .from('school_settings' as any)
        .select('allow_installments, max_installments_per_payment, min_installment_amount, installment_require_proof')
        .eq('school_id', schoolId)
        .single();

      if (settings) {
        if (!settings.allow_installments) {
          throw new Error('La escuela no permite abonos en este momento.');
        }

        if (numAmount < settings.min_installment_amount) {
          throw new Error(`El monto mínimo por abono es ${formatCurrency(settings.min_installment_amount)}.`);
        }

        const { count } = await supabase
          .from('payment_installments' as any)
          .select('*', { count: 'exact', head: true })
          .eq('payment_id', paymentId)
          .neq('status', 'rejected');

        if (count && count >= settings.max_installments_per_payment) {
          throw new Error(`Este pago ya alcanzó el máximo de ${settings.max_installments_per_payment} abonos.`);
        }

        if (settings.installment_require_proof && !receiptUrl) {
          throw new Error('Debes subir el comprobante de pago para registrar el abono.');
        }
      }

      const { error } = await (supabase.from('payment_installments' as any)).insert({
        payment_id: paymentId,
        school_id: schoolId,
        parent_id: parentId,
        amount: numAmount,
        receipt_url: receiptUrl,
        receipt_date: receiptDate,
        notes: notes,
        orc_amount: ocrData?.amount,
        orc_receipt_date: ocrData?.date,
        status: 'pending_review'
      });

      if (error) throw error;

      toast({
        title: '¡Abono registrado!',
        description: 'Tu pago está en revisión por parte de la escuela.',
      });

      // Enviar Notificación Push a la Escuela
      try {
        const { data: subs } = await supabase
          .from('push_subscriptions' as any)
          .select('endpoint, p256dh, auth')
          .eq('school_id', schoolId);

        if (subs && subs.length > 0) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              subscriptions: subs,
              payload: {
                title: 'Nuevo abono recibido',
                body:  `Se ha registrado un nuevo abono de ${formatCurrency(numAmount)} para revisión.`,
                url:   '/payments-automation',
                type:  'installment_received'
              }
            }
          });
        }
      } catch (pushErr) {
        console.error('Error enviando push notification:', pushErr);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const isAmountMatch = ocrData?.amount === parseFloat(amount);
  const isDateMatch = ocrData?.date === receiptDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Abono</DialogTitle>
          <DialogDescription>
            Sube tu comprobante de pago parcial. El saldo pendiente es {formatCurrency(balancePending)}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Comprobante de Pago*</Label>
            <FileUpload 
              bucket="payment-receipts" 
              onUploadComplete={handleUploadComplete}
              accept="image/*"
            />
            {analyzing && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Analizando comprobante con IA...
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto del Abono*</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={ocrData?.amount && isAmountMatch ? "border-green-500 pr-8" : ""}
                  required
                />
                <DollarSign className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              {ocrData?.amount && (
                <p className={`text-[10px] flex items-center gap-1 ${isAmountMatch ? "text-green-600" : "text-amber-600"}`}>
                  {isAmountMatch ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  IA detectó: {formatCurrency(ocrData.amount)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt_date">Fecha del Pago*</Label>
              <div className="relative">
                <Input
                  id="receipt_date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className={ocrData?.date && isDateMatch ? "border-green-500" : ""}
                  required
                />
              </div>
              {ocrData?.date && (
                <p className={`text-[10px] flex items-center gap-1 ${isDateMatch ? "text-green-600" : "text-amber-600"}`}>
                  {isDateMatch ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  IA detectó: {ocrData.date}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (Opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: Pago de la primera quincena"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {!isAmountMatch && !!amount && ocrData?.amount && (
            <Alert className="bg-amber-50 border-amber-200 py-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-[11px]">
                El monto ingresado no coincide con lo detectado por la IA. Verifica antes de enviar.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button type="submit" disabled={processing || !receiptUrl}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar Abono
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
