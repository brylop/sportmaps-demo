import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, CheckCircle2, XCircle, Clock, Calendar, Download, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ childName: string; programName: string; amount: number }>({
    childName: '',
    programName: 'Firesquad (Senior L3)',
    amount: 180000,
  });

  // Placeholder for real children logic (to be implemented with useChildren hook)
  const demoChildren: any[] = [];

  useEffect(() => {
    if (user) {
      fetchPaymentData();
    }
  }, [user]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);

      // Fetch payments from Supabase
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('parent_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (!error && payments && payments.length > 0) {
        // Map Supabase payments to Transaction format
        const txns: Transaction[] = payments.map(p => ({
          id: p.id,
          amount: p.amount,
          payment_method: p.payment_type || 'transfer',
          status: p.status === 'paid' ? 'approved' : p.status,
          reference: p.receipt_number || `SP-${p.id.slice(0, 8).toUpperCase()}`,
          transaction_date: p.payment_date || p.created_at,
          authorization_code: p.status === 'paid' ? `AUTH-${p.id.slice(0, 5).toUpperCase()}` : undefined,
        }));
        setTransactions(txns);
      }

      // No mock subscriptions anymore
      setSubscriptions([]);
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    toast({
      title: "Suscripción cancelada",
      description: "Tu suscripción ha sido cancelada exitosamente"
    });
    setSubscriptions(prev => prev.filter(s => s.id !== subscriptionId));
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
    <div className="space-y-4 md:space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold truncate">💳 Mis Pagos</h1>
          <p className="text-sm md:text-base text-muted-foreground truncate">Gestiona tus pagos y suscripciones</p>
        </div>
        <Button onClick={() => setShowChildPicker(true)} size="sm" className="w-full md:w-auto">
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
              <div className="overflow-x-auto -mx-2 md:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Fecha</TableHead>
                        <TableHead className="whitespace-nowrap">Referencia</TableHead>
                        <TableHead className="whitespace-nowrap">Método</TableHead>
                        <TableHead className="whitespace-nowrap">Monto</TableHead>
                        <TableHead className="whitespace-nowrap">Estado</TableHead>
                        <TableHead className="whitespace-nowrap">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">
                            {new Date(txn.transaction_date).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="flex items-center gap-1 text-xs md:text-sm">
                              {getPaymentMethodIcon(txn.payment_method)}
                              <span className="hidden md:inline">{txn.payment_method.toUpperCase()}</span>
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold whitespace-nowrap text-xs md:text-sm">{formatCurrency(txn.amount)}</TableCell>
                          <TableCell>{getStatusBadge(txn.status)}</TableCell>
                          <TableCell>
                            {txn.status === 'approved' && (
                              <Button variant="ghost" size="sm" className="text-xs">
                                Ver Recibo
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
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

      {/* Child Picker Dialog */}
      <Dialog open={showChildPicker} onOpenChange={setShowChildPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Para quién es el pago?</DialogTitle>
            <DialogDescription>
              Selecciona el hijo/a al que deseas realizarle el pago de mensualidad.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {demoChildren.map((child) => (
              <button
                key={child.id}
                className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 hover:border-primary transition-all text-left"
                onClick={() => {
                  setSelectedPayment({
                    childName: child.name,
                    programName: child.program,
                    amount: child.amount,
                  });
                  setShowChildPicker(false);
                  setShowCheckout(true);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold">
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{child.name}</p>
                    <p className="text-xs text-muted-foreground">{child.program}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{formatCurrency(child.amount)}</p>
                  <p className="text-xs text-muted-foreground">/mes</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Checkout Modal */}
      <PaymentCheckoutModal
        open={showCheckout}
        onOpenChange={setShowCheckout}
        studentId={user?.id || 'demo_student'}
        programId="prog_1"
        amount={selectedPayment.amount}
        concept={`${selectedPayment.programName} — ${selectedPayment.childName}`}
        mode="create"
        onSuccess={fetchPaymentData}
      />
    </div>
  );
}