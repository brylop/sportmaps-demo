import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, CheckCircle2, XCircle, Clock, Calendar, Download, Plus, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { InstallmentCheckoutModal } from '@/components/payment/InstallmentCheckoutModal';
import { formatCurrency, getStoragePath } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Loader2, Info, Percent } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Enrollment {
  id: string;
  child_id: string;
  program_id: string | null;
  team_id: string | null;
  school_id: string;
  children: {
    full_name: string;
  } | null;
  teams: {
    name: string;
    price_monthly: number;
  } | null;
  schools: {
    name: string;
  } | null;
}

interface ViewingProof {
  open: boolean;
  url: string;
  concept: string;
  amount: number;
}

interface Transaction {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  reference: string;
  transaction_date: string;
  authorization_code?: string;
  receipt_url?: string;
  // Propiedades adicionales de la vista payments_with_installments
  amount_paid?: number;
  balance_pending?: number;
  pct_paid?: number;
  installments_pending?: number;
  school_id?: string;
  concept?: string;
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
  const [selectedPayment, setSelectedPayment] = useState<{
    childId: string;
    childName: string;
    programId?: string;
    teamId?: string;
    programName: string;
    amount: number;
    schoolId: string;
    paymentId?: string;
  } | null>(null);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [viewingProof, setViewingProof] = useState<ViewingProof>({
    open: false,
    url: '',
    concept: '',
    amount: 0,
  });

  const [showInstallment, setShowInstallment] = useState(false);
  const [selectedInstallmentPayment, setSelectedInstallmentPayment] = useState<{
    id: string;
    schoolId: string;
    balancePending: number;
    concept: string;
  } | null>(null);

  const [installments, setInstallments] = useState<any[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'athlete') {
        window.location.href = '/athlete-payments';
        return;
      }
      fetchPaymentData();
    }
  }, [user, profile]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);

      // Fetch enriched payments view from Supabase
      const { data: payments, error } = await supabase
        .from('payments_with_installments' as any)
        .select('*')
        .eq('parent_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (!error && payments && payments.length > 0) {
        const txns: Transaction[] = payments.map((p: any) => ({
          id: p.id,
          school_id: p.school_id,
          amount: p.amount,
          amount_paid: p.amount_paid,
          balance_pending: p.balance_pending,
          pct_paid: p.pct_paid,
          installments_pending: p.installments_pending,
          concept: p.concept,
          payment_method: p.payment_type || 'transfer',
          status: p.status === 'paid' ? 'approved' : p.status,
          reference: p.receipt_number || `SP-${p.id.slice(0, 8).toUpperCase()}`,
          transaction_date: p.payment_date || p.created_at,
          authorization_code: p.status === 'paid' ? `AUTH-${p.id.slice(0, 5).toUpperCase()}` : undefined,
          receipt_url: p.receipt_url,
        }));
        setTransactions(txns);
      }

      // ── Query A: hijos del padre ─────────────────────────────────────────
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select(`
          id,
          full_name,
          monthly_fee,
          parent_id,
          school_id,
          team_id,
          teams:teams!children_team_id_fkey (
            name,
            price_monthly
          )
        `)
        .eq('parent_id', user?.id || '');

      if (childrenError || !childrenData || childrenData.length === 0) {
        setEnrollments([]);
        return;
      }

      const childIds = childrenData.map((c: any) => c.id);

      // ── Query B: enrollments activos con join a teams ────────────────────
      const { data: enrollData, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          id,
          child_id,
          team_id,
          program_id,
          school_id,
          status,
          team:teams!enrollments_team_id_fkey (
            name,
            price_monthly
          ),
          schools (
            name
          )
        `)
        .in('child_id', childIds)
        .eq('status', 'active');

      const enrollsByChild: Record<string, any[]> = {};
      if (!enrollError && enrollData) {
        enrollData.forEach((e: any) => {
          if (!enrollsByChild[e.child_id]) enrollsByChild[e.child_id] = [];
          enrollsByChild[e.child_id].push(e);
        });
      }

      if (!childrenError && childrenData) {
        const flattened: Enrollment[] = [];
        childrenData.forEach((child: any) => {
          const activeEnrollments = enrollsByChild[child.id] || [];

          // 1. Check formal enrollments first
          if (activeEnrollments.length > 0) {
            activeEnrollments.forEach((enroll: any) => {
              flattened.push({
                id: enroll.id,
                child_id: child.id,
                program_id: enroll.program_id,
                team_id: enroll.team_id || null,
                school_id: enroll.school_id,
                children: { full_name: child.full_name },
                teams: enroll.team ? { 
                  name: Array.isArray(enroll.team) ? enroll.team[0]?.name : (enroll.team as any).name, 
                  price_monthly: Array.isArray(enroll.team) ? enroll.team[0]?.price_monthly : (enroll.team as any).price_monthly 
                } : null,
                schools: enroll.schools,
              });
            });
          }
          // 2. FIX 2 — Asignación directa por team_id.
          else if (child.teams) {
            flattened.push({
              id: `direct-team-${child.id}`,
              child_id: child.id,
              program_id: null,
              team_id: child.team_id,
              school_id: child.school_id || '',
              children: { full_name: child.full_name },
              teams: {
                name: Array.isArray(child.teams) ? child.teams[0]?.name : (child.teams as any)?.name,
                price_monthly: Array.isArray(child.teams) ? child.teams[0]?.price_monthly : (child.teams as any)?.price_monthly,
              },
              schools: null,
            });
          }
          // 3. Fallback a mensualidad directa
          else if (child.monthly_fee > 0) {
            flattened.push({
              id: `child-${child.id}`,
              child_id: child.id,
              program_id: null,
              team_id: child.team_id || null,
              school_id: child.school_id || '',
              children: { full_name: child.full_name },
              teams: {
                name: 'Mensualidad Estudiante',
                price_monthly: child.monthly_fee,
              },
              schools: null,
            });
          }
          // 4. Ultimate fallback — sin programa
          else {
            flattened.push({
              id: `empty-${child.id}`,
              child_id: child.id,
              program_id: null,
              team_id: null,
              school_id: child.school_id || '',
              children: { full_name: child.full_name },
              teams: {
                name: 'Sin programa asignado',
                price_monthly: 0,
              },
              schools: null,
            });
          }
        });
        setEnrollments(flattened);
      }

      setSubscriptions([]);
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallments = async (paymentId: string) => {
    try {
      setLoadingInstallments(true);
      const { data, error } = await supabase
        .from('payment_installments')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstallments(data || []);
    } catch (err) {
      console.error('Error fetching installments:', err);
    } finally {
      setLoadingInstallments(false);
    }
  };

  const handleShowProof = async (receiptUrl: string, concept: string, amount: number) => {
    if (!receiptUrl) return;

    try {
      const cleanPath = getStoragePath(receiptUrl);
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(cleanPath, 300);

      if (error) throw error;

      setViewingProof({
        open: true,
        url: data.signedUrl,
        concept,
        amount,
      });
    } catch (err: unknown) {
      console.error('Error generating signed URL:', err);
      toast({
        title: 'Error de acceso',
        description: 'No se pudo generar el acceso seguro al comprobante.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    toast({
      title: 'Suscripción cancelada',
      description: 'Tu suscripción ha sido cancelada exitosamente',
    });
    setSubscriptions(prev => prev.filter(s => s.id !== subscriptionId));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Aprobado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>;
      case 'awaiting_approval':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="h-3 w-3 mr-1" />Por Validar</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200"><Percent className="h-3 w-3 mr-1" />Abono Recibido</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Vencido</Badge>;
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

  const getPaymentMethodLabel = (method: string) => {
    switch (method.toLowerCase()) {
      case 'pse': return 'PSE';
      case 'card':
      case 'tarjeta': return 'Tarjeta';
      case 'transfer': return 'Transf. / Nequi';
      default: return method.toUpperCase();
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
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="flex items-center gap-1 text-xs md:text-sm">
                              {getPaymentMethodIcon(txn.payment_method)}
                              <span className="hidden md:inline">{getPaymentMethodLabel(txn.payment_method)}</span>
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold whitespace-nowrap text-xs md:text-sm">
                            <div className="flex flex-col gap-1">
                              <span>{formatCurrency(txn.amount)}</span>
                              {txn.status === 'partial' && (
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  Pendiente: {formatCurrency((txn as any).balance_pending || 0)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {txn.status === 'approved' && (
                                <Button variant="ghost" size="sm" className="text-xs">
                                  Ver Recibo
                                </Button>
                              )}
                              {txn.receipt_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleShowProof(txn.receipt_url!, (txn as any).concept || '', txn.amount)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Comprobante
                                </Button>
                              )}
                              {txn.status === 'partial' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-primary hover:text-primary/80"
                                  onClick={() => {
                                    setSelectedInstallmentPayment({
                                      id: txn.id,
                                      schoolId: (txn as any).school_id || '',
                                      balancePending: (txn as any).balance_pending || 0,
                                      concept: (txn as any).concept || ''
                                    });
                                    setShowInstallment(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Abonar
                                </Button>
                              )}
                            </div>
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
              {transactions.filter(t => {
                console.log('STATUS EN FILTRO (length checking):', JSON.stringify(t.status), '| match:', t.status === 'awaiting_approval');
                return t.status === 'pending' || t.status === 'awaiting_approval';
              }).length > 0 ? (
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
                    {transactions.filter(t => {
                      console.log('STATUS EN FILTRO (mapping):', JSON.stringify(t.status), '| match:', t.status === 'awaiting_approval');
                      return t.status === 'pending' || t.status === 'awaiting_approval';
                    }).map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          {new Date(txn.transaction_date).toLocaleDateString('es-CO')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(txn.amount)}</TableCell>
                        <TableCell>
                          {txn.status === 'awaiting_approval' ? (
                            <Button size="sm" variant="outline" disabled>
                              En revisión
                            </Button>
                          ) : (
                            <div className="flex gap-2 items-center">
                              {txn.balance_pending !== undefined && txn.balance_pending > 0 && txn.balance_pending < txn.amount && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setSelectedInstallmentPayment({
                                      id: txn.id,
                                      schoolId: txn.school_id || '',
                                      balancePending: txn.balance_pending!,
                                      concept: txn.concept
                                    });
                                    setShowInstallment(true);
                                  }}
                                >
                                  Abonar
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => {
                                  setSelectedPayment({
                                    childId: '', 
                                    childName: '',
                                    programName: txn.concept,
                                    amount: txn.balance_pending || txn.amount,
                                    schoolId: txn.school_id || '',
                                    paymentId: txn.id,
                                  });
                                  setShowCheckout(true);
                                }}
                              >
                                {txn.balance_pending && txn.balance_pending < txn.amount ? 'Pagar Resto' : 'Completar Pago'}
                              </Button>
                            </div>
                          )}
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
            {enrollments.length > 0 ? (
              enrollments.map((enroll) => (
                <button
                  key={enroll.id}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 hover:border-primary transition-all text-left"
                  onClick={() => {
                    setSelectedPayment({
                      childId: enroll.child_id,
                      childName: enroll.children?.full_name || 'Estudiante',
                      programId: enroll.program_id || undefined,
                      teamId: enroll.team_id || undefined,
                      programName: enroll.teams?.name || 'Mensualidad Estudiante',
                      amount: enroll.teams?.price_monthly || 0,
                      schoolId: enroll.school_id,
                    });
                    setShowChildPicker(false);
                    setShowCheckout(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold">
                      {(enroll.children?.full_name || 'E').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{enroll.children?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {enroll.teams?.name || 'Sin curso asignado'}
                      </p>
                      {enroll.schools?.name && (
                        <p className="text-[10px] text-muted-foreground italic truncate">
                          Escuela: {enroll.schools.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="font-bold text-primary">{formatCurrency(enroll.teams?.price_monthly || 0)}</p>
                    <p className="text-xs text-muted-foreground">/mes</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No tienes hijos registrados.</p>
                <Button variant="link" asChild className="mt-2 text-primary p-0">
                  <a href="/children">Ir a Mis Hijos para registrarlos</a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Checkout Modal */}
      {selectedPayment && (
        <PaymentCheckoutModal
          open={showCheckout}
          onOpenChange={setShowCheckout}
          studentId={selectedPayment.childId}
          childId={selectedPayment.childId}
          programId={selectedPayment.programId}
          teamId={selectedPayment.teamId}
          schoolId={selectedPayment.schoolId}
          paymentId={selectedPayment.paymentId}
          amount={selectedPayment.amount}
          concept={selectedPayment.programName}
          mode={selectedPayment.paymentId ? 'update' : 'create'}
          onSuccess={fetchPaymentData}
        />
      )}

      {/* Installment Checkout Modal */}
      {selectedInstallmentPayment && (
        <InstallmentCheckoutModal
          open={showInstallment}
          onOpenChange={setShowInstallment}
          paymentId={selectedInstallmentPayment.id}
          schoolId={selectedInstallmentPayment.schoolId}
          parentId={user?.id || ''}
          balancePending={selectedInstallmentPayment.balancePending}
          onSuccess={fetchPaymentData}
        />
      )}

      {/* Proof Viewer Dialog for Parents */}
      <Dialog open={viewingProof.open} onOpenChange={(open) => setViewingProof(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mi Comprobante</DialogTitle>
            <DialogDescription>
              Referencia: {viewingProof.concept}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
              <span className="font-semibold">{viewingProof.concept}</span>
              <span className="font-bold text-lg">{formatCurrency(viewingProof.amount)}</span>
            </div>
            <div className="border rounded-md overflow-hidden bg-slate-50 min-h-[200px] flex items-center justify-center">
              {viewingProof.url ? (
                <img
                  src={viewingProof.url}
                  alt="Comprobante"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground p-8">
                  <p>Cargando imagen...</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setViewingProof(prev => ({ ...prev, open: false }))}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}