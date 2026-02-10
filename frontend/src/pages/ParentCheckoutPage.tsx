import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2, Shield, AlertCircle, Download, Users, CreditCard, Building2, Smartphone, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { downloadReceipt } from '@/lib/receipt-generator';
import { openWompiCheckout, generatePaymentReference } from '@/lib/api/wompi';

export default function ParentCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [paymentFlow, setPaymentFlow] = useState<'wompi' | 'manual'>('wompi');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [wompiTxId, setWompiTxId] = useState('');
  const [paymentMethodUsed, setPaymentMethodUsed] = useState('');

  const amount = parseInt(searchParams.get('amount') || '150000');
  const concept = searchParams.get('concept') || 'Mensualidad Octubre 2024';
  const studentName = searchParams.get('student') || 'Juan Vargas';
  const schoolName = searchParams.get('school') || 'Spirit All Stars';
  const teamName = searchParams.get('team') || '';

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);

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
    });
  };

  /**
   * Record payment in Supabase with WHO paid and FOR WHICH student/team
   */
  const recordPaymentWithTraceability = async (reference: string) => {
    await supabase.from('payments').insert({
      parent_id: user!.id, amount, concept, status: 'paid',
      payment_date: new Date().toISOString(),
      due_date: new Date().toISOString().split('T')[0],
      receipt_number: reference, payment_type: 'monthly',
    });

    const traceMsg = `Pago de ${formatPrice(amount)} por ${studentName}${teamName ? ` (${teamName})` : ''} en ${schoolName}`;
    await supabase.from('notifications').insert({
      user_id: user!.id, title: 'Pago Recibido',
      message: traceMsg, type: 'payment', link: '/finances',
    });
  };

  /**
   * FLOW 1: Pay with Wompi (tarjeta, PSE, Nequi, Bancolombia)
   */
  const handleWompiPayment = async () => {
    if (!user) { toast({ title: 'Inicia sesión', variant: 'destructive' }); navigate('/login'); return; }
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

  /**
   * FLOW 2: Manual payment (transferencia/consignación)
   * Simulates the school confirming a manual deposit
   */
  const handleManualPayment = async () => {
    if (!user) { toast({ title: 'Inicia sesión', variant: 'destructive' }); navigate('/login'); return; }
    setProcessing(true);
    const reference = generatePaymentReference();
    setReceiptNumber(reference);

    try {
      // Simulate manual processing delay
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

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
            <p className="text-muted-foreground mb-2">Tu pago ha sido procesado correctamente.</p>
            <Badge variant="secondary" className="mb-2">Recibo #{receiptNumber}</Badge>
            {wompiTxId && <p className="text-xs text-muted-foreground mb-4 font-mono">Wompi TX: {wompiTxId}</p>}

            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between mb-2"><span className="text-muted-foreground">Concepto</span><span className="font-medium">{concept}</span></div>
              <div className="flex justify-between mb-2"><span className="text-muted-foreground">Estudiante</span><span className="font-medium">{studentName}</span></div>
              {teamName && <div className="flex justify-between mb-2"><span className="text-muted-foreground">Equipo</span><span className="font-medium">{teamName}</span></div>}
              <div className="flex justify-between mb-2"><span className="text-muted-foreground">Método</span><span className="font-medium">{paymentMethodUsed}</span></div>
              <Separator className="my-3" />
              <div className="flex justify-between font-bold text-lg"><span>Total pagado</span><span className="text-green-600">{formatPrice(amount)}</span></div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Pagado por: {user?.user_metadata?.full_name || user?.email}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleDownloadReceipt}>
                <Download className="h-4 w-4 mr-2" />Descargar PDF
              </Button>
              <Button className="flex-1" onClick={() => navigate('/dashboard')}>Continuar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <span className="text-muted-foreground">Volver</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <img src="/sportmaps-logo.png" alt="Logo" className="h-10 w-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div><h1 className="text-xl font-bold">{schoolName}</h1><p className="text-muted-foreground">Pago de mensualidad</p></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Payment Details */}
        <Card className="mb-6">
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-lg">Detalle del pago</CardTitle><Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Vencido</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between"><span className="text-muted-foreground">Estudiante</span><span className="font-medium">{studentName}</span></div>
            {teamName && <div className="flex justify-between"><span className="text-muted-foreground">Equipo</span><span className="font-medium">{teamName}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Concepto</span><span className="font-medium">{concept}</span></div>
            <Separator />
            <div className="flex justify-between text-xl font-bold"><span>Total a pagar</span><span className="text-primary">{formatPrice(amount)}</span></div>
          </CardContent>
        </Card>

        {/* Payment Method Selection — Dual: Wompi OR Manual */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">¿Cómo deseas pagar?</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={paymentFlow} onValueChange={(v) => setPaymentFlow(v as 'wompi' | 'manual')}>
              {/* Option 1: Wompi */}
              <div
                className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentFlow === 'wompi' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => setPaymentFlow('wompi')}
              >
                <RadioGroupItem value="wompi" id="wompi" />
                <Label htmlFor="wompi" className="flex items-center gap-3 cursor-pointer flex-1">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Pago en línea (Wompi)</p>
                    <p className="text-sm text-muted-foreground">Tarjeta, PSE, Nequi, Bancolombia</p>
                  </div>
                </Label>
              </div>

              {/* Option 2: Manual */}
              <div
                className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors mt-3 ${paymentFlow === 'manual' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => setPaymentFlow('manual')}
              >
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="flex items-center gap-3 cursor-pointer flex-1">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Transferencia / Consignación</p>
                    <p className="text-sm text-muted-foreground">Pago manual con comprobante</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Wompi info */}
            {paymentFlow === 'wompi' && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-sm text-muted-foreground">
                <p>Se abrirá la ventana segura de <strong>Wompi</strong> para completar tu pago con tarjeta, PSE o Nequi.</p>
              </div>
            )}

            {/* Manual info */}
            {paymentFlow === 'manual' && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm space-y-2">
                <p className="font-medium text-foreground">Datos para transferencia:</p>
                <p className="text-muted-foreground">Banco: <strong>Bancolombia</strong></p>
                <p className="text-muted-foreground">Cuenta: <strong>123-456789-00</strong></p>
                <p className="text-muted-foreground">Titular: <strong>{schoolName}</strong></p>
                <p className="text-xs text-muted-foreground mt-2">Después de pagar, la escuela verificará y confirmará tu pago.</p>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>{paymentFlow === 'wompi' ? 'Procesado por Wompi Colombia — Certificado PCI-DSS' : 'Tu pago será verificado por la escuela'}</span>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full h-12 text-lg" onClick={handlePayment} disabled={processing}>
          {processing ? (
            <><div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Procesando...</>
          ) : paymentFlow === 'wompi' ? (
            <><CreditCard className="h-5 w-5 mr-2" />Pagar {formatPrice(amount)} con Wompi</>
          ) : (
            <><Upload className="h-5 w-5 mr-2" />Registrar pago manual</>
          )}
        </Button>
      </div>
    </div>
  );
}
