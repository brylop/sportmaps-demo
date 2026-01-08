import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Building2, Smartphone, CheckCircle2, Shield, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { downloadReceipt } from '@/lib/receipt-generator';

export default function ParentCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [paymentMethod, setPaymentMethod] = useState<'pse' | 'nequi'>('pse');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');

  const amount = parseInt(searchParams.get('amount') || '150000');
  const concept = searchParams.get('concept') || 'Mensualidad Octubre 2024';
  const studentName = searchParams.get('student') || 'Juan Vargas';
  const schoolName = searchParams.get('school') || 'Academia Deportiva Los Campeones';

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);

  const handleDownloadReceipt = () => {
    downloadReceipt({
      receiptNumber,
      date: new Date().toLocaleDateString('es-CO'),
      customerName: user?.user_metadata?.full_name || 'Cliente',
      customerEmail: user?.email,
      concept,
      amount,
      paymentMethod,
      paymentType: 'monthly',
      schoolName,
      studentName,
    });
  };

  const handlePayment = async () => {
    if (!user) { toast({ title: 'Inicia sesión', variant: 'destructive' }); navigate('/login'); return; }
    setProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const newReceiptNumber = `SPM-${Date.now().toString(36).toUpperCase()}`;
      setReceiptNumber(newReceiptNumber);

      await supabase.from('payments').insert({
        parent_id: user.id, amount, concept, status: 'paid',
        payment_date: new Date().toISOString(), due_date: new Date().toISOString().split('T')[0],
        receipt_number: newReceiptNumber, payment_type: 'monthly',
      });

      await supabase.from('notifications').insert({
        user_id: user.id, title: 'Pago Recibido',
        message: `Pago de ${formatPrice(amount)} recibido`, type: 'payment', link: '/finances',
      });

      setSuccess(true);
      toast({ title: '¡Pago exitoso!', description: 'Tu pago ha sido procesado correctamente' });
    } catch (error) {
      toast({ title: 'Error en el pago', variant: 'destructive' });
    } finally { setProcessing(false); }
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
            <Badge variant="secondary" className="mb-6">Recibo #{receiptNumber}</Badge>
            
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between mb-2"><span className="text-muted-foreground">Concepto</span><span className="font-medium">{concept}</span></div>
              <div className="flex justify-between mb-2"><span className="text-muted-foreground">Estudiante</span><span className="font-medium">{studentName}</span></div>
              <Separator className="my-3" />
              <div className="flex justify-between font-bold text-lg"><span>Total pagado</span><span className="text-green-600">{formatPrice(amount)}</span></div>
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
        <Card className="mb-6">
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-lg">Detalle del pago</CardTitle><Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Vencido</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between"><span className="text-muted-foreground">Estudiante</span><span className="font-medium">{studentName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Concepto</span><span className="font-medium">{concept}</span></div>
            <Separator />
            <div className="flex justify-between text-xl font-bold"><span>Total a pagar</span><span className="text-primary">{formatPrice(amount)}</span></div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Método de pago</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'pse' | 'nequi')}>
              <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'pse' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => setPaymentMethod('pse')}>
                <RadioGroupItem value="pse" id="pse" />
                <Label htmlFor="pse" className="flex items-center gap-3 cursor-pointer flex-1">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Building2 className="h-5 w-5 text-blue-600" /></div>
                  <div><p className="font-medium">PSE</p><p className="text-sm text-muted-foreground">Débito desde tu banco</p></div>
                </Label>
              </div>
              <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors mt-3 ${paymentMethod === 'nequi' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => setPaymentMethod('nequi')}>
                <RadioGroupItem value="nequi" id="nequi" />
                <Label htmlFor="nequi" className="flex items-center gap-3 cursor-pointer flex-1">
                  <div className="h-10 w-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center"><Smartphone className="h-5 w-5 text-pink-600" /></div>
                  <div><p className="font-medium">Nequi</p><p className="text-sm text-muted-foreground">Pago desde la app Nequi</p></div>
                </Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground"><Shield className="h-4 w-4" /><span>Transacción segura y encriptada</span></div>
          </CardContent>
        </Card>

        <Button className="w-full h-12 text-lg" onClick={handlePayment} disabled={processing}>
          {processing ? (<><div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Procesando...</>) : `Pagar ${formatPrice(amount)}`}
        </Button>
      </div>
    </div>
  );
}
