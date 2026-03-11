import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, CheckCircle2, XCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { getAthletePayments } from '@/lib/athlete/queries';
import { useToast } from '@/hooks/use-toast';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchPayments();
  }, [user]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await getAthletePayments(user!.id);
      setPayments(data || []);
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

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const completedPayments = payments.filter(p => ['approved', 'rejected', 'refunded'].includes(p.status));
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount_cents, 0) / 100;

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
              <p className="text-xl font-bold">{pendingPayments.length}</p>
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
              <p className="text-xl font-bold">{completedPayments.filter(p => p.status === 'approved').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingPayments.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Historial ({completedPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingPayments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
                <h3 className="font-semibold text-lg">¡Estás al día!</h3>
                <p className="text-muted-foreground mt-1">No tienes pagos pendientes.</p>
              </CardContent>
            </Card>
          ) : (
            pendingPayments.map(payment => (
              <PaymentCard key={payment.id} payment={payment} formatCurrency={formatCurrency} formatDate={formatDate} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {completedPayments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <h3 className="font-semibold text-lg">Sin historial</h3>
                <p className="text-muted-foreground mt-1">Aquí aparecerán los pagos completados.</p>
              </CardContent>
            </Card>
          ) : (
            completedPayments.map(payment => (
              <PaymentCard key={payment.id} payment={payment} formatCurrency={formatCurrency} formatDate={formatDate} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentCard({ payment, formatCurrency, formatDate }: {
  payment: Payment;
  formatCurrency: (cents: number) => string;
  formatDate: (dateStr: string) => string;
}) {
  const config = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color.split(' ')[0]}`}>
            <StatusIcon className={`h-5 w-5 ${config.color.split(' ')[1]}`} />
          </div>
          <div>
            <p className="font-semibold">{formatCurrency(payment.amount_cents)}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {payment.due_date && <span>Vence: {formatDate(payment.due_date)}</span>}
              {payment.paid_at && <span>Pagado: {formatDate(payment.paid_at)}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
          {payment.receipt_url && (
            <Button variant="ghost" size="icon" asChild>
              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
          {payment.status === 'pending' && (
            <Button size="sm">
              <CreditCard className="h-4 w-4 mr-1" />
              Pagar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
