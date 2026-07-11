import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard, CheckCircle2, XCircle, Clock, Calendar,
  Plus, Eye, Loader2, Info,
  Percent, Zap, User, FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { InstallmentCheckoutModal } from '@/components/payment/InstallmentCheckoutModal';
import { formatCurrency } from '@/lib/utils';
import { normalizeReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Enrollment {
  id: string;
  child_id: string;
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
    school_type?: string;
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
  amount_paid?: number;
  balance_pending?: number;
  pct_paid?: number;
  installments_pending?: number;
  school_id?: string;
  school_type?: string;
  concept?: string;
  child_id?: string;
  child_name?: string;
  period_year?: number | null;
  period_month?: number | null;
  period_label?: string | null;
  late_fee_amount?: number | null;
}

const MONTH_NAMES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];
const formatPeriodLabel = (year?: number | null, month?: number | null): string | null =>
  year && month && month >= 1 && month <= 12 ? `${MONTH_NAMES_ES[month - 1]} ${year}` : null;

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending:           { label: 'Pendiente',   icon: Clock,       color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  awaiting_approval: { label: 'Por Validar', icon: Loader2,     color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  approved:          { label: 'Aprobado',   icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  rejected:          { label: 'Rechazado',  icon: XCircle,     color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  partial:           { label: 'Abono Recibido', icon: Percent,  color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' },
};

interface Subscription {
  id: string;
  team_id: string;
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
    teamId?: string;
    teamName: string;
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

  // Facturas electrónicas emitidas, mapeadas por payment_id (para mostrar el
  // botón "Factura" en los pagos que ya la tienen). La RLS deja al padre leer
  // la factura de su propio pago.
  const [invoiceMap, setInvoiceMap] = useState<Record<string, { number: string | null; public_url: string | null }>>({});

  useEffect(() => {
    if (user && profile) {
      if (profile.role !== 'parent') {
        window.location.href = profile.role === 'athlete' ? '/athlete-payments' : '/dashboard';
        return;
      }
      fetchPaymentData();
    }
  }, [user, profile]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);

      // ── PASO 1: Obtener hijos del padre ──────────────────────────────────
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

      if (childrenError) throw childrenError;

      const childIds = (childrenData || []).map((c: any) => c.id);

      // ── PASO 2: Pagos por parent_id O por child_id ────────────────────────
      let paymentsQuery = supabase
        .from('payments_with_installments' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (childIds.length > 0) {
        // Trae pagos donde soy el padre directamente O donde el child_id
        // pertenece a uno de mis hijos (pagos creados por admin sin parent_id)
        paymentsQuery = paymentsQuery.or(
          `parent_id.eq.${user?.id},child_id.in.(${childIds.join(',')})`
        );
      } else {
        // Sin hijos, solo pagos directos del padre
        paymentsQuery = paymentsQuery.eq('parent_id', user?.id || '');
      }

      const { data: payments, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      // ── PASO 2.5: Hidratar period_year/period_month desde la tabla base ──
      // La vista `payments_with_installments` no proyecta estas columnas
      // (creada antes de la migracion 20260503000004). Hacemos un select
      // directo a payments para obtenerlas por id. Si en el futuro la vista
      // se regenera incluyendo estos campos, esta query se vuelve redundante
      // pero no rompe nada (devuelve los mismos valores).
      const paymentIds = (payments || []).map((p: any) => p.id).filter(Boolean);
      let periodMap: Record<string, { period_year: number | null; period_month: number | null; late_fee_amount?: number | null }> = {};
      if (paymentIds.length > 0) {
        const { data: periodRows } = await supabase
          .from('payments')
          .select('id, period_year, period_month, late_fee_amount')
          .in('id', paymentIds);
        periodMap = Object.fromEntries(
          (periodRows || []).map((r: any) => [r.id, { period_year: r.period_year, period_month: r.period_month, late_fee_amount: r.late_fee_amount }]),
        );
      }

      // ── PASO 3: Enriquecer con school_type ───────────────────────────────
      const transactionSchoolIds = [...new Set((payments || []).map((p: any) => p.school_id).filter(Boolean))];
      let schoolTypeMap: Record<string, string> = {};

      if (transactionSchoolIds.length > 0) {
        const { data: schoolsData } = await supabase
          .from('schools')
          .select('id, school_type')
          .in('id', transactionSchoolIds);
        schoolTypeMap = Object.fromEntries((schoolsData || []).map(s => [s.id, s.school_type]));
      }

      const childNameMap = Object.fromEntries((childrenData || []).map(c => [c.id, c.full_name]));

      const txns: Transaction[] = (payments || []).map((p: any) => ({
        id: p.id,
        school_id: p.school_id,
        school_type: schoolTypeMap[p.school_id] || 'academy',
        amount: p.amount,
        amount_paid: p.amount_paid,
        balance_pending: p.balance_pending,
        pct_paid: p.pct_paid,
        installments_pending: p.installments_pending,
        concept: p.concept,
        child_id: p.child_id,
        child_name: childNameMap[p.child_id] || 'Deportista',
        payment_method: p.payment_type || 'transfer',
        status: p.status === 'paid' ? 'approved' : p.status,
        reference: p.receipt_number || `SP-${p.id.slice(0, 8).toUpperCase()}`,
        transaction_date: p.payment_date || p.created_at,
        authorization_code: p.status === 'paid' ? `AUTH-${p.id.slice(0, 5).toUpperCase()}` : undefined,
        receipt_url: p.receipt_url,
        period_year:  periodMap[p.id]?.period_year ?? p.period_year ?? null,
        period_month: periodMap[p.id]?.period_month ?? p.period_month ?? null,
        period_label: formatPeriodLabel(
          periodMap[p.id]?.period_year ?? p.period_year,
          periodMap[p.id]?.period_month ?? p.period_month,
        ),
        late_fee_amount: periodMap[p.id]?.late_fee_amount ?? p.late_fee_amount ?? null,
      }));
      setTransactions(txns);

      // ── PASO 3.5: Facturas electrónicas emitidas por pago ─────────────────
      if (paymentIds.length > 0) {
        const { data: invRows } = await supabase
          .from('electronic_invoices')
          .select('payment_id, number, public_url, status')
          .in('payment_id', paymentIds)
          .in('status', ['accepted', 'sent']);
        setInvoiceMap(
          Object.fromEntries(
            (invRows || [])
              .filter((r: any) => r.payment_id)
              .map((r: any) => [r.payment_id, { number: r.number, public_url: r.public_url }]),
          ),
        );
      }

      // ── PASO 4: Enrollments (usando childrenData ya cargado) ──────────────
      if (childrenData && childrenData.length > 0) {
        const { data: enrollData, error: enrollError } = await supabase
          .from('enrollments')
          .select(`
            id,
            child_id,
            team_id,
            offering_plan_id,
            monthly_fee,
            school_id,
            status,
            team:teams!enrollments_team_id_fkey (
              name,
              price_monthly
            ),
            offering_plans!offering_plan_id (
              name,
              price,
              offerings!offering_id ( name )
            ),
            schools (
              name,
              school_type
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

        const flattened: Enrollment[] = [];
        childrenData.forEach((child: any) => {
          const activeEnrollments = enrollsByChild[child.id] || [];

          if (activeEnrollments.length > 0) {
            activeEnrollments.forEach((enroll: any) => {
              const team = Array.isArray(enroll.team) ? enroll.team[0] : enroll.team;
              const plan = Array.isArray(enroll.offering_plans) ? enroll.offering_plans[0] : enroll.offering_plans;
              const offering = plan ? (Array.isArray(plan.offerings) ? plan.offerings[0] : plan.offerings) : null;
              // La cuota individual (enrollments.monthly_fee, editable por escuela/PT)
              // manda sobre el precio de catálogo del equipo/plan.
              const catalogPrice = team?.price_monthly ?? plan?.price ?? 0;
              const resolvedFee = enroll.monthly_fee ?? catalogPrice;
              const lineName = team?.name
                ?? (plan ? (offering?.name ? `${offering.name} — ${plan.name}` : plan.name) : 'Mensualidad Deportista');
              flattened.push({
                id: enroll.id,
                child_id: child.id,
                team_id: enroll.team_id || null,
                school_id: enroll.school_id,
                children: { full_name: child.full_name },
                teams: { name: lineName, price_monthly: resolvedFee },
                schools: enroll.schools,
              });
            });
          }
          else if (child.teams) {
            const directTeam = Array.isArray(child.teams) ? child.teams[0] : (child.teams as any);
            flattened.push({
              id: `direct-team-${child.id}`,
              child_id: child.id,
              team_id: child.team_id,
              school_id: child.school_id || '',
              children: { full_name: child.full_name },
              teams: {
                name: directTeam?.name,
                // cuota individual del atleta por encima del precio del equipo
                price_monthly: child.monthly_fee || directTeam?.price_monthly || 0,
              },
              schools: null,
            });
          }
          else if (child.monthly_fee > 0) {
            flattened.push({
              id: `child-${child.id}`,
              child_id: child.id,
              team_id: child.team_id || null,
              school_id: child.school_id || '',
              children: { full_name: child.full_name },
              teams: {
                name: 'Mensualidad Deportista',
                price_monthly: child.monthly_fee,
              },
              schools: null,
            });
          }
          else {
            flattened.push({
              id: `empty-${child.id}`,
              child_id: child.id,
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
      } else {
        setEnrollments([]);
      }

      setSubscriptions([]);
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowProof = async (receiptUrl: string, concept: string, amount: number) => {
    if (!receiptUrl) return;

    // ✅ Short-circuit si ya es URL pública directa
    if (receiptUrl.startsWith('http')) {
      setViewingProof({ open: true, url: receiptUrl, concept, amount });
      return;
    }

    try {
      const cleanPath = normalizeReceiptUrl(receiptUrl);
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

  const summary = {
    count_pending: transactions.filter(t => t.status === 'pending' || t.status === 'awaiting_approval' || t.status === 'partial').length,
    count_approved: transactions.filter(t => t.status === 'approved').length,
    pending_total: transactions.filter(t => t.status !== 'approved').reduce((sum, t) => sum + (t.balance_pending || t.amount), 0),
    count_total: transactions.length
  };

  const renderPaymentList = (list: Transaction[]) => {
    if (list.length === 0) return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg">Sin movimientos</h3>
          <p className="text-muted-foreground mt-1">No hay registros en esta sección.</p>
        </CardContent>
      </Card>
    );

    return list.map(txn => (
      <PaymentCard
        key={txn.id}
        txn={txn}
        invoice={invoiceMap[txn.id]}
        onSelect={(p) => {
          if (p.status === 'approved') return;
          setSelectedPayment(prev => prev?.paymentId === p.id ? null : {
            childId: p.child_id || '',
            childName: p.child_name || 'Deportista',
            teamName: p.concept || 'Mensualidad',
            amount: p.balance_pending || p.amount,
            schoolId: p.school_id || '',
            paymentId: p.id
          });
        }}
        isSelected={selectedPayment?.paymentId === txn.id}
        onShowProof={handleShowProof}
        onAbonar={(p) => {
          setSelectedInstallmentPayment({
            id: p.id,
            schoolId: p.school_id || '',
            balancePending: p.balance_pending || 0,
            concept: p.concept || ''
          });
          setShowInstallment(true);
        }}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3 truncate">
            <CreditCard className="h-7 w-7 text-primary" />
            Mis Pagos
          </h1>
          <p className="text-sm md:text-base text-muted-foreground truncate">Gestiona tus pagos y suscripciones</p>
        </div>
        <Button onClick={() => setShowChildPicker(true)} size="sm" className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pago
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-xl font-bold text-foreground">{summary.count_pending}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monto pendiente</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(summary.pending_total)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pagos realizados</p>
              <p className="text-xl font-bold text-foreground">{summary.count_approved}</p>
            </div>
          </CardContent>
        </Card>
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
                    <p className="font-semibold">Equipo {sub.team_id}</p>
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

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todas ({summary.count_total})</TabsTrigger>
          <TabsTrigger value="approved">Aprobadas ({summary.count_approved})</TabsTrigger>
          <TabsTrigger value="pending">Pendientes ({summary.count_pending})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderPaymentList(transactions)}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {renderPaymentList(transactions.filter(t => t.status === 'approved'))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {renderPaymentList(transactions.filter(t => t.status !== 'approved'))}
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
              enrollments.map((enroll) => {
                const isPT = enroll.schools?.school_type === 'personal_trainer';
                return (
                  <button
                    key={enroll.id}
                    className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all text-left shadow-sm
                      ${isPT 
                        ? 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-950 dark:bg-zinc-950 dark:hover:bg-black' 
                        : 'bg-background hover:bg-muted/50 hover:border-primary'}`}
                    onClick={() => {
                      setSelectedPayment({
                        childId: enroll.child_id,
                        childName: enroll.children?.full_name || 'Deportista',
                        teamId: enroll.team_id || undefined,
                        teamName: enroll.teams?.name || 'Mensualidad Deportista',
                        amount: enroll.teams?.price_monthly || 0,
                        schoolId: enroll.school_id,
                      });
                      setShowChildPicker(false);
                      setShowCheckout(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm
                        ${isPT 
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/20' 
                          : 'bg-gradient-to-br from-primary to-primary/60'}`}>
                        {isPT ? <User className="h-5 w-5" /> : (enroll.children?.full_name || 'E').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold truncate ${isPT ? 'text-zinc-100' : ''}`}>{enroll.children?.full_name}</p>
                        <p className={`text-xs truncate ${isPT ? 'text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1' : 'text-muted-foreground'}`}>
                          {isPT && <Zap className="h-3 w-3" />}
                          {isPT ? 'Coach Personal' : (enroll.teams?.name || 'Sin curso asignado')}
                        </p>
                        {enroll.schools?.name && (
                          <p className={`text-[10px] italic truncate ${isPT ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                            {isPT ? `Con ${enroll.schools.name}` : `Escuela: ${enroll.schools.name}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className={`font-bold ${isPT ? 'text-indigo-400' : 'text-primary'}`}>{formatCurrency(enroll.teams?.price_monthly || 0)}</p>
                      <p className={`text-xs ${isPT ? 'text-zinc-500' : 'text-muted-foreground'}`}>/mes</p>
                    </div>
                  </button>
                );
              })
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
          teamId={selectedPayment.teamId}
          schoolId={selectedPayment.schoolId}
          paymentId={selectedPayment.paymentId}
          amount={selectedPayment.amount}
          concept={selectedPayment.teamName}
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

      {/* Barra de acción flotante (estilo atleta) */}
      {selectedPayment && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 dark:border-zinc-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col min-w-0">
            <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-bold truncate">
              {selectedPayment.childName} — {selectedPayment.teamName}
            </span>
            <span className="font-bold text-xl text-indigo-400 dark:text-indigo-300">
              {formatCurrency(selectedPayment.amount)}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 dark:hover:bg-zinc-900 hidden sm:flex"
              onClick={() => setSelectedPayment(null)}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 font-bold shadow-lg shadow-indigo-600/20"
              onClick={() => setShowCheckout(true)}
            >
              Pagar Ahora
            </Button>
          </div>
        </div>
      )}

      {/* Proof Viewer Dialog for Parents */}
      <Dialog open={viewingProof.open} onOpenChange={(open) => setViewingProof(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mi Comprobante</DialogTitle>
            <DialogDescription>
              {viewingProof.concept}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-sm truncate mr-2">{viewingProof.concept}</span>
              <span className="font-bold text-lg shrink-0">
                {formatCurrency(viewingProof.amount)}
              </span>
            </div>
            <div className="border rounded-md overflow-hidden bg-muted/30 min-h-[200px] flex items-center justify-center">
              {viewingProof.url ? (
                <img
                  src={viewingProof.url}
                  alt="Comprobante"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground p-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Cargando comprobante...</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 text-primary">
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

function PaymentCard({ txn, onSelect, isSelected, onShowProof, onAbonar, invoice }: {
  txn: Transaction;
  onSelect: (p: Transaction) => void;
  isSelected: boolean;
  onShowProof: (url: string, concept: string, amount: number) => void;
  onAbonar: (p: Transaction) => void;
  invoice?: { number: string | null; public_url: string | null };
}) {
  const config = statusConfig[txn.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card
      className={`transition-all overflow-hidden ${txn.status === 'approved' ? 'cursor-default' : 'cursor-pointer hover:border-primary/30'} ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
          : 'border-border'
      }`}
      onClick={() => onSelect(txn)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${config.color.split(' ')[0]}`}>
            <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.color.split(' ')[1]}`} />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {txn.child_name || 'Deportista'}
              </span>
              {txn.school_type === 'personal_trainer' && (
                <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 font-bold">
                  <Zap className="h-2.5 w-2.5 mr-1 fill-indigo-500/20" />
                  ENTRENADOR PT
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                {txn.period_label
                  ? `Mensualidad ${txn.period_label}`
                  : (txn.concept || 'Mensualidad')}
              </h3>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm sm:text-base text-foreground">
                  {formatCurrency(txn.amount)}
                </p>
                {txn.status === 'partial' && (
                  <p className="text-[10px] text-red-500 dark:text-red-400 font-bold">
                    PENDIENTE: {formatCurrency(txn.balance_pending || 0)}
                  </p>
                )}
                {(txn.late_fee_amount ?? 0) > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Incluye recargo por mora: {formatCurrency(txn.late_fee_amount as number)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(txn.transaction_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                REF: <span className="font-mono">{txn.reference}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t mt-3 sm:mt-4">
              <Badge variant="outline" className={`h-6 text-[10px] font-bold ${config.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label.toUpperCase()}
              </Badge>

              <div className="flex items-center gap-2">
                {invoice?.public_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    title={invoice.number ? `Factura ${invoice.number}` : 'Factura electrónica'}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(invoice.public_url!, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    FACTURA
                  </Button>
                )}
                {txn.receipt_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowProof(txn.receipt_url!, txn.concept || '', txn.amount);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    RECIBO
                  </Button>
                )}
                {txn.status === 'partial' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] font-bold text-primary hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAbonar(txn);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    ABONAR
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}