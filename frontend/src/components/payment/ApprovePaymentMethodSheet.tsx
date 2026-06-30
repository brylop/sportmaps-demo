import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
 * Confirmación SIMPLE de aprobación de un cobro pendiente.
 * No re-pregunta método ni fecha: el origen del cobro ya se conoce
 * (inscripción por QR o transferencia ya reportada). Solo confirma → paid
 * y activa la inscripción asociada.
 */
export function ApprovePaymentMethodSheet({ payment, open, onOpenChange, onSuccess }: ApprovePaymentMethodSheetProps) {
  const { user } = useAuth();
  const { schoolId, schoolName } = useSchoolContext();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    if (!payment || !schoolId || !user) return;
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

      const { error: updateError } = await supabase.from('payments').update({
        status: 'paid',
        payment_method: method,
        payment_channel: method === 'cash' ? 'cash' : 'transfer',
        payment_date: new Date().toISOString().split('T')[0],
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        amount_paid: payment.amount,
      }).eq('id', payment.id);

      if (updateError) throw updateError;

      // Activar la inscripción asociada. enrollments.status es text:
      // los pendientes reales son 'pending' (NO 'pending_payment').
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

      // Notificar al padre / responsable si tiene cuenta
      const recipientId = payment.parent_id || payment.user_id;
      if (recipientId) {
        await supabase.rpc('notify_user', {
          p_user_id: recipientId,
          p_title: '✅ Pago confirmado',
          p_message: `${schoolName || 'La escuela'} confirmó tu pago de ${formatCurrency(payment.amount)} por ${payment.concept}.`,
          p_type: 'success',
          p_link: '/my-payments',
        });
      }

      toast({
        title: 'Cobro aprobado',
        description: 'El pago quedó confirmado y la inscripción activa.',
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

        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border">
            <p className="text-sm text-slate-500 mb-1">{payment.concept}</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
          </div>

          <Button
            className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700"
            disabled={loading}
            onClick={handleApprove}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
            {loading ? 'Aprobando...' : 'Aprobar cobro'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
