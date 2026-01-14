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
  CheckCircle2, 
  Building2, 
  Lock, 
  Shield,
  Loader2,
  Download,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { downloadReceipt } from '@/lib/receipt-generator';

interface PaymentItem {
  type: 'enrollment' | 'product' | 'appointment' | 'reservation';
  id: string;
  name: string;
  description?: string;
  amount: number;
  schoolId?: string;
  schoolName?: string;
  programId?: string;
  programName?: string;
  vendorId?: string;
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PaymentItem;
  onSuccess?: () => void;
}

export function PaymentModal({ open, onOpenChange, item, onSuccess }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pse'>('card');
  const [paymentType, setPaymentType] = useState<'one_time' | 'subscription'>('one_time');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownloadReceipt = () => {
    if (!user || !receiptNumber) return;
    
    const today = new Date();
    const subscriptionPeriod = paymentType === 'subscription' 
      ? `${today.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`
      : undefined;

    downloadReceipt({
      receiptNumber,
      date: today.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      customerName: profile?.full_name || 'Cliente SportMaps',
      customerEmail: user.email,
      concept: item.name,
      description: item.description,
      amount: item.amount,
      paymentMethod,
      paymentType,
      schoolName: item.schoolName,
      programName: item.programName,
      subscriptionPeriod,
    });

    toast({
      title: 'Recibo descargado',
      description: 'El recibo PDF se ha descargado correctamente.',
    });
  };

  const handlePayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newReceiptNumber = `SPM-${Date.now()}`;
    setReceiptNumber(newReceiptNumber);

    try {
      if (!user) throw new Error('Debes iniciar sesión para realizar un pago');

      const today = new Date();
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      // Calculate subscription dates if applicable
      const subscriptionStartDate = paymentType === 'subscription' ? today.toISOString().split('T')[0] : null;
      const subscriptionEndDate = paymentType === 'subscription' ? dueDate.toISOString().split('T')[0] : null;

      if (item.type === 'enrollment') {
        // Create enrollment record
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            user_id: user.id,
            program_id: item.programId,
            start_date: today.toISOString().split('T')[0],
            status: 'active',
          });

        if (enrollmentError) throw enrollmentError;

        // Update program current_participants count
        if (item.programId) {
          const { data: program } = await supabase
            .from('programs')
            .select('current_participants')
            .eq('id', item.programId)
            .single();

          if (program) {
            await supabase
              .from('programs')
              .update({ current_participants: (program.current_participants || 0) + 1 })
              .eq('id', item.programId);
          }
        }

        // Notify school owner
        if (item.schoolId) {
          const { data: school } = await supabase
            .from('schools')
            .select('owner_id, name')
            .eq('id', item.schoolId)
            .single();

          if (school?.owner_id) {
            await supabase.from('notifications').insert({
              user_id: school.owner_id,
              title: '¡Nueva inscripción!',
              message: `${profile?.full_name || 'Un usuario'} se ha inscrito a ${item.programName || item.name}. Ingreso: ${formatCurrency(item.amount)}`,
              type: 'payment',
              link: '/finances',
            });
          }
        }
      }

      if (item.type === 'product' && item.vendorId) {
        // Notify store owner
        await supabase.from('notifications').insert({
          user_id: item.vendorId,
          title: '¡Nueva venta!',
          message: `${profile?.full_name || 'Un cliente'} ha comprado ${item.name}. Total: ${formatCurrency(item.amount)}`,
          type: 'payment',
          link: '/store/orders',
        });
      }

      // Create payment record with payment type
      const { error: paymentError } = await supabase.from('payments').insert({
        parent_id: user.id,
        amount: item.amount,
        concept: `${item.type === 'enrollment' ? 'Inscripción' : item.type === 'product' ? 'Compra' : 'Reserva'}: ${item.name}`,
        due_date: dueDate.toISOString().split('T')[0],
        payment_date: today.toISOString().split('T')[0],
        status: 'paid',
        receipt_number: newReceiptNumber,
        payment_type: paymentType,
        subscription_start_date: subscriptionStartDate,
        subscription_end_date: subscriptionEndDate,
      });

      if (paymentError) throw paymentError;

      // Create calendar event for enrollments
      if (item.type === 'enrollment') {
        const eventStart = new Date();
        eventStart.setDate(eventStart.getDate() + 1);
        eventStart.setHours(9, 0, 0, 0);
        const eventEnd = new Date(eventStart);
        eventEnd.setHours(10, 30, 0, 0);

        await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: `Primera clase: ${item.programName || item.name}`,
          description: `Inicio de programa en ${item.schoolName || 'escuela deportiva'}`,
          start_time: eventStart.toISOString(),
          end_time: eventEnd.toISOString(),
          event_type: 'class',
          location: item.description,
        });
      }

      // Create user notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '¡Pago exitoso!',
        message: `Tu pago de ${formatCurrency(item.amount)} por ${item.name} ha sido procesado. ${paymentType === 'subscription' ? 'Próximo cobro: ' + dueDate.toLocaleDateString('es-CO') : ''}`,
        type: 'success',
        link: item.type === 'enrollment' ? '/calendar' : '/payments',
      });

      setSuccess(true);
      toast({
        title: '¡Pago exitoso!',
        description: `Tu pago de ${formatCurrency(item.amount)} ha sido procesado.`,
      });

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
    setSuccess(false);
    setProcessing(false);
    setPaymentMethod('card');
    setPaymentType('one_time');
    setReceiptNumber('');
    onOpenChange(false);
    if (success) {
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { 
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-poppins">¡Pago Exitoso!</h3>
              <p className="text-muted-foreground">
                Tu transacción ha sido procesada correctamente
              </p>
              <p className="text-sm text-muted-foreground">
                Recibo: <span className="font-mono font-medium">{receiptNumber}</span>
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary text-lg px-4 py-2">
              {formatCurrency(item.amount)}
            </Badge>
            
            {/* Download Receipt Button */}
            <div className="space-y-3 pt-4">
              <Button
                onClick={handleDownloadReceipt}
                variant="outline"
                className="w-full gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar Recibo PDF
              </Button>
              <Button onClick={handleClose} className="w-full">
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-poppins">
                <Lock className="w-5 h-5 text-primary" />
                Pago Seguro
              </DialogTitle>
              <DialogDescription>
                Completa tu pago de forma segura
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Concepto</span>
                  <span className="font-medium text-right max-w-[200px] truncate">{item.name}</span>
                </div>
                {item.schoolName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Escuela</span>
                    <span>{item.schoolName}</span>
                  </div>
                )}
                {item.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Detalles</span>
                    <span className="text-right max-w-[180px] truncate">{item.description}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(item.amount)}</span>
                </div>
              </div>

              {/* Payment Type Selection (for enrollments) */}
              {item.type === 'enrollment' && (
                <div className="space-y-3">
                  <Label className="font-poppins font-semibold">Tipo de pago</Label>
                  <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as 'one_time' | 'subscription')}>
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentType === 'one_time'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setPaymentType('one_time')}
                    >
                      <RadioGroupItem value="one_time" id="one_time" />
                      <Calendar className="w-5 h-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Pago Único</p>
                        <p className="text-xs text-muted-foreground">Pago por un mes de clases</p>
                      </div>
                    </div>
                    
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentType === 'subscription'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setPaymentType('subscription')}
                    >
                      <RadioGroupItem value="subscription" id="subscription" />
                      <RefreshCw className="w-5 h-5 text-accent" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Suscripción Mensual</p>
                        <p className="text-xs text-muted-foreground">Cobro automático cada mes</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Recomendado</Badge>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="font-poppins font-semibold">Método de pago</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'card' | 'pse')}>
                  <div
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      paymentMethod === 'card'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    <RadioGroupItem value="card" id="card" />
                    <CreditCard className="w-6 h-6 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Tarjeta de Crédito/Débito</p>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard, American Express</p>
                    </div>
                  </div>
                  
                  <div
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      paymentMethod === 'pse'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setPaymentMethod('pse')}
                  >
                    <RadioGroupItem value="pse" id="pse" />
                    <Building2 className="w-6 h-6 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">PSE - Débito Bancario</p>
                      <p className="text-sm text-muted-foreground">Paga desde tu cuenta bancaria</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Card Form (Simulated) */}
              {paymentMethod === 'card' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Número de tarjeta</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      defaultValue="4242 4242 4242 4242"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Fecha de expiración</Label>
                      <Input id="expiry" placeholder="MM/AA" defaultValue="12/28" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvc">CVC</Label>
                      <Input id="cvc" placeholder="123" defaultValue="123" type="password" />
                    </div>
                  </div>
                </div>
              )}

              {/* PSE Form (Simulated) */}
              {paymentMethod === 'pse' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank">Banco</Label>
                    <Input id="bank" placeholder="Selecciona tu banco" defaultValue="Bancolombia" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docType">Tipo de documento</Label>
                    <Input id="docType" defaultValue="Cédula de Ciudadanía" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docNumber">Número de documento</Label>
                    <Input id="docNumber" placeholder="1234567890" defaultValue="1234567890" />
                  </div>
                </div>
              )}

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Pago 100% seguro con encriptación SSL</span>
              </div>

              {/* Pay Button */}
              <Button
                className="w-full h-12 text-lg font-poppins font-bold"
                onClick={handlePayment}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Pagar {formatCurrency(item.amount)}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
