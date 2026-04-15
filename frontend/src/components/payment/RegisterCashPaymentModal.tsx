import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Banknote, Building2 } from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { emailClient } from '@/lib/email-client';
import { formatCurrency } from '@/lib/utils';

interface RegisterCashPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RegisterCashPaymentModal({ open, onOpenChange, onSuccess }: RegisterCashPaymentModalProps) {
  const { user } = useAuth();
  const { schoolId, schoolProfile } = useSchoolContext();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  // Form state
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [concept, setConcept] = useState('Mensualidad');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (open && schoolId) {
      fetchAthletes();
    }
  }, [open, schoolId]);

  const fetchAthletes = async () => {
    setLoadingAthletes(true);
    try {
      const { data, error } = await supabase
        .from('school_athletes')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      
      if (error) throw error;
      setAthletes(data || []);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error al cargar estudiantes', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAthletes(false);
    }
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);
    if (!selectedAthleteId || !concept || isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: 'Datos incompletos', description: 'Por favor completa todos los campos requeridos.', variant: 'destructive' });
      return;
    }

    const selectedStudent = athletes.find(a => a.id === selectedAthleteId);
    if (!selectedStudent || !schoolId || !user) return;

    setLoading(true);
    try {
      const prefix = paymentMethod === 'cash' ? 'CASH' : 'TRF';
      const reference = `${prefix}-${Date.now().toString(36).toUpperCase()}`;

      // Resolve correct IDs from the school_athletes view.
      // Payments are created with exactly ONE of these three fields:
      //   Flujo A (menores)      → child_id   (user_id null, parent_id null in view)
      //   Flujo B (adultos)      → user_id    (user_id set in view)
      //   Flujo C (sin cuenta)   → unregistered_athlete_id (user_id null, parent_id null)
      const hasUserId  = !!selectedStudent.user_id;
      const hasParent  = !!selectedStudent.parent_id;

      const userId           = hasUserId ? selectedStudent.user_id : null;
      const childId          = (!hasUserId && hasParent) ? selectedStudent.id : null;
      const unregisteredId   = (!hasUserId && !hasParent) ? selectedStudent.id : null;

      // Find ALL pending/overdue payments for this student
      let matchQuery = supabase
        .from('payments')
        .select('id')
        .eq('school_id', schoolId)
        .in('status', ['pending', 'overdue']);

      if (userId)              matchQuery = matchQuery.eq('user_id', userId);
      else if (childId)        matchQuery = matchQuery.eq('child_id', childId);
      else if (unregisteredId) matchQuery = matchQuery.eq('unregistered_athlete_id', unregisteredId);

      const { data: existingPayments } = await matchQuery;

      if (existingPayments && existingPayments.length > 0) {
        // Update ALL pending/overdue payments to paid
        const ids = existingPayments.map(p => p.id);
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'paid',
            payment_method: paymentMethod === 'cash' ? 'cash' : 'transfer',
            payment_channel: paymentMethod === 'cash' ? 'cash' : 'transfer',
            payment_date: paymentDate,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            reference,
            amount_paid: numericAmount,
          })
          .in('id', ids);

        if (updateError) throw updateError;
      } else {
        // No pending payment found — create a new one
        const { error: insertError } = await supabase.from('payments').insert({
          school_id: schoolId,
          child_id: childId,
          user_id: userId,
          unregistered_athlete_id: unregisteredId,
          parent_id: selectedStudent.parent_id || null,
          amount: numericAmount,
          concept,
          status: 'paid',
          payment_method: paymentMethod === 'cash' ? 'cash' : 'transfer',
          payment_channel: paymentMethod === 'cash' ? 'cash' : 'transfer',
          payment_type: 'one_time',
          payment_date: paymentDate,
          due_date: paymentDate,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          reference,
          amount_paid: numericAmount
        });

        if (insertError) throw insertError;
      }

      // Notificar al padre o al atleta (si tienen cuenta)
      const recipientId = selectedStudent.parent_id || userId;
      if (recipientId) {
        await supabase.rpc('notify_user', {
          p_user_id: recipientId,
          p_title: paymentMethod === 'cash' ? '✅ Pago en efectivo registrado' : '✅ Transferencia registrada',
          p_message: `${schoolProfile?.name || 'La escuela'} registró tu pago de ${formatCurrency(numericAmount)} por ${concept}.`,
          p_type: 'success',
          p_link: '/my-payments'
        });
      }

      // Enviar correo de confirmación silencioso
      if (selectedStudent.parent_email) {
        emailClient.send({
          type: 'payment_confirmation',
          to: selectedStudent.parent_email,
          data: { 
            userName: selectedStudent.parent_name || 'Padre de familia',
            schoolName: schoolProfile?.name || 'La escuela',
            amount: formatCurrency(numericAmount), 
            concept, 
            reference
          }
        }).catch(() => {}); // Fire and forget
      }

      const methodLabel = paymentMethod === 'cash' ? 'en efectivo' : 'por transferencia';
      toast({ title: 'Cobro Registrado', description: `El pago ${methodLabel} se ha registrado exitosamente.` });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error al reportar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedAthleteId('');
    setPaymentMethod('cash');
    setConcept('Mensualidad');
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) resetForm();
    }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar pago manual</DialogTitle>
          <DialogDescription>
            Registra un pago recibido (efectivo o transferencia) y se reflejará instantáneamente en el sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className={paymentMethod === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                className={paymentMethod === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => setPaymentMethod('transfer')}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Transferencia
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student">Estudiante / Atleta</Label>
            <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId} disabled={loadingAthletes}>
              <SelectTrigger id="student">
                <SelectValue placeholder={loadingAthletes ? 'Cargando estudiantes...' : 'Selecciona a quién aplica'} />
              </SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {athletes.map((ath) => (
                  <SelectItem key={ath.id} value={ath.id}>
                    {ath.full_name} {ath.parent_name ? ` (Padre: ${ath.parent_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concept">Concepto de pago</Label>
            <Input 
              id="concept" 
              placeholder="Ej. Mensualidad Mayo, Uniforme..." 
              value={concept} 
              onChange={(e) => setConcept(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto ($ COP)</Label>
              <Input 
                id="amount" 
                type="number" 
                placeholder="0" 
                min="0"
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Fecha del pago</Label>
              <Input 
                id="date" 
                type="date" 
                value={paymentDate} 
                onChange={(e) => setPaymentDate(e.target.value)} 
              />
            </div>
          </div>

          <Button 
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" 
            disabled={loading} 
            onClick={handleSave}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? 'Registrando...' : 'Guardar y confirmar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
