/**
 * RejectReceiptDialog — rechazar un COMPROBANTE con motivo obligatorio.
 *
 * Lo que se rechaza es el comprobante, no el cobro: `reject_payment_receipt`
 * devuelve el cobro a pendiente/vencido (la deuda sigue en la cartera y en la
 * mora), guarda el motivo y le avisa a la familia in-app; si el comprobante
 * entró por WhatsApp, el job de desenlace le escribe el motivo por el chat.
 *
 * Antes «Rechazar» ponía el propio cobro en 'rejected' sin motivo: la deuda
 * desaparecía y la familia leía «no pudo ser validado. Contáctanos» (2026-10-08).
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { REJECT_REASONS, rejectReasonError, rejectErrorMessage, type RejectReasonCode } from '@/lib/receiptReview';

interface Props {
  payment: { id: string; amount: number; concept?: string | null; athlete_name?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RejectReceiptDialog({ payment, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [code, setCode] = useState<RejectReasonCode | null>(null);
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setCode(null); setDetail(''); }
  }, [open, payment?.id]);

  const validation = rejectReasonError(code, detail);

  const handleReject = async () => {
    if (!payment || validation) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc('reject_payment_receipt', {
        p_payment_id: payment.id,
        p_reason_code: code,
        p_reason_text: detail.trim() || null,
      });
      if (error) {
        toast({ title: 'No se rechazó', description: rejectErrorMessage(error), variant: 'destructive' });
        if (String(error.message ?? '').includes('PAYMENT_NOT_IN_REVIEW')) { onSuccess?.(); onOpenChange(false); }
        return;
      }
      toast({
        title: 'Comprobante rechazado',
        description: 'El cobro sigue pendiente y la familia recibió el motivo.',
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ title: 'No se rechazó', description: rejectErrorMessage(e as { message?: string }), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar comprobante</DialogTitle>
          <DialogDescription>
            {payment ? (
              <>
                {payment.athlete_name ? <strong>{payment.athlete_name}</strong> : 'Este cobro'} · {payment.concept ?? 'Cobro'} · {formatCurrency(payment.amount)}.{' '}
              </>
            ) : null}
            El cobro <strong>sigue pendiente</strong>: solo se rechaza el comprobante. La familia recibe el motivo para corregirlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Motivo del rechazo">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  role="radio"
                  aria-checked={code === r.code}
                  onClick={() => setCode(r.code)}
                  className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                    code === r.code
                      ? 'border-red-400 bg-red-50 text-red-800 ring-2 ring-red-200 dark:bg-red-950/40 dark:text-red-200'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reject-detail">
              {code === 'OTRO' ? 'Escribe el motivo (obligatorio)' : 'Detalle para la familia (opcional)'}
            </Label>
            <Textarea
              id="reject-detail"
              value={detail}
              maxLength={300}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Ej.: el valor es $150.000 y la mensualidad es $180.000; envía el comprobante del saldo."
              rows={3}
            />
          </div>

          {code && validation && <p className="text-xs text-red-600">{validation}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={saving || !!validation}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Rechazar comprobante
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
