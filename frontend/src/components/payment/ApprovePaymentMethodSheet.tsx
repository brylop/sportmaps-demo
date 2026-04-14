import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Banknote, Smartphone, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';

interface ApprovePaymentMethodSheetProps {
  payment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApprovePaymentMethodSheet({ payment, open, onOpenChange, onSuccess }: ApprovePaymentMethodSheetProps) {
  const { user } = useAuth();
  const { schoolId, schoolProfile } = useSchoolContext();
  const { toast } = useToast();
  
  const [method, setMethod] = useState<'cash' | 'transfer' | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    if (!method || !payment || !schoolId || !user) return;
    setLoading(true);

    try {
      const reference = `${method.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      
      const { error: updateError } = await supabase.from('payments').update({
        status: 'paid',
        payment_method: method,
        payment_channel: method === 'cash' ? 'cash' : 'manual',
        payment_date: paymentDate,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        reference: payment.reference || reference,
        amount_paid: payment.amount
      }).eq('id', payment.id);

      if (updateError) throw updateError;

      // Reactivar inscripción vinculada (si existe)
      let enrollQuery = (supabase.from('enrollments') as any)
        .update({ status: 'active' })
        .eq('school_id', schoolId)
        .eq('status', 'pending_payment');

      if (payment.child_id)       enrollQuery = enrollQuery.eq('child_id', payment.child_id);
      else if (payment.parent_id) enrollQuery = enrollQuery.eq('user_id', payment.parent_id);
      if (payment.team_id)        enrollQuery = enrollQuery.eq('team_id', payment.team_id);
      
      await enrollQuery;

      // Notificar al padre o responsable si tiene cuenta
      const recipientId = payment.parent_id || payment.user_id;
      if (recipientId) {
        await supabase.rpc('notify_user', {
          p_user_id: recipientId,
          p_title: '✅ Pago confirmado',
          p_message: `${schoolProfile?.name || 'La escuela'} confirmó tu pago de ${formatCurrency(payment.amount)} por ${payment.concept}.`,
          p_type: 'success',
          p_link: '/my-payments'
        });
      }

      toast({
        title: 'Pago Aprobado',
        description: 'La transacción ha sido validada correctamente.'
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error al aprobar',
        description: err.message,
        variant: 'destructive'
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
          <SheetTitle>Marcar como pagado</SheetTitle>
          <SheetDescription>
            Confirma el método de pago para <strong>{payment.athlete_name || 'este cobro'}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border">
            <p className="text-sm text-slate-500 mb-1">{payment.concept}</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
          </div>

          <div className="space-y-3">
            <Label>¿Cómo realizó el pago?</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant={method === 'cash' ? 'default' : 'outline'}
                className={`h-16 flex flex-col items-center justify-center gap-1 ${method === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                onClick={() => setMethod('cash')}
              >
                <Banknote className="h-5 w-5" />
                <span>Efectivo</span>
              </Button>
              <Button 
                variant={method === 'transfer' ? 'default' : 'outline'}
                className={`h-16 flex flex-col items-center justify-center gap-1 ${method === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => setMethod('transfer')}
              >
                <Smartphone className="h-5 w-5" />
                <span>Transferencia</span>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="payment-date">Fecha de pago</Label>
            <Input 
              id="payment-date" 
              type="date" 
              value={paymentDate} 
              onChange={(e) => setPaymentDate(e.target.value)} 
            />
          </div>

          <Button 
            className="w-full h-12 text-base font-bold mt-4" 
            disabled={!method || loading} 
            onClick={handleApprove}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            {loading ? 'Confirmando...' : 'Confirmar pago'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
