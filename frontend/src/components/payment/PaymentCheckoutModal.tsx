import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Smartphone, Loader2, CheckCircle2, XCircle, Info, UploadCloud, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};
import { FileUpload } from '@/components/common/FileUpload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';

interface PaymentCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  schoolId: string;
  paymentId?: string;
  programId?: string;
  amount: number;
  concept: string;
  mode?: 'create' | 'update';
  onSuccess?: () => void;
}

export function PaymentCheckoutModal({
  open,
  onOpenChange,
  studentId,
  schoolId,
  paymentId,
  programId,
  amount,
  concept,
  mode = 'update',
  onSuccess
}: PaymentCheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'pse' | 'card' | 'transfer' | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'awaiting_approval'>('idle');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hasCompleteDianData, setHasCompleteDianData] = useState<boolean>(true);
  const [checkingDian, setCheckingDian] = useState<boolean>(true);
  const [bankDetails, setBankDetails] = useState<any>(null);

  useEffect(() => {
    if (open && schoolId) {
      supabase.from('school_settings')
        .select('bank_name, bank_account_type, bank_account_number, nequi_number, daviplata_number, bank_titular_name, bank_titular_id, payment_qr_url')
        .eq('school_id', schoolId)
        .single()
        .then(({ data }) => setBankDetails(data));
    }
  }, [open, schoolId]);

  useEffect(() => {
    if (open && user?.id) {
      const checkProfile = async () => {
        setCheckingDian(true);
        const { data } = await supabase.from('profiles').select('document_type, document_number, billing_address, billing_city_dane').eq('id', user.id).single();
        if (data && data.document_type && data.document_number && data.billing_address && data.billing_city_dane) {
          setHasCompleteDianData(true);
        } else {
          setHasCompleteDianData(false);
        }
        setCheckingDian(false);
      };
      checkProfile();
    }
  }, [open, user?.id]);

  const paymentMethods = [
    {
      id: 'transfer' as const,
      name: 'Transferencia / Nequi / Daviplata',
      description: 'Nequi, Daviplata o transferencia bancaria',
      icon: Smartphone,
      popular: true,
      fee: 0,
      enabled: true
    },
    {
      id: 'pse' as const,
      name: 'PSE',
      description: 'Pago con débito bancario',
      icon: Building2,
      popular: false,
      fee: 0,
      enabled: false
    },
    {
      id: 'card' as const,
      name: 'Tarjeta',
      description: 'Visa o Mastercard',
      icon: CreditCard,
      popular: false,
      fee: 0,
      enabled: false
    }
  ];

  const handlePaymentMethod = (method: 'pse' | 'card' | 'transfer') => {
    setSelectedMethod(method);
  };



  const processPayment = async () => {
    setProcessing(true);
    setPaymentStatus('processing');

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');


      // 1. Resolve context based on mode
      if (mode === 'update' && paymentId) {
        // Fetch existing payment to verify ownership and status
        const { data: existingPayment, error: fetchError } = await supabase
          .from('payments')
          .select('school_id, status')
          .eq('id', paymentId)
          .single();

        if (fetchError || !existingPayment) throw new Error('No se encontró el pago pendiente.');
        if (existingPayment.status === 'paid') throw new Error('Este pago ya fue procesado.');
      }

      if (selectedMethod === 'transfer') {
        if (!proofUrl) throw new Error('Debes subir un comprobante de pago');

        if (mode === 'update' && paymentId) {
          const { error: updateError } = await supabase
            .from('payments')
            .update({
              status: 'awaiting_approval',
              payment_method: 'transfer',
              payment_date: new Date().toISOString(),
              receipt_url: proofUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentId);
          if (updateError) throw updateError;
        } else {
          // Create mode - Insert new payment with awaiting_approval
          const { data: studentData } = await supabase.from('children').select('branch_id').eq('id', studentId).single();

          const { error: insertError } = await supabase.from('payments').insert({
            parent_id: user?.id,
            child_id: studentId,
            program_id: programId,
            school_id: schoolId,
            branch_id: studentData?.branch_id || null, // Auto-associate with student's branch
            amount: amount,
            concept: concept,
            status: 'awaiting_approval',
            payment_method: 'transfer',
            payment_date: new Date().toISOString(),
            due_date: new Date().toISOString(),
            receipt_url: proofUrl,
          });
          if (insertError) throw insertError;
        }

        setPaymentStatus('awaiting_approval');
        toast({
          title: "Pago registrado",
          description: "Tu cupo ha sido reservado. Validaremos tu comprobante pronto.",
        });
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
        }, 3000);
        return;
      }

      // PSE / Card flow (Simulation)
      await new Promise(resolve => setTimeout(resolve, 2000));


      let error = null;

      if (mode === 'update' && paymentId) {
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'paid', // Auto-approved for demo/simulation
            payment_method: selectedMethod,
            payment_date: new Date().toISOString(),
            receipt_number: `DEMO-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId);
        error = updateError;
      } else {
        // Create mode
        const { data: studentData } = await supabase.from('children').select('branch_id').eq('id', studentId).single();

        const { error: insertError } = await supabase.from('payments').insert({
          parent_id: user?.id,
          child_id: studentId,
          program_id: programId,
          school_id: schoolId,
          branch_id: studentData?.branch_id || null,
          amount: amount,
          concept: concept,
          status: 'paid',
          payment_method: selectedMethod,
          payment_date: new Date().toISOString(),
          due_date: new Date().toISOString(),
          receipt_number: `DEMO-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        });
        error = insertError;
      }

      if (error) throw error;

      setPaymentStatus('success');
      toast({
        title: "¡Pago exitoso!",
        description: `Tu pago de ${formatCurrency(amount)} fue procesado correctamente`,
      });

      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
        setPaymentStatus('idle');
        setSelectedMethod(null);
      }, 2000);

    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Payment error:', err);
      setPaymentStatus('error');
      toast({
        title: "Error en el pago",
        description: err.message || "No se pudo procesar tu pago. Inténtalo de nuevo.",
        variant: "destructive"
      });

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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              <p className="text-sm text-muted-foreground">Concepto</p>
              <p className="font-semibold text-lg">{concept}</p>
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
                const isDisabled = !method.enabled;

                return (
                  <button
                    key={method.id}
                    onClick={() => !isDisabled && handlePaymentMethod(method.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${isDisabled
                      ? 'border-border/50 opacity-50 cursor-not-allowed bg-muted/30'
                      : isSelected
                        ? 'border-primary bg-primary/5 hover:border-primary'
                        : 'border-border hover:border-primary'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDisabled ? 'bg-muted/50' : isSelected ? 'bg-primary text-white' : 'bg-muted'
                      }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{method.name}</p>
                        {method.popular && method.enabled && (
                          <Badge variant="secondary" className="text-xs">Recomendado</Badge>
                        )}
                        {isDisabled && (
                          <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">Próximamente</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                    {isSelected && !isDisabled && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Interception Form if Missing DIAN Data */}
            {selectedMethod && !checkingDian && !hasCompleteDianData && (
              <div className="pt-4 border-t mt-4">
                <BillingDetailsForm onComplete={() => setHasCompleteDianData(true)} />
              </div>
            )}

            {/* Bank Info for Transfer */}
            {selectedMethod === 'transfer' && hasCompleteDianData && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <Alert variant="default" className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary font-bold">Información de Transferencia</AlertTitle>
                  <AlertDescription className="space-y-2 mt-2">
                    <p className="text-sm">Realiza tu transferencia a la siguiente cuenta:</p>

                    {bankDetails ? (
                      <div className="bg-background/80 p-3 rounded border space-y-1 font-mono text-xs">
                        {bankDetails.bank_name && <p><strong>Banco:</strong> {bankDetails.bank_name} ({bankDetails.bank_account_type})</p>}
                        {bankDetails.bank_account_number && <p><strong>Número:</strong> {bankDetails.bank_account_number}</p>}
                        {bankDetails.nequi_number && <p><strong>Nequi:</strong> {bankDetails.nequi_number}</p>}
                        {bankDetails.daviplata_number && <p><strong>Daviplata:</strong> {bankDetails.daviplata_number}</p>}
                        {bankDetails.bank_titular_name && <p><strong>Titular:</strong> {bankDetails.bank_titular_name}</p>}
                        {bankDetails.bank_titular_id && <p><strong>NIT/CC:</strong> {bankDetails.bank_titular_id}</p>}
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">La escuela no ha configurado sus datos bancarios aún.</p>
                    )}

                    {bankDetails?.payment_qr_url && (
                      <div className="mt-3 text-center flex flex-col items-center">
                        <p className="text-xs font-semibold mb-2">O escanea este QR:</p>
                        <img src={bankDetails.payment_qr_url} alt="QR de Pago" className="w-32 h-32 rounded-lg object-cover shadow-sm border" />
                      </div>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <p className="font-medium text-sm">Sube tu comprobante:</p>
                  <FileUpload
                    bucket="payment-receipts"
                    accept="image/*,application/pdf"
                    validateReceipt={true}
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
            {hasCompleteDianData && (
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
            )}

            <p className="text-xs text-center text-muted-foreground">
              {selectedMethod === 'transfer' ? (
                "Señor usuario, recuerde que el soporte de pago enviado será revisado previamente por la administración para su validación definitiva."
              ) : (
                "🔒 Pago 100% seguro. Tus datos están protegidos."
              )}
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
                Hemos recibido tu comprobante exitosamente.
                Tu pago ahora está en estado "Pendiente de Aprobación" y será validado pronto por la escuela.
                Podrás ver el estado actualizado en tu historial de pagos.
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