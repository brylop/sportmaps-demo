import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, CheckCircle2, XCircle, AlertCircle, Download, Loader2, DollarSign } from 'lucide-react';
import { getAthletePayments, submitAthleteInstallment } from '@/lib/athlete/queries';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Payment {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_provider: string | null;
  receipt_url: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending:    { label: 'Pendiente',   icon: Clock,       color: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: 'Procesando', icon: Loader2,     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved:   { label: 'Aprobado',   icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:   { label: 'Rechazado',  icon: XCircle,     color: 'bg-red-100 text-red-700 border-red-200' },
  refunded:   { label: 'Reembolsado', icon: AlertCircle, color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function AthletePaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    if (user) fetchPayments();
  }, [user, activeTab]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const result = await getAthletePayments({
        status: activeTab === 'pending' ? 'pending' : null,
        page: 1,
        limit: 100 // Temporarily 100 to show all without full pagination UI for now
      });
      setPayments(result.data || []);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (err) {
      console.error('Error fetching payments:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pagos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const pendingPaymentsCount = summary?.count_pending || 0;
  const historyPaymentsCount = summary?.count_approved || 0;
  const totalPending = (summary?.pending_cents || 0) / 100;
  const totalApprovedCount = summary?.count_approved || 0;

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-CO')}`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Mis Pagos</h1>
        <p className="text-muted-foreground">Gestiona tus pagos y consulta tu historial.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-xl font-bold">{pendingPaymentsCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monto pendiente</p>
              <p className="text-xl font-bold">${totalPending.toLocaleString('es-CO')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pagos realizados</p>
              <p className="text-xl font-bold">{totalApprovedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingPaymentsCount})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Historial ({historyPaymentsCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {payments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
                <h3 className="font-semibold text-lg">¡Estás al día!</h3>
                <p className="text-muted-foreground mt-1">No tienes pagos pendientes.</p>
              </CardContent>
            </Card>
          ) : (
            payments.map(payment => (
              <PaymentCard 
                key={payment.id} 
                payment={payment} 
                formatCurrency={formatCurrency} 
                formatDate={formatDate} 
                onRefresh={fetchPayments}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {payments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <h3 className="font-semibold text-lg">Sin historial</h3>
                <p className="text-muted-foreground mt-1">Aquí aparecerán los pagos completados.</p>
              </CardContent>
            </Card>
          ) : (
            payments.map(payment => (
              <PaymentCard 
                key={payment.id} 
                payment={payment} 
                formatCurrency={formatCurrency} 
                formatDate={formatDate} 
                onRefresh={fetchPayments} 
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentCard({ payment, formatCurrency, formatDate, onRefresh }: {
  payment: any;
  formatCurrency: (cents: number) => string;
  formatDate: (dateStr: string) => string;
  onRefresh: () => void;
}) {
  const [showAbonar, setShowAbonar] = useState(false);
  const config = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${config.color.split(' ')[0]}`}>
                <StatusIcon className={`h-6 w-6 ${config.color.split(' ')[1]}`} />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground leading-none">
                  {payment.program_name || 'Servicio deportivo'}
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg">{formatCurrency(payment.amount_cents)}</p>
                  <Badge variant="outline" className={config.color}>
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {payment.due_date && <span>Vence: {formatDate(payment.due_date)}</span>}
                  {payment.paid_at && <span>Pagado: {formatDate(payment.paid_at)}</span>}
                  {payment.school_name && <span className="flex items-center gap-1">• {payment.school_name}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {payment.receipt_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    Comprobante
                  </a>
                </Button>
              )}
              {payment.status === 'pending' && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowAbonar(true)}>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Abonar / Pagar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <PaymentAbonarModal 
        open={showAbonar} 
        onOpenChange={setShowAbonar} 
        payment={payment} 
        onSuccess={() => {
          setShowAbonar(false);
          onRefresh();
        }} 
      />
    </>
  );
}

function PaymentAbonarModal({ open, onOpenChange, payment, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: any;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState((payment.amount_cents / 100).toString());
  const [method, setMethod] = useState('nequi');
  const [receiptUrl, setReceiptUrl] = useState('');

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const amountCents = parseFloat(amount) * 100;
      
      if (isNaN(amountCents) || amountCents <= 0 || amountCents > payment.amount_cents) {
        toast({
          title: 'Monto inválido',
          description: 'Por favor ingresa un monto válido (no mayor a la deuda).',
          variant: 'destructive'
        });
        return;
      }

      await submitAthleteInstallment({
        athlete_payment_id: payment.id,
        amount_cents: amountCents,
        receipt_url: receiptUrl || 'https://placeholder-receipt.url', // Placeholder if not provided
        receipt_date: new Date().toISOString().split('T')[0],
        payment_method: method
      });

      toast({
        title: '¡Pago enviado!',
        description: 'Tu comprobante está siendo revisado por la escuela.',
      });
      onSuccess();
    } catch (err) {
      console.error('Error submitting installment:', err);
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Abono o Pago</DialogTitle>
          <DialogDescription>
            Informa a la escuela sobre un pago realizado para {payment.program_name || 'este servicio'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Monto a pagar (COP)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input 
                type="number" 
                className="pl-8" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                max={payment.amount_cents / 100}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Deuda total: ${(payment.amount_cents / 100).toLocaleString('es-CO')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Método de Pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nequi">Nequi</SelectItem>
                <SelectItem value="daviplata">Daviplata</SelectItem>
                <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Link del Comprobante (Opcional)</Label>
            <Input 
              placeholder="https://..." 
              value={receiptUrl} 
              onChange={(e) => setReceiptUrl(e.target.value)} 
            />
            <p className="text-[10px] text-muted-foreground">
              Sube tu captura a Drive/Dropbox y pega el link aquí para agilizar la revisión.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700" 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
