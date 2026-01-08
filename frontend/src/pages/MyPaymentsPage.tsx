import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, CheckCircle2, XCircle, Clock, Calendar, Download, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { formatCurrency } from '@/lib/demo-data';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  reference: string;
  transaction_date: string;
  authorization_code?: string;
}

interface Subscription {
  id: string;
  program_id: string;
  amount: number;
  payment_method: string;
  status: string;
  next_charge_date: string;
  card_last4?: string;
  bank_name?: string;
}

export default function MyPaymentsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPaymentData();
    }
  }, [user]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      
      // Fetch transactions
      const txnResponse = await fetch(`/api/payments/transactions/${user?.id || 'demo_parent'}`);
      const txnData = await txnResponse.json();
      setTransactions(txnData.transactions || []);

      // Fetch subscriptions
      const subResponse = await fetch(`/api/payments/subscriptions/${user?.id || 'demo_parent'}`);
      const subData = await subResponse.json();
      setSubscriptions(subData.subscriptions || []);
    } catch (error) {
      console.error('Error fetching payment data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de pagos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      const response = await fetch(`/api/payments/cancel-subscription/${subscriptionId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Suscripción cancelada",
          description: "Tu suscripción ha sido cancelada exitosamente"
        });
        fetchPaymentData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cancelar la suscripción",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Aprobado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'pse':
        return '🏦';
      case 'card':
      case 'tarjeta':
        return '💳';
      case 'nequi':
        return '📱';
      default:
        return '💰';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">💳 Mis Pagos</h1>
          <p className="text-muted-foreground">Gestiona tus pagos y suscripciones</p>
        </div>
        <Button onClick={() => setShowCheckout(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pago
        </Button>
      </div>

      {/* Active Subscriptions */}
      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suscripciones Activas</CardTitle>
            <CardDescription>
              {subscriptions.length} suscripción(es) con cobro automático
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="font-semibold">Programa {sub.program_id}</p>
                    <Badge variant="default">Activo</Badge>
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(sub.amount)}/mes</p>
                  <p className="text-sm text-muted-foreground">
                    Próximo cobro: {new Date(sub.next_charge_date).toLocaleDateString('es-CO')}
                  </p>
                  {sub.card_last4 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      💳 Tarjeta terminada en {sub.card_last4}
                    </p>
                  )}
                  {sub.bank_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      🏦 {sub.bank_name}
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCancelSubscription(sub.id)}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="approved">Aprobadas</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Transacciones</CardTitle>
                <CardDescription>Todos tus pagos realizados</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        {new Date(txn.transaction_date).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          {getPaymentMethodIcon(txn.payment_method)}
                          {txn.payment_method.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(txn.amount)}</TableCell>
                      <TableCell>{getStatusBadge(txn.status)}</TableCell>
                      <TableCell>
                        {txn.status === 'approved' && (
                          <Button variant="ghost" size="sm">
                            Ver Recibo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Aprobados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Código</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.status === 'approved').map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        {new Date(txn.transaction_date).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(txn.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {txn.authorization_code}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.filter(t => t.status === 'pending').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.filter(t => t.status === 'pending').map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          {new Date(txn.transaction_date).toLocaleDateString('es-CO')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(txn.amount)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            Completar Pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No tienes pagos pendientes
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Checkout Modal */}
      <PaymentCheckoutModal 
        open={showCheckout}
        onOpenChange={setShowCheckout}
        studentId={user?.id || 'demo_student'}
        programId="prog_1"
        amount={220000}
        programName="Fútbol Juvenil"
        onSuccess={fetchPaymentData}
      />
    </div>
  );
}