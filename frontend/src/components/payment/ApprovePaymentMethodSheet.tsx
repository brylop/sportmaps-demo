import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CheckCircle2, Loader2, AlertTriangle, ScanLine } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';

interface ApprovePaymentMethodSheetProps {
  payment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Confirmación de aprobación de un cobro pendiente.
 * - Muestra el monto esperado y, si hay OCR del comprobante, el monto detectado
 *   con alerta de discrepancia.
 * - Permite aprobar COMPLETO (paid) o registrar un ABONO parcial (partial):
 *   acredita solo lo pagado (amount_paid) y deja saldo pendiente; notifica al
 *   padre el abono y el saldo.
 */
export function ApprovePaymentMethodSheet({ payment, open, onOpenChange, onSuccess }: ApprovePaymentMethodSheetProps) {
  const { user } = useAuth();
  const { schoolId, schoolName } = useSchoolContext();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'full' | 'abono'>('full');
  const [abonoAmount, setAbonoAmount] = useState('');

  const expected = Number(payment?.amount) || 0;
  const existingPaid = Number(payment?.amount_paid) || 0;   // abonos previos
  const remaining = Math.max(expected - existingPaid, 0);   // saldo por cubrir
  const ocrAmount = payment?.ocr_amount != null ? Number(payment.ocr_amount) : null;
  // Discrepancia: el OCR detectó un monto distinto al saldo por cubrir (tol. 0.5%).
  const hasDiscrepancy = ocrAmount != null && remaining > 0 &&
    Math.abs(ocrAmount - remaining) / remaining * 100 > 0.5;

  // Al abrir: si el comprobante cubre menos que el saldo, sugerir modo abono con
  // el valor del comprobante como default. Si no, completar el saldo.
  useEffect(() => {
    if (open && payment) {
      const suggestAbono = ocrAmount != null && ocrAmount > 0 && ocrAmount < remaining;
      setMode(suggestAbono ? 'abono' : 'full');
      setAbonoAmount(suggestAbono ? String(ocrAmount) : String(remaining));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  const abonoNum = Number(abonoAmount) || 0;               // este abono
  const newTotalPaid = existingPaid + abonoNum;            // acumulado tras este abono
  const isAbono = mode === 'abono' && newTotalPaid < expected;  // aún queda saldo
  const saldoPendiente = Math.max(expected - newTotalPaid, 0);

  const handleApprove = async () => {
    if (!payment || !schoolId || !user) return;

    if (mode === 'abono' && (abonoNum <= 0 || abonoNum > remaining)) {
      toast({ title: 'Monto inválido', description: `El abono debe ser mayor a 0 y no superar el saldo ${formatCurrency(remaining)}.`, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Guard: no aprobar pagos bloqueados por revisión
      if (payment?.requires_review) {
        toast({
          title: 'Pago bloqueado',
          description: 'Este pago está en revisión. Desbloquearlo primero desde Negocio › Pagos.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Conserva el método si ya viene (no se re-pregunta); default transfer.
      const method = (payment.payment_method as string) || 'transfer';
      // amount_paid ACUMULA los abonos previos; en pago completo se salda todo.
      const newAmountPaid = isAbono ? newTotalPaid : expected;

      const { error: updateError } = await supabase.from('payments').update({
        // Abono → 'partial' (queda saldo); pago completo → 'paid'.
        status: isAbono ? 'partial' : 'paid',
        payment_method: method,
        payment_channel: method === 'cash' ? 'cash' : 'transfer',
        payment_date: new Date().toISOString().split('T')[0],
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        amount_paid: newAmountPaid,
      } as any).eq('id', payment.id);

      if (updateError) throw updateError;

      // Activar la inscripción SOLO cuando el pago quedó completo. En abono se
      // mantiene pendiente hasta cubrir el saldo. enrollments.status es text:
      // los pendientes reales son 'pending' (NO 'pending_payment').
      if (!isAbono) {
        let enrollQuery = supabase
          .from('enrollments')
          .update({ status: 'active' })
          .eq('school_id', schoolId)
          .eq('status', 'pending');

        if (payment.child_id) {
          enrollQuery = enrollQuery.eq('child_id', payment.child_id);
        } else if (payment.unregistered_athlete_id) {
          enrollQuery = (enrollQuery as any).eq('unregistered_athlete_id', payment.unregistered_athlete_id);
        } else if (payment.user_id) {
          enrollQuery = (enrollQuery as any).eq('user_id', payment.user_id).is('child_id', null);
        }
        if (payment.team_id) {
          enrollQuery = enrollQuery.eq('team_id', payment.team_id);
        }

        await enrollQuery;
      }

      // Notificar al padre / responsable si tiene cuenta
      const recipientId = payment.parent_id || payment.user_id;
      if (recipientId) {
        await supabase.rpc('notify_user', {
          p_user_id: recipientId,
          p_title: isAbono ? '💰 Abono registrado' : '✅ Pago confirmado',
          p_message: isAbono
            ? `${schoolName || 'La escuela'} registró un abono de ${formatCurrency(abonoNum)} por ${payment.concept}. Saldo pendiente: ${formatCurrency(saldoPendiente)}.`
            : `${schoolName || 'La escuela'} confirmó tu pago de ${formatCurrency(expected)} por ${payment.concept}.`,
          p_type: isAbono ? 'payment' : 'success',
          p_link: '/my-payments',
        });
      }

      toast({
        title: isAbono ? 'Abono registrado' : 'Cobro aprobado',
        description: isAbono
          ? `Se acreditó ${formatCurrency(abonoNum)}. Saldo pendiente: ${formatCurrency(saldoPendiente)}.`
          : 'El pago quedó confirmado y la inscripción activa.',
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error al aprobar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!payment) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl px-6 pb-8 pt-6">
        <SheetHeader className="mb-6">
          <SheetTitle>Aprobar cobro</SheetTitle>
          <SheetDescription>
            Confirma la aprobación del cobro de <strong>{payment.athlete_name || 'este deportista'}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Concepto + esperado */}
          <div className="bg-slate-50 p-4 rounded-xl border">
            <p className="text-sm text-slate-500 mb-1">{payment.concept}</p>
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Esperado</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(expected)}</p>
            </div>
            {existingPaid > 0 && (
              <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-200">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Ya abonado</p>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(existingPaid)} · saldo {formatCurrency(remaining)}</p>
              </div>
            )}
          </div>

          {/* Comprobante detectado por OCR */}
          {ocrAmount != null && (
            <div className={`p-3 rounded-xl border flex items-center justify-between ${hasDiscrepancy ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <span className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide text-slate-600">
                <ScanLine className="h-3.5 w-3.5" /> Comprobante (OCR)
              </span>
              <span className={`text-lg font-bold flex items-center gap-1 ${hasDiscrepancy ? 'text-amber-700' : 'text-emerald-700'}`}>
                {hasDiscrepancy && <AlertTriangle className="h-4 w-4" />}
                {formatCurrency(ocrAmount)}
              </span>
            </div>
          )}
          {hasDiscrepancy && (
            <p className="text-xs text-amber-700 -mt-2">
              El comprobante no coincide con el valor esperado. Verifica antes de aprobar: puedes registrarlo como <strong>abono</strong>.
            </p>
          )}

          {/* Selector Completo / Abono */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('full')}
              className={`p-3 rounded-xl border text-sm font-semibold transition-all ${mode === 'full' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              {existingPaid > 0 ? 'Completar saldo' : 'Pago completo'}
            </button>
            <button
              type="button"
              onClick={() => setMode('abono')}
              className={`p-3 rounded-xl border text-sm font-semibold transition-all ${mode === 'abono' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              Registrar abono
            </button>
          </div>

          {/* Input de abono */}
          {mode === 'abono' && (
            <div className="space-y-2">
              <Label htmlFor="abono" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Monto abonado</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                <Input
                  id="abono"
                  type="number"
                  min="0"
                  max={remaining}
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  className="pl-7 text-lg font-bold"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Saldo pendiente</span>
                <span className="font-bold text-amber-600">{formatCurrency(saldoPendiente)}</span>
              </div>
            </div>
          )}

          <Button
            className={`w-full h-12 text-base font-bold ${isAbono ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            disabled={loading}
            onClick={handleApprove}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
            {loading
              ? 'Procesando...'
              : isAbono
                ? `Registrar abono ${formatCurrency(abonoNum)}`
                : `${existingPaid > 0 ? 'Completar saldo' : 'Aprobar'} ${formatCurrency(existingPaid > 0 ? remaining : expected)}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
