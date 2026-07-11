import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2, Shield, AlertCircle, Download, Users, CreditCard, Upload, Eye, EyeOff, Copy, Maximize2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { downloadReceipt } from '@/lib/receipt-generator';
import { usePdfBranding } from '@/hooks/usePdfBranding';
import { openWompiCheckout, generatePaymentReference } from '@/lib/api/wompi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MercadoPagoBrick from '@/components/checkout/MercadoPagoBrick';
import type { MpCreatePaymentResult } from '@/lib/api/mercadopago';
import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';
import { getUserFriendlyError } from '@/lib/error-translator';
import { maskSensitive } from '@/lib/utils';
import { FileUpload } from '@/components/common/FileUpload';
import type { ReceiptValidationResult, ConceptKind } from '@/hooks/useReceiptValidator';
import { useNextUnpaidPeriod, isPeriodActive, type PeriodStatus } from '@/hooks/usePaymentPeriod';

/** Intenta parsear un string como JSON; devuelve null si no es JSON valido. */
function safeParseJson(s: string): unknown | null {
  try { return JSON.parse(s); } catch { return null; }
}

export default function ParentCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { schoolBranding } = useSchoolContext();
  const { toast } = useToast();

  // Copiar un dato de pago (siempre disponible, también en móvil donde no hay hover).
  const copyField = (value: string | null | undefined, label: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast({ title: `${label} copiado`, description: value });
  };

  const [paymentFlow, setPaymentFlow] = useState<'wompi' | 'mercadopago' | 'manual'>('wompi');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [wompiTxId, setWompiTxId] = useState('');
  const [paymentMethodUsed, setPaymentMethodUsed] = useState('');

  // Reference MP generada cuando el padre selecciona MercadoPago.
  // Se persiste para que recordPaymentWithTraceability use la misma referencia.
  const [mpReference, setMpReference] = useState<string>('');
  const [showSensitive, setShowSensitive] = useState(false);
  const [manualReceiptUrl, setManualReceiptUrl] = useState('');
  const [manualOcrResult, setManualOcrResult] = useState<ReceiptValidationResult | null>(null);

  // Feature Flag State
  const [paymentSettings, setPaymentSettings] = useState<{ allow_online: boolean; allow_manual: boolean } | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showFullQr, setShowFullQr] = useState(false);

  // Si venimos del QR de inscripción, el pago YA existe (payment_id). Lo cargamos
  // como fuente de verdad (monto/concepto reales) y al pagar lo ACTUALIZAMOS en vez
  // de crear uno nuevo → evita el pago duplicado sin comprobante.
  const paymentIdParam = searchParams.get('payment_id');
  const [qrPayment, setQrPayment] = useState<{ amount: number; amount_paid: number | null; concept: string; child_id: string | null; team_id: string | null } | null>(null);

  const amount = qrPayment?.amount ?? parseInt(searchParams.get('amount') || '150000');
  // Abono previo (si el pago ya tiene un parcial). Se cobra solo el SALDO.
  const amountPaid = Number(qrPayment?.amount_paid) || 0;
  const balanceDue = Math.max(amount - amountPaid, 0);
  const chargeAmount = amountPaid > 0 ? balanceDue : amount;
  const concept = qrPayment?.concept ?? (searchParams.get('concept') || 'Mensualidad Octubre 2024');
  // Nombres reales: primero lo resuelto del pago (child_id / school_id), luego
  // los query params. NUNCA placeholders demo hardcodeados.
  const studentNameParam = searchParams.get('student') || '';
  const schoolNameParam  = searchParams.get('school')  || '';
  const [resolvedStudentName, setResolvedStudentName] = useState('');
  const [resolvedSchoolName,  setResolvedSchoolName]  = useState('');
  const studentName = resolvedStudentName || studentNameParam || 'Deportista';
  const schoolName  = resolvedSchoolName  || schoolNameParam  || '';
  const teamName = searchParams.get('team') || '';
  const schoolIdParam = searchParams.get('school_id');

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);

  // Concept fijo (bloquea OCR si el monto no coincide) vs lenient (advisory).
  // Por ahora solo mensualidad es 'fixed'; inscripcion/abono pasan como 'lenient'
  // mientras validamos bien esos flujos.
  const conceptKind: ConceptKind = /mensual/i.test(concept) ? 'fixed' : 'lenient';

  const [hasCompleteDianData, setHasCompleteDianData] = useState<boolean>(true);
  const [checkingDian, setCheckingDian] = useState<boolean>(true);

  // Fetch DIAN Profile Data
  useEffect(() => {
    if (user?.id) {
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
  }, [user?.id]);

  const [bankDetails, setBankDetails] = useState<any>(null);

  // Fetch School Settings (Feature Flag)
  useEffect(() => {
    const fetchSchoolSettings = async () => {
      // Multi-tenant safe: prefer explicit school_id, fall back to name.
      // Never use .limit(1) without a filter - would pick arbitrary tenant.
      let query = supabase.from('schools').select('id, payment_settings');

      if (schoolIdParam) {
        query = query.eq('id', schoolIdParam);
      } else if (schoolNameParam) {
        query = query.eq('name', schoolNameParam);
      } else {
        setPaymentSettings({ allow_online: false, allow_manual: true });
        setPaymentFlow('manual');
        setLoadingSettings(false);
        return;
      }

      const { data } = await query.maybeSingle();

      if (data) {
        const settings = data.payment_settings as any || { allow_online: false, allow_manual: true };
        setPaymentSettings(settings);
        // Default Logic
        if (settings.allow_online && !settings.allow_manual) setPaymentFlow('wompi');
        else if (!settings.allow_online && settings.allow_manual) setPaymentFlow('manual');
        else setPaymentFlow('wompi'); // Default fallback
      } else {
        setPaymentSettings({ allow_online: false, allow_manual: true });
        setPaymentFlow('manual');
      }

      // Fetch Bank Details if a school was found
      if (data?.id) {
        const { data: bankData } = await supabase.from('school_settings')
          .select('bank_name, bank_account_type, bank_account_number, nequi_number, daviplata_number, bank_titular_name, bank_titular_id, payment_qr_url')
          .eq('school_id', data.id)
          .single();
        setBankDetails(bankData);
      }

      setLoadingSettings(false);
    };

    fetchSchoolSettings();
  }, [schoolNameParam, schoolIdParam]);

  // Cargar el pago preexistente del QR como fuente de verdad (monto/concepto/ids)
  useEffect(() => {
    if (!paymentIdParam) return;
    supabase.from('payments')
      .select('amount, amount_paid, concept, child_id, team_id')
      .eq('id', paymentIdParam)
      .maybeSingle()
      .then(({ data }) => { if (data) setQrPayment(data as any); });
  }, [paymentIdParam]);

  const pdfBranding = usePdfBranding();

  const handleDownloadReceipt = async () => {
    await downloadReceipt({
      receiptNumber,
      date: new Date().toLocaleDateString('es-CO'),
      customerName: user?.user_metadata?.full_name || 'Cliente',
      customerEmail: user?.email,
      concept,
      amount: chargeAmount,
      paymentMethod: paymentMethodUsed || paymentFlow,
      paymentType: 'monthly',
      schoolName,
      studentName,
      // Feature gate aplicado en usePdfBranding (free -> null + defaults)
      logoUrl: pdfBranding.logoUrl,
      brandingSettings: pdfBranding.brandingSettings,
      receiptUrl: manualReceiptUrl,
    });
  };

  const childId = qrPayment?.child_id ?? searchParams.get('child_id');
  const teamId = qrPayment?.team_id ?? searchParams.get('team_id');

  // Resuelve el nombre real del atleta y de la escuela desde el pago, para que
  // la UI del checkout, la notificación y el recibo no muestren placeholders
  // demo ("Juan Vargas / Spirit All Stars") cuando la URL no trae esos params.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (childId) {
        const { data } = await supabase.from('children').select('full_name').eq('id', childId).maybeSingle();
        if (!cancelled && data?.full_name) setResolvedStudentName(data.full_name);
      }
      let sid = schoolIdParam;
      if (!sid && teamId) {
        const { data: t } = await supabase.from('teams').select('school_id').eq('id', teamId).maybeSingle();
        sid = t?.school_id ?? null;
      }
      if (sid) {
        const { data: s } = await supabase.from('schools').select('name').eq('id', sid).maybeSingle();
        if (!cancelled && s?.name) setResolvedSchoolName(s.name);
      }
    })();
    return () => { cancelled = true; };
  }, [childId, teamId, schoolIdParam]);

  // Periodo objetivo (solo si es mensualidad y hay hijo)
  const isMensualidad = /mensual/i.test(concept);
  const { period: nextPeriod } = useNextUnpaidPeriod(isMensualidad ? childId : null);
  const periodAlreadyCovered =
    !!nextPeriod && isPeriodActive(nextPeriod.current_status as PeriodStatus);

  const recordPaymentWithTraceability = async (reference: string) => {
    // Multi-tenant safe: resolve schoolId from URL or derive from team_id.
    // Never fall back to "any school" - would attach the payment to the wrong tenant.
    let schoolId: string | null = schoolIdParam;
    let ownerId: string | null = null;

    if (!schoolId && teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('school_id')
        .eq('id', teamId)
        .maybeSingle();
      schoolId = team?.school_id ?? null;
    }

    if (schoolId) {
      const { data: schoolRow } = await supabase
        .from('schools')
        .select('owner_id')
        .eq('id', schoolId)
        .maybeSingle();
      ownerId = schoolRow?.owner_id ?? null;
    }

    if (!schoolId) {
      toast({ title: 'Error', description: 'Falta school_id en el checkout', variant: 'destructive' });
      return;
    }

    // Period explicito solo cuando es mensualidad y la RPC nos dio un mes
    const periodYear  = isMensualidad && nextPeriod ? nextPeriod.year  : null;
    const periodMonth = isMensualidad && nextPeriod ? nextPeriod.month : null;
    const periodLabel = isMensualidad && nextPeriod ? nextPeriod.label : null;

    // Campos que se setean al pagar (comunes a insertar y actualizar).
    const mutableFields = {
      // Manual paga "awaiting_approval" (admin valida); Wompi paga "paid" directo
      status: paymentFlow === 'manual' ? 'awaiting_approval' : 'paid',
      payment_date: new Date().toISOString().split('T')[0],
      receipt_number: reference,
      payment_method: paymentFlow === 'wompi' ? 'card' : 'transfer',
      receipt_url: manualReceiptUrl,
      period_year:  periodYear,
      period_month: periodMonth,
      // Persistir OCR del comprobante (solo manual). Admin lo usa para detectar discrepancias.
      ocr_amount:    manualOcrResult?.extractedAmount    ?? null,
      ocr_currency:  manualOcrResult?.extractedCurrency  ?? null,
      ocr_date:      manualOcrResult?.extractedDate      ?? null,
      ocr_bank:      manualOcrResult?.extractedBank      ?? null,
      ocr_reference: manualOcrResult?.extractedReference ?? null,
      ocr_provider:  manualOcrResult?.provider           ?? null,
      ocr_raw_response: manualOcrResult?.rawResponse
        ? safeParseJson(manualOcrResult.rawResponse) ?? manualOcrResult.rawResponse
        : null,
    };

    let insertError;
    if (paymentIdParam) {
      // Vino del QR: ACTUALIZA el pago ya creado (no duplicar). Conserva
      // amount/concept/child/school del pago original.
      ({ error: insertError } = await supabase.from('payments')
        .update({ ...mutableFields, updated_at: new Date().toISOString() } as any)
        .eq('id', paymentIdParam));
    } else {
      ({ error: insertError } = await supabase.from('payments').insert({
        parent_id: user?.id,
        child_id: childId || null,
        team_id: teamId || null,
        amount,
        // Si tenemos label del periodo, usarlo en lugar del concept libre del
        // query string (mas consistente con la fuente de verdad de la BD).
        concept: periodLabel ? `Mensualidad ${periodLabel}` : concept,
        due_date: new Date().toISOString().split('T')[0],
        payment_type: 'one_time',
        school_id: schoolId,
        ...mutableFields,
      } as any));
    }

    if (insertError) {
      console.error('Error inserting payment:', insertError);
      // Conflicto del unique index uq_payments_school_ocr_reference: el
      // numero de operacion bancaria del comprobante ya fue usado en otro
      // pago de esta escuela.
      const isOcrDuplicate = insertError.code === '23505'
        && (insertError.message?.toLowerCase().includes('ocr_reference') ?? false);
      toast({
        title: isOcrDuplicate ? 'Comprobante ya usado' : 'Error',
        description: isOcrDuplicate
          ? 'Este comprobante ya está vinculado a otro pago en esta escuela. Si crees que es un error, contacta a la administración.'
          : 'No se pudo registrar el pago en la base de datos',
        variant: 'destructive',
      });
      return;
    }

    const periodSuffix = periodLabel ? ` — ${periodLabel}` : '';
    const traceMsg = `Pago de ${formatPrice(chargeAmount)} por ${studentName}${teamName ? ` (${teamName})` : ''} en ${schoolName}${periodSuffix}`;

    if (ownerId) {
      await supabase.rpc('notify_user', {
        p_user_id: ownerId,
        p_title: paymentFlow === 'manual'
          ? `Comprobante por validar${periodSuffix}`
          : `Pago Recibido${periodSuffix}`,
        p_message: traceMsg,
        p_type: 'payment',
        p_link: '/finances',
      });
    }

  };

  const handleWompiPayment = async () => {
    if (!user) { toast({ title: 'Inicia sesión', variant: 'destructive' }); navigate('/login'); return; }

    // Security Check
    if (!paymentSettings?.allow_online) {
      toast({ title: 'No disponible', description: 'Esta escuela no acepta pagos en línea.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const reference = generatePaymentReference();
    setReceiptNumber(reference);

    try {
      const customerName = user.user_metadata?.full_name || user.email || 'Padre';
      const customerEmail = user.email || 'demo@sportmaps.co';

      const transaction = await openWompiCheckout({
        reference,
        amountInCents: chargeAmount * 100,
        customerEmail,
        customerName,
        studentName,
        teamName: concept,
        schoolName,
      });

      if (transaction && transaction.status === 'APPROVED') {
        setWompiTxId(transaction.id);
        setPaymentMethodUsed(transaction.paymentMethodType || 'CARD');
        await recordPaymentWithTraceability(reference);
        setSuccess(true);
        toast({ title: '¡Pago exitoso!', description: 'Procesado con Wompi' });
      } else if (transaction && transaction.status === 'PENDING') {
        setWompiTxId(transaction.id);
        toast({ title: 'Pago pendiente', description: 'Te notificaremos cuando se confirme.' });
      } else if (transaction) {
        toast({ title: 'Pago no completado', description: `Estado: ${transaction.status}`, variant: 'destructive' });
      } else {
        toast({ title: 'Pago cancelado', description: 'Cerraste la ventana de pago.' });
      }
    } catch (error) {
      toast({
        title: 'Error en el pago',
        description: getUserFriendlyError(error),
        variant: 'destructive'
      });
    } finally { setProcessing(false); }
  };

  const handleManualPayment = async () => {
    if (!user) { toast({ title: 'Inicia sesión', variant: 'destructive' }); navigate('/login'); return; }

    // Security Check
    if (!paymentSettings?.allow_manual) {
      toast({ title: 'No disponible', description: 'Esta escuela no acepta pagos manuales.', variant: 'destructive' });
      return;
    }

    if (!manualReceiptUrl) {
      toast({ title: 'Sube tu comprobante', description: 'Debes subir la imagen de tu transferencia para continuar.', variant: 'destructive' });
      return;
    }
  
    setProcessing(true);
    const reference = generatePaymentReference();
    setReceiptNumber(reference);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setPaymentMethodUsed('Transferencia manual');
      await recordPaymentWithTraceability(reference);
      setSuccess(true);
      toast({ title: '¡Pago registrado!', description: 'La escuela confirmará tu pago' });
    } catch (error) {
      toast({
        title: 'Error al registrar',
        description: getUserFriendlyError(error),
        variant: 'destructive'
      });
    } finally { setProcessing(false); }
  };

  const handleMpSuccess = async (result: MpCreatePaymentResult) => {
    setProcessing(true);
    try {
      setWompiTxId(String(result.paymentId));
      setPaymentMethodUsed('MercadoPago');
      const ref = mpReference || `SCH-MP-${Date.now().toString(36).toUpperCase()}`;
      setReceiptNumber(ref);
      await recordPaymentWithTraceability(ref);
      setSuccess(true);

      if (result.internalStatus === 'paid') {
        toast({ title: '¡Pago exitoso!', description: 'Procesado con MercadoPago' });
      } else {
        toast({
          title: 'Pago en proceso',
          description: `Estado: ${result.statusDetail}. Te notificaremos cuando se confirme.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error registrando el pago',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleMpError = (err: Error) => {
    toast({
      title: 'Error en MercadoPago',
      description: err.message,
      variant: 'destructive',
    });
  };

  // Genera la reference MP cuando el padre cambia a MercadoPago, para
  // garantizar consistencia entre la creacion del pago y el registro en DB.
  useEffect(() => {
    if (paymentFlow === 'mercadopago' && !mpReference) {
      const ref = `SCH-MP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setMpReference(ref);
    }
  }, [paymentFlow, mpReference]);

  const handlePayment = () => {
    if (paymentFlow === 'wompi') {
      handleWompiPayment();
    } else if (paymentFlow === 'mercadopago') {
      // El Brick maneja su propio submit; este boton no aplica para MP.
      toast({ title: 'Completa los datos en el formulario MercadoPago' });
    } else {
      handleManualPayment();
    }
  };

  if (loadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
            <Badge variant="secondary" className="mb-2">Recibo #{receiptNumber}</Badge>

            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between font-bold text-lg"><span>Pagado</span><span className="text-green-600">{formatPrice(chargeAmount)}</span></div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleDownloadReceipt}>
                <Download className="h-4 w-4 mr-2" />Recibo
              </Button>
              <Button className="flex-1" onClick={() => navigate('/dashboard')}>Salir</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canPayOnline = paymentSettings?.allow_online;
  const canPayManual = paymentSettings?.allow_manual;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-xl font-bold">{schoolName}</h1><p className="text-muted-foreground">Pago</p></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-lg">
        {periodAlreadyCovered && nextPeriod && (
          <div className="mb-4 p-3 rounded-lg border-2 border-amber-300 bg-amber-50 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">
                {nextPeriod.label} ya tiene un pago activo
              </p>
              <p className="text-amber-800 text-xs mt-0.5">
                {nextPeriod.current_status === 'paid' || nextPeriod.current_status === 'approved'
                  ? `Ya pagaste ${nextPeriod.label}.`
                  : `Hay un comprobante de ${nextPeriod.label} esperando validación.`}
                {' '}Si continúas, este pago quedará registrado como un cobro adicional para ese mes.
              </p>
            </div>
          </div>
        )}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {nextPeriod && isMensualidad ? `Mensualidad ${nextPeriod.label}` : (amountPaid > 0 ? `Saldo: ${formatPrice(chargeAmount)}` : `Total: ${formatPrice(amount)}`)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between mb-2"><span className="text-muted-foreground">Concepto</span><span>{nextPeriod && isMensualidad ? `Mensualidad ${nextPeriod.label}` : concept}</span></div>
            <div className="flex justify-between mb-2"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatPrice(amount)}</span></div>
            {amountPaid > 0 && (
              <>
                <div className="flex justify-between mb-2"><span className="text-muted-foreground">Ya abonado</span><span className="font-semibold text-emerald-600">− {formatPrice(amountPaid)}</span></div>
                <div className="flex justify-between mb-2 pt-2 border-t"><span className="text-muted-foreground">Saldo pendiente</span><span className="font-bold text-amber-600">{formatPrice(chargeAmount)}</span></div>
              </>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Deportista</span><span>{studentName}</span></div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Método de Pago</CardTitle></CardHeader>
          <CardContent>
            {!checkingDian && !hasCompleteDianData ? (
              <div className="pt-2">
                <BillingDetailsForm onComplete={() => setHasCompleteDianData(true)} />
              </div>
            ) : (!canPayOnline && !canPayManual) ? (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg">Esta escuela no acepta pagos por este medio.</div>
            ) : (
              <>
                <RadioGroup value={paymentFlow} onValueChange={(v) => setPaymentFlow(v as 'wompi' | 'mercadopago' | 'manual')}>
                  {canPayOnline && (
                    <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer ${paymentFlow === 'wompi' ? 'border-primary bg-primary/5' : ''}`} onClick={() => setPaymentFlow('wompi')}>
                      <RadioGroupItem value="wompi" id="wompi" />
                      <Label htmlFor="wompi" className="cursor-pointer flex-1">
                        <div className="font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> Wompi (Online)</div>
                      </Label>
                    </div>
                  )}

                  {canPayOnline && import.meta.env.VITE_MP_PUBLIC_KEY_DEFAULT && (
                    <div className={`flex flex-col space-y-3 p-4 border rounded-lg cursor-pointer mt-3 ${paymentFlow === 'mercadopago' ? 'border-primary bg-primary/5' : ''}`} onClick={() => setPaymentFlow('mercadopago')}>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="mercadopago" id="mercadopago" />
                        <Label htmlFor="mercadopago" className="cursor-pointer flex-1">
                          <div className="font-medium flex items-center gap-2">
                            <CreditCard className="h-4 w-4" /> MercadoPago (Online)
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Tarjetas, PSE, Efecty, Wallet MP
                          </div>
                        </Label>
                      </div>

                      {paymentFlow === 'mercadopago' && mpReference && (
                        <div className="pl-7 pt-2 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                          <MercadoPagoBrick
                            publicKey={import.meta.env.VITE_MP_PUBLIC_KEY_DEFAULT}
                            sandbox={true}
                            transactionAmount={amount}
                            externalReference={mpReference}
                            payerEmail={user?.email || 'demo@sportmaps.co'}
                            payerFirstName={(user?.user_metadata?.full_name || 'Padre').split(' ')[0]}
                            payerLastName={(user?.user_metadata?.full_name || '').split(' ').slice(1).join(' ') || 'Demo'}
                            description={`${concept} — ${studentName}`}
                            schoolId={schoolIdParam || undefined}
                            onSuccess={handleMpSuccess}
                            onPending={handleMpSuccess}
                            onError={handleMpError}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {canPayManual && (
                    <div className={`flex flex-col space-y-3 p-4 border rounded-lg cursor-pointer mt-3 ${paymentFlow === 'manual' ? 'border-primary bg-primary/5' : ''}`} onClick={() => setPaymentFlow('manual')}>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="manual" id="manual" />
                        <Label htmlFor="manual" className="cursor-pointer flex-1">
                          <div className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Transferencia Manual</div>
                        </Label>
                      </div>

                      {paymentFlow === 'manual' && bankDetails && (
                        <div className="pl-7 pt-2 animate-in fade-in slide-in-from-top-2">
                          <div className="bg-background/80 p-3 rounded border space-y-1 font-mono text-xs mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-muted-foreground font-sans font-semibold">Datos de Transferencia:</p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-[10px] font-sans" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowSensitive(!showSensitive);
                                }}
                              >
                                {showSensitive ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                                {showSensitive ? "Ocultar" : "Mostrar"}
                              </Button>
                            </div>
                            
                            {bankDetails.bank_name && <p><strong>Banco:</strong> {bankDetails.bank_name} ({bankDetails.bank_account_type})</p>}
                            
                            {bankDetails.bank_account_number && (
                              <div className="flex justify-between items-center gap-2">
                                <p><strong>Número:</strong> {showSensitive ? bankDetails.bank_account_number : maskSensitive(bankDetails.bank_account_number)}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 shrink-0 font-sans"
                                  onClick={(e) => { e.stopPropagation(); copyField(bankDetails.bank_account_number, 'Número'); }}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                                </Button>
                              </div>
                            )}

                            {bankDetails.nequi_number && (
                              <div className="flex justify-between items-center gap-2">
                                <p><strong>Nequi:</strong> {showSensitive ? bankDetails.nequi_number : maskSensitive(bankDetails.nequi_number)}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 shrink-0 font-sans"
                                  onClick={(e) => { e.stopPropagation(); copyField(bankDetails.nequi_number, 'Nequi'); }}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                                </Button>
                              </div>
                            )}

                            {bankDetails.daviplata_number && (
                              <div className="flex justify-between items-center gap-2">
                                <p><strong>Daviplata:</strong> {showSensitive ? bankDetails.daviplata_number : maskSensitive(bankDetails.daviplata_number)}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 shrink-0 font-sans"
                                  onClick={(e) => { e.stopPropagation(); copyField(bankDetails.daviplata_number, 'Daviplata'); }}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                                </Button>
                              </div>
                            )}

                            {bankDetails.bank_titular_name && <p><strong>Titular:</strong> {bankDetails.bank_titular_name}</p>}
                            {bankDetails.bank_titular_id && (
                              <div className="flex justify-between items-center gap-2">
                                <p><strong>NIT/CC:</strong> {showSensitive ? bankDetails.bank_titular_id : maskSensitive(bankDetails.bank_titular_id)}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 shrink-0 font-sans"
                                  onClick={(e) => { e.stopPropagation(); copyField(bankDetails.bank_titular_id, 'NIT/CC'); }}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                                </Button>
                              </div>
                            )}
                          </div>

                          {bankDetails.payment_qr_url && (
                            <div className="mt-3 text-center flex flex-col items-center">
                              <p className="text-xs font-semibold mb-2 text-muted-foreground">O escanea este QR:</p>
                              <div 
                                className="relative group cursor-pointer overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                                onClick={(e) => { e.stopPropagation(); setShowFullQr(true); }}
                              >
                                <img 
                                  src={bankDetails.payment_qr_url} 
                                  alt="QR de Pago" 
                                  className="w-24 h-24 object-cover" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[10px] text-white font-medium bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Maximize2 className="h-3 w-3" /> Ampliar
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-1 block">Clic para ampliar 🔍</span>
                            </div>
                          )}
                          
                          <div className="mt-4 pt-4 border-t">
                            <Label className="text-xs font-semibold mb-2 block">Sube tu Comprobante:</Label>
                            <FileUpload
                              bucket="payment-receipts"
                              path={`manual-payments/${user?.id}`}
                              accept="image/*,application/pdf"
                              onUploadComplete={(url) => setManualReceiptUrl(url)}
                              onValidationResult={(r) => setManualOcrResult(r)}
                              validateReceipt={true}
                              expectedAmount={chargeAmount}
                              conceptKind={conceptKind}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </RadioGroup>

                {paymentFlow !== 'mercadopago' && (
                  <>
                    {paymentFlow === 'manual' && manualReceiptUrl && (
                      <div className="mt-4 flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
                        <span className="font-bold whitespace-nowrap">Falta 1 paso:</span>
                        <span>tu comprobante está cargado pero <strong>aún no se ha enviado</strong>. Pulsa el botón de abajo para enviarlo a la escuela.</span>
                      </div>
                    )}
                    <Button className="w-full mt-4" onClick={handlePayment} disabled={processing || (!canPayOnline && !canPayManual)}>
                      {processing
                        ? 'Procesando...'
                        : paymentFlow === 'manual'
                          ? (manualReceiptUrl ? 'Enviar comprobante y registrar pago' : `Registrar pago de ${formatPrice(chargeAmount)}`)
                          : `Pagar ${formatPrice(chargeAmount)}`}
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showFullQr} onOpenChange={setShowFullQr}>
        <DialogContent className="sm:max-w-md max-w-[90vw] rounded-xl p-6 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader className="w-full text-center mb-2">
            <DialogTitle className="text-lg font-bold text-foreground">QR de Pago</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Escanea este código desde la app de tu banco para realizar la transferencia a la escuela
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-white p-4 rounded-xl border shadow-inner flex items-center justify-center max-w-full max-h-[60vh] overflow-hidden">
            <img 
              src={bankDetails?.payment_qr_url || ''} 
              alt="Código QR de Pago Completo" 
              className="max-w-full max-h-[50vh] object-contain rounded-lg transition-transform duration-300 hover:scale-105"
            />
          </div>
          
          <div className="flex gap-3 w-full mt-6">
            <Button 
              variant="outline" 
              className="flex-1 border-primary/20 hover:bg-primary/5 text-xs h-9" 
              onClick={async () => {
                try {
                  const response = await fetch(bankDetails?.payment_qr_url || '');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `qr-pago-${schoolName.toLowerCase().replace(/\s+/g, '-')}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                  toast({ title: "Código QR descargado" });
                } catch (e) {
                  window.open(bankDetails?.payment_qr_url || '', '_blank');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2 text-primary" /> Descargar QR
            </Button>
            <Button 
              className="flex-1 text-xs h-9" 
              onClick={() => setShowFullQr(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
