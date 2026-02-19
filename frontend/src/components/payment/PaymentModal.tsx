import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Receipt,
  Loader2,
  RefreshCw,
  Wallet,
  UploadCloud,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { downloadReceipt } from '@/lib/receipt-generator';

export interface PaymentItem {
  type: 'enrollment' | 'product' | 'appointment' | 'reservation';
  id: string; // The ID of the item being paid for (e.g. program ID)
  name: string;
  description?: string;
  amount: number;
  schoolId?: string;
  schoolName?: string;
  programId?: string;
  programName?: string;
  vendorId?: string;
  childId?: string;
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PaymentItem;
  onSuccess?: () => void;
}

export function PaymentModal({ open, onOpenChange, item, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<'method' | 'processing' | 'success'>('method');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pse' | 'manual'>('card');
  const [paymentType, setPaymentType] = useState<'one_time' | 'subscription'>('one_time');
  const [processing, setProcessing] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [proofUploaded, setProofUploaded] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownloadReceipt = () => {
    downloadReceipt({
      receiptNumber,
      date: new Date().toLocaleDateString(),
      customerName: profile?.full_name || 'Cliente',
      concept: `Pago: ${item.name}`,
      description: item.description || `Pago por ${item.name}`,
      schoolName: item.schoolName || 'SportMaps',
      amount: item.amount,
      paymentMethod,
      paymentType,
    });
  };

  const handlePayment = async () => {
    if (paymentMethod === 'manual' && !proofUploaded) {
      toast({
        title: 'Comprobante requerido',
        description: 'Por favor sube el comprobante de pago para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newReceiptNumber = `SPM-${Date.now().toString().slice(-8)}`;
    setReceiptNumber(newReceiptNumber);

    try {
      if (!user) throw new Error('Debes iniciar sesión para realizar un pago');

      const today = new Date();
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      // Calculate subscription dates if applicable
      const subscriptionStartDate = paymentType === 'subscription' ? today.toISOString().split('T')[0] : null;
      const subscriptionEndDate = paymentType === 'subscription' ? dueDate.toISOString().split('T')[0] : null;

      // Determine final status based on method
      // Manual payments go to 'pending' for review. Online payments are 'paid'.
      const paymentStatus = paymentMethod === 'manual' ? 'pending' : 'paid';

      // 1. Create Enrollment if needed (only if paid immediately OR if we allow pending enrollments)
      // For now, we create enrollment as 'active' only if paid, OR 'pending_payment' if manual.
      // But database constraint check: enrollment status enum? (active, cancelled, completed, pending)
      // Let's stick to 'active' for simplicity, assuming school trusts the proof, OR pending.
      // Actually, standard flow: Enrollment created active only after payment confirmation.
      // But to not block the user, let's create it as 'active' but relying on payment check?
      // Better: Create enrollment with status 'pending' if manual.

      if (item.type === 'enrollment') {
        const enrollmentStatus = paymentStatus === 'paid' ? 'active' : 'pending';

        // Check if already enrolled to avoid duplicates? (Supabase constraints handle uniqueness usually)

        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            user_id: user.id,
            child_id: item.childId || null,
            program_id: item.programId,
            school_id: item.schoolId, // Important for RLS
            start_date: today.toISOString().split('T')[0],
            status: enrollmentStatus,
          });

        if (enrollmentError) {
          // Check for duplicate key error
          if (enrollmentError.code === '23505') {
            // Already enrolled, maybe just update? skip for now.
            console.log("Already enrolled, proceeding to payment record.");
          } else {
            throw enrollmentError;
          }
        }

        // Update program participants count only if paid
        if (paymentStatus === 'paid') {
          // Simple increment RPC or fetch-update
          const { data: program } = await supabase
            .from('programs')
            .select('current_participants')
            .eq('id', item.programId!)
            .single();

          if (program) {
            await supabase.from('programs').update({
              current_participants: (program.current_participants || 0) + 1
            }).eq('id', item.programId!);
          }
        }
      }

      // 2. Resolve School ID (Robust fallback)
      let finalSchoolId = item.schoolId;
      if (!finalSchoolId) {
        // Fallback to demo school if not provided (should stick to real logic mostly)
        const { data: demoSchool } = await supabase
          .from('schools')
          .select('id')
          .eq('email', 'spoortmaps+school@gmail.com')
          .maybeSingle();
        if (demoSchool) finalSchoolId = demoSchool.id;
      }

      // 3. Create Payment Record
      const { error: paymentError } = await supabase.from('payments').insert({
        parent_id: user.id,
        child_id: item.childId || null,
        amount: item.amount,
        concept: `${item.type === 'enrollment' ? 'Inscripción' : item.type === 'product' ? 'Compra' : 'Reserva'}: ${item.name}`,
        due_date: dueDate.toISOString().split('T')[0],
        payment_date: paymentStatus === 'paid' ? today.toISOString().split('T')[0] : null, // Only set payment date if paid
        status: paymentStatus,
        receipt_number: paymentStatus === 'paid' ? newReceiptNumber : null, // Receipt only if paid
        payment_type: paymentType,
        payment_method: paymentMethod, // 'card', 'pse', 'manual'
        subscription_start_date: subscriptionStartDate,
        subscription_end_date: subscriptionEndDate,
        school_id: finalSchoolId
      });

      if (paymentError) throw paymentError;

      // 4. Notifications
      if (item.schoolId) {
        // Notify school owner
        const { data: school } = await supabase.from('schools').select('owner_id').eq('id', item.schoolId).single();
        if (school?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: school.owner_id,
            title: paymentStatus === 'paid' ? '¡Nuevo pago recibido!' : 'Nuevo pago por revisar',
            message: `${profile?.full_name || 'Usuario'} ha ${paymentStatus === 'paid' ? 'pagado' : 'reportado pago de'} ${formatCurrency(item.amount)} por ${item.name}.`,
            type: 'payment',
            link: '/payments-automation'
          });
        }
      }

      // Notify User
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: paymentStatus === 'paid' ? '¡Pago exitoso!' : 'Pago enviado a revisión',
        message: paymentStatus === 'paid'
          ? `Tu pago de ${formatCurrency(item.amount)} por ${item.name} ha sido procesado.`
          : `Hemos recibido tu comprobante por ${formatCurrency(item.amount)}. Te notificaremos cuando la escuela lo apruebe.`,
        type: 'success',
        link: item.type === 'enrollment' ? '/calendar' : '/payments',
      });

      // 5. Success UI
      setStep('success');
      setProcessing(false);

      if (onSuccess) {
        // Allow parent to see the success screen before closing
        // onSuccess(); 
      }

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Error en el pago',
        description: error.message || 'No se pudo procesar el pago. Intenta nuevamente.',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('method'); // Reset for next time
    setProcessing(false);
    setProofUploaded(false);
    if (step === 'success' && onSuccess) {
      onSuccess();
    }
  };

  // Render Success Content based on status
  const renderSuccess = () => {
    const isManual = paymentMethod === 'manual';
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
        <div className={`rounded-full p-4 ${isManual ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
          {isManual ? <CheckCircle2 className="w-12 h-12" /> : <CheckCircle2 className="w-12 h-12" />}
        </div>
        <div className="space-y-2">
          <DialogTitle className="text-2xl font-bold">
            {isManual ? '¡Comprobante Enviado!' : '¡Pago Exitoso!'}
          </DialogTitle>
          <DialogDescription className="max-w-xs mx-auto text-base">
            {isManual
              ? 'La escuela revisará tu pago y aprobará tu inscripción en breve.'
              : `Tu pago de ${formatCurrency(item.amount)} ha sido procesado correctamente.`}
          </DialogDescription>
        </div>

        {!isManual && (
          <div className="p-4 bg-muted/50 rounded-lg w-full max-w-sm space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recibo No.</span>
              <span className="font-mono font-medium">{receiptNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monto</span>
              <span className="font-medium text-primary">{formatCurrency(item.amount)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 w-full pt-4">
          {!isManual && (
            <Button variant="outline" className="flex-1" onClick={handleDownloadReceipt}>
              <Download className="w-4 h-4 mr-2" />
              Comprobante
            </Button>
          )}
          <Button className="flex-1" onClick={handleClose}>
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background">
        {step === 'success' ? (
          renderSuccess()
        ) : (
          <>
            <div className="p-6 pb-0">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  {item.schoolName ? (
                    <>Pago a <span className="text-primary">{item.schoolName}</span></>
                  ) : 'Realizar Pago'}
                </DialogTitle>
                <DialogDescription>
                  Completa tu {item.type === 'enrollment' ? 'inscripción' : 'compra'} de forma segura
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumen */}
              <div className="bg-muted/30 p-4 rounded-xl border space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                  </div>
                  <Badge variant="secondary" className="font-poppins">
                    {item.type === 'enrollment' ? 'Inscripción' : 'Producto'}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total a pagar</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(item.amount)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <Label>Método de Pago</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => {
                    setPaymentMethod(v as any);
                    setProofUploaded(false); // Reset proof state on change
                  }}
                  className="grid gap-3"
                >
                  {/* Card */}
                  <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50 ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="card" id="card" className="sr-only" />
                      <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Tarjeta de Crédito / Débito</p>
                        <p className="text-xs text-muted-foreground">Procesamiento inmediato</p>
                      </div>
                    </div>
                    {paymentMethod === 'card' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </label>

                  {/* PSE (Wompi) */}
                  <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50 ${paymentMethod === 'pse' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="pse" id="pse" className="sr-only" />
                      <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">PSE / Wompi</p>
                        <p className="text-xs text-muted-foreground">Transferencia bancaria segura</p>
                      </div>
                    </div>
                    {paymentMethod === 'pse' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </label>

                  {/* Manual Update */}
                  <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50 ${paymentMethod === 'manual' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="manual" id="manual" className="sr-only" />
                      <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Transferencia / Efectivo</p>
                        <p className="text-xs text-muted-foreground">Sube tu comprobante (Requiere revisión)</p>
                      </div>
                    </div>
                    {paymentMethod === 'manual' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </label>
                </RadioGroup>
              </div>

              {/* Manual Payment Instructions */}
              {paymentMethod === 'manual' && (
                <div className="animate-in slide-in-from-top-2 fade-in space-y-4">
                  <div className="bg-amber-50 text-amber-900 p-4 rounded-lg text-sm border border-amber-100">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Datos Bancarios
                    </h4>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p>Banco: <span className="font-medium">Bancolombia</span></p>
                      <p>Cuenta de Ahorros: <span className="font-medium">123-456789-00</span></p>
                      <p>Titular: <span className="font-medium">{item.schoolName || 'SportMaps Academy'}</span></p>
                      <p>Ref: <span className="font-medium">Pago {item.name}</span></p>
                    </div>
                  </div>

                  <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center transition-colors hover:bg-muted/50">
                    <UploadCloud className={`h-10 w-10 ${proofUploaded ? 'text-green-500' : 'text-muted-foreground'}`} />
                    {proofUploaded ? (
                      <div className="space-y-1">
                        <p className="font-medium text-green-600">Comprobante cargado</p>
                        <Button variant="ghost" size="sm" onClick={() => setProofUploaded(false)} className="h-8 text-xs text-muted-foreground hover:text-destructive">
                          Cambiar archivo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Sube la foto del comprobante</p>
                        <p className="text-xs text-muted-foreground">Formatos aceptados: JPG, PNG, PDF</p>
                        <Button variant="outline" size="sm" onClick={() => setProofUploaded(true)}>
                          Seleccionar Archivo
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button
                className="w-full h-12 text-lg font-bold shadow-md"
                size="lg"
                onClick={handlePayment}
                disabled={processing || (paymentMethod === 'manual' && !proofUploaded)}
              >
                {processing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando...</>
                ) : (
                  paymentMethod === 'manual' ? 'Enviar Comprobante' : `Pagar ${formatCurrency(item.amount)}`
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>Pagos seguros y encriptados</span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
