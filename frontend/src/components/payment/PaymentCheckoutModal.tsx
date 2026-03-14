import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Smartphone, Loader2, CheckCircle2, XCircle, Info, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

import { FileUpload } from '@/components/common/FileUpload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';
import { emailClient } from '@/lib/email-client';
import { getPaymentPayload, SchoolAthlete } from '@/lib/athleteUtils';

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
  open, onOpenChange, studentId, schoolId, paymentId, programId, amount, concept, mode = 'update', onSuccess
}: PaymentCheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'pse' | 'card' | 'transfer' | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'awaiting_approval'>('idle');
  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingPaymentDate, setPendingPaymentDate] = useState<string | null>(null);
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
        .eq('school_id', schoolId).single()
        .then(({ data }) => setBankDetails(data));
    }
  }, [open, schoolId]);

  useEffect(() => {
    if (open && user?.id) {
      const checkProfile = async () => {
        setCheckingDian(true);
        const { data } = await supabase.from('profiles')
          .select('document_type, document_number, billing_address, billing_city_dane')
          .eq('id', user.id).single();
        setHasCompleteDianData(!!(data?.document_type && data?.document_number && data?.billing_address && data?.billing_city_dane));
        setCheckingDian(false);
      };
      checkProfile();
    }
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !studentId) return;
    const checkPendingPayment = async () => {
      setCheckingPending(true);
      setPendingPaymentDate(null);
      try {
        const response = await supabase.from('school_athletes' as any).select('athlete_type').eq('id', studentId).single();
        const athleteData = response.data as unknown as { athlete_type: string } | null;
        const idField = athleteData?.athlete_type === 'adult' ? 'user_id' : 'child_id';

        const query = (supabase as any).from('payments').select('id, payment_date, created_at')
          .eq(idField, studentId).eq('status', 'awaiting_approval').limit(1);
        if (mode === 'update' && paymentId) query.neq('id', paymentId);
        const { data, error } = await query;
        if (error) { console.error('[PaymentCheckoutModal]', error); return; }
        if (data && data.length > 0) {
          const rawDate = data[0].payment_date || data[0].created_at;
          setPendingPaymentDate(rawDate ? new Date(rawDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : null);
        }
      } finally {
        setCheckingPending(false);
      }
    };
    checkPendingPayment();
  }, [open, studentId, paymentId, mode]);

  useEffect(() => {
    if (!open) {
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setProofUrl(null);
      setPendingPaymentDate(null);
    }
  }, [open]);

  const paymentMethods = [
    { id: 'transfer' as const, name: 'Transferencia / Nequi / Daviplata', description: 'Nequi, Daviplata o transferencia bancaria', icon: Smartphone, popular: true, enabled: true },
    { id: 'pse' as const, name: 'PSE', description: 'Pago con débito bancario', icon: Building2, popular: false, enabled: false },
    { id: 'card' as const, name: 'Tarjeta', description: 'Visa o Mastercard', icon: CreditCard, popular: false, enabled: false },
  ];

  const processPayment = async () => {
    if (processing) return;
    setProcessing(true);
    setPaymentStatus('processing');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: athleteData } = await supabase
        .from('school_athletes' as any)
        .select('*')
        .eq('id', studentId)
        .single();
      const athlete = athleteData as unknown as SchoolAthlete;
      const payloadIds = getPaymentPayload(athlete);

      const idColumn = athlete.athlete_type === 'adult' ? 'user_id' : 'child_id';
      const duplicateQuery = (supabase as any).from('payments').select('id')
        .eq(idColumn, athlete.id)
        .eq('status', 'awaiting_approval').limit(1);
      if (mode === 'update' && paymentId) duplicateQuery.neq('id', paymentId);
      const { data: pendingPayments, error: pendingError } = await duplicateQuery;
      if (pendingError) throw pendingError;
      if (pendingPayments && pendingPayments.length > 0)
        throw new Error('Ya existe un pago pendiente de aprobación para este estudiante.');

      if (mode === 'update' && paymentId && paymentId !== '') {
        const { data: existingPayment, error: fetchError } = await supabase.from('payments').select('school_id, status').eq('id', paymentId).single();
        if (fetchError || !existingPayment) throw new Error('No se encontró el pago pendiente.');
        if (existingPayment.status === 'paid') throw new Error('Este pago ya fue procesado.');
      }

      if (selectedMethod === 'transfer') {
        if (!proofUrl) throw new Error('Debes subir un comprobante de pago');
        if (mode === 'update' && paymentId) {
          const { error: updateError } = await supabase.from('payments').update({ 
            status: 'awaiting_approval', 
            payment_method: 'transfer', 
            payment_date: new Date().toISOString().split('T')[0], 
            receipt_url: proofUrl, 
            updated_at: new Date().toISOString() 
          }).eq('id', paymentId);
          if (updateError) throw updateError;
        } else {
          const response = await supabase.from('school_athletes' as any).select('branch_id').eq('id', studentId).maybeSingle();
          const studentData = response.data as unknown as { branch_id: string } | null;
          const { error: insertError } = await supabase.from('payments').insert({ 
            parent_id: user?.id, 
            ...payloadIds, 
            program_id: (programId && programId !== '') ? programId : null, 
            school_id: (schoolId && schoolId !== '') ? schoolId : null, 
            branch_id: studentData?.branch_id || null, 
            amount, 
            concept, 
            status: 'awaiting_approval', 
            payment_method: 'transfer', 
            payment_type: 'one_time',
            payment_date: new Date().toISOString().split('T')[0], 
            due_date: new Date().toISOString().split('T')[0], 
            receipt_url: proofUrl 
          });
          if (insertError) throw insertError;
        }
        setPaymentStatus('awaiting_approval');
        toast({ title: "Pago registrado", description: "Tu cupo ha sido reservado. Validaremos tu comprobante pronto." });
        setTimeout(() => { onSuccess?.(); onOpenChange(false); }, 3000);
        return;
      }

      const receiptNumber = `MAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      let error = null;
      if (mode === 'update' && paymentId) {
        const { error: updateError } = await supabase.from('payments').update({ 
          status: 'paid', 
          payment_method: selectedMethod, 
          payment_date: new Date().toISOString().split('T')[0], 
          receipt_number: receiptNumber, 
          updated_at: new Date().toISOString() 
        }).eq('id', paymentId);
        error = updateError;
      } else {
        const response = await supabase.from('school_athletes' as any).select('branch_id').eq('id', studentId).maybeSingle();
        const studentData = response.data as unknown as { branch_id: string } | null;
        const { error: insertError } = await supabase.from('payments').insert({ 
          parent_id: user?.id, 
          ...payloadIds, 
          program_id: (programId && programId !== '') ? programId : null, 
          school_id: (schoolId && schoolId !== '') ? schoolId : null, 
          branch_id: studentData?.branch_id || null, 
          amount, 
          concept, 
          status: 'paid', 
          payment_method: selectedMethod, 
          payment_type: 'one_time',
          payment_date: new Date().toISOString().split('T')[0], 
          due_date: new Date().toISOString().split('T')[0], 
          receipt_number: receiptNumber 
        });
        error = insertError;
      }
      if (error) throw error;

      // Notificar al padre/atleta por email (fire-and-forget)
      supabase
        .from('school_athletes' as any)
        .select('full_name, parent_email')
        .eq('id', studentId)
        .single()
        .then((response: any) => {
          const child = response.data as { full_name: string; parent_email: string } | null;
          const parentEmail = athlete.athlete_type === 'adult' ? user?.email : child?.parent_email;
          if (parentEmail) {
            emailClient.send({
              type: 'payment_confirmation',
              to: parentEmail,
              data: {
                studentName: child?.full_name || 'tu cuenta',
                amount: formatCurrency(amount),
                concept,
                paymentMethod: selectedMethod === 'pse' ? 'PSE' : 'Tarjeta',
              },
            }).catch(() => {/* silencio — no interrumpir flujo si email falla */ });
          }
        });

      setPaymentStatus('success');
      toast({ title: "¡Pago exitoso!", description: `Tu pago de ${formatCurrency(amount)} fue procesado correctamente` });
      setTimeout(() => { onSuccess?.(); onOpenChange(false); setPaymentStatus('idle'); setSelectedMethod(null); }, 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setPaymentStatus('error');
      toast({ title: "Error en el pago", description: err.message || "No se pudo procesar tu pago.", variant: "destructive" });
      setTimeout(() => setPaymentStatus('idle'), 2000);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => { if (!processing) onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/*
        RESPONSIVE KEY:
        - Mobile (<sm): w-[100vw] h-[100dvh] rounded-none → full screen sheet
        - sm+: max-w-md centrado con border-radius normal
        El dvh (dynamic viewport height) evita el problema del teclado virtual en iOS
      */}
      <DialogContent className="
        w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none overflow-y-auto p-4
        sm:w-full sm:max-w-md sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:p-6
      ">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl sm:text-2xl">Realizar Pago</DialogTitle>
          <DialogDescription>Selecciona tu método de pago preferido</DialogDescription>
        </DialogHeader>

        {/* Estado 1: Verificando */}
        {checkingPending && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 mx-auto text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Verificando pagos pendientes...</p>
          </div>
        )}

        {/* Estado 2: Bloqueado */}
        {!checkingPending && pendingPaymentDate !== null && paymentStatus === 'idle' && (
          <div className="py-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-9 w-9 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-amber-600">Pago en espera de validación</h3>
              <p className="text-sm text-muted-foreground px-4">
                Ya existe un comprobante enviado el <span className="font-medium text-foreground">{pendingPaymentDate}</span> pendiente de aprobación.
              </p>
              <p className="text-xs text-muted-foreground px-6">
                No puedes registrar un nuevo pago hasta que ese comprobante sea aprobado o rechazado.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Entendido</Button>
          </div>
        )}

        {/* Estado 3: Formulario */}
        {!checkingPending && pendingPaymentDate === null && paymentStatus === 'idle' && (
          <div className="space-y-5 py-2">
            {/* Resumen */}
            <div className="bg-primary/5 rounded-lg p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Concepto</p>
              <p className="font-semibold text-base leading-tight">{concept}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
                <p className="text-sm text-muted-foreground">/mes</p>
              </div>
              <p className="text-xs text-muted-foreground">Pago recurrente mensual.</p>
            </div>

            {/* Métodos */}
            <div className="space-y-3">
              <p className="font-medium text-sm">Método de pago:</p>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedMethod === method.id;
                const isDisabled = !method.enabled;
                return (
                  <button
                    key={method.id}
                    onClick={() => !isDisabled && setSelectedMethod(method.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 p-3 sm:p-4 border-2 rounded-lg transition-all text-left ${isDisabled ? 'border-border/50 opacity-50 cursor-not-allowed bg-muted/30'
                      : isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDisabled ? 'bg-muted/50' : isSelected ? 'bg-primary text-white' : 'bg-muted'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{method.name}</p>
                        {method.popular && method.enabled && <Badge variant="secondary" className="text-xs">Recomendado</Badge>}
                        {isDisabled && <Badge variant="outline" className="text-xs text-muted-foreground">Próximamente</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                    {isSelected && !isDisabled && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Formulario DIAN si falta */}
            {selectedMethod && !checkingDian && !hasCompleteDianData && (
              <div className="pt-4 border-t">
                <BillingDetailsForm onComplete={() => setHasCompleteDianData(true)} />
              </div>
            )}

            {/* Datos bancarios */}
            {selectedMethod === 'transfer' && hasCompleteDianData && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <Alert variant="default" className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4 text-primary shrink-0" />
                  <AlertTitle className="text-primary font-bold text-sm">Información de Transferencia</AlertTitle>
                  <AlertDescription className="space-y-2 mt-2">
                    <p className="text-sm">Realiza tu transferencia a la siguiente cuenta:</p>
                    {bankDetails ? (
                      <div className="bg-background/80 p-3 rounded border space-y-1 font-mono text-xs break-all">
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
                        <img src={bankDetails.payment_qr_url} alt="QR de Pago" className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg object-cover shadow-sm border" />
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <p className="font-medium text-sm">Sube tu comprobante:</p>
                  <FileUpload bucket="payment-receipts" accept="image/*,application/pdf" validateReceipt={true} onUploadComplete={(url) => setProofUrl(url)} />
                  {proofUrl && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Comprobante cargado correctamente
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Botones acción */}
            {hasCompleteDianData && (
              <div className="space-y-2 pt-2">
                <Button className="w-full" size="lg" disabled={!selectedMethod || processing} onClick={processPayment}>
                  {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</> : `Pagar ${formatCurrency(amount)}`}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleClose} disabled={processing}>Cancelar</Button>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              {selectedMethod === 'transfer'
                ? "El comprobante será revisado por la administración antes de validarse."
                : "🔒 Pago 100% seguro."}
            </p>
          </div>
        )}

        {/* Estado: Procesando */}
        {paymentStatus === 'processing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
            <div>
              <h3 className="text-lg font-semibold">Procesando tu pago...</h3>
              <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
            </div>
          </div>
        )}

        {/* Estado: Éxito */}
        {paymentStatus === 'success' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">¡Pago exitoso!</h3>
              <p className="text-sm text-muted-foreground">Tu pago de {formatCurrency(amount)} fue procesado correctamente</p>
            </div>
          </div>
        )}

        {/* Estado: En verificación */}
        {paymentStatus === 'awaiting_approval' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="h-10 w-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-600">Pago en Verificación</h3>
              <p className="text-sm text-muted-foreground px-4">
                Hemos recibido tu comprobante. Será validado pronto por la escuela.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Entendido</Button>
          </div>
        )}

        {/* Estado: Error */}
        {paymentStatus === 'error' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-600">Pago rechazado</h3>
              <p className="text-sm text-muted-foreground">No se pudo procesar tu pago. Por favor, inténtalo de nuevo.</p>
            </div>
            <Button onClick={() => setPaymentStatus('idle')}>Intentar de nuevo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}