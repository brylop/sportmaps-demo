import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  CreditCard,
  ShoppingCart,
  School,
  Package,
  Calendar,
  CheckCircle2,
  Download,
  Shield,
  Users,
  Upload
} from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { downloadReceipt } from '@/lib/receipt-generator';
import { checkoutAPI } from '@/lib/api/checkout';
import { openWompiCheckout, generatePaymentReference } from '@/lib/api/wompi';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, getTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  const [paymentFlow, setPaymentFlow] = useState<'wompi' | 'manual'>('wompi');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [wompiTransactionId, setWompiTransactionId] = useState('');
  const [paymentMethodUsed, setPaymentMethodUsed] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const enrollments = items.filter((i) => i.type === 'enrollment');
  const products = items.filter((i) => i.type === 'product');
  const appointments = items.filter((i) => i.type === 'appointment');

  /**
   * After a successful payment (Wompi callback or manual confirmation),
   * register the enrollment/order in Supabase with full traceability:
   * WHO paid, for WHICH program/team
   */
  const processPostPayment = async (reference: string, transactionId?: string) => {
    for (const item of items) {
      if (item.type === 'enrollment' && item.metadata.programId) {
        const result = await checkoutAPI.processEnrollment({
          student_id: user!.id,
          parent_id: user!.id,
          class_id: item.metadata.programId,
          school_id: item.metadata.schoolId,
          amount: item.price,
          payment_method: paymentMethodUsed || paymentFlow,
        });
        if (!result.success) throw new Error(result.error || 'Enrollment failed');
      }

      if (item.type === 'product' && item.metadata.productId) {
        // 1. Create the parent order
        const { data: orderData, error: orderError } = await supabase.from('orders').insert({
          user_id: user!.id,
          total_amount: item.price * item.quantity,
          status: 'pending',
          shipping_address: { pending: true },
          contact_email: user!.email,
          payment_method: paymentMethodUsed || paymentFlow,
        }).select().single();

        if (orderError) throw orderError;

        // 2. Create the order items
        if (orderData) {
          await supabase.from('order_items').insert({
            order_id: orderData.id,
            product_id: item.metadata.productId,
            quantity: item.quantity,
            unit_price: item.price,
          });
        }

        if (item.metadata.vendorId) {
          await supabase.rpc('notify_user', {
            p_user_id: item.metadata.vendorId,
            p_title: 'Nueva Venta',
            p_message: `Vendiste ${item.quantity}x ${item.name}`,
            p_type: 'sale',
            p_link: '/orders',
          });
        }
      }

      if (item.type === 'appointment' && item.metadata.professionalId) {
        await supabase.from('wellness_appointments').insert({
          professional_id: item.metadata.professionalId, athlete_id: user!.id,
          appointment_date: item.metadata.appointmentDate,
          appointment_time: item.metadata.appointmentTime || '10:00',
          service_type: item.metadata.serviceType || item.name, status: 'confirmed',
        });
        await supabase.rpc('notify_user', {
          p_user_id: item.metadata.professionalId,
          p_title: 'Nueva Cita',
          p_message: `Nueva cita para ${item.name} el ${item.metadata.appointmentDate}`,
          p_type: 'appointment',
          p_link: '/wellness/schedule',
        });
      }
    }

    // Notify user with traceability summary
    const itemSummary = items.map(i => `${i.name} (${i.metadata?.schoolName || 'SportMaps'})`).join(', ');
    await supabase.rpc('send_notification', {
      p_title: 'Compra Exitosa',
      p_message: `Pedido #${reference} confirmado: ${itemSummary}`,
      p_type: 'payment',
      p_link: '/my-payments',
    });
  };

  /**
   * FLOW 1: Pay with Wompi (tarjeta, PSE, Nequi, Bancolombia)
   */
  const handleWompiPayment = async () => {
    if (!user) {
      toast({ title: 'Inicia sesión', description: 'Debes iniciar sesión para completar la compra', variant: 'destructive' });
      navigate('/login');
      return;
    }

    setProcessing(true);
    const reference = generatePaymentReference();
    setReceiptNumber(reference);

    try {
      const customerName = user.user_metadata?.full_name || user.email || 'Cliente';
      const customerEmail = user.email || 'demo@sportmaps.co';
      const totalCents = getTotal() * 100;

      const transaction = await openWompiCheckout({
        reference,
        amountInCents: totalCents,
        customerEmail,
        customerName,
        studentName: customerName,
        programName: items[0]?.name,
        schoolName: items[0]?.metadata?.schoolName || 'SportMaps',
      });

      if (transaction && transaction.status === 'APPROVED') {
        setWompiTransactionId(transaction.id);
        setPaymentMethodUsed(transaction.paymentMethodType || 'CARD');
        await processPostPayment(reference, transaction.id);
        setSuccess(true);
        toast({ title: '¡Pago exitoso!', description: 'Tu compra ha sido procesada con Wompi' });
      } else if (transaction && transaction.status === 'PENDING') {
        setWompiTransactionId(transaction.id);
        toast({ title: 'Pago pendiente', description: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.' });
      } else if (transaction) {
        toast({ title: 'Pago no completado', description: `Estado: ${transaction.status}. Intenta de nuevo.`, variant: 'destructive' });
      } else {
        toast({ title: 'Pago cancelado', description: 'Cerraste la ventana de pago. Puedes intentar de nuevo.' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({ title: 'Error en el pago', description: 'Hubo un problema al procesar tu pago.', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  /**
   * FLOW 2: Manual payment (transferencia/consignación)
   */
  const handleManualPayment = async () => {
    if (!user) {
      toast({ title: 'Inicia sesión', description: 'Debes iniciar sesión para completar la compra', variant: 'destructive' });
      navigate('/login');
      return;
    }

    setProcessing(true);
    const reference = generatePaymentReference();
    setReceiptNumber(reference);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setPaymentMethodUsed('Transferencia manual');
      await processPostPayment(reference);
      setSuccess(true);
      toast({ title: '¡Pago registrado!', description: 'La escuela confirmará tu pago' });
    } catch (error) {
      console.error('Manual payment error:', error);
      toast({ title: 'Error al registrar', description: 'Intenta nuevamente.', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = () => {
    if (paymentFlow === 'wompi') {
      handleWompiPayment();
    } else {
      handleManualPayment();
    }
  };

  const handleDownloadReceipt = () => {
    downloadReceipt({
      receiptNumber,
      date: new Date().toLocaleDateString('es-CO'),
      customerName: user?.user_metadata?.full_name || 'Cliente',
      customerEmail: user?.email,
      concept: items.map(i => i.name).join(', '),
      amount: getTotal(),
      paymentMethod: paymentMethodUsed || paymentFlow,
      paymentType: 'one_time',
      schoolName: items[0]?.metadata.schoolName,
      programName: items[0]?.name,
    });
  };

  const handleContinue = () => {
    clearCart();
    navigate('/dashboard');
  };

  if (items.length === 0 && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Carrito vacío</h2>
            <p className="text-muted-foreground mb-6">
              No hay productos en tu carrito
            </p>
            <Button onClick={() => navigate('/explore')}>
              Explorar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
            <p className="text-muted-foreground mb-2">
              Tu compra ha sido procesada correctamente
            </p>
            <Badge variant="secondary" className="mb-2">
              Recibo #{receiptNumber}
            </Badge>
            {wompiTransactionId && (
              <p className="text-xs text-muted-foreground mb-4 font-mono">Wompi TX: {wompiTransactionId}</p>
            )}

            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold mb-3">Resumen de compra</h3>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 mb-2">
                  {item.type === 'enrollment' && <School className="h-4 w-4 text-primary" />}
                  {item.type === 'product' && <Package className="h-4 w-4 text-accent" />}
                  {item.type === 'appointment' && <Calendar className="h-4 w-4 text-green-600" />}
                  <div className="flex-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.metadata?.schoolName && (
                      <span className="text-xs text-muted-foreground ml-1">• {item.metadata.schoolName}</span>
                    )}
                  </div>
                  <span className="text-sm font-bold">{formatPrice(item.price)}</span>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex justify-between font-bold">
                <span>Total pagado</span>
                <span className="text-primary">{formatPrice(getTotal())}</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Pagado por: {user?.user_metadata?.full_name || user?.email}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleDownloadReceipt}>
                <Download className="h-4 w-4 mr-2" />
                Descargar Recibo
              </Button>
              <Button className="flex-1" onClick={handleContinue}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Checkout</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Resumen del pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {enrollments.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                    <School className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <span className="font-bold">{formatPrice(item.price)}</span>
                  </div>
                ))}
                {products.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-accent/5 rounded-lg">
                    <Package className="h-5 w-5 text-accent" />
                    <div className="flex-1">
                      <p className="font-medium">{item.name} x{item.quantity}</p>
                      <p className="text-sm text-muted-foreground">{item.metadata.vendorName}</p>
                    </div>
                    <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                {appointments.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-green-500/5 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.metadata.appointmentDate} • {item.metadata.appointmentTime}
                      </p>
                    </div>
                    <span className="font-bold">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Payment Method — Dual: Wompi OR Manual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Método de pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentFlow} onValueChange={(v) => setPaymentFlow(v as 'wompi' | 'manual')}>
                  {/* Wompi */}
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

                  {/* Manual */}
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

                {paymentFlow === 'wompi' && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-sm text-muted-foreground">
                    <p>Se abrirá la ventana segura de <strong>Wompi</strong> para completar tu pago.</p>
                  </div>
                )}

                {paymentFlow === 'manual' && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm space-y-1">
                    <p className="font-medium text-foreground">Datos para transferencia:</p>
                    <p className="text-muted-foreground">Banco: <strong>Bancolombia</strong> • Cuenta: <strong>123-456789-00</strong></p>
                    <p className="text-xs text-muted-foreground">La escuela verificará y confirmará tu pago.</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>{paymentFlow === 'wompi' ? 'Procesado por Wompi Colombia — Certificado PCI-DSS' : 'Pago verificado por la escuela'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Total */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Total a pagar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {enrollments.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Inscripciones ({enrollments.length})</span>
                    <span>{formatPrice(enrollments.reduce((t, i) => t + i.price, 0))}</span>
                  </div>
                )}
                {products.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Productos ({products.reduce((c, i) => c + i.quantity, 0)})</span>
                    <span>{formatPrice(products.reduce((t, i) => t + i.price * i.quantity, 0))}</span>
                  </div>
                )}
                {appointments.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Citas ({appointments.length})</span>
                    <span>{formatPrice(appointments.reduce((t, i) => t + i.price, 0))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(getTotal())}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <div className="loading-spinner h-4 w-4 mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pagar {formatPrice(getTotal())}
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Al continuar aceptas los términos y condiciones
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
