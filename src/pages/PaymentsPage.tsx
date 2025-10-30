import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { CreditCard, Download, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PaymentsPage() {
  const { user } = useAuth();

  const { data: payments, isLoading, error, refetch } = useQuery({
    queryKey: ['payments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('parent_id', user?.id)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const pendingPayment = payments?.find((p) => p.status === 'pending');
  const paidPayments = payments?.filter((p) => p.status === 'paid') || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'pending':
        return 'Pendiente';
      case 'overdue':
        return 'Vencido';
      default:
        return status;
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando información de pagos..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error al cargar"
        message="No pudimos cargar tu información de pagos"
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pagos</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus pagos y consulta tu historial de transacciones
        </p>
      </div>

      {/* Estado de Cuenta */}
      <Card className={pendingPayment ? 'border-yellow-500 border-2' : 'border-green-500 border-2'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {pendingPayment ? (
                  <>
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                    <h3 className="text-2xl font-bold">Pago Pendiente</h3>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <h3 className="text-2xl font-bold text-green-500">¡Estás al día!</h3>
                  </>
                )}
              </div>
              {pendingPayment && (
                <>
                  <p className="text-3xl font-bold">{formatCurrency(Number(pendingPayment.amount))}</p>
                  <p className="text-sm text-muted-foreground">
                    Vence el{' '}
                    {new Date(pendingPayment.due_date).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </>
              )}
            </div>
            {pendingPayment && (
              <Button size="lg" className="gap-2">
                <CreditCard className="w-5 h-5" />
                Pagar Ahora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Próximo Pago Pendiente */}
      {pendingPayment && (
        <Card>
          <CardHeader>
            <CardTitle>Próximo Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-accent/50">
                <div>
                  <p className="font-semibold text-lg">{pendingPayment.concept}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vence: {new Date(pendingPayment.due_date).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatCurrency(Number(pendingPayment.amount))}</p>
                  <Badge variant={getStatusColor(pendingPayment.status)}>
                    {getStatusLabel(pendingPayment.status)}
                  </Badge>
                </div>
              </div>
              <Button className="w-full gap-2" size="lg">
                <CreditCard className="w-5 h-5" />
                Realizar Pago
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de Transacciones */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <CardTitle>Historial de Transacciones</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {payments?.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{payment.concept}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {payment.status === 'paid' && payment.payment_date
                          ? `Pagado el ${new Date(payment.payment_date).toLocaleDateString('es-CO')}`
                          : `Vence el ${new Date(payment.due_date).toLocaleDateString('es-CO')}`}
                      </p>
                      {payment.receipt_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Recibo #{payment.receipt_number}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{formatCurrency(Number(payment.amount))}</p>
                      <Badge variant={getStatusColor(payment.status)} className="mt-1">
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </div>
                  </div>
                </div>
                {payment.status === 'paid' && (
                  <Button variant="outline" size="sm" className="ml-4 gap-2">
                    <Download className="w-4 h-4" />
                    Ver Recibo
                  </Button>
                )}
                {payment.status === 'pending' && (
                  <Button size="sm" className="ml-4">
                    Pagar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
