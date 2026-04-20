import { useState, useEffect } from 'react';
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
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { downloadReceipt } from '@/lib/receipt-generator';
import { transactionsAPI } from '@/lib/api/transactions';
import { maskSensitive } from '@/lib/utils';
import { Eye, EyeOff, Copy } from 'lucide-react';

export interface PaymentItem {
  type: 'enrollment' | 'product' | 'appointment' | 'reservation';
  id: string; // The ID of the item being paid for (e.g. program ID)
  name: string;
  description?: string;
  amount: number;
  schoolId?: string;
  schoolName?: string;
  teamId?: string;
  teamName?: string;
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pse' | 'manual'>('manual');
  const [paymentType, setPaymentType] = useState<'one_time' | 'subscription'>('one_time');
  const [processing, setProcessing] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [proofUploaded, setProofUploaded] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { schoolBranding } = useSchoolContext();
  const [showSensitive, setShowSensitive] = useState(false);
  const [bankSettings, setBankSettings] = useState<any>(null);
  const [loadingBank, setLoadingBank] = useState(false);

  // Fetch school banking settings if we have a schoolId
  useEffect(() => {
    if (!item.schoolId) return;
    const fetchBank = async () => {
      setLoadingBank(true);
      const { data } = await supabase
        .from('school_settings')
        .select('bank_name, bank_account_type, bank_account_number, nequi_number, daviplata_number, bank_titular_name, bank_titular_id')
        .eq('school_id', item.schoolId)
        .maybeSingle();
      if (data) setBankSettings(data);
      setLoadingBank(false);
    };
    fetchBank();
  }, [item.schoolId]);

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
      logoUrl: schoolBranding?.logo_url,
      brandingSettings: schoolBranding?.branding_settings,
    });
  };

  const handlePayment = async () => {
    if (processing) return;

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

      // Use TransactionAPI for consolidated post-payment processing
      const result = await transactionsAPI.processPurchase({
        userId: user.id,
        email: user.email || '',
        paymentMethod: paymentMethod,
        reference: newReceiptNumber,
        items: [{
          id: item.id,
          type: item.type as any,
          name: item.name,
          description: item.description || '',
          price: item.amount,
          quantity: 1,
          metadata: {
            schoolId: item.schoolId,
            teamId: item.teamId,
            childId: item.childId,
            vendorId: item.vendorId,
          }
        }]
      });

      if (!result.success) throw new Error(result.error);

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
                  {/* Manual / Transfer (Nequi, Daviplata) - ACTIVE */}
                  <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50 ${paymentMethod === 'manual' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="manual" id="manual" className="sr-only" />
                      <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">Transferencia / Nequi / Daviplata</p>
                          <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Sube tu comprobante de pago</p>
                      </div>
                    </div>
                    {paymentMethod === 'manual' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </label>

                  {/* Card - DISABLED (Próximamente) */}
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 opacity-50 cursor-not-allowed bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100/50 text-blue-400 flex items-center justify-center">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-muted-foreground">Tarjeta de Crédito / Débito</p>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">Próximamente</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Procesamiento inmediato</p>
                      </div>
                    </div>
                  </div>

                  {/* PSE - DISABLED (Próximamente) */}
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 opacity-50 cursor-not-allowed bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-purple-100/50 text-purple-400 flex items-center justify-center">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-muted-foreground">PSE / Wompi</p>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">Próximamente</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Transferencia bancaria segura</p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Manual Payment Instructions */}
              {paymentMethod === 'manual' && (
                <div className="animate-in slide-in-from-top-2 fade-in space-y-4">
                  <div className="bg-amber-50 text-amber-900 p-4 rounded-lg text-sm border border-amber-100">
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Datos Bancarios
                        </h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-[10px]" 
                          onClick={() => setShowSensitive(!showSensitive)}
                        >
                          {showSensitive ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showSensitive ? "Ocultar" : "Mostrar"}
                        </Button>
                      </div>

                      {loadingBank ? (
                        <div className="flex items-center gap-2 py-2">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span className="text-[10px]">Cargando datos...</span>
                        </div>
                      ) : bankSettings ? (
                        <>
                          {bankSettings.bank_name && (
                            <div className="flex justify-between items-center group">
                              <p>Banco: <span className="font-medium">{bankSettings.bank_name} ({bankSettings.bank_account_type})</span></p>
                            </div>
                          )}
                          {bankSettings.bank_account_number && (
                            <div className="flex justify-between items-center group">
                              <p>Cuenta: <span className="font-medium">{showSensitive ? bankSettings.bank_account_number : maskSensitive(bankSettings.bank_account_number)}</span></p>
                              {showSensitive && (
                                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(bankSettings.bank_account_number)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                          {bankSettings.nequi_number && (
                            <div className="flex justify-between items-center group">
                              <p>Nequi: <span className="font-medium">{showSensitive ? bankSettings.nequi_number : maskSensitive(bankSettings.nequi_number)}</span></p>
                              {showSensitive && (
                                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(bankSettings.nequi_number)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                          {bankSettings.daviplata_number && (
                            <div className="flex justify-between items-center group">
                              <p>Daviplata: <span className="font-medium">{showSensitive ? bankSettings.daviplata_number : maskSensitive(bankSettings.daviplata_number)}</span></p>
                              {showSensitive && (
                                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(bankSettings.daviplata_number)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                          {bankSettings.bank_titular_name && <p>Titular: <span className="font-medium">{bankSettings.bank_titular_name}</span></p>}
                          {bankSettings.bank_titular_id && (
                            <div className="flex justify-between items-center group">
                              <p>NIT/CC: <span className="font-medium">{showSensitive ? bankSettings.bank_titular_id : maskSensitive(bankSettings.bank_titular_id)}</span></p>
                              {showSensitive && (
                                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(bankSettings.bank_titular_id)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-2 border border-dashed rounded text-[10px] text-muted-foreground">
                          Contacta a la escuela para los datos de transferencia.
                        </div>
                      )}
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
