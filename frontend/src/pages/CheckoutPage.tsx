import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
<<<<<<< HEAD
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CreditCard, Building, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const checkoutSchema = z.object({
  full_name: z.string().min(3, 'Nombre completo requerido'),
  phone: z.string().min(10, 'Teléfono válido requerido'),
  address: z.string().min(10, 'Dirección completa requerida'),
  city: z.string().min(3, 'Ciudad requerida'),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
  payment_method: z.enum(['card', 'pse']),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      payment_method: 'card',
    },
  });

  const shippingCost = total >= 100000 ? 0 : 15000;
  const finalTotal = total + shippingCost;

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // In a real app, you would:
    // 1. Create order in database
    // 2. Process payment with Stripe/PSE
    // 3. Send confirmation email
    // 4. Update inventory

    setIsProcessing(false);
    setOrderComplete(true);
    clearCart();
    toast.success('¡Pedido realizado con éxito!');
  };

  if (items.length === 0 && !orderComplete) {
    navigate('/shop');
    return null;
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pedido Confirmado!</h2>
            <p className="text-muted-foreground mb-6">
              Tu pedido ha sido procesado exitosamente. Recibirás un email de confirmación en breve.
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => navigate('/shop')}>
                Seguir Comprando
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
                Ver Mis Pedidos
=======
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  CreditCard, 
  Building2, 
  ShoppingCart,
  School,
  Package,
  Calendar,
  CheckCircle2,
  Download,
  Shield
} from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { downloadReceipt } from '@/lib/receipt-generator';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, getTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pse'>('card');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');

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

  const handlePayment = async () => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para completar la compra',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    setProcessing(true);

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newReceiptNumber = `SPM-${Date.now().toString(36).toUpperCase()}`;
      setReceiptNumber(newReceiptNumber);

      // Process each item type
      for (const item of items) {
        if (item.type === 'enrollment' && item.metadata.programId) {
          // Create enrollment
          await supabase.from('enrollments').insert({
            user_id: user.id,
            program_id: item.metadata.programId,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          });

          // Create payment record
          await supabase.from('payments').insert({
            parent_id: user.id,
            amount: item.price,
            concept: `Inscripción: ${item.name}`,
            status: 'paid',
            payment_date: new Date().toISOString(),
            due_date: new Date().toISOString().split('T')[0],
            receipt_number: newReceiptNumber,
            payment_type: 'one_time',
          });

          // Notify school
          if (item.metadata.schoolId) {
            const { data: school } = await supabase
              .from('schools')
              .select('owner_id')
              .eq('id', item.metadata.schoolId)
              .single();

            if (school?.owner_id) {
              await supabase.from('notifications').insert({
                user_id: school.owner_id,
                title: 'Nueva Inscripción',
                message: `Nueva inscripción en ${item.name}`,
                type: 'enrollment',
                link: '/students',
              });
            }
          }

          // Add to calendar
          await supabase.from('calendar_events').insert({
            user_id: user.id,
            title: `Inicio: ${item.name}`,
            event_type: 'enrollment',
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 3600000).toISOString(),
          });
        }

        if (item.type === 'product' && item.metadata.productId) {
          // Create order
          await supabase.from('orders').insert({
            user_id: user.id,
            items: [{
              product_id: item.metadata.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            }],
            total: item.price * item.quantity,
            status: 'pending',
            shipping_address: { pending: true },
          });

          // Notify vendor
          if (item.metadata.vendorId) {
            await supabase.from('notifications').insert({
              user_id: item.metadata.vendorId,
              title: 'Nueva Venta',
              message: `Vendiste ${item.quantity}x ${item.name}`,
              type: 'sale',
              link: '/store/orders',
            });
          }
        }

        if (item.type === 'appointment' && item.metadata.professionalId) {
          // Create appointment
          await supabase.from('wellness_appointments').insert({
            professional_id: item.metadata.professionalId,
            athlete_id: user.id,
            appointment_date: item.metadata.appointmentDate,
            appointment_time: item.metadata.appointmentTime || '10:00',
            service_type: item.metadata.serviceType || item.name,
            status: 'confirmed',
          });

          // Notify professional
          await supabase.from('notifications').insert({
            user_id: item.metadata.professionalId,
            title: 'Nueva Cita',
            message: `Nueva cita para ${item.name} el ${item.metadata.appointmentDate}`,
            type: 'appointment',
            link: '/wellness/schedule',
          });
        }
      }

      // Notify user
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Compra Exitosa',
        message: `Tu pedido #${newReceiptNumber} ha sido confirmado`,
        type: 'payment',
        link: '/payments',
      });

      setSuccess(true);
      toast({
        title: '¡Pago exitoso!',
        description: 'Tu compra ha sido procesada correctamente',
      });

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Error en el pago',
        description: 'Hubo un problema al procesar tu pago. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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
      paymentMethod: paymentMethod,
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
            <Badge variant="secondary" className="mb-6">
              Recibo #{receiptNumber}
            </Badge>

            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold mb-3">Resumen de compra</h3>
              {enrollments.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <School className="h-4 w-4 text-primary" />
                  <span className="text-sm">{enrollments.length} inscripción(es)</span>
                </div>
              )}
              {products.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-accent" />
                  <span className="text-sm">{products.reduce((c, i) => c + i.quantity, 0)} producto(s)</span>
                </div>
              )}
              {appointments.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{appointments.length} cita(s)</span>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex justify-between font-bold">
                <span>Total pagado</span>
                <span className="text-primary">{formatPrice(getTotal())}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleDownloadReceipt}>
                <Download className="h-4 w-4 mr-2" />
                Descargar Recibo
              </Button>
              <Button className="flex-1" onClick={handleContinue}>
                Continuar
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

<<<<<<< HEAD
  if (isProcessing) {
    return <LoadingSpinner fullScreen text="Procesando pago..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Shipping Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Información de Envío</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Juan Pérez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="3001234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dirección</FormLabel>
                          <FormControl>
                            <Input placeholder="Calle 123 #45-67" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ciudad</FormLabel>
                            <FormControl>
                              <Input placeholder="Bogotá" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="postal_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código Postal (Opcional)</FormLabel>
                            <FormControl>
                              <Input placeholder="110111" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas de Entrega (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Instrucciones especiales..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Payment Method */}
                <Card>
                  <CardHeader>
                    <CardTitle>Método de Pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="space-y-3"
                            >
                              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                                <RadioGroupItem value="card" id="card" />
                                <label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                                  <CreditCard className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-semibold">Tarjeta de Crédito/Débito</p>
                                    <p className="text-sm text-muted-foreground">Pago seguro con tarjeta</p>
                                  </div>
                                </label>
                              </div>
                              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                                <RadioGroupItem value="pse" id="pse" />
                                <label htmlFor="pse" className="flex items-center gap-3 cursor-pointer flex-1">
                                  <Building className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-semibold">PSE</p>
                                    <p className="text-sm text-muted-foreground">Pago a través de tu banco</p>
                                  </div>
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Button type="submit" size="lg" className="w-full">
                  Completar Pedido - ${finalTotal.toLocaleString('es-CO')}
                </Button>
              </form>
            </Form>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => {
                  const itemPrice = item.discount
                    ? item.price * (1 - item.discount / 100)
                    : item.price;

                  return (
                    <div key={item.id} className="flex gap-3">
                      <img
                        src={item.image_url || '/placeholder.svg'}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded bg-muted"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                        <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                        <p className="text-sm font-semibold">
                          ${(itemPrice * item.quantity).toLocaleString('es-CO')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${total.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Envío</span>
                    <span>{shippingCost === 0 ? 'Gratis' : `$${shippingCost.toLocaleString('es-CO')}`}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">${finalTotal.toLocaleString('es-CO')}</span>
                  </div>
=======
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

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Método de pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'card' | 'pse')}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Tarjeta de crédito/débito</p>
                        <p className="text-sm text-muted-foreground">Visa, Mastercard, Amex</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 mt-3">
                    <RadioGroupItem value="pse" id="pse" />
                    <Label htmlFor="pse" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">PSE - Débito bancario</p>
                        <p className="text-sm text-muted-foreground">Pago desde tu banco</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === 'card' && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label>Número de tarjeta</Label>
                      <Input placeholder="1234 5678 9012 3456" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Vencimiento</Label>
                        <Input placeholder="MM/AA" className="mt-1" />
                      </div>
                      <div>
                        <Label>CVV</Label>
                        <Input placeholder="123" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Nombre en la tarjeta</Label>
                      <Input placeholder="Como aparece en la tarjeta" className="mt-1" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Pago seguro encriptado con SSL</span>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                </div>
              </CardContent>
            </Card>
          </div>
<<<<<<< HEAD
=======

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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        </div>
      </div>
    </div>
  );
}
