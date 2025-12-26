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
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PaymentItem {
  type: 'enrollment' | 'product' | 'appointment';
  id: string;
  name: string;
  description?: string;
  amount: number;
  schoolId?: string;
  programId?: string;
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PaymentItem;
  onSuccess?: () => void;
}

export function PaymentModal({ open, onOpenChange, item, onSuccess }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pse'>('card');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      if (item.type === 'enrollment' && user) {
        // Create enrollment record
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            user_id: user.id,
            program_id: item.programId,
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
          });

        if (enrollmentError) throw enrollmentError;

        // Create payment record
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + 1);

        await supabase.from('payments').insert({
          parent_id: user.id,
          amount: item.amount,
          concept: `Inscripción: ${item.name}`,
          due_date: dueDate.toISOString().split('T')[0],
          payment_date: new Date().toISOString().split('T')[0],
          status: 'paid',
          receipt_number: `SPM-${Date.now()}`,
        });

        // Create calendar event
        const eventStart = new Date();
        eventStart.setDate(eventStart.getDate() + 1);
        eventStart.setHours(9, 0, 0, 0);
        const eventEnd = new Date(eventStart);
        eventEnd.setHours(10, 30, 0, 0);

        await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: `Primera clase: ${item.name}`,
          description: `Inicio de programa en ${item.description || 'escuela deportiva'}`,
          start_time: eventStart.toISOString(),
          end_time: eventEnd.toISOString(),
          event_type: 'class',
          location: item.description,
        });

        // Create notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: '¡Inscripción exitosa!',
          message: `Te has inscrito correctamente a ${item.name}. Tu primera clase está programada.`,
          type: 'success',
          link: '/calendar',
        });
      }

      setSuccess(true);
      toast({
        title: '¡Pago exitoso!',
        description: `Tu pago de ${formatCurrency(item.amount)} ha sido procesado.`,
      });

      setTimeout(() => {
        setSuccess(false);
        setProcessing(false);
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
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

  const resetState = () => {
    setSuccess(false);
    setProcessing(false);
    setPaymentMethod('card');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { 
      if (!open) resetState();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-poppins">¡Pago Exitoso!</h3>
              <p className="text-muted-foreground">
                Tu transacción ha sido procesada correctamente
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary text-lg px-4 py-2">
              {formatCurrency(item.amount)}
            </Badge>
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
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Detalles</span>
                    <span>{item.description}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(item.amount)}</span>
                </div>
              </div>

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
                    <div className="flex gap-1">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6" />
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
                    <img 
                      src="https://www.pfranciscota.edu.co/images/Logo-PSE.png" 
                      alt="PSE" 
                      className="h-8 object-contain"
                    />
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
