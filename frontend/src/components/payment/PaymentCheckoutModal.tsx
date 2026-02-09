import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Smartphone, Loader2, CheckCircle2, XCircle, Info, UploadCloud, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/demo-data';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from '@/components/common/FileUpload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PaymentCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  programId: string;
  amount: number;
  programName: string;
  onSuccess?: () => void;
}

export function PaymentCheckoutModal({
  open,
  onOpenChange,
  studentId,
  programId,
  amount,
  programName,
  onSuccess
}: PaymentCheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'pse' | 'card' | 'nequi' | 'transfer' | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'awaiting_approval'>('idle');
  const { toast } = useToast();
  const navigate = useNavigate();

  const paymentMethods = [
    {
      id: 'pse' as const,
      name: 'PSE',
      description: 'Pago con débito bancario',
      icon: Building2,
      popular: true,
      fee: 0
    },
    {
      id: 'card' as const,
      name: 'Tarjeta',
      description: 'Visa o Mastercard',
      icon: CreditCard,
      popular: false,
      fee: 0
    },
    {
      id: 'nequi' as const,
      name: 'Nequi',
      description: 'Pago instantáneo',
      icon: Smartphone,
      popular: false,
      fee: 0
    },
    {
      id: 'transfer' as const,
      name: 'Transferencia Manual',
      description: 'Nequi, Daviplata o Bancolombia',
      icon: Building2,
      popular: false,
      fee: 0
    }
  ];

  const handlePaymentMethod = (method: 'pse' | 'card' | 'nequi' | 'transfer') => {
    setSelectedMethod(method);
  };

  const processPayment = async () => {
    if (!selectedMethod) return;

    if (selectedMethod === 'transfer' && !proofUrl) {
      toast({
        title: "Comprobante requerido",
        description: "Por favor sube una captura de pantalla de tu transferencia",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    setPaymentStatus('processing');

    try {
      if (selectedMethod === 'transfer') {
        const response = await fetch('/api/payments/register-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            program_id: programId,
            amount,
            proof_url: proofUrl,
            concept: `Pago mensual - ${programName}`,
            // In a real app, these would come from context
            team_id: 'team_default',
            category_id: 'cat_default'
          })
        });

        const data = await response.json();
        if (data.success) {
          setPaymentStatus('awaiting_approval');
          toast({
            title: "Pago registrado",
            description: "Tu cupo ha sido reservado. Validaremos tu comprobante pronto.",
          });
          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
          }, 3000);
        } else {
          throw new Error(data.message || 'Error al registrar pago manual');
        }
        return;
      }

      // Step 1: Create payment intent
      const intentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          program_id: programId,
          amount,
          payment_method: selectedMethod,
          description: `Pago mensual - ${programName}`,
          parent_name: 'Demo User',
          parent_email: 'parent@demo.com'
        })
      });

      const intentData = await intentResponse.json();

      if (!intentData.success) {
        throw new Error('Failed to create payment intent');
      }

      // Step 2: Simulate payment processing (in production, redirect to gateway)
      // For demo, we process immediately
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing

      const processResponse = await fetch(
        `/api/payments/process-demo-payment/${intentData.intent_id}`,
        { method: 'POST' }
      );

      const processData = await processResponse.json();

      if (processData.success && processData.status === 'approved') {
        setPaymentStatus('success');
        toast({
          title: "¡Pago exitoso!",
          description: `Tu pago de ${formatCurrency(amount)} fue procesado correctamente`,
        });

        // Wait 2 seconds then close and refresh
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
          setPaymentStatus('idle');
          setSelectedMethod(null);
        }, 2000);
      } else {
        throw new Error(processData.message || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentStatus('error');
      toast({
        title: "Error en el pago",
        description: error.message || "No se pudo procesar tu pago. Inténtalo de nuevo.",
        variant: "destructive"
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setPaymentStatus('idle');
      }, 2000);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      onOpenChange(false);
      setPaymentStatus('idle');
      setSelectedMethod(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Realizar Pago</DialogTitle>
          <DialogDescription>
            Selecciona tu método de pago preferido
          </DialogDescription>
        </DialogHeader>

        {paymentStatus === 'idle' && (
          <div className="space-y-6 py-4">
            {/* Payment Summary */}
            <div className="bg-primary/5 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">Programa</p>
              <p className="font-semibold text-lg">{programName}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
                <p className="text-sm text-muted-foreground">/mes</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Pago recurrente mensual. Puedes cancelar en cualquier momento.
              </p>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <p className="font-medium">Método de pago:</p>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedMethod === method.id;

                return (
                  <button
                    key={method.id}
                    onClick={() => handlePaymentMethod(method.id)}
                    className={`w-full flex items-center gap-4 p-4 border-2 rounded-lg transition-all hover:border-primary ${isSelected ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-muted'
                      }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{method.name}</p>
                        {method.popular && (
                          <Badge variant="secondary" className="text-xs">Más usado</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bank Info for Transfer */}
            {selectedMethod === 'transfer' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <Alert variant="default" className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary font-bold">Información de Transferencia</AlertTitle>
                  <AlertDescription className="space-y-2 mt-2">
                    <p className="text-sm">Realiza tu transferencia a la siguiente cuenta:</p>
                    <div className="bg-background/80 p-3 rounded border space-y-1 font-mono text-xs">
                      <p><strong>Banco:</strong> Bancolombia (Ahorros)</p>
                      <p><strong>Número:</strong> 123-456789-01</p>
                      <p><strong>Titular:</strong> SportMaps Academia</p>
                      <p><strong>NIT:</strong> 900.123.456-7</p>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <p className="font-medium text-sm">Sube tu comprobante:</p>
                  <FileUpload
                    bucket="payment-receipts"
                    accept="image/*"
                    onUploadComplete={(url) => setProofUrl(url)}
                  />
                  {proofUrl && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Comprobante cargado correctamente
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                disabled={!selectedMethod || processing}
                onClick={processPayment}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  `Pagar ${formatCurrency(amount)}`
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClose}
                disabled={processing}
              >
                Cancelar
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              🔒 Pago 100% seguro. Tus datos están protegidos.
            </p>
          </div>
        )}

        {paymentStatus === 'processing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
            <div>
              <h3 className="text-lg font-semibold">Procesando tu pago...</h3>
              <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
            </div>
          </div>
        )}

        {paymentStatus === 'success' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">¡Pago exitoso!</h3>
              <p className="text-sm text-muted-foreground">
                Tu pago de {formatCurrency(amount)} fue procesado correctamente
              </p>
            </div>
          </div>
        )}

        {paymentStatus === 'awaiting_approval' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="h-10 w-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-600">Pago en Verificación</h3>
              <p className="text-sm text-muted-foreground px-4">
                Hemos recibido tu comprobante. Tu cupo está reservado y la administración validará el pago en un máximo de 24 horas.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Entendido
            </Button>
          </div>
        )}

        {paymentStatus === 'error' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-600">Pago rechazado</h3>
              <p className="text-sm text-muted-foreground">
                No se pudo procesar tu pago. Por favor, inténtalo de nuevo.
              </p>
            </div>
            <Button onClick={() => setPaymentStatus('idle')}>
              Intentar de nuevo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}