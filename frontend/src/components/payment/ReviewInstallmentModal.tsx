import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { getSignedReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Calendar, DollarSign, Info, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ReviewInstallmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: any;
  onSuccess: () => void;
}

export function ReviewInstallmentModal({
  open,
  onOpenChange,
  installment,
  onSuccess
}: ReviewInstallmentModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const { toast } = useToast();

  // Generate signed URL when modal opens with a receipt
  useEffect(() => {
    if (open && installment?.receipt_url) {
      setLoadingImage(true);
      getSignedReceiptUrl(installment.receipt_url)
        .then(url => setSignedUrl(url))
        .catch(() => setSignedUrl(null))
        .finally(() => setLoadingImage(false));
    } else {
      setSignedUrl(null);
    }
  }, [open, installment?.receipt_url]);

  if (!installment) return null;

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      toast({ title: 'Razón necesaria', description: 'Por favor indica por qué rechazas el abono.', variant: 'destructive' });
      return;
    }

    if (processing) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('review_payment_installment' as any, {
        p_installment_id: installment.id,
        p_status: action === 'approve' ? 'approved' : 'rejected',
        p_rejection_reason: action === 'reject' ? rejectionReason : null,
        p_reviewed_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;

      toast({
        title: action === 'approve' ? 'Abono Aprobado' : 'Abono Rechazado',
        description: `La transacción ha sido ${action === 'approve' ? 'aplicada al saldo' : 'rechazada'}.`,
        variant: action === 'approve' ? 'default' : 'destructive',
      });

      // ─── Enviar Notificación Push al Padre ──────────────────────────────────────
      try {
        const { data: subs } = await supabase
          .from('push_subscriptions' as any)
          .select('endpoint, p256dh, auth')
          .eq('user_id', installment.parent_id);

        if (subs && subs.length > 0) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              subscriptions: subs,
              payload: {
                title: action === 'approve' ? '✅ Abono aprobado' : '❌ Abono rechazado',
                body:  action === 'approve' 
                  ? `Tu abono de ${formatCurrency(installment.amount)} fue aprobado.` 
                  : `Tu abono fue rechazado: ${rejectionReason}`,
                url:  '/my-payments',
                type: action === 'approve' ? 'installment_approved' : 'installment_rejected'
              }
            }
          });
        }
      } catch (pushErr) {
        console.error('Error enviando push notification:', pushErr);
      }
      // ─────────────────────────────────────────────────────────────────────────────

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const amountMismatch = installment.orc_amount && parseFloat(installment.amount) !== parseFloat(installment.orc_amount);
  const dateMismatch = installment.orc_receipt_date && installment.receipt_date !== installment.orc_receipt_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar Abono</DialogTitle>
          <DialogDescription>
            Compara los datos declarados por el padre con los detectados por la IA.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Lado Izquierdo: Datos y Comparación */}
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Información del Pago
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">Padre:</span>
                <span className="font-medium">{installment.parent_name || 'Desconocido'}</span>
                <span className="text-muted-foreground">Concepto:</span>
                <span className="font-medium line-clamp-1">{installment.payment_concept || installment.payment?.concept}</span>
              </div>
            </div>

            <div className={`p-4 rounded-lg border space-y-3 ${amountMismatch ? 'border-amber-200 bg-amber-50/30' : 'border-green-200 bg-green-50/30'}`}>
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <DollarSign className={`h-4 w-4 ${amountMismatch ? 'text-amber-600' : 'text-green-600'}`} /> Monto
                </h4>
                {amountMismatch && <Badge variant="outline" className="text-[10px] bg-amber-100 border-amber-200 text-amber-700">Discrepancia</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-[11px] text-muted-foreground uppercase">Declarado</div>
                <div className="text-[11px] text-muted-foreground uppercase">IA (Claude)</div>
                <div className="text-lg font-bold">{formatCurrency(installment.amount)}</div>
                <div className={`text-lg font-bold ${amountMismatch ? 'text-amber-600' : 'text-green-600'}`}>
                  {installment.orc_amount ? formatCurrency(installment.orc_amount) : 'No detectado'}
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg border space-y-3 ${dateMismatch ? 'border-amber-200 bg-amber-50/30' : 'border-green-200 bg-green-50/30'}`}>
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Calendar className={`h-4 w-4 ${dateMismatch ? 'text-amber-600' : 'text-green-600'}`} /> Fecha de Pago
                </h4>
                {dateMismatch && <Badge variant="outline" className="text-[10px] bg-amber-100 border-amber-200 text-amber-700">Discrepancia</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-[11px] text-muted-foreground uppercase">Declarado</div>
                <div className="text-[11px] text-muted-foreground uppercase">IA (Claude)</div>
                <div className="font-semibold">{installment.receipt_date}</div>
                <div className={`font-semibold ${dateMismatch ? 'text-amber-600' : 'text-green-600'}`}>
                  {installment.orc_receipt_date || 'No detectada'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notas del Padre</Label>
              <p className="text-sm border p-2 rounded bg-slate-50 italic">
                {installment.notes || 'Sin notas adicionales.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rejection" className="text-sm font-semibold">Razón del Rechazo (Solo si aplica)</Label>
              <Textarea
                id="rejection"
                placeholder="Ej: El comprobante no es legible o el monto no coincide."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Lado Derecho: Comprobante */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4" /> Comprobante Adjunto
            </Label>
            <div className="border rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center min-h-[400px]">
              {loadingImage ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : signedUrl ? (
                <img 
                  src={signedUrl} 
                  alt="Comprobante de pago" 
                  className="max-w-full object-contain shadow-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No se pudo cargar el comprobante</p>
              )}
            </div>
            {signedUrl && (
              <Button variant="link" className="p-0 text-xs h-auto" onClick={() => window.open(signedUrl, '_blank')}>
                Ver en pantalla completa
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => handleAction('reject')}
            disabled={processing}
          >
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Rechazar Abono
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleAction('approve')}
            disabled={processing}
          >
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Aprobar y Aplicar a Saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
