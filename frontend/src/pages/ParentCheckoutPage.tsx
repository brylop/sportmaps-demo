import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2, Shield, AlertCircle, Download, Users, CreditCard, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { downloadReceipt } from '@/lib/receipt-generator';
import { openWompiCheckout, generatePaymentReference } from '@/lib/api/wompi';
import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';

export default function ParentCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { schoolBranding } = useSchoolContext();
  const { toast } = useToast();

  const [paymentFlow, setPaymentFlow] = useState<'wompi' | 'manual'>('wompi');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [wompiTxId, setWompiTxId] = useState('');
  const [paymentMethodUsed, setPaymentMethodUsed] = useState('');

  // Feature Flag State
  const [paymentSettings, setPaymentSettings] = useState<{ allow_online: boolean; allow_manual: boolean } | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const amount = parseInt(searchParams.get('amount') || '150000');
  const concept = searchParams.get('concept') || 'Mensualidad Octubre 2024';
  const studentName = searchParams.get('student') || 'Juan Vargas';
  const schoolName = searchParams.get('school') || 'Spirit All Stars';
  const teamName = searchParams.get('team') || '';

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);

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
      let query = supabase.from('schools').select('id, payment_settings').limit(1);

      if (schoolName) {
        query = query.eq('name', schoolName);
      }

      const { data, error } = await query.maybeSingle();

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
  }, [schoolName]);

  const handleDownloadReceipt = () => {
    downloadReceipt({
      receiptNumber,
      date: new Date().toLocaleDateString('es-CO'),
      customerName: user?.user_metadata?.full_name || 'Cliente',
      customerEmail: user?.email,
      concept,
      amount,
      paymentMethod: paymentMethodUsed || paymentFlow,
      paymentType: 'monthly',
      schoolName,
      studentName,
      logoUrl: schoolBranding?.logo_url,
      brandingSettings: schoolBranding?.branding_settings,
    });
  };

  const recordPaymentWithTraceability = async (reference: string) => {
    // Resolve School ID (Robustly)
    let schoolId = null;
    let ownerId = null;
    const { data: demoSchool } = await supabase
      .from('schools')
      .select('id, owner_id')
      .eq('email', 'spoortmaps+school@gmail.com')
      .maybeSingle();

    if (demoSchool) {
      schoolId = demoSchool.id;
      ownerId = demoSchool.owner_id;
    } else {
      const { data: anySchool } = await supabase
        .from('schools')
        .select('id, owner_id')
        .limit(1)
        .maybeSingle();
      if (anySchool) {
        schoolId = anySchool.id;
        ownerId = anySchool.owner_id;
      }
    }

    if (!schoolId) {
      toast({ title: 'Error', description: 'No se encontró una escuela válida', variant: 'destructive' });
      return;
    }

    await supabase.from('payments').insert({
      parent_id: user!.id, amount, concept, status: 'paid',
      payment_date: new Date().toISOString(),
      due_date: new Date().toISOString().split('T')[0],
      receipt_number: reference, payment_type: 'monthly',
      school_id: schoolId
    });

    const traceMsg = `Pago de ${formatPrice(amount)} por ${studentName}${teamName ? ` (${teamName})` : ''} en ${schoolName}`;

    if (ownerId) {
      await supabase.rpc('notify_user', {
        p_user_id: ownerId,
        p_title: 'Pago Recibido',
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
        amountInCents: amount * 100,
        customerEmail,
        customerName,
        studentName,
        programName: concept,
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
      toast({ title: 'Error en el pago', variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  const handleManualPayment = async () => {
    if (!user) { toast({ title: 'Inicia sesión', variant: 'destructive' }); navigate('/login'); return; }

    // Security Check
    if (!paymentSettings?.allow_manual) {
      toast({ title: 'No disponible', description: 'Esta escuela no acepta pagos manuales.', variant: 'destructive' });
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
      toast({ title: 'Error al registrar', variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  const handlePayment = () => {
    if (paymentFlow === 'wompi') {
      handleWompiPayment();
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
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-green-600">{formatPrice(amount)}</span></div>
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
        <Card className="mb-6">
          <CardHeader><CardTitle>Total: {formatPrice(amount)}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between mb-2"><span className="text-muted-foreground">Concepto</span><span>{concept}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estudiante</span><span>{studentName}</span></div>
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
                <RadioGroup value={paymentFlow} onValueChange={(v) => setPaymentFlow(v as 'wompi' | 'manual')}>
                  {canPayOnline && (
                    <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer ${paymentFlow === 'wompi' ? 'border-primary bg-primary/5' : ''}`} onClick={() => setPaymentFlow('wompi')}>
                      <RadioGroupItem value="wompi" id="wompi" />
                      <Label htmlFor="wompi" className="cursor-pointer flex-1">
                        <div className="font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> Wompi (Online)</div>
                      </Label>
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
                            <p className="text-muted-foreground font-sans mb-2 font-semibold">Datos de Transferencia:</p>
                            {bankDetails.bank_name && <p><strong>Banco:</strong> {bankDetails.bank_name} ({bankDetails.bank_account_type})</p>}
                            {bankDetails.bank_account_number && <p><strong>Número:</strong> {bankDetails.bank_account_number}</p>}
                            {bankDetails.nequi_number && <p><strong>Nequi:</strong> {bankDetails.nequi_number}</p>}
                            {bankDetails.daviplata_number && <p><strong>Daviplata:</strong> {bankDetails.daviplata_number}</p>}
                            {bankDetails.bank_titular_name && <p><strong>Titular:</strong> {bankDetails.bank_titular_name}</p>}
                            {bankDetails.bank_titular_id && <p><strong>NIT/CC:</strong> {bankDetails.bank_titular_id}</p>}
                          </div>

                          {bankDetails.payment_qr_url && (
                            <div className="mt-3 text-center flex flex-col items-center">
                              <p className="text-xs font-semibold mb-2">O escanea este QR:</p>
                              <img src={bankDetails.payment_qr_url} alt="QR de Pago" className="w-24 h-24 rounded-lg object-cover shadow-sm border" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </RadioGroup>

                <Button className="w-full mt-6" onClick={handlePayment} disabled={processing || (!canPayOnline && !canPayManual)}>
                  {processing ? 'Procesando...' : `Pagar ${formatPrice(amount)}`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
