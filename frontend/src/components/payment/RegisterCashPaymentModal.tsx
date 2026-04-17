import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Banknote, Building2, Wallet, Landmark, Calendar as CalendarIcon, User, FileText, CheckCircle2 } from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { emailClient } from '@/lib/email-client';
import { formatCurrency, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegisterCashPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RegisterCashPaymentModal({ open, onOpenChange, onSuccess }: RegisterCashPaymentModalProps) {
  const { user } = useAuth();
  const { schoolId, schoolName } = useSchoolContext();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  // Form state
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [concept, setConcept] = useState('Mensualidad');
  const [amount, setAmount] = useState<number | ''>(0);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

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
    const numericAmount = typeof amount === 'number' ? amount : 0;
    if (!selectedAthleteId || !concept || numericAmount <= 0) {
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
            payment_date: paymentDate.toISOString().split('T')[0],
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
          payment_date: paymentDate.toISOString().split('T')[0],
          due_date: paymentDate.toISOString().split('T')[0],
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
          p_message: `${schoolName || 'La escuela'} registró tu pago de ${formatCurrency(numericAmount)} por ${concept}.`,
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
            schoolName: schoolName || 'La escuela',
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
    setAmount(0);
    setPaymentDate(new Date());
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) resetForm();
    }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="p-8 pb-4 border-b bg-primary/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">Registrar pago manual</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground font-medium">
            Registra transacciones de efectivo o transferencias de forma inmediata.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5" /> Método de pago
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 group",
                  paymentMethod === 'cash' 
                    ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10" 
                    : "bg-muted/20 border-border/40 hover:border-border/80"
                )}
                onClick={() => setPaymentMethod('cash')}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-colors",
                  paymentMethod === 'cash' ? "bg-emerald-500 text-white" : "bg-muted/40 text-muted-foreground group-hover:bg-muted"
                )}>
                  <Banknote className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  paymentMethod === 'cash' ? "text-emerald-500" : "text-muted-foreground"
                )}>Efectivo</span>
              </button>

              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 group",
                  paymentMethod === 'transfer' 
                    ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10" 
                    : "bg-muted/20 border-border/40 hover:border-border/80"
                )}
                onClick={() => setPaymentMethod('transfer')}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-colors",
                  paymentMethod === 'transfer' ? "bg-blue-500 text-white" : "bg-muted/40 text-muted-foreground group-hover:bg-muted"
                )}>
                  <Building2 className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  paymentMethod === 'transfer' ? "text-blue-500" : "text-muted-foreground"
                )}>Transferencia</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="student" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Estudiante / Atleta
            </Label>
            <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId} disabled={loadingAthletes}>
              <SelectTrigger id="student" className="h-12 bg-background/50 border-border/40 rounded-xl font-bold">
                <SelectValue placeholder={loadingAthletes ? 'Cargando...' : 'Selecciona a quién aplica'} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40 bg-background/95 backdrop-blur-md">
                {athletes.map((ath) => (
                  <SelectItem key={ath.id} value={ath.id} className="rounded-lg py-2.5">
                    {ath.full_name} {ath.parent_name ? ` (Padre: ${ath.parent_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="concept" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Concepto de pago
            </Label>
            <Input 
              id="concept" 
              placeholder="Ej. Mensualidad Mayo..." 
              value={concept} 
              onChange={(e) => setConcept(e.target.value)} 
              className="h-12 bg-background/50 border-border/40 rounded-xl font-medium focus-visible:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5" /> Monto ($ COP)
              </Label>
              <NumberStepper 
                value={amount}
                onChange={setAmount}
                step={10000}
                min={0}
                unit="COP"
                className="h-12"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" /> Fecha del pago
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full h-12 justify-start text-left font-medium bg-background/50 border-border/40 rounded-xl",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                    {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden border-border/30 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => date && setPaymentDate(date)}
                    initialFocus
                    locale={es}
                    className="bg-background/95 backdrop-blur-md"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button 
            className={cn(
              "w-full h-14 mt-4 font-black uppercase tracking-widest text-sm shadow-xl transition-all gap-3",
              paymentMethod === 'cash' 
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
            )}
            disabled={loading} 
            onClick={handleSave}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            {loading ? 'Registrando...' : 'Confirmar Registro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
